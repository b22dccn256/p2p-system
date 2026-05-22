// src/config/logger.js
const chalk = require('chalk');

module.exports = {
    info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
    success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
    warn: (msg) => console.log(chalk.yellow(`[WARN] ${msg}`)),
    error: (msg) => console.log(chalk.red(`[ERROR] ${msg}`)),
    discover: (peerId, ip, port) => console.log(chalk.cyan(`🔍 Discovered peer: ${peerId} at ${ip}:${port}`)),
    connect: (peerId) => console.log(chalk.magenta(`🔗 Connected to: ${peerId}`))
};