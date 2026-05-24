// src/security/Crypto.js
const crypto = require('crypto');

class Crypto {
    static deriveKey(sharedSecret) {
        // Hash shared secret bằng SHA-256 để luôn tạo ra khoá 32-byte (256-bit)
        return crypto.createHash('sha256').update(sharedSecret).digest();
    }

    static encrypt(plainText, sharedSecret) {
        const key = this.deriveKey(sharedSecret);
        const iv = crypto.randomBytes(12); // IV chuẩn cho GCM là 12 bytes
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        let encrypted = cipher.update(plainText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const tag = cipher.getAuthTag().toString('hex');
        
        return {
            iv: iv.toString('hex'),
            content: encrypted,
            tag: tag
        };
    }

    static decrypt(encryptedObj, sharedSecret) {
        try {
            const key = this.deriveKey(sharedSecret);
            const iv = Buffer.from(encryptedObj.iv, 'hex');
            const tag = Buffer.from(encryptedObj.tag, 'hex');
            
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            
            let decrypted = decipher.update(encryptedObj.content, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (err) {
            throw new Error('Giải mã thất bại! Dữ liệu có thể đã bị sửa đổi hoặc khoá không khớp.');
        }
    }
}

module.exports = Crypto;
