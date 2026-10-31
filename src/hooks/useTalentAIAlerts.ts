// ============================================================
// FASE 7 — Alertas Inteligentes do Talent Intelligence
// Varre validade de documentos e inatividade do funil.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type TalentAlertSeveridade = "info" | "warning" | "critical";
export type TalentAlertTipo =
  | "documento_vencendo"
  | "documento_vencido"
  | "documento_pendente"
  | "funil_inativo";

export interface TalentAIAlert {
  id: string;
  tipo: TalentAlertTipo;
  severidade: TalentAlertSeveridade;
  titulo: string;
  descricao: string;
  prestadorId?: string;
  prestadorNome?: string;
  candidatoId?: string;
  dias?: number;
}

const DIAS_ALERTA_DOCUMENTO = 30;
const DIAS_INATIVIDADE_FUNIL = 7;

const STAGES_ENCERRADOS = new Set([
  "aprovado",
  "reprovado",
  "processo_encerrado",
  "homologado_disponivel",
  "homologado_indisponivel",
  "banco_de_talentos",
]);

function diasAte(data?: string | null): number | null {
  if (!data) return null;
  const alvo = new Date(`${String(data).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function nomeDoJoin(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const obj = value as Record<string, unknown>;
  return String(obj.nome_completo || obj.nome_fantasia || obj.razao_social || "");
}

export async function varrerAlertasTalent(): Promise<TalentAIAlert[]> {
  const alertas: TalentAIAlert[] = [];

  // 1) Documentos — vencimento/pendência
  try {
    const { data } = await supabase
      .from("documentos_prestadores")
      .select("*, prestadores(nome_completo)")
      .limit(500);

    for (const row of (data as Array<Record<string, unknown>>) || []) {
      const prestadorNome = nomeDoJoin(row.prestadores);
      const tipo = String(row.tipo || "Documento");
      const status = String(row.status || "").toLowerCase();
      const validade = String(row.data_vencimento || row.validade || "");
      const dias = diasAte(validade);
      const base = {
        prestadorId: row.prestador_id ? String(row.prestador_id) : undefined,
        prestadorNome: prestadorNome || undefined,
      };

      if (dias !== null && dias < 0) {
        alertas.push({
          id: `doc-vencido-${String(row.id)}`,
          tipo: "documento_vencido",
          severidade: "critical",
          titulo: `${tipo} vencido${prestadorNome ? ` — ${prestadorNome}` : ""}`,
          descricao: `Documento vencido há ${Math.abs(dias)} dia(s). Regularize antes de alocar.`,
          dias,
          ...base,
        });
      } else if (dias !== null && dias <= DIAS_ALERTA_DOCUMENTO) {
        alertas.push({
          id: `doc-vencendo-${String(row.id)}`,
          tipo: "documento_vencendo",
          severidade: "warning",
          titulo: `${tipo} vencendo em ${dias} dia(s)${prestadorNome ? ` — ${prestadorNome}` : ""}`,
          descricao: "Renove o documento para manter o prestador elegível.",
          dias,
          ...base,
        });
      }

      if (status && !["aprovado", "valido", "ok", "concluido", "vigente", "ativo"].includes(status)) {
        alertas.push({
          id: `doc-pendente-${String(row.id)}`,
          tipo: "documento_pendente",
          severidade: "warning",
          titulo: `${tipo} ${status}${prestadorNome ? ` — ${prestadorNome}` : ""}`,
          descricao: "Documentação obrigatória pendente/irregular para alocação.",
          ...base,
        });
      }
    }
  } catch (error) {
    console.warn("[TalentAIAlerts] Falha ao varrer documentos:", error);
  }

  // 2) Inatividade do funil de recrutamento
  try {
    const { data } = await supabase
      .from("recrutamento_candidatos")
      .select("id, nome, stage, updated_at, data_atualizacao")
      .limit(300);

    for (const row of (data as Array<Record<string, unknown>>) || []) {
      const stage = String(row.stage || "");
      if (STAGES_ENCERRADOS.has(stage)) continue;

      const referencia = String(row.updated_at || row.data_atualizacao || "");
      const dias = diasAte(referencia);
      if (dias === null || dias > -DIAS_INATIVIDADE_FUNIL) continue;

      const parado = Math.abs(dias);
      alertas.push({
        id: `funil-inativo-${String(row.id)}`,
        tipo: "funil_inativo",
        severidade: parado >= 30 ? "critical" : "warning",
        titulo: `Candidato parado há ${parado} dia(s)`,
        descricao: `${String(row.nome || "Candidato")} está na etapa "${stage}" sem movimentação.`,
        candidatoId: String(row.id),
        dias: -parado,
      });
    }
  } catch (error) {
    console.warn("[TalentAIAlerts] Falha ao varrer funil:", error);
  }

  const peso: Record<TalentAlertSeveridade, number> = { critical: 0, warning: 1, info: 2 };
  return alertas.sort((a, b) => peso[a.severidade] - peso[b.severidade]);
}

export function useTalentAIAlerts() {
  const [alertas, setAlertas] = useState<TalentAIAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAlertas(await varrerAlertasTalent());
    } catch (erro) {
      setError(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { alertas, loading, error, recarregar };
}
