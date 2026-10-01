# Backup e restauração

Versão resumida.

## Backup

```bash
npm run db:backup -- --out backups/2026-10-01
```

- Exporta cada tabela em JSONL dentro de uma transação `repeatable read` (instantâneo consistente) e grava `manifest.json` com contagens e SHA-256.
- Com `STORAGE_DRIVER=local`, copia também os arquivos privados. Com Supabase Storage, os arquivos ficam fora deste backup: use o backup do provedor.
- A pasta `backups/` é ignorada pelo git e contém dados sensíveis: guarde com criptografia e acesso restrito.

## Restauração (sempre primeiro em um banco de teste)

```bash
npm run db:restore -- --from backups/2026-10-01 --target postgres://usuario:senha@host:5432/banco_vazio
```

- Recusa banco de destino não vazio e recusa o `DATABASE_URL` principal (salvo `--i-know-this-is-the-main-database`).
- Aplica as migrações, carrega os dados com gatilhos suspensos (`session_replication_role = replica`, exige privilégio elevado), reajusta sequências e confere contagens e hashes.
- `--storage-dir <pasta>` restaura os arquivos locais.

## Teste

`tests/integration/backup.test.ts` (cenário 27) faz backup, restaura em outro banco e confere vínculos principais e arquivos.

## Produção

Ativar backup automático/PITR do provedor do banco e do storage, e executar periodicamente um teste de restauração em ambiente separado.
