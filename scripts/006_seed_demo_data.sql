-- Seed some demo data for testing (optional - only run if you want sample data)

-- This script is safe to run multiple times as it uses INSERT ... ON CONFLICT DO NOTHING

-- Note: Replace 'YOUR_USER_ID' with an actual user ID from auth.users
-- You can get this by running: SELECT id FROM auth.users LIMIT 1;


-- Example: Insert a demo professional (uncomment and replace USER_ID to use)
-- INSERT INTO public.professionals (user_id, name, email, phone, specialty, crm, status)
-- VALUES (
--   'YOUR_USER_ID',
--   'Dr. João Silva',
--   'joao.silva@viraweb.online',
--   '(11) 98765-4321',
--   'Fisioterapia',
--   'CRM-12345',
--   'active'
-- ) ON CONFLICT DO NOTHING;

-- Example: Insert a demo patient (uncomment and replace USER_ID to use)
-- INSERT INTO public.patients (user_id, name, email, phone, cpf, date_of_birth, status)
-- VALUES (
--   'YOUR_USER_ID',
--   'Maria Santos',
--   'maria.santos@viraweb.online',
--   '(11) 91234-5678',
--   '123.456.789-00',
--   '1990-05-15',
--   'active'
-- ) ON CONFLICT DO NOTHING;

-- This file is provided as a template for adding demo data
-- Uncomment and modify the examples above with real user IDs to populate demo data

