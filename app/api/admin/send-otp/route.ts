/**
 * POST /api/admin/send-otp
 * 向管理員郵箱發送 Supabase 郵箱 OTP 驗證碼（Magic Link / OTP 模式）
 * 僅允許 ADMIN_EMAILS 白名單內的郵箱請求
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export async function POST(req: Request) {
  try {
    const authResult = await checkAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { email } = await req.json() as { email: string };

    if (!email) {
      return NextResponse.json({ error: '請提供郵箱地址' }, { status: 400 });
    }

    // ── 白名單校驗：只有管理員郵箱才能請求 OTP ──────────────────────────────
    // 同時讀取服務端與客戶端兩個變量，兼容不同部署環境
    const rawList =
      process.env.ADMIN_EMAILS ||
      process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
      '';

    const allowedEmails = rawList
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (allowedEmails.length === 0 || !allowedEmails.includes(email.toLowerCase())) {
      return NextResponse.json({ error: '該郵箱沒有管理員權限' }, { status: 403 });
    }

    // ── 通過 Supabase Auth 發送 OTP 驗證碼郵件 ───────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // 不允許自動建立新用戶
      },
    });

    if (error) {
      console.error('[send-otp] Supabase OTP 發送失敗:', error.message);
      return NextResponse.json(
        { error: `驗證碼發送失敗：${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('[send-otp] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
