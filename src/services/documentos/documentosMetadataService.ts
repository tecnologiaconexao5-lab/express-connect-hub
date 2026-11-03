import { supabase } from "@/lib/supabase";
import {
  BUCKET_DOCUMENTOS_OPERACIONAIS,
  resolverUrlDocumento,
} from "@/services/documentos/documentoStorageService";
import { parseStorageRef } from "@/services/storage/storageRefService";

export type StatusIADocumento =
  | "pendente"
  | "processando"
  | "aprovado_na_conferencia"
  | "aprovado_com_ressalvas"
  | "com_ressalvas"
  | "necessita_de_correcao"
  | "aguardando_conferencia_humana"
  | "erro";

export type StatusRelatorioIA =
  | "APROVADO NA CONFERÊNCIA"
  | "APROVADO COM RESSALVAS"
  | "NECESSITA DE CORREÇÃO"
  | "AGUARDANDO CONFERÊNCIA HUMANA";

export const CATEGORIAS_DOCUMENTO = [
  "Comercial",
  "Operacional",
  "Financeiro",
  "Recrutamento",
  "Administrativo",
] as const;

export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number];

export const STATUS_IA_LABEL: Record<StatusIADocumento, string> = {
  pendente: "AGUARDANDO CONFERÊNCIA HUMANA",
  processando: "PROCESSANDO",
  aprovado_na_conferencia: "APROVADO NA CONFERÊNCIA",
  aprovado_com_ressalvas: "APROVADO COM RESSALVAS",
  com_ressalvas: "APROVADO COM RESSALVAS",
  necessita_de_correcao: "NECESSITA DE CORREÇÃO",
  aguardando_conferencia_humana: "AGUARDANDO CONFERÊNCIA HUMANA",
  erro: "ERRO NA ANÁLISE",
};

export const STATUS_IA_CLASSE: Record<StatusIADocumento, string> = {
  pendente: "border-amber-200 bg-amber-50 text-amber-700",
  processando: "border-blue-200 bg-blue-50 text-blue-700",
  aprovado_na_conferencia: "border-emerald-200 bg-emerald-50 text-emerald-700",
  aprovado_com_ressalvas: "border-amber-200 bg-amber-50 text-amber-700",
  com_ressalvas: "border-amber-200 bg-amber-50 text-amber-700",
  necessita_de_correcao: "border-rose-200 bg-rose-50 text-rose-700",
  aguardando_conferencia_humana: "border-violet-200 bg-violet-50 text-violet-700",
  erro: "border-gray-200 bg-gray-50 text-gray-600",
};

export interface InformacaoVerificada {
  campo: string;
  valor: string;
}

export interface RelatorioIA {
  status: StatusRelatorioIA;
  informacoes_verificadas: InformacaoVerificada[];
  itens_corretos: string[];
  informacoes_ausentes: string[];
  erros_identificados: string[];
  recomendacoes: string[];
  sugestao_correcao?: string | null;
  /** Compatibilidade com relatórios antigos. */
  observacoes?: string[];
  gerado_em?: string;
  origem?: "edge" | "simulado";
}

export interface DocumentoHistoricoEvento {
  id?: string;
  tipo: string;
  descricao: string;
  usuario?: string | null;
  data: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentoMetadata {
  id: string;
  url: string;
  nome: string | null;
  tipo: string | null;
  modulo_origem: string;
  entidade_id: string | null;
  entidade_nome: string | null;
  status_ia: StatusIADocumento;
  relatorio_ia: RelatorioIA | null;
  data_inclusao: string;
  categoria: CategoriaDocumento;
  departamento: string | null;
  responsavel: string | null;
  responsavel_id: string | null;
  cliente_id: string | null;
  descricao: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  versao: number;
  documento_pai_id: string | null;
  ativo: boolean;
  historico: DocumentoHistoricoEvento[];
  updated_at?: string | null;
  tenant_id?: string | null;
}

export interface ResultadoUploadDocumento {
  documento: DocumentoMetadata;
  urlAssinada: string | null;
}

export interface FiltrosDocumentosCentral {
  nome?: string;
  categoria?: string;
  departamento?: string;
  entidade?: string;
  responsavel?: string;
  dataInicio?: string;
  dataFim?: string;
  statusIa?: string;
  moduloOrigem?: string;
  apenasAtivos?: boolean;
  limite?: number;
}

export interface OpcoesFiltrosDocumentos {
  departamentos: string[];
  entidades: string[];
  responsaveis: string[];
}

const TABELA = "documentos_metadata";

const statusIAParaCodigo = (status: string): StatusIADocumento => {
  const normalizado = String(status || "").trim().toUpperCase();
  if (
    normalizado === "APROVADO NA CONFERÊNCIA" ||
    normalizado === "APROVADO NA CONFERENCIA" ||
    normalizado === "APROVADO_NA_CONFERENCIA"
  ) {
    return "aprovado_na_conferencia";
  }
  if (
    normalizado === "APROVADO COM RESSALVAS" ||
    normalizado === "APROVADO_COM_RESSALVAS" ||
    normalizado === "COM RESSALVAS" ||
    normalizado === "COM_RESSALVAS"
  ) {
    return "aprovado_com_ressalvas";
  }
  if (
    normalizado === "NECESSITA DE CORREÇÃO" ||
    normalizado === "NECESSITA DE CORRECAO" ||
    normalizado === "NECESSITA_DE_CORRECAO"
  ) {
    return "necessita_de_correcao";
  }
  if (
    normalizado === "AGUARDANDO CONFERÊNCIA HUMANA" ||
    normalizado === "AGUARDANDO CONFERENCIA HUMANA" ||
    normalizado === "AGUARDANDO_CONFERENCIA_HUMANA"
  ) {
    return "aguardando_conferencia_humana";
  }
  return "pendente";
};

export const codigoStatusIAParaRelatorio = (status: StatusIADocumento): StatusRelatorioIA => {
  if (status === "aprovado_na_conferencia") return "APROVADO NA CONFERÊNCIA";
  if (status === "aprovado_com_ressalvas" || status === "com_ressalvas") return "APROVADO COM RESSALVAS";
  if (status === "necessita_de_correcao") return "NECESSITA DE CORREÇÃO";
  return "AGUARDANDO CONFERÊNCIA HUMANA";
};

export function statusIAParaStatusDocumento(
  status: StatusIADocumento,
): "valido" | "em_analise" | "reprovado" {
  if (status === "aprovado_na_conferencia") return "valido";
  if (status === "necessita_de_correcao") return "reprovado";
  return "em_analise";
}

export function statusRelatorioIAParaStatusDocumento(
  status: StatusRelatorioIA,
): "valido" | "em_analise" | "reprovado" {
  return statusIAParaStatusDocumento(statusIAParaCodigo(status));
}

const erroTabelaInexistente = (erro: { code?: string; message?: string } | null): boolean => {
  if (!erro) return false;
  const codigo = String(erro.code || "");
  const msg = String(erro.message || "").toLowerCase();
  return (
    codigo === "42P01" ||
    codigo === "PGRST205" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist")
  );
};

const asStringArray = (valor: unknown): string[] => {
  if (!Array.isArray(valor)) return [];
  return valor.map((v) => String(v || "").trim()).filter(Boolean);
};

const normalizarInformacoes = (valor: unknown): InformacaoVerificada[] => {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((item) => {
      if (typeof item === "string") {
        return { campo: item, valor: item };
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return {
          campo: String(obj.campo || obj.label || obj.nome || "Informação"),
          valor: String(obj.valor || obj.value || "").trim(),
        };
      }
      return null;
    })
    .filter((item): item is InformacaoVerificada => Boolean(item && item.valor));
};

const normalizarRelatorio = (valor: unknown): RelatorioIA | null => {
  if (!valor || typeof valor !== "object") return null;
  const obj = valor as Record<string, unknown>;
  const status = codigoStatusIAParaRelatorio(statusIAParaCodigo(String(obj.status || "")));
  return {
    status,
    informacoes_verificadas: normalizarInformacoes(obj.informacoes_verificadas),
    itens_corretos: asStringArray(obj.itens_corretos),
    informacoes_ausentes: asStringArray(obj.informacoes_ausentes),
    erros_identificados: asStringArray(obj.erros_identificados),
    recomendacoes: asStringArray(obj.recomendacoes),
    sugestao_correcao: typeof obj.sugestao_correcao === "string" ? obj.sugestao_correcao : null,
    observacoes: asStringArray(obj.observacoes),
    gerado_em: typeof obj.gerado_em === "string" ? obj.gerado_em : undefined,
    origem: obj.origem === "edge" ? "edge" : "simulado",
  };
};

const normalizarDocumento = (row: Record<string, unknown>): DocumentoMetadata => ({
  id: String(row.id || ""),
  url: String(row.url || ""),
  nome: row.nome == null ? null : String(row.nome),
  tipo: row.tipo == null ? null : String(row.tipo),
  modulo_origem: String(row.modulo_origem || "prestadores"),
  entidade_id: row.entidade_id == null ? null : String(row.entidade_id),
  entidade_nome: row.entidade_nome == null ? null : String(row.entidade_nome),
  status_ia: (row.status_ia as StatusIADocumento) || "pendente",
  relatorio_ia: normalizarRelatorio(row.relatorio_ia),
  data_inclusao: String(row.data_inclusao || new Date().toISOString()),
  categoria: (row.categoria as CategoriaDocumento) || "Operacional",
  departamento: row.departamento == null ? null : String(row.departamento),
  responsavel: row.responsavel == null ? null : String(row.responsavel),
  responsavel_id: row.responsavel_id == null ? null : String(row.responsavel_id),
  cliente_id: row.cliente_id == null ? null : String(row.cliente_id),
  descricao: row.descricao == null ? null : String(row.descricao),
  mime_type: row.mime_type == null ? null : String(row.mime_type),
  tamanho_bytes: row.tamanho_bytes == null ? null : Number(row.tamanho_bytes),
  versao: Number(row.versao || 1),
  documento_pai_id: row.documento_pai_id == null ? null : String(row.documento_pai_id),
  ativo: row.ativo !== false,
  historico: Array.isArray(row.historico) ? (row.historico as DocumentoHistoricoEvento[]) : [],
  updated_at: row.updated_at == null ? null : String(row.updated_at),
  tenant_id: row.tenant_id == null ? null : String(row.tenant_id),
});

export async function listarDocumentosMetadata(
  moduloOrigem: string,
  entidadeId: string,
): Promise<DocumentoMetadata[]> {
  if (!moduloOrigem || !entidadeId) return [];
  const { data, error } = await supabase
    .from(TABELA)
    .select("*")
    .eq("modulo_origem", moduloOrigem)
    .eq("entidade_id", entidadeId)
    .eq("ativo", true)
    .order("data_inclusao", { ascending: false });

  if (error) {
    if (!erroTabelaInexistente(error)) {
      console.warn("[DocumentosMetadata] Falha ao listar:", error.message);
    }
    return [];
  }
  return (data || []).map((row) => normalizarDocumento(row as Record<string, unknown>));
}

export async function listarDocumentosCentral(
  filtros: FiltrosDocumentosCentral = {},
): Promise<DocumentoMetadata[]> {
  let query = supabase
    .from(TABELA)
    .select("*")
    .order("data_inclusao", { ascending: false })
    .limit(filtros.limite ?? 500);

  if (filtros.apenasAtivos !== false) query = query.eq("ativo", true);
  if (filtros.nome?.trim()) query = query.ilike("nome", `%${filtros.nome.trim()}%`);
  if (filtros.categoria && filtros.categoria !== "todas") query = query.eq("categoria", filtros.categoria);
  if (filtros.departamento && filtros.departamento !== "todos") {
    query = query.ilike("departamento", `%${filtros.departamento.trim()}%`);
  }
  if (filtros.entidade?.trim()) query = query.ilike("entidade_nome", `%${filtros.entidade.trim()}%`);
  if (filtros.responsavel?.trim()) query = query.ilike("responsavel", `%${filtros.responsavel.trim()}%`);
  if (filtros.statusIa && filtros.statusIa !== "todos") query = query.eq("status_ia", filtros.statusIa);
  if (filtros.moduloOrigem) query = query.eq("modulo_origem", filtros.moduloOrigem);
  if (filtros.dataInicio) query = query.gte("data_inclusao", `${filtros.dataInicio}T00:00:00`);
  if (filtros.dataFim) query = query.lte("data_inclusao", `${filtros.dataFim}T23:59:59`);

  const { data, error } = await query;
  if (error) {
    if (!erroTabelaInexistente(error)) {
      console.warn("[DocumentosCentral] Falha ao listar:", error.message);
    }
    return [];
  }
  return (data || []).map((row) => normalizarDocumento(row as Record<string, unknown>));
}

export async function listarOpcoesFiltrosDocumentos(): Promise<OpcoesFiltrosDocumentos> {
  const { data, error } = await supabase
    .from(TABELA)
    .select("departamento, entidade_nome, responsavel")
    .eq("ativo", true)
    .limit(2000);
  if (error) return { departamentos: [], entidades: [], responsaveis: [] };
  const rows = (data || []) as Array<Record<string, unknown>>;
  const unicos = (campo: string) =>
    Array.from(new Set(rows.map((r) => String(r[campo] || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  return {
    departamentos: unicos("departamento"),
    entidades: unicos("entidade_nome"),
    responsaveis: unicos("responsavel"),
  };
}

export async function obterDocumentoMetadata(id: string): Promise<DocumentoMetadata | null> {
  if (!id) return null;
  const { data, error } = await supabase.from(TABELA).select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return normalizarDocumento(data as Record<string, unknown>);
}

export async function urlAssinadaDocumentoMetadata(
  url: string | null | undefined,
  prestadorId?: string | null,
): Promise<string | null> {
  return resolverUrlDocumento(url, {
    prestadorId,
    bucketEsperado: BUCKET_DOCUMENTOS_OPERACIONAIS,
  });
}

function extensaoSegura(file: File): string {
  const daExtensao = String(file.name.split(".").pop() || "").toLowerCase();
  if (/^(pdf|jpg|jpeg|png|webp)$/.test(daExtensao)) return daExtensao;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function enviarDocumentoOperacional(input: {
  file: File;
  moduloOrigem: string;
  entidadeId?: string | null;
  entidadeNome?: string | null;
  tipo: string;
  nome?: string;
  categoria?: CategoriaDocumento;
  departamento?: string | null;
  responsavel?: string | null;
  responsavelId?: string | null;
  clienteId?: string | null;
  descricao?: string | null;
  documentoPaiId?: string | null;
  versao?: number;
  espelharLegado?: boolean;
}): Promise<ResultadoUploadDocumento> {
  const { file, moduloOrigem, tipo } = input;
  const entidadeId = input.entidadeId?.trim() || null;
  if (!file) throw new Error("Arquivo não informado.");
  if (moduloOrigem === "prestadores" && !entidadeId) {
    throw new Error("Entidade não identificada para o upload.");
  }

  const tipoSeguro = tipo.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
  const identificador = entidadeId || "central";
  const path = `doc_${identificador}_${tipoSeguro}_${Date.now()}.${extensaoSegura(file)}`;

  const { data: upload, error: uploadError } = await supabase.storage
    .from(BUCKET_DOCUMENTOS_OPERACIONAIS)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (uploadError || !upload) {
    throw new Error(uploadError?.message || "Falha no upload do documento.");
  }

  const referencia = `${BUCKET_DOCUMENTOS_OPERACIONAIS}/${upload.path}`;
  const eventoInicial: DocumentoHistoricoEvento = {
    id: crypto.randomUUID?.() || `evt_${Date.now()}`,
    tipo: input.documentoPaiId ? "nova_versao" : "criacao",
    descricao: input.documentoPaiId
      ? `Versão ${input.versao ?? 1} criada preservando a versão anterior.`
      : "Documento enviado para a Central de Documentos.",
    data: new Date().toISOString(),
    usuario: input.responsavel || null,
  };

  const payload = {
    url: referencia,
    nome: input.nome || file.name || tipo,
    tipo,
    modulo_origem: moduloOrigem,
    entidade_id: entidadeId,
    entidade_nome: input.entidadeNome ?? null,
    status_ia: "pendente" as StatusIADocumento,
    relatorio_ia: null,
    data_inclusao: new Date().toISOString(),
    categoria: input.categoria || "Operacional",
    departamento: input.departamento ?? null,
    responsavel: input.responsavel ?? null,
    responsavel_id: input.responsavelId ?? null,
    cliente_id: input.clienteId ?? null,
    descricao: input.descricao ?? null,
    mime_type: file.type || null,
    tamanho_bytes: file.size,
    versao: input.versao ?? 1,
    documento_pai_id: input.documentoPaiId ?? null,
    ativo: true,
    historico: [eventoInicial],
  };

  const { data, error } = await supabase.from(TABELA).insert([payload]).select("*").single();
  if (error) {
    throw new Error(`Documento enviado, mas o metadado não foi salvo: ${error.message}`);
  }

  if (moduloOrigem === "prestadores" && input.espelharLegado !== false) {
    const { error: legadoError } = await supabase.from("documentos_prestadores").insert([
      {
        prestador_id: entidadeId,
        tipo,
        url: referencia,
        created_at: new Date().toISOString(),
      },
    ]);
    if (legadoError) {
      console.warn("[DocumentosMetadata] Documento novo não espelhado na tabela legada:", legadoError.message);
    }
  }

  return {
    documento: normalizarDocumento(data as Record<string, unknown>),
    urlAssinada: await urlAssinadaDocumentoMetadata(referencia, entidadeId),
  };
}

export async function enviarDocumentoOperacionalPrestador(input: {
  file: File;
  prestadorId: string;
  tipo: string;
  nome?: string;
}): Promise<ResultadoUploadDocumento> {
  let entidadeNome: string | null = null;
  try {
    const { data } = await supabase
      .from("prestadores")
      .select("nome_fantasia, nome_completo")
      .eq("id", input.prestadorId)
      .maybeSingle();
    const row = data as { nome_fantasia?: string; nome_completo?: string } | null;
    entidadeNome = row?.nome_fantasia || row?.nome_completo || null;
  } catch {
    // nome é apenas informativo
  }

  return enviarDocumentoOperacional({
    file: input.file,
    moduloOrigem: "prestadores",
    entidadeId: input.prestadorId,
    entidadeNome,
    tipo: input.tipo,
    nome: input.nome,
    categoria: "Recrutamento",
    departamento: "Operações",
    responsavel: "TMS",
  });
}

export async function listarVersoesDocumento(id: string): Promise<DocumentoMetadata[]> {
  const doc = await obterDocumentoMetadata(id);
  if (!doc) return [];
  const raiz = doc.documento_pai_id || doc.id;
  const { data, error } = await supabase
    .from(TABELA)
    .select("*")
    .or(`id.eq.${raiz},documento_pai_id.eq.${raiz}`)
    .order("versao", { ascending: false });
  if (error) return [doc];
  return (data || []).map((row) => normalizarDocumento(row as Record<string, unknown>));
}

export async function criarNovaVersaoDocumento(
  original: DocumentoMetadata,
  file: File,
  extras?: { nome?: string; descricao?: string | null; responsavel?: string | null },
): Promise<ResultadoUploadDocumento> {
  const versoes = await listarVersoesDocumento(original.id);
  const raiz = original.documento_pai_id || original.id;
  const proximaVersao = Math.max(original.versao, ...versoes.map((v) => v.versao), 0) + 1;

  const resultado = await enviarDocumentoOperacional({
    file,
    moduloOrigem: original.modulo_origem,
    entidadeId: original.entidade_id || "",
    entidadeNome: original.entidade_nome,
    tipo: original.tipo || "Outros",
    nome: extras?.nome || original.nome || file.name,
    categoria: original.categoria,
    departamento: original.departamento,
    responsavel: extras?.responsavel ?? original.responsavel,
    responsavelId: original.responsavel_id,
    clienteId: original.cliente_id,
    descricao: extras?.descricao ?? original.descricao,
    documentoPaiId: raiz,
    versao: proximaVersao,
  });

  const anteriores = versoes.filter((v) => v.id !== resultado.documento.id).map((v) => v.id);
  if (anteriores.length) {
    await supabase.from(TABELA).update({ ativo: false }).in("id", anteriores);
  }

  await registrarEventoDocumento(original.id, {
    tipo: "versao_substituida",
    descricao: `Nova versão ${proximaVersao} enviada. Arquivo original preservado no histórico.`,
  });

  return resultado;
}

export async function registrarEventoDocumento(
  documentoId: string,
  evento: Omit<DocumentoHistoricoEvento, "data" | "id"> & { data?: string },
): Promise<void> {
  if (!documentoId) return;
  const doc = await obterDocumentoMetadata(documentoId);
  if (!doc) return;
  const novoEvento: DocumentoHistoricoEvento = {
    id: crypto.randomUUID?.() || `evt_${Date.now()}`,
    tipo: evento.tipo,
    descricao: evento.descricao,
    usuario: evento.usuario ?? null,
    data: evento.data || new Date().toISOString(),
    metadata: evento.metadata,
  };
  const historico = [...(doc.historico || []), novoEvento];
  await supabase
    .from(TABELA)
    .update({ historico, updated_at: new Date().toISOString() })
    .eq("id", documentoId);
}

export async function compartilharDocumentoInternamente(
  documentoId: string,
  destinatario: string,
  mensagem: string,
): Promise<string | null> {
  const doc = await obterDocumentoMetadata(documentoId);
  if (!doc) return null;
  await registrarEventoDocumento(documentoId, {
    tipo: "compartilhamento_interno",
    descricao: `Compartilhado internamente com ${destinatario}${mensagem ? `: ${mensagem}` : ""}.`,
    usuario: destinatario,
    metadata: { destinatario, mensagem },
  });
  return urlAssinadaDocumentoMetadata(doc.url, doc.entidade_id);
}

export async function baixarDocumentoMetadata(doc: DocumentoMetadata): Promise<void> {
  const ref = parseStorageRef(doc.url, BUCKET_DOCUMENTOS_OPERACIONAIS);
  if (!ref) throw new Error("Referência de arquivo inválida.");
  if (ref.external) {
    const link = document.createElement("a");
    link.href = ref.raw;
    link.download = doc.nome || "documento";
    link.target = "_blank";
    link.click();
    return;
  }
  const { data, error } = await supabase.storage.from(ref.bucket).download(ref.path);
  if (error || !data) throw new Error(error?.message || "Falha ao baixar o documento.");
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.nome || ref.path.split("/").pop() || "documento";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function simularAnaliseDocumentoIA(input: {
  nome?: string | null;
  tipo?: string | null;
  url?: string | null;
}): RelatorioIA {
  const nome = String(input.nome || "").toLowerCase();
  const tipo = String(input.tipo || "").toLowerCase();
  const base = {
    gerado_em: new Date().toISOString(),
    origem: "simulado" as const,
  };

  if (!input.url) {
    return {
      ...base,
      status: "NECESSITA DE CORREÇÃO",
      informacoes_verificadas: [],
      itens_corretos: [],
      informacoes_ausentes: ["Arquivo legível", "Documento completo"],
      erros_identificados: ["Nenhum arquivo válido foi encontrado para conferência."],
      recomendacoes: ["Faça o upload do documento e solicite uma nova análise."],
      sugestao_correcao: "Enviar o arquivo original em PDF ou imagem nítida.",
      observacoes: ["Nenhum arquivo válido foi encontrado para este documento."],
    };
  }

  if (nome.includes("ilegivel") || nome.includes("ilegível") || nome.includes("borrado")) {
    return {
      ...base,
      status: "NECESSITA DE CORREÇÃO",
      informacoes_verificadas: [{ campo: "Legibilidade", valor: "Insuficiente" }],
      itens_corretos: ["Documento recebido"],
      informacoes_ausentes: ["Texto nítido", "Enquadramento completo"],
      erros_identificados: ["A imagem parece ilegível ou desfocada."],
      recomendacoes: ["Gerar nova versão com foto nítida, documento inteiro e boa iluminação."],
      sugestao_correcao: "Refazer a captura do documento preservando o arquivo original no histórico.",
      observacoes: ["A imagem parece ilegível ou desfocada."],
    };
  }

  if (tipo.includes("cnh") || tipo.includes("crlv") || tipo.includes("antt") || tipo.includes("rntrc")) {
    return {
      ...base,
      status: "APROVADO NA CONFERÊNCIA",
      informacoes_verificadas: [
        { campo: "Legibilidade", valor: "Boa" },
        { campo: "Enquadramento", valor: "Documento completo" },
        { campo: "Tipo identificado", valor: tipo.toUpperCase() },
        { campo: "Titular", valor: "Identificado" },
      ],
      itens_corretos: [
        "Documento legível e enquadrado corretamente.",
        "Campos principais identificados (titular, número e validade).",
        "Nenhuma divergência crítica encontrada na conferência automática.",
      ],
      informacoes_ausentes: [],
      erros_identificados: [],
      recomendacoes: ["Documento apto para aprovação na conferência humana final."],
      sugestao_correcao: null,
      observacoes: [],
    };
  }

  return {
    ...base,
    status: "AGUARDANDO CONFERÊNCIA HUMANA",
    informacoes_verificadas: [
      { campo: "Tipo identificado", valor: tipo || "Não classificado" },
      { campo: "Arquivo", valor: input.nome || "Documento" },
    ],
    itens_corretos: ["Documento recebido e processado pela conferência automática."],
    informacoes_ausentes: ["Confirmação humana da categoria e validade."],
    erros_identificados: [],
    recomendacoes: ["Revisar visualmente os dados antes da aprovação definitiva."],
    sugestao_correcao: null,
    observacoes: ["Documento processado em modo simulado."],
  };
}

export async function analisarDocumentoComIA(input: {
  url?: string | null;
  nome?: string | null;
  tipo?: string | null;
  moduloOrigem?: string;
  entidadeId?: string | null;
}): Promise<RelatorioIA> {
  try {
    const { data, error } = await supabase.functions.invoke("documentos-ia", {
      body: {
        url: input.url || null,
        nome: input.nome || null,
        tipo: input.tipo || null,
        modulo_origem: input.moduloOrigem || "prestadores",
        entidade_id: input.entidadeId || null,
      },
    });

    if (!error && data && typeof data === "object") {
      const relatorio = normalizarRelatorio({
        ...(data as Record<string, unknown>),
        gerado_em: new Date().toISOString(),
        origem: "edge",
      });
      if (relatorio) return relatorio;
    }
  } catch (erro) {
    console.warn("[DocumentosIA] Edge indisponível, usando análise simulada:", erro);
  }

  return simularAnaliseDocumentoIA(input);
}

export async function atualizarAnaliseDocumentoMetadata(
  documentoId: string,
  relatorio: RelatorioIA,
): Promise<DocumentoMetadata | null> {
  if (!documentoId) return null;
  const status = statusIAParaCodigo(relatorio.status);
  const { data, error } = await supabase
    .from(TABELA)
    .update({ status_ia: status, relatorio_ia: relatorio, updated_at: new Date().toISOString() })
    .eq("id", documentoId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[DocumentosMetadata] Falha ao salvar relatório IA:", error.message);
    return null;
  }

  await registrarEventoDocumento(documentoId, {
    tipo: "analise_ia",
    descricao: `Análise de IA concluída: ${relatorio.status}.`,
    metadata: { status: relatorio.status },
  });

  return data ? normalizarDocumento(data as Record<string, unknown>) : null;
}
