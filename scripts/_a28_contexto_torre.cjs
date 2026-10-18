const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const ALOC = '2333f16e-6f4f-4169-8766-a02282ec8527';

(async () => {
  await client.connect();

  console.log('=== DADOS CONTEXTUAIS DA CONVERSA NA TORRE (equivalente a listarConversasTorre) ===');
  const aloc = await client.query(`
    SELECT a.id, a.ordem_servico_id, a.prestador_id, a.origem, a.destino, a.status,
           a.tipo_veiculo, a.placa, a.valor_repasse
    FROM alocacoes_escala a WHERE a.id=$1`, [ALOC]);
  const a = aloc.rows[0];

  const os = await client.query(`SELECT id, numero FROM ordens_servico WHERE id=$1`, [a.ordem_servico_id]);
  const prest = await client.query(`SELECT id, nome_completo FROM prestadores WHERE id=$1`, [a.prestador_id]);
  const veic = await client.query(`SELECT placa, tipo_veiculo FROM veiculos WHERE prestador_vinculado=$1 LIMIT 1`, [a.prestador_id]);

  const ultima = await client.query(`
    SELECT mensagem, sender_type, created_at FROM operacao_mensagens
    WHERE alocacao_id=$1 ORDER BY created_at DESC LIMIT 1`, [ALOC]);

  console.log('  Prestador:   ', prest.rows[0]?.nome_completo);
  console.log('  OS:          ', os.rows[0]?.numero);
  console.log('  Status op.:  ', a.status);
  console.log('  Origem:      ', a.origem);
  console.log('  Destino:     ', a.destino);
  console.log('  Veículo:     ', veic.rows[0]?.placa, veic.rows[0]?.tipo_veiculo);
  console.log('  Últ. mensagem:', ultima.rows[0]?.sender_type, '|', ultima.rows[0]?.mensagem);
  console.log('  Horário:     ', new Date(ultima.rows[0]?.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });