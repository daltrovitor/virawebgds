"use client"

import LegalPageLayout, {
  InfoBox,
  WarningBox,
  DataList,
  type LegalSection,
} from "@/components/legal/legal-page-layout"
import {
  FileText,
  Shield,
  Scale,
  UserCheck,
  CreditCard,
  AlertTriangle,
  Ban,
  RefreshCw,
  Gavel,
  Mail,
  BookOpen,
  Server,
  Globe,
  Briefcase,
} from "lucide-react"
import { useLocale, useTranslations } from 'next-intl'

export default function TermsPage() {
  const locale = useLocale()
  const isEn = locale === 'en'

  const sections: LegalSection[] = isEn ? [
    {
      id: "acceptance",
      title: "Acceptance of Terms",
      icon: <BookOpen className="w-4 h-4" />,
      content: (
        <>
          <p>
            Welcome to <strong>ViraWeb</strong>. By accessing or using the ViraWeb platform, available at{" "}
            <a href="https://viraweb.online" target="_blank" rel="noopener noreferrer">
              viraweb.online
            </a>{" "}
            and its subdomains (including <code>gdc.viraweb.online</code> and <code>admin.viraweb.online</code>), you
            declare that you have read, understood, and agree to these Terms of Service.
          </p>
          <WarningBox>
            If you do not agree with any of the terms presented, please do not use the platform. Continued use of ViraWeb constitutes full acceptance of these terms and any updates.
          </WarningBox>
          <p>
            These terms constitute a binding legal agreement between you ("User", "Client" or "Subscriber") and the company responsible for ViraWeb ("we", "our" or "ViraWeb"), regulating access and use of the software as a service (SaaS) for client management, scheduling, and business operations.
          </p>
        </>
      ),
    },
    {
      id: "service-description",
      title: "Service Description",
      icon: <Globe className="w-4 h-4" />,
      content: (
        <>
          <p>
            ViraWeb is a SaaS (Software as a Service) platform designed for professionals and companies that need to manage their operations efficiently. The platform offers the following main features:
          </p>
          <ul>
            <li><strong>Client Management</strong> — Complete record with name, email, phone, Tax ID, date of birth, address, clinical notes and profile photo</li>
            <li><strong>Professional Management</strong> — Team registration with specialties, CRM, working days and commissions</li>
            <li><strong>Scheduling</strong> — Calendar system with scheduling, confirmation, cancellation and attendance control</li>
            <li><strong>Integrated Financials</strong> — Control of payments, receipts, discounts, recurrences and detailed financial reports</li>
            <li><strong>ViraBot AI</strong> — Artificial intelligence assistant available 24/7 for data analysis, insights and automated support (available in Premium and Master plans)</li>
            <li><strong>Smart Import</strong> — AI-automated import of PDF, CSV, XLSX files and images with optical character recognition (OCR)</li>
            <li><strong>Reports and Goals</strong> — Analytical dashboards with performance visualization, tracked goals and dynamic checklists</li>
            <li><strong>Push Notifications</strong> — Reminders and alerts via Firebase Cloud Messaging for appointments and events</li>
            <li><strong>Support System</strong> — Support tickets with direct communication with the ViraWeb team</li>
          </ul>
          <InfoBox>
            Feature availability varies by subscription plan (Basic, Premium or Master). Refer to the plans page for more details on each level.
          </InfoBox>
        </>
      ),
    },
    {
        id: "user-account",
        title: "User Account",
        icon: <UserCheck className="w-4 h-4" />,
        content: (
          <>
            <p>
              To use ViraWeb, it is necessary to create an account providing true and up-to-date information. Registration can be done via email and password or through Google authentication (OAuth).
            </p>
            <h3>User Responsibilities</h3>
            <ul>
              <li>Maintain the confidentiality of your access credentials (email and password)</li>
              <li>Provide true, accurate and updated information in the registration</li>
              <li>Immediately notify ViraWeb of any unauthorized use of your account</li>
              <li>Be responsible for all activities performed in your account, including actions of authorized third parties</li>
              <li>Ensure that the use of the platform complies with all applicable laws</li>
            </ul>
            <h3>Usage Restrictions</h3>
            <p>By using ViraWeb, you agree NOT to:</p>
            <ul>
              <li>Use the platform for illegal, fraudulent or unauthorized purposes</li>
              <li>Share access credentials with unauthorized third parties</li>
              <li>Attempt to access restricted areas of the system or other users</li>
              <li>Perform reverse engineering, decompile or modify the software</li>
              <li>Utilize robots, scrapers or automated tools without prior authorization</li>
            </ul>
            <WarningBox>
              ViraWeb reserves the right to suspend or terminate accounts that violate these rules, without prior notice and without refund.
            </WarningBox>
          </>
        ),
      },
      {
        id: "plans-payments",
        title: "Plans and Payments",
        icon: <CreditCard className="w-4 h-4" />,
        content: (
          <>
            <p>
              ViraWeb operates with a monthly subscription model, offering three plans that meet different needs:
            </p>
            <DataList
              items={[
                { label: "Basic Plan", value: "R$ 75.00/month — Up to 75 clients, 7 professionals, 50 appointments/month" },
                { label: "Premium Plan", value: "R$ 150.00/month — Up to 500 clients, 50 professionals, 500 appointments/month + ViraBot AI" },
                { label: "Master Plan", value: "R$ 250.00/month — Unlimited resources + ViraBot AI + 24/7 Support + Dedicated Manager" },
              ]}
            />
            <h3>Free Trial Period</h3>
            <p>
              New users can have access to a <strong>14-day</strong> free trial period with features of the Premium plan. At the end of the trial period, access will be converted to the chosen plan or suspended if no plan is selected.
            </p>
            <h3>Payment Processing</h3>
            <p>
              Payments are processed securely by <strong>Stripe</strong>. ViraWeb does not store credit card data on its servers.
            </p>
            <h3>Renewal and Cancellation</h3>
            <ul>
              <li>Subscriptions automatically renew at the end of each monthly cycle</li>
              <li>The User can cancel the subscription at any time through the settings panel</li>
              <li>After cancellation, access remains active until the end of the already paid period</li>
              <li>There is no proportional refund for partial periods</li>
            </ul>
          </>
        ),
      },
      {
        id: "intellectual-property",
        title: "Intellectual Property",
        icon: <Briefcase className="w-4 h-4" />,
        content: (
          <>
            <p>
              All content, design, source code, logos, brands, texts, images, AI algorithms (including ViraBot) and other materials present on the ViraWeb platform are the exclusive property of ViraWeb or its licensors.
            </p>
            <ul>
              <li>The user license granted is <strong>limited, non-exclusive, non-transferable and revocable</strong></li>
              <li>The data entered by the User remains the property of the User</li>
              <li>The User grants ViraWeb a limited license to process their data exclusively for the provision of the contracted service</li>
            </ul>
          </>
        ),
      },
      {
        id: "contact",
        title: "Contact",
        icon: <Mail className="w-4 h-4" />,
        content: (
          <>
            <p>For questions or communications related to these Terms of Service, contact us:</p>
            <DataList
              items={[
                { label: "Email", value: "contato@viraweb.online" },
                { label: "WhatsApp", value: "Available in the support panel" },
                { label: "Support", value: "Support Menu > New Ticket" },
              ]}
            />
          </>
        ),
      }
  ] : [
    {
      id: "aceitacao",
      title: "Aceitação dos Termos",
      icon: <BookOpen className="w-4 h-4" />,
      content: (
        <>
          <p>
            Bem-vindo ao <strong>ViraWeb</strong>. Ao acessar ou utilizar a plataforma ViraWeb, disponível em{" "}
            <a href="https://viraweb.online" target="_blank" rel="noopener noreferrer">
              viraweb.online
            </a>{" "}
            e seus subdomínios (incluindo <code>gdc.viraweb.online</code> e <code>admin.viraweb.online</code>), você
            declara que leu, compreendeu e concorda com estes Termos de Serviço.
          </p>
          <WarningBox>
            Se você não concorda com algum dos termos apresentados, por favor, não utilize a plataforma. O uso
            continuado do ViraWeb constitui aceitação plena destes termos e de eventuais atualizações.
          </WarningBox>
          <p>
            Estes termos constituem um acordo legal vinculante entre você ("Usuário", "Cliente" ou "Assinante") e
            a empresa responsável pelo ViraWeb ("nós", "nossa" ou "ViraWeb"), regulando o acesso e uso do
            software como serviço (SaaS) de gestão de clientes, agendamentos e operações empresariais.
          </p>
        </>
      ),
    },
    {
      id: "descricao-servico",
      title: "Descrição do Serviço",
      icon: <Globe className="w-4 h-4" />,
      content: (
        <>
          <p>
            O ViraWeb é uma plataforma SaaS (Software como Serviço) projetada para profissionais e empresas que
            precisam gerenciar suas operações de forma eficiente. A plataforma oferece as seguintes funcionalidades
            principais:
          </p>
          <ul>
            <li>
              <strong>Gestão de Clientes (Pacientes)</strong> — Cadastro completo com nome, email, telefone, CPF,
              data de nascimento, endereço, notas clínicas e foto de perfil
            </li>
            <li>
              <strong>Gestão de Profissionais</strong> — Registro de equipe com especialidades, CRM, dias de
              trabalho e comissões
            </li>
            <li>
              <strong>Agendamentos</strong> — Sistema de calendário com agendamento, confirmação, cancelamento e
              controle de presença
            </li>
            <li>
              <strong>Financeiro Integrado</strong> — Controle de pagamentos, recebimentos, descontos,
              recorrências e relatórios financeiros detalhados
            </li>
            <li>
              <strong>ViraBot IA</strong> — Assistente de inteligência artificial disponível 24/7 para análise de
              dados, insights e suporte automatizado (disponível nos planos Premium e Master)
            </li>
            <li>
              <strong>Importação Inteligente</strong> — Importação automatizada por IA de arquivos PDF, CSV, XLSX
              e imagens com reconhecimento óptico (OCR)
            </li>
            <li>
              <strong>Relatórios e Metas</strong> — Dashboards analíticos com visualização de desempenho, metas
              acompanhadas e checklists dinâmicos
            </li>
            <li>
              <strong>Notificações Push</strong> — Lembretes e alertas via Firebase Cloud Messaging para
              agendamentos e eventos
            </li>
            <li>
              <strong>Sistema de Suporte</strong> — Tickets de suporte com comunicação direta com a equipe ViraWeb
            </li>
          </ul>
          <InfoBox>
            A disponibilidade de recursos varia conforme o plano contratado (Básico, Premium ou Master). Consulte
            a página de planos para mais detalhes sobre cada nível.
          </InfoBox>
        </>
      ),
    },
    {
      id: "conta-usuario",
      title: "Conta do Usuário",
      icon: <UserCheck className="w-4 h-4" />,
      content: (
        <>
          <p>
            Para utilizar o ViraWeb, é necessário criar uma conta fornecendo informações verdadeiras e atualizadas.
            O cadastro pode ser feito via email e senha ou através de autenticação pelo Google (OAuth).
          </p>
          <h3>Responsabilidades do Usuário</h3>
          <ul>
            <li>Manter a confidencialidade de suas credenciais de acesso (email e senha)</li>
            <li>Fornecer informações verdadeiras, precisas e atualizadas no cadastro</li>
            <li>
              Notificar imediatamente o ViraWeb sobre qualquer uso não autorizado da sua conta
            </li>
            <li>
              Ser responsável por todas as atividades realizadas em sua conta, incluindo ações de terceiros
              autorizados por você
            </li>
            <li>
              Garantir que o uso da plataforma está em conformidade com todas as leis aplicáveis, incluindo a LGPD
            </li>
          </ul>
          <h3>Restrições de Uso</h3>
          <p>Ao usar o ViraWeb, você concorda em NÃO:</p>
          <ul>
            <li>Utilizar a plataforma para fins ilegais, fraudulentos ou não autorizados</li>
            <li>Compartilhar credenciais de acesso com terceiros não autorizados</li>
            <li>Tentar acessar áreas restritas do sistema ou de outros usuários</li>
            <li>Realizar engenharia reversa, descompilar ou modificar o software</li>
            <li>
              Armazenar dados sensíveis de saúde sem as devidas autorizações legais do titular dos dados
            </li>
            <li>Utilizar robôs, scrapers ou ferramentas automatizadas sem autorização prévia</li>
          </ul>
          <WarningBox>
            O ViraWeb se reserva o direito de suspender ou encerrar contas que violem estas regras, sem aviso prévio
            e sem reembolso.
          </WarningBox>
        </>
      ),
    },
    {
      id: "planos-pagamentos",
      title: "Planos e Pagamentos",
      icon: <CreditCard className="w-4 h-4" />,
      content: (
        <>
          <p>
            O ViraWeb opera com um modelo de assinatura mensal, oferecendo três planos que atendem diferentes
            necessidades:
          </p>
          <DataList
            items={[
              { label: "Plano Básico", value: "R$ 75,00/mês — Até 75 clientes, 7 profissionais, 50 agendamentos/mês" },
              { label: "Plano Premium", value: "R$ 150,00/mês — Até 500 clientes, 50 profissionais, 500 agendamentos/mês + ViraBot IA" },
              { label: "Plano Master", value: "R$ 250,00/mês — Recursos ilimitados + ViraBot IA + Suporte 24/7 + Gerente dedicado" },
            ]}
          />
          <h3>Período de Teste Gratuito</h3>
          <p>
            Novos usuários podem ter acesso a um período de teste gratuito de <strong>14 dias</strong> com
            funcionalidades do plano Premium. Ao término do período de teste, o acesso será convertido para o plano
            escolhido ou suspenso caso nenhum plano seja selecionado.
          </p>
          <h3>Processamento de Pagamentos</h3>
          <p>
            Os pagamentos são processados de forma segura pelo <strong>Stripe</strong>. O ViraWeb não armazena dados de cartão de crédito em seus servidores.
          </p>
          <h3>Renovação e Cancelamento</h3>
          <ul>
            <li>As assinaturas são renovadas automaticamente ao final de cada ciclo mensal</li>
            <li>O Usuário pode cancelar a assinatura a qualquer momento pelo painel de configurações</li>
            <li>
              Após o cancelamento, o acesso permanece ativo até o final do período já pago
            </li>
            <li>Não há reembolso proporcional para períodos parciais</li>
          </ul>
        </>
      ),
    },
    {
      id: "propriedade-intelectual",
      title: "Propriedade Intelectual",
      icon: <Briefcase className="w-4 h-4" />,
      content: (
        <>
          <p>
            Todo o conteúdo, design, código-fonte, logotipos, marcas, textos, imagens, algoritmos de inteligência
            artificial (incluindo o ViraBot) e demais materiais presentes na plataforma ViraWeb são de propriedade
            exclusiva da ViraWeb ou de seus licenciadores.
          </p>
          <ul>
            <li>
              A licença de uso concedida ao Usuário é <strong>limitada, não exclusiva, intransferível e
              revogável</strong>
            </li>
            <li>Os dados inseridos pelo Usuário permanecem de propriedade do Usuário</li>
            <li>
              O Usuário concede ao ViraWeb uma licença limitada para processar seus dados exclusivamente para a
              prestação do serviço contratado
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "contato",
      title: "Contato",
      icon: <Mail className="w-4 h-4" />,
      content: (
        <>
          <p>
            Para dúvidas, solicitações ou comunicações relacionadas a estes Termos de Serviço, entre em contato
            conosco:
          </p>
          <DataList
            items={[
              { label: "Email", value: "contato@viraweb.online" },
              { label: "WhatsApp", value: "Disponível no painel de suporte" },
              { label: "Suporte na plataforma", value: "Menu Suporte > Novo Ticket" },
              { label: "Horário de atendimento", value: "Varia conforme o plano contratado" },
            ]}
          />
        </>
      ),
    },
  ]

  return (
    <LegalPageLayout
      title={isEn ? "Terms of Service" : "Termos de Serviço"}
      description={isEn ? "Please read carefully the terms that govern the use of the ViraWeb platform. Our commitment is to offer total transparency about rights and responsibilities." : "Leia com atenção os termos que regem o uso da plataforma ViraWeb. Nosso compromisso é oferecer transparência total sobre direitos e responsabilidades."}
      lastUpdated="2026-04-11"
      badgeLabel={isEn ? "Terms of Service" : "Termos de Serviço"}
      badgeIcon={<FileText className="w-4 h-4 text-primary" />}
      sections={sections}
      relatedPages={[
        { href: `/${locale}/privacidade`, label: isEn ? "Privacy Policy" : "Política de Privacidade", icon: <Shield className="w-3.5 h-3.5" /> },
        { href: `/${locale}/lgpd`, label: isEn ? "LGPD Compliance" : "Conformidade LGPD", icon: <Scale className="w-3.5 h-3.5" /> },
      ]}
    />
  )
}
