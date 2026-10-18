import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";

export type StatusArquivoTreinamento = "rascunho" | "ativo" | "arquivado" | "expirado";

export interface TreinamentoArquivoIa {
  id: string;
  robo_id: string;
  conhecimento_id: string | null;
  nome_original: string;
  nome_armazenado: string;
  tipo_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
  bucket: string;
  caminho_storage: string;
  categoria: string | null;
  descricao: string | null;
  tags: string[];
  versao: number;
  status: StatusArquivoTreinamento;
  validade_inicio: string | null;
  validade_fim: string | null;
  hash_arquivo: string | null;
  criado_por: string | null;
  atualizado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

const BUCKET = "biblioteca-global";

function getStoragePath(roboId: string, fileName: string): string {
  return `treinamento-ia/${roboId}/${Date.now()}-${fileName}`;
}

function getTipoArquivo(mimeType: string): string {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "planilha";
  if (mimeType.includes("word") || mimeType.includes("document")) return "documento";
  if (mimeType.includes("image")) return "imagem";
  if (mimeType.includes("text")) return "texto";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "apresentacao";
  if (mimeType.includes("video")) return "video";
  if (mimeType.includes("audio")) return "audio";
  return "outro";
}

async function calcularHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const bibliotecaTreinamentoIaService = {
  async listarArquivos(roboId: string): Promise<TreinamentoArquivoIa[]> {
    const { data } = await supabase
      .from("treinamento_arquivos_ia")
      .select("*")
      .eq("robo_id", roboId)
      .order("criado_em", { ascending: false });
    return (data as TreinamentoArquivoIa[]) || [];
  },

  async uploadArquivo(
    roboId: string,
    file: File,
    metadata: {
      categoria?: string;
      descricao?: string;
      tags?: string[];
      validade_inicio?: string;
      validade_fim?: string;
    }
  ): Promise<TreinamentoArquivoIa | null> {
    const caminhoStorage = getStoragePath(roboId, file.name);
    const hash = await calcularHash(file);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(caminhoStorage, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("[BibliotecaTreinamento] Erro upload storage:", uploadError.message);
      return null;
    }

    const { data: registro } = await supabase
      .from("treinamento_arquivos_ia")
      .insert({
        robo_id: roboId,
        nome_original: file.name,
        nome_armazenado: caminhoStorage.split("/").pop() || file.name,
        tipo_arquivo: getTipoArquivo(file.type),
        mime_type: file.type || "application/octet-stream",
        tamanho_bytes: file.size,
        bucket: BUCKET,
        caminho_storage: caminhoStorage,
        categoria: metadata.categoria || null,
        descricao: metadata.descricao || null,
        tags: metadata.tags || [],
        versao: 1,
        status: "ativo",
        validade_inicio: metadata.validade_inicio || null,
        validade_fim: metadata.validade_fim || null,
        hash_arquivo: hash,
      })
      .select()
      .single();

    if (registro) {
      await centralIaService.registrarLog({
        robo_id: roboId,
        acao: "arquivo_treinamento_upload",
        entrada: { nome: file.name, tamanho: file.size, tipo: file.type },
        saida: { arquivo_id: registro.id, caminho: caminhoStorage },
        status: "sucesso",
      });
    }

    return registro as TreinamentoArquivoIa | null;
  },

  async getPublicUrl(caminhoStorage: string): Promise<string> {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminhoStorage);
    return data.publicUrl;
  },

  async createSignedUrl(caminhoStorage: string, expiresIn = 3600): Promise<string | null> {
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(caminhoStorage, expiresIn);
    return data?.signedUrl || null;
  },

  async atualizarArquivo(
    id: string,
    updates: Partial<TreinamentoArquivoIa>
  ): Promise<void> {
    const { data: antes } = await supabase
      .from("treinamento_arquivos_ia")
      .select("robo_id, nome_original")
      .eq("id", id)
      .single();

    await supabase
      .from("treinamento_arquivos_ia")
      .update({ ...updates, atualizado_em: new Date().toISOString() })
      .eq("id", id);

    await centralIaService.registrarLog({
      robo_id: antes?.robo_id || null,
      acao: "arquivo_treinamento_atualizado",
      entrada: { arquivo_id: id, nome: antes?.nome_original },
      saida: updates,
      status: "info",
    });
  },

  async deletarArquivo(id: string): Promise<void> {
    const { data: item } = await supabase
      .from("treinamento_arquivos_ia")
      .select("robo_id, nome_original, caminho_storage")
      .eq("id", id)
      .single();

    if (item) {
      await supabase.storage.from(BUCKET).remove([item.caminho_storage]);
      await supabase.from("treinamento_arquivos_ia").delete().eq("id", id);
      await centralIaService.registrarLog({
        robo_id: item.robo_id,
        acao: "arquivo_treinamento_deletado",
        entrada: { arquivo_id: id, nome: item.nome_original },
        saida: {},
        status: "info",
      });
    }
  },

  async alterarStatus(id: string, status: StatusArquivoTreinamento): Promise<void> {
    await bibliotecaTreinamentoIaService.atualizarArquivo(id, { status });
  },

  async substituirArquivo(
    id: string,
    novoArquivo: File,
    metadata?: { descricao?: string; tags?: string[] }
  ): Promise<TreinamentoArquivoIa | null> {
    const { data: item } = await supabase
      .from("treinamento_arquivos_ia")
      .select("*")
      .eq("id", id)
      .single();

    if (!item) return null;

    const caminhoStorage = getStoragePath(item.robo_id, novoArquivo.name);
    const hash = await calcularHash(novoArquivo);
    const erro = await supabase.storage.from(BUCKET).upload(caminhoStorage, novoArquivo, {
      cacheControl: "3600",
      upsert: false,
    });
    if (erro.error) return null;

    // Remover arquivo antigo
    await supabase.storage.from(BUCKET).remove([item.caminho_storage]);

    const { data: atualizado } = await supabase
      .from("treinamento_arquivos_ia")
      .update({
        nome_original: novoArquivo.name,
        nome_armazenado: caminhoStorage.split("/").pop() || novoArquivo.name,
        tipo_arquivo: getTipoArquivo(novoArquivo.type),
        mime_type: novoArquivo.type,
        tamanho_bytes: novoArquivo.size,
        caminho_storage: caminhoStorage,
        versao: item.versao + 1,
        hash_arquivo: hash,
        descricao: metadata?.descricao || item.descricao,
        tags: metadata?.tags || item.tags,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    return atualizado as TreinamentoArquivoIa | null;
  },
};
