// src/index.js
const Peer = require('./core/Peer');

// Random ra một ID 6 ký tự cho Peer
const myId = 'peer_' + Math.random().toString(36).substring(2, 8);
const myNode = new Peer(myId);

myNode.start();