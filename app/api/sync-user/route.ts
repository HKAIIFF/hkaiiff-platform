import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/** PostgreSQL unique_violation error code */
const PG_UNIQUE_VIOLATION = '23505';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user } = body;
    if (!user || !user.id) {
      return NextResponse.json({ error: 'No user data' }, { status: 400 });
    }

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

        if (updateErr) {
          console.error('[sync-user] update existing-email record error:', updateErr.message);
          return NextResponse.json({ error: updateErr.message }, { status: 400 });
        }
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

    if (error) {
      // 競態條件：email unique constraint 被另一個並發請求搶先觸發
      // fallback：改以 email 為條件更新既有記錄，避免 500 崩潰
      if (error.code === PG_UNIQUE_VIOLATION && email) {
        console.warn('[sync-user] email unique violation (race condition), falling back to email update');

        const { data: fallback, error: fallbackErr } = await supabase
          .from('users')
          .update({
            wallet_address: user.wallet?.address || null,
            last_sign_in_at: now,
          })
          .eq('email', email)
          .select()
          .single();

        if (fallbackErr) {
          console.error('[sync-user] fallback update error:', fallbackErr.message);
          return NextResponse.json({ error: fallbackErr.message }, { status: 400 });
        }
        return NextResponse.json(fallback);
      }

      // 其他非唯一性錯誤，記錄後回傳 400（不拋出 500）
      console.error('[sync-user] upsert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[sync-user] unexpected error:', msg);
    // 回傳 400 而非 500，保持 API 穩定性
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
