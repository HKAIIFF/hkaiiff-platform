import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // 從 films 表中查詢該用戶上傳的所有影片，按時間倒序排列
    const { data: films, error } = await supabase
      .from('films')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ films });
  } catch (error: any) {
    console.error('Fetch Films Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
