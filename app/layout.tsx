import type { Metadata } from "next";
import dynamic from "next/dynamic";
import ClientProviders from "./components/ClientProviders";
import ConditionalNav from "./components/ConditionalNav";
import Providers from "@/components/Providers";
import "./globals.css";

const PwaInstallPrompt = dynamic(() => import("@/components/PwaInstallPrompt"), {
  ssr: false,
});

export const viewport = {
  themeColor: '#CCFF00',
};

export const metadata: Metadata = {
  title: 'HKAIIFF | 香港AI國際電影節',
  description: 'Something has to change. 香港政府批復註冊的全球首個AI原生國際電影節',
  manifest: '/manifest.json',
  openGraph: {
    title: 'HKAIIFF | 香港AI國際電影節',
    description: 'Something has to change. 香港政府批復註冊的全球首個AI原生國際電影節',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HKAIIFF | 香港AI國際電影節',
    description: 'Something has to change. 香港政府批復註冊的全球首個AI原生國際電影節',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;700;900&family=Space+Mono:wght@400;700&family=Noto+Sans+TC:wght@300;400;500;700;900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#CCFF00" />
        <meta name="application-name" content="HKAIIFF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HKAIIFF" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512x512.png" />
      </head>
      {/* bg/text 由 ConditionalNav 按路由分流處理：前台=bg-void/text-white，/admin=白底畫布 */}
      <body className="font-zh antialiased">
        <Providers>
        <ClientProviders>
          <ConditionalNav>
            {children}
          </ConditionalNav>
          <PwaInstallPrompt />
        </ClientProviders>
        </Providers>
      </body>
    </html>
  );
}
