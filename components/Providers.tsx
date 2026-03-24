"use client";
import { PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet', 'email', 'google', 'twitter', 'discord'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
        } as any,
        externalWallets: {
          walletConnect: { enabled: true },
        },
        supportedChains: [{
          id: 101,
          name: 'Solana',
          network: 'solana-mainnet',
          nativeCurrency: { name: 'SOL', symbol: 'SOL', decimals: 9 },
          rpcUrls: { default: { http: ['https://api.mainnet-beta.solana.com'] } },
        }],
        appearance: {
          theme: 'dark',
          accentColor: '#9AFF12',
          showWalletLoginFirst: true,
          walletList: [
            'phantom',
            'metamask',
            'wallet_connect',
            'detected_solana_wallets',
            'detected_ethereum_wallets',
          ],
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
