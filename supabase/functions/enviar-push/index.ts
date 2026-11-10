// ============================================================
// EDGE FUNCTION — ENVIAR PUSH (FCM HTTP v1)
//
// Consome `push_notificacoes_fila` (alimentada por INSERT em
// `portal_notificacoes`) e envia para todos os tokens ativos de
// `motorista_push_tokens` do prestador.
//
// Segredos necessários (Supabase → Settings → Edge Functions → Secrets):
//   FCM_SERVICE_ACCOUNT_JSON  (JSON completo da service account do Firebase)
//   FCM_PROJECT_ID            (opcional; usa o project_id da service account)
//   FCM_ACCESS_TOKEN          (opcional, alternativa à service account)
//   PUSH_INTERNAL_TOKEN       (opcional; para chamadas internas via x-internal-token)
//
// Invocação:
//   POST /functions/v1/enviar-push
//   Authorization: Bearer <SERVICE_ROLE_KEY>   (ou x-internal-token: <PUSH_INTERNAL_TOKEN>)
//   body: { "fila_id": "<uuid>" }  (opcional; sem body processa até 20 pendentes)
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-token",
  "Content-Type": "application/json",
};

interface FilaItem {
  id: string;
  notificacao_id: string | null;
  prestador_id: string;
  titulo: string | null;
  mensagem: string | null;
  tipo: string | null;
  os_id: string | null;
  payload: Record<string, unknown> | null;
  tentativas: number | null;
}

interface TokenItem {
  id: string;
  token: string;
}

interface FcmAuth {
  accessToken: string;
  projectId: string;
  expiraEm: number;
}

let cacheFcm: FcmAuth | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function b64urlBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64url(texto: string): string {
  return b64urlBytes(new TextEncoder().encode(texto));
}

function pemParaDer(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function obterFcmAuth(): Promise<FcmAuth | null> {
  const projectIdEnv = Deno.env.get("FCM_PROJECT_ID") || "";
  const tokenDireto = Deno.env.get("FCM_ACCESS_TOKEN") || "";
  if (tokenDireto && projectIdEnv) {
    return { accessToken: tokenDireto, projectId: projectIdEnv, expiraEm: Date.now() + 3_600_000 };
  }

  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") || "";
  if (!raw) return null;

  let sa: Record<string, unknown>;
  try {
    sa = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error("[enviar-push] FCM_SERVICE_ACCOUNT_JSON inválido");
    return null;
  }

  const clientEmail = String(sa.client_email || "");
  const privateKey = String(sa.private_key || "");
  const projectId = projectIdEnv || String(sa.project_id || "");
  if (!clientEmail || !privateKey || !projectId) return null;
  if (cacheFcm && cacheFcm.expiraEm > Date.now() + 60_000) return cacheFcm;

  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: agora,
      exp: agora + 3600,
    }),
  );
  const base = `${cabecalho}.${claims}`;

  const chave = await crypto.subtle.importKey(
    "pkcs8",
    pemParaDer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(base)),
  );
  const jwt = `${base}.${b64urlBytes(assinatura)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok || !dados.access_token) {
    console.error("[enviar-push] Falha ao obter access token FCM:", resp.status, dados);
    return null;
  }

  cacheFcm = {
    accessToken: String(dados.access_token),
    projectId,
    expiraEm: Date.now() + Number(dados.expires_in || 3600) * 1000,
  };
  return cacheFcm;
}

async function enviarFcm(
  auth: FcmAuth,
  token: string,
  item: FilaItem,
): Promise<{ ok: boolean; erro: string; tokenInvalido: boolean }> {
  const p = (item.payload || {}) as Record<string, unknown>;
  const cidadeOrigem = String(p.cidade_origem || "");
  const cidadeDestino = String(p.cidade_destino || "");
  const valorPrestador = p.valor_prestador != null ? String(p.valor_prestador) : "";
  const rota =
    String(p.rota || "") ||
    [cidadeOrigem, cidadeDestino].filter(Boolean).join(" ━➤ ");
  const osId = item.os_id ? String(item.os_id) : "";

  const payload = {
    message: {
      token,
      notification: {
        title: item.titulo || "Novo chamado em aberto",
        body: item.mensagem || "Nova OS disponível para você.",
      },
      android: {
        priority: "high",
        notification: {
          // Ícone oficial já existente no app (android/app/src/main/res/drawable/ic_notification.png).
          icon: "ic_notification",
          color: "#2E1065",
          sound: "default",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      data: {
        tipo: String(item.tipo || "nova_os"),
        os_id: osId,
        notificacao_id: item.notificacao_id ? String(item.notificacao_id) : "",
        cidade_origem: cidadeOrigem,
        cidade_destino: cidadeDestino,
        valor_prestador: valorPrestador,
        rota,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    },
  };

  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const texto = await resp.text();
  if (resp.ok) return { ok: true, erro: "", tokenInvalido: false };

  const tokenInvalido = /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND|registration-token-not-registered/i.test(
    texto,
  );
  return { ok: false, erro: texto.slice(0, 500), tokenInvalido };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "SEM_CONFIG_SUPABASE" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const internal = req.headers.get("x-internal-token") || "";
  const shared = Deno.env.get("PUSH_INTERNAL_TOKEN") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const autorizadoServico =
    authHeader === `Bearer ${serviceKey}` || (Boolean(shared) && internal === shared);

  // Permite que o TMS (usuário autenticado) acione o processamento da fila
  // pelo botão "Notificar base/agregados", sem expor a service role no browser.
  let autorizadoUsuario = false;
  if (!autorizadoServico && anonKey && authHeader.startsWith("Bearer ")) {
    try {
      const clienteUsuario = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data } = await clienteUsuario.auth.getUser();
      autorizadoUsuario = Boolean(data?.user);
    } catch {
      autorizadoUsuario = false;
    }
  }

  if (!autorizadoServico && !autorizadoUsuario) {
    return json({ error: "NAO_AUTORIZADO" }, 401);
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const filaId = body && typeof body.fila_id === "string" ? body.fila_id : null;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    let consulta = supabase
      .from("push_notificacoes_fila")
      .select("id, notificacao_id, prestador_id, titulo, mensagem, tipo, os_id, payload, tentativas")
      .eq("status", "pendente")
      .order("created_at", { ascending: true })
      .limit(filaId ? 1 : 20);
    if (filaId) consulta = consulta.eq("id", filaId);

    const { data: fila, error } = await consulta;
    if (error) return json({ error: error.message }, 500);
    if (!fila || fila.length === 0) return json({ ok: true, processados: 0 });

    const fcm = await obterFcmAuth();
    if (!fcm) {
      return json(
        {
          error: "FCM_NAO_CONFIGURADO",
          message:
            "Configure o secret FCM_SERVICE_ACCOUNT_JSON (ou FCM_ACCESS_TOKEN + FCM_PROJECT_ID) no Supabase.",
        },
        503,
      );
    }

    let enviados = 0;
    let erros = 0;
    let semToken = 0;

    for (const item of fila as FilaItem[]) {
      await supabase
        .from("push_notificacoes_fila")
        .update({ status: "enviando" })
        .eq("id", item.id);

      const { data: tokens } = await supabase
        .from("motorista_push_tokens")
        .select("id, token")
        .eq("prestador_id", item.prestador_id)
        .eq("ativo", true);

      if (!tokens || tokens.length === 0) {
        await supabase
          .from("push_notificacoes_fila")
          .update({ status: "sem_token", erro: "Nenhum token FCM ativo para o prestador." })
          .eq("id", item.id);
        semToken++;
        continue;
      }

      let algumOk = false;
      let ultimoErro = "";

      for (const t of tokens as TokenItem[]) {
        const resultado = await enviarFcm(fcm, t.token, item);
        if (resultado.ok) {
          algumOk = true;
          enviados++;
        } else {
          ultimoErro = resultado.erro;
          if (resultado.tokenInvalido) {
            await supabase
              .from("motorista_push_tokens")
              .update({ ativo: false, updated_at: new Date().toISOString() })
              .eq("id", t.id);
          }
        }
      }

      await supabase
        .from("push_notificacoes_fila")
        .update({
          status: algumOk ? "enviado" : "erro",
          enviado_em: algumOk ? new Date().toISOString() : null,
          tentativas: Number(item.tentativas || 0) + 1,
          erro: algumOk ? null : ultimoErro.slice(0, 500),
        })
        .eq("id", item.id);

      if (!algumOk) erros++;
    }

    return json({ ok: true, processados: fila.length, enviados, erros, semToken });
  } catch (erro) {
    console.error("[enviar-push] erro:", erro);
    return json({ error: "ERRO_INTERNO", message: String(erro) }, 500);
  }
});
