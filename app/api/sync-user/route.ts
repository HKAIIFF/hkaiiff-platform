import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user } = body;
    if (!user || !user.id) return NextResponse.json({ error: 'No user data' }, { status: 400 });

    const { data, error } = await supabase
      .from('users')
      .upsert(
        [{
          id: user.id,
          email: user.email?.address || null,
          wallet_address: user.wallet?.address || null,
          name: 'New Agent',
          last_sign_in_at: new Date().toISOString(),
        }],
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
