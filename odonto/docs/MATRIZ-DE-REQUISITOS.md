# Matriz de requisitos

Referência: especificação “Sistema de gestão odontológica e financeira” v1.0 (30/09/2026). Situação em 01/10/2026.

**Tipo**: C = central (definido pelo solicitante) · P = decisão proposta adotada como padrão · I = integração externa.
**Estado**: **Testado** = coberto por teste automatizado · **Implementado** = funcionando e conferido na interface, sem teste automatizado dedicado · **Pendente** = não feito ou parcial (detalhe na linha) · **Dependente de integração** = contrato pronto, aguarda fornecedor/credencial.

**Testes**: `U:` [tests/unit](../tests/unit) · `I:` [tests/integration](../tests/integration) · `E2E` = [tests/e2e/journey.spec.ts](../tests/e2e/journey.spec.ts) · `V` = conferido manualmente no navegador ([VALIDACAO-INTERFACE.md](VALIDACAO-INTERFACE.md)).

## Cenários de aceitação (seção 20)

| # | Cenário | Teste | Estado |
|---|---|---|---|
| 1 | Clínica A não acessa paciente, arquivo, orçamento, relatório ou movimento da B, nem trocando IDs | I: tenancy-auth (cenário 1 + FK composta), files | Testado |
| 2 | Profissional sem permissão financeira não obtém valores pela API | I: budgets “cenário 2” | Testado |
| 3 | Preço editado no item não altera a tabela | I: budgets “cenários 3 e 4”, E2E | Testado |
| 4 | Tabela atualizada depois não muda orçamento salvo | I: budgets “cenários 3 e 4” | Testado |
| 5 | Prótese e Dentística no mesmo dente + itens em dentes distintos | I: budgets “cenário 5”, E2E | Testado |
| 6 | Por dente R$600×2 = R$1.200; global ambas arcadas R$300; por arcada ambas R$600 | U: budget-teeth; I: budgets “cenário 6” | Testado |
| 7 | Aprovação parcial gera tratamento e títulos só do aprovado | I: budgets “cenários 7 e 8” | Testado |
| 8 | R$10.000 − 10% = R$9.000; entrada R$1.000 + 4 × R$2.000 | U: money-plan; I: budgets | Testado |
| 9 | R$100 em 3 parcelas fecha R$100 | U: money-plan “cenário 9” | Testado |
| 10 | Dia-base 30 → 28/02/2027 → 30/03/2027 | U: money-plan “cenário 10” | Testado |
| 11 | Duplo clique/reenvio não duplica parcelas nem tratamento | I: budgets “cenário 11” | Testado |
| 12 | Receber R$300 de R$1.000 deixa R$700; 2º recebimento e estorno corretos e auditados | I: budgets “cenário 12” | Testado |
| 13 | Revisão de orçamento parcialmente pago preserva pagamentos e gera ajuste explícito | I: budgets “cenário 13” + crédito pendente | Testado |
| 14 | 09h15–10h00 = 45 min; persiste; arrastar/editar atualiza horário | U: schedule; I: schedule “cenário 14”; E2E (arrastar) | Testado |
| 15 | Conflito no servidor, inclusive simultâneo; encaixe exige permissão | I: schedule “cenário 15” + restrição do banco | Testado |
| 16 | Consulta finalizada com procedimento em andamento; pagamento não conclui procedimento | I: schedule “cenário 16” | Testado |
| 17 | Remarcação preserva antiga, vincula nova, invalida lembretes | I: schedule “cenário 17” | Testado |
| 18 | Consulta passada sem desfecho vai para pendências, sem falta presumida | I: schedule “cenário 18” | Testado |
| 19 | Imagem na galeria só para autorizados; link expirado falha | I: files “cenário 19” + tipos perigosos | Testado |
| 20 | Reimportar OFX não duplica; idênticas sem ID exigem tratamento | U: ofx; I: finance “cenário 20” | Testado |
| 21 | Conciliar com pagamento existente não cria 2ª receita nem baixa | I: finance “cenário 21”, E2E | Testado |
| 22 | Agrupados/parciais respeitam saldo; excesso recusado, inclusive concorrente | I: finance “cenário 22” | Testado |
| 23 | Transferência altera saldos e não é receita/despesa | I: finance “cenário 23” | Testado |
| 24 | Cartão R$1.000, taxa R$30, líquido R$970 rastreável; sem receita duplicada | I: finance “cenário 24”, V | Testado |
| 25 | Lançamentos explicam saldos; projeção não duplica pagos | U: cashflow; I: finance “cenário 25” | Testado |
| 26 | Integração sem credencial aparece “Não configurada” | I: finance “cenário 26” + bloqueio em clínica demo | Testado |
| 27 | Backup restaurado recupera vínculos e arquivos | I: backup “cenário 27” | Testado |

## Organização, usuários e segurança (seções 4 e 17) — Fase 1

| Requisito | Tipo | Módulo | Teste | Estado |
|---|---|---|---|---|
| Clínica = tenant; todas as entidades com `organization_id` e FK composta | C | `db/schema.ts` | I: tenancy-auth | Testado |
| Usuário em várias clínicas, papel por clínica, seleção explícita | C | `auth/service.ts`, `(auth)/selecionar-clinica` | I: tenancy-auth | Testado |
| Tenant vem da sessão, nunca do navegador | C | `session.ts`, `context.ts` | I: tenancy-auth | Testado |
| Papéis padrão (proprietário, dentista, recepção, financeiro, contador) e permissões editáveis | P | `domain/permissions.ts`, Configurações → Usuários | I: budgets “cenário 2”; V | Testado |
| Contador sem acesso a imagens/anamnese por padrão | C | `DEFAULT_ROLE_PERMISSIONS` | Mesma checagem de permissão testada com a recepção em I: files | Implementado |
| Sem superusuário de plataforma com acesso clínico | C | (não existe papel de plataforma) | — | Implementado |
| Suporte excepcional limitado, autorizado e auditado | C | — | — | Pendente |
| Profissionais: registro, especialidades, situação, horários | C | `services/professionals.ts`, Cadastros → Profissionais | V | Implementado |
| Expediente por profissional aplicado na agenda | C | `professional_availability` | — | Pendente (cadastrado, ainda não usado na checagem; a agenda usa o expediente da clínica e bloqueios por profissional) |
| Configurações: identidade, contatos, fuso, expediente, dias, intervalo da grade, cor | C | `services/organizations.ts`, Configurações → Clínica | V | Implementado |
| Login real, sessão httpOnly, inatividade 12 h / absoluta 7 dias | C | `auth/*`, `session.ts` | I: tenancy-auth | Testado |
| Limite de tentativas (5 por e-mail, 30 por IP em 15 min) | C | `auth/service.ts` | I: tenancy-auth | Testado |
| Recuperação de acesso por token de uso único (1 h), revoga sessões | C | `auth/service.ts`, `(auth)/redefinir-senha` | I: tenancy-auth | Testado |
| MFA TOTP opcional, segredo cifrado | P | `auth/crypto.ts`, Configurações → Minha conta | V | Implementado |
| MFA obrigatório para administradores e financeiro | P | — | — | Pendente (opcional por usuário) |
| Convite de usuários e link de redefinição gerado pelo administrador | C | `services/users.ts` | V | Implementado |
| Auditoria somente-inclusão (preços, aprovações, clínico, permissões, baixas, estornos, conciliações) | C | `audit.ts` + gatilho | I: tenancy-auth | Testado |
| Logs sem anamnese, conteúdo clínico, tokens, CPF completo, dados bancários | C | `audit.ts` (redação), `maskAccount`, `maskCpf` | U: CPF mascarado | Implementado (redação da auditoria sem teste dedicado) |
| Cabeçalhos de segurança (CSP frame-ancestors, X-Frame-Options, nosniff) | C | `next.config.ts` | — | Implementado |
| Segredos apenas em variáveis de ambiente | C | `.env.example` | — | Implementado |
| Ambiente de demonstração separado; sem envio real a partir de dados de teste | C | `isDemo`, `email.ts`, `integrations.ts` | I: finance (clínica demo) | Testado |
| Backup e restauração testados | C | `server/backup.ts`, scripts | I: backup | Testado |
| Política de retenção / arquivamento sem exclusão física | C | Arquivamento de paciente; sem exclusão física de dados clínicos/financeiros | — | Implementado (política formal de retenção pendente de definição jurídica) |

## Navegação e experiência (seção 5)

| Requisito | Tipo | Módulo | Teste | Estado |
|---|---|---|---|---|
| Menu: Visão geral, Agenda, Pacientes, Orçamentos e tratamentos, Financeiro, Relatórios, Cadastros, Configurações | C | `components/shell` | V | Implementado |
| Busca por nome, telefone e documento (CPF conforme permissão) | C | `services/patients.ts` | V | Implementado |
| Listas com paginação, busca, filtros e estados vazios | C | `components/ui/page.tsx` | V | Implementado |
| Carregamento, sucesso e falha sem perder o formulário | C | `use-action.ts`, `toast.tsx` | E2E, V | Implementado |
| Cor sempre com texto; teclado e foco visível | C | `globals.css`, componentes | V | Implementado |
| Confirmar descarte de edição não salva e ações de impacto | C | formulários de paciente, consulta, anotação; diálogos de confirmação | V | Implementado |
| Desktop prioritário, adaptação a tablet/celular, sem rolagem horizontal | C | layout | V (375 px) | Implementado |
| Permissões respeitadas na interface, API e exportações | C | serviços + `api/exportar` | I: budgets “cenário 2” | Testado |

## Paciente (seção 6) — Fases 1 e 3

| Requisito | Tipo | Módulo | Teste | Estado |
|---|---|---|---|---|
| Cadastro completo, CPF opcional e validado, idade calculada | C | `services/patients.ts`, `domain/text.ts`, `domain/dates.ts` | U: CPF; V | Testado |
| Cadastro rápido com nome e contato | C | `quickCreatePatient` | E2E | Testado |
| Detecção de possíveis duplicidades, sem unir automaticamente | C | `findPossibleDuplicates` | V | Implementado |
| Responsável, origem, profissional de referência, arquivamento | C | ficha → Cadastro | V | Implementado |
| Cabeçalho com foto, idade, contato e ações (Agendar, Novo orçamento, Adicionar arquivo, Editar) | C | `pacientes/[id]/page.tsx` | E2E, V | Implementado |
| Cards: alertas, próxima consulta, pendências, tratamento, financeiro (conforme acesso) | C | ficha → Visão geral | V | Implementado |
| 10 abas da ficha | C | `pacientes/[id]/tabs.tsx` | V | Implementado |
| Pendências distintas: futuras, passadas sem desfecho, agendamento, faltas/desmarcações, alertas | C | `appointments.ts`, `patients.ts` | I: schedule “cenário 18”; V | Testado |
| Upload de fotos, radiografias e PDFs com validação por conteúdo e limite | C | `services/attachments.ts` | I: files | Testado |
| Metadados (tipo, data do exame, autor, descrição) e vínculo a dente/tratamento/consulta | C | `attachments`, `attachment_links` | I: files; V | Testado |
| Galeria com miniaturas, ampliação, zoom e comparação de duas imagens | P | `gallery-panel.tsx` | V | Implementado |
| Filtros por tipo e tratamento | C | `gallery-panel.tsx` | V | Implementado |
| Filtro por período na galeria | C | — | — | Pendente |
| Original preservado, derivados separados, armazenamento privado, links temporários | C | `attachments.ts`, `storage.ts`, `api/arquivos` | I: files | Testado |
| DICOM / 3D | — | fora do escopo | — | Não contratado |
| Linha do tempo clínica (consultas, evoluções, anotações, anexos) | C | `services/clinical.ts` | V | Implementado |
| Rascunho editável; finalizado só com adendo | C | `clinical.ts` + gatilho | I: tenancy-auth | Testado |
| Anamnese configurável, versionada, respostas datadas, revisão de alertas | P | `clinical.ts`, Configurações → Anamnese | V | Implementado |
| Sem diagnóstico automático | C | — | — | Implementado |

## Catálogo e orçamento (seções 7 e 8) — Fases 1 e 2

| Requisito | Tipo | Módulo | Teste | Estado |
|---|---|---|---|---|
| Especialidade → procedimentos → preço em uma ou mais tabelas | C | `services/catalog.ts`, Cadastros | I: budgets | Testado |
| Unidades: dente, arcada, hemiarcada, sessão, global; localizações permitidas | C+P | `domain/budget.ts` | U: budget-teeth | Testado |
| Preço desconhecido ≠ zero | C | `price_table_items`, `ItemForm` | U/I: budgets “cenário 6” | Testado |
| Item copia nome, especialidade, unidade, preço de referência e aplicado | C | `budget_items` | I: budgets “cenário 4” | Testado |
| Inativar procedimento/especialidade preserva histórico | C | `catalog.ts` | V | Implementado |
| Trocar especialidade limpa procedimento incompatível | C | `item-form.tsx` | E2E | Testado |
| Número único por clínica, cabeçalho com responsável, data, tabela, origem | C | `createBudget`, `org_counters` | I: budgets | Testado |
| Odontograma FDI permanente/decíduo com alternativa textual | C | `odontogram.tsx`, `domain/teeth.ts` | U: budget-teeth; E2E | Testado |
| Várias especialidades no mesmo orçamento; mesmo dente com vários procedimentos | C | `addItems` | I: “cenário 5” | Testado |
| N dentes = N itens rastreáveis, total N × preço exibido antes | C | `expandItems`, `ItemForm` | U; E2E | Testado |
| Duplicata idêntica exige justificativa | C | `findDuplicates`, `DuplicateItemError` | U; I: “cenário 5” | Testado |
| Editar/remover itens em rascunho/negociação com recálculo no servidor | C | `updateItem`, `removeItem` | I: budgets | Testado |
| Estados do orçamento e do item | P | `domain/budget.ts` | I: budgets | Testado |
| Aprovação parcial | P | `approveBudget` | I: “cenário 7” | Testado |
| Revisões com versão anterior, autor, motivo, itens e diferença | P | `startRevision`, `approveBudget` | I: “cenário 13” | Testado |
| PDF legível do orçamento sem informação clínica desnecessária | C | `api/orcamentos/[id]/pdf` | V | Implementado |

## Negociação e plano (seção 9) — Fase 2

| Requisito | Tipo | Módulo | Teste | Estado |
|---|---|---|---|---|
| Fórmulas subtotal/desconto/total/saldo; desconto em R$ ou %, nunca ambos | C | `domain/payment-plan.ts` | U: money-plan | Testado |
| Centavos inteiros; recálculo no servidor; limites de desconto e entrada | C | `domain/money.ts`, `approveBudget` | U; I | Testado |
| Rateio determinístico do desconto entre itens aceitos | C | `prorate`, `agreement_item_allocations` | U | Testado |
| Entrada como título próprio; previsão ≠ recebimento | C | `receivables.kind = down_payment` | I | Testado |
| Parcela com vencimento, valor e forma editáveis; salvar só se fecha o total | C | `negotiation-panel.tsx`, `validatePlan` | U; E2E | Testado |
| Formas Pix, dinheiro, débito, crédito, boleto, transferência, outra identificada; combinação | C | `PAYMENT_METHODS` | U | Testado |
| Arredondamento fecha o total | C | `splitEvenly` | U: “cenário 9” | Testado |
| Mensal preserva dia-base; nunca +30 dias | C | `monthlySchedule` | U: “cenário 10” | Testado |
| Total zero aprova sem títulos vazios | C | `approveBudget` | U; I | Testado |
| Simulação não cria dívida; aprovação cria títulos uma vez | C | `saveNegotiation`, idempotência | I: “cenário 11” | Testado |
| Recebimento parcial e múltiplos pagamentos por parcela | C | `settleTitles` | I: “cenário 12” | Testado |
| Recibo reflete só valor recebido | C | `generateReceipt` | V | Implementado |
| Contrato a partir de modelo configurável, sem alegar validade jurídica | C | `generateContract`, Configurações → Modelos | V | Implementado |
| Assinatura eletrônica | I | contrato `esign` | — | Dependente de integração |

## Tratamento e agenda (seções 10 e 11) — Fase 3

| Requisito | Tipo | Módulo | Teste | Estado |
|---|---|---|---|---|
| Item aprovado vira item de tratamento ligado à versão e localização | C | `approveBudget` | I: “cenário 7” | Testado |
| Estados clínicos; cancelamento com revisão financeira separada | C | `services/treatments.ts` | I: schedule (estados); cancelamento sem teste dedicado | Implementado |
| Várias sessões por item com evolução | C | `clinical_progress_entries` | I: “cenário 16” | Testado |
| Consulta com itens de orçamentos diferentes do mesmo paciente; bloqueio de outro paciente/clínica | C | `createAppointment` | I: schedule, tenancy | Testado |
| Finalizar não conclui itens; pagamento não conclui tratamento | C | `recordAppointmentOutcome` | I: “cenário 16” | Testado |
| Evolução = concluídos ÷ ativos, “Sem itens ativos” | P | `progressOf` | I: schedule | Testado |
| Dia e Semana; grade de 15 min; duração em múltiplos | C | `agenda-view.tsx`, `domain/appointments.ts` | U; I; E2E | Testado |
| Visão Mês | — | — | — | Pendente (opcional na especificação) |
| Filtro por profissional e profissionais lado a lado (dia) | P | `agenda-view.tsx` | V | Implementado |
| Cards com paciente, horário, situação; destaque de hoje e linha da hora atual | C | `agenda-view.tsx` | V | Implementado |
| Anterior/próximo, Hoje, seletor de data, bloqueios visíveis | C | `agenda-view.tsx` | V | Implementado |
| Criar clicando no horário; arrastar e redimensionar; alternativa por formulário | C+P | `agenda-view.tsx`, `appointment-form.tsx` | E2E; V | Testado |
| Bloqueio único e recorrente semanal por profissional | C | `createBlock`, Agenda → Bloqueios | V | Implementado |
| Formulário completo (primeira consulta, previsto/realizado, procedimentos, lembrete) | C | `appointment-form.tsx` | E2E | Testado |
| Atalho de WhatsApp sem envio e botão Abrir ficha | C | `whatsappLink` | U | Testado |
| Procedimentos do paciente com filtros de situação; selecionar não executa | C | `appointment-form.tsx` | E2E; V | Implementado |
| 10 estados da consulta, motivo e autoria | C | `domain/appointments.ts` | U; I | Testado |
| Remarcação preserva e vincula; correção de horário auditada | C | `rescheduleAppointment`, `moveAppointment` | I: “cenários 14 e 17” | Testado |
| Conflito e bloqueio no servidor, inclusive concorrente; encaixe com permissão | C | `appointments.ts` + `EXCLUDE` | I: “cenário 15” | Testado |
| Pendências sem falta automática | C | `listPendingClosure` | I: “cenário 18” | Testado |
| Estrutura de notificações (Pendente, Enviada, Entregue, Falha, Respondida) e cancelamento de lembretes | C | `services/notifications.ts` | I: “cenário 17” | Testado |
| Envio automático por WhatsApp/SMS | I | contrato `MessagingProvider` | I: “cenário 26” | Dependente de integração |

## Financeiro da clínica (seção 12) — Fase 4

| Requisito | Tipo | Módulo | Teste | Estado |
|---|---|---|---|---|
| Contas (banco, caixa, recebíveis de cartão) com saldo inicial e data | C | `services/finance-setup.ts` | I: finance | Testado |
| Fornecedores, categorias, centros de custo | C | `finance-setup.ts`, Cadastros → Financeiro | V | Implementado |
| Receber de orçamentos ou avulsos identificados | C | `createReceivable` | I | Testado |
| Contas a pagar com fornecedor, categoria, competência, vencimento, centro de custo | C | `createPayable` | I: finance | Testado |
| Anexos em contas a pagar | C | — | — | Pendente (anexos hoje são da ficha do paciente) |
| Parcelamento e recorrência idempotente com suspensão | C | `createPayable`, recorrências | I: finance | Testado |
| Rateio por categoria/centro fecha o valor | C | `financial_allocations` | I: finance | Testado |
| Baixa parcial, múltiplas, juros, multa, desconto explícitos | C | `settleTitles` | I: “cenário 12” | Testado |
| Estorno por movimento reverso | C | `reverseSettlement` | I: “cenário 12” | Testado |
| Transferências entre contas | C | `transfers` | I: “cenário 23” | Testado |
| Previstos não alteram saldo realizado | C | `cashflow` | I: “cenário 25” | Testado |
| Cartão: bruto, taxa, líquido, previsão/realização, antecipação separada; sem número do cartão | C | `recordCardPayment`, `settleCardReceivable` | I: “cenário 24” | Testado |
| Fluxo diário e mensal, realizado × projetado | C | `reports.cashflow`, Financeiro → Fluxo de caixa | U; I; V | Testado |
| Painel: a receber, a pagar, vencidos, realizado no período, saldos por conta | C | Financeiro → Painel | V | Implementado |
| Relatório por categoria (caixa) | C | `cashByCategory` | I: finance | Testado |
| Relatório por centro de custo e por profissional | C | — | — | Pendente |
| DRE por competência | C | — | — | Pendente (depende de regra de reconhecimento a definir com o contador) |

## Importação e conciliação (seção 13) — Fase 4

| Requisito | Tipo | Módulo | Teste | Estado |
|---|---|---|---|---|
| OFX por conta, validação, prévia e erros antes de confirmar | C | `domain/ofx.ts`, `previewOfxImport` | U; I; E2E | Testado |
| Lote, ID da transação, data, valor, descrição, origem; importar não cria receita | C | `bank_import_batches`, `bank_transactions` | I: “cenário 20” | Testado |
| Deduplicação por ID ou impressão digital; ambíguas sinalizadas | C | `bank.ts` + índices únicos | I: “cenário 20” | Testado |
| Tela em duas colunas com filtros | C | `reconciliation-workspace.tsx` | E2E; V | Implementado |
| Sugestões com motivo, sem baixa automática | C | `domain/reconciliation.ts` | U | Testado |
| Conciliar com liquidação existente ou dar baixa com confirmação; impedir dupla baixa | C | `reconcile`, `settleFromBankTransaction` | I: “cenário 21” | Testado |
| Criar lançamento a partir do extrato | C | `createEntryFromBankTransaction` | I: finance; V | Testado |
| N↔N com alocações e validação da soma, inclusive concorrente | C | `reconcileWithinTx` + CHECK | I: “cenário 22” | Testado |
| Pendente, Conciliado, Ignorado com justificativa | C | `bank.ts` | V | Implementado |
| Desfazer conciliação ≠ estornar baixa | C | `undoReconciliation` | I: finance | Testado |
| Saldo bancário só quando informado; divergência exibida | C | `reconciliationReport` | V | Implementado |
| Conexão automática Open Finance, sincronização, expiração | I | `BankSyncProvider`, `bank_connections` | I: “cenário 26” | Dependente de integração |

## Relatórios (seção 14) — Fase 4

| Relatório | Módulo | Teste | Estado |
|---|---|---|---|
| Consultas do dia por situação | `reports.overview` | V | Implementado |
| Faltas, cancelamentos e pendências por período, taxa com denominador | `scheduleReport` | V | Implementado |
| Orçamentos por situação; conversão com base e período informados | `budgetReport` | V | Implementado |
| Orçado, aprovado, recebido, vencido e em aberto em bases separadas | `receivablesPosition` | V | Implementado |
| Tratamentos em andamento e procedimentos não agendados | `treatments.ts`, Orçamentos → Não agendados | V | Implementado |
| A pagar/receber, fluxo e categorias | `cashflow`, `cashByCategory` | I: finance | Testado |
| Pendências de conciliação e divergências por conta | `reconciliationReport` | I: finance | Testado |
| CSV com filtros, permissões e proteção contra fórmulas | `api/exportar`, `domain/csv.ts` | U: csv | Testado |

## Integrações e comercialização (seção 18) — Fase 5

| Integração | Estado |
|---|---|
| Open Finance / extratos automáticos | Dependente de integração (OFX manual funciona) |
| Pix, boleto, link de cartão | Dependente de integração |
| WhatsApp / SMS | Dependente de integração |
| E-mail transacional | Implementado com Resend quando `RESEND_API_KEY` e `EMAIL_FROM` existem; não testado com envio real |
| Notas fiscais | Dependente de integração (não contratado) |
| Assinatura eletrônica | Dependente de integração (não contratado) |
| Exportação contábil / ERP (ex.: Conta Azul) | Dependente de integração; o núcleo não depende da Conta Azul |
| Onboarding de nova clínica | Implementado por linha de comando (`clinic:create`); autoatendimento pendente |
| Controle de funcionalidades por plano e cobrança do SaaS | Pendente (planos não definidos) |
