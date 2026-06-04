import type { Metadata } from "next";
import { Rubik, Inter, Noto_Sans_TC } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc/provider";
import { SessionProvider } from "@/lib/context/session-context";
import { getServerSession } from "@/lib/supabase/get-session";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NextTopLoader from "nextjs-toploader";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSansTC = Noto_Sans_TC({
  variable: "--font-sans-tc",
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://kozukase.com'),
  title: 'Kozukase | 日本代購比價平台',
  description: '比較日本代購賣家的價格、評價、運送速度，找到最適合你的代購服務',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    siteName: 'Kozukase',
    type: 'website',
    locale: 'zh_TW',
    title: 'Kozukase | 日本代購比價平台',
    description: '比較日本代購賣家的價格、評價、運送速度，找到最適合你的代購服務',
    url: 'https://kozukase.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kozukase | 日本代購比價平台',
    description: '比較日本代購賣家的價格、評價、運送速度，找到最適合你的代購服務',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Session 在伺服器讀取一次，透過 Context 傳給所有 Client Component
  // Header、settings、profile 等頁面都不需要再打 API
  const session = await getServerSession()

  return (
    <html
      lang="zh-TW"
      className={`${rubik.variable} ${inter.variable} ${notoSansTC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextTopLoader color="var(--brand-500)" height={2} showSpinner={false} />
        <NuqsAdapter>
          <TooltipProvider>
            <TRPCProvider>
              <SessionProvider value={session}>
                {children}
                <Toaster position="top-center" />
              </SessionProvider>
            </TRPCProvider>
          </TooltipProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
