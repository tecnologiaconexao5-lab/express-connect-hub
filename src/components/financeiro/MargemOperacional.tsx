import { useState } from "react";
import { LineChart, BarChart, Activity, DollarSign, TrendingUp, TrendingDown, Target, Building2, Truck, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => v.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1 });

export default function MargemOperacional() {
  const [margens, setMargens] = useState([
     { os: "OS-8051", cliente: "Tech Varejo S.A", cobrado: 1200, custoMotorista: 750, pedagios: 120, margemLiq: 330, pct: 0.275, alerta: false },
     { os: "OS-8040", cliente: "Tech Varejo S.A", cobrado: 4500, custoMotorista: 4100, pedagios: 200, margemLiq: 200, pct: 0.044, alerta: true },
     { os: "OS-8022", cliente: "Industria Alfa", cobrado: 840, custoMotorista: 450, pedagios: 50, margemLiq: 340, pct: 0.404, alerta: false },
     { os: "OS-7991", cliente: "Ecommerce Rápido", cobrado: 180, custoMotorista: 150, pedagios: 0, margemLiq: 30, pct: 0.166, alerta: true },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4 border-b pb-4">
         <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-800"><Target className="w-6 h-6"/> Rentabilidade e Margem de Contribuição</h2>
            <p className="text-sm text-muted-foreground">O motor deduz em tempo-real a saúde da operação (Receita Cliente <i>vs</i> Custo Transportador).</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
         <Card className="bg-emerald-50 border-emerald-200"><CardContent className="p-4"><p className="text-xs font-bold text-emerald-700 uppercase">Receita CTe (Faturado Base)</p><p className="text-xl font-black mt-1 text-emerald-900">{fmtFin(6720)}</p></CardContent></Card>
         <Card className="bg-red-50 border-red-200"><CardContent className="p-4"><p className="text-xs font-bold text-red-700 uppercase">Custo Frota/Freteiros (CPV)</p><p className="text-xl font-black mt-1 text-red-900">{fmtFin(-5450)}</p></CardContent></Card>
         <Card className="bg-slate-50"><CardContent className="p-4"><p className="text-xs font-bold text-slate-500 uppercase">Sobrou em Caixa (EBITDA)</p><p className="text-xl font-black mt-1 text-slate-800">{fmtFin(900)}</p></CardContent></Card>
         <Card className="bg-emerald-50/50 border-emerald-400 border-2"><CardContent className="p-4"><p className="text-xs font-bold text-emerald-600 uppercase">Markup / Margem Média</p><p className="text-xl font-black mt-1 text-emerald-700">13.39%</p></CardContent></Card>
      </div>

      <Card>
         <CardHeader>
            <CardTitle>Espelhamento Unitário das Entregas (Provisões de OS)</CardTitle>
            <CardDescription>O sistema debita a "Receita" na contabilidade ao mesmo passo que impõe as faturas a pagar ao parceiro.</CardDescription>
         </CardHeader>
         <CardContent className="p-0">
            <Table>
               <TableHeader><TableRow><TableHead>Ordem ID</TableHead><TableHead>Tomador do Serviço</TableHead><TableHead className="text-right">A Receber</TableHead><TableHead className="text-right">Frete Motorista</TableHead><TableHead className="text-center bg-slate-50/50 border-l border-r">R$ Lucro Direto</TableHead><TableHead className="text-center font-black">% Margem</TableHead><TableHead></TableHead></TableRow></TableHeader>
               <TableBody>
                  {margens.map((m, i) => (
                     <TableRow key={i} className={m.alerta ? "bg-red-50/20" : ""}>
                        <TableCell className="font-mono text-xs font-bold text-indigo-700">{m.os}</TableCell>
                        <TableCell className="font-bold text-sm text-slate-800">{m.cliente}</TableCell>
                        <TableCell className="text-right font-black text-green-700">{fmtFin(m.cobrado)}</TableCell>
                        <TableCell className="text-right font-bold text-red-700">-{fmtFin(m.custoMotorista)}<br/><span className="text-[10px] text-slate-400 font-mono">Pedágios: -{fmtFin(m.pedagios)}</span></TableCell>
                        <TableCell className="text-center font-black text-slate-700 bg-slate-50 border-l border-r">{fmtFin(m.margemLiq)}</TableCell>
                        <TableCell className="text-center">
                           <Badge variant="outline" className={`font-mono font-bold ${m.alerta ? 'bg-red-50 text-red-700 border-red-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}>
                              {m.alerta ? <TrendingDown className="w-3 h-3 mr-1"/> : <TrendingUp className="w-3 h-3 mr-1"/>}
                              {fmtPct(m.pct)}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><Eye className="w-4 h-4"/></Button></TableCell>
                     </TableRow>
                  ))}
               </TableBody>
            </Table>
         </CardContent>
      </Card>
      
      <div className="pt-6">
         <p className="text-sm font-medium text-slate-400 italic text-center">Gráficos de dispersão atuariam nesta zona exibindo os picos de faturamento da frota própria <i>vs</i> terceiros.</p>
      </div>
    </div>
  );
}
