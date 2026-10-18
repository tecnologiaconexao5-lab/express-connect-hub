const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();

  console.log('=== CONTAGEM NÃO-LIDAS NA TORRE (f_contar_mensagens_nao_lidas_torre) ===');
  const naoLidas = await client.query(`
    SELECT count(*)::int AS n FROM operacao_mensagens
    WHERE sender_type='prestador' AND status='enviada'`);
  console.log(`  Não lidas (prestador → torre, status enviada): ${naoLidas.rows[0].n}`);

  console.log('\n=== RESUMO FINAL — todas as mensagens da operação HML ===');
  const all = await client.query(`
    SELECT sender_type, status, read_at, created_at, left(mensagem,45) AS msg
    FROM operacao_mensagens WHERE alocacao_id='2333f16e-6f4f-4169-8766-a02282ec8527'
    ORDER BY created_at ASC`);
  all.rows.forEach(r => {
    const d = new Date(r.created_at);
    const ra = r.read_at ? ` | read_at=${new Date(r.read_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : '';
    console.log(`  [${d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] ${r.sender_type} | ${r.status}${ra} | ${r.msg}`);
  });

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });