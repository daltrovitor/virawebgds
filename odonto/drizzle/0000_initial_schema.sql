CREATE TABLE "account_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"occurred_on" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"kind" text NOT NULL,
	"settlement_id" uuid,
	"transfer_id" uuid,
	"card_receivable_id" uuid,
	"reverses_movement_id" uuid,
	"category_id" uuid,
	"description" text NOT NULL,
	"reconciled_cents" bigint DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movements_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "movements_kind_ck" CHECK ("account_movements"."kind" in ('settlement', 'settlement_reversal', 'transfer_out', 'transfer_in', 'transfer_reversal', 'card_settlement_out', 'card_settlement_in', 'card_fee', 'card_anticipation_fee', 'bank_fee', 'bank_adjustment')),
	CONSTRAINT "movements_amount_ck" CHECK ("account_movements"."amount_cents" <> 0),
	CONSTRAINT "movements_reconciled_ck" CHECK (abs("account_movements"."reconciled_cents") <= abs("account_movements"."amount_cents") and ("account_movements"."reconciled_cents" = 0 or sign("account_movements"."reconciled_cents") = sign("account_movements"."amount_cents")))
);
--> statement-breakpoint
CREATE TABLE "agreement_item_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"budget_item_id" uuid NOT NULL,
	"gross_cents" bigint NOT NULL,
	"discount_cents" bigint NOT NULL,
	"net_cents" bigint NOT NULL,
	CONSTRAINT "agreement_alloc_ck" CHECK ("agreement_item_allocations"."net_cents" = "agreement_item_allocations"."gross_cents" - "agreement_item_allocations"."discount_cents")
);
--> statement-breakpoint
CREATE TABLE "anamnesis_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"respondent_name" text NOT NULL,
	"respondent_relation" text,
	"answered_on" date NOT NULL,
	"recorded_by" uuid,
	"reviewed_by_professional_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anamnesis_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"questions" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anamnesis_tpl_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "anamnesis_tpl_version_uq" UNIQUE("organization_id","name","version")
);
--> statement-breakpoint
CREATE TABLE "appointment_procedures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"treatment_item_id" uuid NOT NULL,
	"outcome" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appt_proc_uq" UNIQUE("appointment_id","treatment_item_id"),
	CONSTRAINT "appt_proc_outcome_ck" CHECK ("appointment_procedures"."outcome" is null or "appointment_procedures"."outcome" in ('performed', 'partial', 'not_performed'))
);
--> statement-breakpoint
CREATE TABLE "appointment_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"from_starts_at" timestamp with time zone,
	"to_starts_at" timestamp with time zone,
	"reason" text,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appt_history_kind_ck" CHECK ("appointment_status_history"."kind" in ('created', 'status', 'time_change', 'reschedule', 'edit'))
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"is_first_visit" boolean DEFAULT false NOT NULL,
	"planned" text,
	"performed" text,
	"notes" text,
	"reminder_preference" text DEFAULT 'none' NOT NULL,
	"is_overbook" boolean DEFAULT false NOT NULL,
	"overbook_reason" text,
	"rescheduled_from_id" uuid,
	"cancel_reason" text,
	"status_changed_at" timestamp with time zone,
	"status_changed_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "appointments_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "appointments_status_ck" CHECK ("appointments"."status" in ('scheduled', 'confirmed', 'arrived', 'in_progress', 'finished', 'no_show', 'cancelled_by_patient', 'cancelled_by_clinic', 'cancelled_rescheduled', 'no_show_rescheduled')),
	CONSTRAINT "appointments_time_ck" CHECK ("appointments"."ends_at" > "appointments"."starts_at" and "appointments"."end_minute" > "appointments"."start_minute" and "appointments"."start_minute" >= 0 and "appointments"."end_minute" <= 1440),
	CONSTRAINT "appointments_reminder_ck" CHECK ("appointments"."reminder_preference" in ('none', 'whatsapp', 'sms', 'email'))
);
--> statement-breakpoint
CREATE TABLE "attachment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"attachment_id" uuid NOT NULL,
	"tooth" smallint,
	"treatment_item_id" uuid,
	"appointment_id" uuid,
	"budget_id" uuid,
	CONSTRAINT "attachment_links_target_ck" CHECK (num_nonnulls("attachment_links"."tooth", "attachment_links"."treatment_item_id", "attachment_links"."appointment_id", "attachment_links"."budget_id") >= 1)
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"thumbnail_key" text,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"kind" text NOT NULL,
	"taken_on" date,
	"description" text,
	"derived_from_id" uuid,
	"is_profile_photo" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "attachments_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "attachments_kind_ck" CHECK ("attachments"."kind" in ('photo', 'radiograph', 'document', 'other'))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"summary" text NOT NULL,
	"changes" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'not_configured' NOT NULL,
	"consent_expires_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"synced_from" date,
	"synced_until" date,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_conn_status_ck" CHECK ("bank_connections"."status" in ('not_configured', 'pending_authorization', 'active', 'expired', 'revoked', 'error'))
);
--> statement-breakpoint
CREATE TABLE "bank_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_sha256" text NOT NULL,
	"format" text DEFAULT 'ofx' NOT NULL,
	"bank_id" text,
	"account_ref_masked" text,
	"period_start" date,
	"period_end" date,
	"ledger_balance_cents" bigint,
	"ledger_balance_date" date,
	"status" text DEFAULT 'preview' NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"ambiguous_count" integer DEFAULT 0 NOT NULL,
	"preview" jsonb,
	"warnings" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	CONSTRAINT "bank_batches_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "bank_batches_status_ck" CHECK ("bank_import_batches"."status" in ('preview', 'confirmed', 'discarded'))
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"external_id" text,
	"fingerprint" text NOT NULL,
	"occurrence_index" integer DEFAULT 0 NOT NULL,
	"posted_on" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"description" text NOT NULL,
	"memo" text,
	"trn_type" text,
	"check_number" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"ignore_reason" text,
	"ignored_by" uuid,
	"ignored_at" timestamp with time zone,
	"ambiguous" boolean DEFAULT false NOT NULL,
	"reconciled_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_tx_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "bank_tx_status_ck" CHECK ("bank_transactions"."status" in ('pending', 'reconciled', 'ignored')),
	CONSTRAINT "bank_tx_amount_ck" CHECK ("bank_transactions"."amount_cents" <> 0),
	CONSTRAINT "bank_tx_reconciled_ck" CHECK (abs("bank_transactions"."reconciled_cents") <= abs("bank_transactions"."amount_cents") and ("bank_transactions"."reconciled_cents" = 0 or sign("bank_transactions"."reconciled_cents") = sign("bank_transactions"."amount_cents")))
);
--> statement-breakpoint
CREATE TABLE "budget_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"budget_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_item_count" integer NOT NULL,
	"rejected_item_count" integer NOT NULL,
	"total_cents" bigint NOT NULL,
	"notes" text,
	CONSTRAINT "budget_approvals_revision_id_unique" UNIQUE("revision_id")
);
--> statement-breakpoint
CREATE TABLE "budget_item_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"tooth" smallint,
	"arch" text,
	"hemiarch" smallint,
	CONSTRAINT "item_locations_kind_ck" CHECK (("budget_item_locations"."kind" = 'tooth' and "budget_item_locations"."tooth" is not null and "budget_item_locations"."arch" is null and "budget_item_locations"."hemiarch" is null)
       or ("budget_item_locations"."kind" = 'arch' and "budget_item_locations"."arch" in ('upper','lower') and "budget_item_locations"."tooth" is null and "budget_item_locations"."hemiarch" is null)
       or ("budget_item_locations"."kind" = 'hemiarch' and "budget_item_locations"."hemiarch" between 1 and 4 and "budget_item_locations"."tooth" is null and "budget_item_locations"."arch" is null))
);
--> statement-breakpoint
CREATE TABLE "budget_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"budget_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"lineage_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"procedure_id" uuid NOT NULL,
	"specialty_id" uuid NOT NULL,
	"procedure_code" text NOT NULL,
	"procedure_name" text NOT NULL,
	"specialty_name" text NOT NULL,
	"billing_unit" text NOT NULL,
	"location_scope" text NOT NULL,
	"location_label" text NOT NULL,
	"location_signature" text NOT NULL,
	"quantity" integer NOT NULL,
	"reference_price_cents" bigint,
	"unit_price_cents" bigint NOT NULL,
	"subtotal_cents" bigint NOT NULL,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"duplicate_justification" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_items_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "budget_items_revision_lineage_uq" UNIQUE("revision_id","lineage_id"),
	CONSTRAINT "budget_items_qty_ck" CHECK ("budget_items"."quantity" > 0),
	CONSTRAINT "budget_items_price_ck" CHECK ("budget_items"."unit_price_cents" >= 0 and "budget_items"."subtotal_cents" = "budget_items"."unit_price_cents" * "budget_items"."quantity"),
	CONSTRAINT "budget_items_approval_ck" CHECK ("budget_items"."approval_status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "budget_items_scope_ck" CHECK ("budget_items"."location_scope" in ('none', 'teeth', 'arches', 'hemiarches'))
);
--> statement-breakpoint
CREATE TABLE "budget_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"budget_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reason" text,
	"previous_revision_id" uuid,
	"negotiation" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	CONSTRAINT "revisions_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "revisions_budget_number_uq" UNIQUE("budget_id","number"),
	CONSTRAINT "revisions_status_ck" CHECK ("budget_revisions"."status" in ('open', 'approved', 'superseded', 'discarded'))
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"patient_id" uuid NOT NULL,
	"professional_id" uuid,
	"price_table_id" uuid NOT NULL,
	"budget_date" date NOT NULL,
	"valid_until" date,
	"origin" text,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_revision_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "budgets_org_number_uq" UNIQUE("organization_id","number"),
	CONSTRAINT "budgets_status_ck" CHECK ("budgets"."status" in ('draft', 'negotiating', 'partially_approved', 'approved', 'rejected', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "card_fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"acquirer" text NOT NULL,
	"brand" text,
	"payment_type" text NOT NULL,
	"installments_from" integer DEFAULT 1 NOT NULL,
	"installments_to" integer DEFAULT 1 NOT NULL,
	"fee_basis_points" integer NOT NULL,
	"fixed_fee_cents" bigint DEFAULT 0 NOT NULL,
	"settlement_days" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "card_fee_type_ck" CHECK ("card_fee_rules"."payment_type" in ('debit', 'credit'))
);
--> statement-breakpoint
CREATE TABLE "card_receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"card_transaction_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"expected_date" date NOT NULL,
	"gross_cents" bigint NOT NULL,
	"fee_cents" bigint NOT NULL,
	"net_cents" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"settled_on" date,
	"bank_account_id" uuid,
	"anticipation_fee_cents" bigint DEFAULT 0 NOT NULL,
	"settled_by" uuid,
	"settled_at" timestamp with time zone,
	CONSTRAINT "card_rec_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "card_rec_tx_number_uq" UNIQUE("card_transaction_id","installment_number"),
	CONSTRAINT "card_rec_status_ck" CHECK ("card_receivables"."status" in ('pending', 'settled', 'anticipated', 'cancelled')),
	CONSTRAINT "card_rec_values_ck" CHECK ("card_receivables"."net_cents" = "card_receivables"."gross_cents" - "card_receivables"."fee_cents" and "card_receivables"."anticipation_fee_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "card_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"settlement_id" uuid NOT NULL,
	"clearing_account_id" uuid NOT NULL,
	"acquirer" text NOT NULL,
	"brand" text,
	"payment_type" text NOT NULL,
	"installments" integer DEFAULT 1 NOT NULL,
	"gross_cents" bigint NOT NULL,
	"fee_cents" bigint NOT NULL,
	"net_cents" bigint NOT NULL,
	"authorization_code" text,
	"nsu" text,
	"transaction_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_transactions_settlement_id_unique" UNIQUE("settlement_id"),
	CONSTRAINT "card_tx_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "card_tx_values_ck" CHECK ("card_transactions"."net_cents" = "card_transactions"."gross_cents" - "card_transactions"."fee_cents" and "card_transactions"."fee_cents" >= 0 and "card_transactions"."gross_cents" > 0),
	CONSTRAINT "card_tx_type_ck" CHECK ("card_transactions"."payment_type" in ('debit', 'credit'))
);
--> statement-breakpoint
CREATE TABLE "clinical_note_addenda" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"note_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addenda_kind_ck" CHECK ("clinical_note_addenda"."kind" in ('addendum', 'correction'))
);
--> statement-breakpoint
CREATE TABLE "clinical_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"professional_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone,
	"finalized_by" uuid,
	CONSTRAINT "clinical_notes_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "clinical_notes_status_ck" CHECK ("clinical_notes"."status" in ('draft', 'final'))
);
--> statement-breakpoint
CREATE TABLE "clinical_progress_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"treatment_item_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"professional_id" uuid,
	"session_label" text,
	"description" text NOT NULL,
	"resulting_status" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_status_ck" CHECK ("clinical_progress_entries"."resulting_status" in ('not_started', 'in_progress', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_centers_org_id_uq" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doc_templates_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "doc_templates_kind_ck" CHECK ("document_templates"."kind" in ('contract', 'receipt', 'consent', 'other'))
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"bank_name" text,
	"bank_code" text,
	"branch" text,
	"account_number_masked" text,
	"opening_balance_cents" bigint DEFAULT 0 NOT NULL,
	"opening_date" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "accounts_kind_ck" CHECK ("financial_accounts"."kind" in ('bank', 'cash', 'card_clearing', 'other'))
);
--> statement-breakpoint
CREATE TABLE "financial_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"payable_id" uuid,
	"receivable_id" uuid,
	"category_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"amount_cents" bigint NOT NULL,
	CONSTRAINT "fin_alloc_target_ck" CHECK (num_nonnulls("financial_allocations"."payable_id", "financial_allocations"."receivable_id") = 1),
	CONSTRAINT "fin_alloc_amount_ck" CHECK ("financial_allocations"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "financial_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"system_key" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "categories_type_ck" CHECK ("financial_categories"."type" in ('income', 'expense'))
);
--> statement-breakpoint
CREATE TABLE "generated_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"template_id" uuid,
	"template_version" integer,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"budget_id" uuid,
	"settlement_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"organization_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_pk" PRIMARY KEY("organization_id","scope","key")
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_sha256" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"occurred_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "integration_events_uq" UNIQUE("provider","external_id"),
	CONSTRAINT "integration_events_status_ck" CHECK ("integration_events"."status" in ('received', 'processed', 'ignored', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"provider" text,
	"status" text DEFAULT 'not_configured' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_settings_kind_uq" UNIQUE("organization_id","kind"),
	CONSTRAINT "integration_settings_kind_ck" CHECK ("integration_settings"."kind" in ('open_finance', 'messaging', 'email', 'payments', 'fiscal', 'esign', 'accounting')),
	CONSTRAINT "integration_settings_status_ck" CHECK ("integration_settings"."status" in ('not_configured', 'pending', 'active', 'error', 'revoked', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email_key" text NOT NULL,
	"ip" text,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_org_user_uq" UNIQUE("organization_id","user_id"),
	CONSTRAINT "memberships_status_ck" CHECK ("memberships"."status" in ('active', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid,
	"appointment_id" uuid,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"dedupe_key" text NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"body" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedupe_uq" UNIQUE("organization_id","dedupe_key"),
	CONSTRAINT "notifications_channel_ck" CHECK ("notifications"."channel" in ('whatsapp', 'sms', 'email')),
	CONSTRAINT "notifications_status_ck" CHECK ("notifications"."status" in ('pending', 'sent', 'delivered', 'failed', 'responded', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "org_counters" (
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "org_counters_pk" PRIMARY KEY("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"legal_name" text,
	"document" text,
	"phone" text,
	"email" text,
	"address" text,
	"city" text,
	"state" text,
	"brand_color" text DEFAULT '#0f766e' NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"slot_minutes" integer DEFAULT 15 NOT NULL,
	"business_hours" jsonb NOT NULL,
	"upload_max_mb" integer DEFAULT 20 NOT NULL,
	"budget_validity_days" integer DEFAULT 30 NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"requested_ip" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "patient_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"text" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_note" text,
	CONSTRAINT "alerts_kind_ck" CHECK ("patient_alerts"."kind" in ('administrative', 'clinical')),
	CONSTRAINT "alerts_priority_ck" CHECK ("patient_alerts"."priority" in ('low', 'normal', 'high'))
);
--> statement-breakpoint
CREATE TABLE "patient_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"agreement_id" uuid,
	"amount_cents" bigint NOT NULL,
	"status" text DEFAULT 'pending_decision' NOT NULL,
	"reason" text NOT NULL,
	"resolution" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credits_status_ck" CHECK ("patient_credits"."status" in ('pending_decision', 'kept_as_credit', 'refunded', 'applied')),
	CONSTRAINT "credits_amount_ck" CHECK ("patient_credits"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "patient_responsibles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text,
	"cpf" text,
	"phone" text,
	"email" text,
	"is_financial_responsible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" integer NOT NULL,
	"full_name" text NOT NULL,
	"social_name" text,
	"birth_date" date,
	"cpf" text,
	"phone" text,
	"phone_alt" text,
	"email" text,
	"zip" text,
	"street" text,
	"number" text,
	"complement" text,
	"district" text,
	"city" text,
	"state" text,
	"origin" text,
	"referred_by" text,
	"reference_professional_id" uuid,
	"admin_notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"search_key" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "patients_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "patients_org_code_uq" UNIQUE("organization_id","code"),
	CONSTRAINT "patients_status_ck" CHECK ("patients"."status" in ('active', 'archived')),
	CONSTRAINT "patients_cpf_ck" CHECK ("patients"."cpf" is null or "patients"."cpf" ~ '^[0-9]{11}$')
);
--> statement-breakpoint
CREATE TABLE "payable_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_id" uuid,
	"description" text NOT NULL,
	"category_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"amount_cents" bigint NOT NULL,
	"day_of_month" smallint NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"expected_account_id" uuid,
	"suspended_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurrences_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "recurrences_day_ck" CHECK ("payable_recurrences"."day_of_month" between 1 and 31),
	CONSTRAINT "recurrences_amount_ck" CHECK ("payable_recurrences"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "payables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_id" uuid,
	"description" text NOT NULL,
	"category_id" uuid,
	"cost_center_id" uuid,
	"competence_date" date NOT NULL,
	"due_date" date NOT NULL,
	"original_cents" bigint NOT NULL,
	"adjustment_cents" bigint DEFAULT 0 NOT NULL,
	"paid_principal_cents" bigint DEFAULT 0 NOT NULL,
	"discount_granted_cents" bigint DEFAULT 0 NOT NULL,
	"interest_paid_cents" bigint DEFAULT 0 NOT NULL,
	"fine_paid_cents" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"expected_account_id" uuid,
	"recurrence_id" uuid,
	"recurrence_period" text,
	"installment_group_id" uuid,
	"installment_number" integer,
	"installment_total" integer,
	"document_number" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "payables_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "payables_status_ck" CHECK ("payables"."status" in ('open', 'partial', 'paid', 'cancelled')),
	CONSTRAINT "payables_balance_ck" CHECK ("payables"."original_cents" > 0 and "payables"."paid_principal_cents" >= 0 and "payables"."discount_granted_cents" >= 0
        and "payables"."original_cents" + "payables"."adjustment_cents" - "payables"."paid_principal_cents" - "payables"."discount_granted_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"budget_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"subtotal_cents" bigint NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint NOT NULL,
	"total_cents" bigint NOT NULL,
	"down_payment_cents" bigint DEFAULT 0 NOT NULL,
	"installments_count" integer DEFAULT 0 NOT NULL,
	"previous_agreement_id" uuid,
	"adjustment_cents" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreements_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "agreements_revision_uq" UNIQUE("revision_id"),
	CONSTRAINT "agreements_status_ck" CHECK ("payment_agreements"."status" in ('active', 'superseded')),
	CONSTRAINT "agreements_discount_type_ck" CHECK ("payment_agreements"."discount_type" in ('none', 'amount', 'percent')),
	CONSTRAINT "agreements_totals_ck" CHECK ("payment_agreements"."total_cents" = "payment_agreements"."subtotal_cents" - "payment_agreements"."discount_cents" and "payment_agreements"."discount_cents" between 0 and "payment_agreements"."subtotal_cents")
);
--> statement-breakpoint
CREATE TABLE "price_table_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"price_table_id" uuid NOT NULL,
	"procedure_id" uuid NOT NULL,
	"price_cents" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "price_items_table_proc_uq" UNIQUE("price_table_id","procedure_id"),
	CONSTRAINT "price_items_nonneg_ck" CHECK ("price_table_items"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "price_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_tables_org_id_uq" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "procedures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"specialty_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"billing_unit" text NOT NULL,
	"allowed_locations" text[] NOT NULL,
	"suggested_minutes" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "procedures_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "procedures_unit_ck" CHECK ("procedures"."billing_unit" in ('tooth', 'arch', 'hemiarch', 'session', 'global')),
	CONSTRAINT "procedures_locations_ck" CHECK (cardinality("procedures"."allowed_locations") > 0)
);
--> statement-breakpoint
CREATE TABLE "professional_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	CONSTRAINT "prof_avail_range_ck" CHECK ("professional_availability"."weekday" between 0 and 6 and "professional_availability"."start_minute" >= 0 and "professional_availability"."end_minute" <= 1440 and "professional_availability"."end_minute" > "professional_availability"."start_minute")
);
--> statement-breakpoint
CREATE TABLE "professional_specialties" (
	"organization_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"specialty_id" uuid NOT NULL,
	CONSTRAINT "professional_specialties_pk" PRIMARY KEY("professional_id","specialty_id")
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"council" text,
	"council_number" text,
	"council_state" text,
	"color" text DEFAULT '#0f766e' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professionals_org_id_uq" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "receivable_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"receivable_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"agreement_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rec_adj_source_ck" CHECK ("receivable_adjustments"."source" in ('revision', 'manual', 'cancellation')),
	CONSTRAINT "rec_adj_nonzero_ck" CHECK ("receivable_adjustments"."amount_cents" <> 0)
);
--> statement-breakpoint
CREATE TABLE "receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid,
	"agreement_id" uuid,
	"budget_id" uuid,
	"kind" text NOT NULL,
	"installment_number" integer,
	"description" text NOT NULL,
	"category_id" uuid,
	"cost_center_id" uuid,
	"competence_date" date NOT NULL,
	"due_date" date NOT NULL,
	"original_cents" bigint NOT NULL,
	"adjustment_cents" bigint DEFAULT 0 NOT NULL,
	"paid_principal_cents" bigint DEFAULT 0 NOT NULL,
	"discount_granted_cents" bigint DEFAULT 0 NOT NULL,
	"interest_received_cents" bigint DEFAULT 0 NOT NULL,
	"fine_received_cents" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"expected_method" text,
	"method_note" text,
	"expected_account_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "receivables_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "receivables_kind_ck" CHECK ("receivables"."kind" in ('down_payment', 'installment', 'manual', 'adjustment')),
	CONSTRAINT "receivables_status_ck" CHECK ("receivables"."status" in ('open', 'partial', 'paid', 'cancelled')),
	CONSTRAINT "receivables_balance_ck" CHECK ("receivables"."original_cents" > 0 and "receivables"."paid_principal_cents" >= 0 and "receivables"."discount_granted_cents" >= 0
        and "receivables"."original_cents" + "receivables"."adjustment_cents" - "receivables"."paid_principal_cents" - "receivables"."discount_granted_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reconciliation_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reconciliation_id" uuid NOT NULL,
	"bank_transaction_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recon_alloc_amount_ck" CHECK ("reconciliation_allocations"."amount_cents" <> 0)
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone,
	"undone_by" uuid,
	"undo_reason" text,
	CONSTRAINT "reconciliations_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "reconciliations_status_ck" CHECK ("reconciliations"."status" in ('active', 'undone'))
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "roles_org_key_uq" UNIQUE("organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "schedule_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"professional_id" uuid,
	"kind" text NOT NULL,
	"local_date" date,
	"weekday" smallint,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"start_date" date,
	"until_date" date,
	"reason" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_kind_ck" CHECK ("schedule_blocks"."kind" in ('single', 'weekly')),
	CONSTRAINT "blocks_shape_ck" CHECK (("schedule_blocks"."kind" = 'single' and "schedule_blocks"."local_date" is not null) or ("schedule_blocks"."kind" = 'weekly' and "schedule_blocks"."weekday" between 0 and 6 and "schedule_blocks"."start_date" is not null)),
	CONSTRAINT "blocks_range_ck" CHECK ("schedule_blocks"."end_minute" > "schedule_blocks"."start_minute" and "schedule_blocks"."start_minute" >= 0 and "schedule_blocks"."end_minute" <= 1440)
);
--> statement-breakpoint
CREATE TABLE "scheduling_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"treatment_item_id" uuid,
	"reason" text NOT NULL,
	"due_date" date,
	"responsible_user_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"appointment_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	CONSTRAINT "sched_tasks_status_ck" CHECK ("scheduling_tasks"."status" in ('open', 'scheduled', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"active_organization_id" uuid,
	"mfa_verified_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "settlement_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"settlement_id" uuid NOT NULL,
	"receivable_id" uuid,
	"payable_id" uuid,
	"principal_cents" bigint DEFAULT 0 NOT NULL,
	"interest_cents" bigint DEFAULT 0 NOT NULL,
	"fine_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "settlement_alloc_target_ck" CHECK (num_nonnulls("settlement_allocations"."receivable_id", "settlement_allocations"."payable_id") = 1),
	CONSTRAINT "settlement_alloc_values_ck" CHECK ("settlement_allocations"."principal_cents" >= 0 and "settlement_allocations"."interest_cents" >= 0 and "settlement_allocations"."fine_cents" >= 0 and "settlement_allocations"."discount_cents" >= 0
        and "settlement_allocations"."principal_cents" + "settlement_allocations"."interest_cents" + "settlement_allocations"."fine_cents" + "settlement_allocations"."discount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"account_id" uuid NOT NULL,
	"method" text NOT NULL,
	"method_note" text,
	"settled_on" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversal_reason" text,
	"bank_transaction_id" uuid,
	"notes" text,
	"idempotency_key" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "settlements_direction_ck" CHECK ("settlements"."direction" in ('in', 'out')),
	CONSTRAINT "settlements_status_ck" CHECK ("settlements"."status" in ('active', 'reversed')),
	CONSTRAINT "settlements_amount_ck" CHECK ("settlements"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "specialties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "specialties_org_id_uq" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document" text,
	"phone" text,
	"email" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_org_id_uq" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_account_id" uuid NOT NULL,
	"to_account_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"occurred_on" date NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversed_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "transfers_accounts_ck" CHECK ("transfers"."from_account_id" <> "transfers"."to_account_id"),
	CONSTRAINT "transfers_amount_ck" CHECK ("transfers"."amount_cents" > 0),
	CONSTRAINT "transfers_status_ck" CHECK ("transfers"."status" in ('active', 'reversed'))
);
--> statement-breakpoint
CREATE TABLE "treatment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"treatment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"budget_item_id" uuid NOT NULL,
	"lineage_id" uuid NOT NULL,
	"procedure_id" uuid NOT NULL,
	"procedure_name" text NOT NULL,
	"specialty_name" text NOT NULL,
	"location_label" text NOT NULL,
	"clinical_status" text DEFAULT 'not_started' NOT NULL,
	"cancelled_reason" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"financial_review_pending" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "treatment_items_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "treatment_items_lineage_uq" UNIQUE("treatment_id","lineage_id"),
	CONSTRAINT "treatment_items_status_ck" CHECK ("treatment_items"."clinical_status" in ('not_started', 'in_progress', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "treatments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"budget_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treatments_budget_id_unique" UNIQUE("budget_id"),
	CONSTRAINT "treatments_org_id_uq" UNIQUE("organization_id","id"),
	CONSTRAINT "treatments_status_ck" CHECK ("treatments"."status" in ('active', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"mfa_secret" text,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "account_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "movements_account_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "movements_settlement_fk" FOREIGN KEY ("organization_id","settlement_id") REFERENCES "public"."settlements"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "movements_transfer_fk" FOREIGN KEY ("organization_id","transfer_id") REFERENCES "public"."transfers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_movements" ADD CONSTRAINT "movements_category_fk" FOREIGN KEY ("organization_id","category_id") REFERENCES "public"."financial_categories"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_item_allocations" ADD CONSTRAINT "agreement_item_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_item_allocations" ADD CONSTRAINT "agreement_alloc_agreement_fk" FOREIGN KEY ("organization_id","agreement_id") REFERENCES "public"."payment_agreements"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_item_allocations" ADD CONSTRAINT "agreement_alloc_item_fk" FOREIGN KEY ("organization_id","budget_item_id") REFERENCES "public"."budget_items"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis_responses" ADD CONSTRAINT "anamnesis_responses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis_responses" ADD CONSTRAINT "anamnesis_responses_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis_responses" ADD CONSTRAINT "anamnesis_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis_responses" ADD CONSTRAINT "anamnesis_template_fk" FOREIGN KEY ("organization_id","template_id") REFERENCES "public"."anamnesis_templates"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis_responses" ADD CONSTRAINT "anamnesis_reviewer_fk" FOREIGN KEY ("organization_id","reviewed_by_professional_id") REFERENCES "public"."professionals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis_templates" ADD CONSTRAINT "anamnesis_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis_templates" ADD CONSTRAINT "anamnesis_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_procedures" ADD CONSTRAINT "appointment_procedures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_procedures" ADD CONSTRAINT "appt_proc_appointment_fk" FOREIGN KEY ("organization_id","appointment_id") REFERENCES "public"."appointments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_procedures" ADD CONSTRAINT "appt_proc_item_fk" FOREIGN KEY ("organization_id","treatment_item_id") REFERENCES "public"."treatment_items"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appt_history_appointment_fk" FOREIGN KEY ("organization_id","appointment_id") REFERENCES "public"."appointments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rescheduled_from_id_appointments_id_fk" FOREIGN KEY ("rescheduled_from_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_status_changed_by_users_id_fk" FOREIGN KEY ("status_changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_fk" FOREIGN KEY ("organization_id","professional_id") REFERENCES "public"."professionals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_links" ADD CONSTRAINT "attachment_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_links" ADD CONSTRAINT "attachment_links_attachment_fk" FOREIGN KEY ("organization_id","attachment_id") REFERENCES "public"."attachments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_links" ADD CONSTRAINT "attachment_links_item_fk" FOREIGN KEY ("organization_id","treatment_item_id") REFERENCES "public"."treatment_items"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_links" ADD CONSTRAINT "attachment_links_appointment_fk" FOREIGN KEY ("organization_id","appointment_id") REFERENCES "public"."appointments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment_links" ADD CONSTRAINT "attachment_links_budget_fk" FOREIGN KEY ("organization_id","budget_id") REFERENCES "public"."budgets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_derived_from_id_attachments_id_fk" FOREIGN KEY ("derived_from_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_conn_account_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_import_batches" ADD CONSTRAINT "bank_import_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_import_batches" ADD CONSTRAINT "bank_import_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_import_batches" ADD CONSTRAINT "bank_import_batches_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_import_batches" ADD CONSTRAINT "bank_batches_account_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_ignored_by_users_id_fk" FOREIGN KEY ("ignored_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_tx_account_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_tx_batch_fk" FOREIGN KEY ("organization_id","batch_id") REFERENCES "public"."bank_import_batches"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_approvals" ADD CONSTRAINT "budget_approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_approvals" ADD CONSTRAINT "budget_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_approvals" ADD CONSTRAINT "approvals_budget_fk" FOREIGN KEY ("organization_id","budget_id") REFERENCES "public"."budgets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_approvals" ADD CONSTRAINT "approvals_revision_fk" FOREIGN KEY ("organization_id","revision_id") REFERENCES "public"."budget_revisions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_item_locations" ADD CONSTRAINT "budget_item_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_item_locations" ADD CONSTRAINT "item_locations_item_fk" FOREIGN KEY ("organization_id","item_id") REFERENCES "public"."budget_items"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_fk" FOREIGN KEY ("organization_id","budget_id") REFERENCES "public"."budgets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_revision_fk" FOREIGN KEY ("organization_id","revision_id") REFERENCES "public"."budget_revisions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_procedure_fk" FOREIGN KEY ("organization_id","procedure_id") REFERENCES "public"."procedures"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_specialty_fk" FOREIGN KEY ("organization_id","specialty_id") REFERENCES "public"."specialties"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_revisions" ADD CONSTRAINT "revisions_budget_fk" FOREIGN KEY ("organization_id","budget_id") REFERENCES "public"."budgets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_professional_fk" FOREIGN KEY ("organization_id","professional_id") REFERENCES "public"."professionals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_price_table_fk" FOREIGN KEY ("organization_id","price_table_id") REFERENCES "public"."price_tables"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_fee_rules" ADD CONSTRAINT "card_fee_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_receivables" ADD CONSTRAINT "card_receivables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_receivables" ADD CONSTRAINT "card_receivables_settled_by_users_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_receivables" ADD CONSTRAINT "card_rec_tx_fk" FOREIGN KEY ("organization_id","card_transaction_id") REFERENCES "public"."card_transactions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_receivables" ADD CONSTRAINT "card_rec_bank_fk" FOREIGN KEY ("organization_id","bank_account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_tx_settlement_fk" FOREIGN KEY ("organization_id","settlement_id") REFERENCES "public"."settlements"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_tx_clearing_fk" FOREIGN KEY ("organization_id","clearing_account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_note_addenda" ADD CONSTRAINT "clinical_note_addenda_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_note_addenda" ADD CONSTRAINT "clinical_note_addenda_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_note_addenda" ADD CONSTRAINT "addenda_note_fk" FOREIGN KEY ("organization_id","note_id") REFERENCES "public"."clinical_notes"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_appointment_fk" FOREIGN KEY ("organization_id","appointment_id") REFERENCES "public"."appointments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_professional_fk" FOREIGN KEY ("organization_id","professional_id") REFERENCES "public"."professionals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_progress_entries" ADD CONSTRAINT "clinical_progress_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_progress_entries" ADD CONSTRAINT "clinical_progress_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_progress_entries" ADD CONSTRAINT "progress_item_fk" FOREIGN KEY ("organization_id","treatment_item_id") REFERENCES "public"."treatment_items"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_progress_entries" ADD CONSTRAINT "progress_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_progress_entries" ADD CONSTRAINT "progress_appointment_fk" FOREIGN KEY ("organization_id","appointment_id") REFERENCES "public"."appointments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_progress_entries" ADD CONSTRAINT "progress_professional_fk" FOREIGN KEY ("organization_id","professional_id") REFERENCES "public"."professionals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "financial_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "fin_alloc_payable_fk" FOREIGN KEY ("organization_id","payable_id") REFERENCES "public"."payables"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "fin_alloc_receivable_fk" FOREIGN KEY ("organization_id","receivable_id") REFERENCES "public"."receivables"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "fin_alloc_category_fk" FOREIGN KEY ("organization_id","category_id") REFERENCES "public"."financial_categories"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "fin_alloc_cost_center_fk" FOREIGN KEY ("organization_id","cost_center_id") REFERENCES "public"."cost_centers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_docs_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_docs_template_fk" FOREIGN KEY ("organization_id","template_id") REFERENCES "public"."document_templates"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_docs_budget_fk" FOREIGN KEY ("organization_id","budget_id") REFERENCES "public"."budgets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_docs_settlement_fk" FOREIGN KEY ("organization_id","settlement_id") REFERENCES "public"."settlements"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "public"."roles"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "public"."roles"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_appointment_fk" FOREIGN KEY ("organization_id","appointment_id") REFERENCES "public"."appointments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_counters" ADD CONSTRAINT "org_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_alerts" ADD CONSTRAINT "patient_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_alerts" ADD CONSTRAINT "patient_alerts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_alerts" ADD CONSTRAINT "patient_alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_alerts" ADD CONSTRAINT "alerts_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_credits" ADD CONSTRAINT "patient_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_credits" ADD CONSTRAINT "patient_credits_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_credits" ADD CONSTRAINT "patient_credits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_credits" ADD CONSTRAINT "credits_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_credits" ADD CONSTRAINT "credits_agreement_fk" FOREIGN KEY ("organization_id","agreement_id") REFERENCES "public"."payment_agreements"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_responsibles" ADD CONSTRAINT "patient_responsibles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_responsibles" ADD CONSTRAINT "responsibles_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_ref_professional_fk" FOREIGN KEY ("organization_id","reference_professional_id") REFERENCES "public"."professionals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_recurrences" ADD CONSTRAINT "payable_recurrences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_recurrences" ADD CONSTRAINT "payable_recurrences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_recurrences" ADD CONSTRAINT "recurrences_supplier_fk" FOREIGN KEY ("organization_id","supplier_id") REFERENCES "public"."suppliers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_recurrences" ADD CONSTRAINT "recurrences_category_fk" FOREIGN KEY ("organization_id","category_id") REFERENCES "public"."financial_categories"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payable_recurrences" ADD CONSTRAINT "recurrences_cost_center_fk" FOREIGN KEY ("organization_id","cost_center_id") REFERENCES "public"."cost_centers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_supplier_fk" FOREIGN KEY ("organization_id","supplier_id") REFERENCES "public"."suppliers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_category_fk" FOREIGN KEY ("organization_id","category_id") REFERENCES "public"."financial_categories"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_cost_center_fk" FOREIGN KEY ("organization_id","cost_center_id") REFERENCES "public"."cost_centers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_account_fk" FOREIGN KEY ("organization_id","expected_account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payables" ADD CONSTRAINT "payables_recurrence_fk" FOREIGN KEY ("organization_id","recurrence_id") REFERENCES "public"."payable_recurrences"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_agreements" ADD CONSTRAINT "payment_agreements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_agreements" ADD CONSTRAINT "payment_agreements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_agreements" ADD CONSTRAINT "agreements_budget_fk" FOREIGN KEY ("organization_id","budget_id") REFERENCES "public"."budgets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_agreements" ADD CONSTRAINT "agreements_revision_fk" FOREIGN KEY ("organization_id","revision_id") REFERENCES "public"."budget_revisions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_agreements" ADD CONSTRAINT "agreements_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_table_items" ADD CONSTRAINT "price_table_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_table_items" ADD CONSTRAINT "price_table_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_table_items" ADD CONSTRAINT "price_items_table_fk" FOREIGN KEY ("organization_id","price_table_id") REFERENCES "public"."price_tables"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_table_items" ADD CONSTRAINT "price_items_procedure_fk" FOREIGN KEY ("organization_id","procedure_id") REFERENCES "public"."procedures"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_tables" ADD CONSTRAINT "price_tables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_specialty_fk" FOREIGN KEY ("organization_id","specialty_id") REFERENCES "public"."specialties"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_availability" ADD CONSTRAINT "professional_availability_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_availability" ADD CONSTRAINT "prof_avail_professional_fk" FOREIGN KEY ("organization_id","professional_id") REFERENCES "public"."professionals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_specialties" ADD CONSTRAINT "professional_specialties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_specialties" ADD CONSTRAINT "prof_spec_professional_fk" FOREIGN KEY ("organization_id","professional_id") REFERENCES "public"."professionals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_specialties" ADD CONSTRAINT "prof_spec_specialty_fk" FOREIGN KEY ("organization_id","specialty_id") REFERENCES "public"."specialties"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_adjustments" ADD CONSTRAINT "receivable_adjustments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_adjustments" ADD CONSTRAINT "receivable_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_adjustments" ADD CONSTRAINT "rec_adj_receivable_fk" FOREIGN KEY ("organization_id","receivable_id") REFERENCES "public"."receivables"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_adjustments" ADD CONSTRAINT "rec_adj_agreement_fk" FOREIGN KEY ("organization_id","agreement_id") REFERENCES "public"."payment_agreements"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_agreement_fk" FOREIGN KEY ("organization_id","agreement_id") REFERENCES "public"."payment_agreements"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_budget_fk" FOREIGN KEY ("organization_id","budget_id") REFERENCES "public"."budgets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_category_fk" FOREIGN KEY ("organization_id","category_id") REFERENCES "public"."financial_categories"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_cost_center_fk" FOREIGN KEY ("organization_id","cost_center_id") REFERENCES "public"."cost_centers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_account_fk" FOREIGN KEY ("organization_id","expected_account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_allocations" ADD CONSTRAINT "reconciliation_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_allocations" ADD CONSTRAINT "recon_alloc_reconciliation_fk" FOREIGN KEY ("organization_id","reconciliation_id") REFERENCES "public"."reconciliations"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_allocations" ADD CONSTRAINT "recon_alloc_bank_fk" FOREIGN KEY ("organization_id","bank_transaction_id") REFERENCES "public"."bank_transactions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_allocations" ADD CONSTRAINT "recon_alloc_movement_fk" FOREIGN KEY ("organization_id","movement_id") REFERENCES "public"."account_movements"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_undone_by_users_id_fk" FOREIGN KEY ("undone_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_account_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "blocks_professional_fk" FOREIGN KEY ("organization_id","professional_id") REFERENCES "public"."professionals"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_tasks" ADD CONSTRAINT "scheduling_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_tasks" ADD CONSTRAINT "scheduling_tasks_responsible_user_id_users_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_tasks" ADD CONSTRAINT "scheduling_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_tasks" ADD CONSTRAINT "scheduling_tasks_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_tasks" ADD CONSTRAINT "sched_tasks_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_tasks" ADD CONSTRAINT "sched_tasks_item_fk" FOREIGN KEY ("organization_id","treatment_item_id") REFERENCES "public"."treatment_items"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_tasks" ADD CONSTRAINT "sched_tasks_appointment_fk" FOREIGN KEY ("organization_id","appointment_id") REFERENCES "public"."appointments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_organization_id_organizations_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_allocations" ADD CONSTRAINT "settlement_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_allocations" ADD CONSTRAINT "settlement_alloc_settlement_fk" FOREIGN KEY ("organization_id","settlement_id") REFERENCES "public"."settlements"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_allocations" ADD CONSTRAINT "settlement_alloc_receivable_fk" FOREIGN KEY ("organization_id","receivable_id") REFERENCES "public"."receivables"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_allocations" ADD CONSTRAINT "settlement_alloc_payable_fk" FOREIGN KEY ("organization_id","payable_id") REFERENCES "public"."payables"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_account_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialties" ADD CONSTRAINT "specialties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_fk" FOREIGN KEY ("organization_id","from_account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_fk" FOREIGN KEY ("organization_id","to_account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_items" ADD CONSTRAINT "treatment_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_items" ADD CONSTRAINT "treatment_items_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_items" ADD CONSTRAINT "treatment_items_treatment_fk" FOREIGN KEY ("organization_id","treatment_id") REFERENCES "public"."treatments"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_items" ADD CONSTRAINT "treatment_items_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_items" ADD CONSTRAINT "treatment_items_budget_item_fk" FOREIGN KEY ("organization_id","budget_item_id") REFERENCES "public"."budget_items"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_budget_fk" FOREIGN KEY ("organization_id","budget_id") REFERENCES "public"."budgets"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movements_account_date_idx" ON "account_movements" USING btree ("organization_id","account_id","occurred_on");--> statement-breakpoint
CREATE INDEX "anamnesis_patient_idx" ON "anamnesis_responses" USING btree ("organization_id","patient_id");--> statement-breakpoint
CREATE INDEX "appt_history_appt_idx" ON "appointment_status_history" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointments_day_idx" ON "appointments" USING btree ("organization_id","local_date");--> statement-breakpoint
CREATE INDEX "appointments_prof_day_idx" ON "appointments" USING btree ("organization_id","professional_id","local_date");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("organization_id","patient_id");--> statement-breakpoint
CREATE INDEX "attachment_links_attachment_idx" ON "attachment_links" USING btree ("attachment_id");--> statement-breakpoint
CREATE INDEX "attachments_patient_idx" ON "attachments" USING btree ("organization_id","patient_id");--> statement-breakpoint
CREATE INDEX "audit_org_created_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_tx_external_uq" ON "bank_transactions" USING btree ("account_id","external_id") WHERE "bank_transactions"."external_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_tx_fingerprint_uq" ON "bank_transactions" USING btree ("account_id","fingerprint","occurrence_index") WHERE "bank_transactions"."external_id" is null;--> statement-breakpoint
CREATE INDEX "bank_tx_account_date_idx" ON "bank_transactions" USING btree ("organization_id","account_id","posted_on");--> statement-breakpoint
CREATE INDEX "item_locations_item_idx" ON "budget_item_locations" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "budget_items_revision_idx" ON "budget_items" USING btree ("revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "revisions_one_open_uq" ON "budget_revisions" USING btree ("budget_id") WHERE "budget_revisions"."status" = 'open';--> statement-breakpoint
CREATE INDEX "budgets_patient_idx" ON "budgets" USING btree ("organization_id","patient_id");--> statement-breakpoint
CREATE INDEX "clinical_notes_patient_idx" ON "clinical_notes" USING btree ("organization_id","patient_id");--> statement-breakpoint
CREATE INDEX "progress_item_idx" ON "clinical_progress_entries" USING btree ("treatment_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_system_key_uq" ON "financial_categories" USING btree ("organization_id","system_key") WHERE "financial_categories"."system_key" is not null;--> statement-breakpoint
CREATE INDEX "generated_docs_patient_idx" ON "generated_documents" USING btree ("organization_id","patient_id");--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email_key","created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX "notifications_pending_idx" ON "notifications" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_org_cpf_uq" ON "patients" USING btree ("organization_id","cpf") WHERE "patients"."cpf" is not null;--> statement-breakpoint
CREATE INDEX "patients_org_search_idx" ON "patients" USING btree ("organization_id","search_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payables_recurrence_period_uq" ON "payables" USING btree ("recurrence_id","recurrence_period") WHERE "payables"."recurrence_id" is not null;--> statement-breakpoint
CREATE INDEX "payables_due_idx" ON "payables" USING btree ("organization_id","status","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "price_tables_default_uq" ON "price_tables" USING btree ("organization_id") WHERE "price_tables"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "price_tables_org_name_uq" ON "price_tables" USING btree ("organization_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "procedures_org_code_uq" ON "procedures" USING btree ("organization_id",lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "professionals_org_user_uq" ON "professionals" USING btree ("organization_id","user_id") WHERE "professionals"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "receivables_due_idx" ON "receivables" USING btree ("organization_id","status","due_date");--> statement-breakpoint
CREATE INDEX "receivables_patient_idx" ON "receivables" USING btree ("organization_id","patient_id");--> statement-breakpoint
CREATE INDEX "recon_alloc_bank_idx" ON "reconciliation_allocations" USING btree ("bank_transaction_id");--> statement-breakpoint
CREATE INDEX "recon_alloc_movement_idx" ON "reconciliation_allocations" USING btree ("movement_id");--> statement-breakpoint
CREATE INDEX "sched_tasks_patient_idx" ON "scheduling_tasks" USING btree ("organization_id","patient_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "settlement_alloc_receivable_idx" ON "settlement_allocations" USING btree ("receivable_id");--> statement-breakpoint
CREATE INDEX "settlement_alloc_payable_idx" ON "settlement_allocations" USING btree ("payable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_idem_uq" ON "settlements" USING btree ("organization_id","idempotency_key") WHERE "settlements"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "specialties_org_name_uq" ON "specialties" USING btree ("organization_id",lower("name"));--> statement-breakpoint
CREATE INDEX "treatment_items_patient_idx" ON "treatment_items" USING btree ("organization_id","patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));