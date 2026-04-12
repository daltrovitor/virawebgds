import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://(coloque-aqui)'
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || '(coloque aqui)'

export function generateMetadataForSlug(data: {
  title?: string
  description?: string
  slug?: string
  image?: string
  keywords?: string[]
}): Metadata {
  const title = data.title || SITE_NAME
  const description = data.description || '(coloque aqui)'
  const url = data.slug ? `${SITE_URL.replace(/\/$/, '')}/${data.slug}` : SITE_URL

  return {
    title,
    description,
    keywords: data.keywords,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: data.image ? [{ url: data.image }] : undefined,
      type: 'website',
    },
    twitter: {
      card: data.image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: data.image ? [data.image] : undefined,
    },
  }
}
