Đã chuẩn bị triển khai LAN cho 3 máy cùng Wi-Fi.

Mình đã thêm:

Code/start-lan-server.ps1: chạy bootstrap server trên máy X.
Code/start-lan-gui.ps1: chạy GUI trỏ tới bootstrap LAN.
Code/DEPLOY_LAN.md: hướng dẫn LAN đầy đủ.
npm run lan:server: script tiện để chạy server LAN.
Đã kiểm tra:

package.json OK
start-lan-server.ps1 OK
start-lan-gui.ps1 OK
Cách chạy bây giờ:

Trên máy X, chạy server:

cd C:\Tuan\WorkSpace\Manh_Tuan\HTPT_Bách\p2p-system\Code
.\start-lan-server.ps1
Trên máy X, mở PowerShell khác chạy GUI:

cd C:\Tuan\WorkSpace\Manh_Tuan\HTPT_Bách\p2p-system\Code
.\start-lan-gui.ps1 -BootstrapIp 127.0.0.1
Trên máy A và máy B, chạy GUI trỏ tới IP LAN của máy X:

cd <thu-muc-project>\Code
.\start-lan-gui.ps1 -BootstrapIp 192.168.1.240
Nếu PowerShell chặn script:

powershell -ExecutionPolicy Bypass -File .\start-lan-gui.ps1 -BootstrapIp 192.168.1.240
Khi đúng, cửa sổ server trên máy X sẽ hiện:

Online peers: 1
Online peers: 2
Online peers: 3
Và GUI của A/B sẽ hiện:

Bootstrap: Connected 192.168.1.240:9000