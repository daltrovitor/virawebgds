# Arquitetura, decisões e premissas

## Visão geral

Monólito modular em Next.js (App Router), com regras de negócio em serviços de servidor e cálculos puros no domínio. Não há microsserviços: o volume esperado do piloto não justifica, e o isolamento entre clínicas é garantido pelo banco e pelos serviços.

```
Navegador ──► Páginas (Server Components) ──► Serviços ──► PostgreSQL
          └─► Server Actions (formulários) ──┘     │
          └─► Rotas HTTP (arquivos, PDF, CSV) ─────┤──► Armazenamento privado
                                                   └──► Domínio puro (dinheiro, datas, planos…)
```

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Aplicação | Next.js 16 (App Router), React 19, TypeScript estrito | Frontend tipado e backend no mesmo projeto; Server Components evitam expor dados que a página não precisa |
| Estilo | Tailwind CSS 4 com tokens em `src/app/globals.css` | Tokens centralizados; cor de destaque por clínica derivada com `color-mix` |
| Validação | Zod 4 em todas as entradas de serviço | Validação no servidor independente da interface |
| Banco | PostgreSQL + Drizzle ORM 0.45 + `postgres` (postgres.js) | Relacional, transações, restrições declarativas, migrações versionadas |
| Migrações | drizzle-kit (`drizzle/0000…`) + SQL manual (`drizzle/0001…`) | Restrições que o ORM não expressa: exclusão por sobreposição, gatilhos, FKs circulares |
| Arquivos | Adaptador local (dev) ou Supabase Storage privado | Arquivos fora do banco, metadados e vínculos no banco |
| Imagens | `sharp` (miniaturas), tipo detectado por assinatura de bytes | Original preservado; derivados separados |
| PDF | `pdf-lib` com fontes padrão | Sem dependência nativa; texto sanitizado para WinAnsi |
| Movimento | `motion` (avisos), `lenis` (rolagem; desligado com `prefers-reduced-motion`) | Discreto, sem interferir em tabelas e diálogos |
| Testes | Vitest 3 (unidade + integração com Postgres real), Playwright (jornada) | Riscos reais testados contra o banco de verdade |

O ambiente de desenvolvimento (Windows com Smart App Control) bloqueia binários nativos novos; por isso `--webpack` com SWC WASM e Vitest 3. Detalhes no README.

## Organização do código

```
src/
  domain/            Regras puras e testáveis: money, dates, teeth, budget, payment-plan,
                     appointments, ofx, reconciliation, cashflow, csv, permissions, text
  server/
    db/              schema.ts (70 tabelas), client, migrate, sql.ts (q() para subconsultas)
    auth/            crypto (scrypt, tokens, TOTP), service (login, sessões, MFA, redefinição)
    services/        Casos de uso por módulo (patients, budgets, titles, bank, appointments…)
    context.ts       Ctx autenticado + assertCan/assertCanAny
    session.ts       Cookie httpOnly → sessão → clínica ativa → permissões (somente servidor)
    audit.ts         Auditoria somente-inclusão com redação de campos sensíveis
    idempotency.ts   Chaves de idempotência e contadores por clínica
    storage.ts       Adaptadores de armazenamento privado
    pdf.ts, backup.ts, email.ts, secrets.ts, errors.ts, validation.ts
  actions/           Server Actions finas: validam sessão, chamam serviço, devolvem ActionResult
  app/
    (auth)/          Entrar, MFA, recuperar/redefinir senha, convite, seleção de clínica
    (app)/           Visão geral, Agenda, Pacientes, Orçamentos e tratamentos, Financeiro,
                     Relatórios, Cadastros, Configurações
    api/             Arquivos (link assinado), PDFs, exportação CSV
  components/        UI por módulo (agenda, budgets, finance, patients, admin, ui)
scripts/             Banco local, migração, seed sintético, criação de clínica, backup/restauração
tests/               unit/, integration/ (Postgres real), e2e/ (Playwright)
drizzle/             Migrações versionadas
```

## Fluxo de uma operação

1. A página ou action chama `getRequestContext()` (`src/server/session.ts`), que lê o cookie, valida a sessão no banco (inatividade 12 h, absoluta 7 dias), exige MFA quando ativado, confirma a participação do usuário na clínica ativa e carrega as permissões do papel.
2. O serviço recebe `Ctx` e chama `assertCan` antes de qualquer leitura ou escrita. O `orgId` vem da sessão, nunca do navegador.
3. Entradas passam por `parseInput(schema, input)` (Zod). IDs recebidos são sempre combinados com `organization_id` nas consultas.
4. Operações compostas rodam em uma transação; as críticas usam chave de idempotência e/ou bloqueio consultivo.
5. Alterações relevantes geram auditoria na mesma transação.
6. A action devolve `ActionResult` (`ok`, ou `code` + mensagem + erros de campo), e a interface mantém o formulário preenchido em caso de falha.

## Multi-clínica (tenant)

- Toda tabela de negócio tem `organization_id`. Chaves estrangeiras são **compostas** `(organization_id, id)`, então o banco recusa vínculo entre clínicas mesmo que um serviço erre (teste dedicado em `tests/integration/tenancy-auth.test.ts`).
- Usuário participa de várias clínicas via `memberships`, com papel por clínica e seleção explícita da clínica ativa.
- Arquivos: chave de armazenamento prefixada pela clínica, download só por link assinado + sessão + participação + permissão.
- Não existe superusuário de plataforma com acesso clínico. Suporte excepcional não foi implementado (ver LIMITACOES).

## Consistência e concorrência

- Dinheiro em centavos inteiros (`bigint`), nunca ponto flutuante.
- Datas civis (`date`) para vencimentos e competências; instantes (`timestamptz`) para auditoria e consultas, convertidos pelo fuso da clínica.
- Agenda: `EXCLUDE USING gist` impede sobreposição de consultas ocupantes do mesmo profissional, além de bloqueio consultivo por profissional/dia e checagem no serviço.
- Títulos: restrições `CHECK` garantem saldo ≥ 0 e valor conciliado ≤ valor; duas baixas ou conciliações simultâneas acima do saldo falham no banco.
- Importação OFX: bloqueio consultivo por conta + índice único da impressão digital.
- Orçamento/acordo: coluna `version` para controle otimista.
- Aprovação: uma transação cria aprovação, itens de tratamento e títulos, com chave de idempotência.
- Registro clínico finalizado: gatilho impede alteração; correções entram como adendo.
- Auditoria: gatilho impede `UPDATE`/`DELETE`.

## Decisões propostas (ajustáveis)

| Tema | Decisão adotada | Onde ajustar |
|---|---|---|
| Composição visual | Dashboard Gestalt: indicadores no topo, análise no meio, tabelas na base | `src/app/(app)` |
| Cor de destaque | Sálvia cirúrgico `#0f766e`, configurável por clínica com contraste mínimo 4,5:1 | Configurações → Clínica |
| Papéis | Proprietário, Dentista, Recepção, Financeiro, Contador; permissões editáveis | Configurações → Usuários |
| Expediente | Segunda a sexta, 08h–18h, grade de 15 min | Configurações → Clínica |
| Arredondamento | Centavos restantes nas primeiras parcelas | `src/domain/money.ts` |
| Rateio de desconto | Maiores restos, determinístico | `src/domain/money.ts` |
| Vencimento mensal | Preserva o dia-base; meses curtos usam o último dia | `src/domain/dates.ts` |
| Cartão | Pagamento quita o título; recebíveis da operadora movimentam o banco só na liquidação | `src/server/services/titles.ts` |
| Demonstrativo | Análise por **caixa**, rotulada como tal; sem DRE por competência | `src/server/services/reports.ts` |
| Evolução do tratamento | Concluídos ÷ ativos aprovados, sem ponderar por preço | `src/server/services/treatments.ts` |
| Upload | JPEG, PNG, WEBP e PDF; limite padrão 20 MB por clínica | Configurações → Clínica |

## Premissas registradas

- O nome comercial não foi definido; é uma variável de ambiente.
- A clínica piloto entra por dados (`clinic:create`), nunca por código.
- Prints de referência não foram usados como fonte de dados de pacientes.
- Integrações externas existem apenas como contratos e estado “Não configurada”, exceto e-mail via Resend quando há chave no ambiente.
