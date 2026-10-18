// ADM-APP-02C.2 — TESTES N01–N10 / P01–P09. Tudo transação + ROLLBACK.
// Nada persistido. Linhas alvo são TESTE já identificadas na 02C.1.
import pg from "pg";
import fs from "node:fs";

const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await client.connect();

const UID_PREST  = "47da030a-a536-4046-8f0f-e4878948b94e"; // "teste 2"
const ROW_PREST  = "0b55f471-b8eb-419a-bda1-567ec3b37a39";
const UID_PREST2 = "399796b7-4e3b-432f-8744-4eb91f0ee31d"; // "PRESTADOR TESTE APP"
const UID_TMS    = "8c12fc67-4dac-4f1e-b4fd-23cf0d168284"; // tamiris @ tenant_usuarios
const ROW_ALVO   = "e9d43079-3d14-4083-b33e-f50174b6e663"; // "REC06 E2E Real Teste"

const out = [];
const reg = (k, v) => out.push({ [k]: v });

const claims = (uid, role) => JSON.stringify({ sub: uid, role, iss: "supabase" });

async function entrar(role, uid) {
  await client.query(`SET LOCAL ROLE ${role}`);
  await client.query(`select set_config('request.jwt.claims', $1, true)`,
    [uid ? claims(uid, role) : JSON.stringify({ role, iss: "supabase" })]);
  if (uid) await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
  await client.query(`select set_config('request.jwt.claim.role', $1, true)`, [role]);
  return (await client.query(`select auth.uid() uid, auth.role() role`)).rows[0];
}

async function teste(nome, fn) {
  try {
    await client.query("BEGIN");
    const d = await fn();
    await client.query("ROLLBACK");
    reg(nome, { executado: true, rollback: true, ...d });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    reg(nome, { executado: false, rollback: true, erro: e.message, sqlstate: e.code });
  }
}

// ── estado base ──────────────────────────────────────────────────────────────
const antes = (await client.query(
  `select id, status, liberado_app, score_interno, ultimo_usuario, telefone, metadata
     from prestadores order by id`)).rows;
const contagensAntes = (await client.query(
  `select (select count(*)::int from prestadores) p,
          (select count(*)::int from recrutamento_candidatos) rc,
          (select count(*)::int from recrutamento_prestadores) rp,
          (select count(*)::int from recrutamento_operacoes) ro,
          (select count(*)::int from candidatos) c`)).rows[0];
reg("estado_antes", { contagens: contagensAntes });

// ── N01 prestador não altera liberado_app ───────────────────────────────────
await teste("N01_prestador_nao_altera_liberado_app", async () => {
  const who = await entrar("authenticated", UID_PREST);
  const r = await client.query(`update prestadores set liberado_app = true where id = $1`, [ROW_PREST]);
  return { auth: who, linhas: r.rowCount, esperado: "erro 42501" };
});

// ── N02 prestador não altera status para ativo ──────────────────────────────
await teste("N02_prestador_nao_altera_status", async () => {
  const who = await entrar("authenticated", UID_PREST);
  const r = await client.query(`update prestadores set status = 'ativo' where id = $1`, [ROW_PREST]);
  return { auth: who, linhas: r.rowCount, esperado: "erro 42501" };
});

// ── N03 prestador não altera campos administrativos ─────────────────────────
await teste("N03_prestador_nao_altera_campos_admin", async () => {
  await entrar("authenticated", UID_PREST);
  const r = await client.query(`update prestadores
      set status_operacional='ativa', data_aprovacao=current_date, origem_cadastro='hack',
          score_interno=99, ultimo_usuario='HACK', cpf_cnpj='11122233344',
          observacoes='hack', valor_km=999
    where id = $1`, [ROW_PREST]);
  return { linhas: r.rowCount, esperado: "erro 42501" };
});

// ── N04 prestador não troca auth_user_id ────────────────────────────────────
await teste("N04_prestador_nao_troca_auth_user_id", async () => {
  await entrar("authenticated", UID_PREST);
  const r = await client.query(`update prestadores set auth_user_id = $2 where id = $1`,
    [ROW_PREST, UID_PREST2]);
  return { linhas: r.rowCount, esperado: "erro 42501" };
});

// ── N04b prestador não escreve metadata com chave privilegiada ──────────────
await teste("N04b_prestador_nao_altera_metadata_privilegiada", async () => {
  await entrar("authenticated", UID_PREST);
  const r = await client.query(
    `update prestadores set metadata = coalesce(metadata,'{}'::jsonb) || '{"liberado_app":true}'::jsonb
      where id = $1`, [ROW_PREST]);
  return { linhas: r.rowCount, esperado: "erro 42501" };
});

// ── N05 prestador não lê outros prestadores ─────────────────────────────────
await teste("N05_prestador_nao_le_outros", async () => {
  const who = await entrar("authenticated", UID_PREST);
  const total = (await client.query(`select count(*)::int n from prestadores`)).rows[0].n;
  const propr = (await client.query(`select count(*)::int n from prestadores where id = $1`,
    [ROW_PREST])).rows[0].n;
  const alheios = (await client.query(
    `select count(*)::int n from prestadores where auth_user_id is distinct from auth.uid()`)).rows[0].n;
  return { auth: who, visiveis_total: total, visiveis_proprio: propr, visiveis_alheios: alheios,
           esperado: "total=1 e alheios=0" };
});

// ── N06–N09 motorista sem tenant_usuarios não lê pipeline ───────────────────
for (const [nome, tabela] of [["N06", "recrutamento_candidatos"],
                              ["N07", "recrutamento_prestadores"],
                              ["N08", "recrutamento_operacoes"],
                              ["N09", "candidato_documentos"]]) {
  await teste(`${nome}_prestador_sem_tenant_nao_le_${tabela}`, async () => {
    const who = await entrar("authenticated", UID_PREST);
    const n = (await client.query(`select count(*)::int n from ${tabela}`)).rows[0].n;
    return { auth: who, linhas: n, esperado: 0 };
  });
}

// ── N10 anon não lê/insere candidatos ───────────────────────────────────────
await teste("N10_anon_nao_le_candidatos", async () => {
  const who = await entrar("anon", null);
  const n = (await client.query(`select count(*)::int n from candidatos`)).rows[0].n;
  return { auth: who, linhas: n, esperado: 0 };
});
await teste("N10b_anon_nao_insere_candidatos", async () => {
  await entrar("anon", null);
  const r = await client.query(`insert into candidatos (nome_completo) values ('ANON PROOF')`);
  return { linhas: r.rowCount, esperado: "erro 42501" };
});

// ── P01 TMS com tenant_usuarios ainda lê prestadores ────────────────────────
await teste("P01_tms_le_prestadores", async () => {
  const who = await entrar("authenticated", UID_TMS);
  const n = (await client.query(`select count(*)::int n from prestadores`)).rows[0].n;
  return { auth: who, linhas: n, esperado: "> 0" };
});

// ── P02+P03 TMS altera status/liberado_app e gera auditoria ─────────────────
await teste("P02_P03_tms_altera_e_auditoria", async () => {
  const who = await entrar("authenticated", UID_TMS);
  await client.query(`select set_config('app.audit_motivo','P02-P03 teste 02C.2',true)`);
  const antesAudit = (await client.query(
    `select count(*)::int n from liberado_app_audit where prestador_id = $1`, [ROW_ALVO])).rows[0].n;
  const r = await client.query(
    `update prestadores
        set status = case when status = 'em_analise' then 'aprovado' else 'em_analise' end,
            liberado_app = not coalesce(liberado_app, false),
            score_interno = coalesce(score_interno, 0) + 7,
            ultimo_usuario = 'P02-P03-02C2'
      where id = $1`, [ROW_ALVO]);
  const audit = (await client.query(
    `select campo, valor_anterior, valor_novo, actor_user_id, actor_role, actor_tipo, acao,
            motivo, tenant_snapshot, created_at
       from liberado_app_audit where prestador_id = $1 order by created_at desc limit 10`,
    [ROW_ALVO])).rows;
  return { auth: who, linhas: r.rowCount, audit_antes: antesAudit, audit_rows: audit };
});

// ── P04 service_role continua operacional ───────────────────────────────────
await teste("P04_service_role_opera", async () => {
  const who = await entrar("service_role", null);
  const r = await client.query(
    `update prestadores set ultimo_usuario = 'SVC-PROOF' where id = $1`, [ROW_ALVO]);
  const n = (await client.query(`select count(*)::int n from prestadores`)).rows[0].n;
  return { auth: who, linhas: r.rowCount, prestadores_visiveis: n };
});

// ── P05 prestador ainda lê o PRÓPRIO cadastro ───────────────────────────────
await teste("P05_prestador_le_proprio", async () => {
  const who = await entrar("authenticated", UID_PREST);
  const r = (await client.query(
    `select id, nome_completo, status, liberado_app, telefone from prestadores
      where auth_user_id = auth.uid()`)).rows;
  return { auth: who, linhas: r.length, registro: r[0] ?? null };
});

// ── P06 campos pessoais legítimos do APP continuam funcionando ──────────────
await teste("P06_prestador_edita_campos_legitimos", async () => {
  await entrar("authenticated", UID_PREST);
  const r1 = await client.query(
    `update prestadores set telefone = '11999990001', whatsapp = '11999990001'
      where id = $1`, [ROW_PREST]);
  const r2 = await client.query(
    `update prestadores set metadata = coalesce(metadata,'{}'::jsonb)
                                || '{"disponivel_app": true, "status_operacional_app": "online"}'::jsonb
      where id = $1`, [ROW_PREST]);
  const ve = await client.query(`select telefone, metadata from prestadores where id = $1`, [ROW_PREST]);
  return { telefone_ok: r1.rowCount, metadata_ok: r2.rowCount, valores: ve.rows[0] };
});

// ── P07 bridge AFTER INSERT continua existente/funcional ────────────────────
await teste("P07_bridge_funcional", async () => {
  const trig = (await client.query(
    `select tgname, pg_get_triggerdef(oid) def from pg_trigger
      where not tgisinternal and tgrelid='public.prestadores'::regclass order by tgname`)).rows;
  const rpAntes = (await client.query(`select count(*)::int n from recrutamento_prestadores`)).rows[0].n;
  const rcAntes = (await client.query(`select count(*)::int n from recrutamento_candidatos`)).rows[0].n;
  const cpf = '9' + String(Date.now()).slice(-10);
  const ins = await client.query(
    `insert into prestadores (nome_completo, cpf_cnpj, origem, origem_cadastro, status, liberado_app)
     values ('BRIDGE PROOF 02C2', $1, 'app_prestador', 'app_motorista', 'em_analise', false) returning id`,
    [cpf]);
  const rp = (await client.query(`select count(*)::int n from recrutamento_prestadores`)).rows[0].n;
  const rc = (await client.query(`select count(*)::int n from recrutamento_candidatos`)).rows[0].n;
  const bridge = trig.find(t => t.tgname === "trg_bridge_prestador_para_recrutamento");
  return { triggers: trig.map(t => t.tgname), bridge_def: bridge?.def,
           rp_antes: rpAntes, rp_depois: rp, rc_antes: rcAntes, rc_depois: rc,
           novo_prestador: ins.rows[0].id };
});

// ── P08 REC-062B não sofreu regressão ───────────────────────────────────────
await teste("P08_rec062b_preservada", async () => {
  const cip = (await client.query(
    `select tablename, policyname from pg_policies
      where schemaname='public' and tablename='crm_interacoes_prestadores'
        and policyname like 'cip_%' order by policyname`)).rows;
  const anonGrant = (await client.query(
    `select c.relname,
            has_table_privilege('anon', c.oid, 'SELECT') anon_sel,
            has_table_privilege('anon', c.oid, 'INSERT') anon_ins
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname = any($1) order by c.relname`,
    [["recrutamento_candidatos","recrutamento_prestadores","recrutamento_operacoes",
      "candidato_documentos","candidatos","prestadores","entregas_protocolo"]])).rows;
  return { cip_policies: cip, anon_grants: anonGrant };
});

// ── P09 nenhuma policy anon reaberta + shape final ──────────────────────────
await teste("P09_shape_final_sem_anon", async () => {
  const anonPol = (await client.query(
    `select tablename, policyname from pg_policies
      where schemaname='public' and 'anon' = any(roles)
        and tablename in ('prestadores','recrutamento_candidatos','recrutamento_prestadores',
                          'recrutamento_operacoes','candidato_documentos','candidatos',
                          'liberado_app_audit')`)).rows;
  const shape = (await client.query(
    `select tablename, policyname, cmd, roles::text[] roles from pg_policies
      where schemaname='public' and tablename in
        ('prestadores','recrutamento_candidatos','recrutamento_prestadores',
         'recrutamento_operacoes','candidato_documentos','candidatos','liberado_app_audit')
      order by tablename, policyname`)).rows;
  const objs = (await client.query(
    `select tgname, pg_get_triggerdef(oid) def from pg_trigger
      where not tgisinternal and tgrelid='public.prestadores'::regclass order by tgname`)).rows;
  const fns = (await client.query(
    `select p.proname, p.provolatile, p.prosecdef,
            has_function_privilege('anon', p.oid, 'EXECUTE') anon_exec
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in
        ('fn_guardar_privilegio_prestador','fn_audit_liberado_app')`)).rows;
  const auditExists = (await client.query(
    `select to_regclass('public.liberado_app_audit') is not null existe`)).rows[0].existe;
  const anonGrants = (await client.query(
    `select c.relname, c.relacl::text relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname = any($1) order by c.relname`,
    [["candidatos","liberado_app_audit"]])).rows;
  return { anon_policies: anonPol, shape, triggers: objs, funcoes: fns,
           liberado_app_audit_existe: auditExists, relacl: anonGrants };
});

// ── integridade: nada persistiu ─────────────────────────────────────────────
const depois = (await client.query(
  `select id, status, liberado_app, score_interno, ultimo_usuario, telefone, metadata
     from prestadores order by id`)).rows;
const contagensDepois = (await client.query(
  `select (select count(*)::int from prestadores) p,
          (select count(*)::int from recrutamento_candidatos) rc,
          (select count(*)::int from recrutamento_prestadores) rp,
          (select count(*)::int from recrutamento_operacoes) ro,
          (select count(*)::int from candidatos) c`)).rows[0];

reg("INTEGRIDADE", {
  dados_intactos: JSON.stringify(antes) === JSON.stringify(depois),
  contagens_antes: contagensAntes,
  contagens_depois: contagensDepois,
  persistiu_alteracao: JSON.stringify(antes) !== JSON.stringify(depois)
});

console.log(JSON.stringify(out, null, 2));
await client.end();
