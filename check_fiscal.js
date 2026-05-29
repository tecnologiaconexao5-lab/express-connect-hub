import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  let allGood = true;
  const checkTable = async (tableName) => {
    console.log(`Checking ${tableName}...`);
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
      console.log(`❌ Error on ${tableName}:`, error.message);
      allGood = false;
    } else {
      console.log(`✅ ${tableName} exists.`);
    }
  };

  await checkTable('fiscal_ctes');
  await checkTable('fiscal_mdfes');
  await checkTable('fiscal_nfse');
  await checkTable('fiscal_events');
  await checkTable('fiscal_logs');

  if (allGood) console.log("ALL TABLES VERIFIED OK.");
  else console.log("SOME TABLES FAILED.");
}

check();
