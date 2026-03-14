import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    // 兼容 txType（camelCase）和 tx_type（snake_case）两种参数名
    const txType = searchParams.get('txType') ?? searchParams.get('tx_type');
    // 兼容 currency 和 payment_method 两种参数名，并将 payment_method 映射为 currency 值
    const currencyRaw = searchParams.get('currency') ?? searchParams.get('payment_method');
    const currency = currencyRaw === 'stripe' ? 'USD' : currencyRaw === 'solana' ? 'AIF' : currencyRaw;

    let query = adminSupabase
      .from('transactions')
      .select('id, user_id, related_film_id, amount, currency, tx_type, status, created_at, related_deposit_address, tx_hash')
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    if (txType) query = query.eq('tx_type', txType);
    if (currency) query = query.eq('currency', currency);

    const { data: txRows, error: txError } = await query;
    if (txError) {
      console.error('[finance/ledger] transactions 查詢失敗:', txError.message, txError.code);
    }
    console.log('[finance/ledger] transactions rows:', txRows?.length ?? 0);

    // ── Source 2: creator_applications（身份認證費）─────────────────────────
    // 包含 awaiting_payment 狀態，確保所有已發起但未完成的認證費記錄也顯示
    let caQuery = adminSupabase
      .from('creator_applications')
      .select('id, user_id, identity_type, payment_method, submitted_at, status')
      .in('status', ['pending', 'approved', 'rejected', 'awaiting_payment'])
      .order('submitted_at', { ascending: false });

    if (startDate) caQuery = caQuery.gte('submitted_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      caQuery = caQuery.lte('submitted_at', end.toISOString());
    }

    const { data: caData, error: caError } = await caQuery;
    if (caError) {
      console.warn('[finance/ledger] creator_applications 查詢失敗:', caError.message);
    }
    console.log('[finance/ledger] creator_applications rows:', caData?.length ?? 0);

    const caRows = caData ?? [];

    // ── Source 3: films（Stripe 影片報名費補錄）──────────────────────────────
    // 當 Stripe webhook 成功更新 films.payment_status='paid' 但 transactions 插入失敗時，
    // 從 films 表補充這些支付記錄，避免數據丟失
    const txFilmIds = new Set((txRows ?? []).map(r => r.related_film_id).filter(Boolean));
    let filmsQuery = adminSupabase
      .from('films')
      .select('id, user_id, title, payment_status, payment_method, created_at')
      .eq('payment_status', 'paid')
      .eq('payment_method', 'stripe')
      .order('created_at', { ascending: false });

    if (startDate) filmsQuery = filmsQuery.gte('created_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filmsQuery = filmsQuery.lte('created_at', end.toISOString());
    }

    const { data: stripeFilmsData, error: filmsError } = await filmsQuery;
    if (filmsError) {
      console.warn('[finance/ledger] films 查詢失敗:', filmsError.message);
    }
    // 僅保留 transactions 中尚未記錄的影片（避免重複）
    const stripeFilmsRows = (stripeFilmsData ?? []).filter(f => !txFilmIds.has(f.id));
    console.log('[finance/ledger] stripe films补录 rows:', stripeFilmsRows.length);

    // 批量查詢用戶 email（合并 transactions + creator_applications + stripe films 中的所有 user_id）
    const txUserIds = (txRows ?? []).map(r => r.user_id).filter(Boolean) as string[];
    const caUserIds = caRows.map((r: { user_id: string }) => r.user_id).filter(Boolean) as string[];
    const filmUserIds = stripeFilmsRows.map(r => r.user_id).filter(Boolean) as string[];
    const allUserIds = [...new Set([...txUserIds, ...caUserIds, ...filmUserIds])];
    const userMap: Record<string, string> = {};
    if (allUserIds.length > 0) {
      const { data: users } = await adminSupabase.from('users').select('id, email').in('id', allUserIds);
      for (const u of users ?? []) userMap[u.id] = u.email;
    }

    // 批量查詢影片標題
    const filmIds = [...new Set((txRows ?? []).map(r => r.related_film_id).filter(Boolean))] as string[];
    const filmMap: Record<string, string> = {};
    if (filmIds.length > 0) {
      const { data: films } = await adminSupabase.from('films').select('id, title').in('id', filmIds);
      for (const f of films ?? []) filmMap[f.id] = f.title;
    }

    // 組裝 transactions 數據
    const txData = (txRows ?? []).map(r => ({
      id: r.id,
      user_id: r.user_id,
      user_email: userMap[r.user_id] ?? null,
      related_film_id: r.related_film_id,
      related_film_title: r.related_film_id ? (filmMap[r.related_film_id] ?? null) : null,
      related_lbs_id: null,
      related_lbs_title: null,
      related_deposit_address: r.related_deposit_address,
      tx_type: r.tx_type,
      tx_hash: r.tx_hash,
      stripe_session_id: null,
      amount: r.amount,
      currency: r.currency,
      payment_method: r.currency === 'AIF' ? 'aif' : 'stripe',
      status: r.status,
      created_at: r.created_at,
      _source: 'transactions',
    }));

    // 組裝 Source 3: stripe films 補錄數據
    const filmsFormatted = stripeFilmsRows.map(r => ({
      id: `film_stripe_${r.id}`,
      user_id: r.user_id,
      user_email: userMap[r.user_id] ?? null,
      related_film_id: r.id,
      related_film_title: r.title ?? null,
      related_lbs_id: null,
      related_lbs_title: null,
      related_deposit_address: null,
      tx_type: 'submission_fee',
      tx_hash: null,
      stripe_session_id: null,
      amount: 99,
      currency: 'USD',
      payment_method: 'stripe',
      status: 'success',
      created_at: r.created_at,
      _source: 'films_stripe',
    }));

    // 組裝 creator_applications 數據
    const caFormatted = caRows.map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      user_email: userMap[r.user_id] ?? null,
      related_film_id: null,
      related_film_title: null,
      related_lbs_id: null,
      related_lbs_title: null,
      related_deposit_address: null,
      tx_type: 'identity_verification',
      tx_hash: null,
      stripe_session_id: null,
      amount: r.amount ?? (r.payment_method === 'aif' ? 150 : 30),
      currency: r.payment_method === 'aif' ? 'AIF' : 'USD',
      payment_method: r.payment_method,
      status: r.status === 'approved' ? 'success' : r.status,
      created_at: r.submitted_at,
      _source: 'creator_applications',
    }));

    const allData = [...txData, ...filmsFormatted, ...caFormatted].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const summary = {
      total_usd: allData.filter(r => r.currency === 'USD').reduce((s, r) => s + Number(r.amount ?? 0), 0),
      total_aif: allData.filter(r => r.currency === 'AIF').reduce((s, r) => s + Number(r.amount ?? 0), 0),
      total_tx: allData.length,
    };

    const resp: Record<string, unknown> = { data: allData, summary };
    if (txError) {
      resp.txError = txError.message;
      // 將 transactions 查詢錯誤也暴露為 error，讓前端能顯示提示
      resp.error = `transactions 查詢失敗: ${txError.message}`;
    }

    return NextResponse.json(resp);
  } catch (err: any) {
    console.error('[finance/ledger] 未知錯誤:', err.message);
    return NextResponse.json({ error: err.message, data: [], summary: { total_usd: 0, total_aif: 0, total_tx: 0 } });
  }
}
