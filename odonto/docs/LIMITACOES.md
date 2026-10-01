# Limitações, decisões propostas e itens não contratados

Versão resumida; detalhar na próxima etapa (ver [PROGRESSO.md](PROGRESSO.md)).

## Limitações conhecidas

- **Não está pronto para produção**: validado apenas localmente, com dados sintéticos. Não há alegação de conformidade legal (LGPD, prontuário); a revisão jurídica cabe a responsáveis adequados.
- **Integrações**: nenhuma está ativa. E-mail via Resend existe no código, mas não foi testado com envio real. Open Finance, cobrança, WhatsApp/SMS, fiscal, assinatura e ERP são apenas contratos.
- **Demonstrativos**: só análise por caixa. Não há DRE por competência.
- **Supabase Storage**: adaptador implementado, mas não testado sem credenciais reais.
- **Backup**: lógico (JSONL); não substitui o backup/PITR do provedor. A restauração usa `session_replication_role = replica`, o que exige privilégio de superusuário ou equivalente no banco de destino.
- **Lighthouse**: ainda não auditado.
- **Ambiente de desenvolvimento Windows**: Next com `--webpack` + SWC WASM e Vitest 3, por bloqueio de binários nativos (Smart App Control).
- Pendências funcionais listadas como “Pendente” na [matriz](MATRIZ-DE-REQUISITOS.md).

## Decisões propostas

Ver a tabela em [ARQUITETURA.md](ARQUITETURA.md#decisões-propostas-ajustáveis).

## Não contratado / fora do escopo do piloto

Emissão fiscal, assinatura eletrônica, cobrança bancária integrada, Open Finance em produção, estoque e compras, laboratório/prótese, prescrição digital, DICOM/3D, cobrança das assinaturas do SaaS e planos comerciais.
