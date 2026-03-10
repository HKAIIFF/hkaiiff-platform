/**
 * GET /api/admin/finance/ledger
 *
 * 全局財務流水：從 transactions 表拉取全局數據，支援多維篩選。
 *
 * Query Params:
 *   startDate     ISO 日期字符串 (inclusive)
 *   endDate       ISO 日期字符串 (inclusive, 自動補足至當天 23:59:59)
 *   tx_type       業務類型 ('creator_cert' | 'submission_fee' | 'lbs_license' | 'aif_topup' | 'sweep' | 'funding' | 'dust_sweep')
 *   payment_method  支付方式 ('stripe' | 'solana')
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
  stripe_charge_id: string | null;
  amount: number | null;
  currency: string | null;
  payment_method: string | null;
  status: string | null;
  created_at: string;
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

/** 根據 currency 判斷是否屬於法幣（USD/HKD/STRIPE），返回 USD 等值 */
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

/** 根據 currency 判斷是否屬於 AIF */
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

    // ── 構建查詢 ──────────────────────────────────────────────────────────────
    let query = adminSupabase
      .from('transactions')
      .select(`
        id,
        user_id,
        related_film_id,
        related_deposit_address,
        tx_type,
        tx_hash,
        stripe_charge_id,
        amount,
        currency,
        payment_method,
        status,
        created_at,
        related_lbs_id
      `)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', new Date(startDate).toISOString());
    }
    if (endDate) {
      // 補足至當天最後一毫秒
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    if (txType) {
      query = query.eq('tx_type', txType);
    }
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }

    const { data: txRows, error } = await query;

    if (error) {
      console.error('🔥 Ledger API 崩潰原因:', error);
      return NextResponse.json({
        summary: { total_usd: 0, total_aif: 0, total_tx: 0 },
        data: [],
        error: error.message ?? 'Unknown DB Error',
      } satisfies LedgerResponse);
    }

    const rows = txRows ?? [];

    // ── 批量查詢關聯用戶信息 ──────────────────────────────────────────────────
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    let userMap: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: users } = await adminSupabase
        .from('users')
        .select('id, email')
        .in('id', userIds);
      for (const u of users ?? []) {
        userMap[u.id] = u.email;
      }
    }

    // ── 批量查詢關聯影片標題 ──────────────────────────────────────────────────
    const filmIds = [...new Set(rows.map((r) => r.related_film_id).filter(Boolean))] as string[];
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
    const lbsIds = [...new Set(rows.map((r) => (r as { related_lbs_id?: string | null }).related_lbs_id).filter(Boolean))] as string[];
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

    // ── 組裝返回數據 ──────────────────────────────────────────────────────────
    const data: LedgerRow[] = rows.map((r) => {
      const lbsId = (r as { related_lbs_id?: string | null }).related_lbs_id ?? null;
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
        stripe_charge_id: (r as { stripe_charge_id?: string | null }).stripe_charge_id ?? null,
        amount: r.amount,
        currency: r.currency,
        payment_method: r.payment_method,
        status: r.status,
        created_at: r.created_at,
      };
    });

    // ── 計算匯總 ──────────────────────────────────────────────────────────────
    const summary: LedgerSummary = {
      total_usd: data.reduce((s, r) => s + (Number(toUsd(r.amount, r.currency, r.payment_method)) || 0), 0),
      total_aif: data.reduce((s, r) => s + (Number(toAif(r.amount, r.currency)) || 0), 0),
      total_tx: data.length,
    };

    return NextResponse.json({ summary, data } satisfies LedgerResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown DB Error';
    console.error('🔥 Ledger API 崩潰原因:', err);
    return NextResponse.json({
      summary: { total_usd: 0, total_aif: 0, total_tx: 0 },
      data: [],
      error: message,
    } satisfies LedgerResponse);
  }
}
