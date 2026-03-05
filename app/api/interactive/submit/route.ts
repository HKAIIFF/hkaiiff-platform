import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export interface SubmitInteractivePayload {
  film_id: string;       // interactive_films.id（前端從當前影片 ID 推斷或傳入）
  user_id: string;       // Privy DID
  prompt_text?: string;  // Text Tab 文字內容
  media_url?: string;    // OSS 上傳後的 audio / vision URL
  bio_seed?: string;     // Bio Tab 設備熵值哈希
}

export async function POST(req: Request) {
  try {
    const body: SubmitInteractivePayload = await req.json();
    const { film_id, user_id, prompt_text, media_url, bio_seed } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    if (!film_id) {
      return NextResponse.json({ error: 'film_id is required' }, { status: 400 });
    }

    if (!prompt_text && !media_url && !bio_seed) {
      return NextResponse.json(
        { error: 'At least one of prompt_text, media_url or bio_seed is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('interactive_submissions')
      .insert([{ film_id, user_id, prompt_text, media_url, bio_seed }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, submission: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[interactive/submit] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
