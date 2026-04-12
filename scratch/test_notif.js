require('@next/env').loadEnvConfig(process.cwd());
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('notifications').select('*').order('created_at', { ascending: false }).limit(2).then(res => console.dir(res.data, {depth: null}));
