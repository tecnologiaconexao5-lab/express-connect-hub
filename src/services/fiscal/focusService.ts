import { supabase } from "@/lib/supabase";

export type FocusDocTipo = "CTE" | "NFSE" | "MDFE";

export interface FocusValidationResult {
  configurado: boolean;
  mensagem: string;
  emitente_configurado: boolean;
  certificado_configurado: boolean;
  token_configurado: boolean;
  ambiente: "producao" | "homologacao" | "indisponivel";
}

export interface FocusEmissionResult {
  autorizado: boolean;
  status: "desligado";
  mensagem: string;
  protocolo: null;
  chave_acesso: null;
  xml_url: null;
  pdf_url: null;
}

const MENSAGEM_FOCUS_DESLIGADO =
  "Focus NFe está desligado no frontend por segurança. " +
  "A emissão real deve ser feita via Supabase Edge Function ou backend seguro. " +
  "Nenhum token, certificado ou chave de API trafega pelo navegador.";

function obterStatusEmitente(emitente: any): { certificado_ok: boolean; token_ok: boolean } {
  return {
    certificado_ok: !!(emitente?.certificado_configurado),
    token_ok: !!(emitente?.focus_token_configurado),
  };
}

export async function validarConfiguracaoFocus(): Promise<FocusValidationResult> {
  try {
    const { data: emitente } = await supabase
      .from("configuracoes_fiscais")
      .select("*")
      .eq("ativo", true)
      .eq("padrao", true)
      .maybeSingle();

    if (!emitente) {
      return {
        configurado: false,
        mensagem: "Nenhum emitente padrão ativo configurado. Configure em /fiscal?tab=emitente",
        emitente_configurado: false,
        certificado_configurado: false,
        token_configurado: false,
        ambiente: "indisponivel",
      };
    }

    const { certificado_ok, token_ok } = obterStatusEmitente(emitente);

    return {
      configurado: true,
      mensagem: MENSAGEM_FOCUS_DESLIGADO,
      emitente_configurado: true,
      certificado_configurado: certificado_ok,
      token_configurado: token_ok,
      ambiente: (emitente.ambiente_fiscal as "producao" | "homologacao") || "homologacao",
    };
  } catch (e: any) {
    return {
      configurado: false,
      mensagem: `Erro ao validar configuração Focus: ${e.message}`,
      emitente_configurado: false,
      certificado_configurado: false,
      token_configurado: false,
      ambiente: "indisponivel",
    };
  }
}

export async function prepararEmissaoFocus(
  tipoDocumento: FocusDocTipo,
  documentoId: string
): Promise<{ pronto: false; mensagem: string }> {
  const tabela =
    tipoDocumento === "CTE" ? "fiscal_ctes" :
    tipoDocumento === "MDFE" ? "fiscal_mdfes" : "fiscal_nfse";

  const campoId = "id";

  const { data: doc } = await supabase
    .from(tabela)
    .select("id, status, metadata")
    .eq(campoId, documentoId)
    .maybeSingle();

  if (!doc) {
    return {
      pronto: false,
      mensagem: `Documento ${tipoDocumento} (${documentoId}) não encontrado.`,
    };
  }

  const validacoes = doc.metadata?.validacoes_pendentes || [];
  const erros = validacoes.filter((v: any) => v.severidade === "erro");

  if (erros.length > 0) {
    return {
      pronto: false,
      mensagem: `Documento ${tipoDocumento} possui ${erros.length} pendência(s) de erro. Corrija antes de emitir.`,
    };
  }

  console.log(
    `[FocusService] Documento ${tipoDocumento} ${documentoId} validado e pronto. ` +
    `Payload Focus montado no metadata.payload_focus. Emissão desligada — aguardando Edge Function.`
  );

  return {
    pronto: false,
    mensagem: MENSAGEM_FOCUS_DESLIGADO,
  };
}

export async function simularEnvioFocus(payload: Record<string, any>): Promise<FocusEmissionResult> {
  console.log(
    "[FocusService] Simulação de envio Focus — NENHUMA chamada externa foi feita.",
    "Payload:", payload
  );

  return {
    autorizado: false,
    status: "desligado",
    mensagem: MENSAGEM_FOCUS_DESLIGADO,
    protocolo: null,
    chave_acesso: null,
    xml_url: null,
    pdf_url: null,
  };
}
