import React from 'react'
import Seo from './seo'

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "O sistema suporta múltiplos profissionais e agendas?",
      "acceptedAnswer": { "@type": "Answer", "text": "Sim, com agendas e recursos por profissional." }
    },
    {
      "@type": "Question",
      "name": "Há controle de estoque médico?",
      "acceptedAnswer": { "@type": "Answer", "text": "Sim, módulo de estoque e requisições." }
    },
    {
      "@type": "Question",
      "name": "Posso gerar relatórios por especialidade?",
      "acceptedAnswer": { "@type": "Answer", "text": "Sim, KPIs e relatórios customizáveis." }
    }
  ]
}

export default function SeoGestorDeClinica() {
  return (
    <Seo
      title="Gestor de Clínica | Gestão Integrada para Clínicas"
      description="Gerencie agenda, equipe, salas e faturamento com uma plataforma integrada."
      slug="gestor-de-clinica"
      ogTitle="Gestão para Clínicas | Agenda, Faturamento e Relatórios"
      ogDescription="Plataforma completa para gerenciar clientes, equipe e finanças."
      jsonLd={jsonLd}
    />
  )
}
