/**
 * GET  /api/admin/treasury/config  — 讀取金庫配置（助記詞以掩碼形式返回）
 * POST /api/admin/treasury/config  — 更新金庫地址或助記詞（需雙重密碼校驗）
 *
 * 安全要點：
 *  - GET 請求：助記詞不返回明文，僅返回「已設置」狀態與掩碼前綴
 *  - POST 請求：客戶端傳入管理員密碼，服務端向 Supabase Auth 驗證後方可更新
 *  - 助記詞必須通過 BIP39 校驗，確保合法性後加密存儲
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as bip39 from 'bip39';
import { encryptSeed, decryptSeed } from '@/lib/utils/encryption';

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** 將助記詞掩碼處理，僅顯示前3個詞 */
function maskSeedPhrase(seed: string): string {
  const words = seed.trim().split(/\s+/);
  const visibleCount = Math.min(3, words.length);
  return `${words.slice(0, visibleCount).join(' ')} ${'**** '.repeat(words.length - visibleCount).trim()} (${words.length} words)`;
}

export async function GET() {
  try {
    const adminSupabase = createAdminSupabase();
    const { data: config } = await adminSupabase
      .from('system_configs')
      .select('treasury_wallet_address, funding_wallet_seed_encrypted')
      .eq('id', 1)
      .maybeSingle();

    const hasSeed = !!(config?.funding_wallet_seed_encrypted);
    let seedMask = '未設置（使用環境變量 MASTER_SEED_PHRASE）';

    if (hasSeed && config?.funding_wallet_seed_encrypted) {
      try {
        const plainSeed = decryptSeed(config.funding_wallet_seed_encrypted);
        seedMask = maskSeedPhrase(plainSeed);
      } catch {
        seedMask = '已加密存儲（解密失敗，請聯繫管理員）';
      }
    } else if (process.env.MASTER_SEED_PHRASE) {
      seedMask = maskSeedPhrase(process.env.MASTER_SEED_PHRASE) + ' [來自環境變量]';
    }

    return NextResponse.json({
      treasuryWalletAddress:
        config?.treasury_wallet_address ??
        process.env.NEXT_PUBLIC_TREASURY_WALLET ??
        '',
      seedMask,
      hasSeedInDb: hasSeed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      otp: string;
      adminEmail: string;
      newTreasuryAddress?: string;
      newSeedPhrase?: string;
    };

    const { otp, adminEmail, newTreasuryAddress, newSeedPhrase } = body;

    if (!otp || !adminEmail) {
      return NextResponse.json(
        { error: '需要提供管理員郵箱與郵箱驗證碼進行二次驗證' },
        { status: 400 }
      );
    }

    if (!newTreasuryAddress && !newSeedPhrase) {
      return NextResponse.json(
        { error: '請提供要更新的金庫地址或助記詞' },
        { status: 400 }
      );
    }

    // ── 雙重安全校驗：通過 Supabase Auth 驗證郵箱 OTP ────────────────────────
    const supabaseUserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: authData, error: authError } = await supabaseUserClient.auth.verifyOtp({
      email: adminEmail,
      token: otp,
      type: 'email',
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: '驗證碼錯誤或已過期，請重新獲取驗證碼' },
        { status: 401 }
      );
    }

    // ── 校驗新助記詞（如提供）────────────────────────────────────────────────
    if (newSeedPhrase) {
      if (!bip39.validateMnemonic(newSeedPhrase.trim())) {
        return NextResponse.json(
          { error: '助記詞格式不合法，請輸入標準的 BIP39 助記詞（12 或 24 個英文單詞）' },
          { status: 400 }
        );
      }
    }

    // ── 準備更新數據 ──────────────────────────────────────────────────────────
    const adminSupabase = createAdminSupabase();
    const updatePayload: Record<string, string> = {};

    if (newTreasuryAddress) {
      updatePayload.treasury_wallet_address = newTreasuryAddress.trim();
    }

    if (newSeedPhrase) {
      // 加密後存儲，絕不明文落庫
      updatePayload.funding_wallet_seed_encrypted = encryptSeed(newSeedPhrase.trim());
    }

    // ── Upsert：若記錄不存在則插入，存在則更新 ───────────────────────────────
    const { error: upsertError } = await adminSupabase
      .from('system_configs')
      .upsert({ id: 1, ...updatePayload }, { onConflict: 'id' });

    if (upsertError) {
      console.error('[treasury/config] Upsert 失敗:', upsertError);
      return NextResponse.json(
        { error: `數據庫更新失敗：${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated: {
        treasuryAddress: !!newTreasuryAddress,
        seedPhrase: !!newSeedPhrase,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[treasury/config] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
