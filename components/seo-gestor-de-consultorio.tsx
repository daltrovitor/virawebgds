import React from 'react'
import Seo from './seo'

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "O sistema possui prontuário eletrônico?",
      "acceptedAnswer": { "@type": "Answer", "text": "Sim, com campos customizáveis e controles de acesso." }
    },
    {
      "@type": "Question",
      "name": "Posso enviar lembretes automáticos?",
      "acceptedAnswer": { "@type": "Answer", "text": "Sim, por SMS e e-mail." }
    },
    {
      "@type": "Question",
      "name": "O sistema controla convênios e faturamento?",
      "acceptedAnswer": { "@type": "Answer", "text": "Sim, com relatórios detalhados." }
    }
  ]
}

export default function SeoGestorDeConsultorio() {
  return (
    <Seo
      title="Gestor de Consultório | Agenda e Prontuário"
      description="Agendamentos, lembretes e prontuário eletrônico seguros para consultórios mais organizados."
      slug="gestor-de-consultorio"
      ogTitle="Gestor de Consultório com Agenda e Prontuário"
      ogDescription="Agenda, prontuário eletrônico e gestão financeira para consultórios eficientes."
      jsonLd={jsonLd}
    />
  )
}
