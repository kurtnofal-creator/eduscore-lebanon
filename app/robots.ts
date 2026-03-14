import type { MetadataRoute } from 'next'

// Beta mode: block all search engine indexing.
// Remove BETA_NO_INDEX env var (or set to "false") to enable indexing at public launch.
const BETA_NO_INDEX = process.env.BETA_NO_INDEX !== 'false'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eduscore.lb'

  if (BETA_NO_INDEX) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/login', '/dashboard'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
