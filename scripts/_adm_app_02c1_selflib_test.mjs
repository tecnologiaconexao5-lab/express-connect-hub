// ADM-APP-02C.1 — PROVA de self-liberation.
// Somente transacoes COM ROLLBACK. Nada persistido. Registro TESTE identificado.
import pg from "pg";
import fs from "node:fs";

const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await client.connect();

const log = [];
const registro = (k, v) => { log.push({ [k]: v }); };

// Linhas TESTE identificadas (prestadores com auth_user_id e liberado_app=false)
const ALVO_LIGERACAO = "0b55f471-b8eb-419a-bda1-567ec3b37a39"; // "teste 2"
const ALVO_STATUS    = "e9d43079-3d14-4083-b33e-f50174b6e663"; // "REC06 E2E Real Teste"
const ALVO_CAMPOS    = "b7f86dbb-c40e-4181-ba61-eaa078a2d4e3"; // "TESTECOREAPP01k"
const ALVO_NAO_PROPRIO = "e6646799-fbac-453e-a3ef-afdfc01a7085"; // "PRESTADOR TESTE APP" (outro usuario)
const UID = "47da030a-a536-4046-8f0f-e4878948b94e"; // auth_user_id de ALVO_LIGERACAO

const estadoAntes = async () => (await client.query(
  `select id, nome_completo, status, liberado_app, auth_user_id,
          cpf_cnpj, data_aprovacao, status_operacional, score_interno,
          ultimo_usuario, origem_cadastro, metadata, observacoes
     from prestadores
    where id = any($1::uuid[]) order by id`,
  [[ALVO_LIGERACAO, ALVO_STATUS, ALVO_CAMPOS, ALVO_NAO_PROPRIO]])).rows;

const montarClaims = (uid) => JSON.stringify({ sub: uid, role: "authenticated", iss: "supabase" });

const entrarComoPrestador = async (uid) => {
  await client.query("SET LOCAL ROLE authenticated");
  await client.query("select set_config('request.jwt.claims', $1, true)", [montarClaims(uid)]);
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  const r = await client.query(`select auth.uid() as uid, auth.role() as role`);
  return r.rows[0];
};

const teste = async (nome, fn) => {
  try {
    await client.query("BEGIN");
    const detalhe = await fn();
    await client.query("ROLLBACK");
    registro(nome, { executado: true, rollback: true, ...detalhe });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    registro(nome, { executado: false, rollback: true, erro: e.message, sqlstate: e.code });
  }
};

const antes = await estadoAntes();
registro("estado_antes", antes);

// ── T1: prova Q1 — liberado_app false -> true ──────────────────────────────
await teste("T1_self_liberacao_liberado_app", async () => {
  const who = await entrarComoPrestador(UID);
  const upd = await client.query(
    `update prestadores set liberado_app = true where id = $1`, [ALVO_LIGERACAO]);
  const ve = await client.query(
    `select liberado_app, status from prestadores where id = $1`, [ALVO_LIGERACAO]);
  const visiveis = await client.query(`select count(*)::int n from prestadores`);
  return { auth_uid: who.uid, auth_role: who.role, linhas_afetadas: upd.rowCount,
           valor_dentro_da_transacao: ve.rows[0],
           prestadores_visiveis_ao_prestador: visiveis.rows[0].n };
});

// ── T2: prova Q2 — status em_analise -> ativo ──────────────────────────────
await teste("T2_self_liberacao_status_ativo", async () => {
  const who = await entrarComoPrestador("40210d5e-acfd-4eea-81a7-c529bb50b788");
  const u1 = await client.query(`update prestadores set status = 'em_analise' where id = $1`, [ALVO_STATUS]);
  const u2 = await client.query(`update prestadores set status = 'ativo' where id = $1`, [ALVO_STATUS]);
  const ve = await client.query(`select status, status_operacional from prestadores where id = $1`, [ALVO_STATUS]);
  return { auth_uid: who.uid, passo1_em_analise: u1.rowCount, passo2_ativo: u2.rowCount,
           valor_dentro_da_transacao: ve.rows[0] };
});

// ── T3: prova Q3 — demais campos sensiveis da propria linha ────────────────
await teste("T3_campos_sensiveis_proprios", async () => {
  const who = await entrarComoPrestador("f87fe6b6-8b26-4ab6-bf8a-bf7e203e74b8");
  const upd = await client.query(
    `update prestadores
        set status = 'ativo',
            status_operacional = 'ativa',
            liberado_app = true,
            cpf_cnpj = '99988877766',
            data_aprovacao = current_date,
            score_interno = 99,
            ultimo_usuario = 'SELF-LIB-PROOF',
            origem_cadastro = 'auto_lib_proof',
            observacoes = 'auditado',
            metadata = metadata || '{"self_lib_proof": true}'::jsonb
      where id = $1`, [ALVO_CAMPOS]);
  const ve = await client.query(
    `select status, status_operacional, liberado_app, cpf_cnpj, data_aprovacao,
            score_interno, ultimo_usuario, origem_cadastro, metadata
       from prestadores where id = $1`, [ALVO_CAMPOS]);
  return { auth_uid: who.uid, linhas_afetadas: upd.rowCount, valores_dentro_da_transacao: ve.rows[0] };
});

// ── T4 (negativo): linha de OUTRO usuario ──────────────────────────────────
await teste("T4_negativo_linha_de_outro_prestador", async () => {
  await entrarComoPrestador(UID);
  const upd = await client.query(`update prestadores set liberado_app = true where id = $1`, [ALVO_NAO_PROPRIO]);
  return { linhas_afetadas: upd.rowCount, esperado: 0 };
});

// ── T5 (negativo): tentar alterar o proprio auth_user_id ───────────────────
await teste("T5_negativo_alterar_auth_user_id", async () => {
  await entrarComoPrestador(UID);
  const upd = await client.query(`update prestadores set auth_user_id = null where id = $1`, [ALVO_LIGERACAO]);
  return { linhas_afetadas: upd.rowCount, esperado: "erro RLS 42501 ou 0" };
});

// ── T6 (negativo): INSERT direto como prestador ────────────────────────────
await teste("T6_negativo_insert_prestadores", async () => {
  await entrarComoPrestador(UID);
  const ins = await client.query(
    `insert into prestadores (nome_completo, status, liberado_app)
     values ('SELF LIB INSERT PROOF', 'ativo', true) returning id`);
  return { linhas: ins.rowCount, id: ins.rows[0]?.id, esperado: "erro RLS 42501" };
});

// ── T7: visibilidade de leitura (escopo do que o prestador enxerga) ────────
await teste("T7_leitura_escopo", async () => {
  const who = await entrarComoPrestador(UID);
  const total = await client.query(`select count(*)::int n from prestadores`);
  const comAuth = await client.query(
    `select count(*)::int n from prestadores where auth_user_id is not null`);
  const amostra = await client.query(
    `select nome_completo, auth_user_id is null as sem_auth from prestadores limit 5`);
  return { auth_uid: who.uid, visiveis: total.rows[0].n,
           visiveis_com_auth_user: comAuth.rows[0].n, amostra: amostra.rows[0] };
});

// ── verificacao final FORA da transacao: nada persistiu ────────────────────
const depois = await estadoAntes();
registro("estado_depois", depois);

const mudou = JSON.stringify(antes) !== JSON.stringify(depois);
registro("INTEGRIDADE", { persistiu_alteracao: mudou,
  conclusao: mudou ? "FALHA — dado alterado" : "OK — tudo revertido (ROLLBACK)" });

// auditoria: nenhuma tabela criada
const audit = await client.query(
  `select exists(select 1 from information_schema.tables
      where table_schema='public' and table_name='liberado_app_audit') as existe_audit`);
registro("liberado_app_audit_apos_testes", audit.rows[0]);

console.log(JSON.stringify(log, null, 2));
await client.end();
