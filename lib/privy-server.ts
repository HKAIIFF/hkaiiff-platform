import { PrivyClient } from '@privy-io/server-auth';

let _client: PrivyClient | null = null;

export function getPrivyServerClient(): PrivyClient {
  if (!_client) {
    _client = new PrivyClient(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
      process.env.PRIVY_APP_SECRET!,
    );
  }
  return _client;
}
