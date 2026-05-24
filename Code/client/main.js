const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Peer = require('../src/core/Peer');
const logger = require('../src/config/logger');

let mainWindow;
let node;
let isShuttingDown = false;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'gui', 'index.html'));
    
    // Mở DevTools để gỡ lỗi giao diện trực quan
    mainWindow.webContents.openDevTools();
    
    // Ngăn UI đóng ngay lập tức nếu chưa Graceful Shutdown
    mainWindow.on('close', (e) => {
        if (!isShuttingDown && node) {
            e.preventDefault();
            isShuttingDown = true;
            logger.warn('Graceful shutdown initiated from UI (BrowserWindow closed)...');
            
            node.isShuttingDown = true;
            const leaveMsg = JSON.stringify({ type: 'LEAVE', from: node.id }) + '\n';
            for (const socket of node.tcpHandler.activeConnections.values()) {
                socket.write(leaveMsg);
                socket.end(); 
            }
            
            // Đóng thực sự sau 300ms
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.destroy();
                }
                app.quit();
            }, 300);
        }
    });
}

app.whenReady().then(async () => {
    createWindow();

    // Khởi tạo Peer
    const myId = 'peer_' + Math.random().toString(36).substring(2, 6);
    node = new Peer(myId);
    
    // Chờ 1 chút để UI load xong preload
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('node-ready', { id: node.id });
        mainWindow.webContents.send('bootstrap-status', node.bootstrapClient.getStatus());
    });

    // Lắng nghe Event từ Node đẩy xuống Renderer
    node.on('peer-discovered', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('peer-discovered', data);
        }
    });

    node.on('peer-disconnected', (peerId) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('peer-disconnected', peerId);
        }
    });

    node.on('message', (msg) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('message', msg);
        }
    });

    node.on('message-ack', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('message-ack', data);
        }
    });

    node.on('bootstrap-status', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bootstrap-status', data);
        }
    });

    // Chuyển tiếp lỗi gửi tin nhắn (khi bootstrap server offline) xuống UI
    node.on('send-error', (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('send-error', data);
        }
    });

    await node.start();
    logger.success(`🚀 Định danh của bạn là: ${myId}`);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Lắng nghe IPC từ UI (invoke)
ipcMain.handle('send-dm', async (event, peerId, text) => {
    if (!node) return false;
    const success = await node.directChat.send(peerId, text);
    return success;
});

ipcMain.handle('join-room', (event, roomId) => {
    if (!node) return;
    node.groupChat.joinRoom(roomId);
});

ipcMain.handle('leave-room', (event, roomId) => {
    if (!node) return;
    node.groupChat.leaveRoom(roomId);
});

ipcMain.handle('create-room', (event, roomName) => {
    if (!node) return null;
    const slug = roomName.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    
    const randomHash = Math.random().toString(36).substring(2, 6);
    const roomKey = `${slug || 'room'}#${randomHash}`;
    node.groupChat.joinRoom(roomKey);
    return roomKey;
});

ipcMain.handle('send-room', (event, roomId, text) => {
    if (!node) return;
    node.groupChat.broadcast(roomId, text);
});

ipcMain.handle('send-global', (event, text) => {
    if (!node) return;
    node.globalChat.broadcast(text);
});

// Fix #8: Trả về thêm thông tin lastSeen cho mỗi peer
ipcMain.handle('get-users', (event) => {
    if (!node) return [];
    return Array.from(node.knownPeers).map(peerId => ({
        id: peerId,
        lastSeen: node.peerTimestamps.get(peerId) || null
    }));
});

ipcMain.handle('get-bootstrap-status', () => {
    if (!node) return null;
    return node.bootstrapClient.getStatus();
});

// Fix #9: Lấy danh sách thành viên thực tế của một room
ipcMain.handle('get-room-members', (event, roomId) => {
    if (!node) return [];
    const room = node.groupChat.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room);
});

// Fix #3: Graceful Shutdown từ nút Disconnect trên UI
ipcMain.handle('disconnect', () => {
    if (!node || isShuttingDown) return;
    isShuttingDown = true;
    logger.warn('Graceful shutdown initiated from Disconnect button...');

    node.isShuttingDown = true;
    const leaveMsg = JSON.stringify({ type: 'LEAVE', from: node.id }) + '\n';
    for (const socket of node.tcpHandler.activeConnections.values()) {
        socket.write(leaveMsg);
        socket.end();
    }

    setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.destroy();
        }
        app.quit();
    }, 300);
});
