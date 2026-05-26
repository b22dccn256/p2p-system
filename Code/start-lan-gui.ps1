param(
    [Parameter(Mandatory = $true)]
    [string]$BootstrapIp,

    [int]$Port = 9000,

    [string]$Profile = $null
)

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$env:BOOTSTRAP_IP = $BootstrapIp
$env:BOOTSTRAP_PORT = "$Port"

if ($Profile) {
    $env:P2P_PROFILE = $Profile
    Write-Host "Starting GUI with bootstrap $BootstrapIp`:$Port [Profile: $Profile]" -ForegroundColor Cyan
} else {
    $env:P2P_PROFILE = ""
    Write-Host "Starting GUI with bootstrap $BootstrapIp`:$Port [Profile: Default]" -ForegroundColor Cyan
}

npm run start:gui
