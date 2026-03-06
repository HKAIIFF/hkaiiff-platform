import type { Metadata } from "next";
import ClientProviders from "./components/ClientProviders";
import ConditionalNav from "./components/ConditionalNav";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "HKAIIFF | AI Native Film Festival",
  description:
    "Hong Kong AI International Film Festival — The world's first festival exclusively dedicated to AI-Native cinema. Something has to change.",
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
      </head>
      {/* bg/text 由 ConditionalNav 按路由分流處理：前台=bg-void/text-white，/admin=白底畫布 */}
      <body className="font-zh antialiased">
        <Providers>
        <ClientProviders>
          <ConditionalNav>
            {children}
          </ConditionalNav>
        </ClientProviders>
        </Providers>
      </body>
    </html>
  );
}
