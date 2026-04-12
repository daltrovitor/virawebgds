import { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://(coloque-aqui)'

export default function sitemap(): MetadataRoute.Sitemap {
  // Return an empty sitemap to avoid metadata route generation issues.
  return []
}
