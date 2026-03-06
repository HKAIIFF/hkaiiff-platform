/**
 * HD Wallet 工具 — 服務端專用，絕對不可在前端 import 此文件
 *
 * 安全架構：
 *  - 主助記詞 (MASTER_SEED_PHRASE) 僅存於服務端環境變數，永不落地
 *  - 每個用戶對應唯一 wallet_index，派生路徑 m/44'/501'/{index}'/0'
 *  - 函數只返回公鑰 (Base58 字串)，私鑰在函數退出後即被 GC 回收
 *  - 歸集時按需動態推導私鑰，不保存任何私鑰到數據庫或日誌
 */

import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';

/**
 * 根據 walletIndex 派生該用戶的 Solana 充值公鑰地址。
 *
 * @param walletIndex - 全局唯一整數索引，由 Postgres sequence 保證無碰撞
 * @returns Solana 公鑰的 Base58 字串（即充值地址）
 * @throws 若 MASTER_SEED_PHRASE 未配置或助記詞無效時拋出錯誤
 */
export function generateUserWallet(walletIndex: number): string {
  const seedPhrase = process.env.MASTER_SEED_PHRASE;

  if (!seedPhrase) {
    throw new Error(
      '[HD Wallet] MASTER_SEED_PHRASE 環境變數未配置，請在服務端 .env.local 中設置。'
    );
  }

  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error(
      '[HD Wallet] MASTER_SEED_PHRASE 不是合法的 BIP39 助記詞，請重新生成。'
    );
  }

  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const derivationPath = `m/44'/501'/${walletIndex}'/0'`;
  const { key } = derivePath(derivationPath, seed.toString('hex'));

  // Keypair 在此作用域內使用後即被釋放，私鑰絕不外傳
  const keypair = Keypair.fromSeed(key);
  return keypair.publicKey.toBase58();
}
