/**
 * /api/admin/products
 *
 * 後台管理 API（需 Service Role Key 繞過 RLS）：
 *  GET  — 返回所有產品（含下架）
 *  POST — 新增產品
 *  PATCH — 更新產品（通過 ?id=xxx）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: Request) {
  try {
    const authResult = await checkAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const adminSupabase = getAdminSupabase();
    const { data, error } = await adminSupabase
      .from('platform_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await checkAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const adminSupabase = getAdminSupabase();
    const body = await req.json();
    const { product_code, name_zh, name_en, price_usd, price_aif, metadata, is_active } = body;

    if (!product_code || !name_zh || !name_en) {
      return NextResponse.json(
        { error: 'product_code, name_zh and name_en are required' },
        { status: 400 }
      );
    }

    if (typeof price_usd !== 'number' || typeof price_aif !== 'number') {
      return NextResponse.json(
        { error: 'price_usd and price_aif must be numbers' },
        { status: 400 }
      );
    }

    const { data, error } = await adminSupabase
      .from('platform_products')
      .insert([{
        product_code,
        name_zh,
        name_en,
        price_usd,
        price_aif,
        metadata: metadata ?? null,
        is_active: is_active ?? true,
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await checkAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const adminSupabase = getAdminSupabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const body = await req.json();
    const { product_code, name_zh, name_en, price_usd, price_aif, metadata, is_active } = body;

    const updates: Record<string, unknown> = {};
    if (product_code !== undefined) updates.product_code = product_code;
    if (name_zh !== undefined) updates.name_zh = name_zh;
    if (name_en !== undefined) updates.name_en = name_en;
    if (price_usd !== undefined) updates.price_usd = price_usd;
    if (price_aif !== undefined) updates.price_aif = price_aif;
    if (metadata !== undefined) updates.metadata = metadata;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await adminSupabase
      .from('platform_products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
