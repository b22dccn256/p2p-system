param(
    [int]$Port = 9000
)

$env:LISTEN_ADDR = "0.0.0.0"
$env:PORT = "$Port"

Write-Host "Starting LAN bootstrap server on 0.0.0.0:$Port" -ForegroundColor Cyan
npm run server
