/**
 * initUserAifAta — 為用戶充值地址初始化 AIF Associated Token Account (ATA)
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  絕對禁止：此模塊嚴禁任何 SystemProgram.transfer（SOL 轉帳）  ║
 * ║  只允許：createAssociatedTokenAccountIdempotentInstruction    ║
 * ║  payer = 系統墊付錢包，owner = 用戶充值地址                    ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 作用：
 *   確保用戶的 deposit_address 具備接收 AIF SPL Token 的能力。
 *   未初始化的地址在用戶使用 Phantom 掃碼充值時會報 Error 256 (InvalidAccountData)。
 *
 * 安全設計：
 *   - 服務端專用（import 'server-only'），前端無法 import
 *   - 使用系統墊付錢包 (Gas Funder) 支付 ATA 建立的 SOL 租金
 *   - 採用 createAssociatedTokenAccountIdempotentInstruction（冪等），
 *     ATA 已存在時不報錯，多次調用安全
 *
 * 調用時機：
 *   - 用戶打開充值頁面（Top Up Modal）時，useRef 鎖保護，一次性觸發
 */

import 'server-only';

import { initUserDepositATA, type InitAtaResult } from './hdWallet';

export interface InitAifAtaResult {
  success: boolean;
  status: InitAtaResult['status'] | 'error';
  ataCreated: boolean;
  txSignature: string | null;
  error?: string;
}

/**
 * 為指定的用戶充值地址初始化 AIF ATA。
 *
 * 冪等：ATA 已存在時零消耗直接返回 already_complete。
 *
 * @param depositAddress - 用戶的 Solana 充值地址 (Base58)
 * @param timeoutMs - RPC 超時上限（毫秒），默認 20000ms
 */
export async function initUserAifAta(
  depositAddress: string,
  timeoutMs = 20_000
): Promise<InitAifAtaResult> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`ATA 初始化超時（${timeoutMs / 1000}s），RPC 節點響應過慢`)),
      timeoutMs
    )
  );

  try {
    const result = await Promise.race([
      initUserDepositATA(depositAddress),
      timeoutPromise,
    ]);

    return {
      success: true,
      status: result.status,
      ataCreated: result.ataCreated,
      txSignature: result.txSignature,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[initUserAifAta] 初始化失敗 (${depositAddress}):`, message);
    return {
      success: false,
      status: 'error',
      ataCreated: false,
      txSignature: null,
      error: message,
    };
  }
}
