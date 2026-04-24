// src/services/documentosPrestadorService.ts
// Serviço centralizado para gestão de documentos de prestadores
// Regras: anti-duplicidade, rastreabilidade, compatibilidade
import { supabase } from "@/lib/supabase";

export interface DocumentoPrestador {
  id?: string;
  prestador_id?: string;
  candidato_id?: string;
  tipo: string;
  arquivo?: string;
  url_arquivo?: string;
  dados?: Record<string, any>;
  validade?: string;
  status?: string;
  origem?: string;
  created_at?: string;
}

export interface ResultadoDocumento {
  success: boolean;
  id?: string;
  mensagem: string;
  duplicado?: boolean;
}

export async function verificarDocumentoDuplicado(
  prestadorId: string,
  tipoDocumento: string,
  urlArquivo?: string
): Promise<{ duplicado: boolean; existente?: any }> {
  if (!prestadorId || !tipoDocumento) {
    return { duplicado: false };
  }

  let query = supabase
    .from("documentos_prestadores")
    .select("*")
    .eq("prestador_id", prestadorId)
    .eq("tipo", tipoDocumento)
    .in("status", ["valido", "pendente"]);

  const { data: existentes } = await query;

  if (existentes && existentes.length > 0) {
    if (urlArquivo) {
      const mesmoArquivo = existentes.find(d => d.url === urlArquivo);
      if (mesmoArquivo) {
        return { duplicado: true, existente: mesmoArquivo };
      }
    }
    return { duplicado: false };
  }

  return { duplicado: false };
}

export async function vincularDocumentoCandidatoAPrestador(
  candidatoId: string,
  prestadorId: string
): Promise<{ success: boolean; migrados: number; erros: string[] }> {
  const erros: string[] = [];
  let migrados = 0;

  const { data: docsCandidato } = await supabase
    .from("documentos_prestadores")
    .select("*")
    .eq("candidato_id", candidatoId);

  if (!docsCandidato || docsCandidato.length === 0) {
    return { success: true, migrados: 0, erros: [] };
  }

  for (const doc of docsCandidato) {
    const { duplicado } = await verificarDocumentoDuplicado(prestadorId, doc.tipo, doc.url);

    if (duplicado) {
      console.log(`[Documentos] pulando duplicado: ${doc.tipo}`);
      migrados++;
      continue;
    }

    const { error } = await supabase
      .from("documentos_prestadores")
      .update({
        prestador_id: prestadorId,
        candidato_id: null,
        origem: "recrutamento_migrado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      erros.push(`${doc.tipo}: ${error.message}`);
      console.error(`[Documentos] erro migrar ${doc.tipo}:`, error);
    } else {
      migrados++;
      console.log(`[Documentos] migrado: ${doc.tipo}`);
    }
  }

  return { success: erros.length === 0, migrados, erros };
}

export async function adicionarDocumentoPrestador(
  doc: DocumentoPrestador
): Promise<ResultadoDocumento> {
  if (!doc.prestador_id || !doc.tipo) {
    return { success: false, mensagem: "prestador_id e tipo são obrigatórios" };
  }

  const { duplicado, existente } = await verificarDocumentoDuplicado(
    doc.prestador_id,
    doc.tipo,
    doc.url_arquivo || doc.arquivo
  );

  if (duplicado) {
    console.log(`[Documentos] duplicado detectado: ${doc.tipo} para prestador ${doc.prestador_id}`);
    return {
      success: false,
      id: existente.id,
      mensagem: `Documento ${doc.tipo} já existe`,
      duplicado: true,
    };
  }

  const payload = {
    prestador_id: doc.prestador_id,
    candidato_id: doc.candidato_id || null,
    tipo: doc.tipo,
    url: doc.url_arquivo || doc.arquivo || null,
    dados: doc.dados || null,
    validade: doc.validade || null,
    status: doc.status || "pendente",
    origem: doc.origem || "cadastro",
    created_at: doc.created_at || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("documentos_prestadores")
    .insert([payload])
    .select("id")
    .single();

  if (error) {
    console.error("[Documentos] erro ao inserir:", error);
    return { success: false, mensagem: error.message };
  }

  console.log(`[Documentos] criado: ${doc.tipo} → ${doc.prestador_id}`);
  return { success: true, id: data.id, mensagem: "Documento adicionado" };
}

export async function listarDocumentosPrestador(
  prestadorId: string
): Promise<DocumentoPrestador[]> {
  if (!prestadorId) return [];

  const { data, error } = await supabase
    .from("documentos_prestadores")
    .select("*")
    .eq("prestador_id", prestadorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Documentos] erro ao listar:", error);
    return [];
  }

  return data || [];
}

export async function verificarDocumentosOrfaos(): Promise<{
  total: number;
  orphans: any[];
}> {
  const { data } = await supabase
    .from("documentos_prestadores")
    .select("id, tipo, url, created_at, origem")
    .is("prestador_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return { total: data?.length || 0, orphans: data || [] };
}

export const TIPOS_DOCUMENTO_VALIDOS = [
  "CNH Frente",
  "CNH Verso", 
  "CRLV",
  "CPF",
  "Comprovante de Residência",
  "Comprovante Bancário",
  "Contrato",
  "ANTT",
  "Apólice de Seguro",
  "Documento Pessoal",
  "Outros",
] as const;

export type TipoDocumentoValido = typeof TIPOS_DOCUMENTO_VALIDOS[number];

export function validarTipoDocumento(tipo: string): boolean {
  return TIPOS_DOCUMENTO_VALIDOS.includes(tipo as TipoDocumentoValido);
}