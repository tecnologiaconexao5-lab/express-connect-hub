/* READ-ONLY: pipeline (recrutamento_candidatos.stage) + preferências + avaliação situacional */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let fail = 0;

  // Etapa 3 — pipeline (funil de etapas do candidato)
  const col = await c.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='recrutamento_candidatos'
       AND column_name IN ('stage','status','etapa','funil_etapa')`,
  );
  const cols = col.rows.map((r) => r.column_name);
  console.log("[pipeline] colunas de etapa em recrutamento_candidatos:", cols.join(", ") || "(NENHUMA)");
  if (cols.length === 0) fail++;

  // Etapa 4 — preferências operacionais (perfil talento)
  const pref = await c.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='prestador_perfil_talento'
       AND column_name IN ('restricoes_operacionais','modalidade_preferencial','distancia_max_coleta_km','aceita_viagens')
     ORDER BY column_name`,
  );
  console.log("[preferências] colunas em prestador_perfil_talento:", pref.rows.map((r) => r.column_name).join(", ") || "(NENHUMA)");
  if (pref.rowCount < 4) fail++;

  // Etapa 5 — avaliação situacional (cenários + avaliações)
  const av = await c.query(
    `SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('recrutamento_cenarios','recrutamento_avaliacoes')) AS tabelas,
            (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='recrutamento_avaliacoes' AND column_name IN ('competencia','pontuacao','cenario_titulo')) AS cols_av`,
  );
  console.log(`[avaliação situacional] tabelas cenarios+avaliacoes=${av.rows[0].tabelas}/2, cols competencia/pontuacao/cenario_titulo=${av.rows[0].cols_av}/3`);
  if (Number(av.rows[0].tabelas) < 2 || Number(av.rows[0].cols_av) < 3) fail++;

  console.log(`\nRESUMO: ${fail === 0 ? "ETAPAS 3+4+5 COMPLETAS EM PRODUÇÃO" : fail + " lacuna(s)"}`);
  await c.end();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
