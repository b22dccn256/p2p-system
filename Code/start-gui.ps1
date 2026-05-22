Write-Host "Dang khoi dong Bootstrap Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "title 'Bootstrap Server'; node bootstrap-server/server.js"

Start-Sleep -Seconds 2

Write-Host "Dang khoi dong Peer 1..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "title 'Peer A'; npm run start:gui"

Start-Sleep -Seconds 1

Write-Host "Dang khoi dong Peer 2..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "title 'Peer B'; npm run start:gui"

Start-Sleep -Seconds 1

Write-Host "Dang khoi dong Peer 3..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "title 'Peer C'; npm run start:gui"

Write-Host "Hoan tat! Hay kiem tra 4 cua so vua hien ra." -ForegroundColor Yellow
