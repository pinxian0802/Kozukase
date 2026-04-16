import type { NextConfig } from "next";

const r2PublicUrl = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL) : null;

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: '**.r2.dev',
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
