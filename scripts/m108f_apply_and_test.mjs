import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];

function check(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}`);
  results.push({ label, ok, detail });
}

async function exec(label, sql, params) {
  try { await pool.query(sql, params || []); check(label, true, 'ok'); }
  catch (e) {
    const m = e.message;
    if (m.includes('already exists') || m.includes('duplicate key') || m.includes('violates unique constraint'))
      { check(label, true, 'ja existia'); }
    else { check(label, false, m.slice(0, 150)); console.log('     SQL:', sql.slice(0, 120)); }
  }
}

async function main() {
  console.log('═'.repeat(65));
  console.log('M108-F — APLICACAO E TESTE: LOGISTICA REVERSA');
  console.log('═'.repeat(65));

  // SECTION 1: OS columns
  console.log('\n📦 Colunas OS...');
  await exec('tipo_reversa em ordens_servico',
    `ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS tipo_reversa TEXT DEFAULT 'sem_reversa'`);
  await exec('reversa_qtd_volumes em ordens_servico',
    `ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS reversa_qtd_volumes INTEGER DEFAULT 0`);
  await exec('reversa_observacoes em ordens_servico',
    `ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS reversa_observacoes TEXT`);

  // SECTION 2: Alocacao columns
  console.log('\n📦 Colunas alocacoes_escala...');
  const alocCols = [
    ['tipo_reversa', "TEXT DEFAULT 'sem_reversa'"],
    ['reversa_valor_cliente', 'NUMERIC(12,2) DEFAULT 0'],
    ['reversa_valor_prestador', 'NUMERIC(12,2) DEFAULT 0'],
    ['reversa_qtd_volumes', 'INTEGER DEFAULT 0'],
    ['reversa_status', 'TEXT'],
    ['reversa_pod_url', 'TEXT'],
    ['reversa_fotos', "JSONB DEFAULT '[]'::jsonb"],
    ['reversa_observacoes', 'TEXT'],
    ['reversa_realizada_em', 'TIMESTAMPTZ'],
  ];
  for (const [col, type] of alocCols) {
    await exec(`reversa col ${col}`,
      `ALTER TABLE public.alocacoes_escala ADD COLUMN IF NOT EXISTS ${col} ${type}`);
  }

  // SECTION 3: Update trigger M104A
  console.log('\n📦 Atualizando trigger M104A...');
  const triggerSql = `
CREATE OR REPLACE FUNCTION public.f_trg_propagar_financeiro_alocacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_nome TEXT; v_prestador_nome TEXT; v_prestador_doc TEXT;
  v_os_id UUID; v_os_numero TEXT; v_data_venc_30 DATE;
  v_valor_cliente NUMERIC; v_valor_prestador NUMERIC;
  v_pedagio_valor NUMERIC; v_adicional_valor NUMERIC;
  v_ajudante_valor NUMERIC; v_desconto_valor NUMERIC;
  v_outros_custos NUMERIC; v_valor_liquido NUMERIC;
  v_is_concluida BOOLEAN; v_error_msg TEXT;
  v_fallback_cliente TEXT; v_fallback_prestador TEXT;
  v_status_financeiro TEXT;
  v_reversa_cliente NUMERIC; v_reversa_prestador NUMERIC;
BEGIN
  IF NEW.status = 'cancelada' THEN RETURN NEW; END IF;
  BEGIN
    v_valor_cliente := COALESCE(NEW.valor_frete, 0);
    v_valor_prestador := COALESCE(NEW.valor_repasse, 0);
    v_pedagio_valor := COALESCE(NEW.valor_pedagio, 0);
    v_adicional_valor := COALESCE(NEW.valor_adicional, 0);
    v_ajudante_valor := COALESCE(NEW.valor_ajudante, 0);
    v_desconto_valor := COALESCE(NEW.valor_desconto, 0);
    v_reversa_cliente := COALESCE(NEW.reversa_valor_cliente, 0);
    v_reversa_prestador := COALESCE(NEW.reversa_valor_prestador, 0);
    IF v_valor_cliente = 0 AND v_valor_prestador = 0 AND v_reversa_cliente = 0 AND v_reversa_prestador = 0 THEN RETURN NEW; END IF;
    v_valor_cliente := v_valor_cliente + v_reversa_cliente;
    v_valor_prestador := v_valor_prestador + v_reversa_prestador;
    v_fallback_cliente := COALESCE(NEW.cliente_id::TEXT, 'cliente_nao_informado');
    v_fallback_prestador := COALESCE(NEW.prestador_id::TEXT, 'prestador_nao_informado');
    BEGIN
      SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Cliente #' || v_fallback_cliente) INTO STRICT v_cliente_nome FROM clientes c WHERE c.id = NEW.cliente_id;
    EXCEPTION WHEN OTHERS THEN v_cliente_nome := 'Cliente #' || v_fallback_cliente; END;
    BEGIN
      SELECT COALESCE(p.nome_completo, 'Prestador #' || v_fallback_prestador), COALESCE(p.cpf_cnpj, '') INTO STRICT v_prestador_nome, v_prestador_doc FROM prestadores p WHERE p.id = NEW.prestador_id;
    EXCEPTION WHEN OTHERS THEN v_prestador_nome := 'Prestador #' || v_fallback_prestador; v_prestador_doc := ''; END;
    v_data_venc_30 := CURRENT_DATE + 30;
    v_is_concluida := (NEW.status = 'concluida' AND NEW.finalizada = true);
    v_status_financeiro := CASE WHEN v_is_concluida THEN 'aberto' ELSE 'pendente' END;
    IF NEW.ordem_servico_id IS NOT NULL THEN
      v_os_id := NEW.ordem_servico_id;
      v_os_numero := 'OS-ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    ELSE
      v_os_id := NEW.id;
      v_os_numero := 'ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    END IF;
    v_outros_custos := v_adicional_valor + v_ajudante_valor - v_desconto_valor;
    v_valor_liquido := v_valor_prestador + v_pedagio_valor + v_outros_custos;
    -- OS
    BEGIN
      INSERT INTO ordens_servico (id, numero, cliente, cliente_id, prestador, prestador_id, status, data, tipo_veiculo, origem, destino, valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos, tipo_reversa, reversa_qtd_volumes, observacoes_gerais, created_at, updated_at)
      VALUES (v_os_id, v_os_numero, NEW.cliente_id, v_cliente_nome, NEW.prestador_id, v_prestador_nome, CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END, COALESCE(NEW.data_escala, CURRENT_DATE), NEW.tipo_veiculo, NEW.origem, NEW.destino, v_valor_cliente, v_valor_prestador, v_pedagio_valor, v_adicional_valor, v_ajudante_valor, v_desconto_valor, NEW.tipo_reversa, NEW.reversa_qtd_volumes, NEW.observacoes, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END, valor_cliente = v_valor_cliente, custo_prestador = v_valor_prestador, tipo_reversa = COALESCE(NEW.tipo_reversa, ordens_servico.tipo_reversa), updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN NULL; END;
    -- Receber
    IF v_valor_cliente > 0 AND NEW.cliente_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_receber (os_id, descricao, valor, data_vencimento, status, cliente, cliente_nome, cliente_id)
        VALUES (v_os_id::TEXT, 'Faturamento ' || v_os_numero || CASE WHEN v_reversa_cliente > 0 THEN ' (c/ reversa)' ELSE '' END, v_valor_cliente, v_data_venc_30, v_status_financeiro, v_cliente_nome, v_cliente_nome, NEW.cliente_id)
        ON CONFLICT (os_id) DO UPDATE SET valor = v_valor_cliente, status = CASE WHEN v_is_concluida THEN 'aberto' WHEN financeiro_receber.status = 'aberto' THEN 'aberto' ELSE 'pendente' END, data_vencimento = v_data_venc_30;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    -- Pagar
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_pagar (os_id, descricao, valor, data_vencimento, status, prestador, fornecedor_id, fornecedor_nome)
        VALUES (v_os_id::TEXT, 'Repasse ' || v_os_numero || CASE WHEN v_reversa_prestador > 0 THEN ' (c/ reversa)' ELSE '' END, v_valor_prestador, v_data_venc_30, v_status_financeiro, v_prestador_nome, NEW.prestador_id, v_prestador_nome)
        ON CONFLICT (os_id) DO UPDATE SET valor = v_valor_prestador, status = CASE WHEN v_is_concluida THEN 'aberto' WHEN financeiro_pagar.status = 'aberto' THEN 'aberto' ELSE 'pendente' END, data_vencimento = v_data_venc_30;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    -- Pagamentos prestadores
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO pagamentos_prestadores (prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, valor_servicos, pedagio, adicionais, status_conferencia, status_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, categoria_financeira, data_prevista_pagamento, competencia, impacto_dre, impacto_fluxo_caixa)
        VALUES (NEW.prestador_id, v_prestador_nome, v_prestador_doc, v_os_id, v_valor_liquido, v_valor_prestador, v_pedagio_valor, v_outros_custos, CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END, CASE WHEN v_is_concluida THEN 'pendente' ELSE 'nao_vencido' END, 'escala_direta', 1, COALESCE(NEW.data_escala, CURRENT_DATE), COALESCE(NEW.data_escala, CURRENT_DATE), 'Custo Logistico', v_data_venc_30, COALESCE(NEW.data_escala, CURRENT_DATE), true, true)
        ON CONFLICT (os_id) DO UPDATE SET valor_liquido = v_valor_liquido, valor_servicos = v_valor_prestador, status_conferencia = CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    -- Composicao
    IF v_is_concluida AND v_valor_cliente > 0 THEN
      DECLARE v_imp NUMERIC; v_seg NUMERIC; v_mb NUMERIC; v_ml NUMERIC; BEGIN
        v_imp := ROUND(v_valor_cliente * 4.5 / 100, 2);
        v_seg := ROUND(v_valor_cliente * 0.01, 2);
        v_mb := v_valor_cliente - v_valor_prestador - v_pedagio_valor - v_outros_custos;
        v_ml := v_mb - v_imp - v_seg;
        INSERT INTO composicao_financeira_os (os_id, cliente_id, prestador_id, valor_cliente, valor_prestador, imposto_percentual, imposto_valor, seguro_valor, pedagio_valor, outros_custos, combustivel_valor, ajudante_valor, adicional_valor, desconto_valor, margem_bruta, margem_liquida, percentual_margem_bruta, percentual_margem_liquida, origem_calculo)
        VALUES (v_os_id, NEW.cliente_id, NEW.prestador_id, v_valor_cliente, v_valor_prestador, 4.5, v_imp, v_seg, v_pedagio_valor, v_outros_custos, 0, v_ajudante_valor, v_adicional_valor, v_desconto_valor, v_mb, v_ml, CASE WHEN v_valor_cliente > 0 THEN ROUND(v_mb / v_valor_cliente * 100, 2) ELSE 0 END, CASE WHEN v_valor_cliente > 0 THEN ROUND(v_ml / v_valor_cliente * 100, 2) ELSE 0 END, 'escala_direta')
        ON CONFLICT (os_id) DO UPDATE SET valor_cliente = v_valor_cliente, valor_prestador = v_valor_prestador, margem_bruta = v_mb, margem_liquida = v_ml;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RAISE WARNING '[M108F] Erro (alocacao %): %', NEW.id, v_error_msg;
    RETURN NEW;
  END;
END;
$$`;
  await exec('Recriar M104A trigger function', triggerSql);

  await exec('Drop trigger antigo',
    `DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala`);
  await exec('Criar trigger novo',
    `CREATE TRIGGER trg_propagar_financeiro_alocacao AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse, valor_pedagio, valor_combustivel, valor_ajudante, valor_adicional, valor_desconto, tipo_reversa, reversa_valor_cliente, reversa_valor_prestador ON alocacoes_escala FOR EACH ROW EXECUTE FUNCTION public.f_trg_propagar_financeiro_alocacao()`);

  // ===== TESTE =====
  console.log('\n🧪 TESTE: Reversa + Financeiro + Event Bus\n');

  const { rows: prest } = await pool.query("SELECT id, nome_completo FROM public.prestadores WHERE status='ativo' LIMIT 1");
  const { rows: cli } = await pool.query("SELECT id FROM public.clientes LIMIT 1");

  const prestId = prest[0]?.id;
  const cliId = cli[0]?.id;

  if (!prestId || !cliId) {
    check('Dados base', false, 'prestador ou cliente ausente');
    await pool.end(); process.exit(1);
  }

  const osId = crypto.randomUUID();
  // Schema real: ordens_servico.cliente=UUID, cliente_id=TEXT
  await exec('Criar OS com reversa',
    `INSERT INTO public.ordens_servico (id, cliente, cliente_id, status, tipo_operacao, veiculo_tipo, valor_cliente, custo_prestador, distancia_km, tipo_reversa, reversa_qtd_volumes)
     VALUES ($1::uuid, $2::uuid, $2::text, 'pendente', 'Entrega', 'VUC', 2000, 1200, 50, 'devolucao', 5)`,
    [osId, cliId]);

  const alocId = crypto.randomUUID();
  // Schema: alocacoes_escala.cliente_id = UUID, prestador_id = UUID
  await exec('Criar alocacao com reversa',
    `INSERT INTO public.alocacoes_escala (id, ordem_servico_id, cliente_id, prestador_id, status, data_escala, tipo_veiculo, valor_frete, valor_repasse, tipo_reversa, reversa_valor_cliente, reversa_valor_prestador, reversa_qtd_volumes, aceite_prestador, data_aceite)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'aceita', CURRENT_DATE, 'VUC', 2000, 1200, 'devolucao', 300, 150, 5, true, NOW())`,
    [alocId, osId, cliId, prestId]);

  await new Promise(r => setTimeout(r, 1500));

  // Verify
  const { rows: receber } = await pool.query("SELECT valor, descricao FROM public.financeiro_receber WHERE os_id=$1", [osId]);
  check('Receber = 2300 (2000+300 reversa)', receber.length > 0 && Number(receber[0].valor) === 2300,
    receber[0] ? `R$ ${receber[0].valor} - ${receber[0].descricao}` : 'vazio');

  const { rows: pagar } = await pool.query("SELECT valor FROM public.financeiro_pagar WHERE os_id=$1::text", [osId]);
  check('Pagar = 1350 (1200+150 reversa)', pagar.length > 0 && Number(pagar[0].valor) === 1350,
    pagar[0] ? `R$ ${pagar[0].valor}` : 'vazio');

  const { rows: osCheck } = await pool.query("SELECT tipo_reversa, reversa_qtd_volumes FROM public.ordens_servico WHERE id=$1::uuid", [osId]);
  check('OS tipo_reversa = devolucao', osCheck[0]?.tipo_reversa === 'devolucao', osCheck[0]?.tipo_reversa);
  check('OS reversa_qtd_volumes = 5', Number(osCheck[0]?.reversa_qtd_volumes) === 5, String(osCheck[0]?.reversa_qtd_volumes));

  const { rows: alocCheck } = await pool.query("SELECT tipo_reversa, reversa_valor_cliente, reversa_valor_prestador, reversa_qtd_volumes FROM public.alocacoes_escala WHERE id=$1", [alocId]);
  check('Aloc tipo_reversa = devolucao', alocCheck[0]?.tipo_reversa === 'devolucao', alocCheck[0]?.tipo_reversa);
  check('Aloc reversa_cliente = 300', Number(alocCheck[0]?.reversa_valor_cliente) === 300, String(alocCheck[0]?.reversa_valor_cliente));
  check('Aloc reversa_prestador = 150', Number(alocCheck[0]?.reversa_valor_prestador) === 150, String(alocCheck[0]?.reversa_valor_prestador));

  // Event Bus
  const { rows: eventos } = await pool.query(
    "SELECT event_type FROM public.eventos_oficiais WHERE entity_id=$1::uuid ORDER BY created_at DESC LIMIT 3",
    [alocId]);
  check('Event Bus eventos', eventos.length > 0, eventos.map(e => e.event_type).join(', '));

  // Cleanup
  await pool.query("DELETE FROM public.eventos_oficiais WHERE entity_id=$1::uuid", [alocId]);
  await pool.query("DELETE FROM public.financeiro_pagar WHERE os_id=$1", [osId]);
  try { await pool.query("DELETE FROM public.os_historico WHERE ordem_servico_id=$1::uuid", [osId]); } catch {}
  await pool.query("DELETE FROM public.financeiro_receber WHERE os_id=$1", [osId]);
  await pool.query("DELETE FROM public.pagamentos_prestadores WHERE os_id=$1", [osId]);
  await pool.query("DELETE FROM public.composicao_financeira_os WHERE os_id=$1", [osId]);
  await pool.query("DELETE FROM public.alocacoes_escala WHERE id=$1::uuid", [alocId]);
  await pool.query("DELETE FROM public.ordens_servico WHERE id=$1::uuid", [osId]);

  // Result
  console.log('\n' + '═'.repeat(65));
  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`RESULTADO: ${ok} ✅ / ${fail} ❌`);
  await pool.end();
  if (fail > 0) process.exit(1);
}
main().catch(e => { console.error(e.message); process.exit(1); });
