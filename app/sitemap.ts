import { MetadataRoute } from 'next'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://viraweb.online').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date()

  // Base public routes
  const routes = [
    { url: '', priority: 1.0, changeFrequency: 'daily' as const },
    { url: '/free-trial', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/gestor-de-clinica', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/gestor-de-consultorio', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/gestor-de-clientes', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/gestor-de-empresa', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/manifesto', priority: 0.6, changeFrequency: 'monthly' as const },
    { url: '/pwa-tutorial', priority: 0.6, changeFrequency: 'monthly' as const },
    { url: '/termos', priority: 0.4, changeFrequency: 'monthly' as const },
    { url: '/privacidade', priority: 0.4, changeFrequency: 'monthly' as const },
    { url: '/lgpd', priority: 0.4, changeFrequency: 'monthly' as const },
  ]

  const sitemapEntries: MetadataRoute.Sitemap = []

  for (const route of routes) {
    const mainUrl = `${SITE_URL}${route.url}`

    sitemapEntries.push({
      url: mainUrl,
      lastModified: currentDate,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: {
          'pt-BR': `${SITE_URL}/pt-BR${route.url}`,
          'en': `${SITE_URL}/en${route.url}`,
        },
      },
    })

    // Also include locale specific URLs
    sitemapEntries.push({
      url: `${SITE_URL}/pt-BR${route.url}`,
      lastModified: currentDate,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })

    sitemapEntries.push({
      url: `${SITE_URL}/en${route.url}`,
      lastModified: currentDate,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })
  }

  return sitemapEntries
}

