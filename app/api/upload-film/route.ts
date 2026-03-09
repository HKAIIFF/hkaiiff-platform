import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      creator_id, title, studio_name, tech_stack, ai_ratio, 
      synopsis, core_cast, region, lbs_royalty,
      poster_url, trailer_url, full_film_url,
    } = body;

    // 後端二次強制校驗
    if (!creator_id || !title || !poster_url || !trailer_url || !full_film_url) {
      return NextResponse.json({ error: 'Missing required media files or fields' }, { status: 400 });
    }
    if (parseInt(ai_ratio) < 51) {
      return NextResponse.json({ error: 'AI ratio must be at least 51%' }, { status: 400 });
    }

    // 插入影片記錄，初始狀態為待支付
    const { data: film, error: filmError } = await supabase
      .from('films')
      .insert([{
        user_id:        creator_id,
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
