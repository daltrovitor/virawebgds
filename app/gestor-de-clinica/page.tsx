import React from 'react'
import type { Metadata } from 'next'
import SeoGestorDeClinica from '@/components/seo-gestor-de-clinica'

export const metadata: Metadata = {
  title: 'Gestor de Clínica | Sistema Completo de Gestão para Clínicas',
  description: 'Otimize sua clínica com agendamento online de múltiplos profissionais, prontuário eletrônico, controle de estoque e faturamento financeiro.',
  alternates: {
    canonical: 'https://viraweb.online/gestor-de-clinica',
  },
  openGraph: {
    title: 'Gestor de Clínica | ViraWeb GDS',
    description: 'Sistema completo para gerenciar clínicas médicas, odontológicas e estéticas com facilidade e inteligência.',
    url: 'https://viraweb.online/gestor-de-clinica',
  },
}

export default function Page() {
  return (
    <>
      <SeoGestorDeClinica />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Gestão Integrada para Clínicas Médicas, Odontológicas e de Saúde</h1>
        <p className="text-lg text-muted-foreground mb-6">
          O ViraWeb GDS é a plataforma definitiva de gestão para clínicas de pequeno e médio porte. Centralize agendamentos online multi-profissional, prontuários eletrônicos de pacientes, gestão de salas e equipamentos, controle de estoque médico e relatório financeiro em tempo real.
        </p>
        <h2 className="text-2xl font-semibold mb-3">Principais Recursos para Clínicas</h2>
        <ul className="list-disc pl-6 space-y-2 mb-8">
          <li><strong>Agendamento Multi-profissional:</strong> Grade inteligente individualizada por médico/terapeuta com bloqueio de salas.</li>
          <li><strong>Prontuário Eletrônico de Saúde (PEP):</strong> Histórico completo de consultas, anamneses e exames em nuvem com criptografia.</li>
          <li><strong>Redução de No-Shows:</strong> Confirmação e lembretes automáticos de agendamento enviados aos pacientes.</li>
          <li><strong>Gestão de Insumos e Estoque:</strong> Alertas de estoque baixo e controle automático de materiais consumidos por atendimento.</li>
          <li><strong>Faturamento e DRE Financeiro:</strong> Apuração de receita por profissional, relatórios de rentabilidade e gestão de contas.</li>
        </ul>
      </main>
    </>
  )
}

