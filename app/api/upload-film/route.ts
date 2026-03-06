import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      creator_id, title, studio_name, tech_stack, ai_ratio, 
      synopsis, poster_url, trailer_url, full_film_url, payment_method 
    } = body;

    // 後端二次強制校驗
    if (!creator_id || !title || !poster_url || !trailer_url || !full_film_url) {
      return NextResponse.json({ error: 'Missing required media files or fields' }, { status: 400 });
    }
    if (parseInt(ai_ratio) < 51) {
      return NextResponse.json({ error: 'AI ratio must be at least 51%' }, { status: 400 });
    }

    // 1. 插入影片（列名以 films 表實際 schema 為準）
    const { data: film, error: filmError } = await supabase
      .from('films')
      .insert([{
        user_id:       creator_id,
        title,
        studio:        studio_name,
        tech_stack,
        ai_ratio:      parseInt(ai_ratio),
        description:   synopsis,
        poster_url,
        trailer_url,
        feature_url:   full_film_url,
        copyright_url: null,
        status:        'pending',
      }])
      .select()
      .single();

    if (filmError) throw filmError;

    // 2. 記錄流水
    const amount = payment_method === 'AIF' ? 2500 : 500;
    const currency = payment_method === 'AIF' ? 'AIF' : 'USD';
    const { error: txError } = await supabase
      .from('transactions')
      .insert([{
        user_id: creator_id, related_film_id: film.id,
        amount, currency, tx_type: 'submission_fee', status: 'success'
      }]);

    if (txError) throw txError;

    return NextResponse.json({ success: true, film });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
