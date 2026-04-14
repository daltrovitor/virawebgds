-- ==========================================================
-- ViraWeb – Budget & Price Table Module
-- Database migration for Supabase
-- ==========================================================
-- Run this migration in your Supabase SQL Editor to create 
-- the required tables for the Price Table and Budget modules.
-- ==========================================================

-- ── Service Categories ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3396d3',
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_categories_user_id ON service_categories(user_id);

-- ── Service Products ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  duration_minutes INTEGER,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_products_user_id ON service_products(user_id);
CREATE INDEX IF NOT EXISTS idx_service_products_category_id ON service_products(category_id);

-- ── Budgets ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired')),
  notes TEXT,
  valid_until DATE,
  -- Payment plan
  down_payment NUMERIC(12,2) DEFAULT 0,
  installment_count INTEGER DEFAULT 1,
  installment_interval TEXT DEFAULT 'monthly' CHECK (installment_interval IN ('weekly', 'biweekly', 'monthly')),
  installment_value NUMERIC(12,2) DEFAULT 0,
  -- Calculated totals
  subtotal NUMERIC(12,2) DEFAULT 0,
  total_tax NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  net_revenue NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_patient_id ON budgets(patient_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);

-- ── Budget Items ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(12,2) DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_items_budget_id ON budget_items(budget_id);

-- ── Budget Payment Methods ──────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('pix', 'credit_card', 'debit_card', 'cash', 'transfer', 'boleto')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_payment_methods_budget_id ON budget_payment_methods(budget_id);

-- ── Row Level Security (RLS) ────────────────────────────────

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_payment_methods ENABLE ROW LEVEL SECURITY;

-- Service Categories: users can only access their own
CREATE POLICY "Users can manage their own categories"
  ON service_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service Products: users can only access their own
CREATE POLICY "Users can manage their own products"
  ON service_products FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Budgets: users can only access their own
CREATE POLICY "Users can manage their own budgets"
  ON budgets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Budget Items: users can access items for their own budgets
CREATE POLICY "Users can manage budget items for their budgets"
  ON budget_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM budgets WHERE budgets.id = budget_items.budget_id AND budgets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets WHERE budgets.id = budget_items.budget_id AND budgets.user_id = auth.uid()
    )
  );

-- Budget Payment Methods: users can access payment methods for their own budgets
CREATE POLICY "Users can manage payment methods for their budgets"
  ON budget_payment_methods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM budgets WHERE budgets.id = budget_payment_methods.budget_id AND budgets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets WHERE budgets.id = budget_payment_methods.budget_id AND budgets.user_id = auth.uid()
    )
  );
