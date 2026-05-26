const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const profileEnv = process.env.P2P_PROFILE;
if (profileEnv) {
    try {
        const customUserDataPath = path.join(app.getPath('userData'), '..', 'p2p-chat-profiles', profileEnv);
        app.setPath('userData', customUserDataPath);
    } catch (err) {
        // Tránh app crash nếu có lỗi path
    }
}

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
    
    // Mở DevTools để debug (Tạm tắt theo yêu cầu)
    // mainWindow.webContents.openDevTools();
    
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

    // Khởi tạo Peer với ID cố định theo Profile
    let myId = '';
    let e2eePrivateKey = null;
    let peerPublicKeys = null;
    const profile = process.env.P2P_PROFILE;
    
    if (profile) {
        const profileDir = path.join(__dirname, '..', 'profiles', profile);
        const identityFile = path.join(profileDir, 'identity.json');
        
        try {
            if (!fs.existsSync(profileDir)) {
                fs.mkdirSync(profileDir, { recursive: true });
            }
            
            if (fs.existsSync(identityFile)) {
                const data = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
                if (data && data.id) {
                    myId = data.id;
                    e2eePrivateKey = data.privateKey || null;
                    peerPublicKeys = data.peerPublicKeys || null;
                    logger.info(`[Profile] Đã tải Peer ID cố định: ${myId} (Profile: ${profile})`);
                }
            }
        } catch (err) {
            logger.error(`[Profile] Lỗi đọc profile ${profile}: ${err.message}`);
        }
        
        if (!myId) {
            myId = 'peer_' + Math.random().toString(36).substring(2, 6);
        }
    } else {
        myId = 'peer_' + Math.random().toString(36).substring(2, 6);
        logger.info(`[Profile] Chạy chế độ mặc định (không Profile), sinh ngẫu nhiên ID: ${myId}`);
    }

    node = new Peer(myId, { privateKey: e2eePrivateKey, peerPublicKeys: peerPublicKeys });
    
    // Nếu sử dụng profile, hãy lưu lại cấu hình ban đầu
    const saveProfileConfig = () => {
        if (profile) {
            const profileDir = path.join(__dirname, '..', 'profiles', profile);
            const identityFile = path.join(profileDir, 'identity.json');
            try {
                const currentPrivateKey = node.keyExchange.getPrivateKey();
                const currentPeerPublicKeys = Object.fromEntries(node.keyExchange.peerPublicKeys);
                fs.writeFileSync(identityFile, JSON.stringify({ 
                    id: myId, 
                    privateKey: currentPrivateKey,
                    peerPublicKeys: currentPeerPublicKeys
                }, null, 4));
            } catch (err) {
                logger.error(`[Profile] Lỗi cập nhật file cấu hình profile ${profile}: ${err.message}`);
            }
        }
    };

    saveProfileConfig();

    // Lắng nghe sự kiện trao đổi khóa thành công để lưu lại public keys của peer khác nhằm hỗ trợ giải mã Store-and-Forward khi offline
    node.on('e2ee-established', () => {
        saveProfileConfig();
    });
    
    let isUiReady = false;
    let pendingIpcEvents = [];

    const sendIpc = (channel, data) => {
        if (isUiReady && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, data);
        } else {
            pendingIpcEvents.push({ channel, data });
        }
    };

    ipcMain.on('ui-ready', () => {
        isUiReady = true;
        logger.info(`[IPC] UI đã sẵn sàng. Đang giải phóng ${pendingIpcEvents.length} sự kiện xếp hàng.`);
        while (pendingIpcEvents.length > 0) {
            const { channel, data } = pendingIpcEvents.shift();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(channel, data);
            }
        }
    });

    // Chờ 1 chút để UI load xong preload
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('node-ready', { id: node.id });
        mainWindow.webContents.send('bootstrap-status', node.bootstrapClient.getStatus());
    });

    // Lắng nghe Event từ Node đẩy xuống Renderer
    node.on('peer-discovered', (data) => {
        sendIpc('peer-discovered', data);
    });

    node.on('peer-disconnected', (peerId) => {
        sendIpc('peer-disconnected', peerId);
    });

    node.on('message', (msg) => {
        sendIpc('message', msg);
    });

    node.on('message-ack', (data) => {
        sendIpc('message-ack', data);
    });

    node.on('bootstrap-status', (data) => {
        sendIpc('bootstrap-status', data);
    });

    // Chuyển tiếp lỗi gửi tin nhắn (khi bootstrap server offline) xuống UI
    node.on('send-error', (data) => {
        sendIpc('send-error', data);
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
    if (!node) return false;
    return node.groupChat.broadcast(roomId, text);
});

ipcMain.handle('send-global', (event, text) => {
    if (!node) return false;
    return node.globalChat.broadcast(text);
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
