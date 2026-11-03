/* Gera a migration da sequência oficial de OS a partir das funções vivas no banco.
 * Saída: supabase/migrations/20261102000000_os_numero_sequencial.sql
 * Uso: node scripts/_gen_os_numero_migration.cjs
 */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const DESTINO = "supabase/migrations/20261102000000_os_numero_sequencial.sql";

const aplicarNumeroSequencial = (def, fn) => {
  let texto = def;

  if (fn === "f_cotacao_detalhes_para_os") {
    const marca = texto.indexOf("-- NÚMERO DA OS");
    if (marca < 0) throw new Error("marcador 'NÚMERO DA OS' não encontrado");
    const inicio = texto.indexOf("LOOP", marca);
    const fim = texto.indexOf("END LOOP;", inicio);
    if (inicio < 0 || fim < 0) throw new Error("bloco LOOP não encontrado");
    texto =
      texto.slice(0, inicio) +
      "v_os_numero := public.f_proximo_numero_os();" +
      texto.slice(fim + "END LOOP;".length);
  } else {
    const inicio = texto.indexOf("v_os_numero := format(");
    if (inicio < 0) throw new Error("bloco format() não encontrado");
    const fim = texto.indexOf("\n  );", inicio);
    if (fim < 0) throw new Error("fechamento do format() não encontrado");
    texto =
      texto.slice(0, inicio) +
      "v_os_numero := public.f_proximo_numero_os();" +
      texto.slice(fim + "\n  );".length);
  }

  if (!texto.includes("f_proximo_numero_os()")) throw new Error("substituição falhou");
  const padraoAntigo =
    fn === "f_cotacao_detalhes_para_os"
      ? "(floor(random() * 900000) + 100000)::int::text"
      : "LPAD(floor(random() * 900000 + 100000)::TEXT";
  if (texto.includes(padraoAntigo)) throw new Error("geração aleatória de OS ainda presente");
  const ddl = texto.trim();
  return ddl.endsWith(";") ? ddl : `${ddl};`;
};

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const defs = {};
  for (const fn of ["f_cotacao_detalhes_para_os", "converter_pedido_para_os"]) {
    const r = await c.query(
      `SELECT pg_get_functiondef(p.oid) AS def
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.proname=$1`,
      [fn]
    );
    if (!r.rows.length) throw new Error(`função ausente: ${fn}`);
    defs[fn] = aplicarNumeroSequencial(r.rows[0].def, fn);
  }
  await c.end();

  const sql = `-- ============================================================================
-- SEQUÊNCIA OFICIAL DO NÚMERO DA OS — OS-AAAAMM-1200, 1201, ...
-- Data: 2026-11-02
-- Alvo: Supabase do TMS (uwrvzsjtpgaifkktpepn)
--
-- 1) Cria a sequence public.os_numero_seq começando em 1200.
-- 2) Cria f_proximo_numero_os() → "OS-" || AAAAMM || "-" || sequência.
-- 3) Substitui a geração ALEATÓRIA de número em:
--      • f_cotacao_detalhes_para_os (Cotação Express → OS)
--      • converter_pedido_para_os   (Portal do Cliente → OS)
--    Ambas passam a usar a sequência (sem colisão e sem buracos aleatórios).
--
-- Reaplicar é seguro (CREATE SEQUENCE IF NOT EXISTS + CREATE OR REPLACE).
-- Para reiniciar a numeração: ALTER SEQUENCE public.os_numero_seq RESTART WITH 1200;
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.os_numero_seq
  AS bigint
  START WITH 1200
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE OR REPLACE FUNCTION public.f_proximo_numero_os()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 'OS-' ||
         to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYYMM') ||
         '-' ||
         lpad(nextval('public.os_numero_seq')::text, 4, '0');
$$;

REVOKE ALL ON FUNCTION public.f_proximo_numero_os() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_proximo_numero_os() TO authenticated;

-- ---------------------------------------------------------------------------
-- f_cotacao_detalhes_para_os — usa a sequência oficial
-- ---------------------------------------------------------------------------
${defs["f_cotacao_detalhes_para_os"].trim()}

-- ---------------------------------------------------------------------------
-- converter_pedido_para_os — usa a sequência oficial
-- ---------------------------------------------------------------------------
${defs["converter_pedido_para_os"].trim()}

NOTIFY pgrst, 'reload schema';
`;

  fs.writeFileSync(DESTINO, sql, "utf8");
  console.log(`OK -> ${DESTINO} (${sql.length} chars)`);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(2);
});
