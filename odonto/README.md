# Gestão Odonto — gestão odontológica e financeira multi-clínica

Sistema em nuvem para clínicas odontológicas: pacientes, orçamento dentro da ficha com odontograma, negociação e plano de pagamento, tratamentos, agenda em grade de 15 minutos, histórico clínico, galeria privada, financeiro (contas a pagar/receber, cartões, fluxo de caixa), importação OFX com conciliação assistida e relatórios.

- Clínica piloto prevista: configurada **apenas por dados** (`npm run clinic:create`); nenhum nome real está no código.
- Nome comercial ainda não definido: ajuste `NEXT_PUBLIC_PRODUCT_NAME`.
- Situação: **demonstração funcional das fases 1 a 4**, validada com dados sintéticos. Não é declarado pronto para produção — veja [docs/LIMITACOES.md](docs/LIMITACOES.md) e [docs/PROGRESSO.md](docs/PROGRESSO.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Stack, organização do código, decisões e premissas |
| [docs/MODELO-DE-DADOS.md](docs/MODELO-DE-DADOS.md) | Diagrama de dados e restrições de integridade |
| [docs/REGRAS-FINANCEIRAS-E-CLINICAS.md](docs/REGRAS-FINANCEIRAS-E-CLINICAS.md) | Fórmulas, arredondamentos, estados e regras de negócio |
| [docs/MATRIZ-DE-REQUISITOS.md](docs/MATRIZ-DE-REQUISITOS.md) | Requisito → módulo → teste → fase, com estado |
| [docs/API.md](docs/API.md) | Serviços, server actions, rotas HTTP e permissões |
| [docs/BACKUP-E-RESTAURACAO.md](docs/BACKUP-E-RESTAURACAO.md) | Procedimento de backup e restauração testado |
| [docs/VALIDACAO-INTERFACE.md](docs/VALIDACAO-INTERFACE.md) | Registro da validação no navegador |
| [docs/LIMITACOES.md](docs/LIMITACOES.md) | Limitações, decisões propostas e itens não contratados |
| [docs/PROGRESSO.md](docs/PROGRESSO.md) | Estado atual e próximos passos para retomada |

## Requisitos

- Node.js 20.9 ou superior (testado com Node 24) e npm 10+.
- PostgreSQL 15+ com as extensões `btree_gist` (restrição de sobreposição da agenda). Em desenvolvimento não é preciso instalar nada: `npm run db:local` sobe um Postgres real embutido (binários oficiais via `embedded-postgres`).

## Instalação

```bash
cd odonto
npm install
```

Com npm 11, scripts de instalação ficam bloqueados até aprovação. O `package.json` já lista os pacotes permitidos em `allowScripts`; se o npm pedir, aprove-os:

```bash
npm install-scripts approve
```

Crie o arquivo de ambiente a partir do exemplo e gere um segredo próprio:

```bash
cp .env.example .env.local
```

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Cole o valor em `APP_SECRET` (mínimo 32 caracteres). `.env.local` nunca é versionado.

## Execução local

Em um terminal, mantenha o banco local aberto:

```bash
npm run db:local
```

Em outro terminal, aplique as migrações, carregue os dados sintéticos e inicie:

```bash
npm run db:migrate
```

```bash
npm run db:seed-demo
```

```bash
npm run dev
```

Acesse http://localhost:3100. O seed cria a “Clínica Demonstração” com usuários de teste `admin`, `dentista`, `recepcao`, `financeiro` e `contador`, todos no domínio reservado `@demo.odonto.test`, com a senha definida em `DEMO_PASSWORD`. São dados fictícios; o seed recusa rodar com `APP_ENV=production`.

### Observação para Windows

Nesta máquina de desenvolvimento, o Smart App Control do Windows bloqueia binários nativos novos (`.node`) do compilador SWC do Next 16 e do rolldown. Por isso:

- `dev` e `build` usam `--webpack` com o SWC em WebAssembly (`@next/swc-wasm-nodejs`, já em `devDependencies`);
- os testes usam Vitest 3.

Em Linux/macOS/CI isso funciona igual, apenas um pouco mais lento que o Turbopack.

## Criar a clínica piloto (dados reais)

Em um banco de produção já migrado:

```bash
npm run clinic:create -- --name "Nome da Clínica" --slug nome-da-clinica --owner-email admin@clinica.com.br --owner-name "Nome do Responsável" --owner-password "senha-forte-com-10+"
```

O comando cria a organização com papéis padrão, tabela “Particular”, especialidades e categorias iniciais editáveis, conta “Caixa”, modelos de documento e integrações em estado “Não configurada”. Identidade visual, expediente, contatos e fuso são ajustados depois em **Configurações → Clínica**.

## Testes

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

- `npm run test:unit` — regras de domínio puras (dinheiro, datas, odontograma, plano de pagamento, OFX, conciliação, CSV).
- `npm run test:integration` — sobe um Postgres real temporário, aplica as migrações e cobre os 27 cenários de aceitação (isolamento entre clínicas, permissões, orçamento, aprovação idempotente, recebimentos/estornos, revisão, agenda e concorrência, arquivos privados, OFX, conciliação concorrente, cartões, fluxo de caixa, integrações, backup/restauração). Para usar um servidor existente (CI), defina `TEST_PG_BASE_URL=postgres://user:senha@host:porta`.
- `npm run test:e2e` — jornada completa no navegador (Playwright com o Chrome instalado). Requer `npm run db:local`, migrações, seed e `npm run dev` ativos.

Último resultado registrado em [docs/VALIDACAO-INTERFACE.md](docs/VALIDACAO-INTERFACE.md).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | URL do PostgreSQL |
| `DATABASE_POOL_MAX` | não | Conexões por instância (padrão 10) |
| `DATABASE_PREPARE` | não | `false` com poolers em modo transação (Supabase porta 6543) |
| `APP_URL` | sim | URL pública (links de convite/redefinição) |
| `APP_ENV` | sim | `development`, `demo` ou `production`; `demo` bloqueia envios reais |
| `APP_SECRET` | sim | ≥ 32 caracteres; assina links temporários e cifra segredos de MFA |
| `NEXT_PUBLIC_PRODUCT_NAME` | não | Nome exibido do produto |
| `STORAGE_DRIVER` | sim | `local` (desenvolvimento) ou `supabase` (produção) |
| `STORAGE_LOCAL_DIR` | não | Pasta dos arquivos privados no modo local |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | com `supabase` | Bucket **privado**; a chave fica só no servidor |
| `RESEND_API_KEY`, `EMAIL_FROM` | não | E-mail transacional; sem eles, convites e redefinições usam link gerado pelo administrador |
| `DEMO_PASSWORD` | só demo | Senha dos usuários sintéticos |

Modelo sem segredos: [.env.example](.env.example).

## Backup e restauração

```bash
npm run db:backup -- --out backups/2026-10-01
```

```bash
npm run db:restore -- --from backups/2026-10-01 --target postgres://usuario:senha@host:5432/banco_vazio
```

O backup é lógico (JSONL por tabela + manifesto com contagens e SHA-256, em instantâneo consistente) e inclui os arquivos privados no modo local. A restauração só aceita banco vazio, aplica as migrações, carrega os dados e confere contagens e hashes. Procedimento completo e responsabilidades em produção: [docs/BACKUP-E-RESTAURACAO.md](docs/BACKUP-E-RESTAURACAO.md).

## Implantação (proposta)

Sugestão testada apenas localmente até aqui:

1. **Banco**: PostgreSQL gerenciado (ex.: Supabase, Neon, RDS) com `btree_gist` disponível. Use a conexão direta para migrações e, se usar pooler em modo transação, `DATABASE_PREPARE=false`.
2. **Arquivos**: bucket privado no Supabase Storage (`STORAGE_DRIVER=supabase`). Em plataformas serverless o armazenamento local é recusado, porque o disco é efêmero.
3. **Aplicação**: Vercel (projeto com diretório raiz `odonto`) ou qualquer host Node 20+ com `npm run build` e `npm start`. Defina todas as variáveis da tabela acima no painel do provedor.
4. **Migrações**: `npm run db:migrate` com `DATABASE_URL` de produção, antes de publicar a versão.
5. **Clínica**: `npm run clinic:create` com os dados reais do responsável.
6. **Antes de usar com pacientes reais**: revisar proteção de dados/prontuário com responsáveis adequados, ativar MFA para administradores e financeiro, configurar backup do provedor e executar um teste de restauração. Veja [docs/LIMITACOES.md](docs/LIMITACOES.md).

## Scripts

| Script | Função |
|---|---|
| `dev` / `build` / `start` | Aplicação Next.js na porta 3100 |
| `typecheck`, `lint`, `test`, `test:unit`, `test:integration`, `test:e2e` | Verificações |
| `db:local` | Postgres local embutido (mantém o processo aberto) |
| `db:generate` | Gera migração a partir do schema (drizzle-kit) |
| `db:migrate` | Aplica migrações versionadas de `drizzle/` |
| `db:seed-demo` | Dados sintéticos de demonstração |
| `db:backup`, `db:restore` | Backup lógico e restauração verificada |
| `clinic:create` | Cria uma clínica real e seu administrador |
