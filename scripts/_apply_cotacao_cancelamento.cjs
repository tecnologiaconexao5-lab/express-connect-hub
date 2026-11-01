/* ============================================================================
 * _apply_cotacao_cancelamento.cjs — aplica a migration de blindagem do pedido
 *
 * Arquivo: supabase/migrations/20261101000000_cotacao_cancelamento_cliente.sql
 *
 * Uso (raiz do repo, com DATABASE_URL no .env):
 *   node scripts\_apply_cotacao_cancelamento.cjs            # DRY-RUN (ROLLBACK)
 *   node scripts\_apply_cotacao_cancelamento.cjs --apply    # COMMIT real
 *
 * Provas (dentro da transacao; qualquer falha => ROLLBACK + exit 1):
 *   P1 CHECK de status inclui 'Cancelada pelo Cliente'
 *   P2 RPC f_cotacao_status_cliente secdef + search_path + grants anon/authenticated
 *   P3 funcional 'aguardando': OS vinculada -> 'rascunho' + histórico/observação
 *   P4 funcional 'cancelada': cotação 'Cancelada pelo Cliente' (+metadata) e OS 'cancelada'
 *   P5 guarda: OS 'finalizada' NÃO é cancelada
 *   P6 guarda: ação inválida retorna success=false
 *   P7 limpeza integral (contagens == baseline)
 * ==========================================================================*/

const fs = require("fs");
const crypto = require("crypto");
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const MIG = "supabase/migrations/20261101000000_cotacao_cancelamento_cliente.sql";

const resultados = [];
function prova(id, nome, ok, detalhe = "") {
  resultados.push({ id, nome, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${id} ${nome}${detalhe ? " — " + detalhe : ""}`);
}
const todosPassaram = () => resultados.every((r) => r.ok);
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex").slice(0, 16);

async function contar(c) {
  const r = await c.query(
    `SELECT (SELECT count(*) FROM public.cotacoes_publicas) AS cot,
            (SELECT count(*) FROM public.orcamentos) AS orc,
            (SELECT count(*) FROM public.ordens_servico) AS os`
  );
  return r.rows[0];
}

async function verificarEstado(c, prefixo) {
  console.log(`\n== ${prefixo} ==`);

  const chk = await c.query(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid='public.cotacoes_publicas'::regclass AND contype='c'
        AND pg_get_constraintdef(oid) ILIKE '%status%'`
  );
  const def = chk.rows.map((r) => r.def).join(" | ");
  const okP1 = def.includes("Cancelada pelo Cliente") && def.includes("Pronto para OS");
  prova("P1", "CHECK de status inclui 'Cancelada pelo Cliente'", okP1, def.slice(0, 120) + "...");

  const f = await c.query(
    `SELECT p.prosecdef AS secdef, p.proconfig, pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='f_cotacao_status_cliente'`
  );
  const fn = f.rows[0];
  const okP2a = !!fn && fn.args === "p_cotacao_id uuid, p_acao text" && fn.secdef;
  const sp = fn && fn.proconfig ? fn.proconfig.join(" | ") : "";
  prova("P2a", "RPC f_cotacao_status_cliente(uuid, text) SECURITY DEFINER", okP2a, fn ? fn.args : "AUSENTE");
  prova("P2b", "search_path fixo (public, pg_temp)", sp.includes("search_path=public, pg_temp"), sp || "(sem proconfig)");

  const g = await c.query(
    `SELECT DISTINCT grantee FROM information_schema.routine_privileges
      WHERE routine_schema='public' AND routine_name='f_cotacao_status_cliente'`
  );
  const gr = g.rows.map((r) => r.grantee);
  prova("P2c", "grants anon+authenticated (sem PUBLIC)", gr.includes("anon") && gr.includes("authenticated") && !gr.includes("PUBLIC"), gr.join(","));
}

async function testeFuncional(c) {
  console.log("\n== teste funcional (na transacao) ==");
  const base = await contar(c);
  console.log(`  baseline: ${JSON.stringify(base)}`);

  const cotId = crypto.randomUUID();
  const orcId = crypto.randomUUID();
  const osId = crypto.randomUUID();

  // Cotação de teste (já 'Pronto para OS' — estado da tela final)
  await c.query(
    `INSERT INTO public.cotacoes_publicas
       (id, status, nome_cliente, telefone, carga_descricao, paradas, detalhes, metadata,
        data_desejada, hora_desejada, created_at, updated_at)
     VALUES ($1, 'Pronto para OS', 'TESTE COTACAO CANCELAMENTO', '11999998888',
             'Carga de teste', $2::jsonb, '[]'::jsonb, '{}'::jsonb,
             '2026-11-05', '09:00 às 11:00', now(), now())`,
    [cotId, JSON.stringify([{ sequencia: 1, tipo: "retirada", endereco: "Rua Teste, 100" }])]
  );

  // Orçamento de teste (vínculo pedido_interno)
  await c.query(
    `INSERT INTO public.orcamentos (id, numero, status, pedido_interno, created_at, updated_at)
     VALUES ($1, $2, 'convertido', $3, now(), now())`,
    [orcId, "ORC-TESTE-" + Date.now(), cotId]
  );

  // OS de teste vinculada ao orçamento
  await c.query(
    `INSERT INTO public.ordens_servico
       (id, numero, data, status, orcamento_id, created_at, updated_at)
     VALUES ($1, $2, CURRENT_DATE, 'pendente', $3, now(), now())`,
    [osId, "OS-TESTE-" + Date.now(), orcId]
  );

  await c.query(`UPDATE public.cotacoes_publicas SET orcamento_id=$1 WHERE id=$2`, [orcId, cotId]);

  // P3 — aguardando
  const ag = await c.query(`SELECT public.f_cotacao_status_cliente($1, 'aguardando') AS r`, [cotId]);
  const agR = ag.rows[0].r;
  const osAfterAg = await c.query(
    `SELECT status, observacoes_gerais, historico FROM public.ordens_servico WHERE id=$1`,
    [osId]
  );
  const osAg = osAfterAg.rows[0];
  const histAg = JSON.stringify(osAg.historico || []);
  const okP3 = agR.success === true && osAg.status === "rascunho"
    && histAg.includes("Aguardando confirmação do cliente via WhatsApp")
    && String(osAg.observacoes_gerais || "").includes("Aguardando confirmação do cliente via WhatsApp");
  prova("P3", "'aguardando' → OS 'rascunho' + marca no histórico/observações", okP3,
    `os=${osAg.status} hist=${histAg.includes("Aguardando")} obs=${String(osAg.observacoes_gerais || "").includes("Aguardando")}`);

  // P4 — cancelada
  const can = await c.query(`SELECT public.f_cotacao_status_cliente($1, 'cancelada') AS r`, [cotId]);
  const canR = can.rows[0].r;
  const cotAfter = await c.query(
    `SELECT status, metadata FROM public.cotacoes_publicas WHERE id=$1`, [cotId]
  );
  const osAfterCan = await c.query(
    `SELECT status, observacoes_gerais, historico FROM public.ordens_servico WHERE id=$1`, [osId]
  );
  const cotC = cotAfter.rows[0];
  const osC = osAfterCan.rows[0];
  const histC = JSON.stringify(osC.historico || []);
  const okP4 = canR.success === true
    && cotC.status === "Cancelada pelo Cliente"
    && cotC.metadata && cotC.metadata.cancelado_pelo_cliente === true
    && osC.status === "cancelada"
    && histC.includes("Cancelada pelo Cliente")
    && String(osC.observacoes_gerais || "").includes("Cancelada pelo Cliente");
  prova("P4", "'cancelada' → cotação 'Cancelada pelo Cliente' + OS 'cancelada'", okP4,
    `cot=${cotC.status} meta=${cotC.metadata && cotC.metadata.cancelado_pelo_cliente} os=${osC.status}`);

  // P5 — OS finalizada NÃO é cancelada
  const cot2 = crypto.randomUUID();
  const orc2 = crypto.randomUUID();
  const os2 = crypto.randomUUID();
  await c.query(
    `INSERT INTO public.cotacoes_publicas
       (id, status, nome_cliente, telefone, carga_descricao, paradas, detalhes, metadata, created_at, updated_at)
     VALUES ($1, 'Pronto para OS', 'TESTE FINALIZADA', '11999997777', 'x', '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, now(), now())`,
    [cot2]
  );
  await c.query(
    `INSERT INTO public.orcamentos (id, numero, status, pedido_interno, created_at, updated_at)
     VALUES ($1, $2, 'convertido', $3, now(), now())`,
    [orc2, "ORC-TESTE-FIN-" + Date.now(), cot2]
  );
  await c.query(
    `INSERT INTO public.ordens_servico (id, numero, data, status, orcamento_id, created_at, updated_at)
     VALUES ($1, $2, CURRENT_DATE, 'finalizada', $3, now(), now())`,
    [os2, "OS-TESTE-FIN-" + Date.now(), orc2]
  );
  await c.query(`UPDATE public.cotacoes_publicas SET orcamento_id=$1 WHERE id=$2`, [orc2, cot2]);
  await c.query(`SELECT public.f_cotacao_status_cliente($1, 'cancelada')`, [cot2]);
  const os2After = await c.query(`SELECT status FROM public.ordens_servico WHERE id=$1`, [os2]);
  prova("P5", "guarda: OS 'finalizada' permanece finalizada", os2After.rows[0].status === "finalizada", os2After.rows[0].status);

  // P6 — ação inválida
  const inv = await c.query(`SELECT public.f_cotacao_status_cliente($1, 'apagar') AS r`, [cotId]);
  prova("P6", "guarda: ação inválida => success=false", inv.rows[0].r.success === false, JSON.stringify(inv.rows[0].r).slice(0, 80));

  // P7 — limpeza
  await c.query(`DELETE FROM public.ordens_servico WHERE id = ANY($1::uuid[])`, [[osId, os2]]);
  await c.query(`DELETE FROM public.orcamentos WHERE id = ANY($1::uuid[])`, [[orcId, orc2]]);
  await c.query(`DELETE FROM public.cotacoes_publicas WHERE id = ANY($1::uuid[])`, [[cotId, cot2]]);

  const dep = await contar(c);
  const okP7 = dep.cot === base.cot && dep.orc === base.orc && dep.os === base.os;
  prova("P7", "limpeza integral (contagens == baseline)", okP7, `${JSON.stringify(base)} -> ${JSON.stringify(dep)}`);
}

(async () => {
  console.log(`_apply_cotacao_cancelamento.cjs — modo: ${APPLY ? "APPLY (COMMIT)" : "DRY-RUN (ROLLBACK)"}`);
  const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
  const sql = fs.readFileSync(MIG, "utf8");
  console.log(`\n== arquivo ==\n  ${MIG} sha256:${sha(sql)} ${sql.length} chars`);

  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // pre-flight: já aplicado?
  const ja = await c.query(
    `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='f_cotacao_status_cliente'`
  );
  const jaCheck = await c.query(
    `SELECT 1 FROM pg_constraint
      WHERE conrelid='public.cotacoes_publicas'::regclass AND contype='c'
        AND pg_get_constraintdef(oid) ILIKE '%Cancelada pelo Cliente%'`
  );
  if (ja.rows.length && jaCheck.rows.length) {
    console.log("\n== JA APLICADO — apenas verificacao ==");
    await verificarEstado(c, "estado atual");
    await c.end();
    const ok = todosPassaram();
    console.log(ok ? "\nJA APLICADO + provas PASS" : "\nJA APLICADO mas provas FALHARAM");
    process.exit(ok ? 0 : 1);
  }

  console.log("\n== transacao ==");
  await c.query("BEGIN");
  try {
    console.log(`  executando ${MIG}...`);
    await c.query(sql);
    console.log("  ok");

    await verificarEstado(c, "provas na transacao");
    await testeFuncional(c);

    if (!todosPassaram()) throw new Error("falha nas provas");

    if (APPLY) {
      await c.query("COMMIT");
      console.log("\n*** COMMIT REALIZADO ***");
    } else {
      await c.query("ROLLBACK");
      console.log("\nDRY-RUN OK — tudo revertido (ROLLBACK). Use --apply para efetivar.");
    }
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("\nERRO -> ROLLBACK:", e.message);
    for (const r of resultados.filter((x) => !x.ok)) console.error(`  FALHOU: ${r.id} ${r.nome}`);
    await c.end();
    process.exit(1);
  }

  if (APPLY) {
    resultados.length = 0;
    await verificarEstado(c, "verificacao pos-COMMIT");
    const dep = await contar(c);
    console.log("\n== contagens finais ==\n  " + JSON.stringify(dep));
    if (!todosPassaram()) {
      await c.end();
      console.error("\nPOS-COMMIT: provas FALHARAM — INVESTIGAR");
      process.exit(1);
    }
  }

  console.log(`\nResultado: ${resultados.filter((r) => r.ok).length}/${resultados.length} provas PASS`);
  await c.end();
})().catch((e) => { console.error("ERRO FATAL:", e.message); process.exit(2); });
