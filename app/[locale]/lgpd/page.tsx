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
  BookOpen,
  Users,
  Landmark,
  Key,
  ScrollText,
  UserCheck,
  ArrowRightLeft,
  ClipboardCheck,
  ShieldCheck,
  Wand2,
  Mail,
  HelpCircle,
  Globe,
} from "lucide-react"
import { useLocale, useTranslations } from 'next-intl'

export default function LGPDPage() {
  const locale = useLocale()
  const isEn = locale === 'en'

  const sections: LegalSection[] = isEn ? [
    {
      id: "what-is-lgpd",
      title: "What is LGPD?",
      icon: <BookOpen className="w-4 h-4" />,
      content: (
        <>
          <p>
            The <strong>General Data Protection Law (LGPD)</strong> — Law No. 13,709, of August 14, 2018 — is the Brazilian legislation that regulates the processing of personal data by individuals or legal entities, under public or private law.
          </p>
          <p>
            LGPD establishes clear rules on the collection, storage, processing, and sharing of personal data, ensuring Brazilian citizens greater control and transparency over their information.
          </p>
          <InfoBox>
            ViraWeb is committed to full compliance with LGPD and works continuously to ensure that all data processing practices respect the principles established by law.
          </InfoBox>
        </>
      ),
    },
    {
      id: "roles-responsibilities",
      title: "Roles and Responsibilities",
      icon: <Users className="w-4 h-4" />,
      content: (
        <>
          <p>
            LGPD defines different roles in data processing. In the context of ViraWeb, they apply as follows:
          </p>
          <DataList
            items={[
              { label: "Controller (your account data)", value: "ViraWeb — Defines how and why your registration and subscription data are processed" },
              { label: "Controller (patient/client data)", value: "You (User) — When registering your clients' data in the platform, you are the controller of that data" },
              { label: "Processor", value: "ViraWeb — We process the patient/client data entered by you following your instructions and our policy" },
              { label: "Data Subject", value: "Every natural person whose data is processed in the platform (you and your clients/patients)" },
            ]}
          />
        </>
      ),
    },
    {
        id: "dpo",
        title: "Data Protection Officer (DPO)",
        icon: <UserCheck className="w-4 h-4" />,
        content: (
          <>
            <p>ViraWeb has designated a Data Protection Officer (DPO), responsible for receiving and responding to requests from data subjects and communicating with the ANPD.</p>
            <InfoBox>
              To contact our DPO, send an email to <strong>dpo@viraweb.online</strong>.
            </InfoBox>
          </>
        ),
      },
      {
        id: "principles",
        title: "LGPD Principles",
        icon: <ShieldCheck className="w-4 h-4" />,
        content: (
          <>
            <p>ViraWeb strictly follows the 10 fundamental principles established by Art. 6 of the LGPD, including Purpose, Adequacy, Necessity, Free Access, Quality, Transparency, Security, Prevention, Non-discrimination and Accountability.</p>
          </>
        ),
      }
  ] : [
    {
      id: "o-que-e-lgpd",
      title: "O que é a LGPD?",
      icon: <BookOpen className="w-4 h-4" />,
      content: (
        <>
          <p>
            A <strong>Lei Geral de Proteção de Dados (LGPD)</strong> — Lei nº 13.709, de 14 de agosto de 2018 — é
            a legislação brasileira que regulamenta o tratamento de dados pessoais por pessoas físicas ou jurídicas,
            de direito público ou privado.
          </p>
          <p>
            A LGPD estabelece regras claras sobre coleta, armazenamento, tratamento e compartilhamento de dados
            pessoais, garantindo aos cidadãos brasileiros maior controle e transparência sobre suas informações.
          </p>
          <InfoBox>
            O ViraWeb está comprometido com a conformidade total à LGPD e trabalha continuamente para assegurar
            que todas as práticas de tratamento de dados respeitem os princípios estabelecidos pela lei.
          </InfoBox>
        </>
      ),
    },
    {
      id: "papeis-responsabilidades",
      title: "Papéis e Responsabilidades",
      icon: <Users className="w-4 h-4" />,
      content: (
        <>
          <p>
            A LGPD define diferentes papéis no tratamento de dados. No contexto do ViraWeb, eles se aplicam da
            seguinte forma:
          </p>
          <DataList
            items={[
              {
                label: "Controlador (seus dados de conta)",
                value: "ViraWeb — Define como e por que seus dados de cadastro e assinatura são tratados",
              },
              {
                label: "Controlador (dados de pacientes/clientes)",
                value: "Você (Usuário) — Ao cadastrar dados de seus clientes na plataforma, você é o controlador desses dados",
              },
              {
                label: "Operador",
                value: "ViraWeb — Processamos os dados de pacientes/clientes inseridos por você conforme suas instruções e nossa política",
              },
              {
                label: "Titular dos dados",
                value: "Toda pessoa natural cujos dados são tratados na plataforma (você e seus clientes/pacientes)",
              },
            ]}
          />
        </>
      ),
    },
    {
      id: "dpo",
      title: "Encarregado de Dados (DPO)",
      icon: <UserCheck className="w-4 h-4" />,
      content: (
        <>
          <p>O ViraWeb designou um Encarregado de Proteção de Dados (DPO), responsável por zelar pelo cumprimento da lei.</p>
          <InfoBox>
            Para contato com nosso DPO, envie um email para <strong>dpo@viraweb.online</strong>.
          </InfoBox>
        </>
      ),
    },
    {
      id: "principios",
      title: "Princípios Aplicados",
      icon: <ShieldCheck className="w-4 h-4" />,
      content: (
        <>
          <p>O ViraWeb segue os 10 princípios fundamentais da LGPD, como Finalidade, Necessidade, Segurança e Transparência.</p>
        </>
      ),
    },
  ]

  return (
    <LegalPageLayout
      title={isEn ? "LGPD Compliance" : "Conformidade LGPD"}
      description={isEn ? "How ViraWeb complies with the General Data Protection Law (LGPD). Information about your rights as a data subject." : "Como o ViraWeb cumpre a Lei Geral de Proteção de Dados (LGPD). Informações sobre seus direitos como titular."}
      lastUpdated="2026-04-11"
      badgeLabel={isEn ? "LGPD" : "LGPD"}
      badgeIcon={<Scale className="w-4 h-4 text-primary" />}
      sections={sections}
      relatedPages={[
        { href: `/${locale}/termos`, label: isEn ? "Terms of Service" : "Termos de Serviço", icon: <FileText className="w-3.5 h-3.5" /> },
        { href: `/${locale}/privacidade`, label: isEn ? "Privacy Policy" : "Política de Privacidade", icon: <Shield className="w-3.5 h-3.5" /> },
      ]}
    />
  )
}
