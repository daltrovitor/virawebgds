import React from 'react'
import type { Metadata } from 'next'
import { generateMetadataForSlug } from '../../../lib/seo'
import Seo from '../../../components/seo'

type Params = { params: { slug: string } }

// Example: dynamic metadata for /posts/[slug]
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = params

  // Example fetch pattern - replace with your data source (CMS / DB)
  // const res = await fetch(`${process.env.API_URL}/posts/${slug}`)
  // const post = await res.json()

  // Placeholder data (replace with actual fetch)
  const post = {
    title: `Título do post — ${slug}`,
    description: `Descrição do post ${slug} para SEO.`,
    image: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/og-image.png`,
    keywords: ['gestão', 'clientes', 'viraweb'],
  }

  return generateMetadataForSlug({
    title: post.title,
    description: post.description,
    slug: `posts/${slug}`,
    image: post.image,
    keywords: post.keywords,
  })
}

export default async function Page({ params }: Params) {
  const { slug } = params

  // Replace with real data fetching
  const post = {
    title: `Título do post — ${slug}`,
    content: `Conteúdo de demonstração para o post ${slug}. Substitua por conteúdo real.`,
  }

  return (
    <>
      <Seo
        title={post.title}
        description={post.content.slice(0, 140)}
        slug={`posts/${slug}`}
      />
      <main>
        <h1>{post.title}</h1>
        <p>{post.content}</p>
      </main>
    </>
  )
}
