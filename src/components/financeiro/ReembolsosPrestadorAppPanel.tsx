import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissaoFinanceira } from "@/hooks/usePermissaoFinanceira";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  aprovarReembolso,
  CATEGORIAS_REEMBOLSO,
  categoriaReembolsoLabel,
  formatarMoeda,
  listarReembolsosPrestador,
  rejeitarReembolso,
  STATUS_REEMBOLSO_LABEL,
  STATUS_REEMBOLSO_TONE,
  urlAssinadaComprovante,
  type CategoriaReembolso,
  type ReembolsoPrestador,
  type StatusReembolso,
} from "@/services/financeiro/reembolsosPrestadorAppService";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/formatDates";

const STATUS_OPCOES: Array<StatusReembolso | "todos"> = ["todos", "pendente", "aprovado", "rejeitado", "pago"];

export default function ReembolsosPrestadorAppPanel() {
  const { podeVerMargem } = usePermissaoFinanceira();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [reembolsos, setReembolsos] = useState<ReembolsoPrestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<StatusReembolso | "todos">("pendente");
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaReembolso | "todas">("todas");
  const [busca, setBusca] = useState("");
  const [rejeitar, setRejeitar] = useState<ReembolsoPrestador | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setReembolsos(await listarReembolsosPrestador({ status: filtroStatus, categoria: filtroCategoria }));
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, filtroCategoria]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getUser().then(({ data }) => {
      if (ativo) setAuthUserId(data.user?.id || null);
    });
    return () => { ativo = false; };
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return reembolsos;
    return reembolsos.filter((r) =>
      [r.prestador_nome, r.prestador, r.os_numero, r.descricao, categoriaReembolsoLabel(r.categoria)]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo)),
    );
  }, [reembolsos, busca]);

  const resumo = useMemo(() => {
    const pendentes = reembolsos.filter((r) => String(r.status) === "pendente");
    return {
      total: reembolsos.length,
      pendentes: pendentes.length,
      aprovados: reembolsos.filter((r) => String(r.status) === "aprovado").length,
      rejeitados: reembolsos.filter((r) => String(r.status) === "rejeitado").length,
      valorPendente: pendentes.reduce((acc, r) => acc + Number(r.valor || 0), 0),
    };
  }, [reembolsos]);

  async function visualizarComprovante(item: ReembolsoPrestador) {
    const path = item.comprovante_path || item.comprovante_url;
    if (!path) {
      toast.info("Despesa sem comprovante anexado.");
      return;
    }
    const url = await urlAssinadaComprovante(path);
    if (!url) {
      toast.error("Não foi possível gerar a visualização segura do comprovante.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function aprovar(item: ReembolsoPrestador) {
    setSalvando(item.id);
    try {
      await aprovarReembolso(item.id, authUserId);
      toast.success("Despesa aprovada para o prestador parceiro.");
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível aprovar a despesa.");
    } finally {
      setSalvando(null);
    }
  }

  async function confirmarRejeicao() {
    if (!rejeitar) return;
    if (!motivo.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    setSalvando(rejeitar.id);
    try {
      await rejeitarReembolso(rejeitar.id, motivo.trim());
      toast.success("Despesa rejeitada.");
      setRejeitar(null);
      setMotivo("");
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível rejeitar a despesa.");
    } finally {
      setSalvando(null);
    }
  }

  const valorVisivel = (valor: number) => (podeVerMargem ? formatarMoeda(valor) : "R$ ••••");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" /> Despesas do prestador parceiro
            </CardTitle>
            <CardDescription>
              Revise comprovantes enviados pelo App, aprove ou rejeite repasses de despesas operacionais.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {!podeVerMargem && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Valores protegidos pela política de privacidade financeira. Apenas o Administrador Geral visualiza os montantes.</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResumoBox label="Pendentes" valor={String(resumo.pendentes)} tone="bg-amber-50 text-amber-800 border-amber-200" />
            <ResumoBox label="Aprovadas" valor={String(resumo.aprovados)} tone="bg-emerald-50 text-emerald-800 border-emerald-200" />
            <ResumoBox label="Rejeitadas" valor={String(resumo.rejeitados)} tone="bg-red-50 text-red-800 border-red-200" />
            <ResumoBox label="Valor pendente" valor={valorVisivel(resumo.valorPendente)} tone="bg-slate-50 text-slate-800 border-slate-200" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prestador parceiro, OS ou descrição..." />
            </div>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusReembolso | "todos")}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPCOES.map((s) => (
                  <SelectItem key={s} value={s}>{s === "todos" ? "Todos os status" : STATUS_REEMBOLSO_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroCategoria} onValueChange={(v) => setFiltroCategoria(v as CategoriaReembolso | "todas")}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {CATEGORIAS_REEMBOLSO.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando despesas...</div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Nenhuma despesa encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prestador parceiro</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Serviço / OS</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Comprovante</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((item) => {
                    const status = String(item.status || "pendente");
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm font-medium">{item.prestador_nome || item.prestador || "—"}</TableCell>
                        <TableCell className="text-sm">{categoriaReembolsoLabel(item.categoria || item.tipo)}</TableCell>
                        <TableCell className="text-sm max-w-[220px] truncate">{item.descricao || "—"}</TableCell>
                        <TableCell className="text-sm">{item.data_despesa ? formatarDataBR(item.data_despesa) : "—"}</TableCell>
                        <TableCell className="text-sm">{item.os_numero || "—"}</TableCell>
                        <TableCell className="text-sm font-semibold">{valorVisivel(Number(item.valor || 0))}</TableCell>
                        <TableCell>
                          {item.comprovante_path || item.comprovante_url ? (
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void visualizarComprovante(item)}>
                              <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem anexo</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_REEMBOLSO_TONE[status] || ""}>
                            {STATUS_REEMBOLSO_LABEL[status] || status}
                          </Badge>
                          {item.motivo_rejeicao && (
                            <p className="text-[10px] text-red-600 mt-1 max-w-[160px]">{item.motivo_rejeicao}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-1">
                            {status === "pendente" && (
                              <>
                                <Button size="sm" className="h-8 text-xs" onClick={() => void aprovar(item)} disabled={salvando === item.id}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs text-red-700"
                                  onClick={() => { setRejeitar(item); setMotivo(""); }}
                                  disabled={salvando === item.id}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                                </Button>
                              </>
                            )}
                            {status !== "pendente" && (
                              <span className="text-[11px] text-muted-foreground">
                                {item.aprovado_em ? formatarDataHoraBR(item.aprovado_em) : item.created_at ? formatarDataHoraBR(item.created_at) : "—"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejeitar} onOpenChange={(open) => { if (!open) setRejeitar(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar despesa</DialogTitle>
            <DialogDescription>
              {rejeitar?.prestador_nome || rejeitar?.prestador || "Prestador parceiro"} · {categoriaReembolsoLabel(rejeitar?.categoria || rejeitar?.tipo)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da rejeição</Label>
            <Textarea rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo para o prestador parceiro..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejeitar(null)} disabled={!!salvando}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void confirmarRejeicao()} disabled={!!salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResumoBox({ label, valor, tone }: { label: string; valor: string; tone: string }) {
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold mt-1">{valor}</p>
    </div>
  );
}
