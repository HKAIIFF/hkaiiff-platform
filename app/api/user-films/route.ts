import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId || userId.trim() === '') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 使用 user_id 欄位查詢（與 upload-film 寫入時的欄位名一致）
    const { data: films, error } = await supabase
      .from('films')
      .select('*')
      .eq('user_id', userId.trim())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ films: films ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API/user-films] Fetch Films Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
