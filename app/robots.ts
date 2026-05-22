import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/dashboard',
        '/account',
        '/messages',
        '/notifications',
        '/favorites',
        '/become-seller',
        '/onboarding',
        '/reset-password',
        '/forgot-password',
      ],
    },
    sitemap: 'https://kozukase.com/sitemap.xml',
  }
}
