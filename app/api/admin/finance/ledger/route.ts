import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const txType = searchParams.get('txType');
    const currency = searchParams.get('currency');

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
    if (txError) return NextResponse.json({ error: txError.message, data: [], summary: { total_usd: 0, total_aif: 0, total_tx: 0 } });

    // 批量查詢用戶 email
    const userIds = [...new Set((txRows ?? []).map(r => r.user_id).filter(Boolean))] as string[];
    const userMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: users } = await adminSupabase.from('users').select('id, email').in('id', userIds);
      for (const u of users ?? []) userMap[u.id] = u.email;
    }

    // 批量查詢影片標題
    const filmIds = [...new Set((txRows ?? []).map(r => r.related_film_id).filter(Boolean))] as string[];
    const filmMap: Record<string, string> = {};
    if (filmIds.length > 0) {
      const { data: films } = await adminSupabase.from('films').select('id, title').in('id', filmIds);
      for (const f of films ?? []) filmMap[f.id] = f.title;
    }

    // 同時查詢 creator_applications（法幣身份認證費）
    let caRows: any[] = [];
    let caQuery = adminSupabase
      .from('creator_applications')
      .select('id, user_id, identity_type, payment_method, payment_session, submitted_at, status, amount')
      .in('status', ['pending', 'approved', 'rejected'])
      .order('submitted_at', { ascending: false });
    if (startDate) caQuery = caQuery.gte('submitted_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      caQuery = caQuery.lte('submitted_at', end.toISOString());
    }
    const { data: caData } = await caQuery;
    caRows = caData ?? [];

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

    // 組裝 creator_applications 數據
    const caData2 = caRows.map(r => ({
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
      stripe_session_id: r.payment_session,
      amount: r.amount ?? (r.payment_method === 'fiat' ? 30 : 150),
      currency: r.payment_method === 'fiat' ? 'USD' : 'AIF',
      payment_method: r.payment_method,
      status: r.status,
      created_at: r.submitted_at,
      _source: 'creator_applications',
    }));

    const allData = [...txData, ...caData2].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const summary = {
      total_usd: allData.filter(r => r.currency === 'USD').reduce((s, r) => s + Number(r.amount ?? 0), 0),
      total_aif: allData.filter(r => r.currency === 'AIF').reduce((s, r) => s + Number(r.amount ?? 0), 0),
      total_tx: allData.length,
    };

    return NextResponse.json({ data: allData, summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, data: [], summary: { total_usd: 0, total_aif: 0, total_tx: 0 } });
  }
}
