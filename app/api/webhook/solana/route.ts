import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// AIF 代幣合約地址（從環境變量讀取，fallback 到 mock 值）
const AIF_MINT_ADDRESS =
  process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS || 'AIF_MOCK_CONTRACT_ADDRESS';

// 金庫錢包地址，用於驗證收款方
const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET || '';

// Helius Webhook 推送的單筆交易結構
interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  mint: string;
  tokenAmount: number;
  fromTokenAccount?: string;
  toTokenAccount?: string;
  tokenStandard?: string;
}

interface HeliusTransaction {
  signature: string;
  type: string;
  transactionError: null | object;
  tokenTransfers: HeliusTokenTransfer[];
  timestamp?: number;
  feePayer?: string;
  source?: string;
}

// 使用 Service Role Key 初始化 Supabase 管理員客戶端，繞過 RLS
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('缺少 Supabase 環境變量：NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(req: Request) {
  // ── Auth Guard：嚴格校驗 Helius Authorization Header ─────────────────────
  const authHeader = req.headers.get('authorization');
  if (!process.env.HELIUS_WEBHOOK_SECRET || authHeader !== process.env.HELIUS_WEBHOOK_SECRET) {
    console.error('[Solana Webhook] Unauthorized webhook attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Helius 推送的是一個交易數組
    const transactions: HeliusTransaction[] = Array.isArray(body) ? body : [body];

    if (transactions.length === 0) {
      return NextResponse.json({ message: 'No transactions to process' }, { status: 200 });
    }

    const supabase = createAdminClient();
    const results: Array<{ signature: string; status: string; wallet?: string }> = [];

    for (const tx of transactions) {
      const { signature, type, transactionError, tokenTransfers } = tx;

      // 只處理成功的 TRANSFER 類型交易
      if (type !== 'TRANSFER' || transactionError !== null) {
        results.push({ signature, status: 'skipped_not_valid_transfer' });
        continue;
      }

      if (!tokenTransfers || tokenTransfers.length === 0) {
        results.push({ signature, status: 'skipped_no_token_transfers' });
        continue;
      }

      for (const transfer of tokenTransfers) {
        const { mint, toUserAccount, fromUserAccount, tokenAmount } = transfer;

        // 校驗：必須是 AIF 代幣
        if (mint !== AIF_MINT_ADDRESS) {
          continue;
        }

        // 校驗：必須轉入金庫錢包（充值方向驗證）
        if (TREASURY_WALLET && toUserAccount !== TREASURY_WALLET) {
          continue;
        }

        // 校驗：金額必須為正數
        const amount = Number(tokenAmount);
        if (!amount || amount <= 0) {
          continue;
        }

        // 充值方的錢包地址（發送方）即為需要入賬的用戶
        const targetAddress = fromUserAccount;

        console.log(
          `[Solana Webhook] 處理充值 | 用戶: ${targetAddress} | 金額: ${amount} AIF | 交易: ${signature}`
        );

        // 調用 Supabase RPC 安全增加餘額
        const { error: rpcError } = await supabase.rpc('increment_aif_balance', {
          wallet_addr: targetAddress,
          amount_to_add: amount,
        });

        if (rpcError) {
          console.error(
            `[Solana Webhook] DB 更新失敗 | 用戶: ${targetAddress} | 交易: ${signature}`,
            rpcError
          );
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
        }

        console.log(
          `[Solana Webhook] 充值成功 ✓ | 用戶: ${targetAddress} | 金額: ${amount} AIF`
        );
        results.push({ signature, status: 'credited', wallet: targetAddress });
      }
    }

    return NextResponse.json(
      { message: 'Top-up successful', results },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Solana Webhook] 處理異常:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
