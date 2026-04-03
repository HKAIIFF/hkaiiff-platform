import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/** Service role 客戶端（單例，無持久 session）— 僅用於服務端 API Route */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase env vars');
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}
