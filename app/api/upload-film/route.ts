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
        synopsis,
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
