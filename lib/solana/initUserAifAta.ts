/**
 * initUserAifAta — 為用戶充值地址初始化 AIF Associated Token Account (ATA)
 *
 * 作用：
 *   確保用戶的 deposit_address 具備接收 AIF SPL Token 的能力。
 *   未初始化的地址在用戶使用 Phantom 掃碼充值時會報 Error 256 (InvalidAccountData)。
 *
 * 安全設計：
 *   - 服務端專用（import 'server-only'），前端無法 import
 *   - 使用系統墊付錢包 (Gas Funder) 支付 ATA 建立的 SOL 租金
 *   - 採用 createAssociatedTokenAccountIdempotentInstruction（冪等指令），
 *     ATA 已存在時不報錯，多次調用安全
 *
 * 典型調用時機：
 *   - 用戶首次打開充值頁面（Top Up Modal）時，非同步觸發
 *   - 分配充值地址後（wallet/assign API）立即同步觸發
 */

import 'server-only';

import { preActivateUserATA, type PreActivateResult } from './hdWallet';

export interface InitAifAtaResult {
  success: boolean;
  status: PreActivateResult['status'] | 'error';
  ataCreated: boolean;
  solTransferred: boolean;
  txSignature: string | null;
  error?: string;
}

/**
 * 為指定的用戶充值地址初始化 AIF ATA。
 *
 * 內部調用 preActivateUserATA，具備三道防線（冪等鏈上狀態校驗），
 * 只在真正需要時發送交易，已激活的地址零消耗直接返回。
 *
 * @param depositAddress - 用戶的 Solana 充值地址 (Base58)
 * @param timeoutMs - RPC 超時上限（毫秒），默認 15000ms
 * @returns InitAifAtaResult
 */
export async function initUserAifAta(
  depositAddress: string,
  timeoutMs = 15_000
): Promise<InitAifAtaResult> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`ATA 初始化超時（${timeoutMs / 1000}s），RPC 節點響應過慢`)),
      timeoutMs
    )
  );

  try {
    const result = await Promise.race([
      preActivateUserATA(depositAddress),
      timeoutPromise,
    ]);

    return {
      success: true,
      status: result.status,
      ataCreated: result.ataCreated,
      solTransferred: result.solTransferred,
      txSignature: result.txSignature,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[initUserAifAta] 初始化失敗 (${depositAddress}):`, message);
    return {
      success: false,
      status: 'error',
      ataCreated: false,
      solTransferred: false,
      txSignature: null,
      error: message,
    };
  }
}
