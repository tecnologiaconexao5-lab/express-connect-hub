/**
 * Central de Alertas — TMS-030 Fase 1
 *
 * Consolida em um único painel as ações prioritárias geradas por
 * `gerarAcoesPrioritarias()` com resumo de risco executivo.
 * Cada alerta é clicável e abre o painel operacional da OS.
 */

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionItem } from "@/lib/acoesPrioritarias";

export interface ResumoAlertas {
  atrasadas: number;
  emRisco: number;
  ocorrencias: number;
  pendencias: number;
  criticas: number;
}

interface CentralAlertasProps {
  itens: ActionItem[];
  resumo: ResumoAlertas;
  selectedOsId: string | null;
  onSelect: (osId: string) => void;
}

const PRIORIDADE_CONFIG: Record<ActionItem["prioridade"], { badge: string; label: string; border: string; bg: string }> = {
  critica: { badge: "bg-red-600 text-white", label: "Crítica", border: "border-red-300 dark:border-red-700", bg: "bg-red-50/60 dark:bg-red-950/20" },
  alta: { badge: "bg-orange-500 text-white", label: "Alta", border: "border-orange-300 dark:border-orange-700", bg: "bg-orange-50/60 dark:bg-orange-950/20" },
  media: { badge: "bg-yellow-500 text-white", label: "Média", border: "border-yellow-300 dark:border-yellow-700", bg: "bg-yellow-50/60 dark:bg-yellow-950/20" },
  baixa: { badge: "bg-slate-400 text-white", label: "Baixa", border: "border-slate-300 dark:border-slate-600", bg: "bg-slate-50/60 dark:bg-slate-950/20" },
};

export function CentralAlertas({ itens, resumo, selectedOsId, onSelect }: CentralAlertasProps) {
  const exibidos = itens.slice(0, 6);

  return (
    <Card className="border-red-200 dark:border-red-800/60 shadow-sm">
      <CardHeader className="py-3 px-4 border-b bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-red-100 dark:bg-red-900/40 p-1.5 rounded-lg shrink-0">
              <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-bold truncate">Central de Alertas</CardTitle>
              <CardDescription className="text-[10px] truncate">
                {itens.length} item(ns) priorizados por criticidade
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono shrink-0 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700">
            AO VIVO
          </Badge>
        </div>

        {itens.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2">
            {resumo.criticas > 0 && (
              <Badge className="bg-red-600 text-white text-[9px]">Críticas: {resumo.criticas}</Badge>
            )}
            {resumo.atrasadas > 0 && (
              <Badge className="bg-rose-500 text-white text-[9px]">Atrasadas: {resumo.atrasadas}</Badge>
            )}
            {resumo.emRisco > 0 && (
              <Badge className="bg-orange-500 text-white text-[9px]">Em risco: {resumo.emRisco}</Badge>
            )}
            {resumo.ocorrencias > 0 && (
              <Badge className="bg-amber-500 text-white text-[9px]">Ocorrências: {resumo.ocorrencias}</Badge>
            )}
            {resumo.pendencias > 0 && (
              <Badge className="bg-purple-500 text-white text-[9px]">PODs Pendentes: {resumo.pendencias}</Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3">
        {exibidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertTriangle className="w-8 h-8 text-emerald-400 mb-2 opacity-60" />
            <p className="text-sm font-medium text-muted-foreground">Operação normalizada</p>
            <p className="text-[10px] text-muted-foreground/70">Nenhuma ação prioritária no momento.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {exibidos.map((item) => {
              const config = PRIORIDADE_CONFIG[item.prioridade];
              const clicavel = !!item.osId;
              return (
                <button
                  key={item.id}
                  disabled={!clicavel}
                  onClick={() => item.osId && onSelect(item.osId)}
                  className={`w-full flex items-center gap-2.5 rounded-lg border text-left transition-all p-2 ${
                    clicavel ? "hover:ring-2 hover:ring-indigo-400 cursor-pointer" : "opacity-70 cursor-default"
                  } ${config.border} ${config.bg} ${
                    selectedOsId === item.osId ? "ring-2 ring-indigo-500 shadow-md" : ""
                  }`}
                >
                  <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${config.badge}`}>
                    {config.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate">{item.motivo}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {item.os !== "—" && <>OS {item.os} · </>}
                      {item.cliente !== "—" && <>{item.cliente} · </>}
                      {item.prestador}
                    </p>
                  </div>
                  {item.acaoSugerida && (
                    <span className="shrink-0 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-700">
                      {item.acaoSugerida}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
