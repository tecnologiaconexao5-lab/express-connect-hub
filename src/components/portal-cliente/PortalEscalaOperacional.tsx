import { useState, useEffect, useCallback } from "react";
import { Truck, CheckCircle, Clock, AlertTriangle, MapPin, Phone, X, ChevronLeft, ChevronRight, FileText, Snowflake, Calendar, Search, User, FileCheck, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { buscarEscalaCliente, buscarDetalheAlocacaoCliente, type AlocacaoClienteResumo, type DetalheAlocacaoCliente } from "@/services/portalCliente/portalClienteService";

interface PortalEscalaOperacionalProps {
  clienteId?: string;
  onContatarMotorista?: (telefone: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  pendente: { label: "Pendente", bg: "bg-slate-100", text: "text-slate-700", icon: Clock },
  confirmada: { label: "Confirmada", bg: "bg-purple-100", text: "text-purple-700", icon: CheckCircle },
  em_andamento: { label: "Em Andamento", bg: "bg-blue-100", text: "text-blue-700", icon: Truck },
  concluida: { label: "Concluída", bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle },
  cancelada: { label: "Cancelada", bg: "bg-red-100", text: "text-red-700", icon: X },
  aguardando: { label: "Aguardando", bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
};

const PERIODOS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "15d", label: "Últimos 15 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "60d", label: "Últimos 60 dias" },
];

const STATUS_FILTRO = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendentes" },
  { value: "confirmada", label: "Confirmadas" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "concluida", label: "Concluídas" },
  { value: "cancelada", label: "Canceladas" },
];

export function PortalEscalaOperacional({ clienteId, onContatarMotorista }: PortalEscalaOperacionalProps) {
  const [alocacoes, setAlocacoes] = useState<AlocacaoClienteResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30d");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [selectedAlocacaoId, setSelectedAlocacaoId] = useState<string | null>(null);
  const [detalheAlocacao, setDetalheAlocacao] = useState<DetalheAlocacaoCliente | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const ITENS_POR_PAGINA = 10;

  const carregarEscala = useCallback(async () => {
    if (!clienteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await buscarEscalaCliente(clienteId, { periodo });
      setAlocacoes(data);
    } catch {
      setAlocacoes([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, periodo]);

  useEffect(() => {
    carregarEscala();
  }, [carregarEscala]);

  const abrirDetalhe = async (alocacaoId: string) => {
    setSelectedAlocacaoId(alocacaoId);
    setLoadingDetalhe(true);
    try {
      const detalhe = await buscarDetalheAlocacaoCliente(alocacaoId);
      setDetalheAlocacao(detalhe);
    } catch {
      setDetalheAlocacao(null);
    } finally {
      setLoadingDetalhe(false);
    }
  };

  const filtered = alocacoes.filter((a) => {
    if (filtroStatus !== "todos" && a.status !== filtroStatus) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (
        !a.motorista_nome?.toLowerCase().includes(q) &&
        !a.origem?.toLowerCase().includes(q) &&
        !a.destino?.toLowerCase().includes(q) &&
        !a.veiculo_placa?.toLowerCase().includes(q) &&
        !a.os_numero?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const paginadas = filtered.slice(paginaSegura * ITENS_POR_PAGINA, (paginaSegura + 1) * ITENS_POR_PAGINA);

  const total = alocacoes.length;
  const emAndamento = alocacoes.filter((a) => a.status === "em_andamento").length;
  const pendentes = alocacoes.filter((a) => a.status === "pendente" || a.status === "aguardando").length;
  const concluidas = alocacoes.filter((a) => a.status === "concluida").length;
  const comPOD = alocacoes.filter((a) => a.tem_pod).length;
  const comTracking = alocacoes.filter((a) => a.tem_tracking).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#111827]">Programação Operacional</h2>
        <div className="flex items-center gap-2 text-sm text-[#475569]">
          <span>{total} registro(s)</span>
          {!loading && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={carregarEscala}>
              <Calendar className="w-3 h-3 mr-1" /> Atualizar
            </Button>
          )}
        </div>
      </div>

      {!clienteId ? (
        <Card className="bg-amber-50 border-amber-200 rounded-2xl">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
            <p className="text-sm text-amber-800">Cliente não identificado. Faça login como cliente para ver a programação operacional.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="bg-white border-[#E5E7EB] rounded-2xl animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <Truck className="w-5 h-5 mx-auto text-[#F97316] mb-1" />
                <p className="text-xl font-bold text-[#111827]">{total}</p>
                <p className="text-[10px] text-[#64748B]">Total</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <Truck className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                <p className="text-xl font-bold text-[#111827]">{emAndamento}</p>
                <p className="text-[10px] text-[#64748B]">Em Andamento</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <Clock className="w-5 h-5 mx-auto text-amber-600 mb-1" />
                <p className="text-xl font-bold text-[#111827]">{pendentes}</p>
                <p className="text-[10px] text-[#64748B]">Pendentes</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <CheckCircle className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
                <p className="text-xl font-bold text-[#111827]">{concluidas}</p>
                <p className="text-[10px] text-[#64748B]">Concluídas</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <FileCheck className="w-5 h-5 mx-auto text-cyan-600 mb-1" />
                <p className="text-xl font-bold text-[#111827]">{comPOD}</p>
                <p className="text-[10px] text-[#64748B]">Com POD</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <MapPin className="w-5 h-5 mx-auto text-indigo-600 mb-1" />
                <p className="text-xl font-bold text-[#111827]">{comTracking}</p>
                <p className="text-[10px] text-[#64748B]">Com Tracking</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#64748B]" />
              <Select value={periodo} onValueChange={(v) => { setPeriodo(v); setPagina(0); }}>
                <SelectTrigger className="w-40 h-8 text-sm bg-white border-[#E5E7EB]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPagina(0); }}>
              <SelectTrigger className="w-36 h-8 text-sm bg-white border-[#E5E7EB]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTRO.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input
                placeholder="Buscar motorista, placa, origem..."
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
                className="pl-8 h-8 text-sm bg-white border-[#E5E7EB]"
              />
            </div>
          </div>

          {paginadas.length === 0 ? (
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="text-lg font-medium text-[#111827] mb-1">Nenhuma alocação encontrada</h3>
                <p className="text-sm text-[#64748B]">Nenhum registro de programação para o período e filtros selecionados.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {paginadas.map((aloc) => {
                const st = STATUS_CONFIG[aloc.status] || STATUS_CONFIG.pendente;
                const StIcon = st.icon;
                return (
                  <Card
                    key={aloc.id}
                    className="bg-white border-[#E5E7EB] hover:border-[#CBD5E1] transition-all cursor-pointer rounded-2xl"
                    onClick={() => abrirDetalhe(aloc.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl ${st.bg} flex items-center justify-center`}>
                            <StIcon className={`w-5 h-5 ${st.text}`} />
                          </div>
                          <div>
                            <p className="font-medium text-[#111827] text-sm">
                              {aloc.origem} → {aloc.destino}
                            </p>
                            <p className="text-xs text-[#64748B]">
                              {new Date(aloc.data_escala).toLocaleDateString("pt-BR")}
                              {aloc.os_numero && ` • OS #${aloc.os_numero}`}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${st.bg} ${st.text} text-xs`}>
                          {st.label}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        <div className="p-2 bg-[#F8FAFC] rounded-lg">
                          <p className="text-[10px] text-[#64748B]">Motorista</p>
                          <p className="text-sm text-[#111827] truncate">{aloc.motorista_nome || "—"}</p>
                        </div>
                        <div className="p-2 bg-[#F8FAFC] rounded-lg">
                          <p className="text-[10px] text-[#64748B]">Veículo</p>
                          <p className="text-sm text-[#111827]">{aloc.veiculo_tipo && aloc.veiculo_placa ? `${aloc.veiculo_tipo} • ${aloc.veiculo_placa}` : aloc.veiculo_placa || aloc.veiculo_tipo || "—"}</p>
                        </div>
                        <div className="p-2 bg-[#F8FAFC] rounded-lg">
                          <p className="text-[10px] text-[#64748B]">SLA</p>
                          <p className="text-sm text-[#111827]">{aloc.sla_status || "—"}</p>
                        </div>
                        <div className="p-2 bg-[#F8FAFC] rounded-lg">
                          <p className="text-[10px] text-[#64748B]">POD</p>
                          <p className="text-sm text-[#111827]">{aloc.tem_pod ? "✓ Entregue" : "—"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {aloc.tem_tracking && (
                            <Badge variant="outline" className="border-blue-200 text-blue-700 text-[10px]">
                              <MapPin className="w-3 h-3 mr-1" /> Ao vivo
                            </Badge>
                          )}
                          {aloc.aceite_prestador && (
                            <Badge variant="outline" className="border-emerald-200 text-emerald-700 text-[10px]">
                              <CheckCircle className="w-3 h-3 mr-1" /> Aceito
                            </Badge>
                          )}
                          {aloc.tipo_reversa && (
                            <Badge variant="outline" className="border-purple-200 text-purple-700 text-[10px]">
                              Reversa
                            </Badge>
                          )}
                        </div>

                        {aloc.motorista_telefone && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-[#64748B] hover:text-[#F97316]"
                            onClick={(e) => {
                              e.stopPropagation();
                              onContatarMotorista?.(aloc.motorista_telefone!);
                            }}
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 bg-white border-[#E5E7EB]"
                disabled={paginaSegura === 0}
                onClick={() => setPagina(paginaSegura - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-[#64748B]">
                {paginaSegura + 1} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 bg-white border-[#E5E7EB]"
                disabled={paginaSegura >= totalPaginas - 1}
                onClick={() => setPagina(paginaSegura + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          <Dialog open={!!selectedAlocacaoId} onOpenChange={(open) => { if (!open) { setSelectedAlocacaoId(null); setDetalheAlocacao(null); } }}>
            <DialogContent className="max-w-2xl bg-white border-[#E5E7EB] shadow-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg text-[#111827]">
                  {detalheAlocacao ? (
                    <span>
                      {detalheAlocacao.alocacao?.origem || "Origem"} → {detalheAlocacao.alocacao?.destino || "Destino"}
                    </span>
                  ) : "Detalhes da Alocação"}
                </DialogTitle>
              </DialogHeader>

              {loadingDetalhe ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 bg-slate-200 animate-pulse rounded w-full" />
                  ))}
                </div>
              ) : detalheAlocacao ? (
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Data</p>
                      <p className="text-sm text-[#111827]">{new Date(detalheAlocacao.alocacao.data_escala).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Status</p>
                      {(() => {
                        const s = STATUS_CONFIG[detalheAlocacao.alocacao.status] || STATUS_CONFIG.pendente;
                        return <Badge className={`${s.bg} ${s.text}`}>{s.label}</Badge>;
                      })()}
                    </div>
                    <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Motorista</p>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#64748B]" />
                        <p className="text-sm text-[#111827]">{detalheAlocacao.alocacao.motorista_nome || "—"}</p>
                      </div>
                      {detalheAlocacao.alocacao.motorista_telefone && (
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-[#F97316] p-0 mt-1"
                          onClick={() => onContatarMotorista?.(detalheAlocacao.alocacao.motorista_telefone!)}
                        >
                          <Phone className="w-3 h-3 mr-1" /> Ligar
                        </Button>
                      )}
                    </div>
                    <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Veículo</p>
                      <p className="text-sm text-[#111827]">
                        {detalheAlocacao.alocacao.veiculo_tipo && detalheAlocacao.alocacao.veiculo_placa
                          ? `${detalheAlocacao.alocacao.veiculo_tipo} • ${detalheAlocacao.alocacao.veiculo_placa}`
                          : detalheAlocacao.alocacao.veiculo_placa || detalheAlocacao.alocacao.veiculo_tipo || "—"}
                      </p>
                    </div>
                  </div>

                  {detalheAlocacao.os && (
                    <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB] space-y-2">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Ordem de Serviço
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <p><span className="text-[#64748B]">Nº:</span> {detalheAlocacao.os.numero}</p>
                        <p><span className="text-[#64748B]">Status:</span> {detalheAlocacao.os.status}</p>
                        {detalheAlocacao.os.carga_descricao && (
                          <p className="col-span-2"><span className="text-[#64748B]">Carga:</span> {detalheAlocacao.os.carga_descricao}</p>
                        )}
                        {detalheAlocacao.os.ref_cliente && (
                          <p className="col-span-2"><span className="text-[#64748B]">Ref. Cliente:</span> {detalheAlocacao.os.ref_cliente}</p>
                        )}
                        {detalheAlocacao.alocacao.tipo_reversa && (
                          <p className="col-span-2">
                            <span className="text-[#64748B]">Reversa:</span> {detalheAlocacao.alocacao.tipo_reversa}
                            {detalheAlocacao.alocacao.reversa_status && ` (${detalheAlocacao.alocacao.reversa_status})`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {detalheAlocacao.pod ? (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                        <FileCheck className="w-3 h-3" /> Comprovante de Entrega (POD)
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {detalheAlocacao.pod.nome_recebedor && (
                          <p><span className="text-emerald-700">Recebedor:</span> {detalheAlocacao.pod.nome_recebedor}</p>
                        )}
                        {detalheAlocacao.pod.data_hora_entrega && (
                          <p><span className="text-emerald-700">Data:</span> {new Date(detalheAlocacao.pod.data_hora_entrega).toLocaleString("pt-BR")}</p>
                        )}
                        {detalheAlocacao.pod.documento_recebedor && (
                          <p className="col-span-2"><span className="text-emerald-700">Doc.:</span> {detalheAlocacao.pod.documento_recebedor}</p>
                        )}
                        {detalheAlocacao.pod.observacao && (
                          <p className="col-span-2"><span className="text-emerald-700">Obs.:</span> {detalheAlocacao.pod.observacao}</p>
                        )}
                      </div>
                      {(detalheAlocacao.pod.foto_entrega_url || detalheAlocacao.pod.foto_canhoto_url || detalheAlocacao.pod.assinatura_url) && (
                        <div className="flex gap-2 mt-2">
                          {detalheAlocacao.pod.foto_entrega_url && (
                            <a href={detalheAlocacao.pod.foto_entrega_url} target="_blank" rel="noopener noreferrer">
                              <Badge className="bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200">
                                <Eye className="w-3 h-3 mr-1" /> Foto
                              </Badge>
                            </a>
                          )}
                          {detalheAlocacao.pod.foto_canhoto_url && (
                            <a href={detalheAlocacao.pod.foto_canhoto_url} target="_blank" rel="noopener noreferrer">
                              <Badge className="bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200">
                                <Eye className="w-3 h-3 mr-1" /> Canhoto
                              </Badge>
                            </a>
                          )}
                          {detalheAlocacao.pod.assinatura_url && (
                            <a href={detalheAlocacao.pod.assinatura_url} target="_blank" rel="noopener noreferrer">
                              <Badge className="bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200">
                                <Eye className="w-3 h-3 mr-1" /> Assinatura
                              </Badge>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-xs text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Ainda sem comprovante de entrega registrado.
                      </p>
                    </div>
                  )}

                  {detalheAlocacao.ocorrencias.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase">Ocorrências ({detalheAlocacao.ocorrencias.length})</p>
                      {detalheAlocacao.ocorrencias.map((oc) => (
                        <div key={oc.id} className="p-2 bg-red-50 rounded-lg border border-red-100">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-red-800">{oc.tipo}</p>
                            <Badge className={`text-[10px] ${oc.prioridade === "alta" || oc.prioridade === "critica" ? "bg-red-200 text-red-800" : "bg-amber-100 text-amber-700"}`}>
                              {oc.prioridade}
                            </Badge>
                          </div>
                          {oc.descricao && <p className="text-xs text-red-700 mt-1">{oc.descricao}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {detalheAlocacao.alocacao.tem_tracking && (
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-xs text-blue-700 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> Tracking disponível — acompanhe a localização em tempo real na aba Rastreamento.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#64748B] py-4 text-center">Não foi possível carregar os detalhes.</p>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" className="bg-white border-[#E5E7EB]" onClick={() => { setSelectedAlocacaoId(null); setDetalheAlocacao(null); }}>
                  Fechar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
