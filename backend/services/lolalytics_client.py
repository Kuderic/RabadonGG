"""Centralized HTTP client for all lolalytics.com API calls.

Enforces:
  - max_concurrent (default 10): at most N in-flight HTTP requests at once
  - burst_per_second (default 30): at most N new requests started per rolling second
  - queue_timeout (default 30s): raises LolalyticsTimeoutError if a request waits too long

All lolalytics fetches go through get_client().fetch(params). Direct httpx
calls to a1.lolalytics.com anywhere else are not permitted.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

LOLA_BASE_URL = "https://a1.lolalytics.com/mega/"


class LolalyticsTimeoutError(Exception):
    """A request waited longer than queue_timeout seconds for a rate or concurrency slot."""


class LolalyticsClient:
    """
    Async HTTP client for the lolalytics mega API with rate limiting and concurrency control.

    Rate limiting uses a sliding-window counter: at most `burst_per_second` requests
    are started within any rolling 1-second window. Concurrency is capped by a semaphore.
    Both limits share a single deadline so total queue wait never exceeds `queue_timeout`.

    Pass `http_client` in tests to inject a mock instead of making real HTTP calls.
    """

    def __init__(
        self,
        max_concurrent: int = 10,
        burst_per_second: int = 30,
        queue_timeout: float = 30.0,
        base_url: str = LOLA_BASE_URL,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.max_concurrent = max_concurrent
        self.burst_per_second = burst_per_second
        self.queue_timeout = queue_timeout
        self.base_url = base_url

        # Lazily created inside the running event loop (avoids DeprecationWarning in 3.10+)
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._rate_lock: Optional[asyncio.Lock] = None
        self._window: List[float] = []  # timestamps of requests in the last 1s

        self._http = http_client  # injected mock or None → created on first use

    # ------------------------------------------------------------------
    # Lazy asyncio primitive accessors
    # ------------------------------------------------------------------

    def _get_semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self.max_concurrent)
        return self._semaphore

    def _get_rate_lock(self) -> asyncio.Lock:
        if self._rate_lock is None:
            self._rate_lock = asyncio.Lock()
        return self._rate_lock

    def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=httpx.Timeout(30.0))
        return self._http

    # ------------------------------------------------------------------
    # Rate-limit gate
    # ------------------------------------------------------------------

    async def _wait_for_rate_slot(self, deadline: float) -> None:
        """Block until a burst-cap slot opens, or raise LolalyticsTimeoutError."""
        loop = asyncio.get_running_loop()
        rate_lock = self._get_rate_lock()
        warned = False
        while True:
            now = loop.time()
            if now >= deadline:
                raise LolalyticsTimeoutError(
                    f"Request queued for >{self.queue_timeout:.0f}s waiting for rate-limit slot"
                )
            async with rate_lock:
                cutoff = now - 1.0
                # Evict timestamps outside the rolling 1-second window
                while self._window and self._window[0] <= cutoff:
                    self._window.pop(0)
                if len(self._window) < self.burst_per_second:
                    self._window.append(now)
                    return  # slot acquired
            if not warned:
                logger.warning(
                    "lolalytics rate cap reached (%d req/s); queuing request",
                    self.burst_per_second,
                )
                warned = True
            # Slot full — sleep briefly then retry (~30 Hz)
            await asyncio.sleep(0.033)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def fetch(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        GET the lolalytics mega API with rate-limiting and concurrency control.

        Raises:
            LolalyticsTimeoutError: waited longer than queue_timeout for a slot.
            httpx.HTTPStatusError: server returned a non-2xx status.
            httpx.RequestError: network-level failure (timeout, DNS, etc.).
        """
        loop = asyncio.get_running_loop()
        deadline = loop.time() + self.queue_timeout

        # 1. Burst-rate gate (sliding window, lightweight lock)
        await self._wait_for_rate_slot(deadline)

        # 2. Concurrency gate (semaphore on actual in-flight HTTP connections)
        remaining = deadline - loop.time()
        if remaining <= 0:
            raise LolalyticsTimeoutError("Request timed out before acquiring a concurrency slot")
        semaphore = self._get_semaphore()
        try:
            await asyncio.wait_for(semaphore.acquire(), timeout=remaining)
        except asyncio.TimeoutError:
            raise LolalyticsTimeoutError(
                f"Request waited >{self.queue_timeout:.0f}s for a concurrency slot"
            )

        # 3. HTTP request (semaphore released in finally to prevent leaks)
        try:
            resp = await self._get_http().get(self.base_url, params=params)
            resp.raise_for_status()
            return resp.json()
        finally:
            semaphore.release()

    async def close(self) -> None:
        """Release the underlying HTTP connection pool."""
        if self._http is not None and not self._http.is_closed:
            await self._http.aclose()
            logger.info("LolalyticsClient HTTP session closed")


# ---------------------------------------------------------------------------
# Module-level singleton — shared across all requests in the process
# ---------------------------------------------------------------------------

_client: Optional[LolalyticsClient] = None


def get_client() -> LolalyticsClient:
    """Return the process-wide LolalyticsClient, creating it on first call."""
    global _client
    if _client is None:
        _client = LolalyticsClient()
    return _client
