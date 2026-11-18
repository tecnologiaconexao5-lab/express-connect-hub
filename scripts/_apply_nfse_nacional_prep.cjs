// ============================================================
// Aplica supabase/migrations/20261117000000_nfse_nacional_prep.sql
// (Storage de certificados + extensão de certificados_fiscais +
//  matriz em configuracoes_fiscais + regra nacional em regras_fiscais_nfse)
//
// Uso:
//   node scripts/_apply_nfse_nacional_prep.cjs            (dry-run: prova + ROLLBACK)
//   node scripts/_apply_nfse_nacional_prep.cjs --apply    (COMMIT)
//   node scripts/_apply_nfse_nacional_prep.cjs --check    (read-only)
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261117000000_nfse_nacional_prep.sql",
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
  // 1) Bucket privado
  const { rows: bk } = await client.query(
    `SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'certificados-fiscais'`,
  );
  registrar(Boolean(bk[0]), "bucket privado certificados-fiscais existe");
  if (bk[0]) {
    registrar(bk[0].public === false, "bucket é privado (public=false)");
    registrar(Number(bk[0].file_size_limit) === 10485760, "limite 10 MB aplicado");
  }

  // 2) Policies de storage
  const { rows: pols } = await client.query(
    `SELECT policyname, cmd FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname LIKE 'certificados_fiscais_%'
      ORDER BY policyname`,
  );
  const cmds = new Set(pols.map((p) => p.cmd));
  registrar(
    pols.length === 4 && ["SELECT", "INSERT", "UPDATE", "DELETE"].every((c) => cmds.has(c)),
    "4 policies de storage (SELECT/INSERT/UPDATE/DELETE) para o bucket",
    pols.map((p) => `${p.policyname}:${p.cmd}`).join(", "),
  );

  // 3) Colunas novas em certificados_fiscais
  const { rows: certCols } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'certificados_fiscais'
        AND column_name IN ('validade_inicio','validade_fim','senha_hash','metadata')`,
  );
  const nomes = new Set(certCols.map((c) => c.column_name));
  registrar(
    ["validade_inicio", "validade_fim", "senha_hash", "metadata"].every((c) => nomes.has(c)),
    "certificados_fiscais estendida (validade_inicio/validade_fim/senha_hash/metadata)",
    [...nomes].join(", "),
  );

  // 4) Matriz
  const { rows: cf } = await client.query(
    `SELECT id, razao_social, ie, inscricao_municipal, codigo_ibge, cidade, uf,
            regime_tributario, crt, ativo, padrao,
            metadata -> 'nfse_nacional' AS nfse_nacional
       FROM public.configuracoes_fiscais
      WHERE regexp_replace(coalesce(cnpj, ''), '\\D', '', 'g') = '31227975000180'
      ORDER BY created_at LIMIT 1`,
  );
  const matriz = cf[0];
  registrar(Boolean(matriz), "matriz CNPJ 31.227.975/0001-80 cadastrada");
  if (matriz) {
    registrar(matriz.razao_social === "CONEXAO TRANSPORTES LTDA", "razão social = CONEXAO TRANSPORTES LTDA", String(matriz.razao_social));
    registrar(String(matriz.ie) === "119836105110", "IE = 119836105110", String(matriz.ie));
    registrar(String(matriz.inscricao_municipal) === "60458216", "IM = 60458216", String(matriz.inscricao_municipal));
    registrar(String(matriz.codigo_ibge) === "3550308", "município IBGE = 3550308", String(matriz.codigo_ibge));
    registrar(matriz.regime_tributario === "Simples Nacional (ME)", "regime = Simples Nacional (ME)", String(matriz.regime_tributario));
    registrar(String(matriz.crt) === "1", "crt = 1 (Simples Nacional)", String(matriz.crt));
    registrar(matriz.ativo === true, "matriz ativa");
    registrar(matriz.padrao === false, "matriz NÃO é o emitente padrão (padrão preservado)");
    registrar(Boolean(matriz.nfse_nacional), "metadata.nfse_nacional preenchido");
  }

  const { rows: qtdPadrao } = await client.query(
    `SELECT count(*)::int AS total FROM public.configuracoes_fiscais WHERE padrao = true`,
  );
  registrar(qtdPadrao[0].total === 1, "existe exatamente 1 emitente padrão", `total=${qtdPadrao[0].total}`);

  const { rows: padrao } = await client.query(
    `SELECT regexp_replace(coalesce(cnpj, ''), '\\D', '', 'g') AS cnpj_digitos
       FROM public.configuracoes_fiscais WHERE padrao = true LIMIT 1`,
  );
  registrar(
    Boolean(padrao[0]) && padrao[0].cnpj_digitos !== "31227975000180",
    "emitente padrão anterior preservado (não é a matriz)",
    padrao[0] ? padrao[0].cnpj_digitos : "nenhum",
  );

  // 5) Regra nacional
  const { rows: regra } = await client.query(
    `SELECT id, emitente_id, municipio_prestacao, uf, codigo_servico, descricao_servico,
            aliquota_iss, iss_retido, ativo, metadata
       FROM public.regras_fiscais_nfse
      WHERE municipio_prestacao = '3550308'
        AND codigo_servico = '16.02.01.002'
      ORDER BY created_at LIMIT 1`,
  );
  const r = regra[0];
  registrar(Boolean(r), "regra fiscal NFS-e nacional cadastrada (3550308 / 16.02.01.002)");
  if (r) {
    registrar(r.descricao_servico === "Transporte de bens ou valores", "descrição = Transporte de bens ou valores");
    registrar(Number(r.aliquota_iss) === 0, "alíquota ISS = 0", String(r.aliquota_iss));
    registrar(r.iss_retido === false, "ISS não retido");
    registrar(r.uf === "SP", "UF = SP");
    registrar(r.ativo === true, "regra ativa");
    registrar(Boolean(r.emitente_id), "regra vinculada ao emitente (emitente_id)");
    registrar(r.metadata && r.metadata.origem === "nfse_nacional", "metadata.origem = nfse_nacional");
  }
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
    console.log("Executando migration dentro da transação (ainda não commitado)...");
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
      console.log("COMMIT realizado — NFS-e Nacional preparada.");
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
