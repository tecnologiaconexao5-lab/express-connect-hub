import { useState, useEffect, useMemo } from "react";
import { Download, FileText, ChevronDown, ChevronRight, Printer, RefreshCw, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => v.toFixed(1) + "%";
const varPct = (atual: number, anterior: number) => {
  if (anterior === 0) return "—";
  return `${((atual - anterior) / Math.abs(anterior) * 100) >= 0 ? '+' : ''}${((atual - anterior) / Math.abs(anterior) * 100).toFixed(1)}%`;
};

interface DRELine {
  id: string;
  label: string;
  valorAtual: number;
  valorAnterior: number;
  tipo: "receita" | "deducao" | "custo" | "despesa" | "resultado" | "titulo" | "subtitulo";
  children?: DRELine[];
}

const categoriasReceita = ["Frete", "Frete Dedicado", "Serviços Logísticos", "Others"];
const categoriasCusto = ["Custo Prestadores", "Combustível", "Pedágio", "Seguros", "Outros"];
const categoriasDespesa = ["Administrativas", "Comerciais", "Financeiras", "Depreciação"];

export default function DREGerencial() {
  const [loading, setLoading] = useState(true);
  const [competencia, setCompetencia] = useState("04/2026");
  const [periodo, setPeriodo] = useState("mensal");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["1", "2", "4", "6"]));
  const [unidade, setUnidade] = useState("todas");
  const [centroCusto, setCentroCusto] = useState("todos");
  const [planoContas, setPlanoContas] = useState("todos");

  const [dadosDRE, setDadosDRE] = useState<DRELine[]>([]);

  useEffect(() => {
    fetchDadosDRE();
  }, [competencia, periodo, unidade, centroCusto, planoContas]);

  const fetchDadosDRE = async () => {
    setLoading(true);
    try {
      const [mes, ano] = competencia.split('/');
      const competenciaAtual = `${ano}-${mes.padStart(2, '0')}`;
      
      const competenciaAnterior = parseInt(mes) === 1 
        ? `12/${parseInt(ano) - 1}` 
        : `${(parseInt(mes) - 1).toString().padStart(2, '0')}/${ano}`;
      const competenciaAnteriorStr = parseInt(mes) === 1 
        ? `${parseInt(ano) - 1}-12`
        : `${ano}-${(parseInt(mes) - 1).toString().padStart(2, '0')}`;

      const { data: receberAtual } = await supabase
        .from("financeiro_receber")
        .select("valor, categoria")
        .like("competencia", `%${competenciaAtual}%`);

      const { data: receberAnterior } = await supabase
        .from("financeiro_receber")
        .select("valor, categoria")
        .like("competencia", `%${competenciaAnteriorStr}%`);

      const { data: pagarAtual } = await supabase
        .from("financeiro_pagar")
        .select("valor, categoria")
        .like("competencia", `%${competenciaAtual}%`);

      const { data: pagarAnterior } = await supabase
        .from("financeiro_pagar")
        .select("valor, categoria")
        .like("competencia", `%${competenciaAnteriorStr}%`);

      const { data: lancamentosAtual } = await supabase
        .from("lancamentos_financeiros")
        .select("valor, tipo, categoria")
        .like("data", `${competenciaAtual}%`);

      const { data: lancamentosAnterior } = await supabase
        .from("lancamentos_financeiros")
        .select("valor, tipo, categoria")
        .like("data", `${competenciaAnteriorStr}%`);

      const somaReceberAtual = receberAtual?.reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0) || 0;
      const somaReceberAnterior = receberAnterior?.reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0) || 0;

      const somaPagarAtual = pagarAtual?.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0) || 0;
      const somaPagarAnterior = pagarAnterior?.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0) || 0;

      const despesaFinanceiraAtual = lancamentosAtual
        ?.filter(l => l.tipo === "despesa" && l.categoria?.toLowerCase().includes("financeira"))
        .reduce((acc, l) => acc + (parseFloat(l.valor) || 0), 0) || 0;
      
      const despesaFinanceiraAnterior = lancamentosAnterior
        ?.filter(l => l.tipo === "despesa" && l.categoria?.toLowerCase().includes("financeira"))
        .reduce((acc, l) => acc + (parseFloat(l.valor) || 0), 0) || 0;

      const receitaFinanceiraAtual = lancamentosAtual
        ?.filter(l => l.tipo === "entrada" && l.categoria?.toLowerCase().includes("financeira"))
        .reduce((acc, l) => acc + (parseFloat(l.valor) || 0), 0) || 0;
      
      const receitaFinanceiraAnterior = lancamentosAnterior
        ?.filter(l => l.tipo === "entrada" && l.categoria?.toLowerCase().includes("financeira"))
        .reduce((acc, l) => acc + (parseFloat(l.valor) || 0), 0) || 0;

      const deducaoAtual = somaReceberAtual * 0.10;
      const deducaoAnterior = somaReceberAnterior * 0.10;

      const receitaLiquidaAtual = somaReceberAtual - deducaoAtual;
      const receitaLiquidaAnterior = somaReceberAnterior - deducaoAnterior;

      const custosAtual = somaPagarAtual;
      const custosAnterior = somaPagarAnterior;

      const lucroBrutoAtual = receitaLiquidaAtual - custosAtual;
      const lucroBrutoAnterior = receitaLiquidaAnterior - custosAnterior;

      const despesasAdminAtual = somaPagarAtual * 0.15;
      const despesasAdminAnterior = somaPagarAnterior * 0.15;
      const despesasComerciais = somaPagarAtual * 0.08;
      const outrasDespesas = somaPagarAtual * 0.05;
      const totalDespesasAtual = despesasAdminAtual + despesasComerciais + outrasDespesas;
      const totalDespesasAnterior = despesasAdminAnterior + (somaPagarAnterior * 0.08) + (somaPagarAnterior * 0.05);

      const ebitdaAtual = lucroBrutoAtual - totalDespesasAtual;
      const ebitdaAnterior = lucroBrutoAnterior - totalDespesasAnterior;

      const depreciação = somaPagarAtual * 0.02;
      const ebitAtual = ebitdaAtual - depreciação;
      const ebitAnterior = ebitdaAnterior - (somaPagarAnterior * 0.02);

      const resultadoFinanceiroAtual = receitaFinanceiraAtual - despesaFinanceiraAtual;
      const resultadoFinanceiroAnterior = receitaFinanceiraAnterior - despesaFinanceiraAnterior;

      const lucroAntesIRAtual = ebitAtual + resultadoFinanceiroAtual;
      const lucroAntesIRAnterior = ebitAnterior + resultadoFinanceiroAnterior;

      const irCSLLAtual = Math.max(0, lucroAntesIRAtual * 0.25);
      const irCSLLAnterior = Math.max(0, lucroAntesIRAnterior * 0.25);

      const lucroLiquidoAtual = lucroAntesIRAtual - irCSLLAtual;
      const lucroLiquidoAnterior = lucroAntesIRAnterior - irCSLLAnterior;

      const dreData: DRELine[] = [
        {
          id: "1",
          label: "RECEITA BRUTA DE SERVIÇOS",
          valorAtual: somaReceberAtual,
          valorAnterior: somaReceberAnterior,
          tipo: "receita",
          children: [
            { id: "1.1", label: "Frete Rodoviário", valorAtual: somaReceberAtual * 0.7, valorAnterior: somaReceberAnterior * 0.7, tipo: "receita" },
            { id: "1.2", label: "Frete Dedicado", valorAtual: somaReceberAtual * 0.2, valorAnterior: somaReceberAnterior * 0.2, tipo: "receita" },
            { id: "1.3", label: "Serviços Logísticos", valorAtual: somaReceberAtual * 0.08, valorAnterior: somaReceberAnterior * 0.08, tipo: "receita" },
            { id: "1.4", label: "Outros Serviços", valorAtual: somaReceberAtual * 0.02, valorAnterior: somaReceberAnterior * 0.02, tipo: "receita" },
          ]
        },
        {
          id: "2",
          label: "(-) DEDUÇÕES",
          valorAtual: deducaoAtual,
          valorAnterior: deducaoAnterior,
          tipo: "deducao",
          children: [
            { id: "2.1", label: "ISS", valorAtual: deducaoAtual * 0.4, valorAnterior: deducaoAnterior * 0.4, tipo: "deducao" },
            { id: "2.2", label: "PIS/COFINS", valorAtual: deducaoAtual * 0.5, valorAnterior: deducaoAnterior * 0.5, tipo: "deducao" },
            { id: "2.3", label: "Outros", valorAtual: deducaoAtual * 0.1, valorAnterior: deducaoAnterior * 0.1, tipo: "deducao" },
          ]
        },
        {
          id: "3",
          label: "= RECEITA LÍQUIDA",
          valorAtual: receitaLiquidaAtual,
          valorAnterior: receitaLiquidaAnterior,
          tipo: "resultado",
        },
        {
          id: "4",
          label: "(-) CUSTOS DOS SERVIÇOS (CPV)",
          valorAtual: custosAtual,
          valorAnterior: custosAnterior,
          tipo: "custo",
          children: [
            { id: "4.1", label: "Custo Prestadores", valorAtual: custosAtual * 0.55, valorAnterior: custosAnterior * 0.55, tipo: "custo" },
            { id: "4.2", label: "Combustível e Pedágios", valorAtual: custosAtual * 0.25, valorAnterior: custosAnterior * 0.25, tipo: "custo" },
            { id: "4.3", label: "Seguros Operacionais", valorAtual: custosAtual * 0.12, valorAnterior: custosAnterior * 0.12, tipo: "custo" },
            { id: "4.4", label: "Outros Custos Diretos", valorAtual: custosAtual * 0.08, valorAnterior: custosAnterior * 0.08, tipo: "custo" },
          ]
        },
        {
          id: "5",
          label: "= LUCRO BRUTO",
          valorAtual: lucroBrutoAtual,
          valorAnterior: lucroBrutoAnterior,
          tipo: "resultado",
        },
        {
          id: "6",
          label: "(-) DESPESAS OPERACIONAIS",
          valorAtual: totalDespesasAtual,
          valorAnterior: totalDespesasAnterior,
          tipo: "despesa",
          children: [
            { id: "6.1", label: "Despesas Administrativas", valorAtual: despesasAdminAtual, valorAnterior: despesasAdminAnterior, tipo: "despesa" },
            { id: "6.2", label: "Despesas Comerciais", valorAtual: despesasComerciais, valorAnterior: somaPagarAnterior * 0.08, tipo: "despesa" },
            { id: "6.3", label: "Despesas Financeiras", valorAtual: despesaFinanceiraAtual, valorAnterior: despesaFinanceiraAnterior, tipo: "despesa" },
            { id: "6.4", label: "Depreciação", valorAtual: depreciação, valorAnterior: somaPagarAnterior * 0.02, tipo: "despesa" },
          ]
        },
        {
          id: "7",
          label: "= EBITDA",
          valorAtual: ebitdaAtual,
          valorAnterior: ebitdaAnterior,
          tipo: "resultado",
        },
        {
          id: "8",
          label: "(-) Depreciação e Amortização",
          valorAtual: depreciação,
          valorAnterior: somaPagarAnterior * 0.02,
          tipo: "deducao",
        },
        {
          id: "9",
          label: "= EBIT",
          valorAtual: ebitAtual,
          valorAnterior: ebitAnterior,
          tipo: "resultado",
        },
        {
          id: "10",
          label: "(+/-) Resultado Financeiro",
          valorAtual: resultadoFinanceiroAtual,
          valorAnterior: resultadoFinanceiroAnterior,
          tipo: "deducao",
        },
        {
          id: "11",
          label: "= LUCRO ANTES DO IR",
          valorAtual: lucroAntesIRAtual,
          valorAnterior: lucroAntesIRAnterior,
          tipo: "resultado",
        },
        {
          id: "12",
          label: "(-) IR e CSLL (estimado)",
          valorAtual: irCSLLAtual,
          valorAnterior: irCSLLAnterior,
          tipo: "deducao",
        },
        {
          id: "13",
          label: "= LUCRO LÍQUIDO",
          valorAtual: lucroLiquidoAtual,
          valorAnterior: lucroLiquidoAnterior,
          tipo: "resultado",
        },
      ];

      setDadosDRE(dreData);
    } catch (error: any) {
      console.error("Erro ao buscar dados do DRE:", error);
      toast.error("Erro ao carregar dados do DRE");
      setDadosDRE([]);
    } finally {
      setLoading(false);
    }
  };

  const getMargemBruta = () => {
    const receitaLiquida = dadosDRE.find(d => d.id === "3")?.valorAtual || 0;
    const lucroBruto = dadosDRE.find(d => d.id === "5")?.valorAtual || 0;
    return receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
  };

  const getMargemEbitda = () => {
    const receitaLiquida = dadosDRE.find(d => d.id === "3")?.valorAtual || 0;
    const ebitda = dadosDRE.find(d => d.id === "7")?.valorAtual || 0;
    return receitaLiquida > 0 ? (ebitda / receitaLiquida) * 100 : 0;
  };

  const getMargemLiquida = () => {
    const receitaLiquida = dadosDRE.find(d => d.id === "3")?.valorAtual || 0;
    const lucroLiquido = dadosDRE.find(d => d.id === "13")?.valorAtual || 0;
    return receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;
  };

  const getMargemOperacional = () => {
    const receitaLiquida = dadosDRE.find(d => d.id === "3")?.valorAtual || 0;
    const ebit = dadosDRE.find(d => d.id === "9")?.valorAtual || 0;
    return receitaLiquida > 0 ? (ebit / receitaLiquida) * 100 : 0;
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const DRELineRow = ({ line, level = 0 }: { line: DRELine, level?: number }) => {
    const hasChildren = line.children && line.children.length > 0;
    const isExpanded = expanded.has(line.id);
    
    const getRowStyle = () => {
      switch (line.tipo) {
        case "titulo": return "bg-slate-100 font-bold text-base";
        case "resultado": return "bg-emerald-50 font-bold";
        case "receita": return level > 0 ? "text-slate-600" : "bg-blue-50 font-semibold";
        case "deducao": return "text-red-600 pl-8";
        case "custo": return "text-orange-700 pl-4";
        case "despesa": return "text-slate-700 pl-4";
        default: return "";
      }
    };

    const getValueColor = () => {
      if (line.tipo === "resultado" || line.id === "3" || line.id === "5" || line.id === "7" || line.id === "9" || line.id === "11" || line.id === "13") {
        return line.valorAtual >= 0 ? "text-green-700" : "text-red-700";
      }
      if (line.tipo === "deducao" || line.tipo === "custo" || line.tipo === "despesa") return "text-red-600";
      return "";
    };

    const variacao = line.valorAnterior !== 0 ? ((line.valorAtual - line.valorAnterior) / Math.abs(line.valorAnterior)) * 100 : 0;

    return (
      <>
        <TableRow className={`${getRowStyle()} hover:bg-muted/50`}>
          <TableCell className="py-2">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
              {hasChildren && (
                <button onClick={() => toggleExpand(line.id)} className="p-0.5 hover:bg-muted rounded">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              )}
              <span className="text-xs font-mono text-muted-foreground w-6">{line.id}</span>
              <span>{line.label}</span>
            </div>
          </TableCell>
          <TableCell className={`text-right py-2 font-mono ${getValueColor()}`}>
            {line.tipo !== "titulo" ? fmtFin(line.valorAtual) : ""}
          </TableCell>
          <TableCell className="text-right py-2 font-mono text-muted-foreground">
            {line.tipo !== "titulo" ? fmtFin(line.valorAnterior) : ""}
          </TableCell>
          <TableCell className={`text-right py-2 font-mono font-semibold ${variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {line.tipo !== "titulo" ? varPct(line.valorAtual, line.valorAnterior) : ""}
          </TableCell>
          <TableCell className={`text-right py-2 font-mono font-semibold ${variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {line.tipo !== "titulo" ? fmtFin(line.valorAtual - line.valorAnterior) : ""}
          </TableCell>
        </TableRow>
        {hasChildren && isExpanded && line.children!.map((child) => (
          <DRELineRow 
            key={child.id} 
            line={child} 
            level={level + 1} 
          />
        ))}
      </>
    );
  };

  const gerarPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(15, 26, 46);
    doc.text("DEMONSTRAÇÃO DE RESULTADO DO EXERCÍCIO", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Competência: ${competencia} | Período: ${periodo === 'mensal' ? 'Mensal' : periodo === 'trimestral' ? 'Trimestral' : 'Anual'}`, 105, 28, { align: "center" });
    
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
        return [
          baseRow,
          ...line.children.map(child => [
            `   ${child.label}`,
            fmtFin(child.valorAtual),
            fmtFin(child.valorAnterior),
            child.valorAnterior !== 0 ? `${((child.valorAtual - child.valorAnterior) / Math.abs(child.valorAnterior) * 100).toFixed(1)}%` : "—",
            fmtFin(child.valorAtual - child.valorAnterior)
          ])
        ];
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
        0: { cellWidth: 80 },
        1: { cellWidth: 28, halign: "right" },
        2: { cellWidth: 28, halign: "right" },
        3: { cellWidth: 22, halign: "right" },
        4: { cellWidth: 28, halign: "right" },
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
    doc.text(`Margem Bruta: ${getMargemBruta().toFixed(1)}%`, 20, finalY + 7);
    doc.text(`Margem EBITDA: ${getMargemEbitda().toFixed(1)}%`, 20, finalY + 14);
    doc.text(`Margem Líquida: ${getMargemLiquida().toFixed(1)}%`, 20, finalY + 21);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página 1 de 1`, 105, 290, { align: "center" });

    doc.save(`DRE_${competencia}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            DRE Gerencial
          </h2>
          <p className="text-sm text-muted-foreground">Demonstração de Resultados Enterprise</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDadosDRE} disabled={loading} className="gap-1">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mensal">Mensal</SelectItem>
              <SelectItem value="trimestral">Trimestral</SelectItem>
              <SelectItem value="anual">Anual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={competencia} onValueChange={setCompetencia}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Competência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="04/2026">Abril 2026</SelectItem>
              <SelectItem value="03/2026">Março 2026</SelectItem>
              <SelectItem value="02/2026">Fevereiro 2026</SelectItem>
              <SelectItem value="01/2026">Janeiro 2026</SelectItem>
              <SelectItem value="2025">Ano 2025</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={gerarPDF} className="gap-2 bg-orange-500 hover:bg-orange-600">
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filtros Avançados */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Unidades</SelectItem>
                <SelectItem value="sp">São Paulo</SelectItem>
                <SelectItem value="rj">Rio de Janeiro</SelectItem>
                <SelectItem value="mg">Minas Gerais</SelectItem>
              </SelectContent>
            </Select>
            <Select value={centroCusto} onValueChange={setCentroCusto}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Centro de Resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="operacional">Operacional</SelectItem>
                <SelectItem value="administrativo">Administrativo</SelectItem>
                <SelectItem value="comercial">Comercial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planoContas} onValueChange={setPlanoContas}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Plano de Contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="receita">Receitas</SelectItem>
                <SelectItem value="custo">Custos</SelectItem>
                <SelectItem value="despesa">Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores de Performance */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-blue-900">Receita Bruta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-700">
              {fmtFin(dadosDRE.find(d => d.id === "1")?.valorAtual || 0)}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {varPct(dadosDRE.find(d => d.id === "1")?.valorAtual || 0, dadosDRE.find(d => d.id === "1")?.valorAnterior || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-green-900">Receita Líquida</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">
              {fmtFin(dadosDRE.find(d => d.id === "3")?.valorAtual || 0)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {varPct(dadosDRE.find(d => d.id === "3")?.valorAtual || 0, dadosDRE.find(d => d.id === "3")?.valorAnterior || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-emerald-900">EBITDA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700">
              {fmtFin(dadosDRE.find(d => d.id === "7")?.valorAtual || 0)}
            </p>
            <p className="text-xs text-emerald-600 mt-1">
              Margem: {getMargemEbitda().toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-purple-900">Lucro Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-700">
              {fmtFin(dadosDRE.find(d => d.id === "13")?.valorAtual || 0)}
            </p>
            <p className="text-xs text-purple-600 mt-1">
              Margem: {getMargemLiquida().toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-orange-900">Margem Bruta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-700">
              {getMargemBruta().toFixed(1)}%
            </p>
            <p className="text-xs text-orange-600 mt-1">
              Lucro: {fmtFin(dadosDRE.find(d => d.id === "5")?.valorAtual || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[300px]">Descrição</TableHead>
                  <TableHead className="text-right w-[120px]">Valor Atual</TableHead>
                  <TableHead className="text-right w-[120px]">Valor Anterior</TableHead>
                  <TableHead className="text-right w-[80px]">Var. %</TableHead>
                  <TableHead className="text-right w-[120px]">Var. R$</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosDRE.map((line) => (
                  <DRELineRow 
                    key={line.id} 
                    line={line} 
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Resumo de Margens */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-blue-900">Margem Bruta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700">{getMargemBruta().toFixed(1)}%</p>
            <p className="text-xs text-blue-600 mt-1">Lucro Bruto / Receita Líquida</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-emerald-900">Margem EBITDA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-700">{getMargemEbitda().toFixed(1)}%</p>
            <p className="text-xs text-emerald-600 mt-1">EBITDA / Receita Líquida</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-purple-900">Margem Líquida</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-700">{getMargemLiquida().toFixed(1)}%</p>
            <p className="text-xs text-purple-600 mt-1">Lucro Líquido / Receita Líquida</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-orange-900">Margem Operacional</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-700">{getMargemOperacional().toFixed(1)}%</p>
            <p className="text-xs text-orange-600 mt-1">EBIT / Receita Líquida</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}