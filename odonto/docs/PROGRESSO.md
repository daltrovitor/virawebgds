# Progresso e retomada

Situação em 01/10/2026.

## Feito

- Fases 1 a 4 implementadas como demonstração funcional com dados sintéticos (ver [MATRIZ-DE-REQUISITOS.md](MATRIZ-DE-REQUISITOS.md)).
- Fase 5: apenas contratos de integração e estado “Não configurada”.
- Verificação mais recente: `tsc --noEmit` sem erros; `eslint .` sem erros; Vitest 9 arquivos / 62 testes passando (unidade + integração com Postgres real, cobrindo os 27 cenários); `next build --webpack` concluído; jornada Playwright aprovada.
- Docs: README, ARQUITETURA, MODELO-DE-DADOS, REGRAS-FINANCEIRAS-E-CLINICAS, MATRIZ-DE-REQUISITOS, API, LIMITACOES, BACKUP-E-RESTAURACAO, VALIDACAO-INTERFACE (estes três em versão resumida).

## Próximos passos

1. Expandir LIMITACOES, BACKUP-E-RESTAURACAO e VALIDACAO-INTERFACE (estão resumidos).
2. Itens pendentes da matriz: expediente por profissional na checagem da agenda, filtro por período na galeria, anexos em contas a pagar, relatórios por centro de custo e por profissional, MFA obrigatório por papel, visão Mês da agenda, suporte excepcional auditado.
3. Auditoria Lighthouse em build de produção (ainda não executada).
4. Antes de usar com pacientes reais: banco e storage de produção (Supabase), backup do provedor + teste de restauração, revisão jurídica de proteção de dados/prontuário, criação da clínica piloto com `npm run clinic:create`.
5. Integrações (Open Finance, cobrança, WhatsApp/SMS, fiscal, assinatura): escolher fornecedor, validar cobertura e credenciais, e só então ativar.
