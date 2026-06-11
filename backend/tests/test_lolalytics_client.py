"""Tests for LolalyticsClient — rate limiting, concurrency, and HTTP behavior.

Run from the backend/ directory:
    python -m pytest tests/test_lolalytics_client.py -v
"""

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

# Ensure the backend package root is on sys.path so imports resolve correctly
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.lolalytics_client import LolalyticsClient, LolalyticsTimeoutError

# All async tests in this file are marked automatically
pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_response(json_data: dict, raise_status: bool = False) -> MagicMock:
    """Build a minimal mock httpx response."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = json_data
    if raise_status:
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "404 Not Found",
            request=MagicMock(),
            response=MagicMock(),
        )
    else:
        mock_resp.raise_for_status = MagicMock()
    return mock_resp


def _make_mock_http(json_data: dict, raise_status: bool = False) -> AsyncMock:
    """Build a mock httpx.AsyncClient whose get() returns a mock response."""
    mock_resp = _make_mock_response(json_data, raise_status=raise_status)
    mock_http = AsyncMock(spec=httpx.AsyncClient)
    mock_http.get = AsyncMock(return_value=mock_resp)
    mock_http.is_closed = False
    return mock_http


# ===========================================================================
# TestFetch — basic HTTP behavior
# ===========================================================================

class TestFetch:

    async def test_successful_fetch_returns_data(self):
        """fetch() returns the parsed JSON body on a 200 response."""
        expected = {"cid": {}}
        mock_http = _make_mock_http(expected)
        client = LolalyticsClient(http_client=mock_http)

        result = await client.fetch({"ep": "list"})

        assert result == expected

    async def test_params_forwarded_to_http(self):
        """The params dict passed to fetch() is forwarded verbatim to http_client.get()."""
        mock_http = _make_mock_http({"ok": True})
        client = LolalyticsClient(http_client=mock_http)

        params = {"ep": "counter", "lane": "bottom", "c": "caitlyn"}
        await client.fetch(params)

        mock_http.get.assert_called_once()
        call_kwargs = mock_http.get.call_args
        # params may be passed as positional or keyword arg
        if call_kwargs.args and len(call_kwargs.args) > 1:
            forwarded = call_kwargs.args[1]
        else:
            forwarded = call_kwargs.kwargs.get("params")
        assert forwarded == params

    async def test_http_status_error_propagates(self):
        """fetch() re-raises httpx.HTTPStatusError from raise_for_status()."""
        mock_http = _make_mock_http({}, raise_status=True)
        client = LolalyticsClient(http_client=mock_http)

        with pytest.raises(httpx.HTTPStatusError):
            await client.fetch({"ep": "list"})


# ===========================================================================
# TestBurstRateLimit — sliding window enforcement
# ===========================================================================

class TestBurstRateLimit:

    async def test_burst_cap_allows_up_to_limit(self):
        """burst_per_second=5: firing 5 concurrent fetches should all complete."""
        mock_http = _make_mock_http({"data": 1})
        client = LolalyticsClient(burst_per_second=5, max_concurrent=10, http_client=mock_http)

        results = await asyncio.gather(
            *[client.fetch({"ep": "list"}) for _ in range(5)]
        )

        assert len(results) == 5
        assert all(r == {"data": 1} for r in results)

    async def test_burst_cap_queues_excess(self):
        """
        burst_per_second=3, queue_timeout=2.0: firing 4 requests should all complete.

        The first 3 claim slots immediately; the 4th waits ~1s for the window to slide
        and must not time out with a 2s deadline.
        """
        mock_http = _make_mock_http({"data": 1})
        client = LolalyticsClient(
            burst_per_second=3,
            max_concurrent=10,
            queue_timeout=2.0,
            http_client=mock_http,
        )

        results = await asyncio.gather(
            *[client.fetch({"ep": "list"}) for _ in range(4)]
        )

        assert len(results) == 4

    async def test_burst_cap_timeout_when_queue_too_long(self):
        """
        burst_per_second=1, queue_timeout=0.1: firing 3 concurrent requests should cause
        at least one to raise LolalyticsTimeoutError because it cannot get a slot in 0.1s.
        """
        mock_http = _make_mock_http({"data": 1})
        client = LolalyticsClient(
            burst_per_second=1,
            max_concurrent=10,
            queue_timeout=0.1,
            http_client=mock_http,
        )

        # At least one of the 3 concurrent requests should timeout
        with pytest.raises(LolalyticsTimeoutError):
            await asyncio.gather(
                *[client.fetch({"ep": "list"}) for _ in range(3)]
            )


# ===========================================================================
# TestConcurrencyLimit — semaphore enforcement
# ===========================================================================

class TestConcurrencyLimit:

    async def test_concurrent_cap_enforced(self):
        """
        max_concurrent=2: at most 2 fetches should be in-flight simultaneously.

        A slow HTTP mock (0.1s/request) allows us to track the peak concurrency
        via a shared counter guarded by an asyncio.Event.
        """
        active_count = 0
        peak_count = 0

        async def slow_get(*args, **kwargs):
            nonlocal active_count, peak_count
            active_count += 1
            if active_count > peak_count:
                peak_count = active_count
            await asyncio.sleep(0.1)
            active_count -= 1
            mock_resp = _make_mock_response({"data": 1})
            return mock_resp

        mock_http = AsyncMock(spec=httpx.AsyncClient)
        mock_http.get = slow_get
        mock_http.is_closed = False

        client = LolalyticsClient(
            max_concurrent=2,
            burst_per_second=30,
            queue_timeout=5.0,
            http_client=mock_http,
        )

        await asyncio.gather(*[client.fetch({"ep": "list"}) for _ in range(5)])

        assert peak_count <= 2, f"Peak concurrency {peak_count} exceeded max_concurrent=2"

    async def test_semaphore_timeout(self):
        """
        max_concurrent=1, queue_timeout=0.05: while one slow request (0.2s) holds the
        semaphore, a second concurrent request should raise LolalyticsTimeoutError.
        """
        async def slow_get(*args, **kwargs):
            await asyncio.sleep(0.2)
            return _make_mock_response({"data": 1})

        mock_http = AsyncMock(spec=httpx.AsyncClient)
        mock_http.get = slow_get
        mock_http.is_closed = False

        client = LolalyticsClient(
            max_concurrent=1,
            burst_per_second=30,
            queue_timeout=0.05,
            http_client=mock_http,
        )

        with pytest.raises(LolalyticsTimeoutError):
            await asyncio.gather(
                client.fetch({"ep": "list"}),
                client.fetch({"ep": "list"}),
            )


# ===========================================================================
# TestClose
# ===========================================================================

class TestClose:

    async def test_close_closes_http_client(self):
        """close() calls aclose() on an injected mock HTTP client."""
        mock_http = AsyncMock(spec=httpx.AsyncClient)
        mock_http.is_closed = False
        client = LolalyticsClient(http_client=mock_http)

        await client.close()

        mock_http.aclose.assert_called_once()

    async def test_close_noop_when_no_client(self):
        """close() should not raise when no HTTP client has been created."""
        client = LolalyticsClient()  # no injected http_client, never called fetch

        # Must not raise
        await client.close()
