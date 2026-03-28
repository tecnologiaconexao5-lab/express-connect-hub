import { useState } from "react";
import { Download, FileText, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

const mockDREData: DRELine[] = [
  {
    id: "1",
    label: "RECEITA BRUTA DE SERVIÇOS",
    valorAtual: 1458000,
    valorAnterior: 1325000,
    tipo: "receita",
    children: [
      { id: "1.1", label: "Frete Rodoviário", valorAtual: 980000, valorAnterior: 890000, tipo: "receita" },
      { id: "1.2", label: "Frete Dedicado", valorAtual: 320000, valorAnterior: 290000, tipo: "receita" },
      { id: "1.3", label: "Serviços Logísticos", valorAtual: 128000, valorAnterior: 115000, tipo: "receita" },
      { id: "1.4", label: "Outros Serviços", valorAtual: 30000, valorAnterior: 30000, tipo: "receita" },
    ]
  },
  {
    id: "2",
    label: "(-) DEDUÇÕES",
    valorAtual: 158000,
    valorAnterior: 142000,
    tipo: "deducao",
    children: [
      { id: "2.1", label: "ISS", valorAtual: 68000, valorAnterior: 62000, tipo: "deducao" },
      { id: "2.2", label: "PIS/COFINS", valorAtual: 90000, valorAnterior: 80000, tipo: "deducao" },
    ]
  },
  {
    id: "3",
    label: "= RECEITA LÍQUIDA",
    valorAtual: 1300000,
    valorAnterior: 1183000,
    tipo: "resultado",
  },
  {
    id: "4",
    label: "(-) CUSTOS DOS SERVIÇOS (CPV)",
    valorAtual: 845000,
    valorAnterior: 768000,
    tipo: "custo",
    children: [
      { id: "4.1", label: "Custo Prestadores", valorAtual: 520000, valorAnterior: 480000, tipo: "custo" },
      { id: "4.2", label: "Combustível e Pedágios", valorAtual: 185000, valorAnterior: 165000, tipo: "custo" },
      { id: "4.3", label: "Seguros Operacionais", valorAtual: 85000, valorAnterior: 75000, tipo: "custo" },
      { id: "4.4", label: "Outros Custos Diretos", valorAtual: 55000, valorAnterior: 48000, tipo: "custo" },
    ]
  },
  {
    id: "5",
    label: "= LUCRO BRUTO",
    valorAtual: 455000,
    valorAnterior: 415000,
    tipo: "resultado",
  },
  {
    id: "6",
    label: "(-) DESPESAS OPERACIONAIS",
    valorAtual: 185000,
    valorAnterior: 172000,
    tipo: "despesa",
    children: [
      { id: "6.1", label: "Despesas Administrativas", valorAtual: 95000, valorAnterior: 88000, tipo: "despesa" },
      { id: "6.2", label: "Despesas Comerciais", valorAtual: 45000, valorAnterior: 42000, tipo: "despesa" },
      { id: "6.3", label: "Despesas Financeiras", valorAtual: 28000, valorAnterior: 26000, tipo: "despesa" },
      { id: "6.4", label: "Depreciação", valorAtual: 17000, valorAnterior: 16000, tipo: "despesa" },
    ]
  },
  {
    id: "7",
    label: "= EBITDA",
    valorAtual: 270000,
    valorAnterior: 243000,
    tipo: "resultado",
  },
  {
    id: "8",
    label: "(-) Depreciação e Amortização",
    valorAtual: 17000,
    valorAnterior: 16000,
    tipo: "deducao",
  },
  {
    id: "9",
    label: "= EBIT",
    valorAtual: 253000,
    valorAnterior: 227000,
    tipo: "resultado",
  },
  {
    id: "10",
    label: "(+/-) Resultado Financeiro",
    valorAtual: -12000,
    valorAnterior: -8500,
    tipo: "deducao",
  },
  {
    id: "11",
    label: "= LUCRO ANTES DO IR",
    valorAtual: 241000,
    valorAnterior: 218500,
    tipo: "resultado",
  },
  {
    id: "12",
    label: "(-) IR e CSLL (estimado)",
    valorAtual: 60250,
    valorAnterior: 54625,
    tipo: "deducao",
  },
  {
    id: "13",
    label: "= LUCRO LÍQUIDO",
    valorAtual: 180750,
    valorAnterior: 163875,
    tipo: "resultado",
  },
];

const getMargemBruta = () => ((mockDREData[4].valorAtual / mockDREData[2].valorAtual) * 100);
const getMargemEbitda = () => ((mockDREData[6].valorAtual / mockDREData[2].valorAtual) * 100);
const getMargemLiquida = () => ((mockDREData[12].valorAtual / mockDREData[2].valorAtual) * 100);

const DRELineRow = ({ line, level = 0, expanded, toggleExpand }: { line: DRELine, level?: number, expanded: Set<string>, toggleExpand: (id: string) => void }) => {
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
          expanded={expanded} 
          toggleExpand={toggleExpand} 
        />
      ))}
    </>
  );
};

export default function DREGerencial() {
  const [competencia, setCompetencia] = useState("03/2026");
  const [periodo, setPeriodo] = useState("mensal");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["1", "2", "4", "6"]));

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
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

    const tableData = mockDREData.flatMap(line => {
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
              {mockDREData.map((line) => (
                <DRELineRow 
                  key={line.id} 
                  line={line} 
                  expanded={expanded} 
                  toggleExpand={toggleExpand} 
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>
    </div>
  );
}
