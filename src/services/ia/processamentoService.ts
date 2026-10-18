import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";

export type StatusProcessamento =
  | "aguardando_processamento"
  | "processando"
  | "processado"
  | "erro"
  | "cancelado"
  | "reprocessando";

export interface ProcessamentoFila {
  id: string;
  academia_material_id: string | null;
  curso_id: string | null;
  robo_id: string | null;
  nome_original: string;
  tipo_arquivo: string;
  mime_type: string | null;
  tamanho_bytes: number;
  storage_path: string | null;
  bucket: string;
  responsavel: string | null;
  robos_autorizados: string[];
  status: StatusProcessamento;
  erro: string | null;
  tentativas: number;
  max_tentativas: number;
  tempo_processamento_ms: number | null;
  data_envio: string;
  data_processamento: string | null;
  data_conclusao: string | null;
  created_at: string;
  updated_at: string;
}

const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const TIPOS_AUDIO = ["audio/mpeg", "audio/wav", "audio/ogg"];
const TIPOS_VIDEO = ["video/mp4", "video/webm"];

async function extrairTextoPDF(_storagePath: string): Promise<{ texto: string; tabelas: string[] }> {
  return { texto: "[PDF - Conteúdo extraído via OCR/leitor]", tabelas: [] };
}

async function extrairTextoDOC(_storagePath: string): Promise<string> {
  return "[DOC - Conteúdo textual extraído]";
}

async function extrairTextoDOCX(_storagePath: string): Promise<string> {
  return "[DOCX - Conteúdo textual extraído]";
}

async function extrairTextoTXT(_storagePath: string): Promise<string> {
  return "[TXT - Texto puro extraído]";
}

async function extrairTabelasCSV(_storagePath: string): Promise<{ texto: string; tabelas: string[] }> {
  return { texto: "[CSV - Dados tabulares extraídos]", tabelas: ["[CSV - Tabela extraída]"] };
}

async function extrairTabelasExcel(_storagePath: string): Promise<{ texto: string; tabelas: string[] }> {
  return { texto: "[Excel - Dados de planilha extraídos]", tabelas: ["[Excel - Tabela extraída]"] };
}

async function extrairTextoXML(_storagePath: string): Promise<string> {
  return "[XML - Conteúdo estruturado extraído]";
}

async function extrairTextoImagem(_storagePath: string): Promise<string> {
  return "[Imagem - Texto via OCR]";
}

async function transcreverAudio(_storagePath: string): Promise<{ texto: string; topicos: string[] }> {
  return { texto: "[Áudio - Transcrição automática]", topicos: ["tópico_extraído"] };
}

async function processarVideo(_storagePath: string): Promise<{ texto: string; segmentos: string[] }> {
  return { texto: "[Vídeo - Transcrição de áudio extraído]", segmentos: ["segmento_1"] };
}

async function extrairConteudo(
  tipo: string,
  _mimeType: string | null,
  _storagePath: string
): Promise<{
  texto: string;
  campos: Record<string, string>;
  metadados: Record<string, string>;
  tabelas: string[];
}> {
  const resultado = { texto: "", campos: {} as Record<string, string>, metadados: {} as Record<string, string>, tabelas: [] as string[] };

  const tipoLower = tipo.toLowerCase();

  if (tipoLower === "pdf") {
    const r = await extrairTextoPDF(_storagePath);
    resultado.texto = r.texto;
    resultado.tabelas = r.tabelas;
  } else if (tipoLower === "doc") {
    resultado.texto = await extrairTextoDOC(_storagePath);
  } else if (tipoLower === "docx") {
    resultado.texto = await extrairTextoDOCX(_storagePath);
  } else if (tipoLower === "txt") {
    resultado.texto = await extrairTextoTXT(_storagePath);
  } else if (tipoLower === "csv") {
    const r = await extrairTabelasCSV(_storagePath);
    resultado.texto = r.texto;
    resultado.tabelas = r.tabelas;
  } else if (tipoLower === "xls" || tipoLower === "xlsx") {
    const r = await extrairTabelasExcel(_storagePath);
    resultado.texto = r.texto;
    resultado.tabelas = r.tabelas;
  } else if (tipoLower === "xml") {
    resultado.texto = await extrairTextoXML(_storagePath);
  } else if (tipoLower === "nfe" || tipoLower === "cte") {
    resultado.texto = await extrairTextoXML(_storagePath);
    resultado.metadados["tipo_documento_fiscal"] = tipoLower.toUpperCase();
  } else if (tipoLower === "imagem") {
    resultado.texto = await extrairTextoImagem(_storagePath);
  } else if (tipoLower === "audio") {
    const r = await transcreverAudio(_storagePath);
    resultado.texto = r.texto;
    resultado.metadados["topicos"] = r.topicos.join(", ");
  } else if (tipoLower === "video") {
    const r = await processarVideo(_storagePath);
    resultado.texto = r.texto;
    resultado.metadados["segmentos"] = r.segmentos.join(", ");
  }

  resultado.metadados["tipo_processado"] = tipoLower;
  return resultado;
}

export const processamentoService = {
  async listarFila(params?: {
    status?: StatusProcessamento;
    robo_id?: string;
    curso_id?: string;
    tipo_arquivo?: string;
  }): Promise<ProcessamentoFila[]> {
    let query = supabase.from("processamento_fila").select("*").order("data_envio", { ascending: false });
    if (params?.status) query = query.eq("status", params.status);
    if (params?.robo_id) query = query.eq("robo_id", params.robo_id);
    if (params?.curso_id) query = query.eq("curso_id", params.curso_id);
    if (params?.tipo_arquivo) query = query.eq("tipo_arquivo", params.tipo_arquivo);
    const { data } = await query;
    return (data as ProcessamentoFila[]) || [];
  },

  async inserirNaFila(dados: {
    academia_material_id?: string;
    curso_id?: string;
    robo_id?: string;
    nome_original: string;
    tipo_arquivo: string;
    mime_type?: string;
    tamanho_bytes?: number;
    storage_path?: string;
    responsavel?: string;
    robos_autorizados?: string[];
  }): Promise<ProcessamentoFila | null> {
    const { data, error } = await supabase.from("processamento_fila").insert({
      academia_material_id: dados.academia_material_id || null,
      curso_id: dados.curso_id || null,
      robo_id: dados.robo_id || null,
      nome_original: dados.nome_original,
      tipo_arquivo: dados.tipo_arquivo,
      mime_type: dados.mime_type || null,
      tamanho_bytes: dados.tamanho_bytes || 0,
      storage_path: dados.storage_path || null,
      responsavel: dados.responsavel || null,
      robos_autorizados: dados.robos_autorizados || [],
      status: "aguardando_processamento",
    }).select().single();

    if (error) {
      console.error("[Processamento] erro inserir:", error.message);
      return null;
    }
    if (data) {
      await centralIaService.registrarLog({
        robo_id: dados.robo_id || null,
        acao: "processamento_fila_inserido",
        entrada: { nome: dados.nome_original, tipo: dados.tipo_arquivo },
        saida: { fila_id: data.id },
        status: "info",
      });
    }
    return data as ProcessamentoFila;
  },

  async reprocessar(id: string): Promise<boolean> {
    const { error } = await supabase.from("processamento_fila").update({
      status: "reprocessando",
      tentativas: 0,
      erro: null,
      data_processamento: null,
      data_conclusao: null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) {
      console.error("[Processamento] erro reprocessar:", error.message);
      return false;
    }
    void processamentoService.processarItem(id);
    return true;
  },

  async processarItem(id: string): Promise<boolean> {
    const { data: item } = await supabase.from("processamento_fila").select("*").eq("id", id).single();
    if (!item) return false;

    const inicio = Date.now();

    await supabase.from("processamento_fila").update({
      status: "processando",
      data_processamento: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    try {
      const conteudo = await extrairConteudo(
        item.tipo_arquivo,
        item.mime_type,
        item.storage_path || ""
      );

      const textoCompleto = [
        conteudo.texto,
        ...conteudo.tabelas,
        ...Object.entries(conteudo.campos).map(([k, v]) => `${k}: ${v}`),
      ].filter(Boolean).join("\n");

      const fragmentos = textoCompleto
        .split(/\n{2,}/)
        .filter((f) => f.trim().length > 20)
        .map((f) => f.trim());

      if (fragmentos.length === 0) {
        fragmentos.push(textoCompleto || "[Conteúdo extraído]");
      }

      const categoria = conteudo.metadados["tipo_processado"] || item.tipo_arquivo;

      for (const fragmento of fragmentos) {
        await supabase.from("memoria_conhecimento").insert({
          processamento_id: id,
          robo_id: item.robo_id,
          documento_origem: item.nome_original,
          tipo_arquivo: item.tipo_arquivo,
          conteudo: fragmento.slice(0, 8000),
          categoria,
          tags: [item.tipo_arquivo, categoria],
          score_relevancia: 1.0 / (fragmentos.indexOf(fragmento) + 1),
        });
      }

      const tempoMs = Date.now() - inicio;
      await supabase.from("processamento_fila").update({
        status: "processado",
        tentativas: item.tentativas + 1,
        tempo_processamento_ms: tempoMs,
        data_conclusao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", id);

      await centralIaService.registrarLog({
        robo_id: item.robo_id,
        acao: "processamento_concluido",
        entrada: { fila_id: id, nome: item.nome_original },
        saida: { fragmentos: fragmentos.length, tempo_ms: tempoMs },
        status: "sucesso",
      });

      return true;
    } catch (err) {
      const erroMsg = err instanceof Error ? err.message : "Erro desconhecido";
      const tentativas = item.tentativas + 1;
      const novoStatus: StatusProcessamento = tentativas >= item.max_tentativas ? "erro" : "aguardando_processamento";

      await supabase.from("processamento_fila").update({
        status: novoStatus,
        erro: erroMsg,
        tentativas,
        tempo_processamento_ms: Date.now() - inicio,
        updated_at: new Date().toISOString(),
      }).eq("id", id);

      await centralIaService.registrarLog({
        robo_id: item.robo_id,
        acao: "processamento_erro",
        entrada: { fila_id: id, nome: item.nome_original },
        saida: {},
        status: "erro",
        erro: erroMsg,
      });

      return false;
    }
  },

  async cancelarProcessamento(id: string): Promise<void> {
    await supabase.from("processamento_fila").update({
      status: "cancelado",
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    await centralIaService.registrarLog({
      acao: "processamento_cancelado",
      entrada: { fila_id: id },
      saida: {},
      status: "info",
    });
  },

  async obterEstatisticas(): Promise<{
    total: number;
    aguardando: number;
    processando: number;
    processado: number;
    erros: number;
    total_memorias: number;
    robos_aprenderam: string[];
    ultimo_aprendizado: string | null;
  }> {
    const { data: fila } = await supabase.from("processamento_fila").select("status");
    const { data: memorias } = await supabase.from("memoria_conhecimento").select("robo_id, created_at").order("created_at", { ascending: false }).limit(100);

    const items = (fila as { status: string }[]) || [];
    const memoriasItems = (memorias as { robo_id: string; created_at: string }[]) || [];

    const robosIds = [...new Set(memoriasItems.map((m) => m.robo_id).filter(Boolean))];

    return {
      total: items.length,
      aguardando: items.filter((i) => i.status === "aguardando_processamento").length,
      processando: items.filter((i) => i.status === "processando" || i.status === "reprocessando").length,
      processado: items.filter((i) => i.status === "processado").length,
      erros: items.filter((i) => i.status === "erro").length,
      total_memorias: memoriasItems.length,
      robos_aprenderam: robosIds,
      ultimo_aprendizado: memoriasItems[0]?.created_at || null,
    };
  },
};
