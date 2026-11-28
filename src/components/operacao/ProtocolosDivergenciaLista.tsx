import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileWarning,
  Filter,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
  atualizarProtocoloDivergencia,
  conferirRetornoNaBase,
  encerrarProtocoloDivergencia,
  listarProtocolosDivergencia,
  PROTOCOLO_STATUS_LABEL,
  PROTOCOLO_STATUS_TONE,
  urlAssinadaFotoProtocolo,
  type ProtocoloDivergencia,
  type ProtocoloStatus,
} from "@/services/operacao/protocolosDivergenciaService";
import { formatarDataHoraBR } from "@/lib/formatDates";

interface OpcaoFiltro {
  id: string;
  nome: string;
}

const STATUS_OPCOES: ProtocoloStatus[] = ["aberta", "em_analise", "aguardando_info", "resolvida"];

export default function ProtocolosDivergenciaLista() {
  const [protocolos, setProtocolos] = useState<ProtocoloDivergencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<ProtocoloStatus | "todos">("todos");
  const [clienteId, setClienteId] = useState<string>("todos");
  const [prestadorId, setPrestadorId] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<OpcaoFiltro[]>([]);
  const [prestadores, setPrestadores] = useState<OpcaoFiltro[]>([]);
  const [detalhe, setDetalhe] = useState<ProtocoloDivergencia | null>(null);
  const [fotos, setFotos] = useState<Record<string, string | null>>({});
  const [conferir, setConferir] = useState<ProtocoloDivergencia | null>(null);
  const [volumesRecebidos, setVolumesRecebidos] = useState("0");
  const [responsavel, setResponsavel] = useState("");
  const [observacoesConferencia, setObservacoesConferencia] = useState("");
  const [salvandoConferencia, setSalvandoConferencia] = useState(false);
  const [encerrar, setEncerrar] = useState<ProtocoloDivergencia | null>(null);
  const [resolucao, setResolucao] = useState("");
  const [salvandoEncerramento, setSalvandoEncerramento] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const dados = await listarProtocolosDivergencia({
        status: filtroStatus,
        clienteId: clienteId === "todos" ? null : clienteId,
        prestadorId: prestadorId === "todos" ? null : prestadorId,
      });
      setProtocolos(dados);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, clienteId, prestadorId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [cli, prest] = await Promise.all([
        supabase.from("clientes").select("id, nome_fantasia, razao_social").limit(500),
        supabase.from("prestadores").select("id, nome_completo").limit(500),
      ]);
      if (!ativo) return;
      setClientes(
        (cli.data || []).map((c: any) => ({ id: c.id, nome: c.nome_fantasia || c.razao_social || c.id })),
      );
      setPrestadores(
        (prest.data || []).map((p: any) => ({ id: p.id, nome: p.nome_completo || p.id })),
      );
    })();
    return () => { ativo = false; };
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return protocolos;
    return protocolos.filter((p) =>
      [p.numero_protocolo, p.os_numero, p.cliente_nome, p.prestador_nome, p.motivo]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo)),
    );
  }, [protocolos, busca]);

  const resumo = useMemo(() => {
    return {
      total: protocolos.length,
      abertas: protocolos.filter((p) => p.status === "aberta").length,
      analise: protocolos.filter((p) => p.status === "em_analise").length,
      aguardando: protocolos.filter((p) => p.status === "aguardando_info").length,
      resolvidas: protocolos.filter((p) => p.status === "resolvida").length,
      divergentes: protocolos.reduce((acc, p) => acc + Number(p.quantidade_divergente || 0), 0),
    };
  }, [protocolos]);

  async function abrirDetalhe(protocolo: ProtocoloDivergencia) {
    setDetalhe(protocolo);
    const paths = (protocolo.fotos_paths || []).filter(Boolean);
    const entradas = await Promise.all(
      paths.map(async (path) => [path, await urlAssinadaFotoProtocolo(path)] as const),
    );
    setFotos(Object.fromEntries(entradas));
  }

  async function handleAlterarStatus(protocolo: ProtocoloDivergencia, status: ProtocoloStatus) {
    try {
      await atualizarProtocoloDivergencia(protocolo.id, { status });
      toast.success(`Protocolo ${protocolo.numero_protocolo} atualizado para ${PROTOCOLO_STATUS_LABEL[status]}.`);
      if (detalhe?.id === protocolo.id) setDetalhe({ ...detalhe, status });
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o status.");
    }
  }

  async function handleConferir() {
    if (!conferir) return;
    const qtd = Math.max(0, Math.floor(Number(volumesRecebidos) || 0));
    setSalvandoConferencia(true);
    try {
      const resultado = await conferirRetornoNaBase({
        ordemServicoId: conferir.ordem_servico_id,
        volumesRecebidos: qtd,
        motivo: conferir.motivo,
        observacoes: observacoesConferencia || null,
        responsavel: responsavel || null,
      });

      await atualizarProtocoloDivergencia(conferir.id, {
        volumes_recebidos_retorno: qtd,
        status: conferir.status === "aberta" ? "em_analise" : conferir.status,
      });

      if (!resultado.success) {
        toast.error(resultado.error || "Não foi possível concluir a conferência.");
      } else if (resultado.divergencia) {
        toast.warning(
          `Divergência confirmada. Protocolo ${resultado.numero_protocolo || ""} gerado/atualizado com ${resultado.quantidade_divergente ?? 0} volume(s).`,
        );
      } else {
        toast.success("Conferência de retorno concluída sem divergência.");
      }
      setConferir(null);
      setObservacoesConferencia("");
      setResponsavel("");
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível conferir o retorno.");
    } finally {
      setSalvandoConferencia(false);
    }
  }

  async function handleEncerrar() {
    if (!encerrar) return;
    if (!resolucao.trim()) {
      toast.error("Informe o parecer de encerramento.");
      return;
    }
    setSalvandoEncerramento(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      await encerrarProtocoloDivergencia(encerrar.id, resolucao.trim(), auth?.user?.id || null);
      toast.success(`Protocolo ${encerrar.numero_protocolo} encerrado.`);
      setEncerrar(null);
      setResolucao("");
      if (detalhe?.id === encerrar.id) setDetalhe(null);
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível encerrar o protocolo.");
    } finally {
      setSalvandoEncerramento(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/60 border-b">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-primary" />
                Central de Devoluções & Protocolos de Divergência
              </CardTitle>
              <CardDescription>
                Auditoria de retorno de volumes, divergências e encerramento com parecer. Os registros permanecem
                rastreáveis mesmo após a finalização do serviço.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <ResumoBox label="Protocolos" valor={resumo.total} tone="bg-slate-50 text-slate-800 border-slate-200" />
            <ResumoBox label="Abertos" valor={resumo.abertas} tone="bg-red-50 text-red-800 border-red-200" />
            <ResumoBox label="Em análise" valor={resumo.analise} tone="bg-amber-50 text-amber-800 border-amber-200" />
            <ResumoBox label="Aguardando info" valor={resumo.aguardando} tone="bg-sky-50 text-sky-800 border-sky-200" />
            <ResumoBox label="Resolvidos" valor={resumo.resolvidas} tone="bg-emerald-50 text-emerald-800 border-emerald-200" />
            <ResumoBox label="Volumes divergentes" valor={resumo.divergentes} tone="bg-red-50 text-red-800 border-red-200" alerta={resumo.divergentes > 0} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar protocolo, OS, cliente ou prestador parceiro..."
              />
            </div>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as ProtocoloStatus | "todos")}>
              <SelectTrigger><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {STATUS_OPCOES.map((s) => <SelectItem key={s} value={s}>{PROTOCOLO_STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={prestadorId} onValueChange={setPrestadorId}>
              <SelectTrigger><SelectValue placeholder="Prestador parceiro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os prestadores parceiros</SelectItem>
                {prestadores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando protocolos...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Nenhum protocolo de divergência encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Serviço / OS</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Prestador parceiro</TableHead>
                    <TableHead className="text-center">Enviados</TableHead>
                    <TableHead className="text-center">Entregues</TableHead>
                    <TableHead className="text-center">Esperados</TableHead>
                    <TableHead className="text-center">Recebidos</TableHead>
                    <TableHead className="text-center">Divergente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((p) => (
                    <TableRow key={p.id} className={Number(p.quantidade_divergente) > 0 ? "bg-red-50/40" : ""}>
                      <TableCell>
                        <p className="font-mono text-xs font-semibold">{p.numero_protocolo}</p>
                        <p className="text-[11px] text-muted-foreground">{formatarDataHoraBR(p.created_at)}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{p.os_numero || "—"}</p>
                        <p className="text-[11px] text-muted-foreground">Status do serviço: {p.os_status || "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm">{p.cliente_nome || "—"}</TableCell>
                      <TableCell className="text-sm">{p.prestador_nome || "—"}</TableCell>
                      <TableCell className="text-center text-sm">{p.volumes_enviados}</TableCell>
                      <TableCell className="text-center text-sm">{p.volumes_entregues}</TableCell>
                      <TableCell className="text-center text-sm">{p.volumes_esperados_retorno}</TableCell>
                      <TableCell className="text-center text-sm">{p.volumes_recebidos_retorno}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex min-w-8 items-center justify-center rounded-md px-2 py-0.5 text-sm font-bold ${Number(p.quantidade_divergente) > 0 ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                          {p.quantidade_divergente}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={PROTOCOLO_STATUS_TONE[p.status]}>
                          {PROTOCOLO_STATUS_LABEL[p.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void abrirDetalhe(p)}>
                            <Eye className="w-3.5 h-3.5 mr-1" /> Detalhes
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setConferir(p); setVolumesRecebidos(String(p.volumes_recebidos_retorno || 0)); }}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Conferir retorno
                          </Button>
                          {p.status !== "resolvida" && (
                            <Button size="sm" className="h-8 text-xs" onClick={() => { setEncerrar(p); setResolucao(p.resolucao_notas || ""); }}>
                              Encerrar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(open) => { if (!open) setDetalhe(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-red-600" /> Protocolo {detalhe?.numero_protocolo}
            </DialogTitle>
            <DialogDescription>Auditoria de devolução e divergência de volumes.</DialogDescription>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <AuditoriaBox label="Enviados" valor={detalhe.volumes_enviados} />
                <AuditoriaBox label="Entregues" valor={detalhe.volumes_entregues} />
                <AuditoriaBox label="Esperados" valor={detalhe.volumes_esperados_retorno} />
                <AuditoriaBox label="Recebidos" valor={detalhe.volumes_recebidos_retorno} />
                <AuditoriaBox label="Divergente" valor={detalhe.quantidade_divergente} destaque />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <Info label="Serviço / OS" valor={detalhe.os_numero || "—"} />
                <Info label="Cliente" valor={detalhe.cliente_nome || "—"} />
                <Info label="Prestador parceiro" valor={detalhe.prestador_nome || "—"} />
                <Info label="Responsável pelo recebimento" valor={detalhe.responsavel_recebimento || "—"} />
                <Info label="Motivo" valor={detalhe.motivo || "—"} />
                <Info label="Observações" valor={detalhe.observacoes || "—"} />
              </div>

              {detalhe.latitude != null && detalhe.longitude != null && (
                <a
                  href={`https://www.google.com/maps?q=${detalhe.latitude},${detalhe.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 underline"
                >
                  <MapPin className="w-3.5 h-3.5" /> Ver localização no mapa
                </a>
              )}

              {(detalhe.fotos_paths || []).length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Fotos da ocorrência</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(detalhe.fotos_paths || []).map((path) => (
                      <a key={path} href={fotos[path] || "#"} target="_blank" rel="noreferrer" className="block rounded-lg border overflow-hidden aspect-square bg-slate-50">
                        {fotos[path] ? (
                          <img src={fotos[path] as string} alt="Evidência" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-xs text-muted-foreground">Carregando...</span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {detalhe.resolucao_notas && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
                  <p className="font-semibold text-emerald-800">Parecer de encerramento</p>
                  <p className="text-emerald-700 mt-1">{detalhe.resolucao_notas}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Select value={detalhe.status} onValueChange={(v) => void handleAlterarStatus(detalhe, v as ProtocoloStatus)}>
                  <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((s) => <SelectItem key={s} value={s}>{PROTOCOLO_STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => { setConferir(detalhe); setVolumesRecebidos(String(detalhe.volumes_recebidos_retorno || 0)); }}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Conferir retorno na base
                </Button>
                {detalhe.status !== "resolvida" && (
                  <Button onClick={() => { setEncerrar(detalhe); setResolucao(detalhe.resolucao_notas || ""); }}>
                    Encerrar protocolo
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conferir retorno */}
      <Dialog open={!!conferir} onOpenChange={(open) => { if (!open) setConferir(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conferir retorno na base</DialogTitle>
            <DialogDescription>
              {conferir?.numero_protocolo} · Serviço {conferir?.os_numero || "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Volumes recebidos no retorno</Label>
              <Input type="number" min={0} value={volumesRecebidos} onChange={(e) => setVolumesRecebidos(e.target.value)} />
            </div>
            <div>
              <Label>Responsável pela operação (recebimento)</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome de quem conferiu o retorno" />
            </div>
            <div>
              <Label>Observações da conferência</Label>
              <Textarea rows={3} value={observacoesConferencia} onChange={(e) => setObservacoesConferencia(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Esperados no retorno: <strong>{conferir?.volumes_esperados_retorno ?? 0}</strong>. A confirmação chama a RPC
              oficial e abre um novo protocolo se houver divergência.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConferir(null)} disabled={salvandoConferencia}>
              <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
            <Button onClick={() => void handleConferir()} disabled={salvandoConferencia}>
              {salvandoConferencia && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar conferência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Encerrar */}
      <Dialog open={!!encerrar} onOpenChange={(open) => { if (!open) setEncerrar(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar protocolo</DialogTitle>
            <DialogDescription>{encerrar?.numero_protocolo} · {encerrar?.cliente_nome || "Cliente"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Parecer de encerramento</Label>
              <Textarea rows={4} value={resolucao} onChange={(e) => setResolucao(e.target.value)} placeholder="Descreva a análise e a resolução da divergência..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncerrar(null)} disabled={salvandoEncerramento}>Cancelar</Button>
            <Button onClick={() => void handleEncerrar()} disabled={salvandoEncerramento}>
              {salvandoEncerramento && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Encerrar protocolo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResumoBox({ label, valor, tone, alerta }: { label: string; valor: number; tone: string; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
        {alerta && <AlertTriangle className="w-3.5 h-3.5" />}
      </div>
      <p className="text-2xl font-bold mt-1">{valor}</p>
    </div>
  );
}

function AuditoriaBox({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 text-center ${destaque ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${destaque ? "text-red-700" : "text-slate-500"}`}>{label}</p>
      <p className={`text-xl font-bold ${destaque ? "text-red-700" : "text-slate-800"}`}>{valor}</p>
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}
