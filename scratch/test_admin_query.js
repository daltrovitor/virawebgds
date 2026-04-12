require('@next/env').loadEnvConfig(process.cwd());
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminSupa = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    const { data: profileAdmins, error: err1 } = await adminSupa
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'staff']);
      
    console.log('profileAdmins:', profileAdmins, 'Error:', err1);

    const { data: legacyAdmins, error: err2 } = await adminSupa
      .from('users')
      .select('id')
      .in('role', ['admin', 'staff']);
      
    console.log('legacyAdmins:', legacyAdmins, 'Error:', err2);
    
    const adminIds = new Set([
      ...(profileAdmins?.map(a => a.id) || []),
      ...(legacyAdmins?.map(a => a.id) || [])
    ]);
    
    console.log('adminIds:', Array.from(adminIds));
  } catch (e) {
    console.error('Exception:', e);
  }
}

test();
