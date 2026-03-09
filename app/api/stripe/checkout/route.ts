/**
 * POST /api/stripe/checkout
 *
 * 為影片報名費創建 Stripe Checkout Session。
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - Token 中的 userId 必須與請求體的 userId 一致，防止越權操作
 *  - filmId 必須屬於該用戶且處於 pending_payment 狀態
 *  - Stripe Secret Key 僅在服務端使用，絕不暴露給前端
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import Stripe from 'stripe';

// ── 服務端客戶端（繞過 RLS） ──────────────────────────────────────────────────
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ── Privy 服務端驗證 ───────────────────────────────────────────────────────────
const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hkaiiff.com';

/** 從任意 thrown 值萃取可讀錯誤訊息 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
    if (typeof e.error === 'string') return e.error;
  }
  return 'Unknown server error';
}

export async function POST(req: Request) {
  // ── Stripe Secret Key 前置檢查 ────────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[stripe/checkout] STRIPE_SECRET_KEY is not set');
    return NextResponse.json(
      { error: 'Payment service is not configured. Please contact support.' },
      { status: 500 }
    );
  }

  // ── Stripe 延遲初始化（避免模組載入時因 Key 缺失而崩潰） ─────────────────
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });

  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(token);
      verifiedUserId = claims.userId;
    } catch (tokenErr) {
      console.error('[stripe/checkout] Token 驗證失敗:', tokenErr);
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // ── Step 2: 驗證請求體，確保 userId 與 Token 一致 ─────────────────────────
    const body = await req.json();
    const { filmId, userId } = body;

    if (!filmId || !userId) {
      return NextResponse.json(
        { error: 'filmId and userId are required' },
        { status: 400 }
      );
    }

    if (userId !== verifiedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: userId mismatch' },
        { status: 403 }
      );
    }

    // ── Step 3: 驗證 filmId 屬於該用戶且尚未支付 ─────────────────────────────
    const { data: film, error: filmError } = await adminSupabase
      .from('films')
      .select('id, title, user_id, payment_status')
      .eq('id', filmId)
      .single();

    if (filmError || !film) {
      console.error('[stripe/checkout] Film 查詢失敗:', filmError);
      return NextResponse.json(
        { error: 'Film not found' },
        { status: 404 }
      );
    }

    if (film.user_id !== verifiedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: film does not belong to this user' },
        { status: 403 }
      );
    }

    if (film.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Film has already been paid' },
        { status: 409 }
      );
    }

    // ── Step 4: 創建 Stripe Checkout Session ─────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'HKAIIFF Entry Fee',
              description: `Entry fee for: ${film.title ?? filmId}`,
            },
            unit_amount: 9900, // $99.00 USD in cents
          },
          quantity: 1,
        },
      ],
      success_url: `${SITE_URL}/me?payment=success`,
      cancel_url: `${SITE_URL}/upload/payment?filmId=${filmId}&payment=cancelled`,
      metadata: {
        userId: verifiedUserId,
        filmId,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });

  } catch (err: unknown) {
    console.error('[stripe/checkout] Stripe API Error:', err);
    const message = extractErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
