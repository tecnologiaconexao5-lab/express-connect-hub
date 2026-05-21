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
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  buscarDadosPagamentoPrestador,
  buscarClientesAtivos,
  type FiltrosPagamento,
} from "@/services/relatorios/relatorioService";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  ocorrencia: string;
}

const carregarLogoBase64 = async (): Promise<string | null> => {
  try {
    const response = await fetch('/logo-oficial-conexao.png');
    if (response.ok) {
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn("Logo não encontrado:", e);
  }
  return null;
};

const generateExtratoPDF = async (data: OS[], filtros: any) => {
  const doc = new jsPDF();
  const logo = await carregarLogoBase64();
  
  doc.setFillColor(15, 26, 46);
  doc.rect(0, 0, 220, 30, "F");
  
  doc.setTextColor(255, 255, 255);
  
  if (logo) {
    doc.addImage(logo, "PNG", 14, 8, 36, 12);
  } else {
    doc.setFontSize(20);
    doc.text("CONEXÃO EXPRESS", 14, 18);
  }
  
  doc.setFontSize(12);
  doc.text("EXTRATO OPERACIONAL", 14, 26);
  
  doc.setTextColor(100);
  doc.setFontSize(9);
  doc.text(`Data de emissão: ${new Date().toLocaleDateString("pt-BR")}`, 14, 38);
  
  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.5);
  doc.line(14, 42, 196, 42);
  
  doc.setTextColor(60);
  doc.setFontSize(10);
  doc.text("Filtros Aplicados:", 14, 50);
  doc.setFontSize(9);
  if (filtros.cliente && filtros.cliente !== "todos") doc.text(`• Cliente: ${filtros.cliente}`, 14, 56);
  if (filtros.prestador && filtros.prestador !== "todos") doc.text(`• Prestador: ${filtros.prestador}`, 14, 62);
  if (filtros.status && filtros.status !== "todos") doc.text(`• Status: ${filtros.status}`, 14, 68);
  if (filtros.dataInicio && filtros.dataFim) doc.text(`• Período: ${filtros.dataInicio} a ${filtros.dataFim}`, 14, 74);

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
    startY: 80,
    head: [["OS", "Data", "Cliente", "Prestador", "Origem", "Destino", "Status", "Valor", "Custo", "Margem"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [15, 26, 46], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 18 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 18 },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 15, halign: "right" },
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  const totalReceita = data.reduce((acc, os) => acc + os.valorCliente, 0);
  const totalCusto = data.reduce((acc, os) => acc + os.custoPrestador, 0);
  const totalMargem = data.reduce((acc, os) => acc + os.margem, 0);
  const margemMedia = (totalMargem / totalReceita) * 100;

  doc.setFillColor(249, 250, 251);
  doc.rect(14, finalY, 182, 25, "F");
  
  doc.setFontSize(10);
  doc.setTextColor(15, 26, 46);
  doc.text("TOTAIS", 18, finalY + 8);
  
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Total de OS: ${data.length}`, 18, finalY + 15);
  doc.text(`Receita Total: ${fmtFin(totalReceita)}`, 18, finalY + 21);
  doc.text(`Custo Total: ${fmtFin(totalCusto)}`, 80, finalY + 15);
  doc.text(`Margem Total: ${fmtFin(totalMargem)}`, 80, finalY + 21);
  doc.setTextColor(22, 163, 74);
  doc.text(`Margem Média: ${margemMedia.toFixed(1)}%`, 140, finalY + 18);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Documento gerado automaticamente pelo Sistema Conexão Express", 105, 285, { align: "center" });

  doc.save("extrato_operacional.pdf");
};

const generateFaturamentoPDF = async (cliente: Cliente) => {
  const doc = new jsPDF();
  const logo = await carregarLogoBase64();
  
  // Top orange border (Conexão Express primary accent color)
  doc.setFillColor(249, 115, 22); // Orange
  doc.rect(0, 0, 220, 4, "F");
  
  // Render logo or fallback text
  if (logo) {
    doc.addImage(logo, "PNG", 14, 10, 45, 15);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 26, 46); // Navy
    doc.setFontSize(16);
    doc.text("CONEXÃO EXPRESS", 14, 20);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("TRANSPORTES & LOGÍSTICA", 14, 24);
  }
  
  // Document title and metadata
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 26, 46);
  doc.setFontSize(14);
  doc.text("FATURAMENTO ENTERPRISE", 115, 20, { align: "left" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.setFontSize(8.5);
  doc.text(`Data de Emissão: ${new Date().toLocaleDateString("pt-BR")}`, 115, 25);
  doc.text(`Período de Referência: Mensal / Fechamento`, 115, 29);
  
  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 34, 196, 34);
  
  // Customer details block (Premium Card Style)
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 40, 90, 36, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, 40, 90, 36, "S");
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 26, 46);
  doc.setFontSize(9.5);
  doc.text("DADOS DO CLIENTE", 18, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Razão Social: ${cliente.nome}`, 18, 53);
  doc.text(`CNPJ: ${cliente.cnpj || "N/A"}`, 18, 60);
  doc.text(`Status de Faturamento: Ativo`, 18, 67);
  
  // Executive summary
  doc.setFillColor(15, 26, 46); // Navy
  doc.rect(110, 40, 86, 36, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("RESUMO FINANCEIRO", 116, 46);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Faturamento Bruto: ${fmtFin(cliente.totalFaturado)}`, 116, 53);
  doc.text(`Operações Faturadas: ${cliente.operacoes.length}`, 116, 60);
  doc.text(`Custo Operacional: ${fmtFin(cliente.operacoes.reduce((sum, o) => sum + o.custoPrestador, 0))}`, 116, 67);
  
  // Table operations mapping
  const tableData = cliente.operacoes.map(os => {
    const diaria = os.diaria ?? 400;
    const kmTotal = os.kmTotal ?? 0;
    const kmFranquia = 200;
    const kmExcedente = Math.max(kmTotal - kmFranquia, 0);
    const vlrKm = os.valorKm ?? 2.50;
    const vlrTotal = diaria + (kmExcedente * vlrKm);
    
    return [
      os.numero,
      os.data ? new Date(os.data).toLocaleDateString("pt-BR") : "",
      os.origem,
      os.destino,
      os.prestador,
      os.placa || "-",
      `${kmTotal} km`,
      fmtFin(diaria),
      fmtFin(vlrTotal)
    ];
  });
  
  // Elegante table layout
  autoTable(doc, {
    startY: 82,
    head: [["OS", "Data", "Origem", "Destino", "Motorista", "Placa", "KM", "Diária", "Total"]],
    body: tableData,
    theme: "striped",
    headStyles: { 
      fillColor: [15, 26, 46], 
      textColor: 255, 
      fontSize: 8.5, 
      fontStyle: "bold",
      halign: "left"
    },
    bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
    columnStyles: {
      6: { halign: "center" },
      7: { halign: "right" },
      8: { halign: "right" }
    }
  });
  
  let finalY = (doc as any).lastAutoTable.finalY + 10;
  
  // If we run out of vertical space, push to next page
  if (finalY > 230) {
    doc.addPage();
    finalY = 20;
  }
  
  // Totals card
  const totalCustoVal = cliente.operacoes.reduce((sum, o) => sum + o.custoPrestador, 0);
  const totalReceitaVal = cliente.totalFaturado;
  const totalMargemVal = totalReceitaVal - totalCustoVal;
  const margemValPct = totalReceitaVal > 0 ? (totalMargemVal / totalReceitaVal) * 100 : 0;
  
  doc.setFillColor(248, 250, 252);
  doc.rect(14, finalY, 182, 22, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, finalY, 182, 22, "S");
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 26, 46);
  doc.setFontSize(9);
  doc.text("CONSOLIDAÇÃO DE VALORES", 18, finalY + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Receita Total: ${fmtFin(totalReceitaVal)}`, 18, finalY + 14);
  doc.text(`Repasse Parceiro: ${fmtFin(totalCustoVal)}`, 80, finalY + 14);
  doc.text(`Resultado Conexão: ${fmtFin(totalMargemVal)} (${margemValPct.toFixed(1)}%)`, 140, finalY + 14);
  
  finalY += 32;
  
  // Signatures
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  
  doc.line(14, finalY + 10, 90, finalY + 10);
  doc.text("Assinatura Faturador Operacional", 52, finalY + 15, { align: "center" });
  doc.text("Conexão Express Transportes", 52, finalY + 19, { align: "center" });
  
  doc.line(110, finalY + 10, 196, finalY + 10);
  doc.text("Assinatura Gestor Responsável", 153, finalY + 15, { align: "center" });
  doc.text(cliente.nome, 153, finalY + 19, { align: "center" });
  
  // Footer text
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Este relatório operacional serve como instrumento para conciliação financeira de faturamento consolidado.", 105, 282, { align: "center" });
  
  doc.save(`faturamento_${cliente.nome.replace(/\s/g, "_")}.pdf`);
};

const generateExcelFaturamentoCliente = (cliente: Cliente) => {
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

  const rows = cliente.operacoes.map(os => {
    const diaria = os.diaria ?? 400;
    const kmTotal = os.kmTotal ?? 0;
    const kmFranquia = 200; // padrão
    const kmExcedente = Math.max(kmTotal - kmFranquia, 0);
    const vlrKm = os.valorKm ?? 2.50;
    const vlrTotal = diaria + (kmExcedente * vlrKm);

    return [
      { v: os.data ? new Date(os.data).toLocaleDateString("pt-BR") : "", t: 's' },
      { v: os.prestador || "", t: 's' },
      { v: os.placa || "", t: 's' },
      { v: os.tipoVeiculo || "", t: 's' },
      { v: os.observacao || "", t: 's' },
      { v: os.horarioChegada || "", t: 's' },
      { v: os.horarioSaida || "", t: 's' },
      { v: diaria, t: 'n', z: '"R$"#,##0.00' },
      { v: kmTotal, t: 'n', z: '#,##0' },
      { v: kmExcedente, t: 'n', z: '#,##0' },
      { v: vlrKm, t: 'n', z: '"R$"#,##0.00' },
      { v: vlrTotal, t: 'n', z: '"R$"#,##0.00' },
      { v: os.numeroOc || os.numero || "", t: 's' },
      { v: os.obs || "", t: 's' }
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
  resumo: { totalOps: number; valorBruto: number; valorPago: number; saldoPendente: number; mediaEntrega: number }
) => {
  const doc = new jsPDF();
  const logo = await carregarLogoBase64();

  doc.setFillColor(15, 26, 46);
  doc.rect(0, 0, 210, 35, "F");
  doc.setTextColor(255, 255, 255);
  if (logo) {
    doc.addImage(logo, "PNG", 14, 8, 36, 12);
  } else {
    doc.setFontSize(18);
    doc.text("CONEXÃO EXPRESS", 14, 18);
  }
  doc.setFontSize(10);
  doc.text("RELATÓRIO DE PRESTADORES — PARCEIRO OPERACIONAL", 14, 28);

  doc.setTextColor(100);
  doc.setFontSize(8);
  let y = 42;
  doc.text(`Data de emissão: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 14, y);
  y += 6;
  if (prestadorNome) {
    doc.text(`Prestador: ${prestadorNome}`, 14, y);
    y += 5;
  }
  if (dataInicio && dataFim) {
    doc.text(`Período: ${new Date(dataInicio).toLocaleDateString("pt-BR")} até ${new Date(dataFim).toLocaleDateString("pt-BR")}`, 14, y);
    y += 5;
  }

  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, 196, y + 2);
  y += 6;

  doc.setFillColor(249, 250, 251);
  doc.rect(14, y, 182, 28, "F");
  doc.setFontSize(9);
  doc.setTextColor(15, 26, 46);
  doc.text("RESUMO FINANCEIRO", 18, y + 6);
  doc.setTextColor(80);
  doc.setFontSize(8);
  doc.text(`Total de Operações: ${resumo.totalOps}`, 18, y + 13);
  doc.text(`Valor Bruto (Frete): ${fmtFin(resumo.valorBruto)}`, 18, y + 19);
  doc.text(`Valor Pago ao Prestador: ${fmtFin(resumo.valorPago)}`, 18, y + 25);
  doc.text(`Saldo Pendente: ${fmtFin(resumo.saldoPendente)}`, 110, y + 13);
  doc.text(`Média por Entrega: ${fmtFin(resumo.mediaEntrega)}`, 110, y + 19);

  const tableStart = y + 32;
  const columns = [
    "OS", "Cliente", "Origem", "Destino", "Data Coleta", "Data Entrega",
    "Valor Frete", "Valor Prest.", "Margem", "Status Fin.", "Tipo Veículo"
  ];
  const body = linhas.map(l => [
    l.os, l.cliente, l.origem, l.destino, l.dataColeta, l.dataEntrega,
    fmtFin(l.valorFrete), fmtFin(l.valorPrestador),
    l.margemPct >= 0 ? `${l.margemPct.toFixed(1)}%` : "-",
    l.statusFinanceiro, l.tipoVeiculo
  ]);

  autoTable(doc, {
    startY: tableStart,
    head: [columns],
    body,
    theme: "striped",
    headStyles: { fillColor: [15, 26, 46], textColor: 255, fontSize: 7 },
    bodyStyles: { fontSize: 6.5 },
    styles: { cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 20 },
      2: { cellWidth: 16 },
      3: { cellWidth: 16 },
      4: { cellWidth: 16 },
      5: { cellWidth: 16 },
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 16, halign: "right" },
      8: { cellWidth: 12, halign: "right" },
      9: { cellWidth: 14 },
      10: { cellWidth: 14 },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  doc.setFillColor(15, 26, 46);
  doc.rect(14, finalY, 182, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("TOTALIZADORES", 18, finalY + 5);
  doc.setFontSize(7);
  doc.text(`Total Operações: ${linhas.length}`, 18, finalY + 11);
  doc.text(`Valor Bruto: ${fmtFin(resumo.valorBruto)}`, 60, finalY + 11);
  doc.text(`Valor Pago: ${fmtFin(resumo.valorPago)}`, 105, finalY + 11);
  doc.text(`Saldo Pendente: ${fmtFin(resumo.saldoPendente)}`, 145, finalY + 11);

  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.text(
    "Documento gerado automaticamente pelo Sistema Conexão Express — Relatório de Parceiro Operacional",
    105, 278, { align: "center" }
  );
  doc.text("Este documento não representa vínculo empregatício. O prestador é parceiro operacional autônomo (PJ/MEI).", 105, 283, { align: "center" });

  doc.save(`relatorio_prestador_${prestadorNome ? prestadorNome.replace(/\s/g, "_") : "geral"}.pdf`);
};

const DVL_MOCK_OS: OS[] = [
  {
    id: 90001,
    numero: "OS-DVL-1001",
    data: "2026-05-10",
    cliente: "DVL DISTRIBUIDORA",
    prestador: "Carlos Silva",
    origem: "São Paulo",
    destino: "Guarulhos",
    status: "Finalizado",
    valorCliente: 550.00,
    custoPrestador: 385.00,
    margem: 165.00,
    margemPct: 30.0,
    placa: "ABC-1234",
    tipoVeiculo: "VUC",
    horarioChegada: "07:30",
    horarioSaida: "16:45",
    diaria: 400.00,
    kmTotal: 120,
    kmExcedente: 20,
    valorKm: 2.50,
    observacao: "Entrega de autopeças concluída dentro do SLA.",
    obs: "Comprovante anexado no portal.",
    numeroOc: "OC-2026-001"
  },
  {
    id: 90002,
    numero: "OS-DVL-1002",
    data: "2026-05-11",
    cliente: "DVL DISTRIBUIDORA",
    prestador: "Marcos Oliveira",
    origem: "São Paulo",
    destino: "Campinas",
    status: "Finalizado",
    valorCliente: 750.00,
    custoPrestador: 525.00,
    margem: 225.00,
    margemPct: 30.0,
    placa: "XYZ-9876",
    tipoVeiculo: "Truck",
    horarioChegada: "08:00",
    horarioSaida: "18:30",
    diaria: 500.00,
    kmTotal: 200,
    kmExcedente: 100,
    valorKm: 2.50,
    observacao: "Carga fracionada para centro de distribuição.",
    obs: "Aguardando canhoto assinado.",
    numeroOc: "OC-2026-002"
  },
  {
    id: 90003,
    numero: "OS-DVL-1003",
    data: "2026-05-12",
    cliente: "DVL DISTRIBUIDORA",
    prestador: "Jose Santos",
    origem: "São Bernardo",
    destino: "Santos",
    status: "Finalizado",
    valorCliente: 620.00,
    custoPrestador: 434.00,
    margem: 186.00,
    margemPct: 30.0,
    placa: "MNO-4567",
    tipoVeiculo: "Toco",
    horarioChegada: "07:15",
    horarioSaida: "16:00",
    diaria: 450.00,
    kmTotal: 168,
    kmExcedente: 68,
    valorKm: 2.50,
    observacao: "Entrega de paletes no porto sem filas.",
    obs: "Tudo certo.",
    numeroOc: "OC-2026-003"
  },
  {
    id: 90004,
    numero: "OS-DVL-1004",
    data: "2026-05-13",
    cliente: "DVL DISTRIBUIDORA",
    prestador: "Rogerio Lima",
    origem: "São Paulo",
    destino: "Sorocaba",
    status: "Finalizado",
    valorCliente: 680.00,
    custoPrestador: 476.00,
    margem: 204.00,
    margemPct: 30.0,
    placa: "DEF-5678",
    tipoVeiculo: "VUC",
    horarioChegada: "08:30",
    horarioSaida: "17:15",
    diaria: 400.00,
    kmTotal: 212,
    kmExcedente: 112,
    valorKm: 2.50,
    observacao: "Carga urgente de componentes eletrônicos.",
    obs: "Entrega prioritária realizada.",
    numeroOc: "OC-2026-004"
  },
  {
    id: 90005,
    numero: "OS-DVL-1005",
    data: "2026-05-14",
    cliente: "DVL DISTRIBUIDORA",
    prestador: "Andre Souza",
    origem: "São Paulo",
    destino: "Jundiaí",
    status: "Finalizado",
    valorCliente: 500.00,
    custoPrestador: 350.00,
    margem: 150.00,
    margemPct: 30.0,
    placa: "GHI-9012",
    tipoVeiculo: "Fiorino",
    horarioChegada: "07:45",
    horarioSaida: "15:30",
    diaria: 350.00,
    kmTotal: 160,
    kmExcedente: 60,
    valorKm: 2.50,
    observacao: "Entrega expressa de embalagens.",
    obs: "Documento digitalizado.",
    numeroOc: "OC-2026-005"
  },
  {
    id: 90006,
    numero: "OS-DVL-1006",
    data: "2026-05-15",
    cliente: "DVL DISTRIBUIDORA",
    prestador: "Carlos Silva",
    origem: "São Paulo",
    destino: "São José dos Campos",
    status: "Finalizado",
    valorCliente: 700.00,
    custoPrestador: 490.00,
    margem: 210.00,
    margemPct: 30.0,
    placa: "ABC-1234",
    tipoVeiculo: "VUC",
    horarioChegada: "08:15",
    horarioSaida: "18:00",
    diaria: 400.00,
    kmTotal: 220,
    kmExcedente: 120,
    valorKm: 2.50,
    observacao: "Rota com múltiplos pontos de parada.",
    obs: "Excesso de tempo na segunda entrega.",
    numeroOc: "OC-2026-006"
  },
  {
    id: 90007,
    numero: "OS-DVL-1007",
    data: "2026-05-16",
    cliente: "DVL DISTRIBUIDORA",
    prestador: "Marcos Oliveira",
    origem: "São Paulo",
    destino: "Guarulhos",
    status: "Finalizado",
    valorCliente: 550.00,
    custoPrestador: 385.00,
    margem: 165.00,
    margemPct: 30.0,
    placa: "XYZ-9876",
    tipoVeiculo: "Truck",
    horarioChegada: "07:50",
    horarioSaida: "16:10",
    diaria: 500.00,
    kmTotal: 120,
    kmExcedente: 20,
    valorKm: 2.50,
    observacao: "Coleta reversa de devoluções.",
    obs: "NF de devolução anexada.",
    numeroOc: "OC-2026-007"
  },
  {
    id: 90008,
    numero: "OS-DVL-1008",
    data: "2026-05-17",
    cliente: "DVL DISTRIBUIDORA",
    prestador: "Jose Santos",
    origem: "São Bernardo",
    destino: "Barueri",
    status: "Finalizado",
    valorCliente: 580.00,
    custoPrestador: 406.00,
    margem: 174.00,
    margemPct: 30.0,
    placa: "MNO-4567",
    tipoVeiculo: "Toco",
    horarioChegada: "07:00",
    horarioSaida: "15:45",
    diaria: 450.00,
    kmTotal: 152,
    kmExcedente: 52,
    valorKm: 2.50,
    observacao: "Entrega em condomínio logístico.",
    obs: "SLA cumprido com sucesso.",
    numeroOc: "OC-2026-008"
  },
  {
    id: 90009,
    numero: "OS-DVL-1009",
    data: "2026-05-18",
    cliente: "DVL DISTRIBUIDORA",
    prestador: "Rogerio Lima",
    origem: "São Paulo",
    destino: "Guarujá",
    status: "Finalizado",
    valorCliente: 720.00,
    custoPrestador: 504.00,
    margem: 216.00,
    margemPct: 30.0,
    placa: "DEF-5678",
    tipoVeiculo: "VUC",
    horarioChegada: "08:00",
    horarioSaida: "19:00",
    diaria: 400.00,
    kmTotal: 228,
    kmExcedente: 128,
    valorKm: 2.50,
    observacao: "Faturamento excedente authorized pela torre.",
    obs: "Aprovado pelo gestor DVL.",
    numeroOc: "OC-2026-009"
  },
  {
    id: 90010,
    numero: "OS-DVL-1010",
    data: "2026-05-19",
    cliente: "DVL DISTRIBUIDORA",
    prestador: "Andre Souza",
    origem: "São Paulo",
    destino: "Campinas",
    status: "Finalizado",
    valorCliente: 650.00,
    custoPrestador: 455.00,
    margem: 195.00,
    margemPct: 30.0,
    placa: "GHI-9012",
    tipoVeiculo: "Fiorino",
    horarioChegada: "07:30",
    horarioSaida: "16:20",
    diaria: 350.00,
    kmTotal: 220,
    kmExcedente: 120,
    valorKm: 2.50,
    observacao: "Entrega em distribuidor regional.",
    obs: "Sem divergências.",
    numeroOc: "OC-2026-010"
  }
];

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
      const { data: osData } = await supabase.from("ordens_servico").select("*").order("data", { ascending: false });
      const fmtdOS: OS[] = (osData || []).map(o => {
         const margem = (o.valor_cliente || 0) - (o.custo_prestador || 0);
         const margemPct = o.valor_cliente > 0 ? (margem / o.valor_cliente) * 100 : 0;
         return {
           id: o.id,
           numero: o.numero,
           data: o.data || "",
           cliente: o.cliente || "Avulso",
           prestador: o.prestador || "Não alocado",
           origem: o.enderecos?.[0]?.cidade || "N/A",
           destino: o.enderecos?.[o.enderecos.length-1]?.cidade || "N/A",
           status: o.status || "Pendente",
           valorCliente: o.valor_cliente || 0,
           custoPrestador: o.custo_prestador || 0,
           margem: margem,
           margemPct: margemPct,
           placa: o.veiculo_placa || o.placa || "-",
           tipoVeiculo: o.tipo_veiculo || o.veiculo_tipo || "-",
           horarioChegada: o.tempo_chegada_patio || o.tempoChegadaPatio || "07:45",
           horarioSaida: o.tempo_saida_rua || o.tempoSaidaRua || "08:30",
           diaria: o.valor_base || o.diaria || 400,
           kmTotal: o.km_total || o.kmRodados || 0,
           kmExcedente: o.km_excedente || 0,
           valorKm: o.valor_km || 2.50,
           observacao: o.observacao || o.observacoesGerais || "-",
           obs: o.obs || o.observacao_torre || "-",
           numeroOc: o.numero_oc || o.numero || ""
         };
      });

      const allOS = [...DVL_MOCK_OS, ...fmtdOS];
      setRelatorioOS(allOS);

      const { data: cliData } = await supabase.from("clientes").select("*");
      const fmtdCli: Cliente[] = (cliData || []).map(c => {
         const ops = allOS.filter(o => o.cliente === c.nome_fantasia || o.cliente === c.razao_social);
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

      // Inject DVL Distributor if not present
      if (!fmtdCli.some(c => c.nome.toUpperCase().includes("DVL DISTRIBUIDORA"))) {
        fmtdCli.unshift({
          id: 9999,
          nome: "DVL DISTRIBUIDORA",
          cnpj: "12.345.678/0001-90",
          totalFaturado: DVL_MOCK_OS.reduce((sum, o) => sum + o.valorCliente, 0),
          diarias: 10,
          contratosFixos: 0,
          operacoes: DVL_MOCK_OS
        });
      }
      setRelatorioClientes(fmtdCli);

      const { data: prestData } = await supabase.from("prestadores").select("*");
      const fmtdPrest: Prestador[] = (prestData || []).map(p => {
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
    async function loadPrestadoresDetalhes() {
      setLoadingPrestadores(true);
      try {
        const filtroPag: FiltrosPagamento = {};
        if (filtrosPrestador.dataInicio) filtroPag.dataInicial = filtrosPrestador.dataInicio;
        if (filtrosPrestador.dataFim) filtroPag.dataFinal = filtrosPrestador.dataFim;
        if (filtrosPrestador.prestadorId !== "todos") {
          const nome = prestadorNomeMap[filtrosPrestador.prestadorId];
          if (nome) filtroPag.prestador = nome;
        }
        const dados = await buscarDadosPagamentoPrestador(filtroPag);
        setPrestadoresOps(dados);

        const linhas: PrestadorLinha[] = dados.map((o: any) => {
          const valorFrete = Number(o.valor_cliente) || 0;
          const valorPrestador = Number(o.custo_prestador) || 0;
          const margem = valorFrete - valorPrestador;
          const margemPct = valorFrete > 0 ? (margem / valorFrete) * 100 : 0;
          const enderecos = o.enderecos || [];
          return {
            os: o.numero || `OS-${o.id}`,
            cliente: o.cliente_nome || o.cliente || "Avulso",
            origem: enderecos[0]?.cidade || o.origem_endereco || "N/A",
            destino: enderecos[enderecos.length - 1]?.cidade || o.destino_endereco || "N/A",
            dataColeta: o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "-",
            dataEntrega: o.data_finalizacao ? new Date(o.data_finalizacao).toLocaleDateString("pt-BR") : "-",
            valorFrete,
            valorPrestador,
            margem,
            margemPct,
            statusFinanceiro: o.status_pagamento === "pago" ? "Pago" : o.status_pagamento === "parcial" ? "Parcial" : "Pendente",
            tipoVeiculo: o.veiculo_tipo || "-",
            ocorrencia: "",
          };
        });

        if (filtrosPrestador.clienteId !== "todos") {
          const cliId = Number(filtrosPrestador.clienteId);
          const fmtd = linhas.filter(l => {
            const os = dados.find((d: any) => d.numero === l.os);
            return os && os.cliente_id === cliId;
          });
          setPrestadoresLinhas(fmtd);
        } else {
          setPrestadoresLinhas(linhas);
        }
      } catch (e) {
        console.error("Erro ao carregar detalhes prestadores:", e);
        setPrestadoresLinhas([]);
      }
      setLoadingPrestadores(false);
    }
    loadPrestadoresDetalhes();
  }, [filtrosPrestador, prestadorNomeMap]);

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
                      <TableCell className="text-sm">{os.data}</TableCell>
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
                  <Button onClick={() => generateExcelFaturamentoCliente(clienteSelecionado)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Download className="w-4 h-4" />
                    Gerar Excel Cliente
                  </Button>
                  <Button onClick={async () => await generateFaturamentoPDF(clienteSelecionado)} className="gap-2 bg-orange-500 hover:bg-orange-600">
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
                    {clienteSelecionado.operacoes.map((os) => (
                      <TableRow key={os.id}>
                        <TableCell className="font-medium">{os.numero}</TableCell>
                        <TableCell className="text-sm">{os.data}</TableCell>
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
              { label: "Saldo Pendente", value: fmtFin(prestadoresLinhas.filter(l => l.statusFinanceiro === "Pendente").reduce((s, l) => s + l.valorFrete, 0)), color: "text-amber-600", icon: Clock },
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
            <Button disabled={loadingPrestadores || prestadoresLinhas.length === 0}
              onClick={async () => {
                const prestNome = filtrosPrestador.prestadorId !== "todos"
                  ? (prestadoresOptions.find(o => o.value === filtrosPrestador.prestadorId)?.label || "")
                  : "";
                const totalOps = prestadoresLinhas.length;
                const valorBruto = prestadoresLinhas.reduce((s, l) => s + l.valorFrete, 0);
                const valorPago = prestadoresLinhas.reduce((s, l) => s + l.valorPrestador, 0);
                await generateRelatorioPrestadoresPDF(
                  prestadoresLinhas.filter(l => {
                    if (filtrosPrestador.statusFinanceiro !== "todos" && l.statusFinanceiro.toLowerCase() !== filtrosPrestador.statusFinanceiro) return false;
                    if (filtrosPrestador.tipoOperacao !== "todos") return false;
                    return true;
                  }),
                  prestNome,
                  filtrosPrestador.dataInicio,
                  filtrosPrestador.dataFim,
                  {
                    totalOps,
                    valorBruto,
                    valorPago,
                    saldoPendente: prestadoresLinhas.filter(l => l.statusFinanceiro === "Pendente").reduce((s, l) => s + l.valorFrete, 0),
                    mediaEntrega: totalOps > 0 ? valorPago / totalOps : 0,
                  }
                );
              }}
              className="gap-2 bg-orange-500 hover:bg-orange-600">
              <Download className="w-4 h-4" />
              Gerar PDF
            </Button>
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
