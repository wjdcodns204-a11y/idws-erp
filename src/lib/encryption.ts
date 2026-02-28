// src/lib/encryption.ts
// PII 데이터 AES-256-GCM 암호화/복호화 유틸리티

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * 환경변수에서 암호화 키를 가져옵니다.
 * 32바이트(256비트) hex 문자열이어야 합니다.
 */
function getEncryptionKey(): Buffer {
    const key = process.env.PII_ENCRYPTION_KEY;
    if (!key) {
        throw new Error('[보안 오류] PII_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
    }
    return Buffer.from(key, 'hex');
}

/**
 * 평문을 AES-256-GCM으로 암호화합니다.
 * 반환 형식: iv:authTag:encryptedData (hex)
 */
export function encryptPII(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * AES-256-GCM으로 암호화된 문자열을 복호화합니다.
 * 입력 형식: iv:authTag:encryptedData (hex)
 */
export function decryptPII(ciphertext: string): string {
    const key = getEncryptionKey();
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
        throw new Error('[복호화 오류] 잘못된 암호문 형식입니다.');
    }

    const [ivHex, authTagHex, encryptedData] = parts;
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
