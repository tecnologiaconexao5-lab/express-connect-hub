import { useState, useEffect, useMemo } from "react";
import { Download, FileText, ChevronDown, ChevronRight, RefreshCw, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { carregarLogoBase64Utils } from "@/utils/pdfGenerator";
import {
  calcularDRE,
  periodoParaDatas,
  type PeriodoDre,
  type DreReceita,
  type DreCustoPrestador,
  type DreDespesa,
  type DreTotais,
} from "@/services/financeiro/dreService";

// ============================================================================
// F0-G — DRE Gerencial com fontes reais (competência econômica).
//   Receita  → financeiro_receber (fonte oficial — fatura/OS não contam de novo)
//   Custos   → pagamentos_prestadores (impacto_dre = true, valor_liquido)
//   Despesas → financeiro_pagar (exclui repasses de prestador e impostos)
// Baixas/estornos NÃO entram como competência. Sem estimativas inventadas.
// ============================================================================

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => v.toFixed(1) + "%";
const varPct = (atual: number, anterior: number) => {
  if (anterior === 0) return "—";
  const pct = ((atual - anterior) / Math.abs(anterior) * 100);
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
};

interface DRELine {
  id: string;
  label: string;
  valorAtual: number;
  valorAnterior: number;
  tipo: "receita" | "deducao" | "custo" | "despesa" | "resultado" | "titulo" | "subtitulo";
  children?: DRELine[];
}

const periodos: { value: PeriodoDre; label: string }[] = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "anual", label: "Anual" },
  { value: "personalizado", label: "Personalizado" },
];

export default function DREGerencial() {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [loading, setLoading] = useState(true);
  const [competencia, setCompetencia] = useState(mesAtual);
  const [periodo, setPeriodo] = useState<PeriodoDre>("mensal");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["1", "2", "4", "6"]));

  const [dadosDRE, setDadosDRE] = useState<DRELine[]>([]);
  const [resumo, setResumo] = useState<DreTotais | null>(null);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);

  // Meses com competência real disponível (fonte: financeiro_receber / financeiro_pagar / pagamentos_prestadores)
  useEffect(() => {
    const carregarMeses = async () => {
      try {
        const [rec, pag, pgt] = await Promise.all([
          supabase.from("financeiro_receber").select("data_vencimento").eq("is_teste", false),
          supabase.from("financeiro_pagar").select("data_vencimento, competencia").eq("is_teste", false),
          supabase.from("pagamentos_prestadores").select("competencia, data_competencia"),
        ]);
        const s = new Set<string>();
        (rec.data || []).forEach((r: any) => { const d = r.data_vencimento; if (d) s.add(String(d).substring(0, 7)); });
        (pag.data || []).forEach((p: any) => { const d = p.competencia || p.data_vencimento; if (d) s.add(String(d).substring(0, 7)); });
        (pgt.data || []).forEach((p: any) => { const d = p.competencia || p.data_competencia; if (d) s.add(String(d).substring(0, 7)); });
        setMesesDisponiveis(Array.from(s).sort().reverse().slice(0, 24));
      } catch { /* lista de meses é auxiliar */ }
    };
    carregarMeses();
  }, []);

  useEffect(() => {
    fetchDadosDRE();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia, periodo, dataInicio, dataFim]);

  async function fetchDadosDRE() {
    setLoading(true);
    try {
      const janela = periodoParaDatas(periodo, competencia, dataInicio || undefined, dataFim || undefined);

      const [recAtual, recAnt, pagAtual, pagAnt, pgtAtual, pgtAnt] = await Promise.all([
        supabase.from("financeiro_receber")
          .select("valor, categoria, plano_conta, data_vencimento, data_emissao, status")
          .eq("is_teste", false)
          .gte("data_vencimento", janela.inicio).lte("data_vencimento", janela.fim),
        supabase.from("financeiro_receber")
          .select("valor, categoria, plano_conta, data_vencimento, data_emissao, status")
          .eq("is_teste", false)
          .gte("data_vencimento", janela.inicioAnterior).lte("data_vencimento", janela.fimAnterior),
        supabase.from("financeiro_pagar")
          .select("valor, categoria, plano_contas, data_vencimento, competencia, os_id, descricao, status")
          .eq("is_teste", false)
          .is("os_id", null) // exclui repasses de prestador (já em pagamentos_prestadores)
          .gte("data_vencimento", janela.inicio).lte("data_vencimento", janela.fim),
        supabase.from("financeiro_pagar")
          .select("valor, categoria, plano_contas, data_vencimento, competencia, os_id, descricao, status")
          .eq("is_teste", false)
          .is("os_id", null)
          .gte("data_vencimento", janela.inicioAnterior).lte("data_vencimento", janela.fimAnterior),
        supabase.from("pagamentos_prestadores")
          .select("valor_liquido, impacto_dre, competencia, data_competencia, categoria_financeira, conta_contabil")
          .eq("classificacao_dado", "real")
          .gte("competencia", janela.inicio).lte("competencia", janela.fim),
        supabase.from("pagamentos_prestadores")
          .select("valor_liquido, impacto_dre, competencia, data_competencia, categoria_financeira, conta_contabil")
          .eq("classificacao_dado", "real")
          .gte("competencia", janela.inicioAnterior).lte("competencia", janela.fimAnterior),
      ]);

      const receitas = (rows: any[] | null): DreReceita[] =>
        (rows || [])
          .filter((r: any) => r.status !== "cancelado")
          .map((r: any) => ({ valor: Number(r.valor) || 0, categoria: r.categoria || r.plano_conta || null }));

      const despesas = (rows: any[] | null): DreDespesa[] =>
        (rows || [])
          .filter((r: any) => r.status !== "cancelado" && !String(r.descricao || "").toLowerCase().startsWith("repasse"))
          .map((r: any) => ({ valor: Number(r.valor) || 0, categoria: r.categoria || null, plano_conta: r.plano_contas || null }));

      const custos = (rows: any[] | null): DreCustoPrestador[] =>
        (rows || []).map((r: any) => ({ valor_liquido: Number(r.valor_liquido) || 0, impacto_dre: !!r.impacto_dre }));

      const atual = calcularDRE(receitas(recAtual.data), custos(pgtAtual.data), despesas(pagAtual.data));
      const anterior = calcularDRE(receitas(recAnt.data), custos(pgtAnt.data), despesas(pagAnt.data));

      setResumo(atual);

      const L = (id: string, label: string, tipo: DRELine["tipo"], get: (t: DreTotais) => number, children?: DRELine[]): DRELine => ({
        id, label,
        valorAtual: get(atual),
        valorAnterior: get(anterior),
        tipo,
        children,
      });

      const dreData: DRELine[] = [
        L("1", "RECEITA BRUTA DE SERVIÇOS", "receita", (t) => t.receitaBruta, [
          L("1.1", "Frete e Serviços", "receita", (t) => t.receitaBruta),
        ]),
        L("2", "(-) DEDUÇÕES (impostos/tributos)", "deducao", (t) => t.deducoes, [
          L("2.1", "Impostos e Tributos sobre Receita", "deducao", (t) => t.deducoes),
        ]),
        L("3", "= RECEITA LÍQUIDA", "resultado", (t) => t.receitaLiquida),
        L("4", "(-) CUSTOS DOS SERVIÇOS (prestadores)", "custo", (t) => t.custosPrestadores, [
          L("4.1", "Pagamentos a prestadores (impacto DRE)", "custo", (t) => t.custosPrestadores),
        ]),
        L("5", "= RESULTADO BRUTO", "resultado", (t) => t.receitaLiquida - t.custosPrestadores),
        L("6", "(-) DESPESAS OPERACIONAIS", "despesa", (t) => t.despesasOperacionais, [
          L("6.1", "Administrativas", "despesa", (t) => t.despesasAdministrativas),
          L("6.2", "Comerciais", "despesa", (t) => t.despesasComerciais),
          L("6.3", "Outras despesas operacionais", "despesa", (t) => t.despesasOutras),
        ]),
        L("7", "= EBITDA", "resultado", (t) => t.ebitda),
        L("8", "(-) Depreciação e Amortização", "deducao", (t) => t.depreciacao),
        L("9", "= RESULTADO OPERACIONAL (EBIT)", "resultado", (t) => t.ebit),
        L("10", "(+/-) Resultado Financeiro", "deducao", (t) => t.resultadoFinanceiro),
        L("11", "= LUCRO ANTES DO IR", "resultado", (t) => t.lucroAntesIR),
        L("12", "(-) IR e CSLL (não estimado)", "deducao", (t) => t.ir),
        L("13", "= LUCRO LÍQUIDO", "resultado", (t) => t.lucroLiquido),
      ];

      setDadosDRE(dreData);
    } catch (error: any) {
      console.error("Erro ao buscar dados do DRE:", error);
      toast.error("Erro ao carregar dados do DRE");
      setDadosDRE([]);
      setResumo(null);
    } finally {
      setLoading(false);
    }
  }

  const getValor = (id: string) => dadosDRE.find(d => d.id === id)?.valorAtual || 0;
  const getMargem = (num: number, den: number) => den > 0 ? (num / den) * 100 : 0;

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) newExpanded.delete(id); else newExpanded.add(id);
    setExpanded(newExpanded);
  };

  const receitaBrutaAtual = getValor("1");
  const receitaLiquidaAtual = getValor("3");
  const ebitdaAtual = getValor("7");
  const lucroLiquidoAtual = getValor("13");
  const resultadoBruto = getValor("5");

  const DRELineRow = ({ line, level = 0 }: { line: DRELine, level?: number }) => {
    const hasChildren = line.children && line.children.length > 0;
    const isExpanded = expanded.has(line.id);

    const getRowStyle = () => {
      switch (line.tipo) {
        case "titulo": return "bg-muted/60 font-bold text-base";
        case "resultado": return "bg-primary/5 font-bold border-y border-border/40";
        case "receita": return level > 0 ? "text-muted-foreground" : "bg-muted/30 font-semibold";
        case "deducao": return "text-rose-500";
        case "custo": return "text-amber-600 dark:text-amber-400";
        case "despesa": return "text-muted-foreground";
        default: return "";
      }
    };

    const getValueColor = () => {
      if (["3","5","7","9","11","13"].includes(line.id) || line.tipo === "resultado") {
        return line.valorAtual >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600";
      }
      if (line.tipo === "deducao" || line.tipo === "custo" || line.tipo === "despesa") return "text-rose-500";
      return "text-foreground";
    };

    const variacao = line.valorAnterior !== 0 ? ((line.valorAtual - line.valorAnterior) / Math.abs(line.valorAnterior)) * 100 : 0;
    const pctReceita = receitaBrutaAtual > 0 ? (line.valorAtual / receitaBrutaAtual) * 100 : 0;

    return (
      <>
        <TableRow className={`${getRowStyle()} hover:bg-muted/40 transition-colors`}>
          <TableCell className="py-2">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
              {hasChildren && (
                <button onClick={() => toggleExpand(line.id)} className="p-0.5 hover:bg-muted rounded">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              )}
              <span className="text-xs font-mono text-muted-foreground w-6">{line.id}</span>
              <span className="text-sm">{line.label}</span>
            </div>
          </TableCell>
          <TableCell className={`text-right py-2 font-mono font-semibold ${getValueColor()}`}>
            {line.tipo !== "titulo" ? fmtFin(line.valorAtual) : ""}
          </TableCell>
          <TableCell className="text-right py-2 font-mono text-muted-foreground text-sm">
            {line.tipo !== "titulo" ? fmtFin(line.valorAnterior) : ""}
          </TableCell>
          <TableCell className={`text-right py-2 font-mono text-xs font-semibold ${variacao >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {line.tipo !== "titulo" ? varPct(line.valorAtual, line.valorAnterior) : ""}
          </TableCell>
          <TableCell className={`text-right py-2 font-mono text-xs ${variacao >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {line.tipo !== "titulo" ? fmtFin(line.valorAtual - line.valorAnterior) : ""}
          </TableCell>
          <TableCell className="text-right py-2 font-mono text-xs text-muted-foreground">
            {line.tipo !== "titulo" && receitaBrutaAtual > 0 ? `${pctReceita.toFixed(1)}%` : ""}
          </TableCell>
        </TableRow>
        {hasChildren && isExpanded && line.children!.map((child) => (
          <DRELineRow key={child.id} line={child} level={level + 1} />
        ))}
      </>
    );
  };

  const gerarPDF = async () => {
    const doc = new jsPDF();
    const logo = await carregarLogoBase64Utils();

    if (logo) {
      doc.addImage(logo, "PNG", 14, 8, 36, 12);
      doc.setFontSize(16);
      doc.setTextColor(15, 26, 46);
      doc.text("DEMONSTRAÇÃO DE RESULTADO", 105, 15, { align: "center" });
    } else {
      doc.setFontSize(18);
      doc.setTextColor(15, 26, 46);
      doc.text("DEMONSTRAÇÃO DE RESULTADO DO EXERCÍCIO", 105, 20, { align: "center" });
    }

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Competência: ${competencia} | Período: ${periodo === 'personalizado' ? `Personalizado ${dataInicio} a ${dataFim}` : periodo}`, 105, 28, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Data de emissão: ${new Date().toLocaleDateString("pt-BR")}`, 105, 34, { align: "center" });

    doc.setDrawColor(249, 115, 22);
    doc.setLineWidth(0.5);
    doc.line(20, 38, 190, 38);

    const tableData = dadosDRE.flatMap(line => {
      const baseRow = [
        line.label,
        fmtFin(line.valorAtual),
        fmtFin(line.valorAnterior),
        line.valorAnterior !== 0 ? `${((line.valorAtual - line.valorAnterior) / Math.abs(line.valorAnterior) * 100).toFixed(1)}%` : "—",
        fmtFin(line.valorAtual - line.valorAnterior)
      ];
      if (line.children) {
        return [baseRow, ...line.children.map(child => [
          `   ${child.label}`, fmtFin(child.valorAtual), fmtFin(child.valorAnterior),
          child.valorAnterior !== 0 ? `${((child.valorAtual - child.valorAnterior) / Math.abs(child.valorAnterior) * 100).toFixed(1)}%` : "—",
          fmtFin(child.valorAtual - child.valorAnterior)
        ])];
      }
      return [baseRow];
    });

    autoTable(doc, {
      startY: 45,
      head: [["Descrição", "Valor Atual", "Valor Anterior", "Variação %", "Variação R$"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [15, 26, 46], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      columnStyles: {
        0: { cellWidth: 80 }, 1: { cellWidth: 28, halign: "right" }, 2: { cellWidth: 28, halign: "right" },
        3: { cellWidth: 22, halign: "right" }, 4: { cellWidth: 28, halign: "right" },
      },
      didParseCell: function(data) {
        if (data.section === "body" && data.column.index === 0) {
          const text = data.cell.raw as string;
          if (text.startsWith("=") || text.includes("LUCRO") || text.includes("EBITDA") || text.includes("EBIT")) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [220, 252, 231];
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.setTextColor(15, 26, 46);
    doc.text("Indicadores de Performance", 20, finalY);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Margem Bruta: ${getMargem(resultadoBruto, receitaLiquidaAtual).toFixed(1)}%`, 20, finalY + 7);
    doc.text(`Margem EBITDA: ${getMargem(ebitdaAtual, receitaLiquidaAtual).toFixed(1)}%`, 20, finalY + 14);
    doc.text(`Margem Líquida: ${getMargem(lucroLiquidoAtual, receitaLiquidaAtual).toFixed(1)}%`, 20, finalY + 21);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página 1 de 1`, 105, 290, { align: "center" });

    doc.save(`DRE_${competencia}.pdf`);
  };

  const labelPeriodo = periodos.find(p => p.value === periodo)?.label || periodo;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            DRE Gerencial
          </h2>
          <p className="text-sm text-muted-foreground">Competência econômica — fontes reais (receber / pagar / pagamentos de prestadores)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDadosDRE} disabled={loading} className="gap-1">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoDre)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              {periodos.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={competencia} onValueChange={setCompetencia}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Competência" /></SelectTrigger>
            <SelectContent>
              {(mesesDisponiveis.length > 0 ? mesesDisponiveis : [mesAtual]).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={async () => await gerarPDF()} className="gap-2 bg-orange-500 hover:bg-orange-600">
            <Download className="w-4 h-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      {periodo === "personalizado" && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Período personalizado:</span>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9 rounded-md border bg-card px-3 text-sm" />
              <span className="text-muted-foreground">até</span>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9 rounded-md border bg-card px-3 text-sm" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indicadores de Performance */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Receita Bruta", value: fmtFin(getValor("1")), sub: fmtFin(getValor("1") - (dadosDRE.find(d => d.id === "1")?.valorAnterior || 0)), accent: "bg-blue-500", color: "text-blue-500" },
          { label: "Receita Líquida", value: fmtFin(receitaLiquidaAtual), sub: `${getMargem(receitaLiquidaAtual, receitaBrutaAtual).toFixed(1)}% da bruta`, accent: "bg-emerald-500", color: "text-emerald-500" },
          { label: "EBITDA", value: fmtFin(ebitdaAtual), sub: `Margem: ${getMargem(ebitdaAtual, receitaLiquidaAtual).toFixed(1)}%`, accent: "bg-violet-500", color: "text-violet-500" },
          { label: "Lucro Líquido", value: fmtFin(lucroLiquidoAtual), sub: `Margem: ${getMargem(lucroLiquidoAtual, receitaLiquidaAtual).toFixed(1)}%`, accent: "bg-purple-500", color: "text-purple-500" },
          { label: "Margem Bruta", value: `${getMargem(resultadoBruto, receitaLiquidaAtual).toFixed(1)}%`, sub: fmtFin(resultadoBruto), accent: "bg-amber-500", color: "text-amber-500" },
        ].map(k => (
          <Card key={k.label} className="relative overflow-hidden bg-card border-border shadow-sm hover:-translate-y-0.5 transition-transform">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${k.accent}`} />
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className={`text-xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[300px] font-semibold">Descrição</TableHead>
                  <TableHead className="text-right w-[130px] font-semibold">Valor Atual</TableHead>
                  <TableHead className="text-right w-[130px] font-semibold">Valor Anterior</TableHead>
                  <TableHead className="text-right w-[80px] font-semibold">Var. %</TableHead>
                  <TableHead className="text-right w-[120px] font-semibold">Var. R$</TableHead>
                  <TableHead className="text-right w-[80px] font-semibold">% Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosDRE.map((line) => (
                  <DRELineRow key={line.id} line={line} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground">
        Fonte: financeiro_receber (receita), pagamentos_prestadores com impacto_dre=true (custo prestador),
        financeiro_pagar sem repasses de prestador (outras despesas). Depreciação e IR/CSLL não estimados
        (sem fonte real confiável). Baixas financeiras não geram competência.
      </p>
    </div>
  );
}
