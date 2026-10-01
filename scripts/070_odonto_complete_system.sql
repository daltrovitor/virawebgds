-- ==============================================================================
-- VIRAWEB GDS + ODONTO: SISTEMA INTEGRADO DE GESTÃO ODONTOLÓGICA E CLÍNICA
-- Migração Completa para Supabase PostgreSQL
-- Arquivo: scripts/070_odonto_complete_system.sql
-- ==============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Ele cria todas as novas tabelas odontológicas, clínicas e financeiras,
-- com chaves estrangeiras para auth.users e patients, índices de performance,
-- políticas de segurança RLS (Row Level Security) e carga inicial (seed)
-- de especialidades e procedimentos odontológicos padrão.
-- ==============================================================================

-- 1. ESPECIALIDADES ODONTOLÓGICAS
CREATE TABLE IF NOT EXISTS dental_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#0f766e',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dental_specialties_user ON dental_specialties(user_id);
ALTER TABLE dental_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own dental_specialties" ON dental_specialties FOR ALL USING (auth.uid() = user_id);

-- 2. PROCEDIMENTOS ODONTOLÓGICOS DO CATÁLOGO
CREATE TABLE IF NOT EXISTS dental_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty_id UUID REFERENCES dental_specialties(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  tuss_code TEXT,
  cfo_code TEXT,
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_minutes INTEGER DEFAULT 30,
  applies_to TEXT DEFAULT 'tooth' CHECK (applies_to IN ('tooth', 'face', 'arch', 'hemiarch', 'mouth')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dental_procedures_user ON dental_procedures(user_id);
CREATE INDEX IF NOT EXISTS idx_dental_procedures_spec ON dental_procedures(specialty_id);
ALTER TABLE dental_procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own dental_procedures" ON dental_procedures FOR ALL USING (auth.uid() = user_id);

-- 3. ODONTOGRAMA (REGISTRO CLÍNICO POR DENTE)
CREATE TABLE IF NOT EXISTS odontogram_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb, -- mapa { "16": { condition: "caries", notes: "...", procedures: [...] } }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, patient_id)
);
CREATE INDEX IF NOT EXISTS idx_odontogram_patient ON odontogram_records(patient_id);
ALTER TABLE odontogram_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own odontograms" ON odontogram_records FOR ALL USING (auth.uid() = user_id);

-- 4. PLANOS DE TRATAMENTO ODONTOLÓGICO
CREATE TABLE IF NOT EXISTS dental_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  total_cost NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dental_treatments_user ON dental_treatments(user_id);
CREATE INDEX IF NOT EXISTS idx_dental_treatments_patient ON dental_treatments(patient_id);
ALTER TABLE dental_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own dental_treatments" ON dental_treatments FOR ALL USING (auth.uid() = user_id);

-- 5. ITENS E ETAPAS DO TRATAMENTO (PROCEDIMENTOS POR DENTE)
CREATE TABLE IF NOT EXISTS dental_treatment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES dental_treatments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  procedure_name TEXT NOT NULL,
  tooth SMALLINT,
  face TEXT,
  arch TEXT CHECK (arch IS NULL OR arch IN ('upper', 'lower')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_treatment_items_treatment ON dental_treatment_items(treatment_id);
CREATE INDEX IF NOT EXISTS idx_treatment_items_patient ON dental_treatment_items(patient_id);
ALTER TABLE dental_treatment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own treatment_items" ON dental_treatment_items FOR ALL USING (auth.uid() = user_id);

-- 6. DIÁRIO DE EVOLUÇÃO CLÍNICA (ATENDIMENTOS E SESSÕES)
CREATE TABLE IF NOT EXISTS clinical_progress_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES dental_treatments(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  tooth SMALLINT,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  evolution_notes TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinical_progress_patient ON clinical_progress_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_progress_treatment ON clinical_progress_entries(treatment_id);
ALTER TABLE clinical_progress_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own progress_entries" ON clinical_progress_entries FOR ALL USING (auth.uid() = user_id);

-- 7. MODELOS DE ANAMNESE ODONTOLÓGICA
CREATE TABLE IF NOT EXISTS anamnesis_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anamnesis_templates_user ON anamnesis_templates(user_id);
ALTER TABLE anamnesis_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own anamnesis_templates" ON anamnesis_templates FOR ALL USING (auth.uid() = user_id);

-- 8. RESPOSTAS DE ANAMNESE DO PACIENTE
CREATE TABLE IF NOT EXISTS anamnesis_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  template_id UUID REFERENCES anamnesis_templates(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  clinical_alerts TEXT[] DEFAULT '{}',
  additional_notes TEXT,
  answered_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anamnesis_responses_patient ON anamnesis_responses(patient_id);
ALTER TABLE anamnesis_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own anamnesis_responses" ON anamnesis_responses FOR ALL USING (auth.uid() = user_id);

-- 9. ALERTAS CLÍNICOS E MÉDICOS DO PACIENTE
CREATE TABLE IF NOT EXISTS patient_clinical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  alert_title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('allergy', 'cardiovascular', 'medication', 'bleeding', 'general')),
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_clinical_alerts ON patient_clinical_alerts(patient_id);
ALTER TABLE patient_clinical_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own clinical_alerts" ON patient_clinical_alerts FOR ALL USING (auth.uid() = user_id);

-- 10. DOCUMENTOS CLÍNICOS E PRESCRIÇÕES EMITIDAS
CREATE TABLE IF NOT EXISTS dental_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('prescription', 'certificate', 'tcle', 'post_op', 'other')),
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  cid_code TEXT,
  professional_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dental_documents_patient ON dental_documents(patient_id);
ALTER TABLE dental_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own dental_documents" ON dental_documents FOR ALL USING (auth.uid() = user_id);

-- 11. GALERIA DE RADIOGRAFIAS E IMAGENS ODONTOLÓGICAS
CREATE TABLE IF NOT EXISTS dental_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  image_kind TEXT NOT NULL DEFAULT 'periapical' CHECK (image_kind IN ('panoramic', 'periapical', 'bite_wing', 'intraoral_photo', 'tomography', 'document')),
  tooth SMALLINT,
  taken_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dental_gallery_patient ON dental_gallery(patient_id);
ALTER TABLE dental_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own dental_gallery" ON dental_gallery FOR ALL USING (auth.uid() = user_id);

-- 12. RESPONSÁVEIS PELO PACIENTE (MENORES OU DEPENDENTES)
CREATE TABLE IF NOT EXISTS patient_responsibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  is_financial_responsible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_responsibles_patient ON patient_responsibles(patient_id);
ALTER TABLE patient_responsibles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own patient_responsibles" ON patient_responsibles FOR ALL USING (auth.uid() = user_id);

-- 13. CONCILIAÇÃO BANCÁRIA: LOTES DE IMPORTAÇÃO DE EXTRATO OFX
CREATE TABLE IF NOT EXISTS bank_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT,
  account_number TEXT,
  file_name TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  transaction_count INTEGER DEFAULT 0,
  imported_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_import_batches_user ON bank_import_batches(user_id);
ALTER TABLE bank_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bank_import_batches" ON bank_import_batches FOR ALL USING (auth.uid() = user_id);

-- 14. CONCILIAÇÃO BANCÁRIA: TRANSAÇÕES DO EXTRATO
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES bank_import_batches(id) ON DELETE CASCADE,
  fit_id TEXT,
  posted_on DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  memo TEXT NOT NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('credit', 'debit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'ignored')),
  matched_payment_id UUID,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user ON bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_batch ON bank_transactions(batch_id);
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bank_transactions" ON bank_transactions FOR ALL USING (auth.uid() = user_id);

-- 15. GESTÃO DE CARTÕES E TAXAS DE OPERADORA (MAQUININHA)
CREATE TABLE IF NOT EXISTS card_fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acquirer TEXT NOT NULL DEFAULT 'Principal', -- Cielo, Rede, Stone, etc.
  debit_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 1.29,
  credit_sight_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 2.79,
  credit_installment_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 3.89,
  anticipation_fee_monthly_percent NUMERIC(5,2) NOT NULL DEFAULT 1.50,
  days_to_deposit_debit INTEGER DEFAULT 1,
  days_to_deposit_credit INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_card_fee_rules_user ON card_fee_rules(user_id);
ALTER TABLE card_fee_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own card_fee_rules" ON card_fee_rules FOR ALL USING (auth.uid() = user_id);

-- 16. LOCALIZAÇÃO ODONTOLÓGICA NOS ITENS DE ORÇAMENTO (ODONTOGRAMA NO ORÇAMENTO)
CREATE TABLE IF NOT EXISTS budget_dental_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_item_id UUID NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
  tooth SMALLINT,
  face TEXT,
  arch TEXT CHECK (arch IS NULL OR arch IN ('upper', 'lower')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_dental_item ON budget_dental_locations(budget_item_id);
ALTER TABLE budget_dental_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own budget_dental_locations" ON budget_dental_locations FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- CARGA INICIAL (SEED) PARA USUÁRIOS: ESPECIALIDADES E PROCEDIMENTOS PADRÃO
-- ==============================================================================

-- Função utilitária para inicializar o catálogo odontológico para qualquer usuário
CREATE OR REPLACE FUNCTION seed_dental_catalog_for_user(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
  spec_clinica UUID;
  spec_endo UUID;
  spec_perio UUID;
  spec_protese UUID;
  spec_cirurgia UUID;
  spec_orto UUID;
  spec_implante UUID;
  spec_dentistica UUID;
  spec_pediatria UUID;
BEGIN
  -- 1. Especialidades
  INSERT INTO dental_specialties (user_id, name, description, color)
  VALUES (target_user_id, 'Clínica Geral', 'Prevenção, diagnóstico e restaurações básicas', '#0f766e')
  RETURNING id INTO spec_clinica;

  INSERT INTO dental_specialties (user_id, name, description, color)
  VALUES (target_user_id, 'Endodontia', 'Tratamento de canal e polpa dentária', '#7c3aed')
  RETURNING id INTO spec_endo;

  INSERT INTO dental_specialties (user_id, name, description, color)
  VALUES (target_user_id, 'Periodontia', 'Tratamento de gengivas e suporte ósseo', '#0284c7')
  RETURNING id INTO spec_perio;

  INSERT INTO dental_specialties (user_id, name, description, color)
  VALUES (target_user_id, 'Prótese Dentária', 'Coroas, próteses fixas e removíveis', '#d97706')
  RETURNING id INTO spec_protese;

  INSERT INTO dental_specialties (user_id, name, description, color)
  VALUES (target_user_id, 'Cirurgia & Traumatologia', 'Exodontias simples e de sisos inclusos', '#dc2626')
  RETURNING id INTO spec_cirurgia;

  INSERT INTO dental_specialties (user_id, name, description, color)
  VALUES (target_user_id, 'Ortodontia', 'Alinhadores e aparelhos ortodônticos', '#2563eb')
  RETURNING id INTO spec_orto;

  INSERT INTO dental_specialties (user_id, name, description, color)
  VALUES (target_user_id, 'Implantodontia', 'Implantes de titânio e enxertos ósseos', '#b45309')
  RETURNING id INTO spec_implante;

  INSERT INTO dental_specialties (user_id, name, description, color)
  VALUES (target_user_id, 'Dentística & Estética', 'Facetas, resinas estéticas e clareamento', '#ec4899')
  RETURNING id INTO spec_dentistica;

  INSERT INTO dental_specialties (user_id, name, description, color)
  VALUES (target_user_id, 'Odontopediatria', 'Atendimento preventivo e curativo infantil', '#10b981')
  RETURNING id INTO spec_pediatria;

  -- 2. Procedimentos Odontológicos mais frequentes
  -- Clínica Geral & Prevenção
  INSERT INTO dental_procedures (user_id, specialty_id, name, tuss_code, default_price, estimated_minutes, applies_to) VALUES
  (target_user_id, spec_clinica, 'Consulta Inicial / Avaliação Clínica', '81000030', 150.00, 30, 'mouth'),
  (target_user_id, spec_clinica, 'Profilaxia Dental e Raspagem Supragengival', '82000859', 220.00, 45, 'mouth'),
  (target_user_id, spec_clinica, 'Aplicação Tópica de Flúor Gel', '82000824', 90.00, 15, 'mouth'),
  (target_user_id, spec_clinica, 'Restauração Resina Composta 1 Face', '82001090', 180.00, 30, 'tooth'),
  (target_user_id, spec_clinica, 'Restauração Resina Composta 2 Faces (MOD)', '82001103', 230.00, 45, 'tooth'),
  (target_user_id, spec_clinica, 'Restauração Resina Composta 3 Faces ou Complexa', '82001111', 280.00, 60, 'tooth');

  -- Endodontia
  INSERT INTO dental_procedures (user_id, specialty_id, name, tuss_code, default_price, estimated_minutes, applies_to) VALUES
  (target_user_id, spec_endo, 'Tratamento Endodôntico Dente Unirradicular', '83000078', 550.00, 60, 'tooth'),
  (target_user_id, spec_endo, 'Tratamento Endodôntico Dente Birradicular (Pré-Molar)', '83000086', 680.00, 60, 'tooth'),
  (target_user_id, spec_endo, 'Tratamento Endodôntico Dente Molar (3 ou mais canais)', '83000094', 950.00, 90, 'tooth'),
  (target_user_id, spec_endo, 'Retratamento de Canal Dente Molar', '83000108', 1150.00, 90, 'tooth'),
  (target_user_id, spec_endo, 'Pino de Fibra de Vidro e Núcleo de Preenchimento', '84000195', 380.00, 45, 'tooth');

  -- Cirurgia
  INSERT INTO dental_procedures (user_id, specialty_id, name, tuss_code, default_price, estimated_minutes, applies_to) VALUES
  (target_user_id, spec_cirurgia, 'Exodontia Simples Dente Permanente', '82000875', 220.00, 30, 'tooth'),
  (target_user_id, spec_cirurgia, 'Exodontia de Dente Incluso / Terceiro Molar (Siso)', '82000891', 450.00, 60, 'tooth'),
  (target_user_id, spec_cirurgia, 'Frenectomia Labial ou Lingual', '82000921', 350.00, 45, 'mouth'),
  (target_user_id, spec_cirurgia, 'Ulotomia / Ulectomia', '82000956', 200.00, 30, 'tooth');

  -- Periodontia
  INSERT INTO dental_procedures (user_id, specialty_id, name, tuss_code, default_price, estimated_minutes, applies_to) VALUES
  (target_user_id, spec_perio, 'Raspagem e Alisamento Radicular por Quadrante', '82001154', 280.00, 45, 'hemiarch'),
  (target_user_id, spec_perio, 'Gengivoplastia / Aumento de Coroa Clínica por Dente', '82000930', 320.00, 45, 'tooth');

  -- Prótese Dentária
  INSERT INTO dental_procedures (user_id, specialty_id, name, tuss_code, default_price, estimated_minutes, applies_to) VALUES
  (target_user_id, spec_protese, 'Coroa Total Metalocerâmica', '84000101', 1200.00, 60, 'tooth'),
  (target_user_id, spec_protese, 'Coroa Total em Cerâmica Pura (E-max / Zircônia)', '84000110', 1650.00, 60, 'tooth'),
  (target_user_id, spec_protese, 'Prótese Total Superior ou Inferior (Dentadura)', '84000217', 2200.00, 60, 'arch'),
  (target_user_id, spec_protese, 'Prótese Parcial Removível com Grampos (Roach)', '84000225', 1800.00, 60, 'arch');

  -- Implantodontia
  INSERT INTO dental_procedures (user_id, specialty_id, name, tuss_code, default_price, estimated_minutes, applies_to) VALUES
  (target_user_id, spec_implante, 'Instalação de Implante Dentário Osteointegrado Titânio', '82001200', 1800.00, 60, 'tooth'),
  (target_user_id, spec_implante, 'Enxerto Ósseo Liofilizado / Biomaterial', '82001219', 950.00, 45, 'tooth'),
  (target_user_id, spec_implante, 'Prótese sobre Implante Parafusada (Coroa)', '84000306', 1500.00, 60, 'tooth');

  -- Dentística & Estética
  INSERT INTO dental_procedures (user_id, specialty_id, name, tuss_code, default_price, estimated_minutes, applies_to) VALUES
  (target_user_id, spec_dentistica, 'Clareamento Dental em Consultório (Sessão)', '82000840', 600.00, 60, 'mouth'),
  (target_user_id, spec_dentistica, 'Clareamento Dental Caseiro com Moldeiras', '82000832', 750.00, 30, 'mouth'),
  (target_user_id, spec_dentistica, 'Faceta Laminada em Resina Composta', '82001138', 500.00, 60, 'tooth'),
  (target_user_id, spec_dentistica, 'Lente de Contato Dental / Faceta em Porcelana', '84000187', 1800.00, 60, 'tooth');

  -- Ortodontia
  INSERT INTO dental_procedures (user_id, specialty_id, name, tuss_code, default_price, estimated_minutes, applies_to) VALUES
  (target_user_id, spec_orto, 'Instalação de Aparelho Ortodôntico Fixo Metálico', '82001250', 650.00, 60, 'mouth'),
  (target_user_id, spec_orto, 'Manutenção Ortodôntica Mensal', '82001269', 160.00, 30, 'mouth');

  -- Regras de taxas de operadora padrão
  INSERT INTO card_fee_rules (user_id, acquirer, debit_fee_percent, credit_sight_fee_percent, credit_installment_fee_percent, anticipation_fee_monthly_percent)
  VALUES (target_user_id, 'Maquininha Padrão', 1.29, 2.79, 3.89, 1.50);
END;
$$ LANGUAGE plpgsql;

-- Notificação de sucesso da migração
DO $$
BEGIN
  RAISE NOTICE '✅ Migração Odontológica ViraWeb GDS concluída com sucesso!';
END $$;
