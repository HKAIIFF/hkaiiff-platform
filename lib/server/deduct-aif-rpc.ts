import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * `deduct_aif_balance` 部署差異：
 * - 新版：RETURNS numeric（扣款後餘額；不足則 RPC error）
 * - 舊版：RETURNS boolean（true/false）
 * - 極舊：{ success, new_balance } 物件
 */
export async function interpretDeductAifRpc(
  adminSupabase: SupabaseClient,
  userId: string,
  rpcData: unknown,
): Promise<
  | { ok: true; newBalance: number | null }
  | { ok: false; insufficient: true }
  | { ok: false; insufficient: false }
> {
  if (typeof rpcData === 'number' && Number.isFinite(rpcData)) {
    return { ok: true, newBalance: rpcData };
  }
  if (typeof rpcData === 'string' && rpcData.trim() !== '') {
    const n = Number(rpcData);
    if (Number.isFinite(n)) {
      return { ok: true, newBalance: n };
    }
  }

  if (rpcData === true) {
    const { data: fresh } = await adminSupabase
      .from('users')
      .select('aif_balance')
      .eq('id', userId)
      .maybeSingle();
    const nb = fresh?.aif_balance;
    return {
      ok: true,
      newBalance: typeof nb === 'number' ? nb : null,
    };
  }

  if (rpcData === false) {
    return { ok: false, insufficient: true };
  }

  if (rpcData && typeof rpcData === 'object' && 'success' in rpcData) {
    const o = rpcData as { success?: boolean; new_balance?: number };
    if (o.success === true) {
      return { ok: true, newBalance: o.new_balance ?? null };
    }
    return { ok: false, insufficient: true };
  }

  return { ok: false, insufficient: false };
}
