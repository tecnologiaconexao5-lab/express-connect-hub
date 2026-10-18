import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileCheck, Search, Calendar, Building2, User, MapPin, Filter,
  Camera, Signature, FileText, CheckCircle2, AlertTriangle, XCircle,
  RefreshCcw, Loader2, Eye, Hash,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import PaginationBar from "@/components/ui/PaginationBar";
import DossieEntregaSheet from "@/components/comprovantes/DossieEntregaSheet";
import {
  listarComprovantes,
  listarClientesComprovantes,
  listarPrestadoresComprovantes,
  type ComprovanteEntrega,
  type SituacaoComprovante,
} from "@/services/comprovantes/comprovantesService";

const SITUACAO_LABELS: Record<SituacaoComprovante, string> = {
  todos: "Todas as situações",
  entregue: "Entregue",
  entregue_ressalva: "Entregue com ressalva",
  nao_entregue: "Não entregue",
  completo: "Completo",
  incompleto: "Incompleto",
};

const SITUACAO_ICON: Record<string, any> = {
  entregue: CheckCircle2,
  entregue_ressalva: AlertTriangle,
  nao_entregue: XCircle,
};

export default function Comprovantes() {
  const [itens, setItens] = useState<ComprovanteEntrega[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);
  const porPagina = 15;

  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<DateRange>({ from: undefined, to: undefined });
  const [clienteId, setClienteId] = useState("todos");
  const [os, setOs] = useState("");
  const [prestadorId, setPrestadorId] = useState("todos");
  const [destinatario, setDestinatario] = useState("");
  const [situacao, setSituacao] = useState<SituacaoComprovante>("todos");

  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [prestadores, setPrestadores] = useState<{ id: string; nome: string }[]>([]);
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(false);

  const [dossiePodId, setDossiePodId] = useState<string | null>(null);
  const [dossieOs, setDossieOs] = useState<string | null>(null);

  useEffect(() => {
    listarClientesComprovantes().then(setClientes);
    listarPrestadoresComprovantes().then(setPrestadores);
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    const res = await listarComprovantes({
      busca: busca || undefined,
      dataInicio: periodo?.from ? periodo.from.toISOString() : undefined,
      dataFim: periodo?.to ? periodo.to.toISOString() : undefined,
      clienteId: clienteId !== "todos" ? clienteId : undefined,
      os: os || undefined,
      prestadorId: prestadorId !== "todos" ? prestadorId : undefined,
      destinatario: destinatario || undefined,
      situacao: situacao !== "todos" ? situacao : undefined,
      pagina,
      porPagina,
    });
    setItens(res.itens);
    setTotal(res.total);
    setLoading(false);
  }, [busca, periodo, clienteId, os, prestadorId, destinatario, situacao, pagina]);

  useEffect(() => {
    const t = setTimeout(() => carregar(), 300);
    return () => clearTimeout(t);
  }, [carregar]);

  const limparFiltros = () => {
    setBusca(""); setPeriodo({ from: undefined, to: undefined });
    setClienteId("todos"); setOs(""); setPrestadorId("todos");
    setDestinatario(""); setSituacao("todos"); setPagina(1);
  };

  const temFiltro =
    busca || periodo?.from || clienteId !== "todos" || os || prestadorId !== "todos" || destinatario || situacao !== "todos";

  const contagemPorSituacao = useMemo(() => {
    const map: Record<string, number> = {};
    itens.forEach((it) => {
      const key = it.situacao === "entregue" ? "entregue" : it.situacao === "entregue_ressalva" ? "ressalva" : "nao_entregue";
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [itens]);

  const renderSituacao = (item: ComprovanteEntrega) => {
    const Icon = SITUACAO_ICON[item.situacao] || FileCheck;
    const classes =
      item.situacao === "entregue"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : item.situacao === "entregue_ressalva"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-red-50 text-red-700 border-red-200";
    return (
      <Badge variant="outline" className={classes}>
        <Icon className="w-3 h-3 mr-1" /> {item.situacao_label}
      </Badge>
    );
  };

  const renderEvidencia = (url: string | null, Icon: any, label: string) => {
    if (!url) return <span className="text-[#CBD5E1]">—</span>;
    return (
      <div className="flex items-center gap-1" title={label}>
        <Icon className="w-3.5 h-3.5 text-[#F97316]" />
        <span className="text-[10px] font-bold text-emerald-600">OK</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileCheck className="w-8 h-8 text-[#F97316]" />
            Comprovantes de Entrega
          </h1>
          <p className="text-muted-foreground">
            Central profissional de comprovantes (POD) enviados pelos prestadores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={limparFiltros} disabled={!temFiltro}>
            <RefreshCcw className="w-4 h-4 mr-2" /> Limpar
          </Button>
          <Button variant="outline" onClick={() => setFiltrosVisiveis((v) => !v)}>
            <Filter className="w-4 h-4 mr-2" /> Filtros
          </Button>
        </div>
      </div>

      {/* FILTROS */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar: OS, cliente, prestador, destinatário, recebedor, documento..."
                className="pl-9 h-10"
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
              />
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <DateRangePicker value={periodo} onChange={(r) => { setPeriodo(r); setPagina(1); }} className="w-full" />
            </div>
            <div className="flex items-center gap-1">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={clienteId} onValueChange={(v) => { setClienteId(v); setPagina(1); }}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Hash className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="OS / Romaneio..."
                className="pl-9 h-10"
                value={os}
                onChange={(e) => { setOs(e.target.value); setPagina(1); }}
              />
            </div>
          </div>

          {filtrosVisiveis && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <Select value={prestadorId} onValueChange={(v) => { setPrestadorId(v); setPagina(1); }}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Prestador / Motorista" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os prestadores</SelectItem>
                    {prestadores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Destinatário..."
                  className="pl-9 h-10"
                  value={destinatario}
                  onChange={(e) => { setDestinatario(e.target.value); setPagina(1); }}
                />
              </div>
              <div className="flex items-center gap-1">
                <FileCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                <Select value={situacao} onValueChange={(v) => { setSituacao(v as SituacaoComprovante); setPagina(1); }}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SITUACAO_LABELS) as SituacaoComprovante[]).map((s) => (
                      <SelectItem key={s} value={s}>{SITUACAO_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RESUMO */}
      {itens.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-emerald-500"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Entregues</p><p className="text-xl font-bold text-emerald-600">{contagemPorSituacao.entregue || 0}</p></CardContent></Card>
          <Card className="border-l-4 border-l-amber-500"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Com ressalva</p><p className="text-xl font-bold text-amber-600">{contagemPorSituacao.ressalva || 0}</p></CardContent></Card>
          <Card className="border-l-4 border-l-red-500"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Não entregues</p><p className="text-xl font-bold text-red-600">{contagemPorSituacao.nao_entregue || 0}</p></CardContent></Card>
        </div>
      )}

      {/* LISTAGEM */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
              <span className="ml-2 text-muted-foreground">Carregando comprovantes...</span>
            </div>
          ) : itens.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nenhum comprovante encontrado. Os comprovantes aparecerão aqui após as entregas
              serem finalizadas no App Prestador.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">OS / Romaneio</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Prestador</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Veículo</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Destinatário</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Data / Hora</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Recebedor</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Situação</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Foto</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Canhoto</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Assinatura</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-slate-500">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/70">
                      <TableCell>
                        <span className="font-bold text-slate-800 text-sm">{item.numero_os || item.id.slice(0, 8)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-700 font-medium">{item.cliente_nome || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-700">{item.prestador_nome || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-slate-700">{item.veiculo_placa || "—"}</span>
                        {item.veiculo_tipo && <p className="text-[10px] text-slate-400">{item.veiculo_tipo}</p>}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-700">{item.destinatario || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-700">
                          {item.data_hora_entrega
                            ? new Date(item.data_hora_entrega).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
                            : "—"}
                        </span>
                        {item.data_hora_entrega && (
                          <p className="text-[10px] text-slate-400">
                            {new Date(item.data_hora_entrega).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-700">{item.recebedor || "—"}</span>
                        {item.documento_recebedor && <p className="text-[10px] text-slate-400">{item.documento_recebedor}</p>}
                      </TableCell>
                      <TableCell>{renderSituacao(item)}</TableCell>
                      <TableCell>{renderEvidencia(item.foto_entrega_url, Camera, "Foto da entrega")}</TableCell>
                      <TableCell>{renderEvidencia(item.foto_canhoto_url, FileText, "Canhoto")}</TableCell>
                      <TableCell>{renderEvidencia(item.assinatura_url, Signature, "Assinatura")}</TableCell>
                      <TableCell>
                        {item.completo ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Completo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px]">
                            Incompleto
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="h-8 bg-[#F97316] hover:bg-[#EA580C] text-white text-xs"
                          onClick={() => { setDossiePodId(item.id); setDossieOs(item.numero_os); }}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Ver comprovante
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && itens.length > 0 && (
            <div className="px-4 pb-4">
              <PaginationBar page={pagina} pageSize={porPagina} totalCount={total} onPageChange={setPagina} loading={loading} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* DOSSIÊ */}
      <DossieEntregaSheet
        open={!!dossiePodId}
        onOpenChange={(o) => { if (!o) setDossiePodId(null); }}
        podId={dossiePodId || ""}
        numeroOs={dossieOs}
      />
    </div>
  );
}
