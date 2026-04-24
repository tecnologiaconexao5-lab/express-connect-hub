const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function querySQL() {
  console.log('=== EXECUTANDO SQL VIA RPC ===\n');
  
  try {
    const { data, error } = await supabase.rpc('pg_catalog', { 
      statement: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'" 
    });
    
    console.log('DATA:', data);
    console.log('ERRO:', error?.message);
  } catch(e) {
    console.log('ERRO:', e.message);
  }
}

querySQL();