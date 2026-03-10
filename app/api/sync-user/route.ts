import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user } = body;
    if (!user || !user.id) return NextResponse.json({ error: 'No user data' }, { status: 400 });

    const email: string | null = user.email?.address || null;
    const now = new Date().toISOString();

    // 若有 email，先查是否已有其他記錄持有該 email（跨 Privy session 同信箱場景）
    if (email) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', user.id)
        .maybeSingle();

      if (existing) {
        // 同信箱但不同 Privy ID —— 只更新 session 時間與錢包，不重新插入
        const { data: updated, error: updateErr } = await supabase
          .from('users')
          .update({
            wallet_address: user.wallet?.address || null,
            last_sign_in_at: now,
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        return NextResponse.json(updated);
      }
    }

    // 正常路徑：以主鍵 id 做 upsert（首次登入 insert；再次登入 update session）
    const { data, error } = await supabase
      .from('users')
      .upsert(
        [{
          id: user.id,
          email,
          wallet_address: user.wallet?.address || null,
          name: 'New Agent',
          last_sign_in_at: now,
        }],
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Sync Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
