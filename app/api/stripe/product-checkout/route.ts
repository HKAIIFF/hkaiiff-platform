/**
 * POST /api/stripe/product-checkout
 *
 * 通用 Stripe 結帳 — 根據 productCode 動態查詢 platform_products 表獲取價格。
 * 供 UniversalCheckout 組件調用，支援任意產品類型。
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - userId 必須與 Token 一致，防止越權
 *  - 僅允許 is_active = true 的產品下單
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import Stripe from 'stripe';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment service is not configured' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    // ── Validate body ────────────────────────────────────────────────────────
    const body = await req.json();
    const { productCode, userId, successUrl, cancelUrl, extraMetadata } = body as {
      productCode: string;
      userId: string;
      successUrl?: string;
      cancelUrl?: string;
      extraMetadata?: Record<string, string>;
    };

    if (!productCode || !userId) {
      return NextResponse.json({ error: 'productCode and userId are required' }, { status: 400 });
    }

    if (userId !== verifiedUserId) {
      return NextResponse.json({ error: 'Unauthorized: userId mismatch' }, { status: 403 });
    }

    // ── Fetch product ────────────────────────────────────────────────────────
    const { data: product, error: productError } = await adminSupabase
      .from('platform_products')
      .select('*')
      .eq('product_code', productCode)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found or inactive' }, { status: 404 });
    }

    // ── Create Stripe Checkout Session ───────────────────────────────────────
    const reqOrigin = req.headers.get('origin');
    const siteUrl = reqOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'https://hkaiiff.com';

    const priceInCents = Math.round(Number(product.price_usd) * 100);
    if (priceInCents <= 0) {
      return NextResponse.json({ error: 'Invalid product price' }, { status: 400 });
    }

    const productName = product.name_en || product.name_zh || productCode;
    const description = (product.metadata as Record<string, string> | null)?.description_en
      || (product.metadata as Record<string, string> | null)?.description_zh
      || undefined;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              ...(description ? { description } : {}),
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl || `${siteUrl}/me?payment=success&product=${productCode}`,
      cancel_url: cancelUrl || `${siteUrl}/me?payment=cancelled`,
      metadata: {
        userId: verifiedUserId,
        productCode,
        type: 'product_purchase',
        // 攤開 extraMetadata（例如 filmId），Stripe metadata 僅支持字符串值
        ...(extraMetadata ?? {}),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe/product-checkout] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
