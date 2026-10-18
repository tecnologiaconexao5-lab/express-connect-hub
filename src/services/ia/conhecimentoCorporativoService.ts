import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import type { IaConhecimento } from "@/services/centralIaService";
import { bibliotecaTreinamentoIaService } from "@/services/centralIa/bibliotecaTreinamentoService";

export type TipoConhecimento = "procedimento" | "politica" | "contrato" | "tabela_preco" | "treinamento" | "compliance" | "outro";
export type PrioridadeDistribuicao = "baixa" | "normal" | "alta" | "critica";

export interface ConhecimentoCorporativo extends IaConhecimento {
  tipo_conhecimento: TipoConhecimento;
  versao: number;
  aprovado_por: string | null;
  data_aprovacao: string | null;
}

export interface ConhecimentoDistribuicao {
  id: string;
  conhecimento_id: string;
  robo_id: string;
  obrigatorio: boolean;
  prioridade: PrioridadeDistribuicao;
  data_vinculo: string;
  ativo: boolean;
  robo_nome?: string;
  robo_setor?: string;
}

export interface VersaoConhecimento {
  id: string;
  versao: number;
  status: string;
  tipo_arquivo: string;
  nome_original: string;
  tamanho_bytes: number;
  criado_em: string;
}

const TIPO_CONHECIMENTO_LABELS: Record<string, string> = {
  procedimento: "Procedimento",
  politica: "Política",
  contrato: "Contrato",
  tabela_preco: "Tabela de Preço",
  treinamento: "Treinamento",
  compliance: "Compliance",
  outro: "Outro",
};

export function getTipoLabel(tipo: string): string {
  return TIPO_CONHECIMENTO_LABELS[tipo] || tipo;
}

async function carregarNomesRobos(distribuicoes: ConhecimentoDistribuicao[]): Promise<ConhecimentoDistribuicao[]> {
  const roboIds = [...new Set(distribuicoes.map((d) => d.robo_id))];
  const { data: robos } = await supabase.from("automacoes_robos").select("id, nome, setor").in("id", roboIds);
  const mapa = new Map((robos || []).map((r) => [r.id, r]));
  return distribuicoes.map((d) => ({
    ...d,
    robo_nome: mapa.get(d.robo_id)?.nome || d.robo_id.substring(0, 8),
    robo_setor: mapa.get(d.robo_id)?.setor,
  }));
}

function nowISO(): string {
  return new Date().toISOString();
}

export const conhecimentoCorporativoService = {

  async listarConhecimentos(filtros?: {
    categoria?: string;
    setor?: string;
    status?: string;
    tipo_conhecimento?: string;
  }): Promise<ConhecimentoCorporativo[]> {
    let query = supabase
      .from("ia_conhecimento")
      .select("*")
      .order("criado_em", { ascending: false });

    if (filtros?.categoria) query = query.eq("categoria", filtros.categoria);
    if (filtros?.setor) query = query.ilike("setor", `%${filtros.setor}%`);
    if (filtros?.status) query = query.eq("status", filtros.status);
    if (filtros?.tipo_conhecimento) query = query.eq("tipo_conhecimento", filtros.tipo_conhecimento);

    const { data } = await query;
    return (data || []) as ConhecimentoCorporativo[];
  },

  async criarConhecimento(dados: {
    titulo: string;
    conteudo: string;
    tipo_conhecimento?: TipoConhecimento;
    categoria?: string;
    setor?: string;
    tags?: string[];
    validade_inicio?: string;
    validade_fim?: string;
  }): Promise<ConhecimentoCorporativo | null> {
    if (!dados.titulo || !dados.conteudo) return null;

    const { data } = await supabase.from("ia_conhecimento").insert({
      titulo: dados.titulo,
      conteudo: dados.conteudo,
      tipo_conhecimento: dados.tipo_conhecimento || "outro",
      categoria: dados.categoria || null,
      setor: dados.setor || null,
      tags: dados.tags || [],
      status: "rascunho",
      versao: 1,
      robo_id: null,
      validade_inicio: dados.validade_inicio || null,
      validade_fim: dados.validade_fim || null,
    }).select().single();

    if (data) {
      await centralIaService.registrarLog({
        robo_id: null, acao: "conhecimento_corporativo_criado",
        entrada: { titulo: dados.titulo, tipo: dados.tipo_conhecimento },
        saida: { id: data.id }, status: "sucesso",
      });
    }

    return data as ConhecimentoCorporativo | null;
  },

  async editarConhecimento(id: string, dados: Partial<ConhecimentoCorporativo>): Promise<boolean> {
    const { error } = await supabase.from("ia_conhecimento").update({
      ...dados,
      atualizado_em: nowISO(),
    }).eq("id", id);

    if (error) return false;

    await centralIaService.registrarLog({
      robo_id: null, acao: "conhecimento_corporativo_editado",
      entrada: { id, alteracoes: Object.keys(dados) },
      saida: {}, status: "info",
    });

    return true;
  },

  async criarNovaVersao(id: string, dados: {
    titulo?: string;
    conteudo: string;
    tipo_conhecimento?: TipoConhecimento;
  }): Promise<ConhecimentoCorporativo | null> {
    const { data: original } = await supabase
      .from("ia_conhecimento")
      .select("*")
      .eq("id", id)
      .single();

    if (!original) return null;

    const novaVersao = (original.versao || 1) + 1;

    const { data } = await supabase.from("ia_conhecimento").insert({
      titulo: dados.titulo || original.titulo,
      conteudo: dados.conteudo,
      tipo_conhecimento: dados.tipo_conhecimento || original.tipo_conhecimento || "outro",
      categoria: original.categoria,
      setor: original.setor,
      tags: original.tags || [],
      status: "rascunho",
      versao: novaVersao,
      robo_id: null,
      validade_inicio: original.validade_inicio,
      validade_fim: original.validade_fim,
    }).select().single();

    if (data) {
      const { data: distribuicoes } = await supabase
        .from("ia_conhecimento_distribuicao")
        .select("robo_id, obrigatorio, prioridade")
        .eq("conhecimento_id", id).eq("ativo", true);
      if (distribuicoes) {
        for (const d of distribuicoes) {
          await supabase.from("ia_conhecimento_distribuicao").insert({
            conhecimento_id: data.id,
            robo_id: d.robo_id,
            obrigatorio: d.obrigatorio,
            prioridade: d.prioridade,
          });
        }
      }

      await centralIaService.registrarLog({
        robo_id: null, acao: "conhecimento_corporativo_nova_versao",
        entrada: { id_original: id, versao_anterior: original.versao, nova_versao: novaVersao },
        saida: { novo_id: data.id }, status: "sucesso",
      });
    }

    return data as ConhecimentoCorporativo | null;
  },

  async alterarStatus(id: string, status: string): Promise<boolean> {
    const { error } = await supabase.from("ia_conhecimento").update({
      status, atualizado_em: nowISO(),
    }).eq("id", id);

    if (error) return false;

    await centralIaService.registrarLog({
      robo_id: null, acao: "conhecimento_corporativo_status",
      entrada: { id, novo_status: status },
      saida: {}, status: "info",
    });

    return true;
  },

  async vincularRobo(conhecimentoId: string, roboId: string, obrigatorio = false, prioridade: PrioridadeDistribuicao = "normal"): Promise<boolean> {
    const { error } = await supabase.from("ia_conhecimento_distribuicao").upsert({
      conhecimento_id: conhecimentoId,
      robo_id: roboId,
      obrigatorio,
      prioridade,
      ativo: true,
    }, { onConflict: "conhecimento_id,robo_id" });

    if (error) return false;

    await centralIaService.registrarLog({
      robo_id: roboId, acao: "conhecimento_corporativo_vinculado",
      entrada: { conhecimento_id: conhecimentoId, obrigatorio, prioridade },
      saida: {}, status: "sucesso",
    });

    return true;
  },

  async desvincularRobo(conhecimentoId: string, roboId: string): Promise<boolean> {
    const { error } = await supabase
      .from("ia_conhecimento_distribuicao")
      .update({ ativo: false })
      .eq("conhecimento_id", conhecimentoId)
      .eq("robo_id", roboId);

    if (error) return false;

    await centralIaService.registrarLog({
      robo_id: roboId, acao: "conhecimento_corporativo_desvinculado",
      entrada: { conhecimento_id: conhecimentoId },
      saida: {}, status: "info",
    });

    return true;
  },

  async listarDistribuicoes(conhecimentoId: string): Promise<ConhecimentoDistribuicao[]> {
    const { data } = await supabase
      .from("ia_conhecimento_distribuicao")
      .select("*")
      .eq("conhecimento_id", conhecimentoId)
      .eq("ativo", true);
    if (!data) return [];
    return carregarNomesRobos(data as ConhecimentoDistribuicao[]);
  },

  async obterConhecimentoDoRobo(roboId: string): Promise<ConhecimentoCorporativo[]> {
    const { data: distribuicoes } = await supabase
      .from("ia_conhecimento_distribuicao")
      .select("conhecimento_id")
      .eq("robo_id", roboId)
      .eq("ativo", true);

    if (!distribuicoes || distribuicoes.length === 0) return [];

    const ids = distribuicoes.map((d) => d.conhecimento_id);
    const { data } = await supabase
      .from("ia_conhecimento")
      .select("*")
      .in("id", ids)
      .eq("status", "ativo")
      .lte("validade_inicio", nowISO())
      .or(`validade_fim.is.null,validade_fim.gte.${nowISO()}`);

    return (data || []) as ConhecimentoCorporativo[];
  },

  async obterHistoricoVersoes(conhecimentoId: string): Promise<VersaoConhecimento[]> {
    const { data: arquivos } = await supabase
      .from("treinamento_arquivos_ia")
      .select("id, versao, status, tipo_arquivo, nome_original, tamanho_bytes, criado_em")
      .eq("conhecimento_id", conhecimentoId)
      .order("versao", { ascending: false });

    return (arquivos || []) as VersaoConhecimento[];
  },

  async uploadArquivoConhecimento(
    conhecimentoId: string,
    file: File,
    metadata?: { descricao?: string; tags?: string[] },
  ): Promise<boolean> {
    const { data: conhecimento } = await supabase
      .from("ia_conhecimento")
      .select("titulo, versao")
      .eq("id", conhecimentoId)
      .single();

    if (!conhecimento) return false;

    const { data: roboAdmin } = await supabase
      .from("automacoes_robos")
      .select("id")
      .limit(1)
      .maybeSingle();

    const roboId = roboAdmin?.id || "00000000-0000-0000-0000-000000000001";

    const caminhoStorage = `corporativo/${conhecimentoId}/${Date.now()}-${file.name}`;
    const hash = await file.arrayBuffer().then((buf) =>
      crypto.subtle.digest("SHA-256", buf).then((h) =>
        Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("")
      )
    );

    const { error: uploadError } = await supabase.storage
      .from("biblioteca-global")
      .upload(caminhoStorage, file, { cacheControl: "3600", upsert: false });

    if (uploadError) return false;

    const tipoArquivo = file.type.includes("pdf") ? "pdf"
      : file.type.includes("spreadsheet") || file.type.includes("excel") ? "planilha"
      : file.type.includes("word") || file.type.includes("document") ? "documento"
      : file.type.includes("image") ? "imagem"
      : "outro";

    await supabase.from("treinamento_arquivos_ia").insert({
      robo_id: roboId,
      conhecimento_id: conhecimentoId,
      nome_original: file.name,
      nome_armazenado: caminhoStorage.split("/").pop() || file.name,
      tipo_arquivo: tipoArquivo,
      mime_type: file.type || "application/octet-stream",
      tamanho_bytes: file.size,
      bucket: "biblioteca-global",
      caminho_storage: caminhoStorage,
      categoria: "corporativo",
      descricao: metadata?.descricao || null,
      tags: metadata?.tags || [],
      versao: conhecimento.versao,
      status: "ativo",
      hash_arquivo: hash,
    });

    return true;
  },

  async getArquivoUrl(caminhoStorage: string): Promise<string> {
    return bibliotecaTreinamentoIaService.getPublicUrl(caminhoStorage);
  },
};

export default conhecimentoCorporativoService;
