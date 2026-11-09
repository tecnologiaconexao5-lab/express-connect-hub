// ============================================================
// Aplica supabase/migrations/20261109040000_os_obs_limpas_distancia.sql
// (limpa observações da cotação + preenche distancia_km da OS).
//
// Uso:
//   node scripts/_apply_os_obs_limpas_distancia.cjs            (dry-run)
//   node scripts/_apply_os_obs_limpas_distancia.cjs --apply    (COMMIT)
//   node scripts/_apply_os_obs_limpas_distancia.cjs --check    (read-only)
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261109040000_os_obs_limpas_distancia.sql",
);
const APPLY = process.argv.includes("--apply");
const CHECK_ONLY = process.argv.includes("--check");

function carregarDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(env)) return null;
  const linha = fs
    .readFileSync(env, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!linha) return null;
  return linha.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const checks = [];
const registrar = (ok, rotulo, detalhe = "") => {
  checks.push({ ok, rotulo, detalhe });
  console.log(`${ok ? "  OK " : "FAIL "} ${rotulo}${detalhe ? ` — ${detalhe}` : ""}`);
};

async function provar(client) {
  const { rows: trg } = await client.query(
    `SELECT tgname FROM pg_trigger
      WHERE tgrelid='public.ordens_servico'::regclass AND tgname='trg_os_normalizar_cotacao'`,
  );
  registrar(trg.length > 0, "trigger trg_os_normalizar_cotacao existe");

  const { rows: def } = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p
       JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='f_trg_os_normalizar_cotacao' LIMIT 1`,
  );
  const corpo = String(def[0]?.d || "");
  registrar(
    corpo.includes("Cotação web (Fase 2)") &&
      corpo.includes("Coleta agendada") &&
      corpo.includes("distancia_km") &&
      corpo.includes("Aguardando confirmação"),
    "função limpa cotação + preenche distância",
  );

  // Prova funcional: cotação + orçamento + OS com lixo e 0 km.
  const sufixo = Date.now().toString(36).toUpperCase();
  const { rows: cot } = await client.query(
    `INSERT INTO public.cotacoes_publicas
       (status, nome_cliente, telefone, carga_descricao, carga_peso, paradas, detalhes, metadata)
     VALUES ('Pronto para OS','TESTE OBS','11999998888','Teste',1,'[]'::jsonb,'[]'::jsonb,
             jsonb_build_object('precificacao', jsonb_build_object('distancia_km', 22.6)))
     RETURNING id`,
  );
  const cotacaoId = cot[0].id;

  const { rows: orc } = await client.query(
    `INSERT INTO public.orcamentos
       (numero, cliente, cliente_id, unidade, data_emissao, status, pedido_interno, observacoes_gerais)
     VALUES ($1,'TESTE OBS',NULL,'São Paulo - Matriz', current_date, 'em_analise', $2, 'teste')
     RETURNING id`,
    [`ORC-TESTE-OBS-${sufixo}`, String(cotacaoId)],
  );
  const orcamentoId = orc[0].id;

  const { rows: os } = await client.query(
    `INSERT INTO public.ordens_servico
       (numero, cliente, status, observacoes_gerais, carga, distancia_km, orcamento_id)
     VALUES ($1, NULL, 'em_analise',
             'Cotação web (Fase 2) — cliente Teste · WhatsApp: 11999998888 · Valor aprovado: R$ 100,00 · Distância estimada: 22.6 km · Data desejada: 12/11/2026 · Horário: 08:00 às 10:00 · ID da cotação: x | Aguardando confirmação do cliente via WhatsApp',
             '{}'::jsonb, 0, $2)
     RETURNING id, observacoes_gerais, distancia_km, carga`,
    [`OS-TESTE-OBS-${sufixo}`, orcamentoId],
  );

  const linha = os[0];
  registrar(
    Number(linha.distancia_km) === 22.6,
    "OS recebe distancia_km da precificação da cotação",
    String(linha.distancia_km),
  );
  registrar(
    Number(linha.carga?.distancia_km) === 22.6,
    "carga.distancia_km preenchido",
    String(linha.carga?.distancia_km),
  );
  registrar(
    !String(linha.observacoes_gerais || "").includes("Cotação web") &&
      String(linha.observacoes_gerais || "").includes("Coleta agendada: 12/11/2026") &&
      String(linha.observacoes_gerais || "").includes("Horário: 08:00 às 10:00"),
    "observações limpas (só agenda)",
    String(linha.observacoes_gerais),
  );

  // Limpeza dos registros de prova (rollback também cobriria).
  await client.query(`DELETE FROM public.ordens_servico WHERE id=$1`, [linha.id]);
  await client.query(`DELETE FROM public.orcamentos WHERE id=$1`, [orcamentoId]);
  await client.query(`DELETE FROM public.cotacoes_publicas WHERE id=$1`, [cotacaoId]);
}

async function main() {
  const connStr = carregarDatabaseUrl();
  if (!connStr) {
    console.error("DATABASE_URL ausente (env ou .env). Abortado.");
    process.exit(1);
  }
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    if (CHECK_ONLY) {
      console.log("[--check] estado atual (nada será alterado):");
      await provar(client);
      const falhas = checks.filter((c) => !c.ok);
      await client.end();
      process.exit(falhas.length ? 1 : 0);
    }

    await client.query("BEGIN");
    console.log("SQL executado dentro da transação (ainda não commitado).");
    await client.query(sql);

    console.log("\n[provas]");
    await provar(client);

    const falhas = checks.filter((c) => !c.ok);
    if (falhas.length) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`\nFALHOU: ${falhas.length}/${checks.length} — ROLLBACK.`);
      process.exit(1);
    }

    console.log(`\nPROVA COMPLETA: ${checks.length}/${checks.length} verificações OK.`);
    if (APPLY) {
      await client.query("COMMIT");
      console.log("COMMIT realizado — trigger + backfill aplicados.");
    } else {
      await client.query("ROLLBACK");
      console.log("(dry-run) ROLLBACK — nada persistido. Use --apply.");
    }
  } catch (err) {
    console.error("ERRO:", err.message);
    await client.query("ROLLBACK").catch(() => {});
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
