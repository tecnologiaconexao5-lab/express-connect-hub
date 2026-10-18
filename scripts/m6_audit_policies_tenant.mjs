import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

const env = readFileSync(resolve(import.meta.dirname, "..", ".env"), "utf8");
let connStr = "";
for (const line of env.split("\n")) {
  const t = line.trim();
  if (t.startsWith("DATABASE_URL=")) connStr = t.substring("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
}

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // Get ALL policies on ALL M6 tables with full details
  const tables = [
    'financeiro_receber','financeiro_pagar','composicao_financeira_os',
    'crm_leads','crm_conversas','crm_mensagens',
    'crm_historico','crm_followups','crm_templates_mensagem',
    'crm_interacoes_prestadores',
    'prestadores','veiculos',
    'fiscal_ctes','fiscal_nfse','fiscal_mdfes',
    'contratos_gerados','contratos_modelos','contratos_historico',
    'tabelas_valores',
    'orcamentos','historico_alocacoes_escala','operacao_localizacao',
    'integracoes_logs','usuarios_cliente'
  ];

  console.log("=== POLICIES ATUAIS NAS 27 TABELAS DA M6 ===");
  console.log("");
  
  let totalPolicies = 0;
  let totalAnon = 0;
  let totalUsingTrue = 0;

  for (const tbl of tables) {
    const exists = await client.query(
      "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1) AS ok", [tbl]
    );
    if (!exists.rows[0].ok) {
      console.log(`[${tbl}] — TABELA NAO EXISTE`);
      console.log("");
      continue;
    }

    const r = await client.query(`
      SELECT policyname, roles, cmd, qual, with_check, permissive
      FROM pg_policies WHERE tablename = $1 ORDER BY cmd, policyname
    `, [tbl]);

    if (r.rows.length === 0) {
      console.log(`[${tbl}] — 0 policies (RLS pode estar desligado)`);
      console.log("");
      continue;
    }

    const rlsEnabled = await client.query(
      "SELECT relrowsecurity FROM pg_class WHERE relname=$1 AND relnamespace='public'::regnamespace", [tbl]
    );

    totalPolicies += r.rows.length;
    console.log(`[${tbl}] (RLS=${rlsEnabled.rows[0]?.relrowsecurity}) — ${r.rows.length} policies:`);
    
    for (const p of r.rows) {
      const roles = Array.isArray(p.roles) ? p.roles.join(",") : String(p.roles || "");
      const isAnon = roles.includes("anon") || roles.includes("public");
      const qual = (p.qual || "").replace(/\s+/g, " ").trim();
      const wc = (p.with_check || "").replace(/\s+/g, " ").trim();
      const hasUsingTrue = qual === "true" || wc === "true";
      
      if (isAnon) totalAnon++;
      if (hasUsingTrue) totalUsingTrue++;

      const anonMark = isAnon ? " ⚠️ ANON" : "";
      const trueMark = hasUsingTrue ? " ⚠️ TRUE" : "";
      const usesTenant = qual.includes("tenant_id") || wc.includes("tenant_id");
      const tenantMark = usesTenant ? " [tenant_id]" : "";
      
      console.log(
        `    ${p.cmd.padEnd(6)} ${p.policyname.padEnd(35)} roles=[${roles.padEnd(20)}]${anonMark}${trueMark}${tenantMark}`
      );
    }
    console.log("");
  }

  console.log("=".repeat(80));
  console.log(`TOTAL: ${totalPolicies} policies, ${totalAnon} anon/public, ${totalUsingTrue} USING(true)`);

  // Check if any existing policy actually references tenant_id on these tables
  console.log("\n=== VERIFICANDO POLICIES EXISTENTES QUE REFERENCIAM tenant_id ===");
  const tenantPols = await client.query(`
    SELECT tablename, policyname, qual
    FROM pg_policies
    WHERE (qual LIKE '%tenant_id%' OR with_check LIKE '%tenant_id%')
      AND schemaname = 'public'
  `);
  if (tenantPols.rows.length === 0) {
    console.log("NENHUMA policy existente referencia tenant_id.");
  } else {
    for (const p of tenantPols.rows) {
      console.log(`  ${p.tablename}.${p.policyname}`);
    }
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
