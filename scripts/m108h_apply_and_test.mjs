import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
let ok = 0, fail = 0;

function check(label, cond, detail) {
  console.log(`  ${cond ? '✅' : '❌'} ${label}`);
  results.push({ label, ok: cond, detail: String(detail).slice(0, 100) });
  if (cond) ok++; else fail++;
}

async function exec(label, sql, params) {
  try { await pool.query(sql, params || []); check(label, true, 'ok'); }
  catch (e) {
    if (e.message.includes('already exists')) check(label, true, 'ja existia');
    else { check(label, false, e.message.slice(0, 120)); }
  }
}

async function main() {
  console.log('═'.repeat(65));
  console.log('M108-H — CONTRATOS ENTERPRISE E OPERACOES RECORRENTES');
  console.log('═'.repeat(65));

  // Create tables
  console.log('\n📦 Criando tabelas...');
  const tables = [
    `CREATE TABLE IF NOT EXISTS public.contratos_operacao (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID DEFAULT NULL,
      numero TEXT UNIQUE NOT NULL,
      cliente_id UUID NOT NULL,
      cliente_nome TEXT NOT NULL,
      data_inicio DATE NOT NULL,
      data_fim DATE,
      renovacao_automatica BOOLEAN DEFAULT false,
      frequencia TEXT NOT NULL DEFAULT 'diaria' CHECK (frequencia IN ('diaria','semanal','quinzenal','mensal','data_especifica')),
      dias_semana INTEGER[] DEFAULT '{}',
      dia_mes INTEGER, datas_especificas DATE[],
      horario_inicio TIME DEFAULT '08:00', horario_fim TIME DEFAULT '18:00',
      sla_entrega_horas INTEGER DEFAULT 24, tolerancia_atraso_minutos INTEGER DEFAULT 30,
      tabela_valores_id UUID,
      tipo_reversa TEXT DEFAULT 'sem_reversa',
      reversa_config JSONB DEFAULT '{}'::jsonb,
      dias_para_vencimento INTEGER DEFAULT 30, aliquota_iss NUMERIC(5,2) DEFAULT 4.5,
      prestador_id UUID, usar_rede BOOLEAN DEFAULT false,
      documentos_obrigatorios TEXT[] DEFAULT '{}',
      ativo BOOLEAN DEFAULT true, suspenso_ate DATE, motivo_suspensao TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS public.contratos_operacao_rotas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contrato_id UUID NOT NULL,
      nome TEXT NOT NULL, ordem INTEGER DEFAULT 0,
      origem_cidade TEXT NOT NULL, origem_uf TEXT NOT NULL,
      destino_cidade TEXT NOT NULL, destino_uf TEXT NOT NULL,
      tipo_veiculo TEXT NOT NULL, tipo_operacao TEXT NOT NULL DEFAULT 'Entrega',
      distancia_km NUMERIC(10,2) DEFAULT 0,
      peso_medio_kg NUMERIC(10,2) DEFAULT 0, volumes_medio INTEGER DEFAULT 0,
      tabela_valores_id UUID, prestador_id UUID,
      horario_inicio TIME, horario_fim TIME,
      ativo BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS public.contratos_operacao_execucao (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contrato_id UUID NOT NULL, rota_id UUID,
      os_id UUID, alocacao_id UUID,
      data_geracao DATE NOT NULL, data_operacao DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','gerada','cancelada','falha')),
      erro TEXT, UNIQUE (rota_id, data_operacao),
      created_at TIMESTAMPTZ DEFAULT NOW())`,
  ];
  for (const sql of tables) await exec('Criar tabela', sql);

  // RLS
  console.log('\n📦 RLS...');
  for (const t of ['contratos_operacao', 'contratos_operacao_rotas', 'contratos_operacao_execucao']) {
    await exec(`RLS ${t}`, `ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`);
  }

  // Number function
  await exec('Funcao numero contrato', `
    CREATE OR REPLACE FUNCTION public.gerar_numero_contrato_operacao() RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS \$\$
    DECLARE ano TEXT; proximo INTEGER;
    BEGIN
      ano := EXTRACT(YEAR FROM NOW())::TEXT;
      SELECT COALESCE(MAX(NULLIF(SUBSTRING(numero FROM 10 FOR 6), '')::INTEGER), 0) + 1 INTO proximo
        FROM public.contratos_operacao WHERE numero LIKE 'CTR-OP-' || ano || '-%';
      RETURN 'CTR-OP-' || ano || '-' || LPAD(proximo::TEXT, 6, '0');
    END;
    \$\$;`);

  // ===== TESTES =====
  console.log('\n🧪 Teste 1: Criar contrato...');
  const { rows: cli } = await pool.query("SELECT id, nome_fantasia FROM public.clientes LIMIT 1");
  const contratoId = crypto.randomUUID();

  await exec('Criar contrato diario',
    `INSERT INTO public.contratos_operacao (id, numero, cliente_id, cliente_nome, data_inicio, frequencia, horario_inicio, horario_fim, ativo)
     VALUES ($1, 'CTR-OP-2026-000001', $2, $3, CURRENT_DATE, 'diaria', '08:00', '18:00', true)`,
    [contratoId, cli[0].id, cli[0].nome_fantasia || 'Cliente Teste']);

  const { rows: c1 } = await pool.query(`SELECT numero, frequencia FROM public.contratos_operacao WHERE id = $1`, [contratoId]);
  check('Contrato criado', c1.length > 0, c1[0]?.numero);
  check('Frequencia diaria', c1[0]?.frequencia === 'diaria', c1[0]?.frequencia);

  console.log('\n🧪 Teste 2: Criar rotas...');
  const rotaId = crypto.randomUUID();
  await exec('Criar rota 1',
    `INSERT INTO public.contratos_operacao_rotas (id, contrato_id, nome, ordem, origem_cidade, origem_uf, destino_cidade, destino_uf, tipo_veiculo, tipo_operacao, distancia_km, ativo)
     VALUES ($1, $2, 'Rota Principal', 1, 'Sao Paulo', 'SP', 'Osasco', 'SP', 'VUC', 'Entrega', 25, true)`,
    [rotaId, contratoId]);

  const { rows: r1 } = await pool.query(`SELECT nome, tipo_veiculo FROM public.contratos_operacao_rotas WHERE id = $1`, [rotaId]);
  check('Rota criada', r1.length > 0, r1[0]?.nome);
  check('Tipo veiculo VUC', r1[0]?.tipo_veiculo === 'VUC', r1[0]?.tipo_veiculo);

  console.log('\n🧪 Teste 3: Execucao...');
  const execId = crypto.randomUUID();
  const hoje = new Date().toISOString().split('T')[0];
  await exec('Registrar execucao',
    `INSERT INTO public.contratos_operacao_execucao (id, contrato_id, rota_id, data_geracao, data_operacao, status)
     VALUES ($1, $2, $3, $4, $4, 'pendente')`,
    [execId, contratoId, rotaId, hoje]);

  const { rows: e1 } = await pool.query(`SELECT status FROM public.contratos_operacao_execucao WHERE id = $1`, [execId]);
  check('Execucao pendente', e1[0]?.status === 'pendente', e1[0]?.status);

  console.log('\n🧪 Teste 4: Unique constraint (nao duplicar mesma rota/data)...');
  try {
    await pool.query(
      `INSERT INTO public.contratos_operacao_execucao (id, contrato_id, rota_id, data_geracao, data_operacao, status)
       VALUES ($1, $2, $3, $4, $4, 'pendente')`,
      [crypto.randomUUID(), contratoId, rotaId, hoje]);
    check('Duplicata bloqueada', false, 'deveria ter lancado erro');
  } catch (e) {
    check('Duplicata bloqueada (UNIQUE)', true, e.message.includes('unique') ? 'unique constraint' : 'ok');
  }

  console.log('\n🧪 Teste 5: Contrato semanal...');
  const contratoSemId = crypto.randomUUID();
  await exec('Criar contrato semanal',
    `INSERT INTO public.contratos_operacao (id, numero, cliente_id, cliente_nome, data_inicio, frequencia, dias_semana, horario_inicio, horario_fim, ativo)
     VALUES ($1, 'CTR-OP-2026-000002', $2, $3, CURRENT_DATE, 'semanal', '{1,3,5}', '08:00', '18:00', true)`,
    [contratoSemId, cli[0].id, cli[0].nome_fantasia || 'Cliente Teste']);

  const { rows: cs } = await pool.query(`SELECT frequencia, dias_semana FROM public.contratos_operacao WHERE id = $1`, [contratoSemId]);
  check('Contrato semanal', cs[0]?.frequencia === 'semanal', cs[0]?.frequencia);
  check('Dias 1,3,5', JSON.stringify(cs[0]?.dias_semana) === '[1,3,5]', JSON.stringify(cs[0]?.dias_semana));

  console.log('\n🧪 Teste 6: Contrato com reversa...');
  const contratoRevId = crypto.randomUUID();
  await exec('Criar contrato com reversa',
    `INSERT INTO public.contratos_operacao (id, numero, cliente_id, cliente_nome, data_inicio, frequencia, tipo_reversa, reversa_config, ativo)
     VALUES ($1, 'CTR-OP-2026-000003', $2, $3, CURRENT_DATE, 'diaria', 'devolucao', '{\"volumes\":5,\"valor\":50}'::jsonb, true)`,
    [contratoRevId, cli[0].id, cli[0].nome_fantasia || 'Cliente Teste']);

  const { rows: cr } = await pool.query(`SELECT tipo_reversa FROM public.contratos_operacao WHERE id = $1`, [contratoRevId]);
  check('Reversa configurada', cr[0]?.tipo_reversa === 'devolucao', cr[0]?.tipo_reversa);

  // Cleanup
  await pool.query(`DELETE FROM public.contratos_operacao_execucao WHERE contrato_id = $1`, [contratoRevId]);
  await pool.query(`DELETE FROM public.contratos_operacao_execucao WHERE contrato_id = $1`, [contratoSemId]);
  await pool.query(`DELETE FROM public.contratos_operacao_execucao WHERE id = $1`, [execId]);
  await pool.query(`DELETE FROM public.contratos_operacao_execucao WHERE contrato_id = $1`, [contratoId]);
  await pool.query(`DELETE FROM public.contratos_operacao_rotas WHERE contrato_id IN ($1, $2, $3)`, [contratoId, contratoSemId, contratoRevId]);
  await pool.query(`DELETE FROM public.contratos_operacao WHERE id IN ($1, $2, $3)`, [contratoId, contratoSemId, contratoRevId]);

  // Result
  console.log('\n' + '═'.repeat(65));
  console.log(`RESULTADO: ${ok} ✅ / ${fail} ❌`);
  await pool.end();
  if (fail > 0) process.exit(1);
}
main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
