import { supabase } from "@/lib/supabase";
import { proxyIaClient } from "@/services/ia/proxyIaClient";

export interface AIReportResult {
  sucesso: boolean;
  periodo: string;
  kpis: AIReportKPIs;
  resumoExecutivo: string;
  destaquesPositivos: string[];
  atencaoNecessaria: string[];
  sugestoes: string[];
  alertas: string[];
  geradoPorIA: boolean;
  provider?: string;
  model?: string;
  geradoEm: string;
}

export interface AIReportKPIs {
  slaGeral: number;
  slaMeta: number;
  totalEntregas: number;
  entregasConcluidas: number;
  entregasAtrasadas: number;
  faturamentoPeriodo: number;
  ocorrenciasAbertas: number;
  contratosAtivos: number;
  scoreSaude: number;
  statusSaude: string;
  regioes: { nome: string; sla: number; entregas: number }[];
}

function getPeriodoFiltro(periodo: string): { inicio: string; fim: string } {
  const agora = new Date();
  const fim = agora.toISOString();
  let inicio: Date;
  switch (periodo) {
    case "7dias": inicio = new Date(agora.getTime() - 7 * 86400000); break;
    case "30dias": inicio = new Date(agora.getTime() - 30 * 86400000); break;
    case "90dias": inicio = new Date(agora.getTime() - 90 * 86400000); break;
    case "mes_atual": inicio = new Date(agora.getFullYear(), agora.getMonth(), 1); break;
    default: inicio = new Date(agora.getTime() - 30 * 86400000);
  }
  return { inicio: inicio.toISOString(), fim };
}

function formatPeriodoBR(periodo: string): string {
  const labels: Record<string, string> = {
    "7dias": "Últimos 7 dias",
    "30dias": "Últimos 30 dias",
    "90dias": "Últimos 90 dias",
    "mes_atual": "Mês atual",
  };
  return labels[periodo] || "Últimos 30 dias";
}

const PROMPT_TEMPLATE = `Você é um analista executivo de logística especializado em gerar relatórios para clientes.
Com base nos dados reais abaixo, gere um relatório executivo conciso em português.

MÉTRICAS DO PERÍODO ({periodo}):
- SLA Geral: {slaGeral}% (meta: {slaMeta}%)
- Total de Operações: {totalEntregas}
- Concluídas: {entregasConcluidas}
- Atrasadas: {entregasAtrasadas}
- Faturamento no período: R$ {faturamento}
- Ocorrências abertas: {ocorrenciasAbertas}
- Contratos ativos: {contratosAtivos}
- Score de Saúde Operacional: {scoreSaude}/100 — {statusSaude}

REGIÕES DE ATUAÇÃO:
{regioes}

Responda APENAS com um JSON válido neste formato (sem markdown, sem quebras extras):
{"resumo_executivo":"texto curto (3-5 frases)","destaques_positivos":["item curto","item curto"],"atencao_necessaria":["item curto","item curto"],"sugestoes":["sugestão prática 1","sugestão prática 2","sugestão prática 3","sugestão prática 4"]}`;

function buildFallbackReport(kpis: AIReportKPIs, periodo: string): AIReportResult {
  const resumo = `No período de ${periodo.toLowerCase()}, sua operação registrou SLA de ${kpis.slaGeral}% (meta: ${kpis.slaMeta}%) com ${kpis.entregasConcluidas} entregas concluídas de ${kpis.totalEntregas} operações totais. ${kpis.entregasAtrasadas > 0 ? `Houve ${kpis.entregasAtrasadas} operações em atraso que merecem atenção.` : "Não foram registrados atrasos no período."} ${kpis.ocorrenciasAbertas > 0 ? `${kpis.ocorrenciasAbertas} ocorrência(s) estão em aberto.` : "Nenhuma ocorrência em aberto."}`;

  const destaques = [`SLA de ${kpis.slaGeral}% — ${kpis.slaGeral >= kpis.slaMeta ? "acima da meta contratual" : "abaixo da meta"}`];
  if (kpis.contratosAtivos > 0) destaques.push(`${kpis.contratosAtivos} contrato(s) ativo(s)`);

  const atencao: string[] = [];
  if (kpis.entregasAtrasadas > 0) atencao.push(`${kpis.entregasAtrasadas} operações em atraso`);
  if (kpis.ocorrenciasAbertas > 0) atencao.push(`${kpis.ocorrenciasAbertas} ocorrência(s) em aberto`);
  if (kpis.slaGeral < kpis.slaMeta) atencao.push(`SLA abaixo da meta (${kpis.slaGeral}% vs ${kpis.slaMeta}%)`);

  const sugestoes = [
    "Acompanhar operações em atraso para normalização",
    "Revisar processos nas regiões com SLA abaixo da média",
    "Manter contratos ativos e avaliar renovação antecipada",
    "Utilizar o painel de insights para monitoramento diário",
  ];

  return {
    sucesso: true,
    periodo,
    kpis,
    resumoExecutivo: resumo,
    destaquesPositivos: destaques,
    atencaoNecessaria: atencao,
    sugestoes,
    alertas: atencao,
    geradoPorIA: false,
    geradoEm: new Date().toISOString(),
  };
}

export async function gerarRelatorioIA(
  clienteId: string,
  periodo: string = "30dias"
): Promise<AIReportResult> {
  try {
    const { inicio, fim } = getPeriodoFiltro(periodo);
    const periodoLabel = formatPeriodoBR(periodo);

    const [osResponse, finResponse, ocorrResponse, contratoResponse, alocResponse, insightsResponse] = await Promise.all([
      supabase
        .from("ordens_servico")
        .select("id, status, valor_cliente, created_at, origem, destino, cidade_destino, cliente_id")
        .eq("cliente_id", clienteId)
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("financeiro_receber")
        .select("valor, status, data_vencimento")
        .eq("cliente_id", clienteId)
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim)
        .limit(300),
      supabase
        .from("portal_ocorrencias")
        .select("id, status")
        .eq("cliente_id", clienteId)
        .eq("status", "aberta")
        .limit(100),
      supabase
        .from("contratos_operacao")
        .select("id, numero")
        .eq("cliente_id", clienteId)
        .eq("ativo", true)
        .limit(50),
      supabase
        .from("alocacoes_escala")
        .select("id, km_realizados, valor_repasse, origem, destino, status, created_at")
        .eq("cliente_id", clienteId)
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .limit(500),
    ]);

    const ordens = osResponse.data || [];
    const financeiro = finResponse.data || [];
    const ocorrencias = ocorrResponse.data || [];
    const contratos = contratoResponse.data || [];
    const alocacoes = alocResponse.data || [];

    if (ordens.length === 0 && financeiro.length === 0 && ocorrencias.length === 0) {
      return {
        sucesso: true,
        periodo: periodoLabel,
        kpis: {
          slaGeral: 0, slaMeta: 95, totalEntregas: 0, entregasConcluidas: 0, entregasAtrasadas: 0,
          faturamentoPeriodo: 0, ocorrenciasAbertas: 0, contratosAtivos: contratos.length,
          scoreSaude: 0, statusSaude: "sem_dados", regioes: [],
        },
        resumoExecutivo: `Nenhuma operação encontrada no período ${periodoLabel.toLowerCase()}. Os dados serão exibidos conforme novas entregas forem registradas.`,
        destaquesPositivos: [],
        atencaoNecessaria: [],
        sugestoes: [],
        alertas: ["Sem dados operacionais no período"],
        geradoPorIA: false,
        geradoEm: new Date().toISOString(),
      };
    }

    const totalEntregas = ordens.length;
    const entregasConcluidas = ordens.filter(
      (o: any) => o.status === "entregue" || o.status === "finalizada" || o.status === "concluida"
    ).length;
    const entregasAtrasadas = ordens.filter((o: any) => o.status === "atrasada").length;
    const slaGeral = totalEntregas > 0
      ? Math.round(((totalEntregas - entregasAtrasadas) / totalEntregas) * 100 * 10) / 10
      : 0;
    const slaMeta = 95;
    const faturamentoPeriodo = financeiro
      .reduce((acc: number, f: any) => acc + (Number(f.valor) || 0), 0);
    const ocorrenciasAbertas = ocorrencias.length;
    const contratosAtivos = contratos.length;

    const regiaoMap: Record<string, { entregas: number; concluidas: number }> = {};
    for (const os of ordens) {
      const regiao = (os as any).cidade_destino || (os as any).destino || "Sem região";
      if (!regiaoMap[regiao]) regiaoMap[regiao] = { entregas: 0, concluidas: 0 };
      regiaoMap[regiao].entregas++;
      if ((os as any).status === "entregue" || (os as any).status === "finalizada" || (os as any).status === "concluida") {
        regiaoMap[regiao].concluidas++;
      }
    }
    const regioes = Object.entries(regiaoMap).map(([nome, d]) => ({
      nome,
      sla: d.entregas > 0 ? Math.round((d.concluidas / d.entregas) * 100) : 0,
      entregas: d.entregas,
    })).sort((a, b) => b.entregas - a.entregas);

    const scoreSaude = totalEntregas > 0
      ? Math.min(100, Math.round(
          (slaGeral / 100) * 40 +
          (entregasConcluidas / totalEntregas) * 25 +
          (ocorrenciasAbertas === 0 ? 15 : Math.max(0, 15 - ocorrenciasAbertas)) +
          (entregasAtrasadas === 0 ? 20 : Math.max(0, 20 - entregasAtrasadas * 2))
        ))
      : 0;
    const statusSaude = scoreSaude >= 85 ? "saudavel" : scoreSaude >= 60 ? "atencao" : "critico";

    const kpis: AIReportKPIs = {
      slaGeral, slaMeta, totalEntregas, entregasConcluidas, entregasAtrasadas,
      faturamentoPeriodo: Math.round(faturamentoPeriodo),
      ocorrenciasAbertas, contratosAtivos, scoreSaude, statusSaude, regioes,
    };

    const regioesStr = regioes.map((r) => `- ${r.nome}: ${r.sla}% SLA (${r.entregas} entregas)`).join("\n");

    try {
      const prompt = PROMPT_TEMPLATE
        .replace(/{periodo}/g, periodoLabel)
        .replace(/{slaGeral}/g, String(slaGeral))
        .replace(/{slaMeta}/g, String(slaMeta))
        .replace(/{totalEntregas}/g, String(totalEntregas))
        .replace(/{entregasConcluidas}/g, String(entregasConcluidas))
        .replace(/{entregasAtrasadas}/g, String(entregasAtrasadas))
        .replace(/{faturamento}/g, String(Math.round(faturamentoPeriodo)))
        .replace(/{ocorrenciasAbertas}/g, String(ocorrenciasAbertas))
        .replace(/{contratosAtivos}/g, String(contratosAtivos))
        .replace(/{scoreSaude}/g, String(scoreSaude))
        .replace(/{statusSaude}/g, statusSaude)
        .replace(/{regioes}/g, regioesStr);

      const iaResult = await proxyIaClient.executar({
        provider: "groq",
        model: "llama-3.1-8b-instant",
        prompt,
        temperature: 0.3,
        max_tokens: 1024,
        tipo_tarefa: "relatorio_ai_portal",
      });

      if (iaResult.sucesso) {
        const parsed = JSON.parse(iaResult.resposta.replace(/```json\s*/gi, "").replace(/\s*```/g, "").trim());
        const resumoExecutivo = parsed.resumo_executivo || parsed.resumo || "";
        const destaquesPositivos: string[] = parsed.destaques_positivos || parsed.destaques || [];
        const atencaoNecessaria: string[] = parsed.atencao_necessaria || parsed.atencao || parsed.pontos_atencao || [];
        const sugestoes: string[] = parsed.sugestoes || [];

        const alertas: string[] = [];
        if (entregasAtrasadas > 0) alertas.push(`${entregasAtrasadas} operações em atraso`);
        if (slaGeral < slaMeta) alertas.push(`SLA abaixo da meta (${slaGeral}% vs ${slaMeta}%)`);
        if (ocorrenciasAbertas > 0) alertas.push(`${ocorrenciasAbertas} ocorrência(s) em aberto`);
        if (scoreSaude < 60) alertas.push("Score de saúde crítico — ação urgente necessária");

        return {
          sucesso: true,
          periodo: periodoLabel,
          kpis,
          resumoExecutivo,
          destaquesPositivos,
          atencaoNecessaria,
          sugestoes,
          alertas,
          geradoPorIA: true,
          provider: iaResult.provider,
          model: iaResult.model,
          geradoEm: new Date().toISOString(),
        };
      }
    } catch {
      // IA indisponível → fallback
    }

    return buildFallbackReport(kpis, periodoLabel);
  } catch (error) {
    console.warn("[aiReportService] Exceção ao gerar relatório:", error);
    return {
      sucesso: false,
      periodo: formatPeriodoBR("30dias"),
      kpis: { slaGeral: 0, slaMeta: 95, totalEntregas: 0, entregasConcluidas: 0, entregasAtrasadas: 0, faturamentoPeriodo: 0, ocorrenciasAbertas: 0, contratosAtivos: 0, scoreSaude: 0, statusSaude: "erro", regioes: [] },
      resumoExecutivo: "Não foi possível gerar o relatório no momento. Tente novamente mais tarde.",
      destaquesPositivos: [],
      atencaoNecessaria: [],
      sugestoes: [],
      alertas: ["Erro ao gerar relatório"],
      geradoPorIA: false,
      geradoEm: new Date().toISOString(),
    };
  }
}
