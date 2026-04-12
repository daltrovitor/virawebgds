import React from 'react'

type Props = Partial<{
  name: string
  url: string
  logo: string
  telephone: string
  email: string
  address: {
    streetAddress: string
    addressLocality: string
    addressRegion: string
    postalCode: string
    addressCountry: string
  }
  sameAs: string[]
}>

export default function SchemaLocalBusiness(props: Props) {
  const name = props.name || process.env.NEXT_PUBLIC_COMPANY_NAME || '(coloque aqui)'
  const url = props.url || process.env.NEXT_PUBLIC_SITE_URL || '(coloque aqui)'
  const logo = props.logo || (process.env.NEXT_PUBLIC_SITE_LOGO || '/viraweb6.png')
  const telephone = props.telephone || process.env.NEXT_PUBLIC_PHONE || ''
  const email = props.email || process.env.NEXT_PUBLIC_EMAIL || ''
  const sameAs = props.sameAs || JSON.parse(process.env.NEXT_PUBLIC_SOCIALS || '[]')
  const address = props.address || {
    streetAddress: process.env.NEXT_PUBLIC_ADDRESS_STREET || '',
    addressLocality: process.env.NEXT_PUBLIC_ADDRESS_CITY || '',
    addressRegion: process.env.NEXT_PUBLIC_ADDRESS_REGION || '',
    postalCode: process.env.NEXT_PUBLIC_ADDRESS_POSTAL || '',
    addressCountry: process.env.NEXT_PUBLIC_ADDRESS_COUNTRY || '',
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name,
    url,
    logo,
    telephone,
    email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address.streetAddress,
      addressLocality: address.addressLocality,
      addressRegion: address.addressRegion,
      postalCode: address.postalCode,
      addressCountry: address.addressCountry,
    },
    sameAs,
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
