import React from 'react'

type SeoProps = {
  title: string
  description: string
  slug?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  jsonLd?: object
  canonical?: string
}

export default function Seo({
  title,
  description,
  slug,
  ogTitle,
  ogDescription,
  ogImage,
  jsonLd,
  canonical
}: SeoProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://viraweb.online'
  const url = canonical || (slug ? `${siteUrl.replace(/\/$/, '')}/${slug}` : siteUrl)

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </>
  )
}

