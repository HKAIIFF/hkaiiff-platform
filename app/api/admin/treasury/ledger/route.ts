/**
 * GET /api/admin/treasury/ledger
 *
 * 返回墊付與歸集流水追蹤表數據。
 * 數據源：users 表（含 deposit_address、wallet_index、aif_balance）
 *         + transactions 表（墊付 TxHash、歸集 TxHash）
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: Request) {
  try {
    const authResult = await checkAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);
    const search = searchParams.get('search') ?? '';

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const adminSupabase = createAdminSupabase();

    let query = adminSupabase
      .from('users')
      .select(
        'id, email, deposit_address, wallet_index, aif_balance, created_at',
        { count: 'exact' }
      )
      .not('deposit_address', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,deposit_address.ilike.%${search}%,id.ilike.%${search}%`
      );
    }

    const { data: users, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 批量查詢每個用戶的墊付交易記錄
    const depositAddresses = (users ?? []).map((u) => u.deposit_address).filter(Boolean);

    let txMap: Record<string, { fundingTxHash: string | null; fundingAt: string | null; sweepTxHash: string | null; sweepAt: string | null; swept: boolean }> = {};

    if (depositAddresses.length > 0) {
      const { data: txs } = await adminSupabase
        .from('transactions')
        .select('related_deposit_address, tx_type, tx_hash, created_at, status')
        .in('related_deposit_address', depositAddresses)
        .in('tx_type', ['funding', 'sweep'])
        .order('created_at', { ascending: false });

      for (const tx of txs ?? []) {
        const addr = tx.related_deposit_address;
        if (!txMap[addr]) {
          txMap[addr] = {
            fundingTxHash: null,
            fundingAt: null,
            sweepTxHash: null,
            sweepAt: null,
            swept: false,
          };
        }
        if (tx.tx_type === 'funding' && !txMap[addr].fundingTxHash) {
          txMap[addr].fundingTxHash = tx.tx_hash;
          txMap[addr].fundingAt = tx.created_at;
        }
        if (tx.tx_type === 'sweep' && !txMap[addr].sweepTxHash) {
          txMap[addr].sweepTxHash = tx.tx_hash;
          txMap[addr].sweepAt = tx.created_at;
          txMap[addr].swept = tx.status === 'success';
        }
      }
    }

    const rows = (users ?? []).map((u) => {
      const txInfo = txMap[u.deposit_address] ?? {
        fundingTxHash: null,
        fundingAt: null,
        sweepTxHash: null,
        sweepAt: null,
        swept: false,
      };
      return {
        userId: u.id,
        email: u.email,
        depositAddress: u.deposit_address,
        walletIndex: u.wallet_index,
        aifBalance: u.aif_balance ?? 0,
        fundingTxHash: txInfo.fundingTxHash,
        fundingAt: txInfo.fundingAt,
        sweepTxHash: txInfo.sweepTxHash,
        sweepAt: txInfo.sweepAt,
        swept: txInfo.swept,
        createdAt: u.created_at,
      };
    });

    return NextResponse.json({
      rows,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
