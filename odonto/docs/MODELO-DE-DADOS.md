# Modelo de dados

Fonte da verdade: [`src/server/db/schema.ts`](../src/server/db/schema.ts) (70 tabelas) e as migrações em [`drizzle/`](../drizzle). Os diagramas abaixo mostram as entidades e relações essenciais por módulo; colunas de auditoria (`created_at`, `created_by`, `updated_at`…) e `organization_id` foram omitidas para leitura.

## Convenções

- **IDs**: UUID gerados no banco.
- **Tenant**: toda tabela de negócio tem `organization_id` e `unique (organization_id, id)`. FKs entre tabelas de negócio são compostas `(organization_id, x_id) → (organization_id, id)`: o banco recusa vínculos entre clínicas.
- **Dinheiro**: `bigint` em centavos (`*_cents`). Percentuais em pontos-base (`basis points`, 10% = 1000).
- **Datas civis** (`date`): vencimento, competência, data de baixa, data da consulta. **Instantes** (`timestamptz`): auditoria, início/fim de consulta.
- **Estados separados**: orçamento, item do orçamento, item de tratamento, consulta, título, liquidação e transação bancária têm cada um seu próprio campo de situação.
- **Histórico**: nada financeiro ou clínico é apagado; estornos, adendos, revisões e desfazer conciliação geram novos registros.

## Organização, acesso e auditoria

```mermaid
erDiagram
  organizations ||--|| organization_settings : "configura"
  organizations ||--o{ memberships : "tem"
  users ||--o{ memberships : "participa"
  roles ||--o{ memberships : "define papel"
  organizations ||--o{ roles : "papéis editáveis"
  users ||--o{ sessions : "abre"
  users ||--o{ password_reset_tokens : "solicita"
  organizations ||--o{ invitations : "convida"
  organizations ||--o{ audit_logs : "registra"
  organizations ||--o{ idempotency_keys : "deduplica"
  organizations ||--o{ professionals : "cadastra"
  users |o--o| professionals : "pode ser"
  professionals ||--o{ professional_specialties : ""
  professionals ||--o{ professional_availability : "expediente"
  organizations ||--o{ integration_settings : "estado por integração"

  memberships { uuid user_id uuid role_id text status }
  roles { text key text name text_array permissions bool is_system }
  sessions { text token_hash uuid active_organization_id timestamptz mfa_verified_at timestamptz last_seen_at timestamptz expires_at timestamptz revoked_at }
  audit_logs { text action text entity_type uuid entity_id text summary jsonb changes }
```

## Pacientes, catálogo e orçamento

```mermaid
erDiagram
  patients ||--o{ patient_responsibles : ""
  patients ||--o{ patient_alerts : "alertas por permissão"
  patients ||--o{ scheduling_tasks : "pendências de agendamento"
  specialties ||--o{ procedures : "possui"
  price_tables ||--o{ price_table_items : ""
  procedures ||--o{ price_table_items : "preço por tabela"
  patients ||--o{ budgets : ""
  price_tables ||--o{ budgets : "referência"
  budgets ||--o{ budget_revisions : "versões"
  budget_revisions |o--o| budget_revisions : "previous_revision_id"
  budget_revisions ||--o{ budget_items : ""
  budget_items ||--o{ budget_item_locations : "dente/arcada/hemiarcada"
  budgets ||--o{ budget_approvals : ""

  budgets { int number date budget_date text origin text status uuid current_revision_id int version }
  budget_revisions { int number text status text reason jsonb negotiation }
  budget_items { uuid lineage_id text procedure_name text specialty_name text billing_unit bigint reference_price_cents bigint unit_price_cents bigint subtotal_cents text approval_status text duplicate_justification }
  budget_item_locations { text kind smallint tooth text arch smallint hemiarch }
```

- O item **copia** nome, especialidade, unidade, preço de referência e preço aplicado: alterar a tabela depois não muda orçamentos salvos.
- `reference_price_cents` nulo = procedimento sem preço cadastrado (diferente de zero = gratuidade deliberada).
- `lineage_id` liga o mesmo item entre revisões, para preservar tratamento e pagamentos.

## Acordo de pagamento, títulos e liquidações

```mermaid
erDiagram
  budget_revisions ||--o| payment_agreements : "acordo aprovado"
  payment_agreements |o--o| payment_agreements : "previous_agreement_id"
  payment_agreements ||--o{ agreement_item_allocations : "rateio do desconto"
  payment_agreements ||--o{ receivables : "entrada e parcelas"
  receivables ||--o{ receivable_adjustments : "ajustes de revisão"
  payment_agreements ||--o{ patient_credits : "crédito pendente"
  suppliers ||--o{ payables : ""
  payable_recurrences ||--o{ payables : "ocorrências"
  receivables ||--o{ financial_allocations : "rateio categoria/centro"
  payables ||--o{ financial_allocations : "rateio categoria/centro"
  settlements ||--o{ settlement_allocations : ""
  settlement_allocations }o--|| receivables : "ou"
  settlement_allocations }o--|| payables : "ou"
  settlements ||--o{ account_movements : "efeito no caixa"
  financial_accounts ||--o{ account_movements : ""
  transfers ||--|{ account_movements : "saída + entrada"
  account_movements |o--o| account_movements : "reverses_movement_id (estorno)"

  receivables { text kind date due_date date competence_date bigint original_cents bigint adjustment_cents bigint paid_principal_cents bigint discount_granted_cents text status int version }
  settlements { text direction text method date settled_on bigint amount_cents text status uuid bank_transaction_id text idempotency_key }
  settlement_allocations { bigint principal_cents bigint interest_cents bigint fine_cents bigint discount_cents }
  account_movements { date occurred_on bigint amount_cents text kind bigint reconciled_cents }
```

- **Saldo do título** = `original + ajustes − principal recebido − desconto concedido`. Restrição `receivables_balance_ck` (e equivalente em `payables`) garante saldo ≥ 0 mesmo com baixas simultâneas.
- **Saldo da conta** = saldo inicial + soma de `account_movements` até a data. Títulos em aberto não alteram saldo realizado.

## Cartões

```mermaid
erDiagram
  settlements ||--o| card_transactions : "pagamento do paciente"
  card_transactions ||--|{ card_receivables : "recebíveis da operadora"
  card_receivables ||--o{ account_movements : "liquidação no banco"
  card_fee_rules }o--|| financial_accounts : "conta de recebíveis"

  card_transactions { text acquirer text brand text payment_type int installments bigint gross_cents bigint fee_cents bigint net_cents }
  card_receivables { int installment_number date expected_date bigint gross_cents bigint fee_cents bigint net_cents bigint anticipation_fee_cents text status }
```

Não há coluna para número do cartão nem código de segurança.

## Extrato bancário e conciliação

```mermaid
erDiagram
  financial_accounts ||--o{ bank_import_batches : "importações OFX"
  bank_import_batches ||--o{ bank_transactions : ""
  reconciliations ||--|{ reconciliation_allocations : ""
  reconciliation_allocations }o--|| bank_transactions : ""
  reconciliation_allocations }o--|| account_movements : ""
  financial_accounts ||--o{ bank_connections : "futuro Open Finance"

  bank_transactions { text external_id text fingerprint int occurrence_index date posted_on bigint amount_cents text status text ignore_reason bool ambiguous bigint reconciled_cents }
  reconciliations { text status timestamptz undone_at text undo_reason }
```

- Deduplicação: índice único `(conta, external_id)` quando o banco envia FITID; sem FITID, `(conta, fingerprint, occurrence_index)` — duas transações reais idênticas recebem índices diferentes e ficam marcadas como ambíguas para revisão.
- `reconciled_cents` em transações e movimentos tem restrição `|conciliado| ≤ |valor|` com mesmo sinal: conciliação excedente falha no banco, inclusive concorrente.

## Tratamento, agenda e clínico

```mermaid
erDiagram
  budgets ||--o{ treatments : ""
  treatments ||--o{ treatment_items : ""
  budget_items ||--o| treatment_items : "item aprovado"
  treatment_items ||--o{ clinical_progress_entries : "sessões e evolução"
  appointments ||--o{ appointment_procedures : "itens programados"
  treatment_items ||--o{ appointment_procedures : ""
  appointments ||--o{ appointment_status_history : ""
  appointments |o--o| appointments : "rescheduled_from_id"
  professionals ||--o{ appointments : ""
  professionals ||--o{ schedule_blocks : "bloqueio único ou semanal"
  appointments ||--o{ notifications : "lembretes"
  patients ||--o{ clinical_notes : ""
  clinical_notes ||--o{ clinical_note_addenda : "correções"
  anamnesis_templates ||--o{ anamnesis_responses : "versões preservadas"
  patients ||--o{ attachments : ""
  attachments ||--o{ attachment_links : "dente/tratamento/consulta/orçamento"
  document_templates ||--o{ generated_documents : "contrato/recibo"

  treatment_items { text clinical_status bool financial_review_pending text location_label }
  appointments { date local_date int start_minute int end_minute timestamptz starts_at timestamptz ends_at text status bool is_first_visit bool is_overbook text planned text performed text reminder_preference int version }
  clinical_notes { text status text title text body timestamptz finalized_at }
  attachments { text kind text mime_type text storage_key text thumbnail_key text sha256 date taken_on int size_bytes uuid derived_from_id bool is_profile_photo }
```

## Restrições de integridade além do ORM (`drizzle/0001_integrity_constraints.sql`)

| Restrição | Efeito |
|---|---|
| `appointments_no_overlap` (`EXCLUDE USING gist`) | Mesmo profissional não tem duas consultas ocupantes sobrepostas, salvo encaixe autorizado (`is_overbook`) |
| FKs circulares (`budgets_current_revision_fk`, `revisions_previous_fk`, `agreements_previous_fk`, `settlements_bank_tx_fk`, `movements_card_receivable_fk`, `movements_reverses_fk`) | Integridade entre versões, estornos e vínculos com extrato |
| `movements_reverses_once_uq` | Um movimento só pode ser estornado uma vez |
| Gatilho `prevent_final_clinical_note_update` | Registro clínico finalizado não é alterado nem excluído |
| Gatilho de auditoria somente-inclusão | `audit_logs` não aceita `UPDATE` nem `DELETE` |
