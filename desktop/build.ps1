# Rabadon.GG desktop build script
# Run from anywhere in the repo: .\desktop\build.ps1
# Produces installers at:
#   desktop\src-tauri\target\release\bundle\nsis\Rabadon_0.1.0_x64-setup.exe
#   desktop\src-tauri\target\release\bundle\msi\Rabadon_0.1.0_x64_en-US.msi

$ErrorActionPreference = "Stop"

# Locate MSVC linker (required by Rust MSVC toolchain on Windows)
$msvcBase = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC"
if (-not (Test-Path $msvcBase)) {
    Write-Error "VS 2022 Build Tools not found at $msvcBase. Install from: winget install Microsoft.VisualStudio.2022.BuildTools"
}
$msvcVersion = Get-ChildItem $msvcBase | Sort-Object Name | Select-Object -Last 1 -ExpandProperty Name
$MSVC_BIN = "$msvcBase\$msvcVersion\bin\Hostx64\x64"

# Locate Windows SDK
$sdkBase = "C:\Program Files (x86)\Windows Kits\10\bin"
$sdkVersion = Get-ChildItem $sdkBase | Where-Object { $_.Name -match "^\d" } | Sort-Object Name | Select-Object -Last 1 -ExpandProperty Name
$SDK_BIN = "$sdkBase\$sdkVersion\x64"

# Cargo
$CARGO_BIN = "$env:USERPROFILE\.cargo\bin"
if (-not (Test-Path "$CARGO_BIN\cargo.exe")) {
    Write-Error "cargo not found at $CARGO_BIN. Install Rust from: https://rustup.rs"
}

$env:PATH = "$MSVC_BIN;$SDK_BIN;$CARGO_BIN;$env:PATH"

Write-Host "MSVC: $msvcVersion" -ForegroundColor Cyan
Write-Host "SDK:  $sdkVersion" -ForegroundColor Cyan
Write-Host ""

# Build from the desktop directory
$desktopDir = Join-Path $PSScriptRoot ""
Set-Location $desktopDir

npm run tauri build

Write-Host ""
Write-Host "Installers ready:" -ForegroundColor Green
Get-ChildItem "src-tauri\target\release\bundle" -Recurse -Include "*.exe","*.msi" | ForEach-Object {
    Write-Host "  $($_.FullName)" -ForegroundColor Green
}
