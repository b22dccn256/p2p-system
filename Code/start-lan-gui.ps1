param(
    [Parameter(Mandatory = $true)]
    [string]$BootstrapIp,

    [int]$Port = 9000
)

$env:BOOTSTRAP_IP = $BootstrapIp
$env:BOOTSTRAP_PORT = "$Port"

Write-Host "Starting GUI with bootstrap $BootstrapIp`:$Port" -ForegroundColor Cyan
npm run start:gui
