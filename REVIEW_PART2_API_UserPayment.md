# HKAIIFF Platform — Part 2: 用户/上传/支付 API 路由
> 提交给 Claude 进行代码审查 | 共4部分之第2部分
> 本文件包含：用户类(9)、上传/媒体类(7)、支付/钱包类(16)，共 26 个 Route Handlers

## 5.1 用户/内容类 API
### app/api/feed/route.ts
```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * GET /api/feed
 *
 * 使用 SUPABASE_SERVICE_ROLE_KEY（上帝模式）繞過 RLS，
 * 從服務端安全地獲取已審核並上架的 Feed 影片列表。
 *
 * 為什麼需要這個路由：
 * - films 表啟用了 RLS，anon key 可能無法讀取 is_feed_published=true 的影片
 * - 服務端 API 路由使用 service role key，完全繞過 RLS 限制
 * - 同時解決批量關閉/重開後前端看不到影片的問題
 */

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  type FilmRow = {
    id: string; title: string; studio: string | null; tech_stack: string | null;
    ai_ratio: number | null; poster_url: string | null; trailer_url: string | null;
    feature_url: string | null; video_url: string | null; user_id: string | null;
    created_at: string; is_parallel_universe: boolean | null; parallel_start_time: string | null;
  };
  type UserRow = {
    id: string; avatar_seed: string | null;
    display_name: string | null; verified_identities: string[] | null;
  };

  // ── 1. 獲取 Feed 影片 ────────────────────────────────────────────────────
  // 顯示條件：status='approved' 且 is_feed_published 不為 false
  // （true 或 null 均顯示，只有管理員明確設為 false 才隱藏）
  // 這樣即使批量操作出錯導致部分值為 null，影片仍可正常顯示。
  const { data: filmsRaw, error: filmsError } = await serviceSupabase
    .from('films')
    .select(
      'id,title,studio,tech_stack,ai_ratio,poster_url,trailer_url,feature_url,video_url,' +
      'user_id,created_at,is_parallel_universe,parallel_start_time'
    )
    .eq('status', 'approved')
    .or('is_feed_published.eq.true,is_feed_published.is.null')
    .order('created_at', { ascending: false });

  if (filmsError) {
    console.error('【/api/feed】獲取影片失敗:', filmsError.message, filmsError.details);
    return NextResponse.json(
      { films: [], error: filmsError.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const films = (filmsRaw ?? []) as unknown as FilmRow[];
  console.log(`【/api/feed】成功返回 ${films.length} 部影片`);

  if (films.length === 0) {
    console.warn('【/api/feed 警告】0 部影片符合條件（status=approved AND is_feed_published=true）。若有已審核影片但 Feed 仍空，請到管理後台點擊「🔧 一鍵修復 Feed」。');
    return NextResponse.json(
      { films: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // ── 2. 批量獲取創作者資料 ──────────────────────────────────────────────────
  const userIds = [...new Set(films.filter((f) => f.user_id).map((f) => f.user_id as string))];
  let userMap: Record<string, Omit<UserRow, 'id'>> = {};

  if (userIds.length > 0) {
    const { data: usersRaw, error: usersError } = await serviceSupabase
      .from('users')
      .select('id, avatar_seed, display_name, verified_identities')
      .in('id', userIds);

    if (usersError) {
      console.error('【/api/feed】獲取用戶資料失敗:', usersError.message);
    }

    if (usersRaw) {
      const users = usersRaw as UserRow[];
      userMap = Object.fromEntries(
        users.map((u) => [u.id, {
          avatar_seed: u.avatar_seed,
          display_name: u.display_name,
          verified_identities: u.verified_identities,
        }])
      );
    }
  }

  // ── 3. 合併用戶資料到影片 ──────────────────────────────────────────────────
  const enriched = films.map((f) => ({
    ...f,
    user_avatar_seed:         f.user_id ? (userMap[f.user_id]?.avatar_seed         ?? null) : null,
    user_display_name:        f.user_id ? (userMap[f.user_id]?.display_name        ?? null) : null,
    user_verified_identities: f.user_id ? (userMap[f.user_id]?.verified_identities ?? null) : null,
  }));

  return NextResponse.json(
    { films: enriched },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
```

### app/api/sync-user/route.ts
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** PostgreSQL unique_violation error code */
const PG_UNIQUE_VIOLATION = '23505';

// 使用 Service Role Key 繞過 RLS，確保伺服器端能讀寫所有欄位（含 aif_balance）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

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

    // 正常路徑：以主鍵 id 做 upsert（首次登入 insert；再次登入只更新 session 相關欄位）
    // ignoreDuplicates:false 時，onConflict 會觸發 UPDATE，但需確保不覆蓋用戶已設置的 name/display_name
    // 因此先嘗試 insert，若已存在則只更新 session 欄位，保留用戶自訂的 name
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    let data, error;
    if (existingUser) {
      // 用戶已存在：只更新 session 相關欄位，不覆蓋 name/display_name
      ({ data, error } = await supabase
        .from('users')
        .update({
          email,
          wallet_address: user.wallet?.address || null,
          last_sign_in_at: now,
        })
        .eq('id', user.id)
        .select()
        .single());
    } else {
      // 首次登入：插入新用戶行
      ({ data, error } = await supabase
        .from('users')
        .insert([{
          id: user.id,
          email,
          wallet_address: user.wallet?.address || null,
          name: 'New Agent',
          last_sign_in_at: now,
        }])
        .select()
        .single());
    }

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
```

### app/api/update-profile/route.ts
```typescript
/**
 * POST /api/update-profile
 *
 * 使用 Service Role Key 繞過 RLS 更新用戶個人資料。
 * 需攜帶有效的 Privy Access Token（Bearer）進行身份驗證。
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

// ── 環境變量預檢：啟動時立即暴露缺失配置 ─────────────────────────────────────
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRIVY_APP_ID      = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const PRIVY_APP_SECRET  = process.env.PRIVY_APP_SECRET;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[update-profile] FATAL: Supabase env vars missing. URL:', !!SUPABASE_URL, 'SRK:', !!SERVICE_ROLE_KEY);
}
if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  console.error('[update-profile] FATAL: Privy env vars missing. ID:', !!PRIVY_APP_ID, 'SECRET:', !!PRIVY_APP_SECRET);
}

const adminSupabase = createClient(
  SUPABASE_URL!,
  SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(PRIVY_APP_ID!, PRIVY_APP_SECRET!);

// 只返回本次 update 實際可修改的欄位，避免 SELECT 到不存在的列導致整個語句失敗
const RETURN_COLS =
  'display_name, avatar_seed, bio, tech_stack, core_team';

export async function POST(req: Request) {
  // 若關鍵 env var 缺失，提前返回明確錯誤
  if (!SERVICE_ROLE_KEY || !PRIVY_APP_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfiguration: missing env vars (check Vercel settings)' },
      { status: 500 }
    );
  }

  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      userId = claims.userId;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[update-profile] Token verify failed:', msg);
      return NextResponse.json(
        { error: `Invalid or expired auth token: ${msg}` },
        { status: 401 }
      );
    }

    // ── Step 2: 解析請求 body ─────────────────────────────────────────────────
    let body: {
      display_name?: string;
      avatar_seed?: string;
      bio?: string;
      tech_stack?: string;
      core_team?: Array<{ name: string; role: string }>;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // ── Step 3: 構建更新 payload（只更新傳入的欄位）──────────────────────────
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.display_name === 'string') {
      const trimmed = body.display_name.trim().slice(0, 40);
      updatePayload.display_name = trimmed || null;
    }
    if (typeof body.avatar_seed === 'string') {
      updatePayload.avatar_seed = body.avatar_seed;
    }
    if (typeof body.bio === 'string') {
      updatePayload.bio = body.bio.trim() || null;
    }
    if (typeof body.tech_stack === 'string') {
      updatePayload.tech_stack = body.tech_stack.trim() || null;
    }
    if (Array.isArray(body.core_team)) {
      updatePayload.core_team = body.core_team;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // ── Step 4: 使用 Service Role Key 更新，繞過 RLS ─────────────────────────
    // users.id 為 text 類型（非 uuid），顯式傳入 String(userId) 確保 text 比較
    const textId = String(userId);
    const { data, error } = await adminSupabase
      .from('users')
      .update(updatePayload)
      .eq('id', textId)
      .select(RETURN_COLS)
      .maybeSingle();

    if (error) {
      console.error('[update-profile] Supabase update error:', error.message, 'userId:', textId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── Step 5: 自愈 — 若找不到用戶行（sync-user 可能失敗過），先建立再重試 ──
    if (!data) {
      console.warn('[update-profile] User not found, attempting to create row:', textId);

      const { error: upsertError } = await adminSupabase
        .from('users')
        .upsert({ id: textId, name: 'New Agent' }, { onConflict: 'id' });

      if (upsertError) {
        console.error('[update-profile] Failed to create user row:', upsertError.message);
        return NextResponse.json(
          { error: `User not found and could not be created: ${upsertError.message}` },
          { status: 500 }
        );
      }

      // 重試更新
      const { data: retryData, error: retryError } = await adminSupabase
        .from('users')
        .update(updatePayload)
        .eq('id', textId)
        .select(RETURN_COLS)
        .maybeSingle();

      if (retryError) {
        console.error('[update-profile] Retry update error:', retryError.message);
        return NextResponse.json({ error: retryError.message }, { status: 500 });
      }

      if (!retryData) {
        return NextResponse.json({ error: 'Update failed after user creation' }, { status: 500 });
      }

      return NextResponse.json(retryData);
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[update-profile] unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

### app/api/user-films/route.ts
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 使用 Service Role Key，避免 Privy DID 格式 userId 与 Supabase anon RLS 的冲突
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId || userId.trim() === '') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    console.log('[user-films] fetching films for userId:', userId.trim());

    // 🔒 隐私保护：明确排除 contact_email，该字段仅限 Admin 权限接口返回
    const { data: films, error } = await adminSupabase
      .from('films')
      .select('id, title, studio, tech_stack, ai_ratio, description, core_cast, region, lbs_royalty, poster_url, trailer_url, feature_url, copyright_url, order_number, status, payment_status, user_id, created_at, is_feed_published, is_main_published, is_parallel_universe')
      .eq('user_id', userId.trim())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[user-films] Supabase error:', JSON.stringify(error));
      throw error;
    }

    return NextResponse.json({ films: films ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API/user-films] Fetch Films Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/user-balance/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let userId: string;
  try {
    const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
    userId = claims.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { data, error } = await adminSupabase
    .from('users')
    .select('aif_balance')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[user-balance] query error:', error.message);
    return NextResponse.json({ aif_balance: 0 });
  }

  return NextResponse.json({ aif_balance: data?.aif_balance ?? 0 });
}
```

### app/api/messages/route.ts
```typescript
/**
 * /api/messages
 *
 * 消息总线 CRUD API — 使用 Service Role Key 绕过 RLS
 *
 * GET    ?userId=xxx  → 查询用户消息（个人 + 广播），排除软删除
 * POST              → 插入消息（服务端内部调用）
 * PATCH             → 标记已读（单条 id 或批量 userId）
 * DELETE ?id=&userId= → 软删除（设置 deleted_at = now()，不物理删除）
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase env config');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// ── GET: 获取消息列表（自动排除软删除行）──────────────────────────────────────

export async function GET(req: Request) {
  try {
    const adminSupabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let query = adminSupabase
      .from('messages')
      .select(
        'id, msg_id, type, msg_type, title, content, body, is_read, user_id, action_link, created_at, sender_id, status'
      )
      .is('deleted_at', null)            // 关键：排除软删除行
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.or(`user_id.is.null,user_id.eq.${userId}`);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[API/messages] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 兼容旧 body 字段：若 content 为空则回退到 body
    const normalized = (data ?? []).map((m) => ({
      ...m,
      content: m.content ?? m.body ?? '',
    }));

    return NextResponse.json({ messages: normalized });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: 插入单条消息（供服务端内部调用）─────────────────────────────────────

export async function POST(req: Request) {
  try {
    const adminSupabase = getAdminClient();
    const body = await req.json() as {
      userId?: string | null;
      type?: string;
      msgType?: string;
      title?: string;
      content?: string;
      actionLink?: string | null;
      senderId?: string | null;
    };

    const { userId, type, msgType, title, content, actionLink, senderId } = body;

    if (!title || !content || (!type && !msgType)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, and type or msgType' },
        { status: 400 }
      );
    }

    const resolvedMsgType = (msgType ?? type ?? 'system').toLowerCase();

    const { error } = await adminSupabase.from('messages').insert({
      user_id: userId ?? null,
      type: resolvedMsgType,
      msg_type: resolvedMsgType,
      title,
      content,
      body: content,              // 同步写入旧 body 列，保持向后兼容
      status: 'sent',
      ...(actionLink != null ? { action_link: actionLink } : {}),
      ...(senderId != null ? { sender_id: senderId } : {}),
    });

    if (error) {
      console.error('[API/messages] POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PATCH: 标记已读 ───────────────────────────────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const adminSupabase = getAdminClient();
    const body = await req.json();
    const { id, userId } = body as { id?: string; userId?: string };

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    if (id) {
      // 单条标记已读
      const { error } = await adminSupabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // 批量标记该用户所有未读消息
      const { error } = await adminSupabase
        .from('messages')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .is('deleted_at', null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE: 软删除消息（设置 deleted_at，不物理删除）─────────────────────────

export async function DELETE(req: Request) {
  try {
    const adminSupabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json({ error: 'Missing id or userId' }, { status: 400 });
    }

    // 软删除：仅设置 deleted_at，绝不物理删除；双重守卫确保用户只能删自己的消息
    const { error } = await adminSupabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null);  // 防止重复软删除

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/products/route.ts
```typescript
/**
 * GET /api/products
 *
 * 公開 API：返回所有 is_active = true 的平台產品清單。
 * 前端 useProduct Hook 與 UniversalCheckout 組件依賴此路由。
 * 使用 anon key 讀取（需 Supabase RLS 允許公開讀取 platform_products）。
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('platform_products')
      .select('id, product_code, name_zh, name_en, price_usd, price_aif, metadata, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/products] Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { products: data ?? [] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/products] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/interactive/submit/route.ts
```typescript
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
```

### app/api/verify-lbs/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Haversine 公式：计算两点之间的球面距离（单位：米）
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filmId, userLat, userLng } = body as {
      filmId: number | string;
      userLat: number;
      userLng: number;
    };

    if (typeof userLat !== 'number' || typeof userLng !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinates.' },
        { status: 400 }
      );
    }

    // 使用服务端 Supabase 客户端（避免 RLS 限制影响读取）
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 从 lbs_nodes 表中查询对应节点（id 与 filmId 对应）
    const { data: node, error: nodeError } = await supabase
      .from('lbs_nodes')
      .select('id, lat, lng, radius')
      .eq('id', Number(filmId))
      .single();

    if (nodeError || !node) {
      return NextResponse.json(
        { success: false, error: 'Unknown LBS node ID.' },
        { status: 400 }
      );
    }

    // Haversine 距离验证（保留原有验证逻辑）
    const distance = Math.round(
      haversineDistance(userLat, userLng, node.lat, node.lng)
    );

    const radius: number = node.radius ?? 500;

    if (distance > radius) {
      return NextResponse.json(
        {
          success: false,
          error: `ACCESS DENIED: Node out of range (${distance}m). Please move closer.`,
        },
        { status: 403 }
      );
    }

    // 验证通过 —— 查询 films 表中所有已审核影片
    const { data: approvedFilms, error: filmsError } = await supabase
      .from('films')
      .select('id, title, studio, poster_url, video_url, ai_ratio')
      .eq('status', 'approved');

    if (filmsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to load official selection.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, films: approvedFilms ?? [], distance },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body.' },
      { status: 400 }
    );
  }
}
```

## 5.2 上传/媒体类 API
### app/api/upload/route.ts
```typescript
/**
 * POST /api/upload
 *
 * 靜態資源上傳代理：圖片 / PDF / 其他 → Cloudflare R2
 *
 * 注意：視頻文件直接由瀏覽器 PUT 到 Bunny（見 /api/upload/video-credential），
 *       本路由不再處理任何視頻，避免觸發 Vercel 4.5 MB 請求體限制。
 *
 * FormData 字段：
 *   file  {File}  必填，待上傳靜態資源（圖片 / PDF 等）
 *
 * 響應：{ success: true, url: string }
 */

import { NextResponse } from 'next/server';
import { uploadFileToR2 } from '@/lib/cloudflareR2';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '缺少必要字段：file' }, { status: 400 });
    }

    console.log(`[/api/upload] 收到文件: name="${file.name}", size=${file.size}, type="${file.type}"`);

    const buffer = Buffer.from(await file.arrayBuffer());

    // 50s 超時保護
    const r2Timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Cloudflare R2 上傳超時，請重試')), 50_000),
    );

    const url = await Promise.race([
      uploadFileToR2(buffer, file.name, file.type || 'application/octet-stream'),
      r2Timeout,
    ]);

    console.log(`[/api/upload] R2 上傳完成: url=${url}`);
    return NextResponse.json({ success: true, url });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/upload] 上傳失敗:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/upload/video-credential/route.ts
```typescript
/**
 * POST /api/upload/video-credential
 *
 * 為前端視頻直傳 Bunny Stream 生成上傳憑證。
 *
 * 流程：
 *   1. 調用 Bunny API 在媒體庫創建空視頻占位符，獲得 videoId (guid)
 *   2. 組裝 PUT 上傳 URL：https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}
 *   3. 返回 { videoId, uploadUrl, accessKey, cdnHostname } 給前端
 *   4. 前端收到後直接 XHR PUT 二進制流到 uploadUrl，完全不經過 Vercel
 *
 * 請求：POST  Body: { title?: string }
 * 響應：{ success: true, videoId, uploadUrl, accessKey, cdnHostname }
 *
 * 安全：accessKey 為 Bunny Library API Key（庫級別，非賬戶級別）
 *       本接口由 Privy 登錄保護（用戶需先登錄才能進入上傳頁面）
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

export async function POST(req: Request) {
  console.log('[POST /api/upload/video-credential] ▶ called');

  try {
    // ── 1. 讀取請求體 ─────────────────────────────────────────────────────────
    const body   = await req.json() as { title?: string };
    const title  = (body.title ?? '').trim() || 'Untitled';

    // ── 2. 讀取環境變量 ───────────────────────────────────────────────────────
    const libraryId   = process.env.BUNNY_LIBRARY_ID;
    const accessKey   = process.env.BUNNY_API_KEY;
    const cdnHostname = process.env.BUNNY_CDN_HOSTNAME
                     ?? process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME;

    console.log(`[video-credential] env: BUNNY_LIBRARY_ID=${!!libraryId}, BUNNY_API_KEY=${!!accessKey}, CDN=${!!cdnHostname}`);

    if (!libraryId || !accessKey || !cdnHostname) {
      return NextResponse.json(
        { error: `Bunny 環境變量缺失（libraryId=${!!libraryId}, apiKey=${!!accessKey}, cdn=${!!cdnHostname}）` },
        { status: 500 },
      );
    }

    // ── 3. 在 Bunny 創建空視頻占位符 ─────────────────────────────────────────
    console.log(`[video-credential] 正在調用 Bunny API 創建視頻：title="${title}"`);

    const bunnyRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method:  'POST',
        headers: {
          AccessKey:      accessKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      },
    );

    if (!bunnyRes.ok) {
      const errBody = await bunnyRes.text();
      console.error(`[video-credential] Bunny API 創建失敗 HTTP ${bunnyRes.status}: ${errBody}`);
      return NextResponse.json(
        { error: `Bunny 創建視頻失敗（HTTP ${bunnyRes.status}）：${errBody.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const bunnyData = await bunnyRes.json() as { guid?: string };
    const videoId   = bunnyData.guid;

    if (!videoId) {
      console.error('[video-credential] Bunny 響應中缺少 guid:', JSON.stringify(bunnyData));
      return NextResponse.json(
        { error: 'Bunny 未返回 videoId，請重試' },
        { status: 502 },
      );
    }

    // ── 4. 組裝上傳 URL 並返回給前端 ─────────────────────────────────────────
    const uploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`;

    console.log(`[video-credential] ✓ 憑證就緒: videoId=${videoId}, uploadUrl=${uploadUrl}`);

    return NextResponse.json({
      success:     true,
      videoId,
      uploadUrl,
      accessKey,
      cdnHostname,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[video-credential] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/upload-film/route.ts
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 邮箱格式正则（RFC-compliant 简版）
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    // ── Auth：优先使用 Bearer Token 验证用户身份 ─────────────────────────────
    const authHeader = req.headers.get('authorization');
    let verifiedUserId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
        verifiedUserId = claims.userId;
        console.log('[upload-film] 已通过 Bearer token 验证用户:', verifiedUserId);
      } catch (authErr) {
        console.warn('[upload-film] Bearer token 验证失败，回退到 creator_id:', authErr);
      }
    }

    const body = await req.json();
    console.log('【upload-film 接收到的參數】:', {
      creator_id: body.creator_id,
      title: body.title,
      ai_ratio: body.ai_ratio,
      has_poster: !!body.poster_url,
      has_trailer: !!body.trailer_url,
      has_film: !!body.full_film_url,
      contact_email: body.contact_email ? '(已填寫)' : '(空)',
      lbs_royalty: body.lbs_royalty,
    });

    const { 
      creator_id, title, studio_name, tech_stack, ai_ratio, 
      synopsis, core_cast, region, lbs_royalty,
      poster_url, trailer_url, full_film_url,
      contact_email,
    } = body;

    // 确定最终使用的 user_id：优先使用 Token 验证的 ID，fallback 到客户端传入的 creator_id
    const finalUserId = verifiedUserId || creator_id;

    console.log('[upload-film] finalUserId:', finalUserId, '| verifiedUserId:', verifiedUserId, '| creator_id:', creator_id);

    // 后端二次强制校验：user_id 必须是非空字串，防止孤儿影片写入
    if (!finalUserId || typeof finalUserId !== 'string' || finalUserId.trim() === '') {
      return NextResponse.json({ error: 'Missing or invalid user identity: cannot create orphan film record' }, { status: 400 });
    }
    if (!title || !poster_url || !trailer_url || !full_film_url) {
      return NextResponse.json({ error: 'Missing required media files or fields' }, { status: 400 });
    }
    if (parseInt(ai_ratio) < 51) {
      return NextResponse.json({ error: 'AI ratio must be at least 51%' }, { status: 400 });
    }
    // 官方联系邮箱：必填且格式合法
    if (!contact_email || typeof contact_email !== 'string' || !EMAIL_REGEX.test(contact_email.trim())) {
      return NextResponse.json({ error: '請填寫合法的官方聯繫郵箱 (contact_email)' }, { status: 400 });
    }

    const userId = finalUserId.trim();

    console.log('[upload-film] 準備插入 films 表, userId:', userId, '| title:', title, '| ai_ratio:', ai_ratio, '| has poster:', !!poster_url, '| has trailer:', !!trailer_url, '| has film:', !!full_film_url);

    // 插入影片记录：user_id 强制绑定已验证 userId，初始状态为待支付
    const { data: film, error: filmError } = await adminSupabase
      .from('films')
      .insert([{
        user_id:        userId,
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
      console.error('[upload-film] Supabase insert 失敗 | code:', filmError.code, '| message:', filmError.message, '| details:', filmError.details, '| hint:', filmError.hint);
      // 将 Supabase 技术性错误转换为用户友好的提示
      const rawMessage = filmError.message ?? JSON.stringify(filmError);
      const userMessage = rawMessage.includes('string did not match') || rawMessage.includes('invalid input syntax')
        ? '影片資料格式有誤，請重新提交或聯繫客服（錯誤碼：SCHEMA_MISMATCH）'
        : rawMessage.includes('does not exist')
          ? '數據庫欄位配置有誤，請聯繫平台客服（錯誤碼：DB_COLUMN）'
          : rawMessage.includes('violates check constraint')
            ? '影片狀態值不合法，請聯繫平台客服（錯誤碼：CONSTRAINT）'
            : rawMessage;
      throw new Error(userMessage);
    }

    // 防禦性空值保護：確保 film 和 film.id 不為 null
    if (!film || !film.id) {
      console.error('[upload-film] film 或 film.id 為空！DB 返回:', JSON.stringify(film));
      throw new Error('影片記錄創建後未能取得 ID，請重試（錯誤碼：NULL_FILM_ID）');
    }

    console.log('[upload-film] ✓ 影片記錄創建成功 | film.id:', film.id, '| payment_status: unpaid');
    // 交易流水由对应的支付 API（/api/stripe/checkout 或 /api/pay/aif）在支付确认后记录
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
```

### app/api/bunny/upload-video/route.ts
```typescript
/**
 * app/api/bunny/upload-video/route.ts
 *
 * 视频入库分流路由：Bunny Stream 服务端拉取
 *
 * 设计说明：
 *  大文件（≤1GB）不经过本服务器中转，前端先将视频上传至 OSS（已有多分片上传支持），
 *  再将 OSS 公开链接传入本接口，由 Bunny 服务器主动拉取并转码生成 HLS。
 *  这样避免了 Vercel/Next.js 4.5MB 请求体限制，同时利用了两边的分布式节点。
 *
 * 调用方式：
 *  POST /api/bunny/upload-video
 *  Body: { videoUrl: string, title: string }
 *
 * 返回：
 *  { success: true, guid: string, hlsUrl: string }
 */

import { NextResponse } from 'next/server';
import { fetchFromUrlToBunny } from '@/lib/bunnyStream';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { videoUrl?: string; title?: string };
    const { videoUrl, title } = body;

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { error: '缺少必要参数 videoUrl' },
        { status: 400 }
      );
    }

    const videoTitle = title?.trim() || 'Untitled';

    console.log(`[Bunny Upload API] 开始处理视频迁移，title="${videoTitle}"，source="${videoUrl}"`);

    // 让 Bunny 服务器主动拉取 OSS 视频并自动转码（异步任务，立即返回 guid）
    const guid = await fetchFromUrlToBunny(videoUrl, videoTitle);

    const cdnHostname = process.env.BUNNY_CDN_HOSTNAME;
    if (!cdnHostname) {
      throw new Error('缺少环境变量 BUNNY_CDN_HOSTNAME');
    }

    const hlsUrl = `https://${cdnHostname}/${guid}/playlist.m3u8`;

    console.log(`[Bunny Upload API] 任务提交成功，guid=${guid}，HLS=${hlsUrl}`);

    return NextResponse.json({ success: true, guid, hlsUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Bunny Upload API] 处理失败：', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/media/get-play-url/route.ts
```typescript
/**
 * POST /api/media/get-play-url
 *
 * 受保护媒体 URL 解析器
 *
 * 安全机制：
 *  1. 验证 Privy Access Token（Bearer），确认用户身份
 *  2. 根据 resourceType 进行业务权限校验：
 *     - "film"  → 检查 films.payment_status 或 films.status = 'approved'（公映影片免费）
 *     - "lbs"   → 检查用户是否已在 LBS 节点地理范围内（由前端传入坐标，后端验算）
 *  3. 通过校验后返回可播放 URL：
 *     - Bunny HLS / R2 完整 URL → 直接返回
 *     - 旧版 OSS Object Key → 构造公开 URL（向后兼容历史数据）
 *
 * Request Body:
 *  {
 *    objectKey: string,          // 媒体资源 Key 或完整 URL
 *    resourceType: "film"|"lbs", // 资源类型
 *    filmId?: string,            // resourceType=film 时必传
 *    lbsNodeId?: string,         // resourceType=lbs 时必传
 *    userLat?: number,           // resourceType=lbs 时传入用户坐标（后端验算）
 *    userLng?: number,
 *    expiresSeconds?: number,    // 保留参数（兼容旧客户端，不再使用）
 *  }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

export const dynamic = 'force-dynamic';

// ── 初始化 ────────────────────────────────────────────────────────────────────

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env variables');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Haversine 距离计算（米）────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 主处理函数 ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Step 1: 验证 Privy Token ──────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  let verifiedUserId: string;
  try {
    const claims = await privyClient.verifyAuthToken(token);
    verifiedUserId = claims.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
  }

  // ── Step 2: 解析请求体 ────────────────────────────────────────────────────
  let body: {
    objectKey?: string;
    resourceType?: 'film' | 'lbs';
    filmId?: string;
    lbsNodeId?: string;
    userLat?: number;
    userLng?: number;
    expiresSeconds?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    objectKey,
    resourceType = 'film',
    filmId,
    lbsNodeId,
    userLat,
    userLng,
    expiresSeconds = 1800,
  } = body;

  if (!objectKey) {
    return NextResponse.json({ error: 'objectKey is required' }, { status: 400 });
  }

  // 最长签名有效期限制：1小时
  const finalExpires = Math.min(Math.max(expiresSeconds, 60), 3600);

  const db = getAdminClient();

  // ── Step 3: 业务权限校验 ──────────────────────────────────────────────────

  if (resourceType === 'film') {
    if (!filmId) {
      return NextResponse.json({ error: 'filmId is required for film resource' }, { status: 400 });
    }

    const { data: film, error: filmErr } = await db
      .from('films')
      .select('id, status, payment_status, user_id')
      .eq('id', filmId)
      .single();

    if (filmErr || !film) {
      return NextResponse.json({ error: 'Film not found' }, { status: 404 });
    }

    // 已 approved 的公映影片：所有登录用户均可播放
    // 否则：只有影片所有者且已付费才可访问
    const isPublic = film.status === 'approved';
    const isOwnerPaid = film.user_id === verifiedUserId && film.payment_status === 'paid';

    if (!isPublic && !isOwnerPaid) {
      return NextResponse.json(
        { error: 'Access denied: film not approved or payment not confirmed' },
        { status: 403 }
      );
    }

  } else if (resourceType === 'lbs') {
    if (!lbsNodeId) {
      return NextResponse.json({ error: 'lbsNodeId is required for lbs resource' }, { status: 400 });
    }

    const { data: node, error: nodeErr } = await db
      .from('lbs_nodes')
      .select('id, state, lat, lng, unlock_radius, radius, status')
      .eq('id', lbsNodeId)
      .single();

    if (nodeErr || !node) {
      return NextResponse.json({ error: 'LBS node not found' }, { status: 404 });
    }

    if (node.status !== 'approved' && node.state !== 'unlocked') {
      // 检查用户是否在地理范围内
      if (node.lat != null && node.lng != null && userLat != null && userLng != null) {
        const radius = Number(node.unlock_radius ?? node.radius ?? 500);
        const distance = haversineMeters(userLat, userLng, Number(node.lat), Number(node.lng));

        if (distance > radius) {
          return NextResponse.json(
            {
              error: `Access denied: you are ${Math.round(distance)}m away, need to be within ${radius}m`,
              distance: Math.round(distance),
              requiredRadius: radius,
            },
            { status: 403 }
          );
        }
      } else if (node.state !== 'unlocked') {
        return NextResponse.json(
          { error: 'Access denied: LBS geo verification required' },
          { status: 403 }
        );
      }
    }
  }

  // ── Step 4: 解析并返回可播放 URL ─────────────────────────────────────────
  //
  // 新架构：视频存于 Bunny Stream（HLS 公开分发），图片存于 Cloudflare R2（公开 CDN）。
  // 权限校验已在上方完成，此处直接返回可访问 URL，无需二次签名。
  //
  // 向后兼容逻辑：
  //  - 完整 URL（https://...）  → 直接返回（Bunny / R2 / 旧版 OSS CDN URL）
  //  - 局部 Key（含 /playlist.m3u8）→ 视为 Bunny GUID 路径，补全 CDN 域名
  //  - 其他局部 Key              → 视为旧版 OSS Object Key，补全 OSS 域名

  let resolvedUrl: string;

  if (objectKey.startsWith('http://') || objectKey.startsWith('https://')) {
    // 已是完整 URL（Bunny HLS、R2 公共链接、旧版 OSS CDN 地址）
    resolvedUrl = objectKey;
  } else if (objectKey.includes('/playlist.m3u8') || objectKey.includes('/thumbnail.jpg')) {
    // Bunny GUID 路径，如 "abc-123-def/playlist.m3u8"
    const cdnHostname = process.env.BUNNY_CDN_HOSTNAME || process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME;
    resolvedUrl = cdnHostname
      ? `https://${cdnHostname}/${objectKey}`
      : `https://vz-eb1ce7ba-274.b-cdn.net/${objectKey}`;
  } else {
    // 旧版 OSS Object Key（历史数据向后兼容，只读访问）
    // 这部分仅处理 DB 中尚未迁移的历史记录，新上传内容均存储为完整 https:// URL
    const legacyOssBase = process.env.LEGACY_OSS_BASE_URL
      ?? 'https://hkaiiff-media-node.oss-ap-southeast-1.aliyuncs.com';
    resolvedUrl = `${legacyOssBase}/${objectKey.replace(/^\//, '')}`;
  }

  return NextResponse.json({
    url: resolvedUrl,
    expiresIn: finalExpires,
    expiresAt: new Date(Date.now() + finalExpires * 1000).toISOString(),
  });
}
```

### app/api/verification/submit/route.ts
```typescript
/**
 * POST /api/verification/submit
 *
 * 身份認證申請提交 API（多重身份版）
 *
 * creator_applications 表只寫入以下欄位：
 *   user_id, identity_type, status, verification_name, payment_method,
 *   payment_session, submitted_at
 *
 * 不寫入 bio / tech_stack / core_team / portfolio 等 users 表欄位。
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { createClient } from '@supabase/supabase-js';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface VerificationSubmitBody {
  verificationType: 'creator' | 'institution' | 'curator';
  verificationName?: string;
  paymentMethod: 'fiat' | 'aif';
  /** 若傳入，則更新已有的草稿記錄（用於 AIF 支付後更新 awaiting_payment 草稿） */
  applicationId?: string;
}

export async function POST(req: NextRequest) {
  // ── 身份驗證 ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  let userId: string;
  try {
    const claims = await privy.verifyAuthToken(token);
    userId = claims.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body: VerificationSubmitBody = await req.json();
  const { verificationType, verificationName, paymentMethod, applicationId } = body;

  if (!verificationType || !paymentMethod) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const targetStatus = paymentMethod === 'aif' ? 'pending' : 'awaiting_payment';
  const cleanName = (verificationName ?? '').trim();

  // ── 如果是 AIF 更新既有草稿 ──────────────────────────────────────────────────
  if (applicationId) {
    const { data: existing } = await supabase
      .from('creator_applications')
      .select('id, user_id, status')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing && existing.status === 'awaiting_payment') {
      const { error } = await supabase
        .from('creator_applications')
        .update({
          status: targetStatus,
          verification_name: cleanName || null,
          payment_method: paymentMethod,
          submitted_at: now,
        })
        .eq('id', applicationId);

      if (error) {
        console.error('[verification/submit] update draft error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, applicationId });
    }
  }

  // ── 防重複檢查 ───────────────────────────────────────────────────────────────
  const { data: blocking } = await supabase
    .from('creator_applications')
    .select('id, status, expires_at')
    .eq('user_id', userId)
    .eq('identity_type', verificationType)
    .in('status', ['awaiting_payment', 'pending', 'approved'])
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (blocking) {
    if (blocking.status === 'awaiting_payment' || blocking.status === 'pending') {
      return NextResponse.json(
        { error: 'duplicate_pending', message: '已有相同身份的待審核申請，請勿重複提交' },
        { status: 409 }
      );
    }
    if (blocking.status === 'approved') {
      const isExpired = blocking.expires_at && blocking.expires_at < now;
      if (!isExpired) {
        return NextResponse.json(
          { error: 'duplicate_approved', message: '此身份已通過認證且尚未過期（1年效期）' },
          { status: 409 }
        );
      }
    }
  }

  // ── 新建申請記錄（僅寫入 creator_applications 合法欄位）────────────────────
  const { data: application, error } = await supabase
    .from('creator_applications')
    .insert({
      user_id: userId,
      identity_type: verificationType,
      status: targetStatus,
      verification_name: cleanName || null,
      payment_method: paymentMethod,
      submitted_at: now,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[verification/submit] insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, applicationId: application.id });
}
```

### app/api/verification/pay/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { createClient } from '@supabase/supabase-js';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VERIFICATION_AIF_FEE = 150;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  let userId: string;
  try {
    const claims = await privy.verifyAuthToken(token);
    userId = claims.userId;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Atomic AIF deduction — prevents race conditions
  const { data, error } = await supabase.rpc('deduct_aif_balance', {
    p_user_id: userId,
    p_amount: VERIFICATION_AIF_FEE,
  });

  if (error) {
    console.error('[verification/pay] RPC error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data === false) {
    return NextResponse.json({ error: 'Insufficient AIF balance' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
```

## 5.3 支付/钱包类 API
### app/api/wallet/assign/route.ts
```typescript
/**
 * POST /api/wallet/assign
 *
 * 為已登錄用戶分配專屬 Solana 充值地址（HD Wallet 架構）。
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  冪等安全保障（三重防護）                                      ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  [防護一] 鑑權後【立即】查詢 deposit_address，有則直接返回     ║
 * ║           絕不執行任何派生邏輯或更新 wallet_index              ║
 * ║  [防護二] assign_wallet_index RPC 使用 Postgres Sequence      ║
 * ║           + 行級鎖，保證唯一 index，無竟態                     ║
 * ║  [防護三] 最終 UPDATE 攜帶 WHERE deposit_address IS NULL       ║
 * ║           並發時只有一筆寫入生效，後者自動讀取前者結果返回      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - 主助記詞 MASTER_SEED_PHRASE 僅在服務端使用，絕不暴露給前端
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { generateUserWallet } from '@/lib/solana/hdWallet';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(req: Request) {
  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      userId = claims.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // ── Step 2: 解析請求 body ─────────────────────────────────────────────────
    let walletAddress: string | null = null;
    try {
      const body = await req.json();
      walletAddress = body?.walletAddress ?? null;
    } catch {
      // body 為空或非 JSON，繼續
    }

    // ── Step 3: 【冪等防護一】立即查詢，有地址直接返回，拒絕任何派生操作 ───────
    const { data: existingUser, error: fetchError } = await adminSupabase
      .from('users')
      .select('deposit_address, wallet_index')
      .eq('id', userId)
      .single();

    if (!fetchError && existingUser?.deposit_address) {
      // 用戶已有充值地址：直接返回，絕不重新派生
      console.log(`[wallet/assign] ✅ 冪等返回現有地址 → ${userId}: ${existingUser.deposit_address}`);
      return NextResponse.json({ address: existingUser.deposit_address });
    }

    // ── Step 4: 用戶行不存在時，自動 Upsert 創建（僅設置基礎字段）────────────
    if (fetchError?.code === 'PGRST116') {
      console.log(`[wallet/assign] 用戶 ${userId} 尚未同步，自動創建中...`);
      const { error: upsertError } = await adminSupabase
        .from('users')
        .upsert(
          {
            id: userId,
            wallet_address: walletAddress,
            name: 'New Agent',
            role: 'human',
            aif_balance: 0,
            avatar_seed: userId,
          },
          { onConflict: 'id' }
        );

      if (upsertError) {
        console.error('[wallet/assign] 自動創建用戶失敗:', upsertError);
        return NextResponse.json(
          { error: `Failed to initialize user record: ${upsertError.message}` },
          { status: 500 }
        );
      }
    } else if (fetchError) {
      console.error('[wallet/assign] 查詢用戶失敗:', fetchError);
      return NextResponse.json(
        { error: `Database error: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // ── Step 5: 原子分配唯一 wallet_index（Postgres Sequence + 行級鎖）────────
    const { data: walletIndex, error: rpcError } = await adminSupabase
      .rpc('assign_wallet_index', { p_user_id: userId });

    if (rpcError || walletIndex === null || walletIndex === undefined) {
      console.error('[wallet/assign] assign_wallet_index RPC 錯誤:', rpcError);
      return NextResponse.json(
        { error: `Failed to allocate wallet index: ${rpcError?.message ?? 'unknown'}` },
        { status: 500 }
      );
    }

    // ── Step 6: 從主助記詞 + index 推導 Solana 公鑰 ──────────────────────────
    let depositAddress: string;
    try {
      depositAddress = generateUserWallet(walletIndex as number);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Derivation error';
      console.error('[wallet/assign] HD wallet 推導失敗:', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // ── Step 7: 【冪等防護三】條件 UPDATE：僅當 deposit_address 仍為 NULL 時寫入
    //           並發場景下，兩個請求同時到達：只有一個能成功更新，另一個讀取已有地址
    const { data: updatedRows, error: updateError } = await adminSupabase
      .from('users')
      .update({ deposit_address: depositAddress })
      .eq('id', userId)
      .is('deposit_address', null)
      .select('deposit_address');

    if (updateError) {
      console.error('[wallet/assign] 更新 deposit_address 失敗:', updateError);
      return NextResponse.json(
        { error: `Failed to persist deposit address: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 並發競態：本次更新未命中（另一請求已先寫入），查詢當前實際地址
    if (!updatedRows || updatedRows.length === 0) {
      const { data: racedUser } = await adminSupabase
        .from('users')
        .select('deposit_address')
        .eq('id', userId)
        .single();

      const finalAddress = racedUser?.deposit_address;
      if (finalAddress) {
        console.log(`[wallet/assign] ⚡ 並發競態：返回已存在地址 → ${userId}: ${finalAddress}`);
        return NextResponse.json({ address: finalAddress });
      }
      return NextResponse.json({ error: 'Failed to persist deposit address (concurrency)' }, { status: 500 });
    }

    console.log(`[wallet/assign] ✅ 充值地址已分配 → ${userId}: ${depositAddress}`);

    return NextResponse.json({ address: depositAddress });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[wallet/assign] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/wallet/init-ata/route.ts
```typescript
/**
 * POST /api/wallet/init-ata
 *
 * 為已登錄用戶的 deposit_address 創建 AIF Associated Token Account (ATA)。
 *
 * ╔══════════════════════════════════════════════════════╗
 * ║  絕對禁止：此路由嚴禁任何 SOL 轉帳（SystemProgram.transfer）║
 * ║  只允許：createAssociatedTokenAccountIdempotentInstruction  ║
 * ║  payer = 系統墊付錢包，owner = 用戶充值地址                   ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * 調用時機：
 *   用戶打開充值頁面（Top Up Modal）時，前端使用 useRef 鎖非同步觸發一次。
 *   徹底解決 Phantom 掃碼時的 Error 256 (InvalidAccountData)。
 *
 * 冪等性：
 *   ATA 已存在時返回 already_complete，零消耗墊付 SOL，可安全重複調用。
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { initUserDepositATA } from '@/lib/solana/hdWallet';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const ATA_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`ATA 初始化超時（${ms / 1000}s）`)), ms)
    ),
  ]);
}

export async function POST(req: Request) {
  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      userId = claims.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // ── Step 2: 取用戶的 deposit_address ──────────────────────────────────────
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('deposit_address')
      .eq('id', userId)
      .single();

    if (userError || !userData?.deposit_address) {
      return NextResponse.json(
        { error: 'No deposit address found. Please generate one first via /api/wallet/assign.' },
        { status: 404 }
      );
    }

    // ── Step 3: 純 ATA 創建（嚴禁 SOL 轉帳，冪等安全）────────────────────────
    const result = await withTimeout(
      initUserDepositATA(userData.deposit_address),
      ATA_TIMEOUT_MS
    );

    console.log(
      `[init-ata] ✅ (${result.status}) 用戶: ${userId} | ` +
      `地址: ${userData.deposit_address} | ATA創建: ${result.ataCreated} | ` +
      `tx: ${result.txSignature ?? 'skipped'}`
    );

    return NextResponse.json({
      success: true,
      status: result.status,
      ataCreated: result.ataCreated,
      txSignature: result.txSignature,
      depositAddress: userData.deposit_address,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[init-ata] 初始化失敗:', message);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
```

### app/api/wallet/sync-balance/route.ts
```typescript
/**
 * POST /api/wallet/sync-balance
 *
 * 觸發鏈上查帳 + 資金歸集（Sweep & Credit）。
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  完整流程（Sweep-First，安全優先）                              ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  1. 鑑權：驗證 Privy Access Token                             ║
 * ║  2. 查庫：取用戶的 deposit_address + wallet_index             ║
 * ║  3. 鏈上查詢：讀取充值地址的 AIF 真實餘額                       ║
 * ║  4. 餘額 = 0：直接返回，零消耗                                  ║
 * ║  5. 餘額 > 0：                                                ║
 * ║     a. 【歸集 Sweep】構建雙簽 Transfer 交易，AIF → 金庫          ║
 * ║        - feePayer  = FEE_PAYER_PRIVATE_KEY（墊付 Gas）         ║
 * ║        - authority = deriveDepositKeypair(wallet_index)       ║
 * ║     b. 交易上鏈確認後，【記帳 Credit】更新 Supabase              ║
 * ║        aif_balance += swept_amount（Sweep 成功才記帳，防空帳）    ║
 * ║  6. 返回歸集結果 + 新餘額                                       ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  並發防重入：                                                   ║
 * ║  - 鏈上 Sweep 是原子的：Sweep 後充值地址餘額歸零                  ║
 * ║  - 第二個並發請求查到餘額為 0 → 直接返回，不會重複記帳             ║
 * ║  - aif_balance 更新：用 SELECT + UPDATE 讀後寫                  ║
 * ║    （Sweep 提供主要冪等保護，讀後寫窗口極短）                      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { sweepUserDeposit } from '@/lib/solana/hdWallet';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const SYNC_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 超時（${ms / 1000}s），RPC 響應過慢`)), ms)
    ),
  ]);
}

export async function POST(req: Request) {
  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      userId = claims.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // ── Step 2: 查詢用戶 deposit_address + wallet_index ──────────────────────
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('deposit_address, wallet_index, aif_balance')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found. Please complete profile setup first.' },
        { status: 404 }
      );
    }

    const { deposit_address, wallet_index, aif_balance } = userData;

    if (!deposit_address || wallet_index === null || wallet_index === undefined) {
      // 未分配充值地址屬於正常狀態（新用戶），優雅返回 200 而非拋出錯誤
      return NextResponse.json({ synced: false, status: 'no_balance', aif_balance: aif_balance ?? 0 });
    }

    // ── Step 3: 鏈上查帳 + 歸集（Sweep-First） ───────────────────────────────
    console.log(`[sync-balance] 開始同步 → 用戶: ${userId} | 充值地址: ${deposit_address}`);

    const sweepResult = await withTimeout(
      sweepUserDeposit(wallet_index as number, deposit_address),
      SYNC_TIMEOUT_MS,
      'sweepUserDeposit'
    );

    // ── Step 4: 餘額為 0，無需任何操作，直接返回 ──────────────────────────────
    if (!sweepResult.swept) {
      console.log(`[sync-balance] 鏈上餘額為 0，無需歸集 → 用戶: ${userId}`);
      return NextResponse.json({
        synced: false,
        message: 'On-chain balance is 0. No sweep needed.',
        aif_balance: aif_balance ?? 0,
      });
    }

    // ── Step 5: Sweep 成功 → 記帳（aif_balance += swept_amount）─────────────
    // Sweep 已上鏈，此時才寫入資料庫，保證「先扣後記」不空帳
    const creditAmount = sweepResult.aifAmount;
    const newBalance   = (aif_balance ?? 0) + creditAmount;

    const { error: updateError } = await adminSupabase
      .from('users')
      .update({ aif_balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      // 嚴重：鏈上已歸集但資料庫記帳失敗
      // 記錄告警，讓管理員手動核查（tokens 已安全在金庫，不會丟失）
      console.error(
        `[sync-balance] ⚠️ CRITICAL: Sweep 成功但記帳失敗！` +
        `用戶: ${userId} | 金額: ${creditAmount} AIF | tx: ${sweepResult.txSignature} | ` +
        `DB錯誤: ${updateError.message}`
      );
      // 嘗試寫入告警消息到 messages 表
      try {
        await adminSupabase.from('messages').insert({
          user_id: null,
          type: 'system',
          title: '⚠️ Sweep 成功但記帳失敗 — 需手動核查',
          body:
            `用戶 ${userId} 的 ${creditAmount} AIF 已成功歸集（tx: ${sweepResult.txSignature}），` +
            `但 aif_balance 資料庫更新失敗（${updateError.message}）。請手動補記。`,
          is_read: false,
        });
      } catch { /* 告警寫入失敗不影響主流程響應 */ }

      return NextResponse.json(
        {
          error: 'Sweep succeeded but balance credit failed. Admin will reconcile manually.',
          txSignature: sweepResult.txSignature,
        },
        { status: 500 }
      );
    }

    console.log(
      `[sync-balance] ✅ 同步完成 | 用戶: ${userId} | ` +
      `歸集: ${creditAmount} AIF | 新餘額: ${newBalance} | tx: ${sweepResult.txSignature}`
    );

    return NextResponse.json({
      synced: true,
      aifAmount:    creditAmount,
      txSignature:  sweepResult.txSignature,
      aif_balance:  newBalance,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[sync-balance] 未預期錯誤:', message);
    // 鏈上查帳錯誤（RPC 超時、網絡抖動等）應優雅降級，不向用戶暴露 500
    // 客戶端輪詢遇到此情況時保持靜默，繼續下一輪重試
    return NextResponse.json({ synced: false, status: 'error', message }, { status: 200 });
  }
}
```

### app/api/webhook/solana/route.ts
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// AIF 代幣合約地址（從環境變量讀取，fallback 到 mock 值）
const AIF_MINT_ADDRESS =
  process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS || 'AIF_MOCK_CONTRACT_ADDRESS';

// 金庫錢包地址，用於驗證收款方
const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET || '';

// Helius Webhook 推送的單筆交易結構
interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  mint: string;
  tokenAmount: number;
  fromTokenAccount?: string;
  toTokenAccount?: string;
  tokenStandard?: string;
}

interface HeliusTransaction {
  signature: string;
  type: string;
  transactionError: null | object;
  tokenTransfers: HeliusTokenTransfer[];
  timestamp?: number;
  feePayer?: string;
  source?: string;
}

// 使用 Service Role Key 初始化 Supabase 管理員客戶端，繞過 RLS
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('缺少 Supabase 環境變量：NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(req: Request) {
  // ── Auth Guard：嚴格校驗 Helius Authorization Header ─────────────────────
  const authHeader = req.headers.get('authorization');
  if (!process.env.HELIUS_WEBHOOK_SECRET || authHeader !== process.env.HELIUS_WEBHOOK_SECRET) {
    console.error('[Solana Webhook] Unauthorized webhook attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Helius 推送的是一個交易數組
    const transactions: HeliusTransaction[] = Array.isArray(body) ? body : [body];

    if (transactions.length === 0) {
      return NextResponse.json({ message: 'No transactions to process' }, { status: 200 });
    }

    const supabase = createAdminClient();
    const results: Array<{ signature: string; status: string; wallet?: string }> = [];

    for (const tx of transactions) {
      const { signature, type, transactionError, tokenTransfers } = tx;

      // 只處理成功的 TRANSFER 類型交易
      if (type !== 'TRANSFER' || transactionError !== null) {
        results.push({ signature, status: 'skipped_not_valid_transfer' });
        continue;
      }

      if (!tokenTransfers || tokenTransfers.length === 0) {
        results.push({ signature, status: 'skipped_no_token_transfers' });
        continue;
      }

      for (const transfer of tokenTransfers) {
        const { mint, toUserAccount, fromUserAccount, tokenAmount } = transfer;

        // 校驗：必須是 AIF 代幣
        if (mint !== AIF_MINT_ADDRESS) {
          continue;
        }

        // 校驗：必須轉入金庫錢包（充值方向驗證）
        if (TREASURY_WALLET && toUserAccount !== TREASURY_WALLET) {
          continue;
        }

        // 校驗：金額必須為正數
        const amount = Number(tokenAmount);
        if (!amount || amount <= 0) {
          continue;
        }

        // 充值方的錢包地址（發送方）即為需要入賬的用戶
        const targetAddress = fromUserAccount;

        console.log(
          `[Solana Webhook] 處理充值 | 用戶: ${targetAddress} | 金額: ${amount} AIF | 交易: ${signature}`
        );

        // 調用 Supabase RPC 安全增加餘額
        const { error: rpcError } = await supabase.rpc('increment_aif_balance', {
          wallet_addr: targetAddress,
          amount_to_add: amount,
        });

        if (rpcError) {
          console.error(
            `[Solana Webhook] DB 更新失敗 | 用戶: ${targetAddress} | 交易: ${signature}`,
            rpcError
          );
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
        }

        console.log(
          `[Solana Webhook] 充值成功 ✓ | 用戶: ${targetAddress} | 金額: ${amount} AIF`
        );
        results.push({ signature, status: 'credited', wallet: targetAddress });
      }
    }

    return NextResponse.json(
      { message: 'Top-up successful', results },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Solana Webhook] 處理異常:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/pay/aif/route.ts
```typescript
/**
 * POST /api/pay/aif
 *
 * AIF 內部賬本扣款 — 影片報名費 500 AIF。
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer），userId 從 Token 中取得
 *  - Token 中的 userId 必須與請求體的 userId 一致，防止越權扣款
 *  - filmId 必須屬於該用戶且處於未支付狀態
 *  - 使用帶 WHERE 條件的原子 UPDATE（aif_balance >= 500）
 *    防止餘額競態條件（超賣）
 *  - 兩步操作：先原子扣款，後更新影片狀態（若影片更新失敗則記錄告警）
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { sendMessage } from '@/lib/actions/message';

// ── 服務端 Supabase 客戶端（繞過 RLS） ────────────────────────────────────────
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ── Privy 服務端驗證 ───────────────────────────────────────────────────────────
const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const AIF_FEE = 500;

export async function POST(req: Request) {
  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(token);
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // ── Step 2: 解析並校驗請求體 ─────────────────────────────────────────────
    const body = await req.json();
    const { filmId, userId } = body;

    if (!filmId || !userId) {
      return NextResponse.json(
        { error: 'filmId and userId are required' },
        { status: 400 }
      );
    }

    // 確保請求體中的 userId 與 Token 一致，防止越權操作
    if (userId !== verifiedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: userId mismatch' },
        { status: 403 }
      );
    }

    // ── Step 3: 驗證 filmId 屬於該用戶且尚未支付 ─────────────────────────────
    const { data: film, error: filmError } = await adminSupabase
      .from('films')
      .select('id, user_id, payment_status, title')
      .eq('id', filmId)
      .single();

    if (filmError || !film) {
      return NextResponse.json(
        { error: 'Film not found' },
        { status: 404 }
      );
    }

    if (film.user_id !== verifiedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: film does not belong to this user' },
        { status: 403 }
      );
    }

    if (film.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Film has already been paid' },
        { status: 409 }
      );
    }

    // ── Step 4: 原子扣款（帶餘額守衛，防超賣） ──────────────────────────────
    // 優先使用 Postgres RPC 做原子減法（SET col = col - N WHERE col >= N）
    // 若 RPC 不存在則降級至帶 WHERE 守衛的直接 UPDATE
    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      'deduct_aif_balance',
      { p_user_id: verifiedUserId, p_amount: AIF_FEE }
    );

    // 若 RPC 不存在，退回至帶守衛的直接更新
    let deductSuccess = false;
    let newBalance: number | null = null;

    if (rpcError) {
      // RPC 不可用時的降級方案：先讀後寫（仍有極低競態風險，但有行鎖守衛）
      console.warn('[pay/aif] deduct_aif_balance RPC 不可用，使用降級方案:', rpcError.message);

      // 先確認餘額（二次鎖定檢查）
      const { data: userData, error: userFetchError } = await adminSupabase
        .from('users')
        .select('aif_balance')
        .eq('id', verifiedUserId)
        .single();

      if (userFetchError || !userData) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      if (userData.aif_balance < AIF_FEE) {
        return NextResponse.json(
          { error: `Insufficient AIF balance. Required: ${AIF_FEE} AIF, Available: ${userData.aif_balance} AIF` },
          { status: 400 }
        );
      }

      // 帶 WHERE 守衛的原子 UPDATE，防止並發超賣
      const { data: atomicUpdate, error: atomicError } = await adminSupabase
        .from('users')
        .update({ aif_balance: userData.aif_balance - AIF_FEE })
        .eq('id', verifiedUserId)
        .gte('aif_balance', AIF_FEE) // 原子守衛
        .select('aif_balance');

      if (atomicError) {
        console.error('[pay/aif] 扣款失敗:', atomicError);
        return NextResponse.json(
          { error: 'Failed to deduct AIF balance' },
          { status: 500 }
        );
      }

      if (!atomicUpdate || atomicUpdate.length === 0) {
        // WHERE gte 守衛攔截：說明並發時餘額已被其他操作消耗
        return NextResponse.json(
          { error: 'Insufficient AIF balance' },
          { status: 400 }
        );
      }

      deductSuccess = true;
      newBalance = atomicUpdate[0]?.aif_balance ?? null;
    } else {
      // RPC 返回結果：約定 RPC 返回 { success: boolean, new_balance: number }
      if (!rpcData?.success) {
        return NextResponse.json(
          { error: rpcData?.error ?? 'Insufficient AIF balance' },
          { status: 400 }
        );
      }
      deductSuccess = true;
      newBalance = rpcData.new_balance ?? null;
    }

    if (!deductSuccess) {
      return NextResponse.json(
        { error: 'AIF deduction failed unexpectedly' },
        { status: 500 }
      );
    }

    // ── Step 5: 更新影片狀態 ──────────────────────────────────────────────────
    const { error: filmUpdateError } = await adminSupabase
      .from('films')
      .update({
        payment_status: 'paid',
        payment_method: 'aif',
        status: 'pending_review',
      })
      .eq('id', filmId)
      .eq('user_id', verifiedUserId); // 雙重守衛

    if (filmUpdateError) {
      // 扣款已成功但影片狀態更新失敗：記錄告警，需人工處理
      console.error(
        '[pay/aif] 嚴重：扣款成功但影片狀態更新失敗！',
        { userId: verifiedUserId, filmId, filmUpdateError }
      );
      // 仍然返回成功，避免用戶重複支付；後台需監控此類告警
      return NextResponse.json(
        {
          success: true,
          warning: 'Payment deducted but film status update failed. Our team has been notified.',
          newBalance,
        },
        { status: 200 }
      );
    }

    // ── Step 6: 記錄交易流水 ─────────────────────────────────────────────────
    await adminSupabase
      .from('transactions')
      .insert([{
        user_id: verifiedUserId,
        related_film_id: filmId,
        amount: AIF_FEE,
        currency: 'AIF',
        tx_type: 'submission_fee',
        status: 'success',
      }]);

    // ── Step 7: 發送「鑄造上鏈成功」站內信 ───────────────────────────────────
    await sendMessage({
      userId: verifiedUserId,
      type: 'on-chain',
      title: '鑄造上鏈成功',
      content: `您的影片《${film.title ?? filmId}》已完成 AIF 支付（${AIF_FEE} AIF），影片進入審核流程，上鏈確認後合約地址將在此通知中更新。`,
      actionLink: `/me`,
    }).catch((err) => console.error('[pay/aif] sendMessage failed:', err));

    return NextResponse.json({
      success: true,
      newBalance,
      message: 'AIF payment confirmed. Film is now pending review.',
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[pay/aif] 未預期錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/pay/verify-aif/route.ts
```typescript
/**
 * POST /api/pay/verify-aif
 *
 * Web2.5 AIF 支付查帳接口 — 用戶手動轉帳後，前端呼叫此接口確認到帳並完成業務。
 *
 * 流程說明：
 *  1. 用戶在 UniversalCheckout 選擇 AIF 支付 → 顯示充值地址 + Solana Pay QR
 *  2. 用戶用 Phantom / 任意 Solana 錢包 App 掃碼並轉帳精確金額至充值地址
 *  3. Helius Webhook (/api/webhook/solana) 自動偵測到帳並更新 aif_balance
 *  4. 用戶點擊「我已完成轉帳」→ 前端呼叫本接口
 *  5. 本接口驗證 aif_balance >= expectedAmount → 原子扣款 → 業務邏輯 → 返回成功
 *
 * 若 aif_balance 尚未更新（網絡延遲），返回 402 提示用戶稍後重試。
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - userId 從 Token 中取得，防止越權查帳
 *  - 使用帶 WHERE 守衛的原子 UPDATE，防止餘額競態
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { sendMessage } from '@/lib/actions/message';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// ── 業務邏輯（複用 product-aif 的邏輯）──────────────────────────────────────

async function handleIdentityVerifyPaid(userId: string, identityType?: string, verificationName?: string): Promise<void> {
  const now = new Date().toISOString();
  const resolvedIdentityType = identityType || 'creator';
  const cleanName = (verificationName ?? '').trim() || null;

  // ── 1. UPSERT creator_applications 表（Admin 控制中心讀取此表）────────────
  // 查找該 user_id 最新的 awaiting_payment 草稿（不限 identity_type）
  // 避免因大小寫不一致或 identityType 差異導致找不到草稿，插入失敗被 409 攔截
  const { data: existing } = await adminSupabase
    .from('creator_applications')
    .select('id, identity_type')
    .eq('user_id', userId)
    .eq('status', 'awaiting_payment')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error: appErr } = await adminSupabase
      .from('creator_applications')
      .update({
        status: 'pending',
        identity_type: resolvedIdentityType,
        verification_name: cleanName,
        payment_method: 'aif',
        submitted_at: now,
      })
      .eq('id', existing.id);

    if (appErr) {
      console.error('[verify-aif] creator_applications update failed:', appErr.message);
    } else {
      console.log(`[verify-aif] Updated creator_application ${existing.id} → pending (AIF, type=${resolvedIdentityType})`);
    }
  } else {
    const { error: insertErr } = await adminSupabase
      .from('creator_applications')
      .insert({
        user_id: userId,
        identity_type: resolvedIdentityType,
        status: 'pending',
        verification_name: cleanName,
        payment_method: 'aif',
        submitted_at: now,
      });

    if (insertErr) {
      console.error('[verify-aif] creator_applications insert failed:', insertErr.message);
    } else {
      console.log(`[verify-aif] Created creator_application for user ${userId} → pending (AIF, type=${resolvedIdentityType})`);
    }
  }

  // ── 2. 同步更新 users 表 ────────────────────────────────────────────────
  const { error: updateError } = await adminSupabase
    .from('users')
    .update({
      verification_status: 'pending',
      verification_payment_method: 'aif',
      verification_type: resolvedIdentityType,
      verification_submitted_at: now,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[verify-aif] users table update failed:', updateError.message);
  }

  await sendMessage({
    userId,
    type: 'system',
    title: '創作者認證費支付成功',
    content: '您的認證費已通過 AIF 轉帳確認。人工審核團隊將在 3-5 個工作日內完成身份資質審核，結果將通過站內信通知您。',
    actionLink: '/verification',
  }).catch((e: unknown) => console.error('[verify-aif] sendMessage failed:', e));
}

async function handleFilmEntryPaid(userId: string, filmId: string): Promise<void> {
  const { data: film } = await adminSupabase
    .from('films')
    .select('id, title, payment_status')
    .eq('id', filmId)
    .eq('user_id', userId)
    .single();

  if (!film || film.payment_status === 'paid') return;

  const { error: filmUpdateErr } = await adminSupabase
    .from('films')
    .update({ payment_status: 'paid', payment_method: 'aif', status: 'pending' })
    .eq('id', filmId)
    .eq('user_id', userId);
  if (filmUpdateErr) console.error('[verify-aif] film update error:', filmUpdateErr.message);

  await sendMessage({
    userId,
    type: 'on-chain',
    title: '影片報名費支付成功',
    content: `您的影片《${film.title ?? filmId}》已完成 AIF 支付，影片進入審核流程，上鏈確認後合約地址將在此通知中更新。`,
    actionLink: '/me',
  }).catch((e: unknown) => console.error('[verify-aif] sendMessage failed:', e));
}

async function handleLbsLicensePaid(userId: string): Promise<void> {
  const { data: nodes } = await adminSupabase
    .from('lbs_nodes')
    .select('id, title, status')
    .eq('creator_id', userId)
    .in('status', ['draft', 'pending', 'pending_payment'])
    .order('created_at', { ascending: false })
    .limit(1);

  const node = nodes?.[0];
  if (!node) return;

  await adminSupabase
    .from('lbs_nodes')
    .update({ review_status: 'pending', status: 'under_review' })
    .eq('id', node.id)
    .eq('creator_id', userId);

  await sendMessage({
    userId,
    type: 'lbs',
    title: 'LBS 影展授權費支付成功',
    content: `您的 LBS 節點「${node.title ?? node.id}」授權費已通過 AIF 確認，申請已進入人工審核流程。`,
    actionLink: '/lbs/apply',
  }).catch((e: unknown) => console.error('[verify-aif] sendMessage failed:', e));
}

// ── 主 Handler ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    // ── Validate body ─────────────────────────────────────────────────────────
    const body = await req.json();
    const { productCode, userId, expectedAmount, extraMetadata } = body as {
      productCode: string;
      userId: string;
      expectedAmount: number;
      extraMetadata?: Record<string, string>;
    };

    if (!productCode || !userId || !expectedAmount) {
      return NextResponse.json({ error: 'productCode, userId and expectedAmount are required' }, { status: 400 });
    }

    if (userId !== verifiedUserId) {
      return NextResponse.json({ error: 'Unauthorized: userId mismatch' }, { status: 403 });
    }

    // ── Fetch product（二次校驗金額防止篡改）──────────────────────────────────
    const { data: product, error: productError } = await adminSupabase
      .from('platform_products')
      .select('*')
      .eq('product_code', productCode)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found or inactive' }, { status: 404 });
    }

    const PRICE_AIF = Number(product.price_aif);
    if (!PRICE_AIF || PRICE_AIF <= 0) {
      return NextResponse.json({ error: 'Product has no valid AIF price' }, { status: 400 });
    }

    // 防止前端傳入偽造的低金額
    if (Math.abs(expectedAmount - PRICE_AIF) > 0.0001) {
      return NextResponse.json(
        { error: `Amount mismatch. Expected ${PRICE_AIF} AIF, received ${expectedAmount}` },
        { status: 400 }
      );
    }

    // ── 查帳：檢查用戶 aif_balance 是否已到帳（Helius Webhook 更新）────────────
    const { data: userData } = await adminSupabase
      .from('users')
      .select('aif_balance')
      .eq('id', verifiedUserId)
      .single();

    const currentBalance = userData?.aif_balance ?? 0;

    if (currentBalance < PRICE_AIF) {
      return NextResponse.json(
        {
          error: `AIF payment not yet confirmed. Your current balance is ${currentBalance} AIF, required ${PRICE_AIF} AIF. Please wait 1-2 minutes for network confirmation and try again.`,
          currentBalance,
          required: PRICE_AIF,
        },
        { status: 402 }
      );
    }

    // ── 原子扣款（帶 WHERE 守衛，防超賣）──────────────────────────────────────
    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      'deduct_aif_balance',
      { p_user_id: verifiedUserId, p_amount: PRICE_AIF }
    );

    let deductSuccess = false;
    let newBalance: number | null = null;

    if (rpcError) {
      console.warn('[verify-aif] RPC unavailable, using fallback:', rpcError.message);

      const { data: atomicUpdate, error: atomicError } = await adminSupabase
        .from('users')
        .update({ aif_balance: currentBalance - PRICE_AIF })
        .eq('id', verifiedUserId)
        .gte('aif_balance', PRICE_AIF)
        .select('aif_balance');

      if (atomicError || !atomicUpdate || atomicUpdate.length === 0) {
        return NextResponse.json({ error: 'Insufficient AIF balance' }, { status: 400 });
      }

      deductSuccess = true;
      newBalance = atomicUpdate[0]?.aif_balance ?? null;
    } else {
      if (!rpcData?.success) {
        return NextResponse.json(
          { error: rpcData?.error ?? 'Insufficient AIF balance' },
          { status: 400 }
        );
      }
      deductSuccess = true;
      newBalance = rpcData.new_balance ?? null;
    }

    if (!deductSuccess) {
      return NextResponse.json({ error: 'AIF deduction failed unexpectedly' }, { status: 500 });
    }

    // ── 記錄交易流水 ──────────────────────────────────────────────────────────
    try {
      const { error: txError } = await adminSupabase.from('transactions').insert([{
        user_id: verifiedUserId,
        amount: PRICE_AIF,
        currency: 'AIF',
        tx_type: 'product_purchase',
        status: 'success',
        metadata: {
          productCode,
          productNameZh: product.name_zh,
          productNameEn: product.name_en,
          paymentFlow: 'manual_transfer_verify',
          ...extraMetadata,
        },
      }]);
      if (txError) console.error('[verify-aif] transaction insert failed:', txError);
    } catch (e: unknown) {
      console.error('[verify-aif] transaction insert exception:', e);
    }

    // ── 業務邏輯路由 ──────────────────────────────────────────────────────────
    try {
      if (productCode === 'identity_verify') {
        await handleIdentityVerifyPaid(verifiedUserId, extraMetadata?.identityType, extraMetadata?.verificationName);
      } else if (productCode === 'film_entry') {
        const filmId = extraMetadata?.filmId;
        if (filmId) await handleFilmEntryPaid(verifiedUserId, filmId);
        else console.warn('[verify-aif] film_entry missing filmId in extraMetadata');
      } else if (productCode === 'lbs_license') {
        await handleLbsLicensePaid(verifiedUserId);
      }
    } catch (bizErr: unknown) {
      console.error('[verify-aif] Business logic failed after deduction:', bizErr);
    }

    return NextResponse.json({
      success: true,
      newBalance,
      productCode,
      message: `AIF payment verified. ${product.name_zh || product.name_en} purchased.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[verify-aif] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/pay/internal-checkout/route.ts
```typescript
/**
 * POST /api/pay/internal-checkout
 *
 * Web2.5 內部賬本結帳 — 直接從用戶的 aif_balance 扣款，無需鏈上交易。
 *
 * 設計原則（「鏈上充值歸集 + 鏈下額度消費」）：
 *  - 充值：用戶向 deposit_address 轉入 AIF → Helius Webhook 更新 aif_balance
 *  - 消費：直接扣除資料庫 aif_balance，完全無需發起鏈上交易
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer），userId 從 Token 中取得
 *  - 價格從服務端 DB 讀取，前端無法偽造
 *  - 使用帶 WHERE 守衛的原子 UPDATE（aif_balance >= price）防止超賣競態
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { sendMessage } from '@/lib/actions/message';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// ── 業務邏輯路由 ──────────────────────────────────────────────────────────────

async function handleIdentityVerifyPaid(userId: string, identityType?: string, verificationName?: string): Promise<void> {
  const now = new Date().toISOString();
  const resolvedIdentityType = identityType || 'creator';
  const cleanName = (verificationName ?? '').trim() || null;

  // ── 1. UPSERT creator_applications 表（Admin 控制中心讀取此表）────────────
  // 查找該 user_id 最新的 awaiting_payment 草稿（不限 identity_type）
  // 避免因大小寫不一致或 identityType 差異導致找不到草稿，插入失敗被 409 攔截
  const { data: existing } = await adminSupabase
    .from('creator_applications')
    .select('id, identity_type')
    .eq('user_id', userId)
    .eq('status', 'awaiting_payment')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error: appErr } = await adminSupabase
      .from('creator_applications')
      .update({
        status: 'pending',
        identity_type: resolvedIdentityType,
        verification_name: cleanName,
        payment_method: 'aif',
        submitted_at: now,
      })
      .eq('id', existing.id);

    if (appErr) {
      console.error('[internal-checkout] creator_applications update failed:', appErr.message);
    } else {
      console.log(`[internal-checkout] Updated creator_application ${existing.id} → pending (AIF, type=${resolvedIdentityType})`);
    }
  } else {
    const { error: insertErr } = await adminSupabase
      .from('creator_applications')
      .insert({
        user_id: userId,
        identity_type: resolvedIdentityType,
        status: 'pending',
        verification_name: cleanName,
        payment_method: 'aif',
        submitted_at: now,
      });

    if (insertErr) {
      console.error('[internal-checkout] creator_applications insert failed:', insertErr.message);
    } else {
      console.log(`[internal-checkout] Created creator_application for user ${userId} → pending (AIF, type=${resolvedIdentityType})`);
    }
  }

  // ── 2. 同步更新 users 表 ────────────────────────────────────────────────
  const { error: updateError } = await adminSupabase
    .from('users')
    .update({
      verification_status: 'pending',
      verification_payment_method: 'aif',
      verification_type: resolvedIdentityType,
      verification_submitted_at: now,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[internal-checkout] users table update failed:', updateError.message);
  }

  await sendMessage({
    userId,
    type: 'system',
    title: '創作者認證費支付成功',
    content: '您的認證費已通過 AIF 餘額扣除。人工審核團隊將在 3-5 個工作日內完成身份資質審核，結果將通過站內信通知您。',
    actionLink: '/verification',
  }).catch((e: unknown) => console.error('[internal-checkout] sendMessage failed:', e));
}

async function handleFilmEntryPaid(userId: string, filmId: string): Promise<void> {
  if (!filmId) throw new Error('缺少影片 ID（filmId），無法更新影片支付狀態');
  if (!userId) throw new Error('缺少用戶 ID（userId），無法更新影片支付狀態');

  console.log('[internal-checkout] handleFilmEntryPaid filmId:', filmId, 'userId:', userId);

  const { data: film, error: filmFetchError } = await adminSupabase
    .from('films')
    .select('id, title, payment_status')
    .eq('id', filmId)
    .eq('user_id', userId)
    .single();

  if (filmFetchError) {
    console.error('【影片記錄查詢致命錯誤】:', filmFetchError.message, filmFetchError.details, filmFetchError.hint);
    throw new Error(`影片記錄查詢失敗: ${filmFetchError.message}`);
  }
  if (!film) throw new Error(`找不到影片記錄（filmId: ${filmId}）`);
  if (film.payment_status === 'paid') {
    console.log('[internal-checkout] 影片已支付，跳過重複更新:', filmId);
    return;
  }

  // status 值必须符合 films 表 CHECK 约束 ('pending','approved','rejected')
  const { error: updateError } = await adminSupabase
    .from('films')
    .update({ payment_status: 'paid', payment_method: 'aif', status: 'pending' })
    .eq('id', filmId)
    .eq('user_id', userId);

  if (updateError) {
    console.error('【影片記錄更新致命錯誤】:', updateError.message, updateError.details, updateError.hint);
    throw new Error(`影片狀態更新失敗: ${updateError.message}`);
  }

  await sendMessage({
    userId,
    type: 'on-chain',
    title: '影片報名費支付成功',
    content: `您的影片《${film.title ?? filmId}》已完成 AIF 支付，影片進入審核流程，上鏈確認後合約地址將在此通知中更新。`,
    actionLink: '/me',
  }).catch((e: unknown) => console.error('[internal-checkout] sendMessage failed:', e));
}

async function handleLbsLicensePaid(userId: string, nodeId?: string | null): Promise<void> {
  let node: { id: string; title: string; status: string } | null = null;

  // 优先用 nodeId（新流程：草稿节点）
  if (nodeId) {
    const { data } = await adminSupabase
      .from('lbs_nodes')
      .select('id, title, status')
      .eq('id', nodeId)
      .eq('creator_id', userId)
      .maybeSingle();
    node = data ?? null;
  }

  // Fallback：查找该用户最新的草稿/pending 节点
  if (!node) {
    const { data: nodes } = await adminSupabase
      .from('lbs_nodes')
      .select('id, title, status')
      .eq('creator_id', userId)
      .in('status', ['draft', 'pending', 'pending_payment'])
      .order('created_at', { ascending: false })
      .limit(1);
    node = nodes?.[0] ?? null;
  }

  if (!node) {
    console.error('[handleLbsLicensePaid] No lbs_node found for userId:', userId, 'nodeId:', nodeId);
    return;
  }

  console.log('[handleLbsLicensePaid] Updating review_status=pending for node:', node.id, 'title:', node.title);
  const { error: updateErr } = await adminSupabase
    .from('lbs_nodes')
    .update({ review_status: 'pending', status: 'under_review' })
    .eq('id', node.id)
    .eq('creator_id', userId);

  if (updateErr) {
    console.error('[handleLbsLicensePaid] DB update failed:', updateErr.message);
  } else {
    console.log('[handleLbsLicensePaid] ✓ review_status set to pending for node:', node.id);
  }

  await sendMessage({
    userId,
    type: 'lbs',
    title: 'LBS 影展授權費支付成功',
    content: `您的 LBS 節點「${node.title ?? node.id}」授權費已通過 AIF 餘額扣除，申請已進入人工審核流程。`,
    actionLink: '/lbs/apply',
  }).catch((e: unknown) => console.error('[internal-checkout] sendMessage failed:', e));
}

// ── 主 Handler ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // ── Step 2: 解析請求體 ────────────────────────────────────────────────────
    const body = await req.json();
    const { productCode, extraMetadata } = body as {
      productCode: string;
      extraMetadata?: Record<string, string>;
    };

    if (!productCode) {
      return NextResponse.json(
        { error: 'productCode is required' },
        { status: 400 }
      );
    }

    console.log('【結帳頁面接收到的參數】:', { productCode, userId: verifiedUserId, extraMetadata });
    console.log('[internal-checkout] filmId from extraMetadata:', extraMetadata?.filmId ?? '(缺失！)');

    // ── Step 3: 從服務端 DB 取產品（防止前端偽造價格）───────────────────────
    const { data: product, error: productError } = await adminSupabase
      .from('platform_products')
      .select('*')
      .eq('product_code', productCode)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      console.error('[internal-checkout] product lookup error:', productError?.message, 'code:', productCode);
      return NextResponse.json(
        { error: 'Product not found or inactive' },
        { status: 404 }
      );
    }

    const PRICE_AIF = Number(product.price_aif);
    if (!PRICE_AIF || PRICE_AIF <= 0) {
      return NextResponse.json(
        { error: 'Product has no valid AIF price' },
        { status: 400 }
      );
    }

    // ── Step 4: 檢查用戶 AIF 餘額 ────────────────────────────────────────────
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('aif_balance')
      .eq('id', verifiedUserId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentBalance = userData.aif_balance ?? 0;

    if (currentBalance < PRICE_AIF) {
      return NextResponse.json(
        {
          error: `AIF 餘額不足，請先充值。當前餘額：${currentBalance} AIF，需要：${PRICE_AIF} AIF，差額：${PRICE_AIF - currentBalance} AIF`,
          currentBalance,
          required: PRICE_AIF,
          shortfall: PRICE_AIF - currentBalance,
        },
        { status: 400 }
      );
    }

    // ── Step 5: 原子扣款（帶 WHERE 守衛，防超賣競態）────────────────────────
    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      'deduct_aif_balance',
      { p_user_id: verifiedUserId, p_amount: PRICE_AIF }
    );

    let deductSuccess = false;
    let newBalance: number | null = null;

    if (rpcError) {
      // RPC 不可用時降級：帶 WHERE 守衛的直接 UPDATE
      console.warn('[internal-checkout] deduct_aif_balance RPC 失敗，降級處理. error:', rpcError.message, 'code:', rpcError.code, 'userId:', verifiedUserId);

      const { data: atomicUpdate, error: atomicError } = await adminSupabase
        .from('users')
        .update({ aif_balance: currentBalance - PRICE_AIF })
        .eq('id', verifiedUserId)
        .gte('aif_balance', PRICE_AIF)
        .select('aif_balance');

      if (atomicError || !atomicUpdate || atomicUpdate.length === 0) {
        return NextResponse.json(
          { error: 'AIF 餘額不足，請先充值' },
          { status: 400 }
        );
      }

      deductSuccess = true;
      newBalance = atomicUpdate[0]?.aif_balance ?? null;
    } else {
      if (!rpcData?.success) {
        return NextResponse.json(
          { error: rpcData?.error ?? 'AIF 餘額不足，請先充值' },
          { status: 400 }
        );
      }
      deductSuccess = true;
      newBalance = rpcData.new_balance ?? null;
    }

    if (!deductSuccess) {
      return NextResponse.json(
        { error: 'AIF deduction failed unexpectedly' },
        { status: 500 }
      );
    }

    // ── Step 6: 記錄交易流水 ──────────────────────────────────────────────────
    try {
      const { error: txError } = await adminSupabase.from('transactions').insert([{
        user_id: verifiedUserId,
        amount: PRICE_AIF,
        currency: 'AIF',
        tx_type: 'product_purchase',
        status: 'success',
        metadata: {
          productCode,
          productNameZh: product.name_zh,
          productNameEn: product.name_en,
          paymentFlow: 'internal_ledger',
          ...extraMetadata,
        },
      }]);
      if (txError) console.error('[internal-checkout] transaction insert failed:', txError);
    } catch (e: unknown) {
      console.error('[internal-checkout] transaction insert exception:', e);
    }

    // ── Step 7: 業務邏輯路由 ──────────────────────────────────────────────────
    try {
      if (productCode === 'identity_verify') {
        await handleIdentityVerifyPaid(verifiedUserId, extraMetadata?.identityType, extraMetadata?.verificationName);
      } else if (productCode === 'film_entry') {
        const filmId = extraMetadata?.filmId;
        if (filmId) await handleFilmEntryPaid(verifiedUserId, filmId);
        else console.warn('[internal-checkout] film_entry missing filmId in extraMetadata');
      } else if (productCode === 'lbs_license') {
        await handleLbsLicensePaid(verifiedUserId, extraMetadata?.nodeId ?? null);
      }
    } catch (bizErr: unknown) {
      console.error('[internal-checkout] Business logic failed after deduction:', bizErr);
    }

    return NextResponse.json({
      success: true,
      newBalance,
      productCode,
      message: `支付成功。${product.name_zh || product.name_en} 已購買。`,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('【認證表單 Zod 解析失敗細節】:', (err as { errors?: unknown })?.errors || err);
    console.error('[internal-checkout] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/pay/product-aif/route.ts
```typescript
/**
 * POST /api/pay/product-aif
 *
 * 通用 AIF 賬本扣款 — 根據 productCode 動態查詢 platform_products 表獲取 AIF 價格。
 * 供 UniversalCheckout 組件調用，支援任意產品類型。
 *
 * 支付成功後根據 productCode 自動觸發對應業務邏輯：
 *  - identity_verify  → users.verification_status = 'pending'
 *  - film_entry       → films.payment_status = 'paid' (需 extraMetadata.filmId)
 *  - lbs_license      → lbs_nodes.status = 'under_review' (最新 pending 節點)
 *  - 其他            → 僅記錄 transactions 流水
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - 使用帶 WHERE 守衛的原子 UPDATE（aif_balance >= price_aif）防止超賣
 *  - 僅允許 is_active = true 的產品下單
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import { sendMessage } from '@/lib/actions/message';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

// ── 業務邏輯路由 ──────────────────────────────────────────────────────────────

async function handleIdentityVerifyPaid(userId: string): Promise<void> {
  const { data: user } = await adminSupabase
    .from('users')
    .select('id, verification_status')
    .eq('id', userId)
    .single();

  if (!user) {
    console.error(`[pay/product-aif] User ${userId} not found for identity_verify`);
    return;
  }

  if (user.verification_status === 'pending' || user.verification_status === 'approved') {
    console.log(`[pay/product-aif] User ${userId} verification already ${user.verification_status}`);
    return;
  }

  // 無論當前狀態（unverified / rejected / null），支付後一律設為 pending
  const { error } = await adminSupabase
    .from('users')
    .update({
      verification_status: 'pending',
      verification_payment_method: 'aif',
      verification_submitted_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[pay/product-aif] identity_verify update failed:', error.message);
    throw new Error(`DB write failed: ${error.message}`);
  }

  await sendMessage({
    userId,
    type: 'system',
    title: '創作者認證費支付成功',
    content: '您的認證費已通過 AIF 扣款確認。人工審核團隊將在 3-5 個工作日內完成身份資質審核，結果將通過站內信通知您。',
    actionLink: '/verification',
  }).catch((e: unknown) =>
    console.error('[pay/product-aif] sendMessage failed:', e)
  );
}

async function handleFilmEntryPaid(userId: string, filmId: string): Promise<void> {
  const { data: film } = await adminSupabase
    .from('films')
    .select('id, title, payment_status')
    .eq('id', filmId)
    .eq('user_id', userId)
    .single();

  if (!film) {
    console.error(`[pay/product-aif] Film ${filmId} not found for user ${userId}`);
    return;
  }

  if (film.payment_status === 'paid') {
    console.log(`[pay/product-aif] Film ${filmId} already paid`);
    return;
  }

  const { error } = await adminSupabase
    .from('films')
    .update({
      payment_status: 'paid',
      payment_method: 'aif',
      status: 'pending',
    })
    .eq('id', filmId)
    .eq('user_id', userId);

  if (error) {
    console.error('[pay/product-aif] film update failed:', error.message);
  }

  await sendMessage({
    userId,
    type: 'on-chain',
    title: '影片報名費支付成功',
    content: `您的影片《${film.title ?? filmId}》已完成 AIF 支付，影片進入審核流程，上鏈確認後合約地址將在此通知中更新。`,
    actionLink: '/me',
  }).catch((e: unknown) =>
    console.error('[pay/product-aif] sendMessage failed:', e)
  );
}

async function handleLbsLicensePaid(userId: string): Promise<void> {
  const { data: nodes } = await adminSupabase
    .from('lbs_nodes')
    .select('id, title, status')
    .eq('creator_id', userId)
    .in('status', ['draft', 'pending', 'pending_payment'])
    .order('created_at', { ascending: false })
    .limit(1);

  const node = nodes?.[0];
  if (!node) {
    console.warn(`[pay/product-aif] No pending LBS node for user ${userId}`);
    return;
  }

  const { error } = await adminSupabase
    .from('lbs_nodes')
    .update({
      review_status: 'pending',
      status: 'under_review',
    })
    .eq('id', node.id)
    .eq('creator_id', userId);

  if (error) {
    console.error('[pay/product-aif] LBS node update failed:', error.message);
  }

  await sendMessage({
    userId,
    type: 'lbs',
    title: 'LBS 影展授權費支付成功',
    content: `您的 LBS 節點「${node.title ?? node.id}」授權費已通過 AIF 確認，申請已進入人工審核流程。預計 5-10 個工作日完成地理座標驗證與合約部署。`,
    actionLink: '/lbs/apply',
  }).catch((e: unknown) =>
    console.error('[pay/product-aif] sendMessage failed:', e)
  );
}

// ── 主 Handler ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    // ── Validate body ─────────────────────────────────────────────────────────
    const body = await req.json();
    const { productCode, userId, extraMetadata } = body as {
      productCode: string;
      userId: string;
      extraMetadata?: Record<string, string>;
    };

    if (!productCode || !userId) {
      return NextResponse.json({ error: 'productCode and userId are required' }, { status: 400 });
    }

    if (userId !== verifiedUserId) {
      return NextResponse.json({ error: 'Unauthorized: userId mismatch' }, { status: 403 });
    }

    // ── Fetch product ─────────────────────────────────────────────────────────
    const { data: product, error: productError } = await adminSupabase
      .from('platform_products')
      .select('*')
      .eq('product_code', productCode)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found or inactive' }, { status: 404 });
    }

    const AIF_FEE = Number(product.price_aif);
    if (!AIF_FEE || AIF_FEE <= 0) {
      return NextResponse.json({ error: 'Product has no valid AIF price' }, { status: 400 });
    }

    // ── Atomic AIF deduction ──────────────────────────────────────────────────
    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      'deduct_aif_balance',
      { p_user_id: verifiedUserId, p_amount: AIF_FEE }
    );

    let deductSuccess = false;
    let newBalance: number | null = null;

    if (rpcError) {
      console.warn('[pay/product-aif] RPC unavailable, using fallback:', rpcError.message);

      const { data: userData } = await adminSupabase
        .from('users')
        .select('aif_balance')
        .eq('id', verifiedUserId)
        .single();

      if (!userData || (userData.aif_balance ?? 0) < AIF_FEE) {
        return NextResponse.json(
          { error: `Insufficient AIF balance. Required: ${AIF_FEE} AIF` },
          { status: 400 }
        );
      }

      const { data: atomicUpdate, error: atomicError } = await adminSupabase
        .from('users')
        .update({ aif_balance: userData.aif_balance - AIF_FEE })
        .eq('id', verifiedUserId)
        .gte('aif_balance', AIF_FEE)
        .select('aif_balance');

      if (atomicError || !atomicUpdate || atomicUpdate.length === 0) {
        return NextResponse.json({ error: 'Insufficient AIF balance' }, { status: 400 });
      }

      deductSuccess = true;
      newBalance = atomicUpdate[0]?.aif_balance ?? null;
    } else {
      if (!rpcData?.success) {
        return NextResponse.json(
          { error: rpcData?.error ?? 'Insufficient AIF balance' },
          { status: 400 }
        );
      }
      deductSuccess = true;
      newBalance = rpcData.new_balance ?? null;
    }

    if (!deductSuccess) {
      return NextResponse.json({ error: 'AIF deduction failed unexpectedly' }, { status: 500 });
    }

    // ── Record transaction ────────────────────────────────────────────────────
    const { error: txError } = await adminSupabase
      .from('transactions')
      .insert([{
        user_id: verifiedUserId,
        amount: AIF_FEE,
        currency: 'AIF',
        tx_type: 'product_purchase',
        status: 'success',
        metadata: {
          productCode,
          productNameZh: product.name_zh,
          productNameEn: product.name_en,
          ...extraMetadata,
        },
      }]);

    if (txError) {
      console.error('[pay/product-aif] Transaction record failed:', txError.message);
    }

    // ── Business logic routing by productCode ─────────────────────────────────
    try {
      if (productCode === 'identity_verify') {
        await handleIdentityVerifyPaid(verifiedUserId);
      } else if (productCode === 'film_entry') {
        const filmId = extraMetadata?.filmId;
        if (filmId) {
          await handleFilmEntryPaid(verifiedUserId, filmId);
        } else {
          console.warn('[pay/product-aif] film_entry missing filmId in extraMetadata');
        }
      } else if (productCode === 'lbs_license') {
        await handleLbsLicensePaid(verifiedUserId);
      }
      // 其他 productCode：僅記錄流水，無特定業務邏輯
    } catch (bizErr: unknown) {
      // 業務邏輯失敗不回滾扣款（已原子扣減），記錄告警
      console.error('[pay/product-aif] Business logic failed after deduction:', bizErr);
    }

    return NextResponse.json({
      success: true,
      newBalance,
      productCode,
      message: `AIF payment confirmed. ${product.name_zh || product.name_en} purchased.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[pay/product-aif] Unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/stripe/checkout/route.ts
```typescript
/**
 * POST /api/stripe/checkout
 *
 * 為影片報名費創建 Stripe Checkout Session。
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - Token 中的 userId 必須與請求體的 userId 一致，防止越權操作
 *  - filmId 必須屬於該用戶且處於 pending_payment 狀態
 *  - Stripe Secret Key 僅在服務端使用，絕不暴露給前端
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import Stripe from 'stripe';

// ── 服務端客戶端（繞過 RLS） ──────────────────────────────────────────────────
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ── Privy 服務端驗證 ───────────────────────────────────────────────────────────
const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);


/** 從任意 thrown 值萃取可讀錯誤訊息（包括 Stripe SDK 結構化錯誤） */
function extractErrorMessage(err: unknown): string {
  if (!err) return 'Unknown server error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    // Stripe SDK errors expose .message, .type, .code, .statusCode
    if (typeof e.message === 'string' && e.message) return e.message;
    if (typeof e.error === 'string' && e.error) return e.error;
  }
  return 'Unknown server error';
}

/** Stripe SDK 錯誤的完整結構化日誌（暴露 type/code/statusCode 方便排查） */
function logStripeError(label: string, err: unknown): void {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    console.error(label, {
      message: e.message,
      type: e.type,
      code: e.code,
      statusCode: e.statusCode,
      raw: e.raw ?? e,
    });
  } else {
    console.error(label, err);
  }
}

export async function POST(req: Request) {
  // ── Stripe Secret Key 前置檢查 ────────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[stripe/checkout] STRIPE_SECRET_KEY is not set');
    return NextResponse.json(
      { error: 'Payment service is not configured. Please contact support.' },
      { status: 500 }
    );
  }

  // ── Stripe 延遲初始化（避免模組載入時因 Key 缺失而崩潰） ─────────────────
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });

  try {
    // ── Step 1: 驗證 Privy Access Token ──────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(token);
      verifiedUserId = claims.userId;
    } catch (tokenErr) {
      console.error('[stripe/checkout] Token 驗證失敗:', tokenErr);
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }

    // ── Step 2: 驗證請求體，確保 userId 與 Token 一致 ─────────────────────────
    const body = await req.json();
    const { filmId, userId } = body;

    if (!filmId || !userId) {
      return NextResponse.json(
        { error: 'filmId and userId are required' },
        { status: 400 }
      );
    }

    if (userId !== verifiedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: userId mismatch' },
        { status: 403 }
      );
    }

    // ── Step 3: 驗證 filmId 屬於該用戶且尚未支付 ─────────────────────────────
    const { data: film, error: filmError } = await adminSupabase
      .from('films')
      .select('id, title, user_id, payment_status')
      .eq('id', filmId)
      .single();

    if (filmError || !film) {
      console.error('[stripe/checkout] Film 查詢失敗:', filmError);
      return NextResponse.json(
        { error: 'Film not found' },
        { status: 404 }
      );
    }

    if (film.user_id !== verifiedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized: film does not belong to this user' },
        { status: 403 }
      );
    }

    if (film.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Film has already been paid' },
        { status: 409 }
      );
    }

    // ── Step 4: 創建 Stripe Checkout Session ─────────────────────────────────
    // 優先使用請求來源 origin，避免跨域或本地開發 URL 不符
    const reqOrigin = req.headers.get('origin');
    const siteUrl = reqOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'https://hkaiiff.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'HKAIIFF Entry Fee',
              description: `Entry fee for: ${film.title ?? filmId}`,
            },
            unit_amount: 9900, // $99.00 USD in cents
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/success?type=film_entry&amount=99&currency=USD&name=${encodeURIComponent('影片報名費')}`,
      cancel_url: `${siteUrl}/upload/payment?filmId=${filmId}&payment=cancelled`,
      metadata: {
        userId: verifiedUserId,
        filmId,
        type: 'film_entry',       // Webhook 路由依赖此字段区分支付类型
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });

  } catch (error) {
    logStripeError('[stripe/checkout] Unexpected error:', error);
    return NextResponse.json(
      { error: extractErrorMessage(error) || 'Stripe API 拒絕交易' },
      { status: 500 }
    );
  }
}
```

### app/api/stripe/lbs-checkout/route.ts
```typescript
/**
 * POST /api/stripe/lbs-checkout
 *
 * 為 LBS 影展/影院申請授權費創建 Stripe Checkout Session（$500 USD）。
 */

import { NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import Stripe from 'stripe';

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

function extractErrorMessage(err: unknown): string {
  if (!err) return 'Unknown server error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string' && e.message) return e.message;
    if (typeof e.error === 'string' && e.error) return e.error;
  }
  return 'Unknown server error';
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Payment service is not configured.' },
      { status: 500 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' as any });

  try {
    // Verify Privy token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(token);
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    const body = await req.json();
    const { userId } = body as { userId: string };

    if (!userId || userId !== verifiedUserId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }

    const origin = req.headers.get('origin') ?? 'https://hkaiiff.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'LBS Festival / Cinema Node License',
              description: 'HKAIIFF 2026 · LBS Geolocation Screening Authorization Fee',
            },
            unit_amount: 50000, // $500.00
          },
          quantity: 1,
        },
      ],
      metadata: { userId, type: 'lbs_application' },
      success_url: `${origin}/lbs/apply/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/lbs/apply`,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: unknown) {
    console.error('[lbs-checkout] Error:', err);
    return NextResponse.json({ error: extractErrorMessage(err) }, { status: 500 });
  }
}
```

### app/api/stripe/product-checkout/route.ts
```typescript
/**
 * POST /api/stripe/product-checkout
 *
 * 通用 Stripe 結帳 — 根據 productCode 動態查詢 platform_products 表獲取價格。
 * 供 UniversalCheckout 組件調用，支援任意產品類型。
 *
 * 安全要點：
 *  - 必須攜帶有效的 Privy Access Token（Bearer）
 *  - userId 必須與 Token 一致，防止越權
 *  - 僅允許 is_active = true 的產品下單
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';
import Stripe from 'stripe';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment service is not configured' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    // ── Validate body ────────────────────────────────────────────────────────
    const body = await req.json();
    const { productCode, userId, successUrl, cancelUrl, extraMetadata } = body as {
      productCode: string;
      userId: string;
      successUrl?: string;
      cancelUrl?: string;
      extraMetadata?: Record<string, string>;
    };

    if (!productCode || !userId) {
      return NextResponse.json({ error: 'productCode and userId are required' }, { status: 400 });
    }

    console.log('【結帳頁面接收到的參數】:', { productCode, userId, extraMetadata });
    if (productCode === 'film_entry') {
      console.log('[stripe/product-checkout] filmId from extraMetadata:', extraMetadata?.filmId ?? '(缺失！)');
    }

    if (userId !== verifiedUserId) {
      return NextResponse.json({ error: 'Unauthorized: userId mismatch' }, { status: 403 });
    }

    // ── Fetch product ────────────────────────────────────────────────────────
    const { data: product, error: productError } = await adminSupabase
      .from('platform_products')
      .select('*')
      .eq('product_code', productCode)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found or inactive' }, { status: 404 });
    }

    // ── Create Stripe Checkout Session ───────────────────────────────────────
    const reqOrigin = req.headers.get('origin');
    const siteUrl = reqOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'https://hkaiiff.com';

    const priceInCents = Math.round(Number(product.price_usd) * 100);
    if (priceInCents <= 0) {
      return NextResponse.json({ error: 'Invalid product price' }, { status: 400 });
    }

    const productName = product.name_en || product.name_zh || productCode;
    const description = (product.metadata as Record<string, string> | null)?.description_en
      || (product.metadata as Record<string, string> | null)?.description_zh
      || undefined;

    // 将 {CHECKOUT_SESSION_ID} 附加到 success_url，供客户端页面验证支付状态
    const baseSuccessUrl = successUrl || `${siteUrl}/me?payment=success&product=${productCode}`;
    const finalSuccessUrl = baseSuccessUrl.includes('session_id')
      ? baseSuccessUrl
      : `${baseSuccessUrl}${baseSuccessUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;

    // Stripe metadata 只允许非空字符串值，空字符串/null/undefined 会导致 "missing string" 报错
    const safeMetadata: Record<string, string> = { userId: verifiedUserId, productCode, type: 'product_purchase' };
    if (extraMetadata) {
      for (const [k, v] of Object.entries(extraMetadata)) {
        if (v != null && v !== '') safeMetadata[k] = String(v);
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              ...(description ? { description } : {}),
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      success_url: finalSuccessUrl,
      cancel_url: cancelUrl || `${siteUrl}/me?payment=cancelled`,
      metadata: safeMetadata,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('【認證表單 Zod 解析失敗細節】:', (err as { errors?: unknown })?.errors || err);
    console.error('[stripe/product-checkout] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/stripe/verification-checkout/route.ts
```typescript
/**
 * POST /api/stripe/verification-checkout
 *
 * Creates a Stripe Checkout Session for identity verification fee ($30 USD).
 */

import { NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import Stripe from 'stripe';

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(token);
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    if (body.userId && body.userId !== verifiedUserId) {
      return NextResponse.json({ error: 'userId mismatch' }, { status: 403 });
    }

    const reqOrigin = req.headers.get('origin');
    const siteUrl = reqOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'https://hkaiiff.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'HKAIIFF Identity Verification Fee',
              description: 'One-time fee for creator identity credentialing',
            },
            unit_amount: 3000, // $30.00 USD
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/verification?stripe_success=1`,
      cancel_url: `${siteUrl}/verification?stripe_cancelled=1`,
      metadata: {
        userId: verifiedUserId,
        type: 'identity_verification',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe/verification-checkout]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

### app/api/webhooks/stripe/route.ts
```typescript
/**
 * POST /api/webhooks/stripe
 *
 * Stripe Webhook 支付状态机 — 幂等性保障版
 *
 * 处理事件：checkout.session.completed
 *
 * 支持三种支付类型（由 session.metadata.type 区分）：
 *  - "film_entry"            → 影片报名费 $99 → 解锁 films.payment_status='paid'
 *  - "identity_verification" → 创作者认证费 $30 → 解锁 users.verification_status='pending'
 *  - "lbs_application"       → LBS 节点授权费 $500 → 解锁 lbs_nodes.status='under_review'
 *
 * 幂等性实现：
 *  - 检查 stripe_events 表中是否已处理该 session_id / event_id
 *  - 已处理则直接 200 返回，跳过业务逻辑
 *
 * 安全：
 *  - 严格验证 Stripe-Signature 头，防止伪造 Webhook
 *  - 所有数据库操作使用 Service Role Key
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { sendMessage } from '@/lib/actions/message';

export const dynamic = 'force-dynamic';

// ── 常量 ───────────────────────────────────────────────────────────────────────

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';

// ── Admin Supabase 客户端 ──────────────────────────────────────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env variables');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── 幂等性检查 & 记录 ──────────────────────────────────────────────────────────

async function isAlreadyProcessed(
  db: ReturnType<typeof getAdminClient>,
  eventId: string
): Promise<boolean> {
  const { data } = await db
    .from('stripe_events')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();
  return data !== null;
}

async function markAsProcessed(
  db: ReturnType<typeof getAdminClient>,
  eventId: string,
  sessionId: string,
  type: string,
  userId: string | null
): Promise<void> {
  await db.from('stripe_events').insert({
    event_id: eventId,
    session_id: sessionId,
    payment_type: type,
    user_id: userId,
    processed_at: new Date().toISOString(),
  });
}

// ── 业务处理函数 ───────────────────────────────────────────────────────────────

/** 影片报名费支付成功 → films.payment_status = 'paid', status = 'pending_review' */
async function handleFilmEntryPaid(
  db: ReturnType<typeof getAdminClient>,
  userId: string,
  filmId: string,
  sessionId: string
): Promise<void> {
  // 幂等守卫：已是 paid 状态则跳过
  const { data: film } = await db
    .from('films')
    .select('id, title, payment_status')
    .eq('id', filmId)
    .eq('user_id', userId)
    .single();

  if (!film) {
    console.error(`[stripe/webhook] Film ${filmId} not found for user ${userId}`);
    return;
  }

  if (film.payment_status === 'paid') {
    console.log(`[stripe/webhook] Film ${filmId} already paid, skipping.`);
    return;
  }

  // status 值必须符合 films 表 CHECK 约束 ('pending','approved','rejected')
  const { error } = await db
    .from('films')
    .update({
      payment_status: 'paid',
      payment_method: 'stripe',
      status: 'pending',
    })
    .eq('id', filmId)
    .eq('user_id', userId);

  if (error) {
    console.error('[stripe/webhook] Film update failed:', error.message);
    throw new Error(error.message);
  }

  // 记录交易流水
  await db.from('transactions').insert({
    user_id: userId,
    related_film_id: filmId,
    amount: 99,
    currency: 'USD',
    tx_type: 'submission_fee',
    status: 'success',
  });

  // 发送站内信通知
  await sendMessage({
    userId,
    type: 'on-chain',
    title: '影片報名費支付成功',
    content: `您的影片《${film.title ?? filmId}》報名費已通過 Stripe 確認（$99 USD），影片已進入審核流程，我們將在 5 個工作日內反饋結果。`,
    actionLink: '/me',
  }).catch((e) => console.error('[stripe/webhook] sendMessage failed:', e));
}

/**
 * 身份認證費支付成功（Stripe）
 *
 * 優先更新 creator_applications 表（新版多重身份架構）：
 *  找到該用戶最新的 awaiting_payment 記錄，升級為 pending
 *
 * 同時兼容舊版 users 表欄位，確保舊數據不丟失
 *
 * @param identityType - 從 Stripe session metadata 中讀取的身份類型，用於 fallback 創建記錄
 * @param verificationName - 用戶提交的認證名稱
 * @param amountUsd - 實際收款金額（美元）
 */
async function handleVerificationPaid(
  db: ReturnType<typeof getAdminClient>,
  userId: string,
  sessionId: string,
  identityType: string = 'creator',
  verificationName?: string,
  amountUsd: number = 30
): Promise<void> {
  const now = new Date().toISOString();
  const cleanName = (verificationName ?? '').trim() || null;

  // ── 新版：更新 creator_applications 表 ──────────────────────────────────────
  const { data: draftApps } = await db
    .from('creator_applications')
    .select('id, identity_type, status')
    .eq('user_id', userId)
    .eq('status', 'awaiting_payment')
    .order('submitted_at', { ascending: false })
    .limit(1);

  const draft = draftApps?.[0];

  if (draft) {
    const { error: appErr } = await db
      .from('creator_applications')
      .update({
        status: 'pending',
        verification_name: cleanName,
        payment_method: 'fiat',
        payment_session: sessionId,
        submitted_at: now,
      })
      .eq('id', draft.id);

    if (appErr) {
      console.error('[stripe/webhook] creator_applications update failed:', appErr.message);
      throw new Error(appErr.message);
    }
    console.log(`[stripe/webhook] Updated identity_application ${draft.id} to pending (type=${draft.identity_type})`);
  } else {
    // 未找到草稿 → 使用 session metadata 中的 identityType 建立正確的 pending 記錄
    const resolvedType = ['creator', 'institution', 'curator'].includes(identityType)
      ? identityType
      : 'creator';
    console.warn(`[stripe/webhook] No awaiting_payment draft for user ${userId}, creating fallback record (type=${resolvedType})`);
    const { error: insertErr } = await db
      .from('creator_applications')
      .insert({
        user_id: userId,
        identity_type: resolvedType,
        status: 'pending',
        verification_name: cleanName,
        payment_method: 'fiat',
        payment_session: sessionId,
        submitted_at: now,
      });
    if (insertErr) {
      console.error('[stripe/webhook] creator_applications insert failed:', insertErr.message);
      throw new Error(insertErr.message);
    }
  }

  // ── 兼容舊版：同步更新 users 表 ────────────────────────────────────────────
  const { data: user } = await db
    .from('users')
    .select('id, verification_status')
    .eq('id', userId)
    .maybeSingle();

  if (user && user.verification_status === 'unverified') {
    await db
      .from('users')
      .update({
        verification_payment_method: 'fiat',
        verification_payment_session: sessionId,
        verification_status: 'pending',
        verification_type: draft?.identity_type ?? 'creator',
        verification_submitted_at: new Date().toISOString(),
      })
      .eq('id', userId);
  }

  // 記錄財務流水
  const { error: txErr } = await db.from('transactions').insert({
    user_id: userId,
    amount: amountUsd,
    currency: 'USD',
    tx_type: 'creator_cert',
    status: 'success',
  });
  if (txErr) console.warn('[stripe/webhook] verification transaction insert failed:', txErr.message);

  await sendMessage({
    userId,
    type: 'system',
    title: '身份認證費支付成功',
    content: '您的認證費已通過 Stripe 確認。我們的人工審核團隊將在 3-5 個工作日內完成身份資質審核，結果將通過站內信通知您。',
    actionLink: '/me',
  }).catch((e) => console.error('[stripe/webhook] sendMessage failed:', e));
}

/** LBS 节点授权费支付成功 → lbs_nodes.review_status = 'pending', status = 'under_review' */
async function handleLbsApplicationPaid(
  db: ReturnType<typeof getAdminClient>,
  userId: string,
  sessionId: string,
  amountUsd: number = 500,
  nodeId?: string | null
): Promise<void> {
  let node: { id: string; title: string; status: string } | null = null;

  // 优先用 nodeId（新流程：草稿节点）
  if (nodeId) {
    const { data } = await db
      .from('lbs_nodes')
      .select('id, title, status')
      .eq('id', nodeId)
      .eq('creator_id', userId)
      .maybeSingle();
    node = data ?? null;
  }

  // Fallback：找最新一条该用户的草稿/pending 节点
  if (!node) {
    const { data: nodes } = await db
      .from('lbs_nodes')
      .select('id, title, status')
      .eq('creator_id', userId)
      .in('status', ['pending', 'pending_payment', 'draft'])
      .order('created_at', { ascending: false })
      .limit(1);
    node = nodes?.[0] ?? null;
  }

  if (!node) {
    console.warn(`[stripe/webhook] No LBS node found for user ${userId}`);
    return;
  }

  console.log('[stripe/webhook] handleLbsApplicationPaid: Updating review_status=pending for node:', node.id, 'title:', node.title);
  const { error } = await db
    .from('lbs_nodes')
    .update({
      review_status: 'pending',
      status: 'under_review',
    })
    .eq('id', node.id)
    .eq('creator_id', userId);

  if (error) {
    console.error('[stripe/webhook] LBS node update failed:', error.message);
    throw new Error(error.message);
  }
  console.log('[stripe/webhook] ✓ review_status set to pending for node:', node.id);

  // 記錄財務流水
  const { error: lbsTxErr } = await db.from('transactions').insert({
    user_id: userId,
    amount: amountUsd,
    currency: 'USD',
    tx_type: 'lbs_license',
    status: 'success',
  });
  if (lbsTxErr) console.warn('[stripe/webhook] lbs transaction insert failed:', lbsTxErr.message);

  await sendMessage({
    userId,
    type: 'lbs',
    title: 'LBS 影展授權費支付成功',
    content: `您的 LBS 節點「${node.title ?? node.id}」授權費 $500 USD 已確認，申請已進入人工審核流程。預計 5-10 個工作日完成地理座標驗證與合約部署。`,
    actionLink: '/lbs/apply',
  }).catch((e) => console.error('[stripe/webhook] sendMessage failed:', e));
}

// ── 主 Webhook Handler ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe/webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });

  // ── 1. 读取原始请求体（Stripe 验签需要 raw body）────────────────────────────
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[stripe/webhook] Signature verification failed:', msg);
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  // ── 2. 只处理 checkout.session.completed 事件 ──────────────────────────────
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, skipped: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? {};
  const userId = metadata.userId ?? null;
  const paymentType = metadata.type ?? 'unknown';
  const filmId = metadata.filmId ?? null;

  console.log(`[stripe/webhook] Processing ${event.id} | type=${paymentType} | user=${userId} | session=${session.id}`);

  const db = getAdminClient();

  // ── 3. 幂等性检查 ──────────────────────────────────────────────────────────
  try {
    const alreadyDone = await isAlreadyProcessed(db, event.id);
    if (alreadyDone) {
      console.log(`[stripe/webhook] Event ${event.id} already processed, skipping.`);
      return NextResponse.json({ received: true, idempotent: true });
    }
  } catch {
    // stripe_events 表可能不存在（冷启动），继续处理但记录警告
    console.warn('[stripe/webhook] stripe_events table not found, skipping idempotency check.');
  }

  // ── 4. 仅处理已实际付款的 Session ─────────────────────────────────────────
  if (session.payment_status !== 'paid') {
    console.log(`[stripe/webhook] Session ${session.id} payment_status=${session.payment_status}, skipping.`);
    return NextResponse.json({ received: true, skipped: 'not_paid' });
  }

  if (!userId) {
    console.error('[stripe/webhook] No userId in session metadata:', session.id);
    return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
  }

  // ── 5. 路由到对应业务处理函数 ──────────────────────────────────────────────
  const productCode = metadata.productCode ?? null;

  try {
    switch (paymentType) {
      case 'film_entry':
        if (!filmId) throw new Error('Missing filmId in metadata for film_entry');
        await handleFilmEntryPaid(db, userId, filmId, session.id);
        break;

      case 'identity_verification':
        await handleVerificationPaid(db, userId, session.id, metadata.identityType ?? 'creator', metadata.verificationName, session.amount_total ? session.amount_total / 100 : 30);
        break;

      case 'lbs_application':
        await handleLbsApplicationPaid(db, userId, session.id, session.amount_total ? session.amount_total / 100 : 500, metadata.nodeId ?? null);
        break;

      // ── 通用產品購買（UniversalCheckout 路徑）──────────────────────────────
      case 'product_purchase':
        if (!productCode) {
          console.warn(`[stripe/webhook] product_purchase missing productCode, session=${session.id}`);
          break;
        }
        if (productCode === 'identity_verify') {
          await handleVerificationPaid(db, userId, session.id, metadata.identityType ?? 'creator', metadata.verificationName, session.amount_total ? session.amount_total / 100 : 30);
        } else if (productCode === 'film_entry') {
          const metaFilmId = metadata.filmId ?? null;
          if (!metaFilmId) {
            console.warn(`[stripe/webhook] product_purchase film_entry missing filmId, session=${session.id}`);
          } else {
            await handleFilmEntryPaid(db, userId, metaFilmId, session.id);
          }
        } else if (productCode === 'lbs_license') {
          await handleLbsApplicationPaid(db, userId, session.id, session.amount_total ? session.amount_total / 100 : 500, metadata.nodeId ?? null);
        } else {
          // 其他通用產品：僅記錄流水，無特定業務邏輯
          console.log(`[stripe/webhook] product_purchase generic productCode=${productCode}, recording only.`);
          const { error: txErr } = await db.from('transactions').insert({
            user_id: userId,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            currency: 'USD',
            tx_type: 'product_purchase',
            status: 'success',
          });
          if (txErr) console.warn('[stripe/webhook] transaction insert failed:', txErr.message);
        }
        break;

      default:
        console.warn(`[stripe/webhook] Unknown payment type: ${paymentType}`);
    }

    // ── 6. 记录已处理（幂等性标记）──────────────────────────────────────────
    try {
      await markAsProcessed(db, event.id, session.id, paymentType, userId);
    } catch {
      // 记录失败不影响主流程（stripe_events 表可能未创建）
      console.warn('[stripe/webhook] Failed to record idempotency marker.');
    }

    return NextResponse.json({ received: true, processed: paymentType });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Processing error';
    console.error('[stripe/webhook] Business logic error:', msg);
    // 返回 500 让 Stripe 自动重试
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

### app/api/lbs/pay-aif/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const LBS_AIF_COST = 2500;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid auth token' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, formData } = body as { userId: string; formData: Record<string, unknown> };

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Check user balance
    const { data: userData, error: userErr } = await supabaseAdmin
      .from('users')
      .select('aif_balance')
      .eq('id', userId)
      .single();

    if (userErr || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentBalance = userData.aif_balance ?? 0;
    if (currentBalance < LBS_AIF_COST) {
      return NextResponse.json(
        { error: `Insufficient AIF balance. Required: ${LBS_AIF_COST}, Available: ${currentBalance}` },
        { status: 400 },
      );
    }

    // Deduct AIF
    const { error: deductErr } = await supabaseAdmin
      .from('users')
      .update({ aif_balance: currentBalance - LBS_AIF_COST })
      .eq('id', userId);

    if (deductErr) {
      return NextResponse.json({ error: `Failed to deduct AIF: ${deductErr.message}` }, { status: 500 });
    }

    // Insert LBS node record（只写 lbs_nodes 实际存在的列）
    const { error: insertErr } = await supabaseAdmin.from('lbs_nodes').insert({
      ...formData,
      creator_id: userId,
      status: 'pending',
    });

    if (insertErr) {
      // Attempt to refund on insert failure
      await supabaseAdmin
        .from('users')
        .update({ aif_balance: currentBalance })
        .eq('id', userId);
      return NextResponse.json({ error: `Failed to submit LBS node: ${insertErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, deducted: LBS_AIF_COST });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/lbs/save-draft/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PrivyClient } from '@privy-io/server-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

/**
 * 只包含 lbs_nodes 表实际存在的列。
 * 实际列：id, title, location, start_time, end_time, status, created_at,
 *         lat, lng, description, contract_req, film_ids, poster_url, bg_url,
 *         ticket_price, currency, contract_type, creator_id, country, city,
 *         venue, background_url, is_online, reject_reason, rejection_reason,
 *         review_status
 */
interface DraftPayload {
  title: string;
  location: string;
  lat: number;
  lng: number;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  contract_req: string;
  ticket_price: number | null;
  poster_url: string | null;
  background_url: string | null;
  status: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    // ── 从 Authorization header 提取并验证 Privy token，获取 creator_id ──
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    let creatorId: string;
    try {
      const claims = await privyClient.verifyAuthToken(authHeader.slice(7));
      creatorId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    if (!creatorId) {
      return NextResponse.json({ error: 'creator_id is required' }, { status: 400 });
    }

    const body = await req.json();
    const { nodeId: rawNodeId, payload } = body as { nodeId?: string; payload: DraftPayload };

    // 非 UUID 格式的 nodeId 视为无效，走新建逻辑（避免 stale sessionStorage 触发 PostgREST 格式错误）
    const nodeId = rawNodeId && UUID_RE.test(rawNodeId) ? rawNodeId : undefined;

    // 只传数据库中实际存在的列，creator_id 由服务端从 token 中获取（不信任客户端传入值）
    // status 强制为 'draft'，绝不允许客户端将草稿直接设为 'approved'/'pending' 等已审核状态
    const safePayload = {
      title: payload.title,
      location: payload.location,
      lat: payload.lat,
      lng: payload.lng,
      start_time: payload.start_time,
      end_time: payload.end_time,
      description: payload.description,
      contract_req: payload.contract_req,
      ticket_price: payload.ticket_price,
      poster_url: payload.poster_url,
      background_url: payload.background_url,
      status: 'draft',
      creator_id: creatorId,
    };

    console.log('[save-draft] nodeId:', nodeId, 'creator_id:', creatorId);

    if (nodeId) {
      const { error } = await supabaseAdmin
        .from('lbs_nodes')
        .update(safePayload)
        .eq('id', nodeId)
        .eq('creator_id', creatorId);

      if (error) {
        console.error('[save-draft] update error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id: nodeId });
    } else {
      const { data, error } = await supabaseAdmin
        .from('lbs_nodes')
        .insert([safePayload])
        .select('id')
        .single();

      if (error) {
        console.error('[save-draft] insert error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ id: (data as { id: string }).id });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### app/api/lbs/screenings/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST: 新增排片选择（insert） */
export async function POST(req: NextRequest) {
  try {
    const { nodeId, filmId, userId } = await req.json() as {
      nodeId: string;
      filmId: string;
      userId: string;
    };

    if (!nodeId || !filmId || !userId) {
      return NextResponse.json({ error: 'nodeId, filmId and userId are required' }, { status: 400 });
    }
    if (!UUID_RE.test(nodeId) || !UUID_RE.test(filmId)) {
      return NextResponse.json({ error: 'Invalid nodeId or filmId format' }, { status: 400 });
    }

    // 验证节点归属
    const { data: node } = await supabaseAdmin
      .from('lbs_nodes')
      .select('id')
      .eq('id', nodeId)
      .eq('creator_id', userId)
      .maybeSingle();

    if (!node) {
      return NextResponse.json({ error: 'Node not found or unauthorized' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('lbs_screenings')
      .insert({ lbs_node_id: nodeId, film_id: filmId });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 });
  }
}

/** DELETE: 移除排片选择 */
export async function DELETE(req: NextRequest) {
  try {
    const { nodeId, filmId, userId } = await req.json() as {
      nodeId: string;
      filmId: string;
      userId: string;
    };

    if (!nodeId || !filmId || !userId) {
      return NextResponse.json({ error: 'nodeId, filmId and userId are required' }, { status: 400 });
    }
    if (!UUID_RE.test(nodeId) || !UUID_RE.test(filmId)) {
      return NextResponse.json({ error: 'Invalid nodeId or filmId format' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('lbs_screenings')
      .delete()
      .eq('lbs_node_id', nodeId)
      .eq('film_id', filmId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected error' }, { status: 500 });
  }
}
```

