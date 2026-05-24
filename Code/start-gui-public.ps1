param(
    [Parameter(Mandatory = $true)]
    [string]$BootstrapHost,

    [int]$BootstrapPort = 9000
)

$env:BOOTSTRAP_IP = $BootstrapHost
$env:BOOTSTRAP_PORT = "$BootstrapPort"

npm run start:gui
