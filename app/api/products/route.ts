/**
 * GET /api/products
 *
 * 公開 API：返回所有 is_active = true 的平台產品清單。
 * 前端 useProduct Hook 與 UniversalCheckout 組件依賴此路由。
 * 使用 anon key 讀取（需 Supabase RLS 允許公開讀取 platform_products）。
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('platform_products')
      .select('id, product_code, name_zh, name_en, price_usd, price_aif, metadata, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/products] Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { products: data ?? [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/products] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
