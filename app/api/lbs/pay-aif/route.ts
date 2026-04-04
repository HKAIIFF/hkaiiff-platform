import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
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
