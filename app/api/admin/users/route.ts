import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json({ error: "Missing Privy credentials" }, { status: 500 });
    }

    const response = await fetch('https://auth.privy.io/api/v1/users', {
      method: 'GET',
      headers: {
        'privy-app-id': appId,
        'Authorization': 'Basic ' + Buffer.from(`${appId}:${appSecret}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch users from Privy');
    }

    const data = await response.json();
    return NextResponse.json(data.data || []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
