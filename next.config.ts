import type { NextConfig } from "next";

const r2PublicUrl = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL) : null;

const nextConfig: NextConfig = {
	allowedDevOrigins: ['wisplike-marina-emphasis.ngrok-free.dev'],
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

export default nextConfig;
