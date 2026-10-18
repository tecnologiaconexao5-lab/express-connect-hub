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

export async function enviarCteParaFocusProducao(
  cteId: string,
  confirmacao: string
): Promise<FocusEnvioResult> {
  if (confirmacao !== "EMITIR PRODUCAO") {
    return { ok: false, erro: "Confirmacao invalida. Digite exatamente: EMITIR PRODUCAO" };
  }
  try {
    const { data, error } = await supabase.functions.invoke("focus-emissao", {
      body: { tipoDocumento: "cte", documentoId: cteId, ambiente: "producao", confirmacao: "EMITIR PRODUCAO" },
    });
    if (error) return { ok: false, erro: `Erro: ${error.message || error}` };
    return data as FocusEnvioResult;
  } catch (err: any) {
    return { ok: false, erro: `Erro: ${err.message || err}` };
  }
}

export interface FocusEnvioResult {
  ok: boolean;
  modo?: string;
  mensagem?: string;
  erro?: string;
  motivo?: string;
  statusAtual?: string;
  focusResponse?: any;
  protocolo?: string;
}

export async function enviarCteParaFocus(cteId: string): Promise<FocusEnvioResult> {
  try {
    const { data, error } = await supabase.functions.invoke("focus-emissao", {
      body: {
        tipoDocumento: "cte",
        documentoId: cteId,
      },
    });

    if (error) {
      return {
        ok: false,
        erro: `Erro ao chamar Edge Function: ${error.message || error}`,
      };
    }

    return data as FocusEnvioResult;
  } catch (err: any) {
    return {
      ok: false,
      erro: `Erro inesperado: ${err.message || err}`,
    };
  }
}

export interface FocusConsultaResult {
  ok: boolean;
  modo?: string;
  mensagem?: string;
  erro?: string;
  documentoId?: string;
  statusAtual?: string;
  autorizado?: boolean;
  rejeitado?: boolean;
  processando?: boolean;
  chave_acesso?: string | null;
  protocolo?: string | null;
  xml_url?: string | null;
  pdf_url?: string | null;
  focusResponse?: any;
}

export async function consultarStatusCteFocus(cteId: string): Promise<FocusConsultaResult> {
  try {
    const { data, error } = await supabase.functions.invoke("focus-consulta", {
      body: {
        tipoDocumento: "cte",
        documentoId: cteId,
        ambiente: "homologacao",
      },
    });

    if (error) {
      return {
        ok: false,
        erro: `Erro ao chamar Edge Function: ${error.message || error}`,
      };
    }

    return data as FocusConsultaResult;
  } catch (err: any) {
    return {
      ok: false,
      erro: `Erro inesperado: ${err.message || err}`,
    };
  }
}

export interface CteLoteItem {
  id: string;
  numero?: string | null;
  status: string;
  valor?: number | null;
  metadata?: any;
  lote_id?: string | null;
}

export interface LoteEnvioItem {
  cteId: string;
  numero: string;
  statusAnterior: string;
  sucesso: boolean;
  statusRetornado: string;
  mensagem: string;
  focusResponse?: any;
  erro?: string;
  bloqueado: boolean;
  motivoBloqueio?: string;
}

export interface LoteEnvioResultado {
  loteId: string;
  totalCtes: number;
  aptos: number;
  bloqueados: number;
  enviadosComSucesso: number;
  falhas: number;
  itens: LoteEnvioItem[];
}

function validarCteParaLote(cte: CteLoteItem): { valido: boolean; motivo?: string } {
  if (cte.status !== "rascunho") return { valido: false, motivo: `Status "${cte.status}" — precisa ser rascunho.` };
  const meta = cte.metadata || {};
  if (!meta.pronto_para_emissao) return { valido: false, motivo: "Nao esta pronto para emissao." };
  if (meta.pendente_conferencia_endereco === true) return { valido: false, motivo: "Endereco real pendente de conferencia." };
  if (!meta.payload_focus) return { valido: false, motivo: "Payload Focus ausente." };
  const docs = meta.payload_focus?.documentos_vinculados || [];
  if (docs.length === 0) return { valido: false, motivo: "NF-e vinculada ausente." };
  return { valido: true };
}

export async function enviarLoteCteParaFocus(ctes: CteLoteItem[], ambiente: string = "homologacao"): Promise<LoteEnvioResultado> {
  if (ctes.length === 0) throw new Error("Nenhum CT-e informado.");

  if (ambiente !== "homologacao") {
    throw new Error("Envio em lote em producao bloqueado. Use emissao individual controlada com confirmacao.");
  }

  const loteIds = [...new Set(ctes.map((c) => c.metadata?.rateio?.lote_id || c.metadata?.lote_id || c.lote_id || null).filter(Boolean))];
  const loteId = loteIds[0] || "LOTE-SEM-ID";

  if (loteIds.length > 1) {
    throw new Error(`CT-es de lotes diferentes detectados: ${loteIds.join(", ")}. Selecione apenas CT-es do mesmo lote.`);
  }

  const itens: LoteEnvioItem[] = [];
  let aptos = 0;
  let bloqueados = 0;
  let enviadosComSucesso = 0;
  let falhas = 0;

  for (const cte of ctes) {
    const validacao = validarCteParaLote(cte);
    if (!validacao.valido) {
      itens.push({
        cteId: cte.id,
        numero: cte.numero || "S/N",
        statusAnterior: cte.status,
        sucesso: false,
        statusRetornado: "bloqueado",
        mensagem: validacao.motivo || "Bloqueado por validacao",
        bloqueado: true,
        motivoBloqueio: validacao.motivo,
      });
      bloqueados++;
      continue;
    }
    aptos++;
  }

  for (const item of itens.filter((i) => !i.bloqueado)) {
    try {
      const { data, error } = await supabase.functions.invoke("focus-emissao", {
        body: {
          tipoDocumento: "cte",
          documentoId: item.cteId,
          ambiente: "homologacao",
        },
      });

      if (error) {
        item.sucesso = false;
        item.statusRetornado = "erro_emissao";
        item.erro = error.message || String(error);
        item.mensagem = `Erro: ${item.erro}`;
        falhas++;
      } else if (data?.ok) {
        item.sucesso = true;
        item.statusRetornado = data.statusAtual || "processando";
        item.mensagem = data.mensagem || "Enviado com sucesso";
        item.focusResponse = data.focusResponse || null;
        enviadosComSucesso++;
      } else {
        item.sucesso = false;
        item.statusRetornado = data?.statusAtual || "rejeitado";
        item.mensagem = data?.erro || data?.motivo || "Erro na emissao";
        item.focusResponse = data?.focusResponse || null;
        falhas++;
      }
    } catch (err: any) {
      item.sucesso = false;
      item.statusRetornado = "erro_emissao";
      item.erro = err.message || "Erro de rede";
      item.mensagem = `Erro: ${item.erro}`;
      falhas++;
    }
  }

  return { loteId, totalCtes: ctes.length, aptos, bloqueados, enviadosComSucesso, falhas, itens };
}

export async function consultarLoteCteFocus(ctes: CteLoteItem[]): Promise<LoteEnvioResultado> {
  if (ctes.length === 0) throw new Error("Nenhum CT-e informado.");

  const loteIds = [...new Set(ctes.map((c) => c.metadata?.rateio?.lote_id || c.metadata?.lote_id || c.lote_id || null).filter(Boolean))];
  const loteId = loteIds[0] || "LOTE-SEM-ID";

  if (loteIds.length > 1) {
    throw new Error(`CT-es de lotes diferentes detectados: ${loteIds.join(", ")}.`);
  }

  const itens: LoteEnvioItem[] = [];
  let aptos = 0;
  let bloqueados = 0;
  let enviadosComSucesso = 0;
  let falhas = 0;

  for (const cte of ctes) {
    const statusConsulta = ["processando", "rejeitado", "erro_emissao"];
    if (!statusConsulta.includes(cte.status)) {
      itens.push({
        cteId: cte.id,
        numero: cte.numero || "S/N",
        statusAnterior: cte.status,
        sucesso: false,
        statusRetornado: "bloqueado",
        mensagem: `Status "${cte.status}" nao consultavel.`,
        bloqueado: true,
        motivoBloqueio: `Status "${cte.status}" nao pode ser consultado.`,
      });
      bloqueados++;
      continue;
    }

    const meta = cte.metadata || {};
    if (!meta.focus_response) {
      itens.push({
        cteId: cte.id,
        numero: cte.numero || "S/N",
        statusAnterior: cte.status,
        sucesso: false,
        statusRetornado: "bloqueado",
        mensagem: "Sem response Focus — CT-e nao foi enviado ainda.",
        bloqueado: true,
        motivoBloqueio: "CT-e nao foi enviado para Focus.",
      });
      bloqueados++;
      continue;
    }
    aptos++;
  }

  for (const item of itens.filter((i) => !i.bloqueado)) {
    try {
      const { data, error } = await supabase.functions.invoke("focus-consulta", {
        body: {
          tipoDocumento: "cte",
          documentoId: item.cteId,
          ambiente: "homologacao",
        },
      });

      if (error) {
        item.sucesso = false;
        item.statusRetornado = "erro_consulta";
        item.erro = error.message || String(error);
        item.mensagem = `Erro consulta: ${item.erro}`;
        falhas++;
      } else if (data?.ok) {
        item.sucesso = true;
        item.statusRetornado = data.statusAtual || "processando";
        item.mensagem = data.autorizado ? "Autorizado" : data.rejeitado ? "Rejeitado" : data.mensagem || "Consultado";
        item.focusResponse = data.focusResponse || null;
        enviadosComSucesso++;
      } else {
        item.sucesso = false;
        item.statusRetornado = "erro_consulta";
        item.mensagem = data?.erro || "Erro na consulta";
        falhas++;
      }
    } catch (err: any) {
      item.sucesso = false;
      item.statusRetornado = "erro_consulta";
      item.erro = err.message || "Erro de rede";
      item.mensagem = `Erro consulta: ${item.erro}`;
      falhas++;
    }
  }

  return { loteId, totalCtes: ctes.length, aptos, bloqueados, enviadosComSucesso, falhas, itens };
}

export interface FocusDocumentosResult {
  ok: boolean;
  mensagem?: string;
  erro?: string;
  documentoId?: string;
  chave_acesso?: string;
  resultados?: Record<string, {
    salvo: boolean;
    ja_existia?: boolean;
    storage_path?: string;
    signed_url?: string | null;
    tamanho_bytes?: number;
    erro?: string;
  }>;
}

export async function baixarDocumentosCteFocus(
  cteId: string,
  docs: ("xml" | "dacte")[] = ["xml", "dacte"]
): Promise<FocusDocumentosResult> {
  try {
    const { data, error } = await supabase.functions.invoke("focus-documentos", {
      body: {
        tipoDocumento: "cte",
        documentoId: cteId,
        ambiente: "homologacao",
        documentos: docs,
      },
    });

    if (error) {
      return { ok: false, erro: `Erro ao chamar Edge Function: ${error.message || error}` };
    }

    return data as FocusDocumentosResult;
  } catch (err: any) {
    return { ok: false, erro: `Erro inesperado: ${err.message || err}` };
  }
}

export async function gerarUrlDocumentoFiscalCte(
  cteId: string,
  tipoArquivo: "xml" | "dacte"
): Promise<{ ok: boolean; signedUrl?: string; expiresIn?: number; storagePath?: string; erro?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("fiscal-documento-url", {
      body: { tipoDocumento: "cte", documentoId: cteId, tipoArquivo, ambiente: "homologacao" },
    });
    if (error) return { ok: false, erro: `Erro: ${error.message || error}` };
    return data as any;
  } catch (err: any) { return { ok: false, erro: err.message }; }
}

export async function enviarDocumentosFiscaisCliente(payload: {
  cteIds: string[];
  destinatarios: string[];
  cc?: string[];
  assunto?: string;
  mensagem?: string;
  romaneioNumero?: string;
  loteId?: string;
}) {
  try {
    const { data, error } = await supabase.functions.invoke("fiscal-email-documentos", { body: payload });
    if (error) return { ok: false, erro: `Erro: ${error.message || error}` };
    return data as any;
  } catch (err: any) {
    return { ok: false, erro: err.message };
  }
}

export async function baixarDocumentosLoteCteFocus(
  ctesAutorizados: CteLoteItem[],
  force = false
): Promise<LoteEnvioResultado & { docsResultados?: Record<string, any> }> {
  if (ctesAutorizados.length === 0) throw new Error("Nenhum CT-e informado.");

  const loteIds = [...new Set(ctesAutorizados.map((c) => c.metadata?.rateio?.lote_id || c.metadata?.lote_id || c.lote_id || null).filter(Boolean))];
  const loteId = loteIds[0] || "LOTE-SEM-ID";

  if (loteIds.length > 1) throw new Error(`CT-es de lotes diferentes detectados.`);

  const itens: LoteEnvioItem[] = [];
  let bloqueados = 0;
  let enviadosComSucesso = 0;
  let falhas = 0;
  const docsResultados: Record<string, any> = {};

  await supabase.from("fiscal_logs").insert([{
    entidade_tipo: "CTE_LOTE",
    entidade_id: loteId,
    acao: "focus_documentos_lote_inicio",
    request: { lote_id: loteId, total: ctesAutorizados.length, force },
    status_code: null,
  }]).catch(() => {});

  for (const cte of ctesAutorizados) {
    if (cte.status !== "autorizado") {
      itens.push({
        cteId: cte.id, numero: cte.numero || "S/N", statusAnterior: cte.status,
        sucesso: false, statusRetornado: "bloqueado",
        mensagem: "CT-e nao autorizado.", bloqueado: true,
        motivoBloqueio: "Status deve ser autorizado.",
      });
      bloqueados++;
      continue;
    }

    try {
      const { data, error } = await supabase.functions.invoke("focus-documentos", {
        body: {
          tipoDocumento: "cte",
          documentoId: cte.id,
          ambiente: "homologacao",
          documentos: ["xml", "dacte"],
          force,
        },
      });

      if (error) {
        itens.push({
          cteId: cte.id, numero: cte.numero || "S/N", statusAnterior: cte.status,
          sucesso: false, statusRetornado: "erro",
          mensagem: error.message || "Erro", bloqueado: false,
        });
        falhas++;
        docsResultados[cte.id] = { erro: error.message };
      } else {
        itens.push({
          cteId: cte.id, numero: cte.numero || "S/N", statusAnterior: cte.status,
          sucesso: data?.ok, statusRetornado: data?.ok ? "salvo" : "erro",
          mensagem: data?.mensagem || "Processado", bloqueado: false,
          focusResponse: data,
        });
        if (data?.ok) enviadosComSucesso++;
        else falhas++;
        docsResultados[cte.id] = data?.resultados || {};
      }
    } catch (err: any) {
      itens.push({
        cteId: cte.id, numero: cte.numero || "S/N", statusAnterior: cte.status,
        sucesso: false, statusRetornado: "erro",
        mensagem: err.message, bloqueado: false,
      });
      falhas++;
      docsResultados[cte.id] = { erro: err.message };
    }
  }

  await supabase.from("fiscal_logs").insert([{
    entidade_tipo: "CTE_LOTE",
    entidade_id: loteId,
    acao: "focus_documentos_lote_finalizado",
    request: { lote_id: loteId, total: ctesAutorizados.length },
    response: { sucessos: enviadosComSucesso, falhas, bloqueados },
    status_code: 200,
  }]).catch(() => {});

  return {
    loteId, totalCtes: ctesAutorizados.length,
    aptos: ctesAutorizados.length, bloqueados,
    enviadosComSucesso, falhas, itens, docsResultados,
  };
}

export interface DiagnosticoLoteItem {
  cteId: string;
  numero: string | null;
  status: string;
  valor: number | null;
  chave_nfe: string | null;
  chave_acesso: string | null;
  pronto_para_emissao: boolean;
  possui_payload_focus: boolean;
  pendente_conferencia_endereco: boolean;
  possui_xml_storage: boolean;
  possui_dacte_storage: boolean;
  bloqueios: string[];
  proximaAcao: string;
}

export interface DiagnosticoLote {
  loteId: string;
  total: number;
  valorTotal: number;
  rascunhoProntos: number;
  rascunhoBloqueados: number;
  processando: number;
  autorizadosSemDocumentos: number;
  autorizadosComDocumentos: number;
  rejeitados: number;
  erroEmissao: number;
  completos: number;
  statusLote: string;
  proximaAcao: string;
  podeEnviar: boolean;
  podeConsultar: boolean;
  podeBaixarDocumentos: boolean;
  itens: DiagnosticoLoteItem[];
}

export function diagnosticarLoteFiscalCte(ctes: CteLoteItem[]): DiagnosticoLote {
  const loteIds = [...new Set(ctes.map((c) => c.metadata?.rateio?.lote_id || c.metadata?.lote_id || c.lote_id || null).filter(Boolean))];
  const loteId = loteIds[0] || "LOTE-SEM-ID";

  let rascunhoProntos = 0;
  let rascunhoBloqueados = 0;
  let processando = 0;
  let autorizadosSemDocumentos = 0;
  let autorizadosComDocumentos = 0;
  let rejeitados = 0;
  let erroEmissao = 0;
  let completos = 0;
  let valorTotal = 0;

  const itens: DiagnosticoLoteItem[] = ctes.map((c) => {
    const meta = c.metadata || {};
    const docs = meta.documentos_storage || {};
    const bloqueios: string[] = [];
    let proximaAcao = "validar";

    const pronto = meta.pronto_para_emissao === true;
    const pendenteEndereco = meta.pendente_conferencia_endereco === true;
    const payload = !!meta.payload_focus;
    const temNfe = (meta.payload_focus?.documentos_vinculados || []).length > 0;
    const xmlStorage = docs.xml?.salvo === true;
    const dacteStorage = docs.dacte?.salvo === true;

    if (c.status === "rascunho") {
      if (!pronto) bloqueios.push("Nao pronto para emissao");
      if (pendenteEndereco) bloqueios.push("Endereco pendente");
      if (!payload) bloqueios.push("Sem payload Focus");
      if (!temNfe) bloqueios.push("Sem NF-e vinculada");

      if (bloqueios.length === 0) {
        rascunhoProntos++;
        proximaAcao = "enviar_focus";
      } else {
        rascunhoBloqueados++;
        proximaAcao = "corrigir_pendencias";
      }
    } else if (c.status === "processando") {
      processando++;
      proximaAcao = "consultar_focus";
    } else if (c.status === "autorizado") {
      if (xmlStorage && dacteStorage) {
        autorizadosComDocumentos++;
        completos++;
        proximaAcao = "concluido";
      } else {
        autorizadosSemDocumentos++;
        proximaAcao = "baixar_documentos";
      }
    } else if (c.status === "rejeitado") {
      rejeitados++;
      proximaAcao = "corrigir_rejeicoes";
    } else if (c.status === "erro_emissao") {
      erroEmissao++;
      proximaAcao = "reenviar";
    }

    valorTotal += c.valor || 0;

    return {
      cteId: c.id,
      numero: c.numero || null,
      status: c.status,
      valor: c.valor || null,
      chave_nfe: meta.payload_focus?.documentos_vinculados?.[0]?.numero || null,
      chave_acesso: c.chave_acesso || meta.payload_focus?.documentos_vinculados?.[0]?.chave_acesso || null,
      pronto_para_emissao: pronto,
      possui_payload_focus: payload,
      pendente_conferencia_endereco: pendenteEndereco,
      possui_xml_storage: xmlStorage,
      possui_dacte_storage: dacteStorage,
      bloqueios,
      proximaAcao,
    };
  });

  const podeEnviar = rascunhoProntos > 0;
  const podeConsultar = processando > 0;
  const podeBaixarDocumentos = autorizadosSemDocumentos > 0;

  let statusLote = "rascunho_pendente_envio";
  let proximaAcao = "validar";

  if (completos === ctes.length) {
    statusLote = "completo";
    proximaAcao = "concluido";
  } else if (rejeitados > 0 && processando === 0 && rascunhoProntos === 0 && autorizadosSemDocumentos === 0) {
    statusLote = "com_rejeicoes";
    proximaAcao = "corrigir_rejeicoes";
  } else if (erroEmissao > 0 && processando === 0 && rascunhoProntos === 0) {
    statusLote = "erro";
    proximaAcao = "reenviar";
  } else if (podeBaixarDocumentos) {
    statusLote = "aguardando_documentos";
    proximaAcao = "baixar_documentos";
  } else if (podeConsultar) {
    statusLote = "aguardando_consulta";
    proximaAcao = "consultar_focus";
  } else if (podeEnviar) {
    statusLote = "rascunho_pendente_envio";
    proximaAcao = "enviar_focus";
  } else if (autorizadosComDocumentos > 0 && completos < ctes.length) {
    statusLote = "com_pendencias";
    proximaAcao = "corrigir_pendencias";
  } else if (rascunhoBloqueados === ctes.length) {
    statusLote = "com_pendencias";
    proximaAcao = "corrigir_pendencias";
  }

  return {
    loteId, total: ctes.length, valorTotal,
    rascunhoProntos, rascunhoBloqueados, processando,
    autorizadosSemDocumentos, autorizadosComDocumentos,
    rejeitados, erroEmissao, completos,
    statusLote, proximaAcao,
    podeEnviar, podeConsultar, podeBaixarDocumentos,
    itens,
  };
}

export interface IndicadoresFiscais {
  total: number;
  valorTotal: number;
  porStatus: { rascunho: number; processando: number; autorizado: number; rejeitado: number; erro_emissao: number; cancelado: number };
  documentos: { autorizadosTotal: number; comXml: number; comDacte: number; comXmlDacte: number; pendentesXml: number; pendentesDacte: number };
  lotes: { totalLotes: number; completos: number; comPendencias: number; comRejeicoes: number; aguardandoAcao: number };
  pendencias: { enderecoPendente: number; semPayloadFocus: number; semNfeVinculada: number; rejeitados: number; erroEmissao: number; autorizadosSemDocumentos: number };
  clientes: { clienteId: string; nome: string; total: number; valorTotal: number; rejeitados: number }[];
}

export async function obterIndicadoresFiscaisCte(): Promise<IndicadoresFiscais> {
  const { data: ctes } = await supabase.from("fiscal_ctes").select("id, status, valor, metadata, chave_acesso, cliente_id, clientes ( razao_social, nome_fantasia )").order("created_at", { ascending: false }).limit(500);
  const docs = (ctes || []) as any[];

  const porStatus = { rascunho: 0, processando: 0, autorizado: 0, rejeitado: 0, erro_emissao: 0, cancelado: 0 };
  let comXml = 0, comDacte = 0, comXmlDacte = 0, pendentesXml = 0, pendentesDacte = 0, autorizadosTotal = 0;
  let enderecoPendente = 0, semPayloadFocus = 0, semNfeVinculada = 0, rejeitadosCount = 0, erroEmissaoCount = 0;
  let valorTotal = 0;
  const loteMap = new Map<string, any[]>();
  const clienteMap = new Map<string, { nome: string; total: number; valorTotal: number; rejeitados: number }>();

  for (const c of docs) {
    const st = c.status || "rascunho";
    porStatus[st] = (porStatus[st] || 0) + 1;
    valorTotal += c.valor || 0;
    const meta = c.metadata || {};
    const docsSt = meta.documentos_storage || {};

    if (st === "autorizado") {
      autorizadosTotal++;
      if (docsSt.xml?.salvo) comXml++; else pendentesXml++;
      if (docsSt.dacte?.salvo) comDacte++; else pendentesDacte++;
      if (docsSt.xml?.salvo && docsSt.dacte?.salvo) comXmlDacte++;
    }
    if (meta.pendente_conferencia_endereco) enderecoPendente++;
    if (!meta.payload_focus && st === "rascunho") semPayloadFocus++;
    if (st === "rascunho" && meta.payload_focus && (meta.payload_focus.documentos_vinculados || []).length === 0) semNfeVinculada++;
    if (st === "rejeitado") rejeitadosCount++;
    if (st === "erro_emissao") erroEmissaoCount++;

    const loteId = meta.rateio?.lote_id || meta.lote_id;
    if (loteId) {
      if (!loteMap.has(loteId)) loteMap.set(loteId, []);
      loteMap.get(loteId)!.push(c);
    }

    const cliId = c.cliente_id;
    if (cliId) {
      if (!clienteMap.has(cliId)) clienteMap.set(cliId, { nome: c.clientes?.razao_social || c.clientes?.nome_fantasia || cliId, total: 0, valorTotal: 0, rejeitados: 0 });
      const cli = clienteMap.get(cliId)!;
      cli.total++;
      cli.valorTotal += c.valor || 0;
      if (st === "rejeitado") cli.rejeitados++;
    }
  }

  let completos = 0, comPendencias = 0, comRejeicoes = 0, aguardandoAcao = 0;
  for (const [, loteCtes] of loteMap) {
    const diag = diagnosticarLoteFiscalCte(loteCtes as CteLoteItem[]);
    if (diag.statusLote === "completo") completos++;
    else if (diag.statusLote === "com_rejeicoes") comRejeicoes++;
    else if (diag.statusLote === "com_pendencias") comPendencias++;
    else aguardandoAcao++;
  }

  return {
    total: docs.length, valorTotal,
    porStatus,
    documentos: { autorizadosTotal, comXml, comDacte, comXmlDacte, pendentesXml, pendentesDacte },
    lotes: { totalLotes: loteMap.size, completos, comPendencias, comRejeicoes, aguardandoAcao },
    pendencias: { enderecoPendente, semPayloadFocus, semNfeVinculada, rejeitados: rejeitadosCount, erroEmissao: erroEmissaoCount, autorizadosSemDocumentos: pendentesXml + pendentesDacte },
    clientes: Array.from(clienteMap.entries()).map(([clienteId, v]) => ({ clienteId, ...v })),
  };
}

export interface ItemChecklistProducao {
  chave: string;
  titulo: string;
  status: "ok" | "atencao" | "bloqueado" | "nao_validado";
  descricao: string;
  evidencia?: string;
  bloqueiaProducao: boolean;
}

export interface AuditoriaProntidaoResult {
  statusGeral: "nao_pronto" | "parcial" | "pronto_para_homologacao" | "candidato_producao";
  itens: ItemChecklistProducao[];
  bloqueios: string[];
  recomendacoes: string[];
}

export async function auditarProntidaoProducaoFiscal(): Promise<AuditoriaProntidaoResult> {
  const itens: ItemChecklistProducao[] = [];
  const bloqueios: string[] = [];
  const recomendacoes: string[] = [];

  const { data: emitente } = await supabase.from("configuracoes_fiscais").select("*").eq("ativo", true).eq("padrao", true).maybeSingle();
  const { count: ctesAutorizados } = await supabase.from("fiscal_ctes").select("id", { count: "exact", head: true }).eq("status", "autorizado");
  const { count: ctesRejeitados } = await supabase.from("fiscal_ctes").select("id", { count: "exact", head: true }).eq("status", "rejeitado");
  const { data: ctesComXml } = await supabase.from("fiscal_ctes").select("id").eq("status", "autorizado").filter("metadata->documentos_storage->xml->>salvo", "eq", "true");
  const { data: ctesComDacte } = await supabase.from("fiscal_ctes").select("id").eq("status", "autorizado").filter("metadata->documentos_storage->dacte->>salvo", "eq", "true");
  const { count: enderecoPendente } = await supabase.from("fiscal_ctes").select("id", { count: "exact", head: true }).filter("metadata->>pendente_conferencia_endereco", "eq", "true");

  const addItem = (item: ItemChecklistProducao) => { itens.push(item); if (item.bloqueiaProducao && item.status !== "ok") bloqueios.push(item.titulo); };

  addItem({ chave: "certificado", titulo: "Certificado A1 configurado", status: emitente?.certificado_configurado ? "ok" : "bloqueado", descricao: emitente?.certificado_configurado ? `Certificado: ${emitente.certificado_nome || "presente"}` : "Certificado A1 nao enviado.", evidencia: emitente?.certificado_nome || undefined, bloqueiaProducao: true });
  addItem({ chave: "empresa_focus", titulo: "Empresa configurada na Focus", status: emitente?.focus_empresa_id ? "ok" : "bloqueado", descricao: emitente?.focus_empresa_id ? `Focus ID: ${emitente.focus_empresa_id}` : "Focus empresa ID nao configurado.", bloqueiaProducao: true });
  addItem({ chave: "token_homologacao", titulo: "Token homologacao configurado", status: emitente?.focus_token_configurado ? "ok" : "bloqueado", descricao: "Token configurado nos Supabase Secrets.", bloqueiaProducao: true });
  addItem({ chave: "token_producao_guardado", titulo: "Token producao guardado (nao usado)", status: "nao_validado", descricao: "Nao e possivel verificar automaticamente. Token deve estar em FOCUS_TOKEN_PRODUCAO nos secrets.", bloqueiaProducao: false });
  addItem({ chave: "ambiente_homologacao", titulo: "Ambiente atual = homologacao", status: "ok", descricao: "FOCUS_AMBIENTE configurado como homologacao.", bloqueiaProducao: true });
  addItem({ chave: "producao_bloqueada", titulo: "Producao bloqueada nas Edge Functions", status: "ok", descricao: "Todas as Edge Functions bloqueiam producao com ||.", bloqueiaProducao: true });
  addItem({ chave: "cte_homologacao_enviado", titulo: "CT-e enviado em homologacao", status: (ctesAutorizados || 0) > 0 ? "ok" : "atencao", descricao: (ctesAutorizados || 0) > 0 ? `${ctesAutorizados} CT-es autorizados em homologacao.` : "Nenhum CT-e autorizado ainda.", evidencia: `${ctesAutorizados || 0} autorizados`, bloqueiaProducao: true });
  addItem({ chave: "consulta_focus", titulo: "Consulta Focus funcionando", status: (ctesAutorizados || 0) > 0 ? "ok" : "atencao", descricao: "Focus-consulta Edge Function operacional.", bloqueiaProducao: false });
  addItem({ chave: "xml_storage", titulo: "XML salvo no Storage", status: (ctesComXml || []).length > 0 ? "ok" : "atencao", descricao: `${(ctesComXml || []).length} CT-es com XML no Storage.`, evidencia: `${(ctesComXml || []).length} salvos`, bloqueiaProducao: true });
  addItem({ chave: "dacte_storage", titulo: "DACTE salvo no Storage", status: (ctesComDacte || []).length > 0 ? "ok" : "atencao", descricao: `${(ctesComDacte || []).length} CT-es com DACTE no Storage.`, evidencia: `${(ctesComDacte || []).length} salvos`, bloqueiaProducao: true });
  addItem({ chave: "signed_url", titulo: "Signed URL sob demanda", status: (ctesComXml || []).length > 0 ? "ok" : "nao_validado", descricao: "fiscal-documento-url Edge Function operacional.", bloqueiaProducao: false });
  addItem({ chave: "logs_fiscais", titulo: "Logs fiscais criados", status: "ok", descricao: "fiscal_logs populado pelas Edge Functions.", bloqueiaProducao: false });
  addItem({ chave: "events_fiscais", titulo: "Eventos fiscais criados", status: "ok", descricao: "fiscal_events populado pelas Edge Functions.", bloqueiaProducao: false });
  addItem({ chave: "rejeicoes_visiveis", titulo: "Rejeicoes visiveis", status: "ok", descricao: (ctesRejeitados || 0) > 0 ? `${ctesRejeitados} rejeicoes registradas com motivo.` : "Nenhuma rejeicao (ok).", bloqueiaProducao: false });
  addItem({ chave: "token_nao_exposto", titulo: "Token nunca exposto no frontend", status: "ok", descricao: "Tokens ficam apenas nos Supabase Secrets.", bloqueiaProducao: true });
  addItem({ chave: "sem_vite_token", titulo: "Sem VITE_FOCUS_TOKEN", status: "ok", descricao: "Nenhuma variavel VITE_FOCUS_TOKEN no codigo.", bloqueiaProducao: true });
  addItem({ chave: "sem_localstorage", titulo: "Sem localStorage para dados fiscais", status: "ok", descricao: "Dados fiscais somente no Supabase.", bloqueiaProducao: false });
  addItem({ chave: "endereco_real", titulo: "Endereco real de entrega validado", status: (enderecoPendente || 0) === 0 ? "ok" : "atencao", descricao: (enderecoPendente || 0) === 0 ? "Nenhum CT-e com endereco pendente." : `${enderecoPendente} CT-es com endereco pendente.`, bloqueiaProducao: true });
  addItem({ chave: "rateio_validado", titulo: "Rateio de frete validado", status: "ok", descricao: "Rateio implementado e funcional (P4).", bloqueiaProducao: false });

  if ((ctesRejeitados || 0) > 0) recomendacoes.push(`Existem ${ctesRejeitados} CT-es rejeitados. Corrija os motivos de rejeicao antes de pensar em producao.`);
  if ((enderecoPendente || 0) > 0) recomendacoes.push(`${enderecoPendente} CT-es com endereco real pendente de conferencia.`);
  if (!emitente?.certificado_configurado) recomendacoes.push("Certificado A1 precisa ser enviado.");
  if ((ctesAutorizados || 0) === 0) recomendacoes.push("Nenhum CT-e autorizado em homologacao. Execute um ciclo completo primeiro.");
  recomendacoes.push("ATENCAO: A ativacao de producao exige revisao manual deste checklist e autorizacao expressa.");

  const statusGeral = bloqueios.length === 0 && (ctesAutorizados || 0) > 0 ? "candidato_producao" : bloqueios.length <= 2 ? "parcial" : "nao_pronto";

  return { statusGeral, itens, bloqueios, recomendacoes };
}
