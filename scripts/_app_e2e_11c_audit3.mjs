// APP-E2E-11C — auditoria READ-ONLY parte 3 (OS, baixas, auth, dependências amplas).
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const ALOC = "18d50f0b-704f-4361-8626-ed43c8000601";
const PREST = "b45890ff-454c-40a0-a89e-5333a88eb316";
const AUTHUID = "a5e51631-5ed8-430d-9041-4b185c03d821";
const TENANT = "00000000-0000-0000-0000-000000000001";

const out = {};

// OS
out.ordens_servico_by_id = await q(`select * from ordens_servico where id=$1`, [ALOC]);
out.ordens_servico_by_numero = await q(`select id, numero, status, cliente, prestador, created_at from ordens_servico where numero ilike '%18D50F0B%' or numero ilike '%20260928%'`);
out.os_historico = await q(`select * from os_historico where os_id=$1`, [ALOC]).catch(e => ({ erro: e.message }));

// Baixas financeiras referenciando pagar/receber do fixture
for (const t of ["financeiro_baixas", "financeiro_pagar_baixas"]) {
  try {
    const c = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [t])).map(r => r.column_name);
    out[`cols_${t}`] = c;
    if (c.length) {
      const w = [];
      if (c.includes("os_id")) w.push("os_id=$1");
      if (c.includes("prestador_id")) w.push("prestador_id::text=$2");
      out[t] = w.length ? await q(`select * from ${t} where ${w.join(" or ")}`, [ALOC, PREST]) : { sem_vinculo: true, cols: c };
    }
  } catch (e) { out[t] = { erro: e.message }; }
}

// Auth user
out.auth_users = await q(
  `select id, email, created_at, last_sign_in_at, email_confirmed_at from auth.users where id=$1 or email ilike '%teste@conexao%'`,
  [AUTHUID]);

// tenant_usuarios / usuarios_cliente
for (const t of ["tenant_usuarios", "usuarios_cliente"]) {
  try {
    const c = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [t])).map(r => r.column_name);
    if (!c.length) { out[t] = { nao_existe: true }; continue; }
    const w = [];
    if (c.includes("user_id")) w.push("user_id=$1");
    if (c.includes("auth_user_id")) w.push("auth_user_id=$1");
    out[t] = w.length ? await q(`select * from ${t} where ${w.join(" or ")}`, [AUTHUID]) : { cols: c };
  } catch (e) { out[t] = { erro: e.message }; }
}

// veiculos do prestador
try {
  const c = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name='veiculos'`)).map(r => r.column_name);
  const w = [];
  if (c.includes("prestador_vinculado")) w.push("prestador_vinculado::text=$1");
  if (c.includes("prestador_id")) w.push("prestador_id::text=$1");
  out.veiculos = w.length ? await q(`select * from veiculos where ${w.join(" or ")}`, [PREST]) : { cols: c };
} catch (e) { out.veiculos = { erro: e.message }; }

// Descoberta ampla: colunas UUID/text que referenciam o ALOC ou o prestador em TODO o schema public.
out.refs_aloc = await q(
  `select c.table_name, c.column_name, c.data_type
     from information_schema.columns c
     join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
    where c.table_schema='public'
      and c.table_name not like 'ia_%'
      and (c.column_name in ('alocacao_id','operation_id','os_id','ordem_servico_id','escala_id')
           or c.column_name like '%alocacao%' or c.column_name like '%operation%')
    order by c.table_name, c.column_name`);

// Contagem genérica: linhas que contenham o id da alocação como texto em qualquer coluna de vínculo.
out.contagens = {};
for (const r of out.refs_aloc) {
  try {
    const n = (await q(`select count(*)::int n from "${r.table_name}" where "${r.column_name}"::text=$1`, [ALOC]))[0].n;
    if (n > 0) out.contagens[`${r.table_name}.${r.column_name}`] = n;
  } catch (e) { /* tipo incompatível — ignora */ }
}

// Contagens por prestador em tabelas com prestador_id/driver_id
out.contagens_prestador = {};
const colsP = await q(
  `select table_name, column_name from information_schema.columns
    where table_schema='public' and column_name in ('prestador_id','driver_id','fornecedor_id','fornecedor_cadastro_id')
      and table_name not like 'ia_%'
    order by table_name`);
for (const r of colsP) {
  try {
    const n = (await q(`select count(*)::int n from "${r.table_name}" where "${r.column_name}"::text=$1`, [PREST]))[0].n;
    if (n > 0) out.contagens_prestador[`${r.table_name}.${r.column_name}`] = n;
  } catch (e) {}
}

console.log(JSON.stringify(out, null, 2));
await pool.end();
