// ===================================================================
// Edge Function: nfse-assinar-transmitir
//
// Fluxo:
//   1. Autentica (JWT + tenant_usuarios) e recebe { nfse_id }.
//   2. Le o rascunho em fiscal_nfse (metadata JSONB).
//   3. Resolve a matriz (configuracoes_fiscais) e o certificado ativo.
//   4. Baixa o PFX do Storage e decifra a senha (AES-GCM).
//   5. Gera a DPS (nfseDps), assina (XMLDSig RSA-SHA256) e transmite mTLS.
//   6. Persiste sucesso (emitida) ou rejeicao (erro_emissao) + logs.
//
// SEGURANCA: senha do certificado, PFX e chave privada NUNCA vao para
// logs, respostas ou metadata.
// ===================================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  descriptografarSenha,
  obterChaveCriptografia,
} from "../_shared/nfseCrypto.ts";
import { gerarXmlDpsNacional } from "../_shared/nfseDps.ts";
import type {
  DpsPayload,
  FiscalCompanySettings,
} from "../_shared/nfseDps.ts";
import { abrirPfx, CertificadoError } from "../_shared/nfsePfx.ts";
import type { MaterialCertificado } from "../_shared/nfsePfx.ts";
import { assinarDpsXml, assinarEventoXml } from "../_shared/nfseXmlSign.ts";
import {
  transmitirEventoParaSefin,
  transmitirParaSefin,
} from "../_shared/nfseSefin.ts";
import type {
  RespostaEventoSefin,
  RespostaSefin,
} from "../_shared/nfseSefin.ts";
import { baixarDanfseOficialAdn } from "../_shared/nfseAdn.ts";
import type { ResultadoDanfseOficial } from "../_shared/nfseAdn.ts";
import {
  codigoAmbiente,
  gerarXmlPedRegEventoCancelamento,
  MOTIVOS_CANCELAMENTO,
  motivoCancelamentoValido,
  validarJustificativaCancelamento,
} from "../_shared/nfseEvento.ts";
import { enviarEmailNfse } from "../_shared/nfseEmail.ts";
import type { AnexoEmailNfse } from "../_shared/nfseEmail.ts";

const BUCKET_CERTIFICADOS = "certificados-fiscais";
const BUCKET_DOCUMENTOS = "fiscal-documentos";
const CNPJ_MATRIZ_NFSE = "31227975000180";
const CODIGO_SERVICO_PADRAO = "16.02.01.002";
/** NBS padrão da operação (transporte rodoviário de cargas) — 9 dígitos na DPS. */
const CODIGO_NBS_PADRAO = "1.0501.15.00";
/** Descrição padrão oficial da NFS-e (fallback quando o rascunho não informar). */
const DESCRICAO_SERVICO_PADRAO =
  "Prestação de serviços de coleta e entrega de mercadorias, conforme programação operacional definida pelo contratante.";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cliente Supabase com service role (escrita irrestrita). */
type AdminClient = SupabaseClient<any, "public", any>;

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

// Rede de seguranca: evita que um rejection nao tratado derrube o worker
// sem resposta HTTP (o que apareceria como "Failed to send a request").
globalThis.addEventListener("unhandledrejection", function(event) {
  event.preventDefault();
  const motivo = event.reason instanceof Error
    ? `${event.reason.name}: ${event.reason.message}`
    : String(event.reason);
  console.error(
    "[nfse-assinar-transmitir] Unhandled rejection:",
    motivo.replace(/\s+/g, " ").slice(0, 300),
  );
});

function somenteDigitos(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "");
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string" && valor.trim()) return valor.trim();
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return null;
}

function truncar(valor: string, limite = 1000): string {
  return valor.length > limite ? valor.slice(0, limite) + "..." : valor;
}

function resolverEndpointSefin(ambiente: string): string | null {
  const geral = Deno.env.get("NFSE_SEFIN_URL")?.trim();
  if (geral) return geral;

  const producao = Deno.env.get("NFSE_SEFIN_URL_PRODUCAO")?.trim();
  const homologacao = Deno.env.get("NFSE_SEFIN_URL_HOMOLOGACAO")?.trim();

  return ambiente.toLowerCase().startsWith("prod")
    ? (producao || null)
    : (homologacao || null);
}

/**
 * Endpoint oficial do registro de evento: POST /nfse/{chave}/eventos.
 * Overrides: NFSE_SEFIN_EVENTO_URL_(PRODUCAO|HOMOLOGACAO) ou
 * NFSE_SEFIN_EVENTO_URL (template com `{chave}` ou base). Senao deriva da
 * base da Sefin (secret de emissao) e, por fim, usa os dominios oficiais.
 */
function resolverEndpointEvento(
  ambiente: string,
  chaveAcesso: string,
): string {
  const ehProducao = codigoAmbiente(ambiente) === "1";
  const template = Deno.env.get(
    ehProducao
      ? "NFSE_SEFIN_EVENTO_URL_PRODUCAO"
      : "NFSE_SEFIN_EVENTO_URL_HOMOLOGACAO",
  )?.trim() || Deno.env.get("NFSE_SEFIN_EVENTO_URL")?.trim();

  if (template) {
    if (template.includes("{chave}")) {
      return template.replace(/\{chave\}/g, chaveAcesso);
    }
    return `${template.replace(/\/+$/, "")}/nfse/${chaveAcesso}/eventos`;
  }

  const base = resolverEndpointSefin(ambiente);
  if (base) {
    const raiz = base.replace(/\/+$/, "").replace(/\/(nfse|dps)$/i, "");
    return `${raiz}/nfse/${chaveAcesso}/eventos`;
  }

  const oficial = ehProducao
    ? "https://sefin.nfse.gov.br/SefinNacional"
    : "https://sefin.producaorestrita.nfse.gov.br/SefinNacional";
  return `${oficial}/nfse/${chaveAcesso}/eventos`;
}

async function registrarEvento(
  admin: AdminClient,
  nfseId: string,
  tipoEvento: string,
  descricao: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("fiscal_events").insert([{
    documento_tipo: "NFSE",
    documento_id: nfseId,
    tipo_evento: tipoEvento,
    descricao: truncar(descricao, 500),
    metadata,
  }]);
  if (error) {
    console.warn("[nfse-assinar-transmitir] Aviso: evento nao gravado:", error.message);
  }
}

async function registrarLog(
  admin: AdminClient,
  nfseId: string,
  request: Record<string, unknown>,
  response: Record<string, unknown>,
  statusCode: number,
): Promise<void> {
  const { error } = await admin.from("fiscal_logs").insert([{
    entidade_tipo: "NFSE",
    entidade_id: nfseId,
    acao: "NFSE_ASSINAR_TRANSMITIR",
    request,
    response,
    status_code: statusCode,
  }]);
  if (error) {
    console.warn("[nfse-assinar-transmitir] Aviso: log nao gravado:", error.message);
  }
}

async function atualizarRascunho(
  admin: AdminClient,
  nfseId: string,
  patch: Record<string, unknown>,
  metadataAtual: Record<string, unknown>,
  metadataExtra: Record<string, unknown>,
): Promise<void> {
  const metadata = { ...metadataAtual, ...metadataExtra };
  const { error } = await admin
    .from("fiscal_nfse")
    .update({
      ...patch,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", nfseId);

  if (error) {
    throw new Error("Falha ao persistir o resultado da NFS-e.");
  }
}

/**
 * Baixa o DANFSe oficial com um limite total rigido, para nunca atrasar
 * a resposta da emissao. Retorna ok=false (sem lancar) em timeout/falha.
 */
async function baixarDanfseComLimite(
  chaveAcesso: string,
  ambiente: string,
  material: { keyPem: string; chainPem: string },
  limiteMs: number,
): Promise<ResultadoDanfseOficial> {
  // O download recebe um orcamento um pouco menor que o limite externo para
  // que ele consiga devolver o detalhe de cada estrategia antes do race.
  const orcamentoMs = Math.max(3000, limiteMs - 600);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      baixarDanfseOficialAdn(chaveAcesso, ambiente, material, {
        timeoutMs: orcamentoMs,
      }),
      new Promise<ResultadoDanfseOficial>((resolve) => {
        timer = setTimeout(function() {
          resolve({
            ok: false,
            status: 0,
            bytes: null,
            contentType: null,
            erro: "tempo esgotado aguardando o DANFSe no ADN",
            url: "",
          });
        }, limiteMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function caminhoPdfOficialSalvo(
  admin: AdminClient,
  rascunho: Record<string, unknown>,
  meta: Record<string, unknown>,
): Promise<string | null> {
  const documentos = objeto(meta.documentos_storage) ?? {};
  const candidatos = [
    texto(meta.pdf_oficial_path),
    texto(documentos.danfse_oficial),
    texto(documentos.danfse_pdf),
    texto(documentos.nfse_pdf),
    texto(rascunho.pdf_url),
  ].filter((valor): valor is string => Boolean(valor));

  for (const candidato of candidatos) {
    if (/^https?:\/\//i.test(candidato)) continue;
    const caminho = candidato.replace(/^fiscal-documentos\//, "");
    const { error } = await admin.storage
      .from(BUCKET_DOCUMENTOS)
      .createSignedUrl(caminho, 60);
    if (!error) return caminho;
  }
  return null;
}

function formatarDataHoraBr(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

function escaparHtmlEmail(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ResultadoEnvioEmailNota {
  ok: boolean;
  configurado: boolean;
  provider: string | null;
  messageId: string | null;
  erro: string | null;
  secretsFaltando: string[];
  destinatario: string | null;
  anexos: { xml: boolean; pdf: boolean };
}

/** Baixa um anexo do Storage (XML/PDF) e gera signed URL para o webhook. */
async function carregarAnexoNota(
  admin: AdminClient,
  caminhoBruto: string | null,
  nome: string,
  contentType: string,
): Promise<AnexoEmailNfse | null> {
  const caminho = String(caminhoBruto || "").trim();
  if (!caminho) return null;

  if (/^https?:\/\//i.test(caminho)) {
    try {
      const resposta = await fetch(caminho);
      if (!resposta.ok) return null;
      const bytes = new Uint8Array(await resposta.arrayBuffer());
      return { nome, content_type: contentType, bytes, signed_url: caminho };
    } catch {
      return null;
    }
  }

  const limpo = caminho.replace(/^fiscal-documentos\//, "");
  const { data: blob, error } = await admin.storage
    .from(BUCKET_DOCUMENTOS)
    .download(limpo);
  if (error || !blob) {
    console.warn(
      "[nfse-assinar-transmitir] Anexo de e-mail indisponivel:",
      limpo,
      error?.message || "sem arquivo",
    );
    return null;
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { data: signed } = await admin.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(limpo, 600);

  return {
    nome,
    content_type: contentType,
    bytes,
    signed_url: signed?.signedUrl ?? null,
  };
}

/**
 * Monta e envia o e-mail da NFS-e ao tomador (XML + DANFSe quando houver) e
 * registra o evento em fiscal_events. Nunca lanca: devolve o resultado.
 */
async function enviarEmailDaNfse(
  admin: AdminClient,
  nfseId: string,
  rascunho: Record<string, unknown>,
  meta: Record<string, unknown>,
): Promise<ResultadoEnvioEmailNota> {
  const tomador = objeto(meta.tomador) ?? {};
  const destinatario = texto(tomador["email"]);
  const numero = texto(rascunho.numero) || "S/N";
  const chave = somenteDigitos(rascunho.chave_acesso);
  const dataEmissao = texto(rascunho.data_emissao) || new Date().toISOString();
  const valor = Number(meta.valor_liquido ?? rascunho.valor ?? 0) || 0;
  const valorTxt = valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const docs = objeto(meta.documentos_storage) ?? {};
  const xmlPath = texto(docs.nfse_retorno) || texto(docs.nfse_dps) ||
    texto(rascunho.xml_url);
  const pdfPath = texto(meta.pdf_oficial_path) ||
    texto(docs.danfse_oficial) || texto(docs.danfse_pdf) ||
    texto(docs.nfse_pdf) || texto(rascunho.pdf_url);

  const anexoXml = await carregarAnexoNota(
    admin,
    xmlPath,
    `NFSe-${numero}.xml`,
    "application/xml",
  );
  const anexoPdf = await carregarAnexoNota(
    admin,
    pdfPath,
    `DANFSe-NFSe-${numero}.pdf`,
    "application/pdf",
  );
  const anexos: AnexoEmailNfse[] = [];
  if (anexoXml) anexos.push(anexoXml);
  if (anexoPdf) anexos.push(anexoPdf);
  const anexosInfo = { xml: Boolean(anexoXml), pdf: Boolean(anexoPdf) };

  if (!destinatario) {
    return {
      ok: false,
      configurado: true,
      provider: null,
      messageId: null,
      erro: "Tomador sem e-mail cadastrado.",
      secretsFaltando: [],
      destinatario: null,
      anexos: anexosInfo,
    };
  }

  const assunto = `NFS-e nº ${numero} - Conexão Express`;
  const dataTxt = formatarDataHoraBr(dataEmissao);
  const chaveTxt = chave || texto(rascunho.chave_acesso) || "—";
  const anexosTxt = anexos.map((a) => a.nome).join(", ") ||
    "indisponiveis no momento";

  const text = [
    "Ola,",
    "",
    `Segue a NFS-e n ${numero} emitida pela Conexao Express.`,
    "",
    `Data: ${dataTxt}`,
    `Valor: ${valorTxt}`,
    `Chave de acesso: ${chaveTxt}`,
    "",
    `Documentos em anexo: ${anexosTxt}.`,
    "",
    "Atenciosamente,",
    "Conexao Express Transportes",
  ].join("\n");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:14px;line-height:1.55">` +
    `<p>Olá,</p>` +
    `<p>Segue a <strong>NFS-e nº ${escaparHtmlEmail(numero)}</strong> emitida pela <strong>Conexão Express Transportes</strong>.</p>` +
    `<table style="border-collapse:collapse;margin:14px 0">` +
    `<tr><td style="padding:4px 14px 4px 0;color:#6b7280">Número</td><td style="font-weight:600">${escaparHtmlEmail(numero)}</td></tr>` +
    `<tr><td style="padding:4px 14px 4px 0;color:#6b7280">Data</td><td>${escaparHtmlEmail(dataTxt)}</td></tr>` +
    `<tr><td style="padding:4px 14px 4px 0;color:#6b7280">Valor</td><td>${escaparHtmlEmail(valorTxt)}</td></tr>` +
    `<tr><td style="padding:4px 14px 4px 0;color:#6b7280">Chave de acesso</td><td style="font-family:monospace;font-size:12px">${escaparHtmlEmail(chaveTxt)}</td></tr>` +
    `</table>` +
    `<p>Documentos em anexo: ${escaparHtmlEmail(anexosTxt)}.</p>` +
    `<p>Atenciosamente,<br/><strong>Conexão Express Transportes</strong></p>` +
    `</div>`;

  const resultado = await enviarEmailNfse({
    to: [destinatario],
    subject: assunto,
    html,
    text,
    anexos,
    meta: { nfse_id: nfseId, numero, chave_acesso: chave, valor },
  });

  await registrarEvento(
    admin,
    nfseId,
    resultado.ok ? "NFSE_EMAIL_ENVIADO" : "NFSE_EMAIL_FALHA",
    resultado.ok
      ? `E-mail da NFS-e ${numero} enviado para ${destinatario}.`
      : `Falha ao enviar e-mail da NFS-e ${numero}: ${
        resultado.erro || "erro"
      }`,
    {
      destinatario,
      provider: resultado.provider,
      message_id: resultado.messageId,
      configurado: resultado.configurado,
      secrets_faltando: resultado.secretsFaltando,
      anexo_xml: anexosInfo.xml,
      anexo_pdf: anexosInfo.pdf,
    },
  );

  return {
    ok: resultado.ok,
    configurado: resultado.configurado,
    provider: resultado.provider,
    messageId: resultado.messageId,
    erro: resultado.erro,
    secretsFaltando: resultado.secretsFaltando,
    destinatario,
    anexos: anexosInfo,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return respostaJson(
      { success: false, error: "Metodo nao permitido. Use POST." },
      405,
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("[nfse-assinar-transmitir] Env vars do Supabase ausentes.");
      return respostaJson(
        { success: false, error: "Configuracao interna incompleta." },
        500,
      );
    }

    // ---------- 1) Autenticacao ----------
    const token = extrairBearer(req);
    if (!token) {
      return respostaJson(
        { success: false, error: "Token de autenticacao ausente." },
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
        { success: false, error: "Sessao invalida ou expirada." },
        401,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { count: staffCount, error: staffError } = await admin
      .from("tenant_usuarios")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id);

    if (staffError) {
      console.error("[nfse-assinar-transmitir] Falha ao validar perfil:", staffError.message);
      return respostaJson(
        { success: false, error: "Falha ao validar permissoes." },
        500,
      );
    }
    if (!staffCount) {
      return respostaJson(
        { success: false, error: "Usuario sem permissao para emitir NFS-e." },
        403,
      );
    }

    // ---------- 2) Payload ----------
    let body:
      | {
        nfse_id?: string;
        acao?: string;
        codigo_motivo?: string | number;
        justificativa?: string;
      }
      | null = null;
    try {
      body = await req.json();
    } catch {
      return respostaJson({ success: false, error: "JSON invalido." }, 400);
    }

    const nfseId = (body?.nfse_id || "").trim();
    if (!UUID_RE.test(nfseId)) {
      return respostaJson({ success: false, error: "nfse_id invalido." }, 400);
    }

    // acao "baixar_danfse": busca/entrega o PDF oficial sob demanda
    // (nao transmite nada). Sem acao: fluxo normal de emissao.
    const acao = String(body?.acao || "emitir").trim().toLowerCase();
    const baixarDanfse = acao === "baixar_danfse" ||
      acao === "baixar_danfse_oficial";
    const cancelar = acao === "cancelar";
    const enviarEmail = acao === "enviar_email";

    // ---------- 3) Rascunho ----------
    const { data: rascunho, error: draftError } = await admin
      .from("fiscal_nfse")
      .select("*")
      .eq("id", nfseId)
      .maybeSingle();

    if (draftError) {
      console.error("[nfse-assinar-transmitir] Erro ao ler rascunho:", draftError.message);
      return respostaJson(
        { success: false, error: "Falha ao consultar o rascunho." },
        500,
      );
    }
    if (!rascunho) {
      return respostaJson(
        { success: false, error: "Rascunho NFS-e nao encontrado." },
        404,
      );
    }

    const statusAtual = String(rascunho.status || "").toLowerCase();

    if (cancelar) {
      if (statusAtual === "cancelada") {
        return respostaJson(
          { success: false, error: "Esta NFS-e ja esta cancelada." },
          409,
        );
      }
      if (statusAtual !== "emitida") {
        return respostaJson(
          {
            success: false,
            error: "Somente notas emitidas podem ser canceladas.",
          },
          409,
        );
      }
    } else if (!baixarDanfse && !enviarEmail) {
      if (statusAtual === "emitida") {
        return respostaJson(
          { success: false, error: "Esta NFS-e ja foi emitida." },
          409,
        );
      }
      if (statusAtual === "processando") {
        return respostaJson(
          { success: false, error: "Esta NFS-e ja esta em processamento." },
          409,
        );
      }
    }

    const meta = objeto(rascunho.metadata) ?? {};
    const emitenteMeta = objeto(meta.emitente);
    const tomadorMeta = objeto(meta.tomador);

    // ---------- 3.1) Envio de e-mail ao tomador (acao enviar_email) ----------
    if (enviarEmail) {
      if (statusAtual !== "emitida" && statusAtual !== "cancelada") {
        return respostaJson(
          {
            success: false,
            configurado: true,
            error: "Somente NFS-e emitidas podem ser enviadas por e-mail.",
          },
          409,
        );
      }

      const emailTomador = texto(tomadorMeta?.["email"]);
      if (!emailTomador) {
        return respostaJson(
          {
            success: false,
            configurado: true,
            error: "A NFS-e nao possui e-mail do tomador cadastrado.",
          },
          422,
        );
      }

      const envio = await enviarEmailDaNfse(admin, nfseId, rascunho, meta);
      await registrarLog(
        admin,
        nfseId,
        { acao: "NFSE_EMAIL", destinatario: envio.destinatario },
        {
          sucesso: envio.ok,
          provider: envio.provider,
          message_id: envio.messageId,
          configurado: envio.configurado,
        },
        envio.ok ? 200 : (envio.configurado ? 502 : 503),
      );

      return respostaJson(
        {
          success: envio.ok,
          configurado: envio.configurado,
          envio_real: envio.ok,
          provider: envio.provider,
          message_id: envio.messageId,
          error: envio.ok ? undefined : envio.erro,
          mensagem: envio.ok
            ? "E-mail enviado ao tomador."
            : (envio.configurado
              ? "Falha ao enviar o e-mail."
              : "Envio de e-mail nao configurado no backend."),
          secrets_faltando: envio.secretsFaltando,
          anexos: envio.anexos,
        },
        envio.ok ? 200 : (envio.configurado ? 502 : 503),
      );
    }

    // ---------- 4) Matriz ----------
    const { data: emitentes, error: emitentesError } = await admin
      .from("configuracoes_fiscais")
      .select(
        "id, cnpj, razao_social, nome_fantasia, ie, inscricao_municipal, codigo_ibge, uf, cidade, logradouro, numero, complemento, bairro, cep, email, telefone, regime_tributario, crt, ambiente_fiscal, padrao, metadata",
      )
      .eq("ativo", true);

    if (emitentesError) {
      return respostaJson(
        { success: false, error: "Falha ao consultar a matriz fiscal." },
        500,
      );
    }

    const listaEmitentes = (emitentes || []) as Array<Record<string, unknown>>;
    const cnpjMeta = somenteDigitos(emitenteMeta?.["cnpj"]);
    const matriz = listaEmitentes.find((e) =>
      somenteDigitos(e["cnpj"]) === CNPJ_MATRIZ_NFSE
    ) ||
      (cnpjMeta ? listaEmitentes.find((e) => somenteDigitos(e["cnpj"]) === cnpjMeta) : undefined) ||
      listaEmitentes.find((e) => e["padrao"] === true);

    if (!matriz) {
      return respostaJson(
        {
          success: false,
          error: "Matriz fiscal nao encontrada em configuracoes_fiscais.",
        },
        422,
      );
    }

    const ambiente = String(matriz["ambiente_fiscal"] ?? "homologacao");
    const inscricaoMunicipal = somenteDigitos(matriz["inscricao_municipal"]);
    const endpoint = resolverEndpointSefin(ambiente);
    if (!endpoint && !cancelar) {
      return respostaJson(
        {
          success: false,
          error:
            "Endpoint da Sefin nao configurado (NFSE_SEFIN_URL_PRODUCAO / NFSE_SEFIN_URL_HOMOLOGACAO).",
        },
        500,
      );
    }

    // ---------- 5) Certificado ----------
    const { data: certAtivo } = await admin
      .from("certificados_fiscais")
      .select("*")
      .eq("emitente_id", matriz["id"])
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const certificado = certAtivo || (await admin
      .from("certificados_fiscais")
      .select("*")
      .eq("emitente_id", matriz["id"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()).data;

    if (!certificado?.storage_path || !certificado?.senha_hash) {
      return respostaJson(
        {
          success: false,
          error: "Certificado A1 nao configurado para a matriz.",
        },
        422,
      );
    }

    const validade = certificado.validade_fim || certificado.validade;
    if (validade && new Date(String(validade)) < new Date()) {
      return respostaJson(
        { success: false, error: "Certificado A1 vencido." },
        422,
      );
    }

    // Download do PFX
    const { data: pfxBlob, error: downloadError } = await admin.storage
      .from(BUCKET_CERTIFICADOS)
      .download(String(certificado.storage_path));

    if (downloadError || !pfxBlob) {
      console.error(
        "[nfse-assinar-transmitir] Falha ao baixar certificado:",
        downloadError?.message || "sem arquivo",
      );
      return respostaJson(
        { success: false, error: "Falha ao obter o certificado do Storage." },
        500,
      );
    }

    const pfxBytes = new Uint8Array(await pfxBlob.arrayBuffer());

    // Senha: decifra e usa apenas para abrir o PFX (nunca logar).
    let senha: string;
    try {
      const chaveCripto = await obterChaveCriptografia();
      senha = await descriptografarSenha(
        String(certificado.senha_hash),
        chaveCripto,
      );
    } catch (erro) {
      console.error(
        "[nfse-assinar-transmitir] Senha do certificado: codigo=senha_ilegivel detalhe=" +
          (erro instanceof Error
            ? `${erro.name}: ${erro.message.slice(0, 300)}`
            : "erro desconhecido"),
      );
      return respostaJson(
        {
          success: false,
          codigo: "senha_ilegivel",
          error:
            "Nao foi possivel abrir o certificado A1 (codigo: senha_ilegivel). Reenvie o certificado e a senha.",
        },
        422,
      );
    }

    let material: MaterialCertificado;
    try {
      material = await abrirPfx(pfxBytes, senha);
    } catch (erro) {
      const codigo = erro instanceof CertificadoError
        ? erro.codigo
        : "erro_desconhecido_certificado";

      if (erro instanceof CertificadoError) {
        // Log tecnico sanitizado (sem senha/PFX/chave) para diagnostico.
        console.error(
          `[nfse-assinar-transmitir] Certificado A1: codigo=${erro.codigo} detalhe=${erro.detalhe}`,
        );
      } else {
        console.error(
          "[nfse-assinar-transmitir] Falha ao abrir certificado:",
          erro instanceof Error
            ? `${erro.name}: ${erro.message.slice(0, 300)}`
            : "erro desconhecido",
        );
      }

      return respostaJson(
        {
          success: false,
          codigo,
          error:
            `Nao foi possivel abrir o certificado A1 (codigo: ${codigo}). Reenvie o certificado e a senha.`,
        },
        422,
      );
    }

    // ---------- 5.0) Cancelamento (evento e101101) ----------
    if (cancelar) {
      const motivoCodigo = String(body?.codigo_motivo ?? "").trim();
      if (!motivoCancelamentoValido(motivoCodigo)) {
        return respostaJson(
          {
            success: false,
            error: "Motivo do cancelamento invalido (use 1, 2 ou 9).",
          },
          400,
        );
      }

      const justificativa = validarJustificativaCancelamento(
        body?.justificativa,
      );
      if (!justificativa.ok) {
        return respostaJson(
          { success: false, error: justificativa.erro },
          400,
        );
      }

      const metaEmissao = objeto(meta.emissao) ?? {};
      const chaveAcesso = somenteDigitos(
        rascunho.chave_acesso || metaEmissao["chave_acesso"],
      );
      if (!/^\d{50}$/.test(chaveAcesso)) {
        await registrarEvento(
          admin,
          nfseId,
          "NFSE_CANCELAMENTO_FALHA",
          "NFS-e sem chave de acesso valida para cancelamento.",
          { ambiente, motivo_codigo: motivoCodigo },
        );
        return respostaJson(
          {
            success: false,
            status: statusAtual,
            error:
              "NFS-e sem chave de acesso valida (50 digitos). Somente notas emitidas podem ser canceladas.",
          },
          422,
        );
      }

      // Ambiente da PROPRIA nota (gravado na emissao), nao o da matriz atual.
      const ambienteNota = texto(metaEmissao["ambiente"]) || ambiente;
      const cnpjAutor = somenteDigitos(matriz["cnpj"]);

      let xmlEvento: string;
      try {
        xmlEvento = gerarXmlPedRegEventoCancelamento({
          chaveAcesso,
          ambiente: ambienteNota,
          cnpjAutor,
          codigoMotivo: motivoCodigo,
          justificativa: justificativa.texto,
        });
      } catch (erro) {
        return respostaJson(
          {
            success: false,
            error: erro instanceof Error
              ? erro.message
              : "Falha ao gerar o evento de cancelamento.",
          },
          422,
        );
      }

      let xmlEventoAssinado: string;
      try {
        xmlEventoAssinado = assinarEventoXml(xmlEvento, {
          keyPem: material.keyPem,
          certPem: material.certPem,
        });
      } catch (erro) {
        console.error(
          "[nfse-assinar-transmitir] Falha ao assinar evento:",
          erro instanceof Error ? erro.message : "erro",
        );
        return respostaJson(
          { success: false, error: "Falha ao assinar o evento de cancelamento." },
          500,
        );
      }

      const carimboCancel = new Date().toISOString().replace(/[:.]/g, "-");
      const eventoPath = `nfse/${nfseId}/evento-cancelamento-${carimboCancel}.xml`;
      const { error: uploadEventoError } = await admin.storage
        .from(BUCKET_DOCUMENTOS)
        .upload(
          eventoPath,
          new Blob([xmlEventoAssinado], { type: "application/xml" }),
          { contentType: "application/xml", upsert: true },
        );
      if (uploadEventoError) {
        console.warn(
          "[nfse-assinar-transmitir] Aviso: XML do evento nao arquivado:",
          uploadEventoError.message,
        );
      }

      const endpointEvento = resolverEndpointEvento(
        ambienteNota,
        chaveAcesso,
      );

      let respostaEvento: RespostaEventoSefin;
      let timerEvento: ReturnType<typeof setTimeout> | undefined;
      try {
        const limiteEvento = new Promise<never>((_, reject) => {
          timerEvento = setTimeout(function() {
            reject(
              new Error(
                "Tempo total de cancelamento excedido (32s). Verifique a conectividade com a Sefin.",
              ),
            );
          }, 32000);
        });
        try {
          respostaEvento = await Promise.race([
            transmitirEventoParaSefin(
              xmlEventoAssinado,
              { keyPem: material.keyPem, chainPem: material.chainPem },
              endpointEvento,
            ),
            limiteEvento,
          ]);
        } finally {
          if (timerEvento !== undefined) clearTimeout(timerEvento);
        }
      } catch (erro) {
        const motivo = erro instanceof Error
          ? erro.message
          : "Falha de comunicacao com a Sefin.";
        console.error(
          "[nfse-assinar-transmitir] Falha de comunicacao no cancelamento:",
          motivo,
        );
        await registrarEvento(
          admin,
          nfseId,
          "NFSE_CANCELAMENTO_FALHA",
          motivo,
          {
            ambiente: ambienteNota,
            chave_acesso: chaveAcesso,
            motivo_codigo: motivoCodigo,
            erro_comunicacao: true,
          },
        );
        await registrarLog(
          admin,
          nfseId,
          { ambiente: ambienteNota, endpoint: endpointEvento, motivo_codigo: motivoCodigo },
          { sucesso: false, erro: truncar(motivo) },
          502,
        );
        return respostaJson(
          { success: false, status: "emitida", error: motivo },
          502,
        );
      }

      if (respostaEvento.ok) {
        const canceladoEm = new Date().toISOString();

        if (respostaEvento.eventoXml) {
          const retornoEventoPath =
            `nfse/${nfseId}/evento-cancelamento-retorno-${carimboCancel}.xml`;
          const { error } = await admin.storage
            .from(BUCKET_DOCUMENTOS)
            .upload(
              retornoEventoPath,
              new Blob([respostaEvento.eventoXml], {
                type: "application/xml",
              }),
              { contentType: "application/xml", upsert: true },
            );
          if (error) {
            console.warn(
              "[nfse-assinar-transmitir] Aviso: retorno do evento nao arquivado:",
              error.message,
            );
          }
        }

        const motivoDescricao = MOTIVOS_CANCELAMENTO[motivoCodigo] ?? null;
        try {
          await atualizarRascunho(
            admin,
            nfseId,
            { status: "cancelada", motivo_rejeicao: null },
            meta,
            {
              cancelamento: {
                protocolo: respostaEvento.protocolo,
                data: canceladoEm,
                motivo_codigo: motivoCodigo,
                motivo_descricao: motivoDescricao,
                justificativa: justificativa.texto,
                ambiente: ambienteNota,
                chave_acesso: chaveAcesso,
                http_status: respostaEvento.httpStatus,
                xml_storage_path: uploadEventoError ? null : eventoPath,
                retorno: respostaEvento.corpoResumo,
              },
            },
          );
        } catch (erro) {
          console.error(
            "[nfse-assinar-transmitir] CANCELADA, mas falhou ao persistir:",
            erro instanceof Error ? erro.message : "erro",
          );
          return respostaJson(
            {
              success: false,
              status: "cancelada",
              error:
                "NFS-e cancelada na Sefin, mas falhou ao salvar o resultado. Verifique o banco.",
              protocolo: respostaEvento.protocolo,
              chave_acesso: chaveAcesso,
            },
            500,
          );
        }

        await registrarEvento(
          admin,
          nfseId,
          "NFSE_CANCELADA",
          `NFS-e cancelada (motivo ${motivoCodigo}).`,
          {
            ambiente: ambienteNota,
            chave_acesso: chaveAcesso,
            protocolo: respostaEvento.protocolo,
            motivo_codigo: motivoCodigo,
          },
        );
        await registrarLog(
          admin,
          nfseId,
          { ambiente: ambienteNota, endpoint: endpointEvento, motivo_codigo: motivoCodigo },
          {
            sucesso: true,
            http_status: respostaEvento.httpStatus,
            protocolo: respostaEvento.protocolo,
          },
          200,
        );

        return respostaJson({
          success: true,
          status: "cancelada",
          protocolo: respostaEvento.protocolo,
          chave_acesso: chaveAcesso,
          motivo_codigo: motivoCodigo,
          motivo_descricao: motivoDescricao,
          data: canceladoEm,
        });
      }

      // Rejeicao da Sefin: a nota permanece "emitida" (nao altera status nem
      // motivo_rejeicao da emissao). Guarda o detalhe para auditoria.
      const motivoRejeicao = truncar(
        [respostaEvento.codigoRejeicao, respostaEvento.mensagemRejeicao]
          .filter(Boolean)
          .join(" - ") || "Cancelamento rejeitado pela Sefin.",
        1000,
      );

      try {
        await atualizarRascunho(admin, nfseId, {}, meta, {
          cancelamento_falha: {
            motivo_codigo: motivoCodigo,
            justificativa: justificativa.texto,
            codigo: respostaEvento.codigoRejeicao,
            mensagem: respostaEvento.mensagemRejeicao,
            http_status: respostaEvento.httpStatus,
            ambiente: ambienteNota,
            resposta_resumo: respostaEvento.corpoResumo,
            data: new Date().toISOString(),
          },
        });
      } catch { /* best-effort */ }

      await registrarEvento(
        admin,
        nfseId,
        "NFSE_CANCELAMENTO_FALHA",
        motivoRejeicao,
        {
          ambiente: ambienteNota,
          chave_acesso: chaveAcesso,
          motivo_codigo: motivoCodigo,
          http_status: respostaEvento.httpStatus,
          codigo: respostaEvento.codigoRejeicao,
        },
      );
      await registrarLog(
        admin,
        nfseId,
        { ambiente: ambienteNota, endpoint: endpointEvento, motivo_codigo: motivoCodigo },
        {
          sucesso: false,
          http_status: respostaEvento.httpStatus,
          codigo: respostaEvento.codigoRejeicao,
          mensagem: respostaEvento.mensagemRejeicao,
          resposta: respostaEvento.corpoResumo,
        },
        respostaEvento.httpStatus || 400,
      );

      return respostaJson({
        success: false,
        status: "emitida",
        rejeicao: {
          codigo: respostaEvento.codigoRejeicao,
          mensagem: respostaEvento.mensagemRejeicao,
          http_status: respostaEvento.httpStatus,
        },
        error: motivoRejeicao,
      }, 200);
    }

    // ---------- 5.1) DANFSe oficial sob demanda ----------
    if (baixarDanfse) {
      const metaEmissao = objeto(meta.emissao) ?? {};
      const chaveAcesso = somenteDigitos(
        rascunho.chave_acesso || metaEmissao["chave_acesso"],
      );
      if (!chaveAcesso) {
        return respostaJson(
          {
            success: false,
            error:
              "NFS-e sem chave de acesso autorizada. O PDF oficial so existe apos a emissao.",
          },
          422,
        );
      }

      const caminhoSalvo = await caminhoPdfOficialSalvo(admin, rascunho, meta);
      if (caminhoSalvo) {
        const { data: signed } = await admin.storage
          .from(BUCKET_DOCUMENTOS)
          .createSignedUrl(caminhoSalvo, 3600);
        if (signed?.signedUrl) {
          await registrarEvento(
            admin,
            nfseId,
            "DANFSE_OFICIAL_ENTREGUE",
            "PDF oficial recuperado do Storage.",
            { chave_acesso: chaveAcesso, caminho: caminhoSalvo },
          );
          return respostaJson({
            success: true,
            status: "emitida",
            chave_acesso: chaveAcesso,
            pdf_oficial_path: caminhoSalvo,
            links: { xml: null, pdf: signed.signedUrl },
          });
        }
      }

      const download = await baixarDanfseComLimite(
        chaveAcesso,
        ambiente,
        { keyPem: material.keyPem, chainPem: material.chainPem },
        12000,
      );

      if (!download.ok || !download.bytes) {
        console.warn(
          "[nfse-assinar-transmitir] Aviso: DANFSe oficial indisponivel sob demanda:",
          truncar(download.erro || "sem PDF", 300),
        );
        await registrarEvento(
          admin,
          nfseId,
          "DANFSE_OFICIAL_FALHA",
          download.erro || "Falha ao baixar o DANFSe oficial.",
          {
            ambiente,
            chave_acesso: chaveAcesso,
            http_status: download.status,
          },
        );
        return respostaJson(
          {
            success: false,
            error: download.status === 404
              ? "O ADN respondeu HTTP 404: o DANFSe oficial nao esta disponivel para esta nota neste ambiente."
              : download.status >= 500
                ? `O ADN de producao esta temporariamente indisponivel (HTTP ${download.status}). Tente novamente em alguns minutos.`
                : "Nao foi possivel baixar o PDF oficial agora. O ADN pode ainda nao disponibilizar o arquivo; tente novamente em instantes.",
            detalhe: truncar(download.erro || "sem PDF", 300),
          },
          502,
        );
      }

      const caminho = `nfse/${chaveAcesso}-oficial.pdf`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET_DOCUMENTOS)
        .upload(
          caminho,
          new Blob([new Uint8Array(download.bytes)], {
            type: "application/pdf",
          }),
          { contentType: "application/pdf", upsert: true },
        );

      if (uploadError) {
        console.error(
          "[nfse-assinar-transmitir] Falha ao arquivar DANFSe oficial:",
          uploadError.message,
        );
        return respostaJson(
          {
            success: false,
            error: "Falha ao arquivar o PDF oficial no Storage.",
          },
          500,
        );
      }

      const baixadoEm = new Date().toISOString();
      await atualizarRascunho(
        admin,
        nfseId,
        { pdf_url: caminho },
        meta,
        {
          pdf_oficial_path: caminho,
          pdf_oficial: {
            caminho,
            ambiente,
            http_status: download.status,
            bytes: download.bytes.length,
            baixado_em: baixadoEm,
          },
          documentos_storage: {
            ...(objeto(meta.documentos_storage) ?? {}),
            danfse_oficial: caminho,
          },
        },
      );

      const { data: signedFinal } = await admin.storage
        .from(BUCKET_DOCUMENTOS)
        .createSignedUrl(caminho, 3600);

      await registrarEvento(
        admin,
        nfseId,
        "DANFSE_OFICIAL_ARQUIVADO",
        "PDF oficial baixado do ADN e arquivado no Storage.",
        { chave_acesso: chaveAcesso, caminho, bytes: download.bytes.length },
      );

      return respostaJson({
        success: true,
        status: "emitida",
        chave_acesso: chaveAcesso,
        pdf_oficial_path: caminho,
        links: { xml: null, pdf: signedFinal?.signedUrl ?? null },
      });
    }

    // A partir daqui e somente emissao (cancelamento/DANFSe retornaram acima):
    // garante o endpoint da Sefin (narrowing de tipo e defesa extra).
    if (!endpoint) {
      return respostaJson(
        {
          success: false,
          error:
            "Endpoint da Sefin nao configurado (NFSE_SEFIN_URL_PRODUCAO / NFSE_SEFIN_URL_HOMOLOGACAO).",
        },
        500,
      );
    }

    // ---------- 6) DPS ----------
    const numeroDpsMeta = texto(meta.numero_dps);
    const serieMeta = texto(meta.serie) || "1";
    const competenciaMeta = texto(meta.competencia);
    const competencia = competenciaMeta && /^\d{4}-\d{2}$/.test(competenciaMeta)
      ? competenciaMeta
      : new Date(rascunho.created_at || Date.now()).toISOString().slice(0, 7);

    const codigoServicoMeta = texto(meta.codigo_servico) ||
      CODIGO_SERVICO_PADRAO;
    const codigoNbsMeta = texto(meta.codigo_nbs) ||
      (codigoServicoMeta === CODIGO_SERVICO_PADRAO ? CODIGO_NBS_PADRAO : null);

    const retencoesMeta = objeto(meta.retencoes) ?? {};
    const retencoesDps = {
      pis: Number(retencoesMeta["pis"] ?? 0) || 0,
      cofins: Number(retencoesMeta["cofins"] ?? 0) || 0,
      csll: Number(retencoesMeta["csll"] ?? 0) || 0,
      irrf: Number(retencoesMeta["irrf"] ?? 0) || 0,
      inss: Number(retencoesMeta["inss"] ?? 0) || 0,
    };
    const temRetencoes = Object.values(retencoesDps)
      .some((valor) => valor > 0);
    const tributosMeta = objeto(meta.tributos_aproximados);
    const tributosValor = Number(tributosMeta?.["valor"] ?? 0) || 0;

    const dps: DpsPayload = {
      competencia,
      dataCompetencia: texto(meta.data_competencia) || null,
      prestador: {
        cnpj: String(matriz["cnpj"] ?? ""),
        inscricaoMunicipal: inscricaoMunicipal || null,
        razaoSocial: texto(matriz["razao_social"]),
        municipioIbge: texto(matriz["codigo_ibge"]),
      },
      tomador: {
        nome: texto(tomadorMeta?.["nome"]) || "",
        cnpj: texto(tomadorMeta?.["cnpj"]),
        cpf: texto(tomadorMeta?.["cpf"]),
        email: texto(tomadorMeta?.["email"]),
        inscricaoMunicipal: texto(tomadorMeta?.["inscricao_municipal"]),
      },
      servico: {
        codigoTributacaoNacional: codigoServicoMeta,
        descricao: texto(meta.servico) || DESCRICAO_SERVICO_PADRAO,
        valorServico: Number(meta.valor_servico ?? rascunho.valor ?? 0),
        aliquotaIss: meta.aliquota_iss != null
          ? Number(meta.aliquota_iss)
          : null,
        issRetido: meta.iss_retido === true,
        codigoMunicipioPrestacao: texto(meta.codigo_municipio_prestacao) ||
          texto(matriz["codigo_ibge"]),
        codigoNbs: codigoNbsMeta,
        informacoesComplementares: texto(meta.pedido_compra) || null,
      },
      retencoes: temRetencoes ? retencoesDps : null,
      exigibilidadeIss: texto(meta.exigibilidade_iss) || "tributavel",
      tributosAproximados: tributosValor > 0
        ? {
          tipo: texto(tributosMeta?.["tipo"]) === "valor"
            ? "valor"
            : "percentual",
          valor: tributosValor,
        }
        : null,
      serie: serieMeta,
      numero: numeroDpsMeta,
      nfseId,
    };

    const matrizMeta = objeto(matriz["metadata"]) ?? {};
    const nfseNacionalMeta = objeto(matrizMeta["nfse_nacional"]) ?? {};
    // Regime tributário configurável no Editar Emitente (fallback 3/1).
    const opSimpNacEmitente = texto(nfseNacionalMeta["op_simp_nac"]) || "3";
    const regApTribSNEmitente = texto(nfseNacionalMeta["reg_ap_trib_sn"]) || "1";

    const empresa: FiscalCompanySettings = {
      cnpj: String(matriz["cnpj"] ?? ""),
      razaoSocial: String(matriz["razao_social"] ?? ""),
      nomeFantasia: texto(matriz["nome_fantasia"]),
      inscricaoMunicipal: inscricaoMunicipal || null,
      codigoIbge: texto(matriz["codigo_ibge"]),
      uf: texto(matriz["uf"]),
      cidade: texto(matriz["cidade"]),
      logradouro: texto(matriz["logradouro"]),
      numero: texto(matriz["numero"]),
      complemento: texto(matriz["complemento"]),
      bairro: texto(matriz["bairro"]),
      cep: texto(matriz["cep"]),
      email: texto(matriz["email"]),
      telefone: texto(matriz["telefone"]),
      regimeTributario: texto(matriz["regime_tributario"]),
      crt: texto(matriz["crt"]),
      opSimpNac: opSimpNacEmitente,
      regApTribSN: regApTribSNEmitente,
      ambienteFiscal: ambiente,
    };

    let xmlDps: string;
    try {
      xmlDps = gerarXmlDpsNacional(dps, empresa);
    } catch (erro) {
      console.error(
        "[nfse-assinar-transmitir] DPS invalida:",
        erro instanceof Error ? erro.message : "erro",
      );
      return respostaJson(
        {
          success: false,
          error: erro instanceof Error
            ? erro.message
            : "Rascunho incompleto para emissao.",
        },
        422,
      );
    }

    // ---------- 7) Assinatura ----------
    let xmlAssinado: string;
    try {
      xmlAssinado = assinarDpsXml(xmlDps, {
        keyPem: material.keyPem,
        certPem: material.certPem,
      });
    } catch (erro) {
      console.error(
        "[nfse-assinar-transmitir] Falha na assinatura:",
        erro instanceof Error ? erro.message : "erro",
      );
      return respostaJson(
        { success: false, error: "Falha ao assinar o XML da DPS." },
        500,
      );
    }

    const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
    const assinadoPath = `nfse/${nfseId}/dps-assinada-${carimbo}.xml`;

    const { error: uploadAssinadoError } = await admin.storage
      .from(BUCKET_DOCUMENTOS)
      .upload(
        assinadoPath,
        new Blob([xmlAssinado], { type: "application/xml" }),
        { contentType: "application/xml", upsert: true },
      );

    if (uploadAssinadoError) {
      console.warn(
        "[nfse-assinar-transmitir] Aviso: XML assinado nao arquivado:",
        uploadAssinadoError.message,
      );
    }

    // ---------- 8) Transmissao ----------
    let resposta: RespostaSefin;
    let timerTransmissao: ReturnType<typeof setTimeout> | undefined;
    try {
      const limiteTotal = new Promise<never>((_, reject) => {
        timerTransmissao = setTimeout(function() {
          reject(
            new Error(
              "Tempo total de transmissao excedido (32s). Verifique a conectividade com a Sefin.",
            ),
          );
        }, 32000);
      });

      try {
        resposta = await Promise.race([
          transmitirParaSefin(
            xmlAssinado,
            { keyPem: material.keyPem, chainPem: material.chainPem },
            endpoint,
          ),
          limiteTotal,
        ]);
      } finally {
        if (timerTransmissao !== undefined) clearTimeout(timerTransmissao);
      }
    } catch (erro) {
      const motivo = erro instanceof Error
        ? erro.message
        : "Falha de comunicacao com a Sefin.";

      console.error(
        "[nfse-assinar-transmitir] Falha de comunicacao Sefin:",
        motivo,
      );

      try {
        await atualizarRascunho(
          admin,
          nfseId,
          { status: "erro_emissao", motivo_rejeicao: truncar(motivo) },
          meta,
          {
            assinatura: {
              algoritmo: "rsa-sha256",
              certificado_subject: material.subject,
              certificado_validade_fim: material.validadeFim,
              assinado_em: new Date().toISOString(),
              xml_storage_path: uploadAssinadoError ? null : assinadoPath,
            },
            emissao: {
              ambiente,
              http_status: null,
              erro_comunicacao: truncar(motivo),
            },
          },
        );
      } catch { /* best-effort */ }

      await registrarEvento(
        admin,
        nfseId,
        "EMISSAO_NFSE_FALHA_COMUNICACAO",
        motivo,
        { ambiente },
      );
      await registrarLog(
        admin,
        nfseId,
        { ambiente, endpoint },
        { sucesso: false, erro: truncar(motivo) },
        502,
      );

      return respostaJson(
        { success: false, status: "erro_emissao", error: motivo },
        502,
      );
    }

    // ---------- 9) Sucesso ----------
    if (resposta.ok) {
      let retornoPath: string | null = null;
      if (resposta.xmlRetorno) {
        retornoPath = `nfse/${nfseId}/retorno-${carimbo}.xml`;
        const { error } = await admin.storage
          .from(BUCKET_DOCUMENTOS)
          .upload(
            retornoPath,
            new Blob([resposta.xmlRetorno], { type: "application/xml" }),
            { contentType: "application/xml", upsert: true },
          );
        if (error) {
          console.warn(
            "[nfse-assinar-transmitir] Aviso: XML de retorno nao arquivado:",
            error.message,
          );
          retornoPath = null;
        }
      }

      // PDF oficial: tenta baixar do ADN logo apos a autorizacao. Falha/timeout
      // NAO derruba a emissao — fica registrado para nova tentativa sob demanda.
      const chaveAcessoOficial = somenteDigitos(resposta.chaveAcesso);
      let pdfOficialPath: string | null = null;
      let pdfOficialInfo: Record<string, unknown> | null = null;
      if (chaveAcessoOficial) {
        try {
          const download = await baixarDanfseComLimite(
            chaveAcessoOficial,
            ambiente,
            { keyPem: material.keyPem, chainPem: material.chainPem },
            12000,
          );

          if (download.ok && download.bytes) {
            const caminho = `nfse/${chaveAcessoOficial}-oficial.pdf`;
            const { error: uploadError } = await admin.storage
              .from(BUCKET_DOCUMENTOS)
              .upload(
                caminho,
                new Blob([new Uint8Array(download.bytes)], {
                  type: "application/pdf",
                }),
                { contentType: "application/pdf", upsert: true },
              );

            if (uploadError) {
              console.warn(
                "[nfse-assinar-transmitir] Aviso: DANFSe oficial nao arquivada:",
                uploadError.message,
              );
              pdfOficialInfo = {
                erro: "upload_falhou",
                detalhe: truncar(uploadError.message, 200),
              };
            } else {
              pdfOficialPath = caminho;
              pdfOficialInfo = {
                caminho,
                ambiente,
                http_status: download.status,
                bytes: download.bytes.length,
                baixado_em: new Date().toISOString(),
              };
            }
          } else {
            console.warn(
              "[nfse-assinar-transmitir] Aviso: DANFSe oficial indisponivel:",
              truncar(download.erro || "sem PDF", 300),
            );
            pdfOficialInfo = {
              erro: "download_falhou",
              detalhe: truncar(download.erro || "sem PDF", 300),
              http_status: download.status,
            };
          }
        } catch (erro) {
          pdfOficialInfo = {
            erro: "excecao",
            detalhe: truncar(
              erro instanceof Error ? erro.message : String(erro),
              300,
            ),
          };
        }
      }

      const numeroOficial = resposta.numero ||
        (rascunho.numero ? String(rascunho.numero) : null);
      const xmlUrl = resposta.xmlUrl || retornoPath;
      const pdfUrl = pdfOficialPath || resposta.pdfUrl;
      const emitidoEm = new Date().toISOString();

      // Envio automatico ao tomador quando marcado no wizard (best-effort,
      // com timeout). O helper nao lanca e registra NFSE_EMAIL_* em fiscal_events.
      let emailTomadorInfo: Record<string, unknown> | null = null;
      if (meta.enviar_email_tomador === true) {
        try {
          const docsEmail = objeto(meta.documentos_storage) ?? {};
          const metaParaEmail: Record<string, unknown> = {
            ...meta,
            ...(pdfOficialPath ? { pdf_oficial_path: pdfOficialPath } : {}),
            documentos_storage: {
              ...docsEmail,
              ...(retornoPath ? { nfse_retorno: retornoPath } : {}),
              ...(pdfOficialPath ? { danfse_oficial: pdfOficialPath } : {}),
            },
          };
          const rascunhoParaEmail: Record<string, unknown> = {
            ...rascunho,
            status: "emitida",
            numero: numeroOficial,
            chave_acesso: resposta.chaveAcesso,
            data_emissao: emitidoEm,
            xml_url: xmlUrl,
            pdf_url: pdfOficialPath ?? rascunho.pdf_url,
          };
          const envioAuto = await Promise.race([
            enviarEmailDaNfse(admin, nfseId, rascunhoParaEmail, metaParaEmail),
            new Promise<null>((resolve) => {
              setTimeout(function() { resolve(null); }, 15000);
            }),
          ]);
          if (envioAuto) {
            emailTomadorInfo = {
              enviado: envioAuto.ok,
              enviado_em: new Date().toISOString(),
              destinatario: envioAuto.destinatario,
              provider: envioAuto.provider,
              message_id: envioAuto.messageId,
              configurado: envioAuto.configurado,
              erro: envioAuto.erro,
            };
          }
        } catch (erro) {
          console.warn(
            "[nfse-assinar-transmitir] Aviso: envio automatico de e-mail falhou:",
            erro instanceof Error ? erro.message.slice(0, 200) : "erro",
          );
        }
      }

      try {
        await atualizarRascunho(
          admin,
          nfseId,
          {
            status: "emitida",
            numero: numeroOficial,
            chave_acesso: resposta.chaveAcesso,
            protocolo: resposta.protocolo,
            xml_url: xmlUrl,
            pdf_url: pdfUrl,
            data_emissao: emitidoEm,
            motivo_rejeicao: null,
          },
          meta,
          {
            assinatura: {
              algoritmo: "rsa-sha256",
              certificado_subject: material.subject,
              certificado_validade_fim: material.validadeFim,
              assinado_em: emitidoEm,
              xml_storage_path: uploadAssinadoError ? null : assinadoPath,
            },
            emissao: {
              ambiente,
              http_status: resposta.httpStatus,
              id_dps: resposta.idDps,
              chave_acesso: resposta.chaveAcesso,
              numero: numeroOficial,
              protocolo: resposta.protocolo,
              retorno: resposta.corpoResumo,
            },
            rejeicao: null,
            ...(emailTomadorInfo ? { email_tomador: emailTomadorInfo } : {}),
            ...(pdfOficialPath
              ? { pdf_oficial_path: pdfOficialPath }
              : {}),
            pdf_oficial: pdfOficialInfo,
            documentos_storage: {
              ...(objeto(meta.documentos_storage) ?? {}),
              nfse_dps: uploadAssinadoError ? null : assinadoPath,
              nfse_retorno: retornoPath,
              ...(pdfOficialPath ? { danfse_oficial: pdfOficialPath } : {}),
            },
          },
        );
      } catch (erro) {
        console.error(
          "[nfse-assinar-transmitir] EMITIDA, mas falhou ao persistir:",
          erro instanceof Error ? erro.message : "erro",
        );
        return respostaJson(
          {
            success: false,
            status: "emitida",
            error:
              "NFS-e emitida na Sefin, mas falhou ao salvar o resultado. Verifique o banco.",
            numero: numeroOficial,
            chave_acesso: resposta.chaveAcesso,
          },
          500,
        );
      }

      const links: { xml: string | null; pdf: string | null } = {
        xml: xmlUrl,
        pdf: pdfUrl,
      };

      if (xmlUrl && !/^https?:\/\//i.test(xmlUrl)) {
        const { data } = await admin.storage
          .from(BUCKET_DOCUMENTOS)
          .createSignedUrl(xmlUrl, 3600);
        links.xml = data?.signedUrl ?? null;
      }
      if (pdfUrl && !/^https?:\/\//i.test(pdfUrl)) {
        const { data } = await admin.storage
          .from(BUCKET_DOCUMENTOS)
          .createSignedUrl(pdfUrl, 3600);
        links.pdf = data?.signedUrl ?? null;
      }

      if (!pdfOficialPath && chaveAcessoOficial) {
        await registrarEvento(
          admin,
          nfseId,
          "DANFSE_OFICIAL_FALHA",
          "PDF oficial nao baixado na emissao; disponivel sob demanda.",
          {
            ambiente,
            chave_acesso: chaveAcessoOficial,
            detalhe: texto(pdfOficialInfo?.["detalhe"]),
          },
        );
      }

      await registrarEvento(
        admin,
        nfseId,
        "EMISSAO_NFSE_SUCESSO",
        `NFS-e emitida${numeroOficial ? " n. " + numeroOficial : ""}.`,
        {
          ambiente,
          chave_acesso: resposta.chaveAcesso,
          protocolo: resposta.protocolo,
        },
      );
      await registrarLog(
        admin,
        nfseId,
        { ambiente, endpoint },
        {
          sucesso: true,
          http_status: resposta.httpStatus,
          numero: numeroOficial,
          chave_acesso: resposta.chaveAcesso,
        },
        200,
      );

      return respostaJson({
        success: true,
        status: "emitida",
        id_dps: resposta.idDps,
        numero: numeroOficial,
        chave_acesso: resposta.chaveAcesso,
        protocolo: resposta.protocolo,
        pdf_oficial_path: pdfOficialPath,
        links,
      });
    }

    // ---------- 10) Rejeicao ----------
    console.error(
      "[nfse-assinar-transmitir] Rejeicao Sefin:",
      `status=${resposta.httpStatus}`,
      `body=${resposta.corpoResumo.slice(0, 600)}`,
    );

    const motivo = truncar(
      [resposta.codigoRejeicao, resposta.mensagemRejeicao]
        .filter(Boolean)
        .join(" - ") || "Rejeicao sem detalhe.",
    );

    try {
      await atualizarRascunho(
        admin,
        nfseId,
        { status: "erro_emissao", motivo_rejeicao: motivo },
        meta,
        {
          assinatura: {
            algoritmo: "rsa-sha256",
            certificado_subject: material.subject,
            certificado_validade_fim: material.validadeFim,
            assinado_em: new Date().toISOString(),
            xml_storage_path: uploadAssinadoError ? null : assinadoPath,
          },
          rejeicao: {
            codigo: resposta.codigoRejeicao,
            mensagem: resposta.mensagemRejeicao,
            http_status: resposta.httpStatus,
            resposta_resumo: resposta.corpoResumo,
          },
          emissao: {
            ambiente,
            http_status: resposta.httpStatus,
          },
          documentos_storage: {
            ...(objeto(meta.documentos_storage) ?? {}),
            nfse_dps: uploadAssinadoError ? null : assinadoPath,
          },
        },
      );
    } catch (erro) {
      console.error(
        "[nfse-assinar-transmitir] Falha ao persistir rejeicao:",
        erro instanceof Error ? erro.message : "erro",
      );
    }

    await registrarEvento(
      admin,
      nfseId,
      "EMISSAO_NFSE_REJEITADA",
      motivo,
      {
        ambiente,
        http_status: resposta.httpStatus,
        codigo: resposta.codigoRejeicao,
      },
    );
    await registrarLog(
      admin,
      nfseId,
      { ambiente, endpoint },
      {
        sucesso: false,
        http_status: resposta.httpStatus,
        codigo: resposta.codigoRejeicao,
        mensagem: resposta.mensagemRejeicao,
        resposta: resposta.corpoResumo,
      },
      resposta.httpStatus,
    );

    return respostaJson({
      success: false,
      status: "erro_emissao",
      rejeicao: {
        codigo: resposta.codigoRejeicao,
        mensagem: resposta.mensagemRejeicao,
        http_status: resposta.httpStatus,
      },
    }, 200);
  } catch (erro) {
    console.error(
      "[nfse-assinar-transmitir] Erro inesperado:",
      erro instanceof Error ? erro.message : String(erro),
    );
    return respostaJson(
      { success: false, error: "Nao foi possivel processar a emissao." },
      500,
    );
  }
});
