// Hello World
/**
 * Questionário de anamnese odontológica e leitura dos alertas clínicos.
 * Hoje as respostas ficam no navegador (localStorage, chave vwd:anamnesis:<paciente>).
 */

export interface AnamnesisQuestion {
  id: string
  label: string
  category: "cardiovascular" | "allergy" | "medication" | "dental" | "general"
  alertOnYes: boolean
  alertTitle: string
}

export const DEFAULT_QUESTIONS: AnamnesisQuestion[] = [
  {
    id: "q_anesthesia",
    label: "Já teve reação alérgica ou complicação com anestesia odontológica?",
    category: "allergy",
    alertOnYes: true,
    alertTitle: "Risco: Alergia a Anestésicos Locais",
  },
  {
    id: "q_cardio",
    label: "Possui problemas cardíacos, pressão alta, sopro ou prótese de válvula cardíaca?",
    category: "cardiovascular",
    alertOnYes: true,
    alertTitle: "Cardiopatia / Hipertensão (Atenção a Vasoconstritores e Profilaxia)",
  },
  {
    id: "q_diabetes",
    label: "É diabético ou possui histórico de alterações glicêmicas?",
    category: "general",
    alertOnYes: true,
    alertTitle: "Diabetes Mellitus (Atenção ao tempo cirúrgico e cicatrização)",
  },
  {
    id: "q_anticoagulant",
    label: "Toma anticoagulantes (AAS, Marevan, Xarelto) ou bifosfonatos (para osteoporose)?",
    category: "medication",
    alertOnYes: true,
    alertTitle: "Uso de Anticoagulantes / Bifosfonatos (Risco Hemorrágico e Osteonecrose)",
  },
  {
    id: "q_allergies",
    label: "Possui alergia a medicamentos (ex: Penicilina, Dipirona, AINEs) ou látex?",
    category: "allergy",
    alertOnYes: true,
    alertTitle: "Alergias Medicamentosas / Látex",
  },
  {
    id: "q_pregnancy",
    label: "Está gestante ou em período de amamentação?",
    category: "general",
    alertOnYes: true,
    alertTitle: "Gestante / Lactante (Restrição para Raios-X e fármacos)",
  },
  {
    id: "q_bleeding",
    label: "Apresenta sangramento fácil na gengiva ao escovar ou passar fio dental?",
    category: "dental",
    alertOnYes: false,
    alertTitle: "Gengivite / Periodontite Ativa",
  },
  {
    id: "q_bruxism",
    label: "Acorda com dor na mandíbula, estalos na ATM ou aperta os dentes à noite?",
    category: "dental",
    alertOnYes: false,
    alertTitle: "Bruxismo / Disfunção Temporomandibular (DTM)",
  },
  {
    id: "q_smoker",
    label: "Faz uso frequente de tabaco ou consome bebidas alcoólicas?",
    category: "general",
    alertOnYes: false,
    alertTitle: "Tabagismo / Fator de Risco Periodontal e Implantes",
  },
  {
    id: "q_medications",
    label: "Faz uso contínuo de algum outro medicamento não citado?",
    category: "medication",
    alertOnYes: false,
    alertTitle: "Medicamentos de uso contínuo",
  },
]


export interface StoredAnamnesis {
  answers: Record<string, { yes: boolean; details: string }>
  notes: string
  savedAt?: string
}

export function loadAnamnesis(patientId: string): StoredAnamnesis | null {
  try {
    const raw = localStorage.getItem(`vwd:anamnesis:${patientId}`)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<StoredAnamnesis>
    return { answers: data.answers || {}, notes: data.notes || "", savedAt: data.savedAt }
  } catch {
    return null
  }
}

export interface ClinicalAlert {
  id: string
  title: string
  details: string
  critical: boolean
}

/** Respostas "sim" viram alertas; as marcadas como críticas aparecem primeiro. */
export function anamnesisAlerts(data: StoredAnamnesis | null): ClinicalAlert[] {
  if (!data) return []
  return DEFAULT_QUESTIONS.filter((q) => data.answers[q.id]?.yes)
    .map((q) => ({ id: q.id, title: q.alertTitle, details: data.answers[q.id]?.details || "", critical: q.alertOnYes }))
    .sort((a, b) => Number(b.critical) - Number(a.critical))
}
