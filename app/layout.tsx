import type { Metadata } from "next";
import { Rubik, Nunito_Sans } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc/provider";
import { SessionProvider } from "@/lib/context/session-context";
import { getServerSession } from "@/lib/supabase/get-session";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kozukase | 日本代購比價平台",
  description: "比較日本代購賣家的價格、評價、運送速度，找到最適合你的代購服務",
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
      className={`${rubik.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* 點擊連結時頂部立刻出現的進度條，color 對應主色 */}
        <NextTopLoader color="#7040ef" height={3} showSpinner={false} />
        <TRPCProvider>
          <SessionProvider value={session}>
            {children}
            <Toaster richColors position="top-center" />
          </SessionProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
