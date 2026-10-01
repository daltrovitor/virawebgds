-- Restrições que o Drizzle não expressa no schema TypeScript.

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- Conflito de horário do mesmo profissional bloqueado no banco, inclusive sob
-- gravações simultâneas. Encaixes deliberados (is_overbook) ficam fora da regra.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "organization_id" WITH =,
    "professional_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" IN ('scheduled', 'confirmed', 'arrived', 'in_progress', 'finished') AND NOT "is_overbook");
--> statement-breakpoint

-- Referências circulares/auto-referências com FK composta por clínica.
ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_current_revision_fk"
  FOREIGN KEY ("organization_id", "current_revision_id")
  REFERENCES "budget_revisions" ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "budget_revisions"
  ADD CONSTRAINT "revisions_previous_fk"
  FOREIGN KEY ("organization_id", "previous_revision_id")
  REFERENCES "budget_revisions" ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "payment_agreements"
  ADD CONSTRAINT "agreements_previous_fk"
  FOREIGN KEY ("organization_id", "previous_agreement_id")
  REFERENCES "payment_agreements" ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_bank_tx_fk"
  FOREIGN KEY ("organization_id", "bank_transaction_id")
  REFERENCES "bank_transactions" ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "account_movements"
  ADD CONSTRAINT "movements_card_receivable_fk"
  FOREIGN KEY ("organization_id", "card_receivable_id")
  REFERENCES "card_receivables" ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "account_movements"
  ADD CONSTRAINT "movements_reverses_fk"
  FOREIGN KEY ("organization_id", "reverses_movement_id")
  REFERENCES "account_movements" ("organization_id", "id");
--> statement-breakpoint

-- Um movimento só pode ser estornado uma vez.
CREATE UNIQUE INDEX "movements_reverses_once_uq" ON "account_movements" ("reverses_movement_id")
  WHERE "reverses_movement_id" IS NOT NULL;
--> statement-breakpoint

-- Registros clínicos finalizados não podem ser sobrescritos: correções entram como adendos.
CREATE OR REPLACE FUNCTION prevent_final_clinical_note_update() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'final' THEN
    RAISE EXCEPTION 'Registro clínico finalizado não pode ser alterado; registre um adendo'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER clinical_notes_final_guard
  BEFORE UPDATE OR DELETE ON "clinical_notes"
  FOR EACH ROW EXECUTE FUNCTION prevent_final_clinical_note_update();
--> statement-breakpoint

-- Auditoria é somente inclusão.
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registros de auditoria não podem ser alterados ou apagados'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
