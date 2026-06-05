# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:\\Code\\RabadonGG\\backend\\main.py'],
    pathex=['C:\\Code\\RabadonGG\\backend'],
    binaries=[],
    datas=[('C:\\Code\\RabadonGG\\backend\\data', 'data')],
    hiddenimports=['fastapi', 'fastapi.middleware.cors', 'starlette', 'starlette.routing', 'starlette.middleware', 'starlette.middleware.cors', 'starlette.responses', 'starlette.requests', 'starlette.background', 'starlette.concurrency', 'starlette.datastructures', 'starlette.exceptions', 'starlette.status', 'starlette.testclient', 'starlette.types', 'starlette.websockets', 'uvicorn', 'uvicorn.main', 'uvicorn.config', 'uvicorn.server', 'uvicorn.loops', 'uvicorn.loops.asyncio', 'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.http.h11_impl', 'uvicorn.protocols.http.httptools_impl', 'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto', 'uvicorn.protocols.websockets.websockets_impl', 'uvicorn.protocols.websockets.wsproto_impl', 'uvicorn.lifespan', 'uvicorn.lifespan.on', 'uvicorn.logging', 'pydantic', 'pydantic.v1', 'pydantic_core', 'httpx', 'httpx._transports.default', 'httpcore', 'PIL', 'PIL.Image', 'PIL.ImageFile', 'PIL.WebPImagePlugin', 'PIL.PngImagePlugin', 'PIL.JpegImagePlugin', 'aiosqlite', 'sqlite3', 'websockets', 'websockets.legacy', 'websockets.legacy.client', 'websockets.legacy.server', 'websockets.client', 'websockets.server', 'asyncio', 'anyio', 'anyio._backends._asyncio', 'anyio._backends._trio', 'h11', 'httptools', 'wsproto', 'click', 'dotenv', 'routes', 'routes.recommend', 'routes.lcu', 'services', 'services.db', 'services.scraper', 'services.scorer', 'services.lcu', 'models', 'scoring_config'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='backend-x86_64-pc-windows-msvc',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
