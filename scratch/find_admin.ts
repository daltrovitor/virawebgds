
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findAdmin() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role')
    .or('role.eq.admin,role.eq.staff')
    
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Admins found:', data)
}

findAdmin()
