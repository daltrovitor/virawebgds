import React from 'react'
import Seo from './seo'

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Como um gestor de clientes ajuda meu negócio?",
      "acceptedAnswer": { "@type": "Answer", "text": "Centraliza dados, automatiza comunicações e melhora a retenção e conversão." }
    },
    {
      "@type": "Question",
      "name": "Posso migrar dados de outro CRM?",
      "acceptedAnswer": { "@type": "Answer", "text": "Sim; oferecemos ferramentas de importação e suporte para migração segura." }
    },
    {
      "@type": "Question",
      "name": "Quais integrações estão disponíveis?",
      "acceptedAnswer": { "@type": "Answer", "text": "Integrações com e-mail, calendário, pagamentos e ferramentas de marketing." }
    }
  ]
}

export default function SeoGestorDeClientes() {
  return (
    <Seo
      title="Gestão de Clientes eficiente | [Seu Produto]"
      description="Centralize contatos, registre histórico e aumente retenção com automações simples."
      slug="gestor-de-clientes"
      ogTitle="Gestão de Clientes eficiente | [Seu Produto]"
      ogDescription="Centralize contatos, automatize atendimentos e aumente retenção."
      jsonLd={jsonLd}
    />
  )
}
