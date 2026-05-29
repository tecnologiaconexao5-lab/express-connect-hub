import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

const envPath = path.resolve(process.cwd(), '.env')
const envConfig = dotenv.parse(fs.readFileSync(envPath))

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase
    .from('prestadores')
    .select('*')
    .limit(1)
    
  console.log('Error:', error)
  if (data && data.length > 0) {
     console.log('Columns:', Object.keys(data[0]))
  }
}

test()
