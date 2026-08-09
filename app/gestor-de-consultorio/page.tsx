import React from 'react'
import type { Metadata } from 'next'
import SeoGestorDeConsultorio from '@/components/seo-gestor-de-consultorio'

export const metadata: Metadata = {
  title: 'Gestor de Consultório | Agenda, Prontuário Eletrônico e Cobrança',
  description: 'Simplifique a rotina do seu consultório médico ou de saúde. Agendamento online, prontuário eletrônico seguro, lembretes automáticos e controle financeiro.',
  alternates: {
    canonical: 'https://viraweb.online/gestor-de-consultorio',
  },
  openGraph: {
    title: 'Gestor de Consultório | ViraWeb GDS',
    description: 'Sistema completo para consultórios individuais de médicos, psicólogos, fisioterapeutas e dentistas.',
    url: 'https://viraweb.online/gestor-de-consultorio',
  },
}

export default function Page() {
  return (
    <>
      <SeoGestorDeConsultorio />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Gestão Completa para Consultórios: Agenda, Prontuário e Cobrança</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Simplifique a rotina do seu consultório com o ViraWeb GDS. Reúna agendamento online de consultas, prontuário eletrônico com histórico de anamnese e controle financeiro integrado em uma única interface acessível por computador ou celular.
        </p>
        <h2 className="text-2xl font-semibold mb-3">Recursos Essenciais para Consultórios Independente</h2>
        <ul className="list-disc pl-6 space-y-2 mb-8">
          <li><strong>Agendamento Online & Lembretes:</strong> Envio automático de confirmação de consulta para reduzir faltas (no-shows).</li>
          <li><strong>Prontuário Eletrônico Seguro (LGPD):</strong> Registre histórico de consultas, diagnósticos e anexos protegidos por criptografia.</li>
          <li><strong>Controle de Convênios & Faturamento:</strong> Acompanhe valores a receber por consulta, procedimento ou recibos de pacientes.</li>
          <li><strong>Acesso Mobile PWA:</strong> Consulte sua agenda e prontuários diretamente do iPhone, iPad ou celular Android.</li>
        </ul>
      </main>
    </>
  )
}

