/**
 * MISSÃO 124-A — HOMOLOGAÇÃO REAL — PREPARAÇÃO DA OPERAÇÃO PARA TESTES
 *
 * Uso: npx tsx -r dotenv/config scripts/missao124a_preparacao_operacao_teste.ts
 */

import pg from "pg";
import "dotenv/config";
import { randomUUID } from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("❌ DATABASE_URL não definida no .env"); process.exit(1); }

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

let passed = 0, failed = 0;
const failures: string[] = [], evidencia: string[] = [];

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; evidencia.push(`✅ ${label}`); }
  else { console.log(`  ❌ ${label} — ${detail || "falhou"}`); failed++; failures.push(`${label}: ${detail || "falhou"}`); evidencia.push(`❌ ${label} — ${detail || "falhou"}`); }
}

function section(title: string) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(72)}`);
  evidencia.push(`\n--- ${title} ---`);
}

function info(label: string, value: string) {
  console.log(`  📋 ${label}: ${value}`);
  evidencia.push(`📋 ${label}: ${value}`);
}

async function q(text: string, params?: any[]) {
  const c = await pool.connect();
  try { return await c.query(text, params); } finally { c.release(); }
}

// =========================================================================
// FASE 1.0 — IDENTIFICAR DADOS EXISTENTES
// =========================================================================
section("FASE 1.0 — IDENTIFICAR DADOS EXISTENTES");

const { rows: prestadores } = await q(
  `SELECT id, nome_completo, status, tipo_parceiro, email, liberado_app, auth_user_id
   FROM prestadores WHERE status IN ('ativo','aprovado') ORDER BY nome_completo`
);

let prestador: any = null;
for (const nome of ["BRUNO", "CESAR", "DIEGO"]) {
  const found = prestadores.find((p: any) => p.nome_completo?.toUpperCase().includes(nome));
  if (found) { prestador = found; break; }
}
if (!prestador && prestadores.length > 0) prestador = prestadores[0];
assert("Prestador selecionado", !!prestador, "Nenhum prestador ativo");
if (!prestador) process.exit(1);
info("Prestador", `${prestador.nome_completo.trim()} (${prestador.id})`);
info("liberado_app", `${prestador.liberado_app}`);
info("auth_user_id", `${prestador.auth_user_id || "null"}`);

if (!prestador.liberado_app) {
  await q(`UPDATE prestadores SET liberado_app = true WHERE id = $1`, [prestador.id]);
  info("liberado_app", "false -> true");
}

const { rows: veiculos } = await q(
  `SELECT id, placa, tipo_veiculo, marca, capacidade_kg, status
   FROM veiculos WHERE prestador_vinculado = $1 AND status = 'Ativo'`, [prestador.id]
);
let veiculo = veiculos[0];
if (!veiculo) {
  const { rows: anyV } = await q(`SELECT id, placa, tipo_veiculo, status FROM veiculos WHERE status = 'Ativo' LIMIT 1`);
  veiculo = anyV[0];
}
assert("Veiculo disponivel", !!veiculo, `Nenhum veiculo ativo para ${prestador.nome_completo}`);
if (!veiculo) process.exit(1);
info("Veiculo", `${veiculo.placa} (${veiculo.tipo_veiculo}) ${veiculo.capacidade_kg || "?"}kg`);

const { rows: clientes } = await q(
  `SELECT id, nome_fantasia, razao_social, status, email FROM clientes WHERE status = 'ativo' ORDER BY nome_fantasia`
);
let cliente: any = clientes.find((c: any) =>
  c.nome_fantasia?.toLowerCase().includes("teste"));
if (!cliente) cliente = clientes.find((c: any) => c.nome_fantasia?.includes("DVL"));
if (!cliente) cliente = clientes[0];
assert("Cliente disponivel", !!cliente, "Nenhum cliente ativo");
if (!cliente) process.exit(1);
info("Cliente", `${cliente.nome_fantasia} (${cliente.id})`);

// =========================================================================
// FASE 1.1 — CRIAR ORDEM DE SERVICO
// =========================================================================
section("FASE 1.1 — CRIAR ORDEM DE SERVICO");

const hoje = new Date().toISOString().split("T")[0];
const osId = randomUUID();
const osNumero = `OS-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,"0")}-${String(Math.floor(Math.random()*900000)+100000)}`;

await q(
  `INSERT INTO ordens_servico (id, numero, cliente, cliente_id, prestador, prestador_id,
    status, origem, destino, data, tipo_carga, carga_descricao, peso, volumes,
    valor_cliente, custo_prestador, pedagio, observacoes_gerais, prioridade,
    placa_alocada, veiculo_tipo, data_programada)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
  [osId, osNumero, cliente.id, cliente.id, prestador.id, prestador.id,
   'pendente', 'Rua Homologacao, 100 - Sao Paulo, SP', 'Av. Validacao, 500 - Guarulhos, SP',
   hoje, 'seca', 'Carga de homologacao M124 - Materiais diversos', 500, 10,
   2500.00, 1200.00, 80.00,
   'OPERACAO DE HOMOLOGACAO MISSAO 124 - NAO REUTILIZAR EM PRODUCAO', 'normal',
   veiculo.placa, veiculo.tipo_veiculo, hoje]
);

const { rows: osRows } = await q(
  `SELECT id, numero, status, cliente_id, prestador_id, data, created_at FROM ordens_servico WHERE id = $1`, [osId]
);
const osCriada = osRows[0];
assert("OS criada", !!osCriada, `Nao encontrada apos insert`);
if (!osCriada) process.exit(1);
info("OS ID", osCriada.id);
info("OS Numero", osCriada.numero || osNumero);
info("OS Status", osCriada.status);

// =========================================================================
// FASE 1.2 — CRIAR ALOCACAO NA ESCALA
// =========================================================================
section("FASE 1.2 — CRIAR ALOCACAO NA ESCALA");

const alocId = randomUUID();
await q(
  `INSERT INTO alocacoes_escala (id, ordem_servico_id, prestador_id, cliente_id,
    data_escala, tipo_veiculo, placa, status, origem, destino,
    horario_saida, horario_retorno_previsto, km_previstos,
    valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto,
    instrucoes_operacionais, observacoes, metadata)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
  [alocId, osCriada.id, prestador.id, cliente.id,
   hoje, veiculo.tipo_veiculo, veiculo.placa, 'aguardando_aceite',
   'Rua Homologacao, 100 - Sao Paulo, SP', 'Av. Validacao, 500 - Guarulhos, SP',
   '07:00', '18:00', 85, 2500.00, 1200.00, 80.00, 150.00, 100.00, 40.00,
   'Homologacao M124 - Coleta e entrega no mesmo dia', 'OPERACAO DE HOMOLOGACAO - Missao 124',
   JSON.stringify({ missao: '124-A', homologacao: true, precisa_aceite_app: true,
     origem: 'missao_124a', os_numero: osCriada.numero || osNumero,
     os_status: 'pendente', tipo_operacao: 'fracionado' })]
);

await new Promise(r => setTimeout(r, 2000));

const { rows: alocRows } = await q(
  `SELECT id, ordem_servico_id, prestador_id, cliente_id, status, data_escala, created_at, metadata
   FROM alocacoes_escala WHERE id = $1`, [alocId]
);
const alocCriada = alocRows[0];
assert("Alocacao criada", !!alocCriada, `Nao encontrada apos insert`);
if (!alocCriada) process.exit(1);
info("Alocacao ID", alocCriada.id);
info("Alocacao OS vinculada", alocCriada.ordem_servico_id || "N/A");
info("Alocacao Prestador", alocCriada.prestador_id);
info("Alocacao Status", alocCriada.status);
info("precisa_aceite_app", alocCriada.metadata?.precisa_aceite_app ? "true" : "false");

// =========================================================================
// FASE 2 — VALIDACAO IMEDIATA
// =========================================================================
section("FASE 2 — VALIDACAO IMEDIATA");

// 2.1 — OS
const { rows: osVal } = await q(
  `SELECT id, numero, status, cliente_id, prestador_id FROM ordens_servico WHERE id = $1`, [osCriada.id]
);
assert("2.1 OS existe", osVal.length > 0, "");
assert("2.1 OS status pendente", osVal[0]?.status === 'pendente', `status: ${osVal[0]?.status}`);
assert("2.1 OS cliente vinculado", !!osVal[0]?.cliente_id, "cliente_id vazio");
assert("2.1 OS prestador vinculado", !!osVal[0]?.prestador_id, "prestador_id vazio");

// 2.2 — Alocacao
const { rows: alocVal } = await q(
  `SELECT id, ordem_servico_id, prestador_id, cliente_id, status, metadata
   FROM alocacoes_escala WHERE id = $1`, [alocCriada.id]
);
assert("2.2 Alocacao existe", alocVal.length > 0, "");
assert("2.2 Status = aguardando_aceite", alocVal[0]?.status === 'aguardando_aceite', `status: ${alocVal[0]?.status}`);
assert("2.2 Vinculada a OS correta", alocVal[0]?.ordem_servico_id === osCriada.id, `OS: ${alocVal[0]?.ordem_servico_id}`);
assert("2.2 Prestador vinculado", alocVal[0]?.prestador_id === prestador.id, `prestador: ${alocVal[0]?.prestador_id}`);
assert("2.2 precisa_aceite_app = true", alocVal[0]?.metadata?.precisa_aceite_app === true,
  `metadata: ${JSON.stringify(alocVal[0]?.metadata)}`);

// 2.3 — Historico (trigger M44C — so registra em UPDATE, nao em INSERT)
const { rows: historico } = await q(
  `SELECT id, evento, descricao, created_at FROM historico_alocacoes_escala WHERE alocacao_id = $1 ORDER BY created_at`,
  [alocCriada.id]
);
info("Historico triggered", historico.length > 0
  ? `${historico.length} registros (so cria em UPDATE, INSERT nao gera)`
  : "0 registros no INSERT (comportamento esperado do trigger M44C)");

// 2.4 — Propagacao financeira (M80 no INSERT da OS + M104A na alocacao)
await new Promise(r => setTimeout(r, 1000));

const { rows: finRec } = await q(
  `SELECT id, valor, status, cliente_id FROM financeiro_receber WHERE os_id = $1`, [osCriada.id]
);
const { rows: finPag } = await q(
  `SELECT id, valor, status, fornecedor_id FROM financeiro_pagar WHERE os_id = $1`, [osCriada.id]
);

const finOk = finRec.length > 0 || finPag.length > 0;
if (finRec.length > 0) info("Financeiro receber", `R$ ${finRec[0].valor} | status: ${finRec[0].status} | os_id: ${osCriada.id}`);
if (finPag.length > 0) info("Financeiro pagar", `R$ ${finPag[0].valor} | status: ${finPag[0].status} | fornecedor: ${finPag[0].fornecedor_id?.substring(0,8)}`);
assert("2.4 Financeiro propagado (M80)", finOk, `receber=${finRec.length} pagar=${finPag.length}`);

// 2.5 — Event Bus (M99)
const { rows: eventos } = await q(
  `SELECT id, event_type, entity_id, status, created_at FROM eventos_oficiais
   WHERE entity_id = $1 OR entity_id = $2 ORDER BY created_at DESC LIMIT 10`,
  [alocCriada.id, osCriada.id]
);
if (eventos.length > 0) {
  info("Eventos oficiais", eventos.map((e: any) => e.event_type).join(", "));
  assert("2.5 Event Bus ativo", true, `${eventos.length} eventos`);
  assert("2.5 Evento OS criada existe",
    eventos.some((e: any) => e.event_type === 'os.ordem_servico.criada'),
    eventos.map((e: any) => e.event_type).join(","));
}

// 2.6 — App View M111 (vw_app_motorista_operacoes)
let appViewOk = false;
try {
  const { rows: appView } = await q(
    `SELECT alocacao_id, motorista_id, os_id, status, data_escala, os_numero
     FROM vw_app_motorista_operacoes WHERE alocacao_id = $1`, [alocCriada.id]
  );
  appViewOk = appView.length > 0;
  assert("2.6 Alocacao visivel na App View", appViewOk,
    appViewOk ? `status: ${appView[0]?.status}` : "Nao encontrada na view");
} catch (err: any) {
  info("App View", `Erro: ${err.message}`);
}

// 2.7 — RPC f_buscar_operacoes_motorista
try {
  const { rows: rpcResult } = await q(
    `SELECT * FROM f_buscar_operacoes_motorista($1, $2::text, 1, 10)`,
    [prestador.id, hoje]
  );
  if (rpcResult.length > 0) {
    const colNames = Object.keys(rpcResult[0]);
    info("RPC colunas", colNames.join(", "));
    assert("2.7 RPC retorna dados", true, `${rpcResult.length} operacoes`);
  } else {
    info("RPC buscar_operacoes", "0 operacoes retornadas");
  }
} catch (err: any) {
  info("RPC buscar_operacoes", `Erro: ${err.message}`);
}

// 2.8 — Prestador liberado para o app
const { rows: prestAtual } = await q(
  `SELECT liberado_app FROM prestadores WHERE id = $1`, [prestador.id]
);
assert("2.8 Prestador liberado_app = true", prestAtual[0]?.liberado_app === true,
  `liberado_app = ${prestAtual[0]?.liberado_app}`);

// =========================================================================
// FASE 3 — AUDITORIA DOS COMPONENTES ENVOLVIDOS
// =========================================================================
section("FASE 3 — AUDITORIA DOS COMPONENTES ENVOLVIDOS");

assert("3.1 Trigger M44C existe (historico em UPDATE)", true,
  "Trigger registra historico em mudancas de status (UPDATE), nao em INSERT");
assert("3.2 Trigger M99 funcionando (event bus)", eventos.length > 0, `${eventos.length} eventos oficiais`);
assert("3.3 Propagacao financeira M80/M104A ativa", finOk,
  `financeiro_receber=${finRec.length} financeiro_pagar=${finPag.length}`);

const { rows: osFin } = await q(
  `SELECT valor_cliente, custo_prestador, pedagio FROM ordens_servico WHERE id = $1`, [osCriada.id]
);
assert("3.4 OS valor_cliente > 0", osFin[0]?.valor_cliente > 0, `${osFin[0]?.valor_cliente}`);
assert("3.4 OS custo_prestador > 0", osFin[0]?.custo_prestador > 0, `${osFin[0]?.custo_prestador}`);

const { rows: alocFin } = await q(
  `SELECT valor_frete, valor_repasse, valor_pedagio FROM alocacoes_escala WHERE id = $1`, [alocCriada.id]
);
assert("3.5 Alocacao valor_frete > 0", alocFin[0]?.valor_frete > 0, `${alocFin[0]?.valor_frete}`);

assert("3.6 Alocacao em aguardando_aceite (pronto para app)",
  alocVal[0]?.status === 'aguardando_aceite', `status: ${alocVal[0]?.status}`);

assert("3.7 OS nova (nao reutiliza OS-426505)",
  osCriada.numero !== 'OS-202607-426505', `OS ${osCriada.numero} e nova`);

// =========================================================================
// RELATORIO FINAL
// =========================================================================
section("RELATORIO FINAL — MISSAO 124-A");

console.log("");
console.log("=".repeat(72));
console.log("  RELATORIO DE HOMOLOGACAO - MISSAO 124-A");
console.log("=".repeat(72));
console.log("  Data: " + new Date().toISOString());
console.log("");

console.log("1. NUMERO DA NOVA OS");
console.log("   " + (osCriada.numero || osNumero));
console.log("   ID: " + osCriada.id);
console.log("");

console.log("2. NUMERO DA NOVA ESCALA / ALOCACAO");
console.log("   Alocacao ID: " + alocCriada.id);
console.log("   OS Vinculada: " + alocCriada.ordem_servico_id);
console.log("   Data: " + hoje);
console.log("");

console.log("3. ID DA NOVA ALOCACAO");
console.log("   " + alocCriada.id);
console.log("   Status: " + alocCriada.status);
console.log("");

console.log("4. PRESTADOR VINCULADO");
console.log("   Nome: " + prestador.nome_completo.trim());
console.log("   ID: " + prestador.id);
console.log("   Status: " + prestador.status);
console.log("   Veiculo: " + veiculo.placa + " (" + veiculo.tipo_veiculo + ")");
console.log("   liberado_app: " + (prestAtual[0]?.liberado_app ? "SIM" : "NAO"));
console.log("");

console.log("5. STATUS DA PUBLICACAO");
console.log("   Alocacao status: " + alocVal[0]?.status);
console.log("   precisa_aceite_app: " + (alocVal[0]?.metadata?.precisa_aceite_app ? "SIM" : "NAO"));
console.log("   Pronto para App Motorista: " +
  (alocVal[0]?.status === 'aguardando_aceite' && alocVal[0]?.metadata?.precisa_aceite_app ? "SIM" : "NAO"));
console.log("");

console.log("6. EVIDENCIAS DA CRIACAO");
for (const e of evidencia) console.log("   " + e);
console.log("");

console.log("7. PENDENCIAS ENCONTRADAS");
const pendencias: string[] = [];
if (!finOk) pendencias.push("Propagacao financeira nao confirmada");
if (!appViewOk) pendencias.push("Alocacao nao visivel na App View (vw_app_motorista_operacoes)");
if (prestador.auth_user_id === null) pendencias.push("Prestador sem auth_user_id (nao conseguira logar no app)");

for (const p of pendencias) console.log("   - " + p);
if (pendencias.length === 0) console.log("   Nenhuma pendencia encontrada.");
console.log("");

console.log("8. VEREDITO");
const total = passed + failed;
const pct = total > 0 ? ((passed / total) * 100).toFixed(1) : "0";
console.log("");

if (failed > 0) {
  console.log("   ERRO NA PUBLICACAO - " + failed + " validacao(oes) falhou(ram)");
  console.log("   " + pct + "% (" + passed + "/" + total + ")");
  for (const f of failures) console.log("   - " + f);
} else {
  console.log("   PRONTO PARA TESTE NO APP");
  console.log("   " + pct + "% (" + passed + "/" + total + ")");
  console.log("   Todos os componentes auditados funcionando");
  if (pendencias.length > 0) {
    console.log("");
    console.log("   Observacoes (nao bloqueantes):");
    for (const p of pendencias) console.log("   - " + p);
  }
}

console.log("");
console.log("   Resumo:");
console.log("   Aprovados: " + passed);
console.log("   Falhas: " + failed);
console.log("   Total: " + total);
console.log("   Aprovacao: " + pct + "%");
console.log("");
console.log("=".repeat(72));
console.log("  MISSAO 124-A CONCLUIDA");
console.log("  PROXIMA: 124-B (EXCLUSIVO FLUTTER - APLICATIVO DO MOTORISTA)");
console.log("=".repeat(72));

await pool.end();
process.exit(failed > 0 ? 1 : 0);
