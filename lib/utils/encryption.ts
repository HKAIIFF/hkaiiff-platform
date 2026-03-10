/**
 * 數據庫層高級加密工具 — 服務端專用
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  安全規格                                                      ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  算法：AES-256-CBC                                             ║
 * ║  密鑰：32 字節（256 位），來自 DB_ENCRYPTION_KEY 環境變量      ║
 * ║  IV：每次加密隨機生成 16 字節，與密文一同存儲                   ║
 * ║  格式：iv_hex:ciphertext_hex（冒號分隔）                        ║
 * ║  物理隔離：import 'server-only' 阻止前端 bundle 引入            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * 從環境變量獲取並標準化加密密鑰（強制 32 字節）。
 * 使用 SHA-256 對原始值做哈希，無論輸入長度如何均輸出固定 32 字節。
 */
function getDerivedKey(): Buffer {
  const raw = process.env.DB_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      '[Encryption] DB_ENCRYPTION_KEY 環境變量未配置。' +
      '請在 .env.local 中添加一個至少 32 字符的隨機字符串。'
    );
  }
  // SHA-256 派生，確保精確 32 字節，與原始密鑰長度無關
  return createHash('sha256').update(raw).digest();
}

/**
 * 使用 AES-256-CBC 加密敏感文本（如助記詞）。
 *
 * @param plaintext - 要加密的明文字符串
 * @returns 格式為 `iv_hex:ciphertext_hex` 的加密字符串，可安全存入數據庫
 * @throws DB_ENCRYPTION_KEY 未配置時拋出
 */
export function encryptSeed(plaintext: string): string {
  const key = getDerivedKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * 解密由 encryptSeed 生成的加密字符串，還原原始明文。
 *
 * @param encryptedText - 格式為 `iv_hex:ciphertext_hex` 的加密字符串
 * @returns 解密後的明文字符串
 * @throws 格式錯誤、密鑰不匹配或 DB_ENCRYPTION_KEY 未配置時拋出
 */
export function decryptSeed(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error(
      '[Encryption] 密文格式不合法。期望格式：iv_hex:ciphertext_hex'
    );
  }
  const [ivHex, ciphertextHex] = parts;
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedBuffer = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error('[Encryption] IV 長度不合法，數據可能已損壞');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted.toString('utf8');
}
