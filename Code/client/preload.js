const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('p2pAPI', {
    // Gửi dữ liệu (Promise)
    sendDm: (peerId, msg) => ipcRenderer.invoke('send-dm', peerId, msg),
    joinRoom: (roomId) => ipcRenderer.invoke('join-room', roomId),
    sendRoom: (roomId, msg) => ipcRenderer.invoke('send-room', roomId, msg),
    getUsers: () => ipcRenderer.invoke('get-users'),
    getRoomMembers: (roomId) => ipcRenderer.invoke('get-room-members', roomId),
    disconnect: () => ipcRenderer.invoke('disconnect'),

    // Nhận dữ liệu từ Main Process
    onPeerDiscovered: (callback) => ipcRenderer.on('peer-discovered', (event, data) => callback(data)),
    onPeerDisconnected: (callback) => ipcRenderer.on('peer-disconnected', (event, peerId) => callback(peerId)),
    onMessage: (callback) => ipcRenderer.on('message', (event, msg) => callback(msg)),
    onMessageAck: (callback) => ipcRenderer.on('message-ack', (event, data) => callback(data)),
    
    // Nhận thông tin của chính Node lúc khởi động
    onNodeReady: (callback) => ipcRenderer.on('node-ready', (event, data) => callback(data))
});
