/* ============================================================================
 * _apply_portal_multiparadas.cjs — Onda 2 (multi-paradas na conversão)
 *
 * Uso (raiz do repo, DATABASE_URL no .env):
 *   node scripts\_apply_portal_multiparadas.cjs            # DRY-RUN (ROLLBACK)
 *   node scripts\_apply_portal_multiparadas.cjs --apply    # COMMIT real
 *
 * Fluxo:
 *   1. Aplica 20261126000001_portal_multiparadas_e_lotes.sql em transação
 *   2. Teste funcional em SAVEPOINT: pedido com metadata.paradas e
 *      coleta_cidade/entrega_cidade NULL deve converter (3 paradas),
 *      consolidar volumes=3, peso=15 e cubagem>0
 *   3. Rollback do teste + restauração da sequence os_numero_seq
 *   4. COMMIT somente se tudo passar
 * ==========================================================================*/
const fs = require("fs");
const crypto = require("crypto");
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const MIG = "supabase/migrations/20261126000001_portal_multiparadas_e_lotes.sql";

function url() {
  const m = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL ausente no .env");
  return m[1].trim();
}

const provas = [];
function prova(id, nome, ok, detalhe = "") {
  provas.push({ id, nome, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${id} ${nome}${detalhe ? " :: " + detalhe : ""}`);
}

async function main() {
  const raw = fs.readFileSync(MIG, "utf8");
  const sql = raw.replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "");
  const c = new Client({ connectionString: url(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  let aplicado = false;

  try {
    console.log(`\n== MIGRATION ==\n  ${MIG} (${raw.length} bytes)\n`);
    await c.query("BEGIN");
    aplicado = true;
    await c.query(sql);

    const fn = await c.query(
      `SELECT p.prosecdef AS secdef, pg_get_function_identity_arguments(p.oid) AS args
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.proname='_converter_pedido_para_os_base'`,
    );
    const row = fn.rows[0];
    prova("M1", "função base existe SECURITY DEFINER (uuid,uuid)", !!row && row.secdef && row.args === "p_pedido_id uuid, p_operador_id uuid", row?.args || "ausente");

    const seqBefore = (
      await c.query(`SELECT last_value, is_called FROM public.os_numero_seq`)
    ).rows[0];

    const cliente = (
      await c.query(`SELECT id::text AS id FROM public.clientes LIMIT 1`)
    ).rows[0];
    prova("T0", "cliente de teste disponível", !!cliente, cliente?.id || "ausente");
    if (!cliente) throw new Error("sem cliente para o teste funcional");

    await c.query("SAVEPOINT test");
    let testOk = false;
    try {
      const pedidoId = crypto.randomUUID();
      const metadata = {
        preco_estimado: 123.45,
        paradas: [
          { tipo: "coleta", cidade: "São Paulo", uf: "SP", cep: "01001000", logradouro: "Rua A", numero: "1", volumes: 0, peso_kg: 0 },
          { tipo: "entrega", cidade: "São Paulo", uf: "SP", cep: "02002000", logradouro: "Rua B", numero: "2", volumes: 2, peso_kg: 10, comprimento_cm: 40, largura_cm: 30, altura_cm: 30 },
          { tipo: "entrega", cidade: "Guarulhos", uf: "SP", cep: "07000000", logradouro: "Rua C", numero: "3", volumes: 1, peso_kg: 5, cubagem_m3: 0.05 },
        ],
        totais: { volumes: 3, peso_kg: 15, cubagem_m3: 0.12 },
      };

      await c.query("ALTER TABLE public.portal_pedidos DISABLE TRIGGER USER");
      await c.query("ALTER TABLE public.ordens_servico DISABLE TRIGGER USER");
      await c.query(
        `INSERT INTO public.portal_pedidos
           (id, cliente_id, numero_pedido, status, coleta_cidade, coleta_uf, entrega_cidade, entrega_uf,
            descricao, peso, volumes, tipo_carga, metadata, created_at, updated_at)
         VALUES ($1,$2::uuid,$3,'enviado',NULL,NULL,NULL,NULL,'TESTE ONDA 2',0,0,'seca',$4::jsonb,now(),now())`,
        [pedidoId, cliente.id, `MP-TEST-${pedidoId.slice(0, 8)}`, JSON.stringify(metadata)],
      );

      const r = (await c.query(`SELECT public._converter_pedido_para_os_base($1::uuid, NULL) AS r`, [pedidoId])).rows[0].r;
      const osId = r?.ordem_servico_id;
      prova("T1", "converte lote com paradas e cidades legadas NULL", !!r?.success && !!osId, JSON.stringify(r));

      if (osId) {
        const os = (
          await c.query(
            `SELECT jsonb_array_length(enderecos) AS paradas, volumes, peso, cubagem, destino
               FROM public.ordens_servico WHERE id=$1`,
            [osId],
          )
        ).rows[0];
        prova("T2", "3 endereços gravados na OS", Number(os.paradas) === 3, `paradas=${os.paradas}`);
        prova("T3", "volumes consolidados = 3", Number(os.volumes) === 3, `volumes=${os.volumes}`);
        prova("T4", "peso consolidado = 15", Number(os.peso) === 15, `peso=${os.peso}`);
        prova("T5", "cubagem consolidada > 0", Number(os.cubagem) > 0, `cubagem=${os.cubagem}`);
        prova("T6", "destino preenchido", !!os.destino, String(os.destino));
      }

      testOk = provas.filter((p) => p.id.startsWith("T")).every((p) => p.ok);
    } catch (e) {
      console.error("  [FAIL] teste funcional:", e.message);
      testOk = false;
    } finally {
      await c.query("ROLLBACK TO SAVEPOINT test").catch(() => {});
      await c.query("RELEASE SAVEPOINT test").catch(() => {});
      // nextval() não é transacional: restaura a sequence consumida pelo teste.
      await c.query(`SELECT setval('public.os_numero_seq', $1, $2)`, [seqBefore.last_value, seqBefore.is_called]);
    }

    if (!testOk) throw new Error("provas do teste funcional falharam");

    if (APPLY) {
      await c.query("COMMIT");
      aplicado = false;
      console.log("\n== COMMIT == migration aplicada em produção");
      const pos = await c.query(
        `SELECT p.prosecdef AS secdef, pg_get_function_identity_arguments(p.oid) AS args
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.proname='_converter_pedido_para_os_base'`,
      );
      console.log(`  pós-commit: ${JSON.stringify(pos.rows[0])}`);
    } else {
      await c.query("ROLLBACK");
      console.log("\n== ROLLBACK == dry-run concluído (nada persistido)");
    }
  } catch (e) {
    console.error("\nERRO:", e.message);
    try {
      if (aplicado) await c.query("ROLLBACK");
    } catch {}
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main();
