import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { bibliotecaTreinamentoIaService } from "@/services/centralIa/bibliotecaTreinamentoService";

export type StatusAcademia = "rascunho" | "em_andamento" | "aprovado" | "obsoleto" | "revogado";
export type TipoMaterial = "texto" | "pergunta_resposta" | "pdf" | "doc" | "docx" | "xls" | "xlsx" | "csv" | "xml" | "imagem" | "audio" | "video";

export interface AcademiaCurso {
  id: string;
  robo_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string;
  categoria: string | null;
  objetivo: string | null;
  status: StatusAcademia;
  versao: number;
  autor: string | null;
  aprovador: string | null;
  data_aprovacao: string | null;
  validade: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface AcademiaMaterial {
  id: string;
  curso_id: string;
  tipo: TipoMaterial;
  titulo: string;
  conteudo: string | null;
  pergunta: string | null;
  resposta: string | null;
  arquivo_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  duracao_segundos: number | null;
  ordem: number;
  versao: number;
  status: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface AcademiaProgresso {
  id: string;
  robo_id: string;
  curso_id: string;
  material_id: string;
  status: string;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export const academyService = {
  async listarCursos(filtros?: { robo_id?: string; status?: string; tipo?: string; search?: string }): Promise<AcademiaCurso[]> {
    let query = supabase.from("academia_cursos").select("*");
    if (filtros?.robo_id) query = query.eq("robo_id", filtros.robo_id);
    if (filtros?.status) query = query.eq("status", filtros.status);
    if (filtros?.tipo) query = query.eq("tipo", filtros.tipo);
    if (filtros?.search) query = query.ilike("titulo", `%${filtros.search}%`);
    const { data } = await query.order("created_at", { ascending: false });
    return (data as AcademiaCurso[]) || [];
  },

  async criarCurso(dados: { robo_id?: string; titulo: string; descricao?: string; tipo?: string; categoria?: string; objetivo?: string; tags?: string[]; validade?: string }): Promise<AcademiaCurso | null> {
    const { data, error } = await supabase.from("academia_cursos").insert({
      robo_id: dados.robo_id || null,
      titulo: dados.titulo,
      descricao: dados.descricao || null,
      tipo: dados.tipo || "curso",
      categoria: dados.categoria || null,
      objetivo: dados.objetivo || null,
      status: "rascunho",
      versao: 1,
      tags: dados.tags || [],
      validade: dados.validade || null,
    }).select().single();
    if (error) { console.error("[Academy] erro criar curso:", error.message); return null; }
    if (data) {
      await centralIaService.registrarLog({
        robo_id: dados.robo_id || null, acao: "academia_curso_criado",
        entrada: { titulo: dados.titulo }, saida: { curso_id: data.id }, status: "sucesso",
      });
    }
    return data as AcademiaCurso;
  },

  async atualizarCurso(id: string, updates: Partial<AcademiaCurso>): Promise<void> {
    const { error } = await supabase.from("academia_cursos").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) console.error("[Academy] erro atualizar curso:", error.message);
    else {
      await centralIaService.registrarLog({
        robo_id: null, acao: "academia_curso_atualizado",
        entrada: { curso_id: id }, saida: updates, status: "info",
      });
    }
  },

  async alterarStatusCurso(id: string, status: StatusAcademia): Promise<void> {
    await academyService.atualizarCurso(id, { status } as Partial<AcademiaCurso>);
  },

  async criarNovaVersaoCurso(id: string): Promise<AcademiaCurso | null> {
    const { data: original } = await supabase.from("academia_cursos").select("*").eq("id", id).single();
    if (!original) return null;
    const { data: novo } = await supabase.from("academia_cursos").insert({
      robo_id: original.robo_id, titulo: original.titulo, descricao: original.descricao,
      tipo: original.tipo, categoria: original.categoria, objetivo: original.objetivo,
      status: "rascunho", versao: original.versao + 1, tags: original.tags, validade: original.validade,
    }).select().single();
    if (novo) {
      const { data: materiais } = await supabase.from("academia_materiais").select("*").eq("curso_id", id);
      if (materiais) {
        for (const m of materiais) {
          await supabase.from("academia_materiais").insert({
            curso_id: novo.id, tipo: m.tipo, titulo: m.titulo, conteudo: m.conteudo,
            pergunta: m.pergunta, resposta: m.resposta, arquivo_url: m.arquivo_url,
            storage_path: m.storage_path, mime_type: m.mime_type, tamanho_bytes: m.tamanho_bytes,
            duracao_segundos: m.duracao_segundos, ordem: m.ordem, tags: m.tags,
          });
        }
      }
    }
    return novo as AcademiaCurso;
  },

  async listarMateriais(cursoId: string): Promise<AcademiaMaterial[]> {
    const { data } = await supabase.from("academia_materiais").select("*").eq("curso_id", cursoId).order("ordem", { ascending: true });
    return (data as AcademiaMaterial[]) || [];
  },

  async criarMaterial(dados: { curso_id: string; tipo: TipoMaterial; titulo: string; conteudo?: string; pergunta?: string; resposta?: string; ordem?: number; tags?: string[] }): Promise<AcademiaMaterial | null> {
    const { data, error } = await supabase.from("academia_materiais").insert({
      curso_id: dados.curso_id, tipo: dados.tipo, titulo: dados.titulo,
      conteudo: dados.conteudo || null, pergunta: dados.pergunta || null,
      resposta: dados.resposta || null, ordem: dados.ordem || 0, tags: dados.tags || [],
    }).select().single();
    if (error) { console.error("[Academy] erro criar material:", error.message); return null; }
    return data as AcademiaMaterial;
  },

  async atualizarMaterial(id: string, updates: Partial<AcademiaMaterial>): Promise<void> {
    await supabase.from("academia_materiais").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
  },

  async deletarMaterial(id: string): Promise<void> {
    await supabase.from("academia_materiais").delete().eq("id", id);
  },

  async uploadMaterialArquivo(cursoId: string, materialId: string, roboId: string, file: File, tipo: TipoMaterial): Promise<{ url: string; storagePath: string } | null> {
    const storagePath = `academia/${cursoId}/${Date.now()}-${file.name}`;
    const bucket = "biblioteca-global";
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) { console.error("[Academy] upload error:", uploadError.message); return null; }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    await supabase.from("academia_materiais").update({
      arquivo_url: urlData.publicUrl, storage_path: storagePath, mime_type: file.type, tamanho_bytes: file.size, updated_at: new Date().toISOString(),
    }).eq("id", materialId);
    await centralIaService.registrarLog({
      robo_id: roboId, acao: "academia_material_upload",
      entrada: { curso_id: cursoId, nome: file.name, tipo }, saida: { storagePath, url: urlData.publicUrl }, status: "sucesso",
    });
    return { url: urlData.publicUrl, storagePath };
  },

  async listarProgresso(roboId: string, cursoId?: string): Promise<AcademiaProgresso[]> {
    let query = supabase.from("academia_progresso").select("*").eq("robo_id", roboId);
    if (cursoId) query = query.eq("curso_id", cursoId);
    const { data } = await query;
    return (data as AcademiaProgresso[]) || [];
  },

  async registrarProgresso(roboId: string, cursoId: string, materialId: string, status: string, observacao?: string): Promise<void> {
    await supabase.from("academia_progresso").upsert({
      robo_id: roboId, curso_id: cursoId, material_id: materialId, status, observacao: observacao || null, atualizado_em: new Date().toISOString(),
    }, { onConflict: "robo_id, curso_id, material_id" });
  },
};
