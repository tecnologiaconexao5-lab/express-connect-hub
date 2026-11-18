// ===================================================================
// Edge Function: nfse-upload-certificado
//
// Upload seguro do certificado digital A1 (.pfx/.p12) de um emitente
// para o bucket privado `certificados-fiscais`, com senha criptografada
// de forma REVERSÍVEL (AES-GCM 256, Web Crypto nativa do Deno).
//
// POST multipart/form-data:
//   - file         (File, .pfx/.p12, <= 10 MB)
//   - password     (string, obrigatória)
//   - emitente_id  (UUID de configuracoes_fiscais)
//
// Auth: Bearer JWT do Supabase (usuário precisa existir em tenant_usuarios).
//
// Storage: certificados-fiscais/{emitente_id}/certificado_ativo.pfx (upsert)
// Tabela : certificados_fiscais (UPDATE mais recente do emitente; INSERT se não houver)
//
// Senha: gravada em `senha_hash` como `aes-gcm:<iv_b64>:<cifrado_b64>`,
// usando o secret NFSE_CRYPTO_KEY. O motor de assinatura NFS-e reverte
// com `descriptografarSenha()` de `_shared/nfseCrypto.ts`.
// ===================================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  criptografarSenha,
  obterChaveCriptografia,
} from "../_shared/nfseCrypto.ts";

const BUCKET = "certificados-fiscais";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (mesmo limite do bucket)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTENSOES_ACEITAS = [".pfx", ".p12"];
const MIMES_ACEITOS = new Set([
  "application/x-pkcs12",
  "application/pkcs12",
  "application/octet-stream",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respostaJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extrairBearer(req: Request): string {
  const header = req.headers.get("Authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respostaJson(
      { success: false, error: "Método não permitido. Use POST." },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("[nfse-upload-certificado] Env vars ausentes.");
      return respostaJson(
        { success: false, error: "Configuração interna incompleta." },
        500,
      );
    }

    // ---------- 0) Chave de criptografia (falha cedo) ----------
    let chaveCriptografia: CryptoKey;
    try {
      chaveCriptografia = await obterChaveCriptografia();
    } catch (keyErr) {
      console.error(
        "[nfse-upload-certificado] Falha ao carregar NFSE_CRYPTO_KEY:",
        keyErr instanceof Error ? keyErr.message : String(keyErr),
      );
      return respostaJson(
        { success: false, error: "Configuração de criptografia indisponível." },
        500,
      );
    }

    // ---------- 1) Autenticação (Bearer JWT) ----------
    const token = extrairBearer(req);
    if (!token) {
      return respostaJson(
        { success: false, error: "Token de autenticação ausente." },
        401,
      );
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(
      token,
    );
    if (userError || !userData?.user) {
      return respostaJson(
        { success: false, error: "Sessão inválida ou expirada." },
        401,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Somente usuários do TMS (tenant_usuarios) podem enviar certificados.
    const { count: staffCount, error: staffError } = await admin
      .from("tenant_usuarios")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id);

    if (staffError) {
      console.error(
        "[nfse-upload-certificado] Falha ao validar perfil:",
        staffError.message,
      );
      return respostaJson(
        { success: false, error: "Falha ao validar permissões." },
        500,
      );
    }
    if (!staffCount) {
      return respostaJson(
        {
          success: false,
          error: "Usuário sem permissão para enviar certificados.",
        },
        403,
      );
    }

    // ---------- 2) Payload multipart/form-data ----------
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("multipart/form-data")) {
      return respostaJson(
        {
          success: false,
          error: "Envie a requisição como multipart/form-data.",
        },
        415,
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return respostaJson(
        { success: false, error: "Formulário inválido." },
        400,
      );
    }

    const file = form.get("file");
    const password = form.get("password");
    const emitenteIdRaw = form.get("emitente_id");

    if (!(file instanceof File)) {
      return respostaJson(
        { success: false, error: "Arquivo 'file' não enviado." },
        400,
      );
    }

    if (typeof password !== "string" || password.length === 0) {
      return respostaJson(
        { success: false, error: "Senha do certificado é obrigatória." },
        400,
      );
    }
    if (password.length > 1024) {
      return respostaJson(
        { success: false, error: "Senha do certificado inválida." },
        400,
      );
    }

    if (
      typeof emitenteIdRaw !== "string" || !UUID_RE.test(emitenteIdRaw.trim())
    ) {
      return respostaJson(
        { success: false, error: "emitente_id inválido." },
        400,
      );
    }
    const emitenteId = emitenteIdRaw.trim();

    // ---------- 3) Validação do arquivo ----------
    const nomeOriginal = (file.name || "").split(/[\\/]/).pop() ||
      "certificado.pfx";
    const ponto = nomeOriginal.lastIndexOf(".");
    const extensao = ponto >= 0 ? nomeOriginal.slice(ponto).toLowerCase() : "";

    if (!EXTENSOES_ACEITAS.includes(extensao)) {
      return respostaJson(
        {
          success: false,
          error: "Formato inválido. Envie um arquivo .pfx ou .p12.",
        },
        400,
      );
    }
    if (file.size <= 0) {
      return respostaJson(
        { success: false, error: "Arquivo vazio." },
        400,
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return respostaJson(
        { success: false, error: "Arquivo excede o limite de 10 MB." },
        413,
      );
    }
    const mime = (file.type || "").toLowerCase();
    if (mime && !MIMES_ACEITOS.has(mime)) {
      return respostaJson(
        {
          success: false,
          error: "Tipo de arquivo não permitido para certificado A1.",
        },
        415,
      );
    }

    // ---------- 4) Emitente existe? ----------
    const { data: emitente, error: emitenteError } = await admin
      .from("configuracoes_fiscais")
      .select("id, razao_social, cnpj")
      .eq("id", emitenteId)
      .maybeSingle();

    if (emitenteError) {
      console.error(
        "[nfse-upload-certificado] Erro ao buscar emitente:",
        emitenteError.message,
      );
      return respostaJson(
        { success: false, error: "Falha ao consultar o emitente." },
        500,
      );
    }
    if (!emitente) {
      return respostaJson(
        { success: false, error: "Emitente não encontrado." },
        404,
      );
    }

    // ---------- 5) Criptografia da senha + upload no Storage ----------
    const senhaCriptografada = await criptografarSenha(
      password,
      chaveCriptografia,
    );
    const storagePath = `${emitenteId}/certificado_ativo.pfx`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        upsert: true,
        contentType: "application/x-pkcs12",
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error(
        "[nfse-upload-certificado] Falha no upload:",
        uploadError.message,
      );
      return respostaJson(
        { success: false, error: "Falha ao armazenar o certificado." },
        500,
      );
    }

    // ---------- 6) Persistência em certificados_fiscais ----------
    const agoraIso = new Date().toISOString();

    const { data: existente, error: buscaError } = await admin
      .from("certificados_fiscais")
      .select("id")
      .eq("emitente_id", emitenteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (buscaError) {
      console.error(
        "[nfse-upload-certificado] Erro ao buscar certificado:",
        buscaError.message,
      );
      return respostaJson(
        { success: false, error: "Falha ao consultar o certificado." },
        500,
      );
    }

    let certificadoId: string;

    if (existente?.id) {
      certificadoId = existente.id;
      const { error: updateError } = await admin
        .from("certificados_fiscais")
        .update({
          nome_arquivo: nomeOriginal,
          storage_path: storagePath,
          senha_hash: senhaCriptografada,
          status: "enviado",
          ativo: true,
          validade_inicio: null,
          validade_fim: null,
          updated_at: agoraIso,
        })
        .eq("id", certificadoId);

      if (updateError) {
        console.error(
          "[nfse-upload-certificado] Erro no UPDATE certificados_fiscais:",
          updateError.message,
        );
        return respostaJson(
          { success: false, error: "Falha ao registrar o certificado." },
          500,
        );
      }
    } else {
      const { data: inserido, error: insertError } = await admin
        .from("certificados_fiscais")
        .insert({
          emitente_id: emitenteId,
          nome_arquivo: nomeOriginal,
          storage_path: storagePath,
          tipo: "A1",
          status: "enviado",
          ativo: true,
          senha_hash: senhaCriptografada,
          metadata: {
            origem: "nfse-upload-certificado",
            uploaded_by: userData.user.id,
            senha_formato: "aes-gcm",
          },
        })
        .select("id")
        .single();

      if (insertError || !inserido?.id) {
        console.error(
          "[nfse-upload-certificado] Erro no INSERT certificados_fiscais:",
          insertError?.message,
        );
        return respostaJson(
          { success: false, error: "Falha ao registrar o certificado." },
          500,
        );
      }
      certificadoId = inserido.id;
    }

    // ---------- 7) Refletir no emitente (não-fatal) ----------
    const { error: emitenteUpdateError } = await admin
      .from("configuracoes_fiscais")
      .update({
        certificado_configurado: true,
        certificado_nome: nomeOriginal,
        certificado_status: "enviado",
      })
      .eq("id", emitenteId);

    if (emitenteUpdateError) {
      console.warn(
        "[nfse-upload-certificado] Aviso: emitente não atualizado:",
        emitenteUpdateError.message,
      );
    }

    // ---------- 8) Auditoria (não-fatal) ----------
    const { error: logError } = await admin.from("fiscal_logs").insert([{
      entidade_tipo: "CERTIFICADO",
      entidade_id: certificadoId,
      acao: "UPLOAD_CERTIFICADO_A1",
      request: {
        emitente_id: emitenteId,
        nome_arquivo: nomeOriginal,
        tamanho_bytes: file.size,
      },
      response: {
        storage_path: storagePath,
        status: "enviado",
        senha_formato: "aes-gcm",
      },
    }]);
    if (logError) {
      console.warn(
        "[nfse-upload-certificado] Aviso: log fiscal não gravado:",
        logError.message,
      );
    }

    // ---------- 9) Resposta limpa (sem senha/cifra) ----------
    return respostaJson({
      success: true,
      message: "Certificado A1 enviado com sucesso.",
      certificado: {
        id: certificadoId,
        emitente_id: emitenteId,
        nome_arquivo: nomeOriginal,
        storage_path: storagePath,
        tipo: "A1",
        status: "enviado",
      },
    });
  } catch (err) {
    console.error(
      "[nfse-upload-certificado] Erro inesperado:",
      err instanceof Error ? err.message : String(err),
    );
    return respostaJson(
      {
        success: false,
        error: "Não foi possível processar o upload do certificado.",
      },
      500,
    );
  }
});
