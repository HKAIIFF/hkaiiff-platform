/**
 * POST /api/stripe/verification-checkout
 *
 * Creates a Stripe Checkout Session for identity verification fee ($30 USD).
 */

import { NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import Stripe from 'stripe';

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-02-25.clover',
  });

  try {
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
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    if (body.userId && body.userId !== verifiedUserId) {
      return NextResponse.json({ error: 'userId mismatch' }, { status: 403 });
    }

    const reqOrigin = req.headers.get('origin');
    const siteUrl = reqOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'https://hkaiiff.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'HKAIIFF Identity Verification Fee',
              description: 'One-time fee for creator identity credentialing',
            },
            unit_amount: 3000, // $30.00 USD
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/verification?stripe_success=1`,
      cancel_url: `${siteUrl}/verification?stripe_cancelled=1`,
      metadata: {
        userId: verifiedUserId,
        type: 'identity_verification',
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe/verification-checkout]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
