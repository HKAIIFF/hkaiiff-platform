/**
 * GET /api/admin/finance/ledger
 *
 * 全局財務流水：聚合多表數據，確保所有支付方式的記錄均可顯示。
 *
 * 數據來源：
 *  1. transactions 表 —— AIF 支付 + Stripe 影片報名費 + 新版 Stripe 認證費（已修復 webhook 後）
 *  2. creator_applications 表 —— 歷史 Stripe 認證費兜底（webhook 修復前未寫入 transactions 的記錄）
 *
 * Query Params:
 *   startDate       ISO 日期字符串 (inclusive)
 *   endDate         ISO 日期字符串 (inclusive, 自動補足至當天 23:59:59)
 *   tx_type         業務類型 filter
 *   payment_method  支付方式 filter ('stripe' | 'aif')
 *
 * 返回:
 *   summary: { total_usd, total_aif, total_tx }
 *   data:    LedgerRow[]  按 created_at 降序
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Supabase Admin Client ───────────────────────────────────────────────────

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ─── 型別 ────────────────────────────────────────────────────────────────────

export interface LedgerRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  related_film_id: string | null;
  related_film_title: string | null;
  related_lbs_id: string | null;
  related_lbs_title: string | null;
  related_deposit_address: string | null;
  tx_type: string | null;
  tx_hash: string | null;
  stripe_session_id: string | null;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  status: string | null;
  created_at: string;
  /** 標記數據來源，用於前端調試 */
  _source?: 'transactions' | 'creator_applications';
}

export interface LedgerSummary {
  total_usd: number;
  total_aif: number;
  total_tx: number;
}

export interface LedgerResponse {
  summary: LedgerSummary;
  data: LedgerRow[];
  error?: string;
}

// ─── 工具函數 ─────────────────────────────────────────────────────────────────

function toUsd(amount: number | null, currency: string | null, payment_method: string | null): number {
  const safeAmount = Number(amount) || 0;
  if (safeAmount <= 0) return 0;
  const isStripe = payment_method?.toLowerCase() === 'stripe'
    || currency?.toLowerCase() === 'usd'
    || currency?.toLowerCase() === 'hkd';
  if (!isStripe) return 0;
  if (currency?.toLowerCase() === 'hkd') return safeAmount / 7.8;
  return safeAmount;
}

function toAif(amount: number | null, currency: string | null): number {
  const safeAmount = Number(amount) || 0;
  if (safeAmount <= 0) return 0;
  return currency?.toUpperCase() === 'AIF' ? safeAmount : 0;
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const txType = searchParams.get('tx_type');
    const paymentMethod = searchParams.get('payment_method');

    const adminSupabase = createAdminSupabase();

    // ── Source 1: transactions 表（主要數據源）─────────────────────────────────
    let txQuery = adminSupabase
      .from('transactions')
      .select(`
        id,
        user_id,
        related_film_id,
        related_deposit_address,
        tx_type,
        tx_hash,
        stripe_session_id,
        amount,
        currency,
        payment_method,
        status,
        created_at,
        related_lbs_id
      `)
      .order('created_at', { ascending: false });

    if (startDate) txQuery = txQuery.gte('created_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      txQuery = txQuery.lte('created_at', end.toISOString());
    }
    if (txType) txQuery = txQuery.eq('tx_type', txType);
    if (paymentMethod) {
      if (paymentMethod === 'aif') {
        txQuery = txQuery.eq('currency', 'AIF');
      } else if (paymentMethod === 'stripe') {
        txQuery = txQuery.eq('payment_method', 'stripe');
      } else {
        txQuery = txQuery.eq('payment_method', paymentMethod);
      }
    }

    const { data: txRows, error: txError } = await txQuery;

    if (txError) {
      console.error('🔥 Ledger API transactions 查詢失敗:', txError);
      return NextResponse.json({
        summary: { total_usd: 0, total_aif: 0, total_tx: 0 },
        data: [],
        error: txError.message ?? 'Unknown DB Error',
      } satisfies LedgerResponse);
    }

    const rawTxRows = txRows ?? [];

    // 收集已有的 stripe_session_id，用於兜底查詢去重
    const knownSessionIds = new Set(
      rawTxRows
        .map((r) => (r as { stripe_session_id?: string | null }).stripe_session_id)
        .filter(Boolean) as string[]
    );

    // ── Source 2: creator_applications 兜底查詢（歷史 Stripe 認證費）───────────
    // 只拉取 payment_method='fiat' 且 status 已流轉（非 awaiting_payment）的記錄
    // 排除那些已經在 transactions 表中有對應 session 的記錄（去重）
    let caRows: Array<{
      id: string;
      user_id: string | null;
      identity_type: string | null;
      payment_method: string | null;
      payment_session: string | null;
      submitted_at: string | null;
      status: string | null;
    }> = [];

    const shouldQueryCa = !txType || txType === 'creator_cert';
    const shouldQueryCaByMethod = !paymentMethod || paymentMethod === 'stripe';

    if (shouldQueryCa && shouldQueryCaByMethod) {
      let caQuery = adminSupabase
        .from('creator_applications')
        .select('id, user_id, identity_type, payment_method, payment_session, submitted_at, status')
        .eq('payment_method', 'fiat')
        .in('status', ['pending', 'approved', 'rejected'])
        .order('submitted_at', { ascending: false });

      if (startDate) caQuery = caQuery.gte('submitted_at', new Date(startDate).toISOString());
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        caQuery = caQuery.lte('submitted_at', end.toISOString());
      }

      const { data: caData, error: caError } = await caQuery;
      if (caError) {
        console.warn('⚠️ Ledger API creator_applications 兜底查詢失敗（非致命）:', caError.message);
      } else {
        // 過濾掉已經在 transactions 中有對應 session_id 的記錄，避免重複計入
        caRows = (caData ?? []).filter(
          (ca) => !ca.payment_session || !knownSessionIds.has(ca.payment_session)
        );
      }
    }

    // ── 批量查詢關聯用戶信息 ──────────────────────────────────────────────────
    const allUserIds = [
      ...new Set([
        ...rawTxRows.map((r) => r.user_id),
        ...caRows.map((r) => r.user_id),
      ].filter(Boolean)),
    ] as string[];

    let userMap: Record<string, string | null> = {};
    if (allUserIds.length > 0) {
      const { data: users } = await adminSupabase
        .from('users')
        .select('id, email')
        .in('id', allUserIds);
      for (const u of users ?? []) {
        userMap[u.id] = u.email;
      }
    }

    // ── 批量查詢關聯影片標題 ──────────────────────────────────────────────────
    const filmIds = [
      ...new Set(rawTxRows.map((r) => r.related_film_id).filter(Boolean)),
    ] as string[];
    let filmMap: Record<string, string | null> = {};
    if (filmIds.length > 0) {
      const { data: films } = await adminSupabase
        .from('films')
        .select('id, title')
        .in('id', filmIds);
      for (const f of films ?? []) {
        filmMap[f.id] = f.title;
      }
    }

    // ── 批量查詢關聯 LBS 節點標題 ─────────────────────────────────────────────
    const lbsIds = [
      ...new Set(
        rawTxRows
          .map((r) => (r as { related_lbs_id?: string | null }).related_lbs_id)
          .filter(Boolean)
      ),
    ] as string[];
    let lbsMap: Record<string, string | null> = {};
    if (lbsIds.length > 0) {
      const { data: lbsNodes } = await adminSupabase
        .from('lbs_nodes')
        .select('id, title')
        .in('id', lbsIds);
      for (const l of lbsNodes ?? []) {
        lbsMap[l.id] = l.title;
      }
    }

    // ── 組裝 transactions 數據 ────────────────────────────────────────────────
    const txData: LedgerRow[] = rawTxRows.map((r) => {
      const lbsId = (r as { related_lbs_id?: string | null }).related_lbs_id ?? null;
      const sessionId = (r as { stripe_session_id?: string | null }).stripe_session_id ?? null;
      return {
        id: r.id,
        user_id: r.user_id,
        user_email: r.user_id ? (userMap[r.user_id] ?? null) : null,
        related_film_id: r.related_film_id,
        related_film_title: r.related_film_id ? (filmMap[r.related_film_id] ?? null) : null,
        related_lbs_id: lbsId,
        related_lbs_title: lbsId ? (lbsMap[lbsId] ?? null) : null,
        related_deposit_address: r.related_deposit_address,
        tx_type: r.tx_type,
        tx_hash: r.tx_hash,
        stripe_session_id: sessionId,
        amount: r.amount,
        currency: r.currency,
        payment_method: r.payment_method ?? (r.currency === 'AIF' ? 'aif' : null),
        status: r.status,
        created_at: r.created_at,
        _source: 'transactions',
      };
    });

    // ── 組裝 creator_applications 兜底數據 ────────────────────────────────────
    const caData: LedgerRow[] = caRows.map((ca) => ({
      id: `ca_${ca.id}`,
      user_id: ca.user_id,
      user_email: ca.user_id ? (userMap[ca.user_id] ?? null) : null,
      related_film_id: null,
      related_film_title: null,
      related_lbs_id: null,
      related_lbs_title: null,
      related_deposit_address: null,
      tx_type: 'creator_cert',
      tx_hash: null,
      stripe_session_id: ca.payment_session ?? null,
      amount: 30,
      currency: 'USD',
      payment_method: 'stripe',
      status: 'success',
      created_at: ca.submitted_at ?? new Date().toISOString(),
      _source: 'creator_applications',
    }));

    // ── 合併並按時間倒序排列 ───────────────────────────────────────────────────
    const data: LedgerRow[] = [...txData, ...caData].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // ── 計算匯總 ──────────────────────────────────────────────────────────────
    const summary: LedgerSummary = {
      total_usd: data.reduce((s, r) => s + toUsd(r.amount, r.currency, r.payment_method), 0),
      total_aif: data.reduce((s, r) => s + toAif(r.amount, r.currency), 0),
      total_tx: data.length,
    };

    return NextResponse.json({ summary, data } satisfies LedgerResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown DB Error';
    console.error('🔥 Ledger API 崩潰:', err);
    return NextResponse.json({
      summary: { total_usd: 0, total_aif: 0, total_tx: 0 },
      data: [],
      error: message,
    } satisfies LedgerResponse);
  }
}
