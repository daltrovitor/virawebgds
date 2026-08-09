import React from 'react'
import type { Metadata } from 'next'
import SeoGestorDeEmpresa from '@/components/seo-gestor-de-empresa'

export const metadata: Metadata = {
  title: 'Gestor de Empresa | Sistema de Gestão para Pequenas e Médias Empresas',
  description: 'Plataforma completa de gestão empresarial para negócios de agendamento e serviços. CRM, faturamento automático, controle financeiro e inteligência artificial.',
  alternates: {
    canonical: 'https://viraweb.online/gestor-de-empresa',
  },
  openGraph: {
    title: 'Gestor de Empresa | ViraWeb GDS',
    description: 'Gerencie clientes, equipes, vendas e relatórios financeiros com praticidade e inteligência artificial.',
    url: 'https://viraweb.online/gestor-de-empresa',
  },
}

export default function Page() {
  return (
    <>
      <SeoGestorDeEmpresa />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Solução de Gestão Empresarial para Pequenas e Médias Empresas</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Consolide as operações essenciais da sua empresa no ViraWeb GDS. Desenvolvido para prestadores de serviços e negócios baseados em agendamentos, o sistema integra CRM de clientes, automação de faturamento, gestão de equipes e relatórios gerenciais em tempo real.
        </p>
        <h2 className="text-2xl font-semibold mb-3">Recursos Principais para Pequenas e Médias Empresas</h2>
        <ul className="list-disc pl-6 space-y-2 mb-8">
          <li><strong>CRM & Atendimento ao Cliente:</strong> Centralização de contatos, histórico de agendamentos e automação de relacionamento.</li>
          <li><strong>Automação de Faturamento & Cobranças:</strong> Emissão de relatórios financeiros, controle de receita por serviço e integração de pagamentos online via Stripe.</li>
          <li><strong>Gestão de Equipes e Permissões:</strong> Níveis de acesso customizados por função ou profissional da equipe.</li>
          <li><strong>Assistente de Gestão com IA:</strong> Análise preditiva de desempenho operacional e alertas inteligentes de gestão.</li>
        </ul>
      </main>
    </>
  )
}

