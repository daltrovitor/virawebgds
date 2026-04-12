import React from 'react'
import Seo from './seo'

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Esse gestor substitui um ERP tradicional?",
      "acceptedAnswer": { "@type": "Answer", "text": "Para muitas PMEs, sim; oferecemos módulos que cobrem vendas, finanças e CRM." }
    },
    {
      "@type": "Question",
      "name": "É possível integrar com minha contabilidade?",
      "acceptedAnswer": { "@type": "Answer", "text": "Sim, via exportação de dados e integrações diretas." }
    },
    {
      "@type": "Question",
      "name": "Há automações de faturamento e cobranças?",
      "acceptedAnswer": { "@type": "Answer", "text": "Sim, com agendamento e regras personalizáveis." }
    }
  ]
}

export default function SeoGestorDeEmpresa() {
  return (
    <Seo
      title="Gestão Empresarial para PMEs | Controle e Automação"
      description="Centralize operações, clientes e finanças com dashboards e automações simples."
      slug="gestor-de-empresa"
      ogTitle="Gestão Empresarial para PMEs | Controle e Automação"
      ogDescription="Centralize vendas, finanças e processos com uma plataforma que cresce com sua empresa."
      jsonLd={jsonLd}
    />
  )
}
