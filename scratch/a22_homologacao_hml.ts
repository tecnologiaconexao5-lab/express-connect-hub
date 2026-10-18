// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO A22 — HOMOLOGAÇÃO BACKEND (T1–T6) — AMBIENTE ISOLADO HML
//
// Escrita MÍNIMA e ISOLADA em PRODUÇÃO, com marcador HML-A22:
//   - 2 auth users HML (prestador + torre)
//   - 1 prestador HML (com auth_user_id)
//   - 1 alocação HML (valores 0 -> trigger financeiro pula)
//   - 1 prestador HML "B" (para teste de isolamento RLS)
//   - mensagens de teste com marcador "HML A22"
//
// NÃO toca: crm_conversas, crm_mensagens, operation_timeline_events,
// prestador real (Redmi), OS-HML-MULTI-001, D1/D2/RETESTE.
//
// Uso: npx tsx scratch/a22_homologacao_hml.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const pgc = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await pgc.connect();

const EMAIL_P = "a22hml.prestador@conexaoexpress.com.br";
const EMAIL_T = "a22hml.torre@conexaoexpress.com.br";
const PASSWORD = "HmlA22!Chat2026";

let PASS = 0, FAIL = 0;
function check(name: string, ok: boolean, extra?: string) {
  if (ok) { PASS++; console.log("  [PASS] " + name + (extra ? " — " + extra : "")); }
  else { FAIL++; console.log("  [FAIL] " + name + (extra ? " — " + extra : "")); }
}

// ───────────────────────────────────────────────────────────────────────────────
// 0. LIMPAR AMBIENTE HML ANTERIOR (somente registros HML-A22) — idempotente
// ───────────────────────────────────────────────────────────────────────────────
console.log("0) Preparando ambiente HML (limpeza idempotente)...");
await pgc.query(`DELETE FROM public.operacao_mensagens
  WHERE metadata->>'hml_marker' = 'HML-A22'
     OR prestador_id IN (SELECT id FROM prestadores WHERE nome_completo LIKE 'HML A22%');`);
await pgc.query(`DELETE FROM public.alocacoes_escala WHERE origem LIKE 'HML A22%' OR destino LIKE 'HML A22%';`);
await pgc.query(`DELETE FROM public.prestadores WHERE nome_completo LIKE 'HML A22%';`);
await pgc.query(`DELETE FROM public.tenant_usuarios WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ($1,$2));`, [EMAIL_P, EMAIL_T]);
const { data: oldUsers } = await admin.auth.admin.listUsers();
for (const u of oldUsers.users || []) {
  if (u.email === EMAIL_P || u.email === EMAIL_T) await admin.auth.admin.deleteUser(u.id);
}
await pgc.query(`DELETE FROM public.portal_notificacoes WHERE metadata->>'hml_marker' = 'HML-A22';`);

// ───────────────────────────────────────────────────────────────────────────────
// 1. CRIAR USERS AUTH HML
// ───────────────────────────────────────────────────────────────────────────────
console.log("1) Criando auth users HML...");
const { data: up, error: upErr } = await admin.auth.admin.createUser({ email: EMAIL_P, password: PASSWORD, email_confirm: true, user_metadata: { hml: "A22" } });
const { data: ut, error: utErr } = await admin.auth.admin.createUser({ email: EMAIL_T, password: PASSWORD, email_confirm: true, user_metadata: { hml: "A22" } });
check("criar auth prestador", !upErr && !!up?.user?.id, up?.user?.id);
check("criar auth torre", !utErr && !!ut?.user?.id, ut?.user?.id);
if (!up?.user?.id || !ut?.user?.id) { console.log("ABORTADO"); process.exit(1); }

// ───────────────────────────────────────────────────────────────────────────────
// 2. CRIAR PRESTADORES HML + VÍNCULO TORRE EM tenant_usuarios
// ───────────────────────────────────────────────────────────────────────────────
console.log("2) Criando prestadores HML e vínculo da Torre...");
const TENANT = "00000000-0000-0000-0000-000000000001";
const prestA = await pgc.query(
  `INSERT INTO public.prestadores (nome_completo, cpf_cnpj, telefone, whatsapp, status, liberado_app, auth_user_id, created_at, updated_at)
   VALUES ('HML A22 CHAT PRESTADOR', 'HML-A22-0001', '5511999990001', '5511999990001', 'ativo', true, $1, now(), now())
   RETURNING id, nome_completo`,
  [up.user.id]
);
const prestB = await pgc.query(
  `INSERT INTO public.prestadores (nome_completo, cpf_cnpj, telefone, whatsapp, status, liberado_app, created_at, updated_at)
   VALUES ('HML A22 CHAT PRESTADOR B', 'HML-A22-0002', '5511999990002', '5511999990002', 'ativo', true, now(), now())
   RETURNING id, nome_completo`,
  []
);
await pgc.query(
  `INSERT INTO public.tenant_usuarios (tenant_id, user_id, papel, status, criado_em, atualizado_em)
   VALUES ($1, $2, 'super_admin', 'ativo', now(), now())`,
  [TENANT, ut.user.id]
);
check("prestador A criado", prestA.rows.length === 1, prestA.rows[0]?.id);
check("prestador B criado", prestB.rows.length === 1, prestB.rows[0]?.id);
const prestAId = prestA.rows[0].id as string;
const prestBId = prestB.rows[0].id as string;

// ───────────────────────────────────────────────────────────────────────────────
// 3. CRIAR ALOCAÇÕES HML (valores 0 → trigger financeiro pula)
// ───────────────────────────────────────────────────────────────────────────────
console.log("3) Criando alocações HML...");
const alocA = await pgc.query(
  `INSERT INTO public.alocacoes_escala (data_escala, tipo_veiculo, status, prestador_id, tenant_id, origem, destino, valor_frete, valor_repasse, created_at, updated_at)
   VALUES (CURRENT_DATE, 'VUC', 'aceita', $1, $2, 'HML A22 CHAT - Coleta SP', 'HML A22 CHAT - Entrega SP', 0, 0, now(), now())
   RETURNING id, status`,
  [prestAId, TENANT]
);
const alocB = await pgc.query(
  `INSERT INTO public.alocacoes_escala (data_escala, tipo_veiculo, status, prestador_id, tenant_id, origem, destino, valor_frete, valor_repasse, created_at, updated_at)
   VALUES (CURRENT_DATE, 'VUC', 'aceita', $1, $2, 'HML A22 CHAT - Coleta SP (B)', 'HML A22 CHAT - Entrega SP (B)', 0, 0, now(), now())
   RETURNING id, status`,
  [prestBId, TENANT]
);
check("alocação A criada", alocA.rows.length === 1, alocA.rows[0]?.id);
check("alocação B criada", alocB.rows.length === 1, alocB.rows[0]?.id);
const alocAId = alocA.rows[0].id as string;
const alocBId = alocB.rows[0].id as string;

// ───────────────────────────────────────────────────────────────────────────────
// 4. SIGN IN (prestador A e torre) — fluxo real igual ao App
// ───────────────────────────────────────────────────────────────────────────────
console.log("4) Sign-in com os usuários HML...");
const clientP = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const clientT = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: sessP, error: signPErr } = await clientP.auth.signInWithPassword({ email: EMAIL_P, password: PASSWORD });
const { data: sessT, error: signTErr } = await clientT.auth.signInWithPassword({ email: EMAIL_T, password: PASSWORD });
check("sign-in prestador", !signPErr && !!sessP?.session?.access_token);
check("sign-in torre", !signTErr && !!sessT?.session?.access_token);

// ───────────────────────────────────────────────────────────────────────────────
// T1 — mensagem App (prestador) → Torre
// ───────────────────────────────────────────────────────────────────────────────
console.log("\nT1 — App → Torre");
const idemKey1 = "HML-A22-T1-" + Date.now();
const t1 = await clientP.rpc("f_enviar_mensagem_torre", {
  p_alocacao_id: alocAId,
  p_mensagem: "MENSAGEM HML A22 APP PARA TORRE",
  p_idempotency_key: idemKey1,
});
check("T1 envio success", t1.error === null && t1.data?.success === true, JSON.stringify(t1.data));
const countT1 = await pgc.query(
  `SELECT count(*)::int AS c FROM operacao_mensagens WHERE idempotency_key=$1`, [idemKey1]);
check("T1 exatamente 1 registro", countT1.rows[0].c === 1, "count=" + countT1.rows[0].c);

// ───────────────────────────────────────────────────────────────────────────────
// T6 — idempotência (mesma chave → NÃO duplica)
// ───────────────────────────────────────────────────────────────────────────────
console.log("\nT6 — Idempotência");
const t6 = await clientP.rpc("f_enviar_mensagem_torre", {
  p_alocacao_id: alocAId,
  p_mensagem: "MENSAGEM HML A22 APP PARA TORRE",
  p_idempotency_key: idemKey1,
});
check("T6 envio duplicado retorna success duplicada=true", t6.data?.success === true && t6.data?.duplicada === true, JSON.stringify(t6.data));
const countT6 = await pgc.query(
  `SELECT count(*)::int AS c FROM operacao_mensagens WHERE idempotency_key=$1`, [idemKey1]);
check("T6 continua 1 registro", countT6.rows[0].c === 1, "count=" + countT6.rows[0].c);

// ───────────────────────────────────────────────────────────────────────────────
// T2 — Torre recebe (badge + leitura via RLS)
// ───────────────────────────────────────────────────────────────────────────────
console.log("\nT2 — Torre recebe");
const badge = await clientT.rpc("f_contar_mensagens_nao_lidas_torre");
check("T2 badge >= 1", badge.error === null && Number(badge.data) >= 1, "badge=" + badge.data);
const listaT = await clientT.from("operacao_mensagens").select("*").eq("alocacao_id", alocAId).order("created_at", { ascending: true });
check("T2 torre lê mensagens da operação", listaT.error === null && (listaT.data || []).length >= 1, "n=" + (listaT.data || []).length);
const torreViu = (listaT.data || []).some((m: any) => m.mensagem === "MENSAGEM HML A22 APP PARA TORRE" && m.sender_type === "prestador");
check("T2 operação e motorista corretos", torreViu && (listaT.data || [])[0]?.prestador_id === prestAId);

// ───────────────────────────────────────────────────────────────────────────────
// T3 — Torre → App (resposta) + notificação
// ───────────────────────────────────────────────────────────────────────────────
console.log("\nT3 — Torre → App");
const idemKey3 = "HML-A22-T3-" + Date.now();
const t3 = await clientT.rpc("f_responder_mensagem_torre", {
  p_alocacao_id: alocAId,
  p_mensagem: "RESPOSTA HML A22 TORRE PARA APP",
  p_idempotency_key: idemKey3,
});
check("T3 resposta success", t3.error === null && t3.data?.success === true, JSON.stringify(t3.data));
const countT3 = await pgc.query(
  `SELECT count(*)::int AS c FROM operacao_mensagens WHERE idempotency_key=$1`, [idemKey3]);
check("T3 exatamente 1 resposta", countT3.rows[0].c === 1, "count=" + countT3.rows[0].c);
const notif = await pgc.query(
  `SELECT count(*)::int AS c FROM portal_notificacoes
   WHERE prestador_id=$1 AND tipo='operacao_mensagem' AND titulo='Nova mensagem da Torre'`,
  [prestAId]);
check("T3 notificação App gerada", notif.rows[0].c >= 1, "n=" + notif.rows[0].c);

// ───────────────────────────────────────────────────────────────────────────────
// T4 — App lê e marca como lida
// ───────────────────────────────────────────────────────────────────────────────
console.log("\nT4 — Não lida / lida (App)");
const listaP = await clientP.from("operacao_mensagens").select("*").eq("alocacao_id", alocAId).order("created_at", { ascending: true });
const respT = (listaP.data || []).find((m: any) => m.sender_type === "torre");
check("T4 app recebe resposta da Torre", !!respT, JSON.stringify(respT));
const antes = (listaP.data || []).filter((m: any) => m.sender_type === "torre" && m.status === "enviada").length;
const marc = await clientP.rpc("f_marcar_mensagens_lidas_app", { p_alocacao_id: alocAId });
check("T4 marcar lida (app) success", marc.error === null && marc.data?.success === true, JSON.stringify(marc.data));
const depois = await pgc.query(
  `SELECT count(*)::int AS c FROM operacao_mensagens WHERE alocacao_id=$1 AND sender_type='torre' AND status='enviada'`,
  [alocAId]);
check("T4 contador de não lidas da Torre baixou", antes >= 1 && depois.rows[0].c === 0, `antes=${antes} depois=${depois.rows[0].c}`);

// ───────────────────────────────────────────────────────────────────────────────
// T5 — Persistência (releitura após recarregar: nova sessão)
// ───────────────────────────────────────────────────────────────────────────────
console.log("\nT5 — Persistência");
const clientP2 = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
await clientP2.auth.setSession({ access_token: sessP.session!.access_token, refresh_token: sessP.session!.refresh_token });
const historico = await clientP2.from("operacao_mensagens").select("*").eq("alocacao_id", alocAId).order("created_at", { ascending: true });
check("T5 histórico preservado (app)", historico.error === null && (historico.data || []).length >= 2, "n=" + (historico.data || []).length);

// ───────────────────────────────────────────────────────────────────────────────
// RLS — isolamento: prestador A NÃO lê mensagens do prestador B
// ───────────────────────────────────────────────────────────────────────────────
console.log("\nRLS — Isolamento entre prestadores");
await pgc.query(
  `INSERT INTO public.operacao_mensagens (alocacao_id, prestador_id, sender_type, mensagem, status, metadata, created_at)
   VALUES ($1, $2, 'prestador', 'MENSAGEM HML A22 PRESTADOR B SECRETA', 'enviada', '{"hml_marker":"HML-A22"}'::jsonb, now())`,
  [alocBId, prestBId]
);
const isolado = await clientP.from("operacao_mensagens").select("id,mensagem").eq("alocacao_id", alocBId);
const viuSecreta = (isolado.data || []).some((m: any) => m.mensagem === "MENSAGEM HML A22 PRESTADOR B SECRETA");
check("RLS prestador A NÃO vê msg do prestador B", isolado.error === null && !viuSecreta, "rows=" + (isolado.data || []).length);
const anonProbe = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anonRead = await anonProbe.from("operacao_mensagens").select("*").limit(1);
check("RLS anon não lê mensagens (sem auth)", anonRead.error !== null || (anonRead.data || []).length === 0, JSON.stringify(anonRead.error));

// ───────────────────────────────────────────────────────────────────────────────
// NEGATIVOS — prestador não autorizado a outra operação; torre não autorizada no App
// ───────────────────────────────────────────────────────────────────────────────
console.log("\nNEGATIVOS");
const neg1 = await clientP.rpc("f_enviar_mensagem_torre", {
  p_alocacao_id: alocBId, p_mensagem: "TENTATIVA INDEVIDA", p_idempotency_key: "HML-A22-NEG-" + Date.now(),
});
check("Neg prestador B não aceita envio do prestador A", neg1.data?.success === false, JSON.stringify(neg1.data));
const neg2 = await clientP.rpc("f_responder_mensagem_torre", {
  p_alocacao_id: alocAId, p_mensagem: "TENTATIVA INDEVIDA TORRE", p_idempotency_key: "HML-A22-NEG2-" + Date.now(),
});
check("Neg prestador não consegue responder como Torre", neg2.data?.success === false, JSON.stringify(neg2.data));

// ───────────────────────────────────────────────────────────────────────────────
// RESUMO
// ───────────────────────────────────────────────────────────────────────────────
console.log("\n════════════════════════════════════════");
console.log(`RESULTADO HOMOLOGAÇÃO A22: PASS=${PASS} FAIL=${FAIL}`);
console.log("IDs HML (para relatório):");
console.log("  prestador A:", prestAId);
console.log("  alocação A :", alocAId);
console.log("  prestador B:", prestBId);
console.log("  alocação B :", alocBId);
console.log("  user prest.:", up.user.id);
console.log("  user torre :", ut.user.id);

await pgc.end();
process.exit(FAIL > 0 ? 1 : 0);
