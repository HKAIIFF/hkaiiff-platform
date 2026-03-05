import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user } = body;
    if (!user || !user.id) return NextResponse.json({ error: 'No user data' }, { status: 400 });

    // 查詢用戶是否存在
    const { data: existingUser } = await supabase
      .from('users').select('*').eq('id', user.id).single();

    if (existingUser) {
      // 老用戶，更新登錄時間並返回
      await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
      return NextResponse.json(existingUser);
    }

    // 新用戶，執行插入（必須傳入 name 以防 NOT NULL 報錯）
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        id: user.id,
        email: user.email?.address || null,
        wallet_address: user.wallet?.address || null,
        name: 'New Agent',
      }])
      .select()
      .single();

    if (insertError) throw insertError;
    return NextResponse.json(newUser);

  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
