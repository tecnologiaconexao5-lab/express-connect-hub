import { useState, useEffect, useMemo } from "react";
import { LineChart, BarChart, Activity, DollarSign, TrendingUp, TrendingDown, Target, Building2, Truck, Eye, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import PaginationBar from "@/components/ui/PaginationBar";
import { montarMargens, resumirMargens, type MargemOS, type OsInfo, type ComposicaoRow } from "@/helpers/margemOperacionalHelper";
import { supabase } from "@/lib/supabase";

const fmtFin = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${(Number.isFinite(v) ? v * 100 : 0).toFixed(1)}%`;

interface MargemOSRow extends MargemOS {}

export default function MargemOperacional() {
  const [margens, setMargens] = useState<MargemOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

  useEffect(() => {
    carregarMargens();
  }, []);

  const carregarMargens = async () => {
    try {
      setLoading(true);
      setError(null);
      // 05D.7C.1/MARGEM-01: SEM embed PostgREST (nao ha FK composicao->OS).
      // Consulta em etapas (batch) por os_id; nunca inventa relacionamento.
      const { data, error: err } = await supabase
        .from("composicao_financeira_os")
        .select("id, os_id, cliente_id, prestador_id, valor_cliente, valor_prestador, pedagio_valor, margem_liquida, created_at")
        .order("created_at", { ascending: false });

      if (err) throw err;

      const rows = (data || []) as any[];
      if (rows.length === 0) {
        setMargens([]);
        setPage(1);
        return;
      }

      const osIds = Array.from(new Set(rows.map((r) => r.os_id).filter(Boolean))) as string[];
      const osMap: Record<string, { numero: string | null; cliente: string | null; is_teste: boolean | null }> = {};
      if (osIds.length > 0) {
        const { data: osData, error: osErr } = await supabase
          .from("ordens_servico")
          .select("id, numero, cliente, is_teste")
          .in("id", osIds);
        if (osErr) throw osErr;
        (osData || []).forEach((o: any) => {
          osMap[o.id] = { numero: o.numero, cliente: o.cliente, is_teste: o.is_teste };
        });
      }

      const cliIds = Array.from(new Set(Object.values(osMap).map((o) => o.cliente).filter(Boolean))) as string[];
      const nomePorCliente: Record<string, string> = {};
      if (cliIds.length > 0) {
        const { data: cliData } = await supabase.from("clientes").select("id, razao_social, nome_fantasia").in("id", cliIds);
        (cliData || []).forEach((c: any) => { nomePorCliente[c.id] = c.nome_fantasia || c.razao_social || ""; });
      }

      const mapeadas = montarMargens(rows as unknown as ComposicaoRow[], osMap as Record<string, OsInfo>, nomePorCliente);

      setMargens(mapeadas);
      setPage(1);
    } catch (e: any) {
      console.error("[MargemOperacional] Erro ao carregar:", e);
      setError(e.message || "Erro ao carregar dados");
      setMargens([]);
    } finally {
      setLoading(false);
    }
  };

  const margensPagina = useMemo(() => {
    const inicio = (page - 1) * PAGE_SIZE;
    return margens.slice(inicio, inicio + PAGE_SIZE);
  }, [margens, page]);

  const { receitaTotal, custoTotal, margemTotal, margemMedia } = useMemo(() => resumirMargens(margens), [margens]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4 border-b pb-4">
         <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-800"><Target className="w-6 h-6"/> Rentabilidade e Margem de Contribuição</h2>
            <p className="text-sm text-muted-foreground">Margem real calculada a partir da composição financeira de cada OS.</p>
         </div>
         <Button variant="outline" size="sm" onClick={carregarMargens} disabled={loading}>
           {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
           Atualizar
         </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
         <Card className="bg-emerald-50 border-emerald-200"><CardContent className="p-4"><p className="text-xs font-bold text-emerald-700 uppercase">Receita Total (Faturado)</p><p className="text-xl font-black mt-1 text-emerald-900">{fmtFin(receitaTotal)}</p></CardContent></Card>
         <Card className="bg-red-50 border-red-200"><CardContent className="p-4"><p className="text-xs font-bold text-red-700 uppercase">Custo Total (Repasse + Pedágio)</p><p className="text-xl font-black mt-1 text-red-900">{fmtFin(-custoTotal)}</p></CardContent></Card>
         <Card className="bg-slate-50"><CardContent className="p-4"><p className="text-xs font-bold text-slate-500 uppercase">Margem Líquida Total</p><p className="text-xl font-black mt-1 text-slate-800">{fmtFin(margemTotal)}</p></CardContent></Card>
         <Card className="bg-emerald-50/50 border-emerald-400 border-2"><CardContent className="p-4"><p className="text-xs font-bold text-emerald-600 uppercase">Margem Média</p><p className="text-xl font-black mt-1 text-emerald-700">{fmtPct(margemMedia)}</p></CardContent></Card>
      </div>

      <Card>
         <CardHeader>
            <CardTitle>Espelhamento Unitário das Entregas (Composição Financeira)</CardTitle>
            <CardDescription>Receita × Custo × Margem por OS, calculado do financeiro real.</CardDescription>
         </CardHeader>
         <CardContent className="p-0">
           {loading ? (
             <div className="flex items-center justify-center py-16">
               <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
             </div>
           ) : error ? (
             <div className="text-center py-16 text-red-500">
               <p>Erro ao carregar dados: {error}</p>
             </div>
           ) : margens.length === 0 ? (
             <div className="text-center py-16 text-muted-foreground">
               <p>Nenhum dado de composição financeira encontrado.</p>
               <p className="text-sm mt-1">Finalize uma OS para gerar a composição financeira.</p>
             </div>
           ) : (
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem ID</TableHead>
                    <TableHead>Tomador do Serviço</TableHead>
                    <TableHead className="text-right">A Receber</TableHead>
                    <TableHead className="text-right">Frete + Pedágio</TableHead>
                    <TableHead className="text-center bg-slate-50/50 border-l border-r">R$ Margem Liq.</TableHead>
                    <TableHead className="text-center font-black">% Margem</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {margensPagina.map((m, i) => (
                      <TableRow key={m.os_id} className={m.alerta ? "bg-red-50/20" : ""}>
                         <TableCell className="font-mono text-xs font-bold text-indigo-700">{m.os_numero}</TableCell>
                         <TableCell className="font-bold text-sm text-slate-800">{m.cliente}</TableCell>
                         <TableCell className="text-right font-black text-green-700">{fmtFin(m.valor_cliente)}</TableCell>
                         <TableCell className="text-right font-bold text-red-700">-{fmtFin(m.valor_prestador + m.pedagio_valor)}</TableCell>
                         <TableCell className="text-center font-black text-slate-700 bg-slate-50 border-l border-r">{fmtFin(m.margem_liquida)}</TableCell>
                         <TableCell className="text-center">
                            <Badge variant="outline" className={`font-mono font-bold ${m.alerta ? 'bg-red-50 text-red-700 border-red-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}>
                               {m.alerta ? <TrendingDown className="w-3 h-3 mr-1"/> : <TrendingUp className="w-3 h-3 mr-1"/>}
                               {fmtPct(m.percentual_margem_liquida)}
                            </Badge>
                         </TableCell>
                         <TableCell className="text-right">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                             <Eye className="w-4 h-4"/>
                           </Button>
                         </TableCell>
                      </TableRow>
                   ))}
                </TableBody>
             </Table>
           )}
           <div className="px-4 pb-4">
             <PaginationBar page={page} pageSize={PAGE_SIZE} totalCount={margens.length} onPageChange={setPage} />
           </div>
         </CardContent>
      </Card>
      
      <div className="pt-6">
         <p className="text-sm font-medium text-slate-400 italic text-center">
           {margens.length > 0
             ? `Análise baseada em ${margens.length} OS com composição financeira registrada.`
             : "Finalize OS para gerar composição financeira e visualizar margens reais."}
         </p>
      </div>
    </div>
  );
}
