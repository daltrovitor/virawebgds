import Head from 'next/head'
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  const url = canonical || (siteUrl && slug ? `${siteUrl.replace(/\/$/, '')}/${slug}` : undefined)

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {url && <link rel="canonical" href={url} />}

      <meta property="og:type" content="website" />
      <meta property="og:title" content={ogTitle || title} />
      <meta property="og:description" content={ogDescription || description} />
      {ogImage && <meta property="og:image" content={ogImage} />}

      <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={ogTitle || title} />
      <meta name="twitter:description" content={ogDescription || description} />

      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </Head>
  )
}
