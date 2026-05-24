const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('p2pAPI', {
    // Gửi dữ liệu (Promise)
    sendDm: (peerId, msg) => ipcRenderer.invoke('send-dm', peerId, msg),
    joinRoom: (roomId) => ipcRenderer.invoke('join-room', roomId),
    leaveRoom: (roomId) => ipcRenderer.invoke('leave-room', roomId),
    createRoom: (roomName) => ipcRenderer.invoke('create-room', roomName),
    sendRoom: (roomId, msg) => ipcRenderer.invoke('send-room', roomId, msg),
    sendGlobal: (msg) => ipcRenderer.invoke('send-global', msg),
    getUsers: () => ipcRenderer.invoke('get-users'),
    getBootstrapStatus: () => ipcRenderer.invoke('get-bootstrap-status'),
    getRoomMembers: (roomId) => ipcRenderer.invoke('get-room-members', roomId),
    disconnect: () => ipcRenderer.invoke('disconnect'),

    // Nhận dữ liệu từ Main Process
    onPeerDiscovered: (callback) => ipcRenderer.on('peer-discovered', (event, data) => callback(data)),
    onPeerDisconnected: (callback) => ipcRenderer.on('peer-disconnected', (event, peerId) => callback(peerId)),
    onMessage: (callback) => ipcRenderer.on('message', (event, msg) => callback(msg)),
    onMessageAck: (callback) => ipcRenderer.on('message-ack', (event, data) => callback(data)),
    onBootstrapStatus: (callback) => ipcRenderer.on('bootstrap-status', (event, data) => callback(data)),
    
    // Nhận thông tin của chính Node lúc khởi động
    onNodeReady: (callback) => ipcRenderer.on('node-ready', (event, data) => callback(data))
});
