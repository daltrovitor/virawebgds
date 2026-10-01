# Serviços, ações e rotas

A aplicação não expõe uma API pública REST: a interface chama **Server Actions** (`src/actions/`), que delegam a **serviços** (`src/server/services/`). Rotas HTTP existem só para conteúdo binário (arquivos, PDF, CSV). Toda entrada é validada com Zod no serviço, e toda operação recebe um `Ctx` derivado da sessão.

## Contrato comum

### Contexto (`src/server/context.ts`)

```ts
interface Ctx {
  db: Db;           // conexão (ou transação)
  orgId: string;    // clínica ativa da sessão — nunca vem do navegador
  userId: string;
  userName: string;
  roleKey: string;
  permissions: ReadonlySet<Permission>;
  timezone: string; // fuso da clínica
  ip?: string | null;
}
```

`getRequestContext()` (`src/server/session.ts`) monta o `Ctx` a partir do cookie `og_session`, exigindo sessão válida, MFA concluído quando ativado e participação ativa na clínica selecionada.

### Resultado das ações (`src/server/action-result.ts`)

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string>; details?: unknown };
```

| `code` | HTTP equivalente | Quando |
|---|---|---|
| `unauthenticated` | 401 | Sessão ausente ou expirada |
| `forbidden` | 403 | Sem permissão para a ação |
| `not_found` | 404 | Objeto inexistente **ou de outra clínica** (não revela existência) |
| `validation` | 422 | Entrada inválida; `fieldErrors` por campo |
| `conflict` | 409 | Versão desatualizada, conflito de agenda (`details.conflicts`, `details.overbookAllowed`), duplicata de item (`details.duplicates`) |
| `business_rule` | 422 | Regra de negócio violada (ex.: desconto acima do subtotal) |
| `unexpected` | 500 | Erro não previsto; mensagem genérica, log sem dados de pacientes |

### Idempotência

Operações que não podem duplicar recebem `idempotencyKey` (UUID gerado ao abrir o diálogo): aprovação de orçamento, baixas, pagamento em cartão, liquidação de recebível, transferência, confirmação de importação OFX, conciliação. Repetir a chamada devolve o mesmo resultado (`replayed: true` quando aplicável).

### Concorrência

Edições de orçamento e títulos carregam `expectedVersion`; divergência gera `conflict`. Agenda, baixas e conciliações são protegidas também por restrições do banco.

## Serviços e permissões

Leituras de catálogo, profissionais e configurações básicas são permitidas a qualquer membro ativo da clínica. As demais exigem as permissões indicadas (`a + b` = ambas; `a | b` = qualquer uma).

### Pacientes — `patients.ts`

| Função | Permissão |
|---|---|
| `searchPatients`, `getPatient`, `listResponsibles`, `listAlerts` | `patients.view` (CPF completo só com `patients.view_documents`; alertas clínicos só com `clinical.view`) |
| `quickCreatePatient`, `savePatient`, `setPatientStatus`, `saveResponsible`, `deleteResponsible` | `patients.edit` |
| `findPossibleDuplicates` | interno (chamado no cadastro) |
| `createAlert`, `resolveAlert` | `patients.edit` (administrativo) ou `clinical.edit` (clínico) |
| `listSchedulingTasks` / `createSchedulingTask`, `cancelSchedulingTask` | `schedule.view` / `schedule.edit` |

### Catálogo e profissionais — `catalog.ts`, `professionals.ts`

| Função | Permissão |
|---|---|
| `saveSpecialty`, `saveProcedure`, `savePriceTable`, `setPrice` | `catalog.manage` |
| `saveProfessional` | `settings.manage` |
| `listSpecialties`, `listProcedures`, `listPriceTables`, `listPrices`, `catalogForBudget`, `listProfessionals` | membro da clínica |

### Orçamentos — `budgets.ts`

| Função | Permissão | Observação |
|---|---|---|
| `createBudget`, `addItems`, `updateItem`, `removeItem`, `saveNegotiation`, `changeBudgetStatus` | `budgets.edit` | `addItems` lança `DuplicateItemError` (conflict) sem justificativa |
| `getBudget`, `listBudgets`, `revisionItems` | `budgets.view` | valores do acordo/títulos só com `finance.view` ou `budgets.approve` |
| `approveBudget` | `budgets.approve` | transação única + idempotência + `expectedVersion` |
| `startRevision`, `discardRevision` | `budgets.revise` | |

### Tratamentos — `treatments.ts`

| Função | Permissão |
|---|---|
| `listPatientTreatmentItems`, `patientTreatmentSummary` | `schedule.view` \| `clinical.view` \| `budgets.view` |
| `recordProgress` | `clinical.edit` |
| `cancelTreatmentItem` | `treatments.edit` |
| `resolveFinancialReview` | `finance.edit` |
| `listUnscheduledItems` | `schedule.view` \| `reports.view` |

### Agenda — `appointments.ts`, `notifications.ts`

| Função | Permissão | Observação |
|---|---|---|
| `getAgenda`, `getAppointment`, `listPendingClosure`, `listPatientAppointments`, `listBlocks`, `listNotifications` | `schedule.view` | descrição clínica do card só com `clinical.view` |
| `createAppointment`, `moveAppointment`, `updateAppointmentDetails`, `changeAppointmentStatus`, `rescheduleAppointment` | `schedule.edit` | conflito → `ScheduleConflictError`; encaixe exige `schedule.overbook` + `overbook: true` + motivo |
| `recordAppointmentOutcome` | `clinical.edit` | desfecho por item; não conclui itens automaticamente |
| `createBlock`, `deactivateBlock` | `schedule.edit` | bloqueio único ou semanal |

### Clínico e arquivos — `clinical.ts`, `attachments.ts`, `documents.ts`

| Função | Permissão |
|---|---|
| `clinicalTimeline`, `listAnamnesis`, `progressEntries` | `clinical.view` |
| `saveClinicalNote`, `addNoteAddendum`, `deleteDraftNote`, `recordAnamnesis`, `reviewAnamnesis` | `clinical.edit` |
| `saveAnamnesisTemplate`, `updateTemplate` | `settings.manage` |
| `uploadAttachment`, `archiveAttachment` | `attachments.upload` |
| `listGallery` | `attachments.view` |
| `setProfilePhoto` | `patients.edit` |
| `generateContract` | `budgets.approve` |
| `generateReceipt` | `finance.settle` |
| `listDocuments`, `getDocument` | `patients.view` (+ `finance.view` para recibos) |

### Financeiro — `titles.ts`, `finance-setup.ts`

| Função | Permissão |
|---|---|
| `listTitles`, `getTitle`, `listRecurrences`, `listMovements`, `listCardReceivables`, `patientFinancialSummary`, `listSettlementsForTitles`, `listCardFeeRules` | `finance.view` |
| `listAccounts`, `listSuppliers` | `finance.view` \| `finance.settle` / `finance.edit` |
| `createReceivable`, `createPayable`, `updateTitleDue`, `cancelTitle`, `createRecurrence`, `generateRecurringPayables`, `suspendRecurrence` | `finance.edit` |
| `saveAccount`, `saveCategory`, `saveCostCenter`, `saveSupplier`, `saveCardFeeRule` | `finance.edit` |
| `settleTitles`, `recordCardPayment`, `settleCardReceivable`, `createTransfer` | `finance.settle` |
| `reverseSettlement`, `reverseTransfer` | `finance.reverse` |

### Extrato e conciliação — `bank.ts`

| Função | Permissão |
|---|---|
| `previewOfxImport`, `getImportBatch`, `confirmOfxImport`, `discardOfxImport`, `listImportBatches` | `finance.reconcile` |
| `reconciliationWorkspace`, `reconcile`, `undoReconciliation`, `ignoreBankTransaction`, `unignoreBankTransaction`, `openTitlesForBankTransaction` | `finance.reconcile` |
| `settleFromBankTransaction` | `finance.reconcile` + `finance.settle` |
| `createEntryFromBankTransaction` | `finance.reconcile` + `finance.edit` |

### Relatórios — `reports.ts`

| Função | Permissão |
|---|---|
| `overview` | membro; cada bloco respeita a permissão correspondente |
| `scheduleReport` | `reports.view` \| `schedule.view` |
| `budgetReport` | `reports.view` \| `budgets.view` |
| `receivablesPosition`, `cashByCategory`, `cashflow` | `finance.view` |
| `reconciliationReport` | `finance.reconcile` \| (`reports.view` + `finance.view`) |

### Administração — `organizations.ts`, `users.ts`, `integrations.ts`, `audit.ts`

| Função | Permissão |
|---|---|
| `updateSettings` | `settings.manage` (cor da marca com contraste ≥ 4,5:1) |
| `listMembers`, `updateMember`, `inviteMember`, `listInvitations`, `revokeInvitation`, `adminResetLink`, `updateRolePermissions`, `createRole` | `users.manage` |
| `listIntegrations`, `setIntegrationStatus` | `settings.manage` (ativar exige credenciais e clínica não-demonstração) |
| `listAuditLogs` | `audit.view` |
| `createOrganization`, `createUser` | apenas scripts de linha de comando |

### Autenticação — `auth/service.ts`

`login` (limite por e-mail e IP), `createSession`, `resolveSession`, `revokeSession`, `verifySessionMfa`, `listMemberships`, `selectOrganization`, `requestPasswordReset` (resposta idêntica para e-mail existente ou não), `resetPassword` (revoga sessões), `changePassword`.

## Server Actions (`src/actions/`)

Cada action: obtém o `Ctx`, chama o serviço dentro de `runAction`, revalida as rotas afetadas.

| Arquivo | Actions |
|---|---|
| `auth.ts` | login, logout, verifyMfa, selectOrganization, requestReset, resetPassword, acceptInvite, changePassword, startMfaSetup, confirmMfaSetup |
| `patients.ts` | savePatient, quickCreatePatient, setPatientStatus, saveResponsible, deleteResponsible, createAlert, resolveAlert, createSchedulingTask, cancelSchedulingTask, searchPatients |
| `budgets.ts` | createBudget, addItems, updateItem, removeItem, saveNegotiation, approveBudget, changeBudgetStatus, startRevision, discardRevision, generateContract, recordProgress, cancelTreatmentItem, resolveFinancialReview |
| `schedule.ts` | createAppointment, moveAppointment, updateAppointmentDetails, changeAppointmentStatus, rescheduleAppointment, recordOutcome, createBlock, deactivateBlock, loadAppointment, loadPatientTreatmentItems |
| `clinical.ts` | saveClinicalNote, addNoteAddendum, deleteDraftNote, recordAnamnesis, reviewAnamnesis, saveAnamnesisTemplate, uploadAttachment (FormData), archiveAttachment, setProfilePhoto |
| `finance.ts` | settleTitles, recordCardPayment, settleCardReceivable, reverseSettlement, createReceivable, createPayable, updateTitleDue, cancelTitle, createRecurrence, generateRecurring, suspendRecurrence, createTransfer, reverseTransfer, generateReceipt, saveAccount, saveCategory, saveCostCenter, saveSupplier, saveCardFeeRule, previewOfx, confirmOfx, discardOfx, reconcile, undoReconciliation, ignoreBankTx, unignoreBankTx, settleFromBank, createEntryFromBank, openTitlesForBank, categories |
| `admin.ts` | saveSpecialty, saveProcedure, savePriceTable, setPrice, saveProfessional, updateSettings, updateTemplate, updateRolePermissions, createRole, updateMember, inviteMember, revokeInvitation, adminResetLink |

## Rotas HTTP (`src/app/api/`)

| Rota | Método | Autorização | Resposta |
|---|---|---|---|
| `/api/arquivos/[id]?o=&v=&exp=&sig=` | GET | assinatura HMAC válida e não expirada (10 min) **e** sessão com participação na clínica **e** `attachments.view` | Arquivo original (`v=original`) ou miniatura (`v=thumb`); `Content-Security-Policy: sandbox`, `nosniff` |
| `/api/orcamentos/[id]/pdf` | GET | sessão + `budgets.view` | PDF do orçamento (valores conforme permissão) |
| `/api/documentos/[id]/pdf` | GET | sessão + `patients.view` (+ `finance.view` para recibo) | PDF de contrato ou recibo gerado |
| `/api/exportar/receber`, `/api/exportar/pagar`, `/api/exportar/movimentos` | GET | sessão + `finance.export` | CSV (`;`, UTF-8 com BOM) com os filtros da tela e proteção contra fórmulas |

## Contratos de integração (`src/server/services/integrations.ts`)

```ts
interface MessagingProvider {
  send(input: { to: string; body: string; channel: "whatsapp" | "sms" }): Promise<{ providerMessageId: string }>;
}
interface BankSyncProvider {
  authorize(accountId: string): Promise<{ redirectUrl: string }>;
  sync(accountId: string, from: string, to: string): Promise<{ transactions: { externalId: string; postedOn: string; amountCents: number; description: string }[] }>;
}
```

Tipos de integração: `open_finance`, `messaging`, `email`, `payments`, `fiscal`, `esign`, `accounting`. Estados: Não configurada, Aguardando autorização, Ativa, Com erro, Revogada, Expirada. Sem credenciais no ambiente, o estado exibido é sempre “Não configurada”. Eventos de integração (`integration_events`) têm deduplicação por provedor + ID externo, preparados para webhooks fora de ordem.
