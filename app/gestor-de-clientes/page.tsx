import React from 'react'
import type { Metadata } from 'next'
import SeoGestorDeClientes from '@/components/seo-gestor-de-clientes'

export const metadata: Metadata = {
  title: 'Gestor de Clientes & CRM | Centralize Contatos e Fidelize Clientes',
  description: 'Sistema completo de gestão de clientes (CRM). Histórico de atendimentos, segmentação da base, automação de relacionamento e relatórios de retenção.',
  alternates: {
    canonical: 'https://viraweb.online/gestor-de-clientes',
  },
  openGraph: {
    title: 'Gestor de Clientes & CRM | ViraWeb GDS',
    description: 'Centralize dados, automatize comunicações e reduza a perda de clientes com a plataforma ViraWeb.',
    url: 'https://viraweb.online/gestor-de-clientes',
  },
}

export default function Page() {
  return (
    <>
      <SeoGestorDeClientes />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Gestão de Clientes Inteligente e CRM para Crescer seu Negócio</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Tenha controle completo sobre o relacionamento com seus clientes e pacientes usando o módulo de CRM do ViraWeb GDS. Centralize fichas de contato, acompanhe o histórico de agendamentos e vendas, segmente sua base e automatize follow-ups personalizados para aumentar a taxa de retenção.
        </p>
        <h2 className="text-2xl font-semibold mb-3">Benefícios do Gestor de Clientes ViraWeb</h2>
        <ul className="list-disc pl-6 space-y-2 mb-8">
          <li><strong>Centralização da Base de Clientes:</strong> Ficha unificada com histórico de consultas, pagamentos, preferências e notas de atendimento.</li>
          <li><strong>Retenção & Lembretes de Retorno:</strong> Identificação automática de clientes inativos para ações de reativação e pós-venda.</li>
          <li><strong>Segmentação Inteligente:</strong> Agrupamento por perfil de consumo, frequência de agendamento e preferências de serviços.</li>
          <li><strong>Importação e Exportação de Dados:</strong> Facilidade para migrar cadastros via planilhas CSV/Excel com segurança total.</li>
        </ul>
      </main>
    </>
  )
}

