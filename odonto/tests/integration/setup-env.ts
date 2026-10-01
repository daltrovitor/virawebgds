// Ambiente isolado de teste: nunca envia mensagens, cobranças ou e-mails reais.
process.env.APP_ENV = "test";
process.env.APP_SECRET = "test-secret-only-for-automated-tests-0123456789";
delete process.env.RESEND_API_KEY;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
