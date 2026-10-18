import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import type { HunterAprendizado, EstrategiaHunter } from "./types";

export const aprendizadoService = {
  async registrar(res: Omit<HunterAprendizado, "id" | "created_at">): Promise<HunterAprendizado | null> {
    const { data, error } = await supabase
      .from("comercial_hunter_aprendizado")
      .insert([{
        robo_id: res.robo_id, resultado_id: res.resultado_id, lead_id: res.lead_id,
        tipo: res.tipo, descricao: res.descricao, dados: res.dados,
        score_antes: res.score_antes, score_depois: res.score_depois,
        feedback: res.feedback, acao_corretiva: res.acao_corretiva,
      }])
      .select()
      .single();

    if (error) { console.error("[Aprendizado] Erro ao registrar:", error); return null; }

    await centralIaService.registrarLog({
      tipo: "info", modulo: "Comercial IA", acao: "aprendizado",
      descricao: `Aprendizado: ${res.tipo} - ${res.descricao || ""}`,
    });

    return data as HunterAprendizado;
  },

  async listar(roboId?: string, tipo?: string, limit = 50): Promise<HunterAprendizado[]> {
    let query = supabase
      .from("comercial_hunter_aprendizado")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (roboId) query = query.eq("robo_id", roboId);
    if (tipo) query = query.eq("tipo", tipo);
    const { data } = await query;
    return (data || []) as HunterAprendizado[];
  },

  async calcularTaxaConvercao(roboId?: string): Promise<{
    total: number; respondeu: number; ignorou: number; recusou: number;
    virou_cliente: number; orcamento: number; fechou: number; taxa_conversao_percent: number;
  }> {
    let query = supabase.from("comercial_hunter_aprendizado").select("tipo");
    if (roboId) query = query.eq("robo_id", roboId);
    const { data } = await query;
    const registros = data || [];
    const total = registros.length;
    const respondeu = registros.filter(r => r.tipo === "respondeu").length;
    const ignorou = registros.filter(r => r.tipo === "ignorou").length;
    const recusou = registros.filter(r => r.tipo === "recusou").length;
    const virou_cliente = registros.filter(r => r.tipo === "virou_cliente").length;
    const orcamento = registros.filter(r => r.tipo === "orcamento").length;
    const fechou = registros.filter(r => r.tipo === "fechou").length;
    return { total, respondeu, ignorou, recusou, virou_cliente, orcamento, fechou, taxa_conversao_percent: total > 0 ? Math.round((fechou / total) * 100) : 0 };
  },

  async recalcularScorePorAprendizado(scoreAtual: number, roboId: string, estrategia?: EstrategiaHunter): Promise<number> {
    const { data } = await supabase
      .from("comercial_hunter_aprendizado")
      .select("tipo")
      .eq("robo_id", roboId)
      .order("created_at", { ascending: false })
      .limit(20);

    const recentes = data || [];
    const ajustes = recentes.map(r => {
      switch (r.tipo) {
        case "fechou": return +5;
        case "virou_cliente": return +4;
        case "orcamento": return +2;
        case "respondeu": return +1;
        case "ignorou": return -1;
        case "recusou": return -2;
        default: return 0;
      }
    });

    const ajusteTotal = ajustes.reduce((a, b) => a + b, 0);
    return Math.min(Math.max(scoreAtual + ajusteTotal, 0), 100);
  },
};
