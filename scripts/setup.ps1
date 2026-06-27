# setup.ps1 — downloads the bundled tools (yt-dlp + ffmpeg) into bin/.
# Run once after cloning:  powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$bin  = Join-Path $root 'bin'
New-Item -ItemType Directory -Force -Path $bin | Out-Null

Write-Host 'Downloading yt-dlp.exe...' -ForegroundColor Cyan
Invoke-WebRequest 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile (Join-Path $bin 'yt-dlp.exe')

Write-Host 'Downloading ffmpeg (~140MB)...' -ForegroundColor Cyan
$zip = Join-Path $bin 'ffmpeg.zip'
Invoke-WebRequest 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile $zip
$tmp = Join-Path $bin '_ff'
Expand-Archive -Path $zip -DestinationPath $tmp -Force
Get-ChildItem -Path $tmp -Recurse -Include ffmpeg.exe | Select-Object -First 1 | ForEach-Object { Copy-Item $_.FullName (Join-Path $bin 'ffmpeg.exe') -Force }
Remove-Item $tmp -Recurse -Force
Remove-Item $zip -Force

Write-Host 'Done. bin/ is ready:' -ForegroundColor Green
Get-ChildItem $bin -Filter *.exe | Select-Object Name, @{N='MB';E={[math]::Round($_.Length/1MB,1)}}
