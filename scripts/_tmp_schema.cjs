const {Client}=require('pg');
const c=new Client({connectionString:'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'});
c.connect().then(()=>c.query("SELECT column_name FROM information_schema.columns WHERE table_name='ordens_servico' ORDER BY ordinal_position")).then(r=>{r.rows.forEach(x=>console.log(x.column_name));c.end()});
