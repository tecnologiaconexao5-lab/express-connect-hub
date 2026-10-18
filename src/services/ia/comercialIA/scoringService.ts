import type { ScoreIA, EstrategiaHunter } from "./types";

export const scoringService = {
  calcularScore(
    dados: {
      segmento_prioritario: boolean;
      possui_frota_propria?: boolean;
      entregas_frequentes?: boolean;
      em_expansao?: boolean;
      novas_unidades?: boolean;
      contratando_motoristas?: boolean;
      reclamando_entregas?: boolean;
      crescendo?: boolean;
      porte?: "pequeno" | "medio" | "grande";
      volume_estimado: string;
      necessidade_logistica?: string;
    },
    estrategia?: EstrategiaHunter
  ): ScoreIA {
    const pesos = estrategia?.scoring?.pesos || {};
    const thresholds = estrategia?.scoring?.thresholds || { em_chamas: 80, quente: 60, morno: 40 };
    const ranges = estrategia?.scoring?.probabilidade_ranges || {
      em_chamas: { min: 75, max: 90 },
      quente: { min: 55, max: 75 },
      morno: { min: 30, max: 50 },
      frio: { min: 10, max: 25 },
    };

    let score = 0;

    if (dados.segmento_prioritario) score += pesos.segmento_prioritario || 20;
    if (dados.possui_frota_propria) score += pesos.possui_frota_propria || 5;
    if (dados.entregas_frequentes) score += pesos.entregas_frequentes || 15;
    if (dados.em_expansao) score += pesos.em_expansao || 10;
    if (dados.novas_unidades) score += pesos.novas_unidades || 10;
    if (dados.contratando_motoristas) score += pesos.contratando_motoristas || 8;
    if (dados.reclamando_entregas) score += pesos.reclamando_entregas || 12;
    if (dados.crescendo) score += pesos.crescendo || 8;

    if (dados.porte === "grande") score += pesos.porte_grande || 15;
    else if (dados.porte === "medio") score += pesos.porte_medio || 10;
    else score += pesos.porte_pequeno || 3;

    if (dados.volume_estimado?.toLowerCase().includes("alto")) score += pesos.volume_alto || 10;
    if (dados.necessidade_logistica) score += pesos.necessidade_logistica || 10;

    score = Math.min(Math.max(score, 0), 100);

    let temperatura: "frio" | "morno" | "quente" | "em_chamas";
    let urgencia: "baixa" | "media" | "alta";
    let probabilidade: number;

    if (score >= (thresholds.em_chamas || 80)) {
      temperatura = "em_chamas";
      urgencia = "alta";
      probabilidade = ranges.em_chamas.min + Math.round(Math.random() * (ranges.em_chamas.max - ranges.em_chamas.min));
    } else if (score >= (thresholds.quente || 60)) {
      temperatura = "quente";
      urgencia = "alta";
      probabilidade = ranges.quente.min + Math.round(Math.random() * (ranges.quente.max - ranges.quente.min));
    } else if (score >= (thresholds.morno || 40)) {
      temperatura = "morno";
      urgencia = "media";
      probabilidade = ranges.morno.min + Math.round(Math.random() * (ranges.morno.max - ranges.morno.min));
    } else {
      temperatura = "frio";
      urgencia = "baixa";
      probabilidade = ranges.frio.min + Math.round(Math.random() * (ranges.frio.max - ranges.frio.min));
    }

    const justificativa = this.gerarJustificativa(score, dados);

    return { score, probabilidade, temperatura, urgencia, justificativa };
  },

  gerarJustificativa(score: number, dados: {
    segmento_prioritario: boolean;
    volume_estimado: string;
    necessidade_logistica?: string;
  }): string {
    const partes: string[] = [];
    if (dados.segmento_prioritario) partes.push("Segmento prioritario");
    if (dados.volume_estimado?.toLowerCase().includes("alto")) partes.push("Alto volume estimado");
    if (dados.necessidade_logistica) partes.push("Necessidade logistica identificada");
    if (score >= 80) partes.push("Potencial de alto valor — prioridade maxima");
    else if (score >= 60) partes.push("Bom potencial comercial");
    else if (score >= 40) partes.push("Potencial medio — requer nutricao");
    return partes.join(". ") || "Score baseado em perfil comercial";
  },
};
