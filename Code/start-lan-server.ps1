param(
    [int]$Port = 9000
)

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$env:LISTEN_ADDR = "0.0.0.0"
$env:PORT = "$Port"

Write-Host "Starting LAN bootstrap server on 0.0.0.0:$Port" -ForegroundColor Cyan
npm run server
