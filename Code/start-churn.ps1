# start-churn.ps1
# Khởi động mô phỏng Churn: Bootstrap Server + Churn Controller
#
# Cách dùng:
#   .\start-churn.ps1                          # Chạy với thông số mặc định
#   .\start-churn.ps1 -Peers 8 -Duration 180   # 8 peer đồng thời, chạy 3 phút
#
# Parameters:
#   -Peers      Số peer chạy đồng thời          (mặc định: 5)
#   -Duration   Tổng thời gian simulation (giây) (mặc định: 120)
#   -Min        Thời gian sống tối thiểu (giây)  (mặc định: 15)
#   -Max        Thời gian sống tối đa (giây)     (mặc định: 40)
#   -Chat       Khoảng cách gửi tin (giây)       (mặc định: 6)
#   -SkipServer Bỏ qua bước khởi động server (nếu server đã chạy sẵn)

param(
    [int]$Peers      = 5,
    [int]$Duration   = 120,
    [int]$Min        = 15,
    [int]$Max        = 40,
    [int]$Chat       = 6,
    [switch]$SkipServer
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         🌀 CHURN SIMULATION LAUNCHER                 ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  Peers đồng thời : $Peers".PadRight(55) + "║" -ForegroundColor Cyan
Write-Host "║  Tổng thời gian  : ${Duration}s".PadRight(55) + "║" -ForegroundColor Cyan
Write-Host "║  Lifetime        : ${Min}s – ${Max}s / peer".PadRight(55) + "║" -ForegroundColor Cyan
Write-Host "║  Chat interval   : mỗi ${Chat}s / peer".PadRight(55) + "║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Bước 1: Khởi động Bootstrap Server (cửa sổ riêng) ──────────────────────
if (-not $SkipServer) {
    Write-Host "[1/2] Khởi động Bootstrap Server..." -ForegroundColor Green
    Start-Process powershell -ArgumentList `
        "-NoExit", `
        "-Command", `
        "title 'Bootstrap Server [Churn Test]'; cd '$ScriptDir'; node bootstrap-server/server.js"

    Write-Host "      Chờ 3 giây cho server khởi động..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/2] Bỏ qua khởi động server (--SkipServer)" -ForegroundColor Yellow
}

# ── Bước 2: Chạy Churn Controller trong cửa sổ hiện tại ────────────────────
Write-Host "[2/2] Khởi động Churn Controller..." -ForegroundColor Green
Write-Host "      Nhấn Ctrl+C để dừng sớm và xem báo cáo." -ForegroundColor Gray
Write-Host ""

Set-Location $ScriptDir

node src/churn-controller.js `
    --peers    $Peers `
    --duration $Duration `
    --min      $Min `
    --max      $Max `
    --chat     $Chat
