"use client";
import { PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
  return (
    <PrivyProvider
      appId={appId}
      config={{
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
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
          showWalletLoginFirst: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
