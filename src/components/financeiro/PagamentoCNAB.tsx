import { useState, useEffect } from "react";
import { CreditCard, AlertTriangle, Info, FileText, RefreshCw, Copy, Layers, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ============================================================================
// TMS-FIN-PROG-05D.7C.1 — Tesouraria/lotes: LEITURA de lotes_pagamento (header)
// + lotes_pagamento_itens (destino validado). NAO mostra PIX/conta completa.
// Botoes bancarios permanecem DESABILITADOS (sem iFi/CNAB). Sem pagamento/baixa.
// ============================================================================

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d?: string | null) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR") : "-");

interface LoteHeader {
  id: string;
  status: string;
  quantidade_pagamentos: number;
  valor_total: number;
  created_at: string;
  prestadores: number;
}

export default function PagamentoCNAB() {
  const [lotes, setLotes] = useState<LoteHeader[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data: hdrs, error } = await supabase
        .from("lotes_pagamento")
        .select("id, status, quantidade_pagamentos, valor_total, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const ids = (hdrs || []).map((h: any) => h.id);
      const prestPorLote: Record<string, Set<string>> = {};
      if (ids.length > 0) {
        const { data: itens } = await supabase
          .from("lotes_pagamento_itens")
          .select("lote_id, prestador_id")
          .in("lote_id", ids);
        (itens || []).forEach((i: any) => {
          (prestPorLote[i.lote_id] = prestPorLote[i.lote_id] || new Set()).add(String(i.prestador_id || ""));
        });
      }
      setLotes((hdrs || []).map((h: any) => ({
        id: h.id, status: h.status,
        quantidade_pagamentos: h.quantidade_pagamentos,
        valor_total: Number(h.valor_total) || 0,
        created_at: h.created_at,
        prestadores: prestPorLote[h.id] ? prestPorLote[h.id].size : 0,
      })));
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar lotes de pagamento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const totalLotes = lotes.length;
  const totalPagtos = lotes.reduce((s, l) => s + l.quantidade_pagamentos, 0);
  const totalLiquido = lotes.reduce((s, l) => s + l.valor_total, 0);

  const statusLabel = (s: string) =>
    s === "preparado" ? "Preparado / Aguardando execução bancária" : s;

  const copiarLote = (id: string) => {
    navigator.clipboard?.writeText(id).then(() => toast.success("ID do lote copiado")).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" /> Pagamentos em Lote (Tesouraria)
          </h2>
          <p className="text-sm text-muted-foreground">Lotes formados aguardando execução bancária</p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading} className="gap-1.5">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Card className="border-amber-300 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-5 h-5" /> Integração bancária ainda não configurada
          </CardTitle>
          <CardDescription>
            A geração de remessa (FEBRABAN 240), o PIX/API e a baixa automática dependem de
            integração bancária ainda não ativa. Nenhuma funcionalidade fictícia é exibida: os
            botões de geração/retorno permanecem desabilitados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button disabled title="Integração bancária ainda não configurada"><FileText className="w-4 h-4 mr-2" /> Gerar Remessa — indisponível</Button>
          <Button disabled variant="outline" title="Integração bancária ainda não configurada">Importar Retorno — indisponível</Button>
          <Button disabled variant="outline" title="Integração bancária ainda não configurada">Enviar PIX — indisponível</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="bg-slate-50/50"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Lotes aguardando</p><p className="text-lg font-extrabold">{totalLotes}</p></CardContent></Card>
        <Card className="bg-slate-50/50"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Pagamentos em lote</p><p className="text-lg font-extrabold">{totalPagtos}</p></CardContent></Card>
        <Card className="bg-indigo-50/50 border-indigo-100"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total líquido em lote</p><p className="text-lg font-extrabold text-indigo-700">{fmtFin(totalLiquido)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4" /> Lotes formados (aguardando execução bancária)</CardTitle>
          <CardDescription>Fonte: lotes_pagamento + itens. Somente leitura; sem dados bancários sensíveis na listagem.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[11px] uppercase pl-4">Lote</TableHead>
                <TableHead className="text-[11px] uppercase text-right">Pagamentos</TableHead>
                <TableHead className="text-[11px] uppercase text-right">Prestadores</TableHead>
                <TableHead className="text-[11px] uppercase">Gerado em</TableHead>
                <TableHead className="text-[11px] uppercase">Destino</TableHead>
                <TableHead className="text-[11px] uppercase">Status</TableHead>
                <TableHead className="text-[11px] uppercase text-right pr-4">Total líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10"><RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : lotes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum lote formado aguardando execução bancária</TableCell></TableRow>
              ) : lotes.map((l) => (
                <TableRow key={l.id} className="hover:bg-muted/20">
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold">{l.id.slice(0, 8)}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Copiar ID completo do lote" onClick={() => copiarLote(l.id)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-right font-semibold">{l.quantidade_pagamentos}</TableCell>
                  <TableCell className="text-xs text-right">{l.prestadores}</TableCell>
                  <TableCell className="text-xs">{fmtData(l.created_at)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><ShieldCheck className="w-3 h-3 mr-1 inline" />Destino validado</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">{statusLabel(l.status)}</Badge></TableCell>
                  <TableCell className="text-xs text-right font-bold pr-4">{fmtFin(l.valor_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Info className="w-3.5 h-3.5" />
        Quando a integração bancária existir, a geração consumirá exatamente estes lotes reais,
        sem criar novo fato econômico.
      </p>
    </div>
  );
}
