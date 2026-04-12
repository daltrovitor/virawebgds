-- Atualizar a estrutura da tabela de pagamentos para suportar recorrência e controle de sessões
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE payments ADD COLUMN is_recurring boolean DEFAULT false;
    EXCEPTION 
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE payments ADD COLUMN recurrence_unit text;
        ALTER TABLE payments ADD CONSTRAINT check_recurrence_unit CHECK (recurrence_unit IN ('daily', 'weekly', 'monthly'));
    EXCEPTION 
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE payments ADD COLUMN recurrence_interval integer;
    EXCEPTION 
        WHEN duplicate_column THEN NULL;
    END;
    
    BEGIN
        ALTER TABLE payments ADD COLUMN recurrence_end_date timestamptz;
    EXCEPTION 
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- Criar tabela para controle de sessões
CREATE TABLE IF NOT EXISTS financial_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
    session_date timestamptz NOT NULL,
    paid boolean DEFAULT false,
    amount decimal(10,2),
    payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- Índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_financial_sessions_user_id ON financial_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_sessions_patient_id ON financial_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_financial_sessions_date ON financial_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_financial_sessions_paid ON financial_sessions(paid);

-- Permissões
ALTER TABLE financial_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias sessões"
    ON financial_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias sessões"
    ON financial_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias sessões"
    ON financial_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_financial_sessions_updated_at
    BEFORE UPDATE ON financial_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
