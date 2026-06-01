import { useState, useEffect } from "react";
import {
  FileText, Download, Filter, Truck, Users, DollarSign, TrendingUp, BarChart3, Building2, CreditCard, Wallet,
  Search, Check, ChevronsUpDown, MapPin, Clock, Percent, TrendingDown, Activity, Package, Route
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoBundledLight from "@/assets/logo-conexao-light.webp";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { gerarPDFRepassePrestador, gerarPDFFaturamentoDetalhado } from "@/utils/pdfRelatorioOperacional";
import {
  buscarDadosPagamentoPrestador,
  buscarClientesAtivos,
  type FiltrosPagamento,
} from "@/services/relatorios/relatorioService";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const detectBase64Format = (base64: string) => {
  if (base64.startsWith("data:image/webp")) return "WEBP";
  if (base64.startsWith("data:image/jpeg") || base64.startsWith("data:image/jpg")) return "JPEG";
  return "PNG";
};

const getImageDimensions = (base64: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Image === "undefined") {
      resolve({ w: 0, h: 0 });
      return;
    }
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = base64;
  });

const drawLogoPreserved = (
  doc: any,
  base64: string | null,
  dimensions: { w: number; h: number },
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  onFallback: () => void
) => {
  if (!base64 || dimensions.w === 0 || dimensions.h === 0) {
    onFallback();
    return;
  }

  const ratio = dimensions.w / dimensions.h;
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  const drawY = y + (maxHeight - height) / 2;
  try {
    doc.addImage(base64, detectBase64Format(base64), x, drawY, width, height, undefined, "FAST");
  } catch {
    onFallback();
  }
};

interface OS {
  id: number;
  numero: string;
  data: string;
  cliente: string;
  prestador: string;
  origem: string;
  destino: string;
  status: string;
  valorCliente: number;
  custoPrestador: number;
  margem: number;
  margemPct: number;
  placa?: string;
  tipoVeiculo?: string;
  horarioChegada?: string;
  horarioSaida?: string;
  diaria?: number;
  kmTotal?: number;
  kmExcedente?: number;
  valorKm?: number;
  observacao?: string;
  obs?: string;
  numeroOc?: string;
}

// REMOVED MOCK_OS

interface Cliente {
  id: number;
  nome: string;
  cnpj: string;
  totalFaturado: number;
  diarias: number;
  contratosFixos: number;
  operacoes: OS[];
}

// REMOVED MOCK_CLIENTES

interface Prestador {
  id: number | string;
  nome: string;
  cpfCnpj: string;
  tipo: string;
  totalOperacoes: number;
  valorPago: number;
  operacoes: any[];
}

interface PrestadorLinha {
  os: string;
  cliente: string;
  origem: string;
  destino: string;
  dataColeta: string;
  dataEntrega: string;
  valorFrete: number;
  valorPrestador: number;
  margem: number;
  margemPct: number;
  statusFinanceiro: string;
  tipoVeiculo: string;
  metadata?: any;
  ocorrencia: string;
}

const carregarLogoBase64 = async (): Promise<string | null> => {
  const sources = [
    '/logos/logo-conexao-oficial.png'
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn(`Logo não encontrado em ${source}:`, e);
    }
  }

  return null;
};

const generateExtratoPDF = async (data: OS[], filtros: any) => {
  const doc = new jsPDF("landscape", "mm", "a4");
  const logo = await carregarLogoBase64();
  const logoDimensions = logo ? await getImageDimensions(logo) : { w: 0, h: 0 };
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const dataHora = new Date().toLocaleString("pt-BR");

  const usableWidth = pageWidth - margin * 2;

  const drawHeader = () => {
    doc.setFillColor(15, 26, 46);
    doc.rect(0, 0, pageWidth, 40, "F");
    if (logo) {
      drawLogoPreserved(doc, logo, logoDimensions, margin, 8, 85, 25, () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text("CX", margin, 20);
      });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("CX", margin, 20);
    }
    doc.setFontSize(7);
    doc.setTextColor(200, 200, 200);
    doc.setFont("helvetica", "normal");
    doc.text("12.345.678/0001-90  •  (11) 4000-1234  •  financeiro@conexaoexpress.com.br", margin, 36);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("EXTRATO OPERACIONAL", pageWidth - margin, 15, { align: "right" });
    doc.setFontSize(7);
    doc.text(`Gerado em: ${dataHora}`, pageWidth - margin, 22, { align: "right" });
    doc.setDrawColor(249, 115, 22);
    doc.setLineWidth(0.6);
    doc.line(margin, 40, pageWidth - margin, 40);
  };
  
  drawHeader();
  
  doc.setTextColor(60);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  let yInfo = 46;
  const filtrosText: string[] = [];
  if (filtros.cliente && filtros.cliente !== "todos") filtrosText.push(`Cliente: ${filtros.cliente}`);
  if (filtros.prestador && filtros.prestador !== "todos") filtrosText.push(`Prestador: ${filtros.prestador}`);
  if (filtros.status && filtros.status !== "todos") filtrosText.push(`Status: ${filtros.status}`);
  if (filtros.dataInicio && filtros.dataFim) filtrosText.push(`Período: ${filtros.dataInicio} a ${filtros.dataFim}`);
  
  if (filtrosText.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 26, 46);
    doc.text("Filtros Aplicados:", margin, yInfo);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(filtrosText.join("  •  "), margin + 28, yInfo);
    yInfo += 6;
  }
  
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, yInfo, pageWidth - margin, yInfo);

  const tableData = data.map(os => [
    os.numero,
    os.data,
    os.cliente,
    os.prestador,
    os.origem,
    os.destino,
    os.status,
    fmtFin(os.valorCliente),
    fmtFin(os.custoPrestador),
    `${os.margemPct.toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: yInfo + 4,
    head: [["OS", "Data", "Cliente", "Prestador", "Origem", "Destino", "Status", "Valor", "Custo", "Margem"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [15, 26, 46], textColor: 255, fontSize: 7.5, halign: "center", valign: "middle" },
    bodyStyles: { fontSize: 7, textColor: [51, 65, 85], valign: "middle" },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: 18 },
      2: { cellWidth: 38 },
      3: { cellWidth: 38 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 },
      6: { cellWidth: 20, halign: "center" },
      7: { cellWidth: 22, halign: "right" },
      8: { cellWidth: 22, halign: "right" },
      9: { cellWidth: 18, halign: "right" },
    },
    margin: { top: yInfo + 4, right: margin, bottom: 40, left: margin },
    didDrawPage: (data: any) => {
      const pageNum = doc.internal.getNumberOfPages();
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
      doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 14, { align: "center" });
      doc.text(`Emitido por Conexão Express - ${dataHora}`, margin, pageHeight - 14);
      doc.text("Conexão Express Transportes LTDA", pageWidth - margin, pageHeight - 14, { align: "right" });
      if (data.pageNumber > 1) drawHeader();
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  const totalReceita = data.reduce((acc, os) => acc + os.valorCliente, 0);
  const totalCusto = data.reduce((acc, os) => acc + os.custoPrestador, 0);
  const totalMargem = data.reduce((acc, os) => acc + os.margem, 0);
  const margemMedia = totalReceita > 0 ? (totalMargem / totalReceita) * 100 : 0;

  let totY = finalY;
  if (totY > pageHeight - 50) {
    doc.addPage();
    drawHeader();
    totY = 48;
  }

  const summaryW = usableWidth / 4 - 4;
  [
    { label: "TOTAL OS", valor: `${data.length}`, bg: [239, 246, 255] },
    { label: "RECEITA TOTAL", valor: fmtFin(totalReceita), bg: [255, 247, 237] },
    { label: "CUSTO TOTAL", valor: fmtFin(totalCusto), bg: [254, 242, 242] },
    { label: "MARGEM MÉDIA", valor: `${margemMedia.toFixed(1)}%`, bg: [236, 253, 245] },
  ].forEach((c, idx) => {
    const cx = margin + idx * (summaryW + 5);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, totY, summaryW, 18, 2, 2, "FD");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cx + 4, totY + 6);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 26, 46);
    doc.text(c.valor, cx + 4, totY + 14);
  });

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(148, 163, 184);
  doc.text("Documento gerado automaticamente pelo Sistema Conexão Express", pageWidth / 2, pageHeight - 10, { align: "center" });

  doc.save("extrato_operacional.pdf");
};


const generateFaturamentoPDF = async (
  cliente: Cliente,
  filtros: { dataInicio: string; dataFim: string }
) => {
  const opsFiltradas = cliente.operacoes.filter(os => {
    if (filtros.dataInicio && os.data && os.data < filtros.dataInicio) return false;
    if (filtros.dataFim && os.data && os.data > filtros.dataFim) return false;
    return true;
  });

  const opFormatadas = opsFiltradas.map(o => ({
    numero: o.numero || o.numeroOc || o.id,
    data: o.data || "",
    veiculo_tipo: o.tipoVeiculo || o.tipo_veiculo || "-",
    enderecos: [
      { cidade: o.origem || "Base" },
      { cidade: o.destino || "Destino" }
    ],
    valor_frete: o.valorCliente || 0,
    diaria: o.diaria || 0,
    km_adicional: 0,
    km_total: o.kmTotal || 0,
    km_base: o.kmTotal ? Math.max(o.kmTotal - o.kmExcedente, 0) : 0,
    veiculo_placa: o.placa || "-",
    observacoes: o.observacao || "-",
  }));

  const periodo = (filtros.dataInicio || filtros.dataFim) 
    ? `${filtros.dataInicio ? new Date(filtros.dataInicio).toLocaleDateString("pt-BR") : "Início"} até ${filtros.dataFim ? new Date(filtros.dataFim).toLocaleDateString("pt-BR") : "Fim"}`
    : "Período Geral";

  await gerarPDFFaturamentoDetalhado(
    { nome: cliente.nome, cnpj: cliente.cnpj },
    periodo,
    opFormatadas,
    "Administrador"
  );
};

const generateExcelFaturamentoCliente = (
  cliente: Cliente,
  filtrosObj: { dataInicio: string; dataFim: string; status: string }
) => {
  const opsFiltradas = cliente.operacoes.filter(os => {
    if (filtrosObj.dataInicio && os.data && os.data < filtrosObj.dataInicio) return false;
    if (filtrosObj.dataFim && os.data && os.data > filtrosObj.dataFim) return false;
    if (filtrosObj.status !== "todos" && os.status !== filtrosObj.status) return false;
    return true;
  });

  const headers = [
    "DATA VIAGEM",
    "MOTORISTA",
    "PLACA",
    "TIPO DE VEÍCULO",
    "Observação",
    "HORÁRIO DE CHEGADA",
    "HORÁRIO DE SAÍDA",
    "DIÁRIA",
    "km total",
    "KM Excedente",
    "Vlr.Km",
    "Vlr.TOTAL",
    "Nº OC",
    "OBS"
  ];

  const rows = opsFiltradas.map(os => {
    const diaria = os.diaria ?? 0;
    const kmTotal = os.kmTotal ?? 0;
    const kmExcedente = os.kmExcedente ?? 0;
    const vlrKmUnit = os.valorKm ?? 0;
    const totalVlrKm = kmExcedente * vlrKmUnit;
    const vlrTotal = os.valorCliente ?? 0;

    const rowObj: any = {
      "DATA VIAGEM": os.data ? new Date(os.data).toLocaleDateString("pt-BR") : "",
      "MOTORISTA": os.prestador || "",
      "PLACA": os.placa || "",
      "TIPO DE VEÍCULO": os.tipoVeiculo || "-",
      "Observação": os.observacao || "",
      "HORÁRIO DE CHEGADA": os.horarioChegada || "",
      "HORÁRIO DE SAÍDA": os.horarioSaida || "",
      "DIÁRIA": diaria,
      "km total": kmTotal,
      "KM Excedente": kmExcedente,
      "Vlr.Km": totalVlrKm,
      "Vlr.TOTAL": vlrTotal,
      "Nº OC": os.numeroOc || os.numero || "",
      "OBS": os.obs || ""
    };

    console.log("[EXCEL_CLIENTE_ROW]", rowObj);

    return [
      { v: rowObj["DATA VIAGEM"], t: 's' },
      { v: rowObj["MOTORISTA"], t: 's' },
      { v: rowObj["PLACA"], t: 's' },
      { v: rowObj["TIPO DE VEÍCULO"], t: 's' },
      { v: rowObj["Observação"], t: 's' },
      { v: rowObj["HORÁRIO DE CHEGADA"], t: 's' },
      { v: rowObj["HORÁRIO DE SAÍDA"], t: 's' },
      { v: rowObj["DIÁRIA"], t: 'n', z: '"R$"#,##0.00' },
      { v: rowObj["km total"], t: 'n', z: '#,##0' },
      { v: rowObj["KM Excedente"], t: 'n', z: '#,##0' },
      { v: rowObj["Vlr.Km"], t: 'n', z: '"R$"#,##0.00' },
      { v: rowObj["Vlr.TOTAL"], t: 'n', z: '"R$"#,##0.00' },
      { v: rowObj["Nº OC"], t: 's' },
      { v: rowObj["OBS"], t: 's' }
    ];
  });

  const wsData = [headers.map(h => ({ v: h, t: 's' })), ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:N1");
  
  // Apply Autofill filters
  ws["!autofilter"] = { ref: `A1:N${rows.length + 1}` };

  // Freeze top row header
  ws["!views"] = [{ state: 'frozen', ySplit: 1 }];

  // Auto column widths
  ws["!cols"] = headers.map((h, i) => {
    let max = h.length;
    rows.forEach(r => {
      const cellVal = r[i] && (r[i] as any).v !== undefined ? String((r[i] as any).v) : "";
      if (cellVal.length > max) {
        max = cellVal.length;
      }
    });
    return { wch: max + 3 };
  });

  for (let R = 1; R <= range.e.r; ++R) {
    const cellRef = XLSX.utils.encode_cell({ r: R, c: 13 }); // OBS (coluna N)
    if (ws[cellRef]) {
      ws[cellRef].s = {
        fill: {
          patternType: "solid",
          fgColor: { rgb: "FFFF00" } // Amarelo
        },
        font: {
          color: { rgb: "000000" },
          bold: true
        }
      };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Faturamento Cliente");
  XLSX.writeFile(wb, `faturamento_${cliente.nome.replace(/\s/g, "_")}.xlsx`);
};

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className="w-full justify-between text-xs h-8 font-normal mt-1">
          {selected ? selected.label : (placeholder || "Selecionar...")}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder || "Buscar..."} />
          <CommandList>
            <CommandEmpty>{emptyText || "Nenhum resultado"}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="todos" onSelect={() => { onChange("todos"); setOpen(false); }}>
                <Check className={cn("mr-2 h-3 w-3", value === "todos" ? "opacity-100" : "opacity-0")} />
                Todos
              </CommandItem>
              {options.map(o => (
                <CommandItem key={o.value} value={o.value} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("mr-2 h-3 w-3", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const generateRelatorioPrestadoresPDF = async (
  linhas: PrestadorLinha[],
  prestadorNome: string,
  dataInicio: string,
  dataFim: string,
  resumo: { totalOps: number; valorBruto: number; valorPago: number; saldoPendente: number; mediaEntrega: number },
  prestadorInfo?: { cpfCnpj: string; tipo: string }
) => {
  const dataFormatada = linhas.map(l => {
    const md = l.metadata?.financeiroPrestador || {};
    const pTotals = l.metadata?.totals?.prestador || {};
    const base = Number(l.valorBasePrestador || 0);
    const km = Number(md.kmExcedente || 0);
    const espera = Number(md.espera || 0);
    const pedagio = Number(md.pedagio || 0);
    const reemb = Number(md.valorReembolsoOutros || 0);
    const desc = Number(md.descontos || 0);
    const liquido = Number(l.valorPrestador || pTotals.total || (base + km + espera + pedagio + reemb - desc));

    return {
      data_finalizacao: l.dataColeta,
      numero: l.os,
      veiculo_tipo: l.tipoVeiculo,
      enderecos: [{ cidade: l.origem }, { cidade: l.destino }],
      custo_prestador: base,
      valorBasePrestador: base,
      adicionais: 0,
      descontos: desc,
      valor_final_repasse: liquido,
      status_pagamento: "pago",
      metadata: l.metadata
    };
  });

  const filtrosFake = {
    prestador: prestadorNome || "Todos (Geral)",
    dataInicial: dataInicio,
    dataFinal: dataFim
  };

  const resumoFake = {
    totalRepasses: resumo.valorPago,
    qtdOperacoes: linhas.length,
    mediaOperacional: linhas.length > 0 ? (resumo.valorPago / linhas.length) : 0,
    pendencias: resumo.saldoPendente || 0,
    valorAprovado: resumo.valorPago
  };

  await gerarPDFRepassePrestador(
    dataFormatada,
    filtrosFake,
    resumoFake,
    "Administrador"
  );
};

export default function RelatoriosEnterprise() {
  const [view, setView] = useState("extrato");
  const [filtros, setFiltros] = useState({
    dataInicio: "",
    dataFim: "",
    cliente: "todos",
    prestador: "todos",
    status: "todos"
  });
  const [filtrosPrestador, setFiltrosPrestador] = useState({
    prestadorId: "todos",
    clienteId: "todos",
    dataInicio: "",
    dataFim: "",
    tipoOperacao: "todos",
    statusFinanceiro: "todos",
  });
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

  const [relatorioOS, setRelatorioOS] = useState<OS[]>([]);
  const [relatorioClientes, setRelatorioClientes] = useState<Cliente[]>([]);
  const [relatorioPrestadores, setRelatorioPrestadores] = useState<Prestador[]>([]);
  const [prestadoresLinhas, setPrestadoresLinhas] = useState<PrestadorLinha[]>([]);
  const [prestadoresOps, setPrestadoresOps] = useState<any[]>([]);
  const [clientesOptions, setClientesOptions] = useState<{ value: string; label: string }[]>([]);
  const [prestadoresOptions, setPrestadoresOptions] = useState<{ value: string; label: string }[]>([]);
  const [prestadorNomeMap, setPrestadorNomeMap] = useState<Record<string, string>>({});
  const [loadingPrestadores, setLoadingPrestadores] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [{ data: osData }, { data: escalaData }, { data: cliData }, { data: prestData }, { data: tabelasData }] = await Promise.all([
        supabase.from("ordens_servico").select("*").order("data", { ascending: false }),
        supabase.from("alocacoes_escala").select("*").order("data_escala", { ascending: false }),
        supabase.from("clientes").select("*"),
        supabase.from("prestadores").select("*, veiculos(*)"),
        supabase.from("tabelas_valores").select("*")
      ]);

      const formatOC = (val: any): string => {
        if (!val) return "";
        const str = String(val).trim();
        return str.toUpperCase().startsWith("OC-") ? str.toUpperCase() : `OC-${str.toUpperCase()}`;
      };

      const formatVeiculo = (val: string) => {
        if (!val) return "-";
        if (val.toLowerCase() === "vuc") return "VUC";
        if (val.toLowerCase() === "hr") return "HR";
        return val.replace(/_/g, ' ').split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
      };

      const getTipoVeiculoFaturamentoCliente = (o: any) => {
        const getTermica = (t: any) => {
          const term = t?.exigencia_termica || t?.classificacao_termica || t?.classificacaoTermica;
          return term && term !== 'N/A' && term !== 'Nenhuma' ? ` ${term}` : '';
        };
        
        const tabT1 = o.metadata?.tabelaValores;
        const tabT2 = o.metadata?.totals?.cliente?.tabela;
        const tabT3 = o.metadata?.faturamento;
        
        const tabelaId = o.metadata?.faturamento?.tabela_id || o.metadata?.tabela_id || o.metadata?.tabelaId || tabT1?.id || tabT2?.id || tabT3?.id;
        const tabelaBanco = tabelasData?.find((t: any) => String(t.id) === String(tabelaId));

        let tipoTabela = null;
        if (tabT1?.tipo_veiculo) tipoTabela = tabT1.tipo_veiculo + getTermica(tabT1);
        else if (tabT2?.tipo_veiculo) tipoTabela = tabT2.tipo_veiculo + getTermica(tabT2);
        else if (tabT3?.tipo_veiculo) tipoTabela = tabT3.tipo_veiculo + getTermica(tabT3);
        else if (tabelaBanco?.tipo_veiculo) tipoTabela = tabelaBanco.tipo_veiculo + getTermica(tabelaBanco);
        
        // Em vez de retornar VUC ou nome da tabela, retorna o tipo exato
        const finalTipo = tipoTabela || "-";
        
        if (String(o.cliente_nome || o.cliente || "").toUpperCase().includes("DVL")) {
          console.log("=== AUDITORIA TIPO VEICULO DVL ===");
          console.log("1. metadata.tabelaValores:", tabT1);
          console.log("2. metadata.totals.cliente.tabela:", tabT2);
          console.log("3. metadata.faturamento:", tabT3);
          console.log("4. FINAL ENVIADO PARA EXCEL (tipoVeiculo):", finalTipo, formatVeiculo(finalTipo));
        }
        
        return formatVeiculo(finalTipo);
      };

      const fmtdOS: OS[] = (osData || []).map(o => {
         const margem = (o.valor_cliente || 0) - (o.custo_prestador || 0);
         const margemPct = o.valor_cliente > 0 ? (margem / o.valor_cliente) * 100 : 0;
         return {
           id: o.id,
           numero: formatOC(o.numero),
           data: o.data || "",
           cliente: cliData?.find((c: any) => c.id === o.cliente_id)?.nome_fantasia || o.cliente || "Avulso",
           prestador: prestData?.find((p: any) => p.id === o.prestador_id)?.nome_completo || o.prestador || "Não alocado",
           origem: o.enderecos?.[0]?.cidade || "N/A",
           destino: o.enderecos?.[o.enderecos.length-1]?.cidade || "N/A",
           status: o.status || "Pendente",
           valorCliente: o.metadata?.totals?.cliente?.total || o.valor_cliente || 0,
           custoPrestador: o.metadata?.totals?.prestador?.total || o.custo_prestador || 0,
           basePrestador: o.metadata?.totals?.prestador?.valorBase || o.custo_prestador || 0,
           margem: margem,
           margemPct: margemPct,
           placa: (() => {
             if (o.veiculo_placa) return o.veiculo_placa;
             if (o.placa) return o.placa;
             if (o.metadata?.veiculo?.placa) return o.metadata.veiculo.placa;
             if (o.metadata?.placa) return o.metadata.placa;
             
             const pData = prestData?.find((p: any) => String(p.id) === String(o.prestador_id));
             if (pData?.veiculos && pData.veiculos.length > 0) {
               const activeV = pData.veiculos.find((v: any) => v.status === 'ativo' || v.principal);
               return activeV ? activeV.placa : pData.veiculos[0].placa;
             }
             return "-";
           })(),
           tipoVeiculo: getTipoVeiculoFaturamentoCliente(o),
           metadata: o.metadata || null,
           horarioChegada: o.tempo_chegada_patio || o.tempoChegadaPatio || "07:45",
           horarioSaida: o.tempo_saida_rua || o.tempoSaidaRua || "08:30",
           diaria: o.valor_base || o.diaria || 400,
           kmTotal: o.km_total || o.kmRodados || 0,
           kmExcedente: o.km_excedente || 0,
           valorKm: o.valor_km || 2.50,
           observacao: o.observacao || o.observacoesGerais || "-",
           obs: o.obs || o.observacao_torre || "-",
           numeroOc: formatOC(o.numero_oc || o.numero || "")
         };
      });

      const fmtdEscala: OS[] = (escalaData || []).map(o => {
         const valorFrete = o.metadata?.totals?.cliente?.total || o.valor_frete || o.valor_fixo || 0;
         const valorRepasse = o.metadata?.totals?.prestador?.total || o.valor_repasse || o.valor_fixo || 0;
         const margem = valorFrete - valorRepasse;
         const margemPct = valorFrete > 0 ? (margem / valorFrete) * 100 : 0;
         
         const baseData = o.data_escala || o.created_at || "";
         const dtString = baseData.includes('T') ? baseData.split('T')[0] : baseData;
         const shortId = `OC-${dtString.replace(/-/g, '')}-${String(o.id).substring(0, 4).toUpperCase()}`;
         const finalNumero = formatOC(o.metadata?.numeroOC || shortId);

         let safeData = baseData;
         if (safeData && !safeData.includes('T') && safeData.length === 10) {
            safeData = `${safeData}T12:00:00`;
         }

         return {
           id: o.id,
           numero: finalNumero,
           data: safeData,
           cliente: cliData?.find((c: any) => String(c.id) === String(o.cliente_id))?.nome_fantasia || o.cliente_nome || "Avulso",
           prestador: prestData?.find((p: any) => String(p.id) === String(o.prestador_id))?.nome_completo || o.prestador_nome || "Não alocado",
           origem: "Base",
           destino: "Rota",
           status: o.status || "Pendente",
           valorCliente: valorFrete,
           custoPrestador: valorRepasse,
           basePrestador: o.metadata?.totals?.prestador?.valorBase || o.valor_repasse || o.valor_fixo || 0,
           margem: margem,
           margemPct: margemPct,
           placa: (() => {
             if (o.veiculo_placa) return o.veiculo_placa;
             if (o.placa) return o.placa;
             if (o.metadata?.veiculo?.placa) return o.metadata.veiculo.placa;
             if (o.metadata?.placa) return o.metadata.placa;
             
             const pData = prestData?.find((p: any) => String(p.id) === String(o.prestador_id));
             if (pData?.veiculos && pData.veiculos.length > 0) {
               const activeV = pData.veiculos.find((v: any) => v.status === 'ativo' || v.principal);
               return activeV ? activeV.placa : pData.veiculos[0].placa;
             }
             return "-";
           })(),
           tipoVeiculo: getTipoVeiculoFaturamentoCliente(o),
           metadata: o.metadata || null,
           horarioChegada: o.metadata?.tempoChegadaPatio || o.tempo_chegada_patio || "07:45",
           horarioSaida: o.metadata?.tempoSaidaRua || o.tempo_saida_rua || "09:15",
           diaria: o.metadata?.totals?.cliente?.valorBase || o.valor_fixo || 0,
           kmTotal: o.km_realizados || o.km_total || 0,
           kmExcedente: o.metadata?.totals?.cliente?.detalhes?.km?.excedente || o.km_excedente || 0,
           valorKm: o.metadata?.totals?.cliente?.detalhes?.km?.valorKm || o.valor_km || 0,
           observacao: o.metadata?.instrucoesPrestador || o.observacoes || "-",
           obs: o.metadata?.observacaoCliente || "-",
           numeroOc: finalNumero
         };
      });

      console.log("[DEBUG] loadData() fmtdEscala mapeado:", fmtdEscala.length, "registros", fmtdEscala);

      const allOS = [...fmtdOS, ...fmtdEscala].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
      console.log("[DEBUG] allOS consolidado:", allOS.length, "registros", allOS);
      setRelatorioOS(allOS);

      const fmtdCli: Cliente[] = (cliData || []).map((c: any) => {
         const ops = allOS.filter(o => o.cliente === c.nome_fantasia || o.cliente === c.razao_social || String(c.id) === o.cliente);
         return {
            id: c.id,
            nome: c.nome_fantasia || c.razao_social || "",
            cnpj: c.cnpj || "",
            totalFaturado: ops.reduce((sum, o) => sum + o.valorCliente, 0),
            diarias: ops.filter(o => o.diaria && o.diaria > 0).length,
            contratosFixos: 0,
            operacoes: ops
         };
      });

      setRelatorioClientes(fmtdCli);

      const fmtdPrest: Prestador[] = (prestData || []).map((p: any) => {
         const ops = allOS.filter(o => o.prestador === p.nome_completo);
         return {
            id: p.id,
            nome: p.nome_completo || "",
            cpfCnpj: p.cpf_cnpj || "",
            tipo: p.tipo_parceiro || "Agregado",
            totalOperacoes: ops.length,
            valorPago: ops.reduce((sum, o) => sum + o.custoPrestador, 0),
            operacoes: ops
         };
      });
      setRelatorioPrestadores(fmtdPrest);

      const cliOpts = fmtdCli
        .filter(c => c.nome)
        .map(c => ({ value: String(c.id), label: c.nome }));
      setClientesOptions(cliOpts);

      const prestOpts = (prestData || [])
        .filter(p => p.nome_completo)
        .map(p => ({ value: String(p.id), label: p.nome_completo }));
      setPrestadoresOptions(prestOpts);

      const nomeMap: Record<string, string> = {};
      (prestData || []).forEach(p => { if (p.id) nomeMap[String(p.id)] = p.nome_completo || ""; });
      setPrestadorNomeMap(nomeMap);
    }
    loadData();
  }, []);

  useEffect(() => {
    function loadPrestadoresDetalhes() {
      setLoadingPrestadores(true);
      try {
        if (!relatorioOS || relatorioOS.length === 0) {
          setPrestadoresLinhas([]);
          setLoadingPrestadores(false);
          return;
        }

        let ops = relatorioOS;

        console.log("[DEBUG] loadPrestadoresDetalhes() relatorioOS base:", ops.length, "registros", ops);

        if (filtrosPrestador.dataInicio) {
          ops = ops.filter(o => {
            const dateStr = o.data ? o.data.split('T')[0] : "";
            return dateStr >= filtrosPrestador.dataInicio;
          });
        }
        if (filtrosPrestador.dataFim) {
          ops = ops.filter(o => {
            const dateStr = o.data ? o.data.split('T')[0] : "";
            return dateStr <= filtrosPrestador.dataFim;
          });
        }

        console.log("[DEBUG] loadPrestadoresDetalhes() após filtro de datas:", ops.length, "registros");

        if (filtrosPrestador.prestadorId !== "todos") {
           const nomePrestadorSelecionado = prestadorNomeMap[filtrosPrestador.prestadorId];
           ops = ops.filter(o => {
             return String(o.prestador) === String(filtrosPrestador.prestadorId) || 
                    String(o.prestador) === nomePrestadorSelecionado;
           });
           console.log("[DEBUG] loadPrestadoresDetalhes() após filtro de prestador (ID:", filtrosPrestador.prestadorId, "Nome:", nomePrestadorSelecionado, "):", ops.length, "registros");
        }

        if (filtrosPrestador.clienteId !== "todos") {
           const nomeClienteMap = clientesOptions.find(c => String(c.value) === String(filtrosPrestador.clienteId))?.label;
           ops = ops.filter(o => {
              return String(o.cliente) === String(filtrosPrestador.clienteId) ||
                     String(o.cliente) === nomeClienteMap;
           });
           console.log("[DEBUG] loadPrestadoresDetalhes() após filtro de cliente:", ops.length, "registros");
        }

        if (filtrosPrestador.statusFinanceiro !== "todos") {
          ops = ops.filter(o => String(o.status).toLowerCase() === String(filtrosPrestador.statusFinanceiro).toLowerCase());
        }

        console.log("[DEBUG] loadPrestadoresDetalhes() Lista final usada pelo Relatorio Prestadores:", ops.length, "itens", ops);

        setPrestadoresOps(ops);

        const linhas: PrestadorLinha[] = ops.map((o: any) => {
          let cNome = o.cliente;
          const opt = clientesOptions.find(c => String(c.value) === String(o.cliente));
          if (opt) cNome = opt.label;

          return {
            os: o.numero,
            cliente: cNome || "Avulso",
            origem: o.origem || "N/A",
            destino: o.destino || "N/A",
            dataColeta: o.data ? new Date(o.data).toLocaleDateString("pt-BR") : "-",
            dataEntrega: o.data ? new Date(o.data).toLocaleDateString("pt-BR") : "-",
            valorFrete: o.valorCliente || 0,
            valorPrestador: o.custoPrestador || 0,
            valorBasePrestador: o.basePrestador || 0,
            margem: o.margem || 0,
            margemPct: o.margemPct || 0,
            statusFinanceiro: "Pendente",
            tipoVeiculo: o.tipoVeiculo || "-",
            ocorrencia: "",
            metadata: o.metadata,
          };
        });

        setPrestadoresLinhas(linhas);
      } catch (e) {
        console.error("Erro ao carregar detalhes prestadores:", e);
        setPrestadoresLinhas([]);
      }
      setLoadingPrestadores(false);
    }
    loadPrestadoresDetalhes();
  }, [filtrosPrestador, relatorioOS, prestadorNomeMap, clientesOptions]);

  const clientesUnicos = Array.from(new Set(relatorioOS.map(o => o.cliente).filter(Boolean)));
  const prestadoresUnicos = Array.from(new Set(relatorioOS.map(o => o.prestador).filter(Boolean)));
  const statusUnicos = Array.from(new Set(relatorioOS.map(o => o.status).filter(Boolean)));

  const filteredOS = relatorioOS.filter(os => {
    if (filtros.cliente !== "todos" && os.cliente !== filtros.cliente) return false;
    if (filtros.prestador !== "todos" && os.prestador !== filtros.prestador) return false;
    if (filtros.status !== "todos" && os.status !== filtros.status) return false;
    if (filtros.dataInicio && os.data && os.data < filtros.dataInicio) return false;
    if (filtros.dataFim && os.data && os.data > filtros.dataFim) return false;
    return true;
  });

  const totalReceita = filteredOS.reduce((acc, os) => acc + os.valorCliente, 0);
  const totalCusto = filteredOS.reduce((acc, os) => acc + os.custoPrestador, 0);
  const totalMargem = filteredOS.reduce((acc, os) => acc + os.margem, 0);
  const margemMedia = totalReceita > 0 ? (totalMargem / totalReceita) * 100 : 0;

  const scatterData = relatorioOS.map(os => ({
    x: os.custoPrestador,
    y: os.margem,
    z: os.valorCliente,
    nome: os.numero
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios Operacionais</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Análises gerenciais, extrato operacional e exportação PDF corporativo</p>
          </div>
        </div>
      </div>

      <Tabs value={view} onValueChange={setView} className="w-full">
        {/* Tabs underline */}
        <div className="border-b border-border mb-6">
          <TabsList className="h-auto bg-transparent p-0 gap-0">
            <TabsTrigger value="extrato" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5 gap-2">
              <FileText className="w-4 h-4"/>Extrato Operacional
            </TabsTrigger>
            <TabsTrigger value="faturamento" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5 gap-2">
              <Building2 className="w-4 h-4"/>Faturamento Cliente
            </TabsTrigger>
            <TabsTrigger value="margem" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5 gap-2">
              <TrendingUp className="w-4 h-4"/>Margem Operação
            </TabsTrigger>
            <TabsTrigger value="prestadores" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-3 px-5 gap-2">
              <Truck className="w-4 h-4"/>Prestadores
            </TabsTrigger>
          </TabsList>
        </div>

        {/* EXTRATO OPERACIONAL */}
        <TabsContent value="extrato" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filtros
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Data Início</label>
                  <Input type="date" className="mt-1" value={filtros.dataInicio} onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data Fim</label>
                  <Input type="date" className="mt-1" value={filtros.dataFim} onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cliente</label>
                  <Select value={filtros.cliente} onValueChange={(v) => setFiltros({...filtros, cliente: v})}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {clientesUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Prestador</label>
                  <Select value={filtros.prestador} onValueChange={(v) => setFiltros({...filtros, prestador: v})}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {prestadoresUnicos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={filtros.status} onValueChange={(v) => setFiltros({...filtros, status: v})}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {statusUnicos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(filtros.cliente !== "todos" || filtros.prestador !== "todos" || filtros.status !== "todos" || filtros.dataInicio || filtros.dataFim) && (
                <div className="mt-3 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setFiltros({ dataInicio: "", dataFim: "", cliente: "todos", prestador: "todos", status: "todos" })}>
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
              {[
                { label: "Total OS", value: filteredOS.length, color: "text-slate-700" },
                { label: "Receita", value: fmtFin(totalReceita), color: "text-blue-700" },
                { label: "Custo", value: fmtFin(totalCusto), color: "text-red-600" },
                { label: "Margem Média", value: `${margemMedia.toFixed(1)}%`, color: margemMedia >= 0 ? "text-green-600" : "text-red-600" },
              ].map((kpi, i) => (
                <Card key={i} className="border shadow-sm">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">{kpi.label}</p>
                    <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button onClick={async () => await generateExtratoPDF(filteredOS, filtros)} className="gap-2 bg-orange-500 hover:bg-orange-600 ml-4">
              <Download className="w-4 h-4" />
              Gerar PDF
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº OS</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Prestador</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor Cliente</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOS.map((os) => (
                    <TableRow key={os.id}>
                      <TableCell className="font-medium">{os.numero}</TableCell>
                      <TableCell className="text-sm">{os.data ? new Date(os.data).toLocaleDateString("pt-BR") : ""}</TableCell>
                      <TableCell>{os.cliente}</TableCell>
                      <TableCell className="text-sm">{os.prestador}</TableCell>
                      <TableCell className="text-sm">{os.origem}</TableCell>
                      <TableCell className="text-sm">{os.destino}</TableCell>
                      <TableCell>
                        <Badge className={os.status === "Concluída" ? "bg-green-100 text-green-800" : os.status === "Em Andamento" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}>
                          {os.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmtFin(os.valorCliente)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{fmtFin(os.custoPrestador)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-green-600">{fmtFin(os.margem)} ({os.margemPct.toFixed(1)}%)</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* KPI cards — dark mode safe */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total OS</p>
              <p className="text-2xl font-extrabold text-foreground">{filteredOS.length}</p>
              <div className="h-1 w-full bg-blue-500/20 rounded-full mt-1"><div className="h-full bg-blue-500 rounded-full" style={{width:'60%'}}/></div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Receita Total</p>
              <p className="text-2xl font-extrabold text-emerald-500">{fmtFin(totalReceita)}</p>
              <div className="h-1 w-full bg-emerald-500/20 rounded-full mt-1"><div className="h-full bg-emerald-500 rounded-full" style={{width:'80%'}}/></div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custo Total</p>
              <p className="text-2xl font-extrabold text-rose-500">{fmtFin(totalCusto)}</p>
              <div className="h-1 w-full bg-rose-500/20 rounded-full mt-1"><div className="h-full bg-rose-500 rounded-full" style={{width:'65%'}}/></div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm hover:shadow-md transition">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Margem Total</p>
              <p className="text-2xl font-extrabold text-violet-500">{fmtFin(totalMargem)}</p>
              <p className="text-xs text-muted-foreground font-semibold">{margemMedia.toFixed(1)}% de margem</p>
            </div>
          </div>
        </TabsContent>

        {/* FATURAMENTO POR CLIENTE */}
        <TabsContent value="faturamento" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Data Início</label>
                  <Input type="date" className="mt-1" value={filtros.dataInicio}
                    onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data Fim</label>
                  <Input type="date" className="mt-1" value={filtros.dataFim}
                    onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cliente</label>
                  <SearchableSelect
                    options={clientesOptions}
                    value={filtros.cliente}
                    onChange={(v) => setFiltros({...filtros, cliente: v})}
                    placeholder="Selecionar cliente..."
                    searchPlaceholder="Buscar cliente..."
                    emptyText="Nenhum cliente encontrado"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={filtros.status} onValueChange={(v) => setFiltros({...filtros, status: v})}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {statusUnicos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(filtros.cliente !== "todos" || filtros.dataInicio || filtros.dataFim || filtros.status !== "todos") && (
                <div className="mt-3 flex justify-end">
                  <Button variant="outline" size="sm"
                    onClick={() => setFiltros({ dataInicio: "", dataFim: "", cliente: "todos", prestador: "todos", status: "todos" })}>
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {relatorioClientes
            .filter(c => filtros.cliente === "todos" || String(c.id) === filtros.cliente)
            .filter(c => {
              if (!filtros.dataInicio && !filtros.dataFim) return true;
              return c.operacoes.some(os => {
                if (filtros.dataInicio && os.data && os.data < filtros.dataInicio) return false;
                if (filtros.dataFim && os.data && os.data > filtros.dataFim) return false;
                return true;
              });
            })
            .length === 0 && (
              <p className="text-muted-foreground text-sm py-4">Nenhum cliente encontrado com os filtros selecionados.</p>
            )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relatorioClientes
              .filter(c => filtros.cliente === "todos" || String(c.id) === filtros.cliente)
              .map(c => {
                 const opsFiltradas = c.operacoes.filter(os => {
                   if (filtros.dataInicio && os.data && os.data < filtros.dataInicio) return false;
                   if (filtros.dataFim && os.data && os.data > filtros.dataFim) return false;
                   if (filtros.status !== "todos" && os.status !== filtros.status) return false;
                   return true;
                 });
                 return {
                   ...c,
                   operacoes: opsFiltradas,
                   totalFaturado: opsFiltradas.reduce((sum, o) => sum + (o.valorCliente || 0), 0)
                 };
              })
              .filter(c => c.operacoes.length > 0 || (!filtros.dataInicio && !filtros.dataFim))
              .map((cliente) => (
                <div
                  key={cliente.id}
                  className={`bg-card border rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group ${
                    clienteSelecionado?.id === cliente.id
                      ? 'border-primary shadow-md shadow-primary/10'
                      : 'border-border hover:border-primary/40'
                  }`}
                  onClick={() => setClienteSelecionado(cliente)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    {clienteSelecionado?.id === cliente.id && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1" />
                    )}
                  </div>
                  <p className="font-bold text-foreground group-hover:text-primary transition-colors">{cliente.nome}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{cliente.cnpj}</p>
                  <div className="flex items-baseline gap-2 mt-3">
                    <p className="text-xl font-extrabold text-emerald-500">{fmtFin(cliente.totalFaturado)}</p>
                    <span className="text-xs text-muted-foreground">faturado</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{cliente.operacoes.length} operações</p>
                  <div className="mt-2 pt-2 border-t border-border flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Ticket médio:</span>
                    <span className="font-semibold">{cliente.operacoes.length > 0 ? fmtFin(cliente.totalFaturado / cliente.operacoes.length) : "—"}</span>
                  </div>
                </div>
              ))}
          </div>

          {clienteSelecionado && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Detalhes - {clienteSelecionado.nome}</CardTitle>
                <div className="flex gap-2">
                  <Button onClick={() => generateExcelFaturamentoCliente(clienteSelecionado, filtros)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Download className="w-4 h-4" />
                    Gerar Excel Cliente
                  </Button>
                  <Button onClick={async () => await generateFaturamentoPDF(clienteSelecionado, { dataInicio: filtros.dataInicio, dataFim: filtros.dataFim })} className="gap-2 bg-orange-500 hover:bg-orange-600">
                    <Download className="w-4 h-4" />
                    Gerar PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OS</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor Frete</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clienteSelecionado.operacoes.filter(os => {
                      if (filtros.dataInicio && os.data && os.data < filtros.dataInicio) return false;
                      if (filtros.dataFim && os.data && os.data > filtros.dataFim) return false;
                      if (filtros.status !== "todos" && os.status !== filtros.status) return false;
                      return true;
                    }).map((os) => (
                      <TableRow key={os.id}>
                        <TableCell className="font-medium">{os.numero}</TableCell>
                        <TableCell className="text-sm">{os.data ? new Date(os.data).toLocaleDateString("pt-BR") : ""}</TableCell>
                        <TableCell className="text-sm">{os.origem}</TableCell>
                        <TableCell className="text-sm">{os.destino}</TableCell>
                        <TableCell>
                          <Badge className={os.status === "Concluída" ? "bg-green-100 text-green-800" : os.status === "Em Andamento" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}>
                            {os.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmtFin(os.valorCliente)}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{fmtFin(os.custoPrestador)}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{fmtFin(os.margem)}</TableCell>
                        <TableCell className="text-right font-bold">{os.margemPct.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* MARGEM POR OPERAÇÃO */}
        <TabsContent value="margem" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Margem por Operação (Dispersão)</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" dataKey="x" name="Custo" tick={{ fontSize: 10 }} label={{ value: "Custo Prestador (R$)", position: "bottom", fontSize: 10 }} />
                    <YAxis type="number" dataKey="y" name="Margem" tick={{ fontSize: 10 }} label={{ value: "Margem (R$)", angle: -90, position: "left", fontSize: 10 }} />
                    <ZAxis type="number" dataKey="z" range={[50, 400]} name="Receita" />
                    <Tooltip formatter={(value: number, name: string) => fmtFin(value)} contentStyle={{ borderRadius: '8px' }} />
                    <Scatter name="Operações" data={scatterData} fill="#f97316" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Ranking de Clientes por Rentabilidade</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatorioClientes.map((c) => {
                      const ops = relatorioOS.filter(o => o.cliente === c.nome);
                      const receita = ops.reduce((a, o) => a + o.valorCliente, 0);
                      const custo = ops.reduce((a, o) => a + o.custoPrestador, 0);
                      const margem = receita - custo;
                      const pct = receita > 0 ? (margem / receita) * 100 : 0;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="text-right font-mono">{fmtFin(receita)}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">{fmtFin(custo)}</TableCell>
                          <TableCell className="text-right font-mono text-green-600">{fmtFin(margem)}</TableCell>
                          <TableCell className="text-right font-bold">{pct.toFixed(1)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PRESTADORES */}
        <TabsContent value="prestadores" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Prestador</label>
                  <SearchableSelect
                    options={prestadoresOptions}
                    value={filtrosPrestador.prestadorId}
                    onChange={(v) => setFiltrosPrestador({...filtrosPrestador, prestadorId: v})}
                    placeholder="Selecionar prestador..."
                    searchPlaceholder="Buscar por nome..."
                    emptyText="Nenhum prestador encontrado"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cliente</label>
                  <SearchableSelect
                    options={clientesOptions}
                    value={filtrosPrestador.clienteId}
                    onChange={(v) => setFiltrosPrestador({...filtrosPrestador, clienteId: v})}
                    placeholder="Selecionar cliente..."
                    searchPlaceholder="Buscar cliente..."
                    emptyText="Nenhum cliente encontrado"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data Início</label>
                  <Input type="date" className="mt-1 h-8 text-xs"
                    value={filtrosPrestador.dataInicio}
                    onChange={(e) => setFiltrosPrestador({...filtrosPrestador, dataInicio: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data Fim</label>
                  <Input type="date" className="mt-1 h-8 text-xs"
                    value={filtrosPrestador.dataFim}
                    onChange={(e) => setFiltrosPrestador({...filtrosPrestador, dataFim: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tipo Operação</label>
                  <Select value={filtrosPrestador.tipoOperacao}
                    onValueChange={(v) => setFiltrosPrestador({...filtrosPrestador, tipoOperacao: v})}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="entrega">Entrega</SelectItem>
                      <SelectItem value="coleta">Coleta</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="refrigerado">Refrigerado</SelectItem>
                      <SelectItem value="hospitalar">Hospitalar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status Financeiro</label>
                  <Select value={filtrosPrestador.statusFinanceiro}
                    onValueChange={(v) => setFiltrosPrestador({...filtrosPrestador, statusFinanceiro: v})}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => setFiltrosPrestador({
                    prestadorId: "todos", clienteId: "todos", dataInicio: "", dataFim: "",
                    tipoOperacao: "todos", statusFinanceiro: "todos",
                  })}>
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Total Operações", value: prestadoresLinhas.length, color: "text-slate-700", icon: Package },
              { label: "Valor Bruto", value: fmtFin(prestadoresLinhas.reduce((s, l) => s + l.valorFrete, 0)), color: "text-blue-600", icon: DollarSign },
              { label: "Valor Pago", value: fmtFin(prestadoresLinhas.reduce((s, l) => s + l.valorPrestador, 0)), color: "text-emerald-600", icon: CreditCard },
              { label: "Saldo Pendente", value: fmtFin(prestadoresLinhas.filter(l => l.statusFinanceiro === "Pendente" || l.statusFinanceiro.toLowerCase() === "pendente").reduce((s, l) => s + l.valorPrestador, 0)), color: "text-amber-600", icon: Clock },
              { label: "Média/Entrega", value: fmtFin(prestadoresLinhas.length > 0 ? prestadoresLinhas.reduce((s, l) => s + l.valorPrestador, 0) / prestadoresLinhas.length : 0), color: "text-violet-600", icon: TrendingUp },
              { label: "Km Rodado", value: "—", color: "text-muted-foreground", icon: Route },
              { label: "SLA", value: `${prestadoresLinhas.length > 0 ? Math.round(prestadoresLinhas.filter(l => l.statusFinanceiro === "Pago").length / prestadoresLinhas.length * 100) : 0}%`, color: "text-cyan-600", icon: Activity },
            ].map((kpi, i) => (
              <div key={i}
                className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1 shadow-sm hover:shadow-md transition">
                <div className="flex items-center gap-2">
                  <kpi.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                </div>
                <p className={`text-lg font-extrabold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loadingPrestadores ? "Carregando..." : `${prestadoresLinhas.length} operações encontradas`}
            </p>
            <div className="flex items-center gap-2">
              <Button disabled={loadingPrestadores || prestadoresLinhas.length === 0}
                onClick={() => {
                  const prestObj = filtrosPrestador.prestadorId !== "todos"
                    ? relatorioPrestadores.find(p => String(p.id) === String(filtrosPrestador.prestadorId))
                    : undefined;
                  const prestNome = prestObj?.nome || "Todos os Prestadores";
                  
                  const filtrados = prestadoresLinhas.filter(l => {
                    if (filtrosPrestador.statusFinanceiro !== "todos" && l.statusFinanceiro.toLowerCase() !== filtrosPrestador.statusFinanceiro) return false;
                    if (filtrosPrestador.tipoOperacao !== "todos") return false;
                    return true;
                  });

                  if (filtrados.length === 0) {
                    toast.warning("Nenhuma operação encontrada para este prestador e período.");
                    return;
                  }

                  let txt = `*DEMONSTRATIVO DE PAGAMENTO - CONEXÃO EXPRESS*\n`;
                  txt += `*Parceiro:* ${prestNome}\n`;
                  if (filtrosPrestador.dataInicio && filtrosPrestador.dataFim) {
                    txt += `*Período:* ${new Date(filtrosPrestador.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(filtrosPrestador.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}\n`;
                  }
                  
                  let sumBase = 0, sumKm = 0, sumEspera = 0, sumPedagio = 0, sumReemb = 0, sumOutros = 0, sumDesc = 0, sumLiq = 0;

                  let txtDetalhes = `\n*DETALHAMENTO DAS OPERAÇÕES*\n`;
                  filtrados.forEach((l: any) => {
                    const md = l.metadata?.financeiroPrestador || {};
                    const pTotals = l.metadata?.totals?.prestador || {};
                    
                    const base = Number(l.valorBasePrestador || 0);
                    let km = Number(pTotals.detalhes?.km?.valorTotal || md.kmExcedente || 0);
                    const espera = Number(pTotals.detalhes?.espera?.valorTotal || md.espera || 0);
                    const pedagio = Number(md.pedagio || 0);
                    const reemb = Number(md.valorReembolsoOutros || 0);
                    const desc = Number(md.descontos || 0);
                    const liquido = Number(l.valorPrestador || pTotals.total || (base + km + espera + pedagio + reemb - desc));

                    const calcLiquido = base + km + espera + pedagio + reemb - desc;
                    const diff = liquido - calcLiquido;
                    
                    let outros = 0;
                    if (diff > 0.01) {
                      const hasKmIndication = md.kmExcedente || md.km_excedente || md.valorKm || pTotals.detalhes?.km || l.metadata?.totals?.cliente?.detalhes?.km;
                      if (hasKmIndication) {
                        km += diff;
                      } else {
                        outros = diff;
                      }
                    }

                    sumBase += base;
                    sumKm += km;
                    sumEspera += espera;
                    sumPedagio += pedagio;
                    sumReemb += reemb;
                    sumOutros += outros;
                    sumDesc += desc;
                    sumLiq += liquido;

                    txtDetalhes += `OC: ${l.os}\n`;
                    txtDetalhes += `Data: ${l.dataColeta}\n`;
                    txtDetalhes += `Rota: ${l.origem} -> ${l.destino}\n`;
                    txtDetalhes += `Diária/Base: ${fmtFin(base)}\n`;
                    if (km > 0) txtDetalhes += `KM adicional: ${fmtFin(km)}\n`;
                    if (espera > 0) txtDetalhes += `Espera: ${fmtFin(espera)}\n`;
                    const pedReemb = pedagio + reemb;
                    if (pedReemb > 0) txtDetalhes += `Pedágio/Reembolso: ${fmtFin(pedReemb)}\n`;
                    if (outros > 0) txtDetalhes += `Outros adicionais: ${fmtFin(outros)}\n`;
                    if (desc > 0) txtDetalhes += `Descontos: ${fmtFin(desc)}\n`;
                    txtDetalhes += `Líquido: ${fmtFin(liquido)}\n`;
                    txtDetalhes += `------------------------\n`;
                  });
                  
                  txt += `\n*RESUMO DO PERÍODO*\n`;
                  txt += `Operações: ${filtrados.length}\n`;
                  txt += `Valor base: ${fmtFin(sumBase)}\n`;
                  if (sumKm > 0) txt += `KM adicional: ${fmtFin(sumKm)}\n`;
                  if (sumEspera > 0) txt += `Espera: ${fmtFin(sumEspera)}\n`;
                  const sumPedReemb = sumPedagio + sumReemb;
                  if (sumPedReemb > 0) txt += `Pedágios/Reembolsos: ${fmtFin(sumPedReemb)}\n`;
                  if (sumOutros > 0) txt += `Outros adicionais: ${fmtFin(sumOutros)}\n`;
                  if (sumDesc > 0) txt += `Descontos: ${fmtFin(sumDesc)}\n`;
                  txt += `Total líquido a receber: ${fmtFin(sumLiq)}\n`;
                  
                  txt += txtDetalhes;
                  
                  txt += `\n_Documento gerado pelo sistema Conexão Express_`;
                  
                  navigator.clipboard.writeText(txt).then(() => {
                    toast.success("Resumo copiado para o WhatsApp com sucesso!");
                  }).catch(() => {
                    toast.error("Falha ao copiar resumo.");
                  });
                }}
                className="gap-2 bg-emerald-500 hover:bg-emerald-600">
                Copiar WhatsApp
              </Button>
              <Button disabled={loadingPrestadores || prestadoresLinhas.length === 0}
                onClick={async () => {
                  const prestObj = filtrosPrestador.prestadorId !== "todos"
                    ? relatorioPrestadores.find(p => String(p.id) === String(filtrosPrestador.prestadorId))
                    : undefined;
                  const prestNome = prestObj?.nome || "";
                    
                  const filtrados = prestadoresLinhas.filter(l => {
                    if (filtrosPrestador.statusFinanceiro !== "todos" && l.statusFinanceiro.toLowerCase() !== filtrosPrestador.statusFinanceiro) return false;
                    if (filtrosPrestador.tipoOperacao !== "todos") return false;
                    return true;
                  });

                  if (filtrados.length === 0) {
                    toast.warning("Nenhuma operação encontrada para este prestador e período.");
                    return;
                  }

                  const totalOps = filtrados.length;
                  const valorBruto = filtrados.reduce((s, l) => s + l.valorFrete, 0);
                  const valorPago = filtrados.reduce((s, l) => s + l.valorPrestador, 0);
                  
                  await generateRelatorioPrestadoresPDF(
                    filtrados,
                    prestNome,
                    filtrosPrestador.dataInicio,
                    filtrosPrestador.dataFim,
                    {
                      totalOps,
                      valorBruto,
                      valorPago,
                      saldoPendente: filtrados.filter(l => l.statusFinanceiro === "Pendente").reduce((s, l) => s + l.valorFrete, 0),
                      mediaEntrega: totalOps > 0 ? valorPago / totalOps : 0,
                    },
                    prestObj ? { cpfCnpj: prestObj.cpfCnpj, tipo: prestObj.tipo } : undefined
                  );
                }}
                className="gap-2 bg-orange-500 hover:bg-orange-600">
                <Download className="w-4 h-4" />
                Gerar PDF
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-semibold text-xs uppercase">OS</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Cliente</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Origem</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Destino</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Data Coleta</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Data Entrega</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-right">Valor Frete</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-right">Valor Prest.</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-right">Margem</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Status Fin.</TableHead>
                    <TableHead className="font-semibold text-xs uppercase">Tipo Veículo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPrestadores ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : prestadoresLinhas.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhum dado encontrado. Aplique os filtros.</TableCell></TableRow>
                  ) : (
                    prestadoresLinhas
                      .filter(l => {
                        if (filtrosPrestador.statusFinanceiro !== "todos" && l.statusFinanceiro.toLowerCase() !== filtrosPrestador.statusFinanceiro) return false;
                        if (filtrosPrestador.tipoOperacao !== "todos") {
                          const veiculo = l.tipoVeiculo.toLowerCase();
                          const op = filtrosPrestador.tipoOperacao;
                          if (op === "refrigerado" && !veiculo.includes("refrigerado")) return false;
                          if (op === "hospitalar" && !veiculo.includes("hospitalar")) return false;
                        }
                        return true;
                      })
                      .map((l, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/40 transition-colors even:bg-muted/20">
                          <TableCell className="text-xs font-medium">{l.os}</TableCell>
                          <TableCell className="text-xs">{l.cliente}</TableCell>
                          <TableCell className="text-xs">{l.origem}</TableCell>
                          <TableCell className="text-xs">{l.destino}</TableCell>
                          <TableCell className="text-xs">{l.dataColeta}</TableCell>
                          <TableCell className="text-xs">{l.dataEntrega}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{fmtFin(l.valorFrete)}</TableCell>
                          <TableCell className="text-xs text-right font-mono text-red-600">{fmtFin(l.valorPrestador)}</TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            <span className={l.margem >= 0 ? "text-green-600" : "text-red-600"}>
                              {l.margemPct >= 0 ? `${l.margemPct.toFixed(1)}%` : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline"
                              className={`text-[10px] ${
                                l.statusFinanceiro === "Pago" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                l.statusFinanceiro === "Parcial" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                "bg-red-50 text-red-700 border-red-200"
                              }`}>
                              {l.statusFinanceiro}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{l.tipoVeiculo}</TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
