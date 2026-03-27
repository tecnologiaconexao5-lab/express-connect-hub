import { useState } from "react";
import { UserMinus, Send, CalendarIcon, HeartHandshake, Phone, MailQuestion, Search, MessagesSquare } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Inadimplencia() {
  const [inadimplentes, setInadimplentes] = useState([
     { id: 1, cliente: "Indústria ABC S/A", cnpj: "12.345.678/0001-90", fatura: "FAT-304", vencimento: "2026-02-10", atrasoDias: 45, valor: 14500.50, status: "Cobrança Automática", emails: 2, nWhatsApp: "+55 11 99999-9999" },
     { id: 2, cliente: "Logística Alpha", cnpj: "88.777.666/0001-55", fatura: "FAT-322", vencimento: "2026-03-20", atrasoDias: 7, valor: 8300.20, status: "Recente", emails: 1, nWhatsApp: "+55 21 88888-8888" },
     { id: 3, cliente: "Comércio Varejista", cnpj: "44.555.666/0001-22", fatura: "FAT-211", vencimento: "2025-12-15", atrasoDias: 102, valor: 35000.00, status: "Risco Alto (Negativação)", emails: 5, nWhatsApp: "+55 31 77777-7777" },
  ]);

  const dispararIa = (id: number) => {
     alert("Disparando IA Cognitiva pelo WhatsApp Webhook...");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4 border-b pb-4">
         <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-rose-800"><UserMinus className="w-6 h-6"/> Central de Inadimplência & Cobrança</h2>
            <p className="text-sm text-muted-foreground">Monitoramento de atrasos de faturamento com réguas automatizadas.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
         <Card className="bg-rose-50 border-rose-200"><CardContent className="p-4"><p className="text-xs font-bold text-rose-700 uppercase">Valores em Atraso Base</p><p className="text-xl font-black mt-1 text-rose-900">{fmtFin(57800.70)}</p></CardContent></Card>
         <Card className="bg-orange-50 border-orange-200"><CardContent className="p-4"><p className="text-xs font-bold text-orange-700 uppercase">Atraso Crítico (+90D)</p><p className="text-xl font-black mt-1 text-orange-900">{fmtFin(35000)}</p></CardContent></Card>
         <Card className="bg-slate-50"><CardContent className="p-4"><p className="text-xs font-bold text-slate-500 uppercase">Média Dias Atraso</p><p className="text-xl font-black mt-1 text-slate-800">51 Dias</p></CardContent></Card>
         <Card className="bg-slate-50"><CardContent className="p-4"><p className="text-xs font-bold text-slate-500 uppercase">E-mails Disparados/Mês</p><p className="text-xl font-black mt-1 text-slate-800">8 Notificações</p></CardContent></Card>
      </div>

      <Card>
         <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
            <CardTitle>Régua de Cobranças Ativas</CardTitle>
            <div className="relative w-[300px]">
               <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
               <Input placeholder="Buscar Fatura ou Cliente..." className="pl-9 h-9 text-sm bg-slate-50" />
            </div>
         </CardHeader>
         <CardContent className="p-0">
            <Table>
               <TableHeader><TableRow><TableHead>Cliente & Documento</TableHead><TableHead className="text-center">Atraso Acumulado</TableHead><TableHead className="text-right">Montante da Dívida</TableHead><TableHead>Status Régua IA</TableHead><TableHead className="text-right">Ação Cobrança</TableHead></TableRow></TableHeader>
               <TableBody>
                  {inadimplentes.map(c => (
                     <TableRow key={c.id}>
                        <TableCell>
                           <p className="font-bold text-sm text-slate-800">{c.cliente}</p>
                           <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.fatura} • Venc: {new Date(c.vencimento).toLocaleDateString()}</p>
                        </TableCell>
                        <TableCell className="text-center">
                           <Badge variant="outline" className={`font-mono font-bold ${c.atrasoDias > 90 ? 'text-rose-700 bg-rose-50 border-rose-200' : c.atrasoDias > 30 ? 'text-orange-600 bg-orange-50' : 'text-yellow-600 bg-yellow-50'}`}>{c.atrasoDias} Dias (D+{c.atrasoDias})</Badge>
                        </TableCell>
                        <TableCell className="text-right font-black text-rose-800">{fmtFin(c.valor)}</TableCell>
                        <TableCell>
                           <p className="text-xs font-bold">{c.status}</p>
                           <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.emails} Emails | Bot WhatsApp Ativo</p>
                        </TableCell>
                        <TableCell className="text-right flex items-center justify-end gap-1">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 bg-blue-50" title={c.nWhatsApp} onClick={() => dispararIa(c.id)}><MessagesSquare className="w-4 h-4"/></Button>
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" title="Cobrança por E-mail Oficial"><MailQuestion className="w-4 h-4"/></Button>
                           {c.atrasoDias > 90 && <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 bg-rose-50" title="Apontar Serasa/Negativação"><UserMinus className="w-4 h-4"/></Button>}
                        </TableCell>
                     </TableRow>
                  ))}
               </TableBody>
            </Table>
         </CardContent>
      </Card>

    </div>
  );
}
