'use strict';
// =============================================================================
// TMS-FIN-DATA-04D3A — Port Node do antigo seed-relatorios.js (console do navegador).
// Cria massa minima de teste para validar Relatorios. GUARD fail-closed:
//   - PROD SEMPRE bloqueado; QA exige destino QA + ALLOW_TEST_WRITES=true.
//   - Sem hardcode de PROD/anon; usa VITE_* do ambiente (QA preferencial).
// Uso: npx node scripts/lab/seed-relatorios.cjs
// =============================================================================
const { guardHarness } = require('../_guard.cjs');

// Executa ANTES de qualquer conexao/escrita.
guardHarness('scripts/lab/seed-relatorios.cjs');

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[SEED] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sao necessarios (ambiente QA).');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

(async () => {
  console.log('[SEED] Iniciando criacao de massa de teste (QA)...');

  // 1. Cliente "DVL DISTRIBUIDORA"
  let { data: clienteExistente } = await sb
    .from('clientes').select('id, nome_fantasia')
    .or('nome_fantasia.ilike.%DVL%,razao_social.ilike.%DVL%').limit(1);

  let clienteId;
  if (clienteExistente && clienteExistente.length > 0) {
    clienteId = clienteExistente[0].id;
    console.log('[SEED] Cliente DVL ja existe:', clienteId, clienteExistente[0].nome_fantasia);
  } else {
    const { data: novoCliente, error: errCli } = await sb.from('clientes').insert({
      razao_social: 'DVL DISTRIBUIDORA LTDA',
      nome_fantasia: 'DVL DISTRIBUIDORA',
      cnpj: '12.345.678/0001-90',
      status: 'Ativo',
      cidade: 'Sao Paulo',
      uf: 'SP',
      telefone: '(11) 4000-1234',
      email: 'financeiro@dvl.com.br',
    }).select('id').single();
    if (errCli) { console.error('[SEED] Erro ao criar cliente:', errCli); return; }
    clienteId = novoCliente.id;
    console.log('[SEED] Cliente DVL criado:', clienteId);
  }

  // 2. Prestador "FRANKLIN DA SILVA PEREIRA"
  let { data: prestadorExistente } = await sb
    .from('prestadores').select('id, nome_completo')
    .or('nome_completo.ilike.%FRANKLIN%,cpf_cnpj.eq.000.000.000-00').limit(1);

  let prestadorId, prestadorNome;
  if (prestadorExistente && prestadorExistente.length > 0) {
    prestadorId = prestadorExistente[0].id;
    prestadorNome = prestadorExistente[0].nome_completo;
    console.log('[SEED] Prestador ja existe:', prestadorId, prestadorNome);
  } else {
    const { data: novoPrestador, error: errPrest } = await sb.from('prestadores').insert({
      nome_completo: 'FRANKLIN DA SILVA PEREIRA',
      nome_fantasia: 'TRANSPORTES FRANKLIN',
      cpf_cnpj: '000.000.000-00',
      tipo_parceiro: 'autonomo',
      status: 'ativo',
      telefone: '(11) 98765-4321',
      score_interno: 4.5,
      cidade: 'Sao Paulo',
      uf: 'SP',
    }).select('id, nome_completo').single();
    if (errPrest) { console.error('[SEED] Erro ao criar prestador:', errPrest); return; }
    prestadorId = novoPrestador.id;
    prestadorNome = novoPrestador.nome_completo;
    console.log('[SEED] Prestador criado:', prestadorId, prestadorNome);
  }

  // 3. OS de teste
  const hoje = new Date().toISOString().split('T')[0];
  const numeroOS = `OS-TEST-${Date.now().toString(36).toUpperCase()}`;
  const { data: novaOS, error: errOS } = await sb.from('ordens_servico').insert({
    numero: numeroOS,
    data: hoje,
    cliente: 'DVL DISTRIBUIDORA',
    prestador: prestadorNome,
    status: 'finalizada',
    tipo_operacao: 'Transferencia',
    valor_cliente: 600.00,
    custo_prestador: 450.00,
    pedagio: 0,
    adicionais: 0,
    descontos: 0,
    veiculo_tipo: 'VUC',
    veiculo_placa: 'TST-1234',
    km_total: 150,
    enderecos: JSON.stringify([
      { tipo: 'coleta', cidade: 'Sao Paulo', estado: 'SP', endereco: 'Av. Paulista, 1000', nomeLocal: 'DVL CD Sao Paulo' },
      { tipo: 'entrega', cidade: 'Guarulhos', estado: 'SP', endereco: 'Rua Teste, 500', nomeLocal: 'Filial Guarulhos' },
    ]),
    created_at: new Date().toISOString(),
  }).select('id, numero').single();
  if (errOS) { console.error('[SEED] Erro ao criar OS:', errOS); return; }
  const osId = novaOS.id;
  console.log('[SEED] OS criada:', osId, novaOS.numero);

  // 4. financeiro_receber
  const { error: errFin } = await sb.from('financeiro_receber').insert({
    os_id: osId, cliente: 'DVL DISTRIBUIDORA', descricao: `Faturamento ${novaOS.numero}`,
    valor: 600.00, vencimento: hoje, data_emissao: hoje, status: 'aberto',
  });
  if (errFin) console.warn('[SEED] Aviso financeiro_receber:', errFin);
  else console.log('[SEED] financeiro_receber criado para OS', novaOS.numero);

  // 5. pagamentos_prestadores
  const { error: errPag } = await sb.from('pagamentos_prestadores').insert({
    prestador_id: prestadorId, prestador_nome: prestadorNome,
    periodo_inicio: hoje, periodo_fim: hoje, quantidade_os: 1,
    valor_servicos: 450.00, valor_liquido: 450.00, status: 'pendente',
  });
  if (errPag) console.warn('[SEED] Aviso pagamentos_prestadores:', errPag);
  else console.log('[SEED] pagamentos_prestadores criado');

  console.log('\n[SEED] MASSA DE TESTE CRIADA (QA).');
  console.log('[SEED] Cliente:', clienteId, '| Prestador:', prestadorNome, '| OS:', novaOS.numero);
})();
