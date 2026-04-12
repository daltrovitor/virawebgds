import React from 'react'
import SeoGestorDeClientes from '@/components/seo-gestor-de-clientes'

export const metadata = {
  title: 'Gestão de Clientes inteligente',
}

export default function Page() {
  return (
    <>
      <SeoGestorDeClientes />
      <main>
        <h1>Gestão de Clientes Inteligente para Crescer seu Negócio</h1>
        <p>
          Tenha controle completo sobre o relacionamento com seus clientes usando um gestor de clientes projetado para escalar seu negócio. Centralize contatos, registre interações e histórico de compras, segmente sua base e automatize follow-ups personalizados para reduzir churn. Relatórios intuitivos mostram comportamento de compra e oportunidades de up‑sell, enquanto automações liberam sua equipe para focar no atendimento.
        </p>
        <h2>Benefícios</h2>
        <ul>
          <li>Centralização de dados</li>
          <li>Aumenta retenção</li>
          <li>Automação de comunicações</li>
        </ul>
      </main>
    </>
  )
}
