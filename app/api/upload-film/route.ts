import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 邮箱格式正则（RFC-compliant 简版）
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      creator_id, title, studio_name, tech_stack, ai_ratio, 
      synopsis, core_cast, region, lbs_royalty,
      poster_url, trailer_url, full_film_url,
      contact_email,
    } = body;

    // 後端二次強制校驗：creator_id 必須是非空字串，防止孤兒影片寫入
    if (!creator_id || typeof creator_id !== 'string' || creator_id.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid creator_id: cannot create orphan film record' }, { status: 400 });
    }
    if (!title || !poster_url || !trailer_url || !full_film_url) {
      return NextResponse.json({ error: 'Missing required media files or fields' }, { status: 400 });
    }
    if (parseInt(ai_ratio) < 51) {
      return NextResponse.json({ error: 'AI ratio must be at least 51%' }, { status: 400 });
    }
    // 🔒 官方联系邮箱：必填且格式合法
    if (!contact_email || typeof contact_email !== 'string' || !EMAIL_REGEX.test(contact_email.trim())) {
      return NextResponse.json({ error: '請填寫合法的官方聯繫郵箱 (contact_email)' }, { status: 400 });
    }

    // 插入影片記錄：user_id 強制綁定 creator_id，初始狀態為待支付
    const { data: film, error: filmError } = await adminSupabase
      .from('films')
      .insert([{
        user_id:        creator_id.trim(),
        title,
        studio:         studio_name,
        tech_stack,
        ai_ratio:       parseInt(ai_ratio),
        description:    synopsis,
        core_cast:      core_cast || null,
        region:         region || null,
        lbs_royalty:    lbs_royalty != null ? parseFloat(lbs_royalty) : null,
        poster_url,
        trailer_url,
        feature_url:    full_film_url,
        copyright_url:  null,
        contact_email:  contact_email.trim().toLowerCase(),
        status:         'pending',
        payment_status: 'unpaid',
      }])
      .select()
      .single();

    if (filmError) {
      console.error('[UPLOAD API] Supabase filmError:', filmError);
      throw new Error(filmError.message ?? JSON.stringify(filmError));
    }

    // 交易流水由對應的支付 API（/api/stripe/checkout 或 /api/pay/aif）在支付確認後記錄
    return NextResponse.json({ success: true, film });
  } catch (error: unknown) {
    console.error('[UPLOAD API CRASH]:', error);
    const message =
      error instanceof Error
        ? error.message
        : typeof (error as { message?: string })?.message === 'string'
          ? (error as { message: string }).message
          : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
