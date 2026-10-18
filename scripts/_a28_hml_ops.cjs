const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();

  // Prestador TESTE APP (e6646799) — alocações HML seguras reutilizáveis
  const alocs = await client.query(`
    SELECT a.id, a.ordem_servico_id, a.status, a.origem, a.destino,
           a.data_escala, a.valor_repasse, a.operation_mode,
           os.numero AS os_numero
    FROM alocacoes_escala a
    LEFT JOIN ordens_servico os ON os.id = a.ordem_servico_id
    WHERE a.prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
      AND a.status NOT IN ('cancelada', 'recusada')
    ORDER BY a.data_escala DESC
    LIMIT 20`);
  console.log('=== Alocações do PRESTADOR TESTE APP (ativas) ===');
  alocs.rows.forEach(r => console.log(`  ${r.id} | ${r.os_numero} | ${r.status} | ${r.origem} -> ${r.destino} | ${r.data_escala} | repasse=${r.valor_repasse} | mode=${r.operation_mode}`));

  console.log('\n=== Últimas mensagens do chat (contexto) ===');
  const msgs = await client.query(`
    SELECT alocacao_id, sender_type, status, created_at, left(mensagem,40) AS msg
    FROM operacao_mensagens
    ORDER BY created_at DESC LIMIT 8`);
  msgs.rows.forEach(r => console.log(`  ${r.alocacao_id} | ${r.sender_type} | ${r.status} | ${r.created_at} | ${r.msg}`));

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });