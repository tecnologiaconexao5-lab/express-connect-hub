
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' }); // Load .env.local for VITE_ prefixed variables

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkBucket() {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('Error listing buckets:', error);
      return;
    }
    const bucketExists = data.some(bucket => bucket.name === 'relatorios');
    console.log(`Bucket 'relatorios' exists: ${bucketExists}`);
  } catch (e) {
    console.error('An unexpected error occurred:', e);
  }
}

checkBucket();
