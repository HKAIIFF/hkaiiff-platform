import type { Metadata } from "next";
import Sidebar from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import MobileTopBar from "./components/MobileTopBar";
import ClientProviders from "./components/ClientProviders";
import GlobalModals from "./components/GlobalModals";
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
      <body className="font-zh bg-void text-white antialiased">
        <Providers>
        <ClientProviders>
          <div className="flex h-screen overflow-hidden">
            <div className="hidden lg:flex flex-shrink-0">
              <Sidebar />
            </div>
            <main className="flex-1 h-full overflow-hidden relative bg-void">
              {children}
            </main>
          </div>
          <MobileTopBar />
          <BottomNav />
          <GlobalModals />
        </ClientProviders>
        </Providers>
      </body>
    </html>
  );
}
