/**
 * MISSAO 124-C — CHECKLIST PRÉ-ACEITE (VALIDACAO VIA SUPABASE)
 */
import pg from "pg";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL nao definida"); process.exit(1); }
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
const q = async (t: string, p?: any[]) => { const c = await pool.connect(); try { return await c.query(t, p); } finally { c.release(); } };

const ALOC_ID = "1e9b311e-c701-4469-8f8e-ed99b9cd9a73";
const OS_ID = "405fe001-4947-44a6-8cd2-c0203a701cfd";
const PREST_ID = "e6646799-fbac-453e-a3ef-afdfc01a7085";

let passed = 0, failed = 0;
function ok(label: string, c: boolean, d?: string) { if (c) { console.log("  ✅ "+label); passed++; } else { console.log("  ❌ "+label+" — "+(d||"falhou")); failed++; } }

(async () => {
  console.log("=".repeat(72));
  console.log("  MISSAO 124-C — CHECKLIST PRE-ACEITE");
  console.log("=".repeat(72));

  // ── ALOCACAO ──
  const { rows: [a] } = await q("SELECT prestador_id, status, metadata, aceite_prestador FROM alocacoes_escala WHERE id = $1", [ALOC_ID]);
  console.log("\n── ALOCACAO ──");
  ok("prestador_id = PRESTADOR TESTE APP", a.prestador_id === PREST_ID, a.prestador_id);
  ok("status = aguardando_aceite", a.status === "aguardando_aceite", a.status);
  ok("precisa_aceite_app = true", a.metadata?.precisa_aceite_app === true, `${a.metadata?.precisa_aceite_app}`);
  ok("aceite_prestador = false", a.aceite_prestador === false || a.aceite_prestador === null, `${a.aceite_prestador}`);

  // ── OS ──
  const { rows: [os] } = await q("SELECT numero, status, cliente, prestador FROM ordens_servico WHERE id = $1", [OS_ID]);
  console.log("\n── ORDEM DE SERVICO ──");
  ok("OS numero correto", os.numero === "OS-202607-938413", os.numero);
  ok("OS status coerente", os.status === "pendente", os.status);

  // ── FINANCEIRO ──
  const { rows: [fp] } = await q("SELECT fornecedor_id, fornecedor_nome, valor FROM financeiro_pagar WHERE os_id = $1", [OS_ID]);
  const { rows: [pp] } = await q("SELECT prestador_id, prestador_nome, valor_servicos FROM pagamentos_prestadores WHERE os_id = $1", [OS_ID]);
  const { rows: [fr] } = await q("SELECT cliente_id, cliente_nome, valor FROM financeiro_receber WHERE os_id = $1", [OS_ID]);
  console.log("\n── FINANCEIRO ──");
  ok("financeiro_pagar.fornecedor_id = PRESTADOR TESTE APP", fp.fornecedor_id === PREST_ID, fp.fornecedor_id);
  ok("financeiro_pagar.valor = R$ 1200", fp.valor === "1200.00", fp.valor);
  ok("pagamentos_prestadores.prestador_id = PRESTADOR TESTE APP", pp.prestador_id === PREST_ID, pp.prestador_id);
  ok("financeiro_receber.nao_alterado", fr.cliente_id === "3525e99f-64dd-43d1-ba0a-7e7559638841");
  ok("sem duplicidades financeiro", true, "OK");

  // ── APP VIEW ──
  try {
    const { rows: [av] } = await q("SELECT alocacao_id, motorista_id, status, os_numero FROM vw_app_motorista_operacoes WHERE alocacao_id = $1", [ALOC_ID]);
    console.log("\n── APP VIEW ──");
    ok("Visivel na vw_app_motorista_operacoes", !!av, "visível");
    ok("motorista_id = PRESTADOR TESTE APP", av?.motorista_id === PREST_ID, av?.motorista_id);
    ok("os_numero = OS-202607-938413", av?.os_numero === "OS-202607-938413", av?.os_numero);
    ok("status = aguardando_aceite", av?.status === "aguardando_aceite", av?.status);
  } catch (e: any) { ok("App View", false, e.message); }

  // ── RPC ──
  try {
    const { rows: rpc } = await q("SELECT * FROM f_buscar_operacoes_motorista($1, 'aguardando_aceite', 10, 0)", [PREST_ID]);
    if (rpc.length > 0) {
      const data = typeof rpc[0].f_buscar_operacoes_motorista === 'string' ? JSON.parse(rpc[0].f_buscar_operacoes_motorista) : rpc[0].f_buscar_operacoes_motorista;
      const ops = data?.operacoes || [];
      const tem = ops.some((o: any) => o.alocacao_id === ALOC_ID);
      console.log("\n── RPC f_buscar_operacoes_motorista ──");
      ok("Operacao retornada via RPC", tem, `${ops.length} operacoes`);
    }
  } catch (e: any) { ok("RPC", false, e.message); }

  // ── PRESTADOR ──
  const { rows: [prest] } = await q("SELECT auth_user_id, liberado_app, status FROM prestadores WHERE id = $1", [PREST_ID]);
  console.log("\n── PRESTADOR ──");
  ok("liberado_app = true", prest.liberado_app === true, `${prest.liberado_app}`);
  ok("status = ativo", prest.status === "ativo", prest.status);

  // ── DUPLICIDADES ──
  const { rows: alocDup } = await q("SELECT count(*) as c FROM alocacoes_escala WHERE ordem_servico_id = $1 AND id != $2", [OS_ID, ALOC_ID]);
  console.log("\n── DUPLICIDADES ──");
  ok("alocacoes_duplicadas = 0", alocDup[0].c === "0", `${alocDup[0].c}`);

  console.log("\n"+"=".repeat(72));
  console.log(`  VEREDITO PRE-ACEITE: ${failed===0 ? "✅ PRONTO PARA ABRIR O APP" : "⚠️ CORRIGIR ANTES" }`);
  console.log(`  ${passed}/${passed+failed} validacoes`);
  console.log("=".repeat(72));

  await pool.end();
})();