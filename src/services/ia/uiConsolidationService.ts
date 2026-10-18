import { centralIaService, type AutomacaoRobo } from "@/services/centralIaService";

export interface InconsistenciaUi {
  tipo: "duplicacao" | "conflito_status" | "dados_divergentes";
  gravidade: "baixa" | "media" | "alta";
  descricao: string;
  entidade_id: string;
  entidade_nome: string;
  detalhes?: Record<string, unknown>;
}

export interface RelatorioAuditoria {
  timestamp: string;
  total_robos_bruto: number;
  total_robos_unicos: number;
  duplicatas_removidas: number;
  inconsistencias: InconsistenciaUi[];
  fontes: string[];
}

let inconsistenciasCache: InconsistenciaUi[] = [];

export function normalizeRobosState(robos: AutomacaoRobo[]): AutomacaoRobo[] {
  const seen = new Map<string, AutomacaoRobo>();
  const detected: InconsistenciaUi[] = [];

  for (const robo of robos) {
    if (seen.has(robo.id)) {
      const existing = seen.get(robo.id)!;
      detected.push({
        tipo: "duplicacao",
        gravidade: "media",
        descricao: `Robô "${robo.nome}" (${robo.id}) duplicado no resultado da consulta`,
        entidade_id: robo.id,
        entidade_nome: robo.nome,
        detalhes: {
          ocorrencias: [existing.nome, robo.nome],
          status_existente: existing.status,
          status_atual: robo.status,
        },
      });
      if (resolverConflitoStatus(existing.status, robo.status) !== existing.status) {
        detected.push({
          tipo: "conflito_status",
          gravidade: "alta",
          descricao: `Status divergente para "${robo.nome}": ${existing.status} vs ${robo.status}`,
          entidade_id: robo.id,
          entidade_nome: robo.nome,
          detalhes: { status_a: existing.status, status_b: robo.status, resolvido_para: resolverConflitoStatus(existing.status, robo.status) },
        });
      }
      continue;
    }
    seen.set(robo.id, robo);
  }

  if (detected.length > 0) {
    inconsistenciasCache = detected;
    logarInconsistencias(detected);
  }

  return [...seen.values()];
}

function resolverConflitoStatus(a: string, b: string): string {
  const prioridade: Record<string, number> = {
    erro: 5,
    ativo: 4,
    pausado: 3,
    inativo: 2,
    pendente: 1,
  };
  return (prioridade[a] || 0) >= (prioridade[b] || 0) ? a : b;
}

function logarInconsistencias(inconsistencias: InconsistenciaUi[]): void {
  for (const inc of inconsistencias) {
    centralIaService.registrarLog({
      acao: `ui_consolidacao:${inc.tipo}`,
      status: "aviso",
      entrada: { tipo: inc.tipo, entidade_id: inc.entidade_id, entidade_nome: inc.entidade_nome },
      saida: { descricao: inc.descricao },
    });
  }
}

export async function auditarSistema(): Promise<RelatorioAuditoria> {
  const robos = await centralIaService.listarRobos();
  const unicos = normalizeRobosState(robos);
  const fontes = ["F34A", "F35", "F37", "F38", "F33"];

  const conflitos = inconsistenciasCache.filter((i) => i.tipo === "conflito_status");
  const divergencias: InconsistenciaUi[] = [];

  for (const robo of unicos) {
    const conflitosStatus = conflitos.filter((c) => c.entidade_id === robo.id);
    if (conflitosStatus.length > 0) {
      divergencias.push({
        tipo: "dados_divergentes",
        gravidade: "media",
        descricao: `Dados divergentes detectados para "${robo.nome}" entre fontes do sistema`,
        entidade_id: robo.id,
        entidade_nome: robo.nome,
        detalhes: { fontes, status_atual: robo.status, total_conflitos: conflitosStatus.length },
      });
    }
  }

  const todas = [...inconsistenciasCache, ...divergencias];

  return {
    timestamp: new Date().toISOString(),
    total_robos_bruto: robos.length,
    total_robos_unicos: unicos.length,
    duplicatas_removidas: robos.length - unicos.length,
    inconsistencias: todas,
    fontes,
  };
}

export function obterInconsistencias(): InconsistenciaUi[] {
  return inconsistenciasCache;
}

export function limparCacheInconsistencias(): void {
  inconsistenciasCache = [];
}
