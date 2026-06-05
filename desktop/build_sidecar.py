"""
build_sidecar.py — PyInstaller bundler for the Rabadon.GG FastAPI backend.

Produces a single-file executable at:
  desktop/src-tauri/binaries/backend-x86_64-pc-windows-msvc.exe

This matches Tauri's required sidecar naming convention so tauri.conf.json
can reference it as "backend".

Usage (from repo root):
  python desktop/build_sidecar.py

Requirements:
  pip install pyinstaller
  (All backend deps must also be installed in the active environment.)
"""

import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths (all resolved relative to the repo root, which is one level up from
# the directory containing this script).
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent.resolve()
REPO_ROOT = SCRIPT_DIR.parent

BACKEND_DIR = REPO_ROOT / "backend"
ENTRY_POINT = BACKEND_DIR / "main.py"
DATA_DIR = BACKEND_DIR / "data"

OUTPUT_DIR = SCRIPT_DIR / "src-tauri" / "binaries"
EXE_NAME = "backend-x86_64-pc-windows-msvc"

# ---------------------------------------------------------------------------
# Hidden imports — modules that PyInstaller's static analysis misses because
# they are imported lazily (inside functions / conditional blocks) or via
# plugin machinery.
# ---------------------------------------------------------------------------
HIDDEN_IMPORTS = [
    # FastAPI / Starlette internals
    "fastapi",
    "fastapi.middleware.cors",
    "starlette",
    "starlette.routing",
    "starlette.middleware",
    "starlette.middleware.cors",
    "starlette.responses",
    "starlette.requests",
    "starlette.background",
    "starlette.concurrency",
    "starlette.datastructures",
    "starlette.exceptions",
    "starlette.status",
    "starlette.testclient",
    "starlette.types",
    "starlette.websockets",
    # Uvicorn
    "uvicorn",
    "uvicorn.main",
    "uvicorn.config",
    "uvicorn.server",
    "uvicorn.loops",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.http.httptools_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.protocols.websockets.wsproto_impl",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.logging",
    # Pydantic v2
    "pydantic",
    "pydantic.v1",
    "pydantic_core",
    # httpx
    "httpx",
    "httpx._transports.default",
    "httpcore",
    # Pillow (PIL)
    "PIL",
    "PIL.Image",
    "PIL.ImageFile",
    "PIL.WebPImagePlugin",
    "PIL.PngImagePlugin",
    "PIL.JpegImagePlugin",
    # aiosqlite / sqlite3
    "aiosqlite",
    "sqlite3",
    # websockets
    "websockets",
    "websockets.legacy",
    "websockets.legacy.client",
    "websockets.legacy.server",
    "websockets.client",
    "websockets.server",
    # asyncio extras
    "asyncio",
    "anyio",
    "anyio._backends._asyncio",
    "anyio._backends._trio",
    # h11 / httptools (uvicorn HTTP parser backends)
    "h11",
    "httptools",
    # wsproto (uvicorn WebSocket backend)
    "wsproto",
    # click (uvicorn CLI dependency)
    "click",
    # python-dotenv
    "dotenv",
    # Local application modules (imported lazily inside startup handlers)
    "routes",
    "routes.recommend",
    "routes.lcu",
    "services",
    "services.db",
    "services.scraper",
    "services.scorer",
    "services.lcu",
    "models",
    "scoring_config",
]

# ---------------------------------------------------------------------------
# --add-data entries: "<src>;<dest_dir>" (Windows separator is semicolon)
# ---------------------------------------------------------------------------
ADD_DATA = [
    # Bundle the SQLite cache directory so the sidecar can read/write it at
    # runtime.  At runtime PyInstaller sets sys._MEIPASS; the backend's db.py
    # should fall back to a writable path next to the exe for writes.
    f"{DATA_DIR};data",
]

# ---------------------------------------------------------------------------
# Build the PyInstaller command
# ---------------------------------------------------------------------------

def build() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        str(ENTRY_POINT),
        "--name", EXE_NAME,
        "--onefile",
        "--distpath", str(OUTPUT_DIR),
        "--workpath", str(SCRIPT_DIR / "build" / "pyinstaller-work"),
        "--specpath", str(SCRIPT_DIR / "build"),
        # Add the backend directory to sys.path so local imports resolve
        "--paths", str(BACKEND_DIR),
        "--noconfirm",
        "--clean",
        "--log-level", "WARN",
    ]

    for module in HIDDEN_IMPORTS:
        cmd += ["--hidden-import", module]

    for entry in ADD_DATA:
        cmd += ["--add-data", entry]

    print(f"[build_sidecar] Running PyInstaller...")
    print(f"[build_sidecar] Entry point : {ENTRY_POINT}")
    print(f"[build_sidecar] Output      : {OUTPUT_DIR / (EXE_NAME + '.exe')}")
    print()

    result = subprocess.run(cmd, check=False)

    if result.returncode != 0:
        print(f"\n[build_sidecar] PyInstaller exited with code {result.returncode}", file=sys.stderr)
        sys.exit(result.returncode)

    exe_path = OUTPUT_DIR / f"{EXE_NAME}.exe"
    if exe_path.exists():
        size_mb = exe_path.stat().st_size / (1024 * 1024)
        print(f"\n[build_sidecar] Done. Sidecar written to:")
        print(f"  {exe_path}  ({size_mb:.1f} MB)")
    else:
        print(f"\n[build_sidecar] WARNING: expected output not found at {exe_path}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    build()
