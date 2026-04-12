ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_cpf_key;

-- Primeiro, verifique quais constraints existem
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'patients'::regclass;

-- Tente remover a constraint (pode ter nome diferente)
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_cpf_key;
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_cpf_unique;

-- Também verifique se há um índice único
DROP INDEX IF EXISTS patients_cpf_key;
DROP INDEX IF EXISTS patients_cpf_unique;
DROP INDEX IF EXISTS patients_cpf_idx;