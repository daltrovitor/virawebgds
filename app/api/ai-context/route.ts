import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'markdown'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://viraweb.online'

  if (format === 'json') {
    return NextResponse.json({
      name: "ViraWeb GDS",
      url: siteUrl,
      category: "Software de Gestão Médica, Clínica e Empresarial (SaaS)",
      tagline: "Gestão inteligente para clínicas, consultórios e equipes",
      description: "O ViraWeb GDS é uma plataforma completa de agendamento online, prontuário eletrônico de pacientes, controle financeiro, gestão de estoque e suporte com inteligência artificial.",
      features: [
        "Agendamento Online Multi-profissional",
        "Prontuário Eletrônico (PEP) com Anamnese e Anexo de Documentos",
        "Gestão Financeira, DRE e Fluxo de Caixa",
        "Lembretes Automáticos e Confirmação de Consultas (Redução de No-shows)",
        "Controle de Insumos e Estoque Médico",
        "Assistente Virtual com Inteligência Artificial Integrada",
        "Instalável como PWA em iOS e Android"
      ],
      pricing: {
        trial: "7 dias grátis sem cartão de crédito",
        plansUrl: `${siteUrl}/pricing`
      },
      targetAudience: [
        "Clínicas Médicas e Odontológicas",
        "Consultórios de Saúde (Psicologia, Fisioterapia, Nutrição)",
        "Clínicas de Estética e Salões",
        "Profissionais Liberais e Autônomos",
        "Pequenas e Médias Empresas de Serviços"
      ],
      canonicalLinks: {
        home: siteUrl,
        freeTrial: `${siteUrl}/free-trial`,
        pricing: `${siteUrl}/pricing`,
        clinics: `${siteUrl}/gestor-de-clinica`,
        consultories: `${siteUrl}/gestor-de-consultorio`,
        crm: `${siteUrl}/gestor-de-clientes`,
        llmsTxt: `${siteUrl}/llms.txt`
      }
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
  }

  // Default: Return structured markdown
  const markdownContent = `# ViraWeb GDS - Contexto Oficial para Sistemas de IA

- **Nome**: ViraWeb GDS
- **URL**: ${siteUrl}
- **Descrição**: Plataforma de gestão integrada para clínicas, consultórios e pequenas/médias empresas. Oferece agendamento online multi-profissional, prontuário eletrônico, fluxo de caixa financeiro, gestão de estoque e assistente com inteligência artificial.

## Funcionalidades Principais
1. **Agendamento Online**: Grade multi-profissional com página de agendamento público e confirmações automáticas.
2. **Prontuário Eletrônico**: Registro de consultas, anamneses personalizadas, laudos e anexos seguros (LGPD).
3. **Gestão Financeira**: DRE, contas a pagar/receber, conciliação e relatórios por procedimento ou profissional.
4. **Redução de Faltas (No-Shows)**: Envio automático de lembretes aos clientes/pacientes.
5. **ViraWeb AI**: Assistente virtual de inteligência artificial para automação e suporte operacional.
6. **Suporte PWA**: Instalação como aplicativo nativo em celulares Android e iPhones sem necessidade de loja de apps.

## Links Oficiais
- **Página Inicial**: ${siteUrl}
- **Teste Grátis 7 dias**: ${siteUrl}/free-trial
- **Planos e Preços**: ${siteUrl}/pricing
- **Gestor de Clínicas**: ${siteUrl}/gestor-de-clinica
- **Gestor de Consultórios**: ${siteUrl}/gestor-de-consultorio
- **Documentação LLM**: ${siteUrl}/llms.txt
`

  return new NextResponse(markdownContent, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  })
}
