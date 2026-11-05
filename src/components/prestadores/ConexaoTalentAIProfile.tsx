/**
 * ConexaoTalentAIProfile — Painel de Resumo Operacional Automático (Etapa 7).
 *
 * Exibe o perfil operacional gerado pelo Motor de Verificação a partir de
 * preferências operacionais, respostas situacionais e dados reais de performance.
 * Design system: roxo/laranja da marca.
 */
import { useMemo } from "react";
import {
  ShieldCheck, Activity, Truck, MapPin, Layers, Navigation, Plane, Clock, Radio,
  Award, Package, GraduationCap, ShieldAlert, AlertTriangle, Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gerarResumoOperacionalAutomatico, type ResumoOperacionalAutomatico, type InsightOperacional } from "@/lib/conexaoTalentAIProfile";
import { calcularCategoriaPerformance, PERFORMANCE_CORES } from "@/lib/performancePrestador";
import type { JanelaDisponibilidadeResumo } from "@/lib/talentResumo";

const ICON_MAP: Record<string, LucideIcon> = {
  truck: Truck,
  "map-pin": MapPin,
  layers: Layers,
  navigation: Navigation,
  plane: Plane,
  clock: Clock,
  radio: Radio,
  award: Award,
  package: Package,
  "graduation-cap": GraduationCap,
};

const TOM_COR: Record<InsightOperacional["tom"], string> = {
  positivo: "border-emerald-200 bg-emerald-50 text-emerald-800",
  neutro: "border-slate-200 bg-slate-50 text-slate-700",
  atencao: "border-amber-200 bg-amber-50 text-amber-800",
  critico: "border-red-200 bg-red-50 text-red-800",
};

const NIVEL_COR: Record<string, string> = {
  forte: "bg-emerald-100 text-emerald-800 border-emerald-200",
  adequado: "bg-blue-100 text-blue-700 border-blue-200",
  desenvolver: "bg-amber-100 text-amber-800 border-amber-200",
  nao_avaliado: "bg-slate-100 text-slate-500 border-slate-200",
};

const NIVEL_LABEL: Record<string, string> = {
  forte: "Forte",
  adequado: "Adequado",
  desenvolver: "Desenvolver",
  nao_avaliado: "Não avaliado",
};

export interface ConexaoTalentAIProfileProps {
  veiculo?: string | null;
  regiao?: string | null;
  modalidades?: string[] | null;
  distanciaMaxColetaKm?: string | number | null;
  aceitaViagens?: boolean | null;
  restricoesOperacionais?: string | null;
  statusDisponibilidade?: string | null;
  disponibilidade?: JanelaDisponibilidadeResumo[] | null;
  avaliacoes?: { competencia?: string | null; pontuacao?: number | null; cenarioTitulo?: string | null }[] | null;
  treinamentos?: { curso?: string | null; dataConclusao?: string | null; validade?: string | null }[] | null;
  performance?: { totalEntregas?: number | null; pontualidade?: number | null; ocorrencias?: number | null; isCandidato?: boolean | null } | null;
  loading?: boolean;
}

export function ConexaoTalentAIProfile(props: ConexaoTalentAIProfileProps) {
  const resumo: ResumoOperacionalAutomatico = useMemo(
    () =>
      gerarResumoOperacionalAutomatico({
        perfil: {
          veiculo: props.veiculo,
          regiao: props.regiao,
          modalidades: props.modalidades,
          distanciaMaxColetaKm: props.distanciaMaxColetaKm,
          aceitaViagens: props.aceitaViagens,
          restricoesOperacionais: props.restricoesOperacionais,
          statusDisponibilidade: props.statusDisponibilidade,
        },
        disponibilidade: props.disponibilidade,
        avaliacoes: props.avaliacoes,
        treinamentos: props.treinamentos,
        performance: props.performance,
      }),
    [
      props.veiculo, props.regiao, props.modalidades, props.distanciaMaxColetaKm,
      props.aceitaViagens, props.restricoesOperacionais, props.statusDisponibilidade,
      props.disponibilidade, props.avaliacoes, props.treinamentos, props.performance,
    ],
  );

  const perfBadge = calcularCategoriaPerformance(props.performance || {});

  if (props.loading) {
    return (
      <Card className="border-[#2E1065]/20 bg-gradient-to-br from-[#2E1065]/5 via-background to-orange-500/5">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2E1065]/10 text-[#2E1065]">
            <ShieldCheck className="h-5 w-5 animate-pulse" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#2E1065]">
              Motor de Verificação · Perfil Operacional
            </p>
            <p className="text-sm text-muted-foreground">Sincronizando dados operacionais...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#2E1065]/20 bg-gradient-to-br from-[#2E1065]/5 via-background to-orange-500/5 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm text-[#2E1065]">
            <Activity className="h-4 w-4 text-orange-500" />
            Motor de Verificação · Resumo Operacional Automático
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PERFORMANCE_CORES[perfBadge.categoria]}`}>
              {perfBadge.categoria}{perfBadge.score !== null ? ` · ${perfBadge.score}` : ""}
            </span>
            <Badge variant="outline" className="border-orange-300 bg-orange-50 text-[10px] font-bold text-orange-700">
              Perfil 360º
            </Badge>
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground">{resumo.resumoLinha}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Insights operacionais */}
        {resumo.insights.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Indicadores</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {resumo.insights.map((insight) => {
                const Icon = ICON_MAP[insight.icone] || Activity;
                return (
                  <div key={`${insight.label}-${insight.valor}`} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${TOM_COR[insight.tom]}`}>
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold opacity-70">{insight.label}</p>
                      <p className="truncate text-xs font-bold">{insight.valor}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Competências avaliadas */}
        {resumo.competencias.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Competências Situacionais</p>
            <div className="flex flex-wrap gap-2">
              {resumo.competencias.map((comp, i) => (
                <span key={`${comp.nome}-${i}`} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${NIVEL_COR[comp.nivel]}`}>
                  {comp.nome}
                  {comp.pontuacao !== null && <span className="opacity-60">({comp.pontuacao})</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Restrições operacionais */}
        {resumo.restricoes.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              <ShieldAlert className="h-3 w-3" /> Restrições Operacionais
            </p>
            <div className="flex flex-wrap gap-1.5">
              {resumo.restricoes.map((r, i) => (
                <span key={i} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Alertas */}
        {resumo.alertas.length > 0 && (
          <div className="space-y-1.5">
            {resumo.alertas.map((alerta, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{alerta}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recomendação */}
        <div className="flex items-start gap-2 rounded-lg border border-[#2E1065]/20 bg-[#2E1065]/5 px-3 py-2.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#2E1065]">Recomendação Operacional</p>
            <p className="mt-0.5 text-xs font-medium text-foreground">{resumo.recomendacao}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
