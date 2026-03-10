/**
 * POST /api/stripe/lbs-checkout
 *
 * 為 LBS 影展/影院申請授權費創建 Stripe Checkout Session（$500 USD）。
 */

import { NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import Stripe from 'stripe';

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

function extractErrorMessage(err: unknown): string {
  if (!err) return 'Unknown server error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string' && e.message) return e.message;
    if (typeof e.error === 'string' && e.error) return e.error;
  }
  return 'Unknown server error';
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Payment service is not configured.' },
      { status: 500 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' as any });

  try {
    // Verify Privy token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    let verifiedUserId: string;
    try {
      const claims = await privyClient.verifyAuthToken(token);
      verifiedUserId = claims.userId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    const body = await req.json();
    const { userId } = body as { userId: string };

    if (!userId || userId !== verifiedUserId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }

    const origin = req.headers.get('origin') ?? 'https://hkaiiff.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'LBS Festival / Cinema Node License',
              description: 'HKAIIFF 2026 · LBS Geolocation Screening Authorization Fee',
            },
            unit_amount: 50000, // $500.00
          },
          quantity: 1,
        },
      ],
      metadata: { userId, type: 'lbs_application' },
      success_url: `${origin}/lbs/apply/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/lbs/apply`,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: unknown) {
    console.error('[lbs-checkout] Error:', err);
    return NextResponse.json({ error: extractErrorMessage(err) }, { status: 500 });
  }
}
