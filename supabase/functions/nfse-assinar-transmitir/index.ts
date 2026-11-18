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
import { assinarDpsXml } from "../_shared/nfseXmlSign.ts";
import { transmitirParaSefin } from "../_shared/nfseSefin.ts";
import type { RespostaSefin } from "../_shared/nfseSefin.ts";

const BUCKET_CERTIFICADOS = "certificados-fiscais";
const BUCKET_DOCUMENTOS = "fiscal-documentos";
const CNPJ_MATRIZ_NFSE = "31227975000180";
const CODIGO_SERVICO_PADRAO = "16.02.01.002";
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
    let body: { nfse_id?: string } | null = null;
    try {
      body = await req.json();
    } catch {
      return respostaJson({ success: false, error: "JSON invalido." }, 400);
    }

    const nfseId = (body?.nfse_id || "").trim();
    if (!UUID_RE.test(nfseId)) {
      return respostaJson({ success: false, error: "nfse_id invalido." }, 400);
    }

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

    const meta = objeto(rascunho.metadata) ?? {};
    const emitenteMeta = objeto(meta.emitente);
    const tomadorMeta = objeto(meta.tomador);

    // ---------- 4) Matriz ----------
    const { data: emitentes, error: emitentesError } = await admin
      .from("configuracoes_fiscais")
      .select("*")
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
    const endpoint = resolverEndpointSefin(ambiente);
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

    // ---------- 6) DPS ----------
    const numeroDpsMeta = texto(meta.numero_dps);
    const serieMeta = texto(meta.serie) || "1";
    const competenciaMeta = texto(meta.competencia);
    const competencia = competenciaMeta && /^\d{4}-\d{2}$/.test(competenciaMeta)
      ? competenciaMeta
      : new Date(rascunho.created_at || Date.now()).toISOString().slice(0, 7);

    const dps: DpsPayload = {
      competencia,
      prestador: {
        cnpj: String(matriz["cnpj"] ?? ""),
        inscricaoMunicipal: texto(matriz["inscricao_municipal"]),
        razaoSocial: texto(matriz["razao_social"]),
        municipioIbge: texto(matriz["codigo_ibge"]),
      },
      tomador: {
        nome: texto(tomadorMeta?.["nome"]) || "",
        cnpj: texto(tomadorMeta?.["cnpj"]),
        cpf: texto(tomadorMeta?.["cpf"]),
        email: texto(tomadorMeta?.["email"]),
      },
      servico: {
        codigoTributacaoNacional: texto(meta.codigo_servico) ||
          CODIGO_SERVICO_PADRAO,
        descricao: texto(meta.servico) || "Transporte de bens ou valores",
        valorServico: Number(meta.valor_servico ?? rascunho.valor ?? 0),
        aliquotaIss: meta.aliquota_iss != null
          ? Number(meta.aliquota_iss)
          : null,
        issRetido: meta.iss_retido === true,
        codigoMunicipioPrestacao: texto(meta.codigo_municipio_prestacao) ||
          texto(matriz["codigo_ibge"]),
      },
      serie: serieMeta,
      numero: numeroDpsMeta,
      nfseId,
    };

    const empresa: FiscalCompanySettings = {
      cnpj: String(matriz["cnpj"] ?? ""),
      razaoSocial: String(matriz["razao_social"] ?? ""),
      nomeFantasia: texto(matriz["nome_fantasia"]),
      inscricaoMunicipal: texto(matriz["inscricao_municipal"]),
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

      const numeroOficial = resposta.numero ||
        (rascunho.numero ? String(rascunho.numero) : null);
      const xmlUrl = resposta.xmlUrl || retornoPath;
      const pdfUrl = resposta.pdfUrl;
      const emitidoEm = new Date().toISOString();

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
              chave_acesso: resposta.chaveAcesso,
              numero: numeroOficial,
              protocolo: resposta.protocolo,
              retorno: resposta.corpoResumo,
            },
            rejeicao: null,
            documentos_storage: {
              ...(objeto(meta.documentos_storage) ?? {}),
              nfse_dps: uploadAssinadoError ? null : assinadoPath,
              nfse_retorno: retornoPath,
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
        numero: numeroOficial,
        chave_acesso: resposta.chaveAcesso,
        protocolo: resposta.protocolo,
        links,
      });
    }

    // ---------- 10) Rejeicao ----------
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
