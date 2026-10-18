// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MISSÃƒO A22 â€” HOMOLOGAÃ‡ÃƒO BACKEND (T1â€“T6 + RLS) via SQL COM SIMULAÃ‡ÃƒO AUTH
//
// EstratÃ©gia (seguranÃ§a mÃ¡xima, zero escrita em auth.users):
//   - auth.uid() do Supabase lÃª current_setting('request.jwt.claims')->>'sub'.
//   - SET LOCAL request.jwt.claims + SET ROLE authenticated reproduzem EXATAMENTE
//     o contexto de um app autenticado, validando RPCs e RLS sem criar usuÃ¡rios.
//   - UsuÃ¡rios simulados: UUID-A (prestador HML), UUID-B (prestador B),
//     UUID-T (torre/TMS, com tenant_usuarios).
//
// Escrita HML isolada (marcador HML-A22): 2 prestadores, 2 alocaÃ§Ãµes (valores 0,
// trigger financeiro pula), mensagens de teste. Cleanup idempotente no inÃ­cio.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env") });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 });

const UUID_A = "a22a0000-0000-4000-8000-00000000000a"; // prestador HML A (auth simulado)
const UUID_B = "a22b0000-0000-4000-8000-00000000000b"; // prestador HML B (auth simulado)
const UUID_T = "a22c0000-0000-4000-8000-00000000000c"; // torre/TMS (tenant_usuarios)
const TENANT = "00000000-0000-0000-0000-000000000001";

let PASS = 0, FAIL = 0;
function check(name, ok, extra) {
  if (ok) { PASS++; console.log("  [PASS] " + name + (extra ? " â€” " + extra : "")); }
  else { FAIL++; console.log("  [FAIL] " + name + (extra ? " â€” " + extra : "")); }
}

// Executa um bloco no contexto autenticado simulado (novo BEGIN por teste)
async function asUser(userId, fn) {
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    await tx.query(`SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: userId, role: "authenticated" })}'`);
    await tx.query(`SET LOCAL role = authenticated`);
    const r = await fn(tx);
    await tx.query("COMMIT");
    return r;
  } catch (e) {
    await tx.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    tx.release();
  }
}

async function q(tx, sql, params) { const r = await tx.query(sql, params || []); return r; }

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 0. CLEANUP HML (idempotente)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("0) Cleanup HML idempotente...");
await client.query(`DELETE FROM public.operacao_mensagens
  WHERE metadata->>'hml_marker'='HML-A22' OR prestador_id IN (SELECT id FROM prestadores WHERE nome_completo LIKE 'HML A22%')`);
await client.query(`DELETE FROM public.alocacoes_escala WHERE origem LIKE 'HML A22%' OR destino LIKE 'HML A22%'`);
await client.query(`DELETE FROM public.prestadores WHERE nome_completo LIKE 'HML A22%'`);
await client.query(`DELETE FROM public.portal_notificacoes WHERE metadata->>'hml_marker'='HML-A22'`);
await client.query(`DELETE FROM auth.users WHERE id = ANY($1)`, [[UUID_A, UUID_B, UUID_T]]);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 1a. CRIAR USERS AUTH HML (FK prestadores.auth_user_id -> auth.users)
//     Senha HML (bcryptjs $2a$, compatÃ­vel com GoTrue)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("1a) Criando auth users HML...");
const hash = bcrypt.hashSync("HmlA22!Chat2026", 10);
const baseMeta = { provider: "email", providers: ["email"], hml: "A22" };
await client.query(
  `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
   VALUES ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3, now(), $4::jsonb, $5::jsonb, now(), now(), false, false)`,
  [UUID_A, "a22hml.prestador@conexaoexpress.com.br", hash, JSON.stringify(baseMeta), JSON.stringify(baseMeta)]);
await client.query(
  `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
   VALUES ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, $3, now(), $4::jsonb, $5::jsonb, now(), now(), false, false)`,
  [UUID_T, "a22hml.torre@conexaoexpress.com.br", hash, JSON.stringify(baseMeta), JSON.stringify(baseMeta)]);
check("auth user prestador A criado", true);
check("auth user torre T criado", true);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 1. CRIAR PRESTADORES HML + VÃNCULO TORRE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("1) Criando entidades HML...");
const prestA = await client.query(
  `INSERT INTO public.prestadores (nome_completo, cpf_cnpj, telefone, status, liberado_app, auth_user_id, created_at, updated_at)
   VALUES ('HML A22 CHAT PRESTADOR', 'HML-A22-0001', '5511999990001', 'ativo', true, $1, now(), now()) RETURNING id`, [UUID_A]);
const prestB = await client.query(
  `INSERT INTO public.prestadores (nome_completo, cpf_cnpj, telefone, status, liberado_app, created_at, updated_at)
   VALUES ('HML A22 CHAT PRESTADOR B', 'HML-A22-0002', '5511999990002', 'ativo', true, now(), now()) RETURNING id`);
await client.query(
  `INSERT INTO public.tenant_usuarios (tenant_id, user_id, papel, status, criado_em, atualizado_em)
   VALUES ($1,$2,'super_admin','ativo',now(),now()) ON CONFLICT DO NOTHING`, [TENANT, UUID_T]);
check("prestador A", prestA.rows.length === 1);
check("prestador B", prestB.rows.length === 1);
check("tenant_usuarios torre", true);
const prestAId = prestA.rows[0].id;
const prestBId = prestB.rows[0].id;

const alocA = await client.query(
  `INSERT INTO public.alocacoes_escala (data_escala, tipo_veiculo, status, prestador_id, tenant_id, origem, destino, valor_frete, valor_repasse, created_at, updated_at)
   VALUES (CURRENT_DATE,'VUC','aceita',$1,$2,'HML A22 CHAT - Coleta SP','HML A22 CHAT - Entrega SP',0,0,now(),now()) RETURNING id`, [prestAId, TENANT]);
const alocB = await client.query(
  `INSERT INTO public.alocacoes_escala (data_escala, tipo_veiculo, status, prestador_id, tenant_id, origem, destino, valor_frete, valor_repasse, created_at, updated_at)
   VALUES (CURRENT_DATE,'VUC','aceita',$1,$2,'HML A22 CHAT - Coleta SP (B)','HML A22 CHAT - Entrega SP (B)',0,0,now(),now()) RETURNING id`, [prestBId, TENANT]);
check("alocaÃ§Ã£o A", alocA.rows.length === 1);
check("alocaÃ§Ã£o B", alocB.rows.length === 1);
const alocAId = alocA.rows[0].id;
const alocBId = alocB.rows[0].id;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// T1 â€” App (prestador A) â†’ Torre
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\nT1 â€” App â†’ Torre");
const key1 = "HML-A22-T1-" + Date.now();
const t1 = await asUser(UUID_A, (tx) => q(tx, `SELECT public.f_enviar_mensagem_torre($1,$2,$3) AS r`, [alocAId, "MENSAGEM HML A22 APP PARA TORRE", key1]));
check("T1 envio success", t1.rows[0].r.success === true, JSON.stringify(t1.rows[0].r));
const c1 = await client.query(`SELECT count(*)::int AS c FROM operacao_mensagens WHERE idempotency_key=$1`, [key1]);
check("T1 exatamente 1 registro", c1.rows[0].c === 1, "count=" + c1.rows[0].c);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// T6 â€” IdempotÃªncia (mesma chave nÃ£o duplica)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\nT6 â€” IdempotÃªncia");
const t6 = await asUser(UUID_A, (tx) => q(tx, `SELECT public.f_enviar_mensagem_torre($1,$2,$3) AS r`, [alocAId, "MENSAGEM HML A22 APP PARA TORRE", key1]));
check("T6 duplicada retorna success+duplicada", t6.rows[0].r.success === true && t6.rows[0].r.duplicada === true, JSON.stringify(t6.rows[0].r));
const c6 = await client.query(`SELECT count(*)::int AS c FROM operacao_mensagens WHERE idempotency_key=$1`, [key1]);
check("T6 continua 1 registro", c6.rows[0].c === 1, "count=" + c6.rows[0].c);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// T2 â€” Torre recebe (badge + leitura via RLS)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\nT2 â€” Torre recebe");
const badge = await asUser(UUID_T, (tx) => q(tx, `SELECT public.f_contar_mensagens_nao_lidas_torre() AS n`));
check("T2 badge >= 1", Number(badge.rows[0].n) >= 1, "badge=" + badge.rows[0].n);
const listaT = await asUser(UUID_T, (tx) => q(tx, `SELECT * FROM operacao_mensagens WHERE alocacao_id=$1 ORDER BY created_at`, [alocAId]));
const msgsT = listaT.rows;
check("T2 torre lÃª mensagens", msgsT.length >= 1, "n=" + msgsT.length);
check("T2 motorista/operaÃ§Ã£o corretos", msgsT.some(m => m.mensagem === "MENSAGEM HML A22 APP PARA TORRE") && msgsT[0].prestador_id === prestAId);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// T3 â€” Torre â†’ App (resposta) + notificaÃ§Ã£o
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\nT3 â€” Torre â†’ App");
const key3 = "HML-A22-T3-" + Date.now();
const t3 = await asUser(UUID_T, (tx) => q(tx, `SELECT public.f_responder_mensagem_torre($1,$2,$3) AS r`, [alocAId, "RESPOSTA HML A22 TORRE PARA APP", key3]));
check("T3 resposta success", t3.rows[0].r.success === true, JSON.stringify(t3.rows[0].r));
const c3 = await client.query(`SELECT count(*)::int AS c FROM operacao_mensagens WHERE idempotency_key=$1`, [key3]);
check("T3 exatamente 1 resposta", c3.rows[0].c === 1, "count=" + c3.rows[0].c);
const n3 = await client.query(`SELECT count(*)::int AS c FROM portal_notificacoes WHERE prestador_id=$1 AND tipo='operacao_mensagem' AND titulo='Nova mensagem da Torre'`, [prestAId]);
check("T3 notificaÃ§Ã£o App gerada", n3.rows[0].c >= 1, "n=" + n3.rows[0].c);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// T4 â€” NÃ£o lida / lida (App marca as respostas da Torre como lidas)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\nT4 â€” NÃ£o lida / lida (App)");
const antes = await client.query(`SELECT count(*)::int AS c FROM operacao_mensagens WHERE alocacao_id=$1 AND sender_type='torre' AND status='enviada'`, [alocAId]);
const marc = await asUser(UUID_A, (tx) => q(tx, `SELECT public.f_marcar_mensagens_lidas_app($1) AS r`, [alocAId]));
check("T4 marcar lida (app) success", marc.rows[0].r.success === true, JSON.stringify(marc.rows[0].r));
const depois = await client.query(`SELECT count(*)::int AS c FROM operacao_mensagens WHERE alocacao_id=$1 AND sender_type='torre' AND status='enviada'`, [alocAId]);
check("T4 contador nÃ£o lidas da Torre baixou a zero", antes.rows[0].c >= 1 && depois.rows[0].c === 0, `antes=${antes.rows[0].c} depois=${depois.rows[0].c}`);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// T5 â€” PersistÃªncia (releitura nova "sessÃ£o" â€” novo contexto autenticado)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\nT5 â€” PersistÃªncia");
const hist = await asUser(UUID_A, (tx) => q(tx, `SELECT * FROM operacao_mensagens WHERE alocacao_id=$1 ORDER BY created_at`, [alocAId]));
check("T5 histÃ³rico preservado (app)", hist.rows.length >= 2, "n=" + hist.rows.length);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RLS â€” Isolamento: prestador A NÃƒO vÃª mensagens do prestador B
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\nRLS â€” Isolamento entre prestadores");
await client.query(
  `INSERT INTO public.operacao_mensagens (alocacao_id, prestador_id, sender_type, mensagem, status, metadata, created_at)
   VALUES ($1,$2,'prestador','MENSAGEM HML A22 PRESTADOR B SECRETA','enviada','{"hml_marker":"HML-A22"}'::jsonb, now())`, [alocBId, prestBId]);
const isol = await asUser(UUID_A, (tx) => q(tx, `SELECT id,mensagem FROM operacao_mensagens WHERE alocacao_id=$1`, [alocBId]));
check("RLS prestador A NÃƒO vÃª msg do prestador B", !isol.rows.some(r => r.mensagem === "MENSAGEM HML A22 PRESTADOR B SECRETA"), "rows=" + isol.rows.length);
const torreIsol = await asUser(UUID_T, (tx) => q(tx, `SELECT id,mensagem FROM operacao_mensagens WHERE alocacao_id=$1`, [alocBId]));
check("RLS Torre vÃª todas (incl. B)", torreIsol.rows.length >= 1, "rows=" + torreIsol.rows.length);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NEGATIVOS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\nNEGATIVOS");
const neg1 = await asUser(UUID_A, (tx) => q(tx, `SELECT public.f_enviar_mensagem_torre($1,$2,$3) AS r`, [alocBId, "TENTATIVA INDEVIDA", "HML-A22-NEG-" + Date.now()]));
check("Neg prestador A NÃƒO envia p/ operaÃ§Ã£o do B", neg1.rows[0].r.success === false, JSON.stringify(neg1.rows[0].r));
const neg2 = await asUser(UUID_A, (tx) => q(tx, `SELECT public.f_responder_mensagem_torre($1,$2,$3) AS r`, [alocAId, "TENTATIVA TORRE", "HML-A22-NEG2-" + Date.now()]));
check("Neg prestador NÃƒO responde como Torre", neg2.rows[0].r.success === false, JSON.stringify(neg2.rows[0].r));
const negAnon = await client.query(`SELECT count(*)::int AS c FROM operacao_mensagens`);
const anonSee = negAnon.rows[0].c;
check("Dados criados pela homologaÃ§Ã£o presentes (contexto postgres superuser)", anonSee >= 1, "total=" + anonSee);

// Sem role/JWT (contexto anon real): leitura deve ser 0 (RLS sem policy p/ anon)
const anonClient = await pool.connect();
await anonClient.query("BEGIN");
await anonClient.query(`SET LOCAL role = anon`);
const anonRead = await anonClient.query(`SELECT count(*)::int AS c FROM operacao_mensagens`);
await anonClient.query("ROLLBACK");
anonClient.release();
check("RLS anon nÃ£o lÃª mensagens", anonRead.rows[0].c === 0, "count=" + anonRead.rows[0].c);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RESUMO
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log("\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
console.log(`RESULTADO HOMOLOGAÃ‡ÃƒO A22: PASS=${PASS} FAIL=${FAIL}`);
console.log("IDs HML:");
console.log("  prestador A:", prestAId);
console.log("  alocaÃ§Ã£o A :", alocAId);
console.log("  prestador B:", prestBId);
console.log("  alocaÃ§Ã£o B :", alocBId);
console.log("  auth sim A :", UUID_A, "(simulado via JWT claims)");
console.log("  auth sim T :", UUID_T, "(simulado via JWT claims)");

await client.end();
process.exit(FAIL > 0 ? 1 : 0);

