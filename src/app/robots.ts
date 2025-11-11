/**
 * Robots.txt Generation
 * Tells search engines where to find sitemap and what to crawl
 */

import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wantcar.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/debug/',
          '/_next/',
          '/admin/'
        ]
      }
    ],
    sitemap: `${BASE_URL}/sitemap.xml`
  }
}
