-- Criação da tabela de pagamentos
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  amount DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'credit', 'debit', 'pix', 'transfer')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled')),
  payment_date TIMESTAMPTZ,
  notes TEXT,
  attendance_id UUID REFERENCES attendance(id) ON DELETE SET NULL
);

-- Adiciona coluna de pagamento na tabela de presenças
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

-- Trigger para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payments_timestamp
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para atualizar o contador de pagamentos do cliente
CREATE OR REPLACE FUNCTION update_patient_payment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'paid' THEN
        UPDATE patients 
        SET paid_sessions = (
            SELECT COUNT(*) 
            FROM payments 
            WHERE patient_id = NEW.patient_id 
            AND status = 'paid'
        )
        WHERE id = NEW.patient_id;
    ELSIF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.status = 'paid' AND NEW.status != 'paid')) THEN
        UPDATE patients 
        SET paid_sessions = (
            SELECT COUNT(*) 
            FROM payments 
            WHERE patient_id = OLD.patient_id 
            AND status = 'paid'
        )
        WHERE id = OLD.patient_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_update_patient_count
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_patient_payment_count();

-- Permissões
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own patients' payments"
    ON payments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert payments for their patients"
    ON payments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patients' payments"
    ON payments FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
