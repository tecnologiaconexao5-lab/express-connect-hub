const {Client}=require('pg');
const c=new Client({connectionString:'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'});
async function main(){
  await c.connect();
  const r1=await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='financeiro_pagar' ORDER BY ordinal_position");
  console.log('=== FINANCEIRO_PAGAR ===');
  r1.rows.forEach(x=>console.log(x.column_name));
  const r2=await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='financeiro_baixas' ORDER BY ordinal_position");
  console.log('=== FINANCEIRO_BAIXAS ===');
  r2.rows.forEach(x=>console.log(x.column_name));
  await c.end();
}
main();
