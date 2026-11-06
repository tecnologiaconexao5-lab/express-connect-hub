/* PROVA FUNCIONAL read-only: f_cotacao_detalhes_para_os com id inexistente
   → deve retornar COTACAO_NAO_ENCONTRADA sem criar/alterar NADA. */
const fs = require("fs");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(
    `SELECT public.f_cotacao_detalhes_para_os('00000000-0000-0000-0000-0000000000ff') AS out`,
  );
  const out = r.rows[0].out;
  console.log("retorno:", JSON.stringify(out));
  const ok = out && out.success === false && out.error_code === "COTACAO_NAO_ENCONTRADA";
  console.log(ok ? "[OK] funcao roda sem erro de runtime (guard COTACAO_NAO_ENCONTRADA)" : "[FAIL] retorno inesperado");
  // prova de nao-criacao: contagens devem permanecer estaveis para esse id fantasma
  const n = await c.query(
    `SELECT (SELECT count(*) FROM public.cotacoes_publicas WHERE id='00000000-0000-0000-0000-0000000000ff') AS cot,
            (SELECT count(*) FROM public.orcamentos WHERE pedido_interno='00000000-0000-0000-0000-0000000000ff') AS orc`,
  );
  console.log(`registos fantasma: cotacoes=${n.rows[0].cot} orcamentos=${n.rows[0].orc} (esperado 0/0)`);
  await c.end();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
