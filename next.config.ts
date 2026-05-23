import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const r2PublicUrl = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL) : null;

const nextConfig: NextConfig = {
	allowedDevOrigins: ['wisplike-marina-emphasis.ngrok-free.dev'],
	async headers() {
		// 寬鬆 CSP：允許 self + 必要外部來源；保留 'unsafe-inline'/'unsafe-eval'
		// 以相容 Next.js 與 Sentry。img/connect 放寬到 https:（站上有大量
		// 遠端圖床、Supabase Realtime wss、Sentry ingest）。
		const csp = [
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			// heic-to(HEIC→webp 轉換)用 new Worker(URL.createObjectURL(blob)) 建 worker,
			// 需允許 blob: worker,否則 iPhone .heic 上傳會出現空的「Worker error: {}」
			"worker-src 'self' blob:",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https:",
			"font-src 'self' data:",
			"connect-src 'self' https: wss:",
			"frame-src 'self'",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"object-src 'none'",
		].join('; ');

		return [
			{
				source: '/:path*',
				headers: [
					{ key: 'Content-Security-Policy', value: csp },
					{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
					{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
				],
			},
		];
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: '**.r2.dev',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'm.media-amazon.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'mimigo.tw',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'pic.pimg.tw',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'sv9-cdn.stylevana.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'absolute.maeil.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'www.koreanbeautysecret.com.hk',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'lookaside.fbsbx.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'beautyboxkorea.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'beautitu.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'www.shegoestoseoul.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'www.fancylife.com.au',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'cdn.cybassets.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'www.calbee.co.jp',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'japanesetaste.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'roycechocolate.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'shop.tigertaiwan.com.tw',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'wafuu.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: 'placehold.co',
				pathname: '/**',
			},
			...(r2PublicUrl
				? [{
					protocol: r2PublicUrl.protocol.replace(':', '') as 'http' | 'https',
					hostname: r2PublicUrl.hostname,
					pathname: '/**',
				}]
				: []),
		],
	},
};

export default withSentryConfig(nextConfig, {
	// Sentry 組織 / 專案（source map 上傳目標）
	org: "pinxian-chiang",
	project: "kozukase",

	// SENTRY_AUTH_TOKEN 由環境變數自動讀取（.env.local / Vercel）
	// 非 CI 時靜音 wizard log
	silent: !process.env.CI,

	// 涵蓋更廣的 client 檔案以利 source map 還原
	widenClientFileUpload: true,

	// 移除 Sentry SDK debug log，縮小 bundle
	disableLogger: true,
});
