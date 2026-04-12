-- Make patients.cpf nullable and normalize empty strings to NULL
-- This migration alters the existing table so the application can treat CPF as optional.
BEGIN;

-- Drop NOT NULL constraint if present
ALTER TABLE IF EXISTS public.patients
  ALTER COLUMN cpf DROP NOT NULL;

-- Normalize existing empty strings to NULL to avoid unique/constraint issues
UPDATE public.patients
SET cpf = NULL
WHERE cpf IS NOT NULL AND trim(cpf) = '';

COMMIT;

-- Notes:
-- Run this migration against the database where `cpf` column is currently NOT NULL.
-- This is safe to run multiple times (idempotent).
