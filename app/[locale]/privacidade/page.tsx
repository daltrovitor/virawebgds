"use client"

import LegalPageLayout, {
  InfoBox,
  WarningBox,
  DataList,
  type LegalSection,
} from "@/components/legal/legal-page-layout"
import {
  Shield,
  FileText,
  Scale,
  Eye,
  Database,
  Cookie,
  Share2,
  Lock,
  UserCog,
  Bell,
  Mail,
  Globe,
  Server,
  Fingerprint,
  BarChart3,
} from "lucide-react"
import { useLocale, useTranslations } from 'next-intl'

export default function PrivacyPage() {
  const locale = useLocale()
  const isEn = locale === 'en'

  const sections: LegalSection[] = isEn ? [
    {
      id: "introduction",
      title: "Introduction",
      icon: <Eye className="w-4 h-4" />,
      content: (
        <>
          <p>
            <strong>ViraWeb</strong> deeply values the privacy of its users. This Privacy Policy describes how we collect, use, store, share, and protect personal information when you use our management platform, available at{" "}
            <a href="https://viraweb.online" target="_blank" rel="noopener noreferrer">
              viraweb.online
            </a>{" "}
            and its subdomains.
          </p>
          <p>
            This policy was drafted in compliance with the <strong>General Data Protection Law (LGPD — Law No. 13,709/2018)</strong>, the <strong>Brazilian Civil Rights Framework for the Internet (Law No. 12,965/2014)</strong>, and other applicable data protection regulations in Brazil.
          </p>
          <InfoBox>
            By using ViraWeb, you confirm that you have read and understood this Privacy Policy. We recommend reading this document in its entirety.
          </InfoBox>
        </>
      ),
    },
    {
      id: "data-collection",
      title: "Data Collection",
      icon: <Database className="w-4 h-4" />,
      content: (
        <>
          <h3>Personal Data Provided by You</h3>
          <p>
            When creating your account and using ViraWeb, we collect the following data that you provide directly:
          </p>
          <DataList
            items={[
              { label: "Identification data", value: "Full name, email address, phone number" },
              { label: "Access data", value: "Email and password (cryptographic hash via Supabase Auth) or Google OAuth authentication" },
              { label: "Professional data", value: "Clinic/company name, National Tax ID (when applicable)" },
              { label: "Payment data", value: "Processed directly by Stripe — we do not store card data" },
            ]}
          />
          <h3>Client (Patient) Data Entered by You</h3>
          <p>
            As the controller of your clients/patients' data, you can register in the platform:
          </p>
          <DataList
            items={[
              { label: "Identification", value: "Name, email, phone, Tax ID, date of birth" },
              { label: "Address", value: "Full address when informed" },
              { label: "Clinical data", value: "Notes, records and service observations" },
              { label: "Financial data", value: "Payment history, amounts, billing status" },
              { label: "Image", value: "Client profile photo (when sent)" },
            ]}
          />
          <WarningBox>
            You, as the operator and controller of your clients/patients' data, are responsible for obtaining proper consent for processing this information according to LGPD. ViraWeb acts as the processor of this data.
          </WarningBox>
        </>
      ),
    },
    {
      id: "how-we-use",
      title: "How We Use Data",
      icon: <BarChart3 className="w-4 h-4" />,
      content: (
        <>
          <p>The collected data is used for the following purposes:</p>
          <ul>
            <li><strong>Service provision</strong> — Allow the platform to function, including client registration, scheduling, financial control and report generation</li>
            <li><strong>Authentication and security</strong> — Verify user identity, manage sessions and protect against unauthorized access</li>
            <li><strong>Payment processing</strong> — Manage subscriptions, billing and receipts via Stripe</li>
            <li><strong>Notifications</strong> — Send appointment reminders, system alerts and support communications</li>
            <li><strong>ViraBot AI</strong> — Process requests from the AI assistant to provide insights and operational support</li>
          </ul>
        </>
      ),
    },
    {
        id: "cookies",
        title: "Cookies and Tracking",
        icon: <Cookie className="w-4 h-4" />,
        content: (
          <>
            <p>
              ViraWeb uses cookies and similar storage technologies. We request your explicit consent through a cookie banner for non-essential cookies.
            </p>
            <h3>Cookies Used</h3>
            <DataList
              items={[
                { label: "Session cookies", value: "Essential to keep your authentication active (Supabase Auth)" },
                { label: "Preference cookies", value: "Theme (light/dark), selected language (pt-BR/en)" },
              ]}
            />
          </>
        ),
      },
      {
        id: "security",
        title: "Security",
        icon: <Lock className="w-4 h-4" />,
        content: (
          <>
            <p>
              ViraWeb adopts technical and administrative measures to protect your personal data against unauthorized access, destruction, loss, alteration or any form of inappropriate treatment.
            </p>
            <ul>
                <li><strong>Encryption in transit</strong> — All connections are protected by SSL/TLS (HTTPS)</li>
                <li><strong>Password encryption</strong> — Passwords stored with secure hash</li>
                <li><strong>Row Level Security (RLS)</strong> — Database policies ensure users only access their own data</li>
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
            <p>For questions or requests about your privacy, contact us:</p>
            <DataList
              items={[
                { label: "Privacy email", value: "privacidade@viraweb.online" },
                { label: "General email", value: "contato@viraweb.online" },
              ]}
            />
          </>
        ),
      }
  ] : [
    {
      id: "introducao",
      title: "Introdução",
      icon: <Eye className="w-4 h-4" />,
      content: (
        <>
          <p>
            A <strong>ViraWeb</strong> valoriza profundamente a privacidade dos seus usuários. Esta Política de
            Privacidade descreve como coletamos, utilizamos, armazenamos, compartilhamos e protegemos as
            informações pessoais quando você utiliza nossa plataforma de gestão, disponível em{" "}
            <a href="https://viraweb.online" target="_blank" rel="noopener noreferrer">
              viraweb.online
            </a>{" "}
            e seus subdomínios.
          </p>
          <p>
            Esta política foi elaborada em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei
            nº 13.709/2018)</strong>, o <strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong> e demais
            regulamentações aplicáveis à proteção de dados no Brasil.
          </p>
          <InfoBox>
            Ao utilizar o ViraWeb, você confirma que leu e compreendeu esta Política de Privacidade. Recomendamos
            a leitura integral deste documento.
          </InfoBox>
        </>
      ),
    },
    {
      id: "dados-coletados",
      title: "Dados Coletados",
      icon: <Database className="w-4 h-4" />,
      content: (
        <>
          <h3>Dados Pessoais Fornecidos por Você</h3>
          <p>
            Ao criar sua conta e utilizar o ViraWeb, coletamos os seguintes dados que você nos fornece diretamente:
          </p>
          <DataList
            items={[
              { label: "Dados de identificação", value: "Nome completo, endereço de email, telefone" },
              { label: "Dados de acesso", value: "Email e senha (hash criptográfico via Supabase Auth) ou autenticação Google OAuth" },
              { label: "Dados profissionais", value: "Nome da clínica/empresa, CNPJ (quando aplicável)" },
              { label: "Dados de pagamento", value: "Processados diretamente pelo Stripe — não armazenamos dados de cartão" },
            ]}
          />
          <h3>Dados de Clientes (Pacientes) Inseridos por Você</h3>
          <p>
            Como controlador dos dados de seus clientes/pacientes, você pode cadastrar na plataforma:
          </p>
          <DataList
            items={[
              { label: "Identificação", value: "Nome, email, telefone, CPF, data de nascimento" },
              { label: "Endereço", value: "Endereço completo quando informado" },
              { label: "Dados clínicos", value: "Notas, prontuários e observações de atendimento" },
              { label: "Dados financeiros", value: "Histórico de pagamentos, valores, status de cobrança" },
              { label: "Imagem", value: "Foto de perfil do cliente (quando enviada)" },
            ]}
          />
          <WarningBox>
            Você, como operador e controlador dos dados de seus clientes/pacientes, é responsável por obter o
            consentimento adequado para o tratamento dessas informações conforme a LGPD. O ViraWeb atua como
            operador desses dados.
          </WarningBox>
        </>
      ),
    },
    {
      id: "como-usamos",
      title: "Como Utilizamos os Dados",
      icon: <BarChart3 className="w-4 h-4" />,
      content: (
        <>
          <p>Os dados coletados são utilizados para as seguintes finalidades:</p>
          <ul>
            <li>
              <strong>Prestação do serviço</strong> — Permitir o funcionamento da plataforma, incluindo
              cadastro de clientes, agendamentos, controle financeiro e geração de relatórios
            </li>
            <li>
              <strong>Autenticação e segurança</strong> — Verificar a identidade do usuário, gerenciar sessões
              e proteger contra acessos não autorizados
            </li>
            <li>
              <strong>Processamento de pagamentos</strong> — Gerenciar assinaturas, cobrança e recibos via Stripe
            </li>
            <li>
              <strong>Notificações</strong> — Enviar lembretes de agendamentos e comunicações de suporte
            </li>
            <li>
              <strong>ViraBot IA</strong> — Processar consultas do assistente de inteligência artificial para
              fornecer insights e suporte operacional
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "cookies-rastreamento",
      title: "Cookies e Rastreamento",
      icon: <Cookie className="w-4 h-4" />,
      content: (
        <>
          <p>
            O ViraWeb utiliza cookies e tecnologias similares de armazenamento local. Antes de ativar cookies não
            essenciais, solicitamos seu consentimento explícito.
          </p>
          <h3>Cookies Utilizados</h3>
          <DataList
            items={[
              { label: "Cookies de sessão", value: "Essenciais para manter sua autenticação ativa (Supabase Auth)" },
              { label: "Cookies de preferência", value: "Tema (claro/escuro), idioma selecionado (pt-BR/en)" },
            ]}
          />
        </>
      ),
    },
    {
      id: "armazenamento-seguranca",
      title: "Armazenamento e Segurança",
      icon: <Lock className="w-4 h-4" />,
      content: (
        <>
          <p>
            O ViraWeb adota medidas técnicas e administrativas para proteger seus dados pessoais contra acessos
            não autorizados, destruição, perda, alteração ou qualquer forma de tratamento inadequado.
          </p>
          <ul>
            <li><strong>Criptografia em trânsito</strong> — Todas as conexões são protegidas por SSL/TLS (HTTPS)</li>
            <li><strong>Criptografia de senhas</strong> — Senhas são armazenadas com hash seguro pelo Supabase Auth</li>
            <li><strong>Row Level Security (RLS)</strong> — Políticas de segurança a nível de banco de dados</li>
          </ul>
        </>
      ),
    },
    {
      id: "contato",
      title: "Contato para Privacidade",
      icon: <Mail className="w-4 h-4" />,
      content: (
        <>
          <p>
            Para dúvidas ou solicitações sobre sua privacidade e o tratamento dos seus dados pessoais:
          </p>
          <DataList
            items={[
              { label: "Email de privacidade", value: "privacidade@viraweb.online" },
              { label: "Email geral", value: "contato@viraweb.online" },
              { label: "Suporte na plataforma", value: "Menu Suporte > Novo Ticket" },
            ]}
          />
        </>
      ),
    },
  ]

  return (
    <LegalPageLayout
      title={isEn ? "Privacy Policy" : "Política de Privacidade"}
      description={isEn ? "Transparency about how we collect, use and protect your personal data. Your privacy is our priority." : "Transparência sobre como coletamos, usamos e protegemos seus dados pessoais. Sua privacidade é nossa prioridade."}
      lastUpdated="2026-04-11"
      badgeLabel={isEn ? "Privacy" : "Privacidade"}
      badgeIcon={<Shield className="w-4 h-4 text-primary" />}
      sections={sections}
      relatedPages={[
        { href: `/${locale}/termos`, label: isEn ? "Terms of Service" : "Termos de Serviço", icon: <FileText className="w-3.5 h-3.5" /> },
        { href: `/${locale}/lgpd`, label: isEn ? "LGPD Compliance" : "Conformidade LGPD", icon: <Scale className="w-3.5 h-3.5" /> },
      ]}
    />
  )
}
