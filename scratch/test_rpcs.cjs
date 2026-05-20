const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const rpcs = [
    { name: 'exec_sql', args: { sql: "SELECT 1" } },
    { name: 'exec_sql', args: { query: "SELECT 1" } },
    { name: 'exec_sql', args: { statement: "SELECT 1" } },
    { name: 'execute_sql', args: { sql: "SELECT 1" } },
    { name: 'create_table_tabelas_valores', args: { sql: "SELECT 1" } },
    { name: 'create_table_tabelas_valores', args: {} }
  ];

  for (const rpc of rpcs) {
    try {
      const { data, error } = await supabase.rpc(rpc.name, rpc.args);
      console.log(`RPC ${rpc.name} with ${JSON.stringify(rpc.args)}:`, error ? `FALHA (${error.message})` : `SUCESSO (${JSON.stringify(data)})`);
    } catch (e) {
      console.log(`RPC ${rpc.name} catch:`, e.message);
    }
  }
}

test();
