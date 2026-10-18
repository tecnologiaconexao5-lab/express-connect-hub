import { Route, MapPin, Truck, Package, Clock, Navigation, AlertTriangle, CheckCircle, Fuel, Users, TrendingUp, Filter, RefreshCw, Eye, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { buscarRotas, buscarSaudeOperacional, buscarInsights, buscarParadasDaRota } from "@/services/portalCliente/roteirizacaoService";
import type { Rota, SaudeOperacional, InsightIA, Parada } from "@/services/portalCliente/roteirizacaoService";
import { PortalTrackingMap } from "./PortalTrackingMap";
import type { TrackingPosition } from "@/services/rastreamento/trackingService";

interface PortalRoteirizacaoProps {
  clienteId?: string;
  clienteNome?: string;
}

const statusCfg: Record<string, { label: string; color: string }> = {
  programacao: { label: "Programado", color: "bg-slate-100 text-slate-700" },
  pendente: { label: "Pendente", color: "bg-slate-100 text-slate-700" },
  aguardando_aceite: { label: "Aguardando Aceite", color: "bg-amber-50 text-amber-700" },
  aceita: { label: "Aceita", color: "bg-blue-50 text-blue-700" },
  coleta: { label: "Em Coleta", color: "bg-blue-50 text-blue-700" },
  em_rota: { label: "Em Rota", color: "bg-orange-50 text-orange-700" },
  saiu_para_rota: { label: "Saiu para Rota", color: "bg-orange-50 text-orange-700" },
  entrega_concluida: { label: "Entregue", color: "bg-emerald-50 text-emerald-700" },
  finalizada: { label: "Finalizada", color: "bg-emerald-50 text-emerald-700" },
  atrasada: { label: "Atrasada", color: "bg-red-50 text-red-700" },
  cancelada: { label: "Cancelada", color: "bg-red-50 text-red-700" },
  problema: { label: "Com Problema", color: "bg-red-50 text-red-700" },
};

export function PortalRoteirizacao({ clienteId, clienteNome }: PortalRoteirizacaoProps) {
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30dias");
  const [saude, setSaude] = useState<SaudeOperacional | null>(null);
  const [insights, setInsights] = useState<InsightIA[]>([]);
  const [selectedRota, setSelectedRota] = useState<Rota | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [trackingPos, setTrackingPos] = useState<TrackingPosition | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loadingParadas, setLoadingParadas] = useState(false);
  const [selectedParada, setSelectedParada] = useState<Parada | null>(null);
  const [showParadaDetail, setShowParadaDetail] = useState(false);
  const selectedRotaIdRef = useRef<string | null>(null);

  const carregarDados = useCallback(async () => {
    if (!clienteId) {
      setRotas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [rotasData, saudeData, insightsData] = await Promise.all([
        buscarRotas(clienteId, periodo),
        buscarSaudeOperacional(clienteId, periodo),
        buscarInsights(clienteId, clienteNome),
      ]);
      setRotas(rotasData);
      setSaude(saudeData);
      setInsights(insightsData);
    } catch {
      // fallback silencioso
    } finally {
      setLoading(false);
    }
  }, [clienteId, periodo, clienteNome]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    if (!clienteId) return;

    const channel = supabase
      .channel("portal-rotas-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "rotas",
        filter: `cliente_id=eq.${clienteId}`,
      }, () => {
        carregarDados();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "rota_paradas",
      }, () => {
        const rotaId = selectedRotaIdRef.current;
        if (rotaId) {
          buscarParadasDaRota(rotaId).then(setParadas);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteId, carregarDados]); // Estável — sem showDetail/selectedRota

  const handleVerDetalhes = async (rota: Rota) => {
    setSelectedRota(rota);
    setShowDetail(true);
    setTrackingPos(null);
    selectedRotaIdRef.current = rota.id;
    setParadas([]);
    setLoadingParadas(true);

    // Carregar paradas da rota
    buscarParadasDaRota(rota.id).then(p => setParadas(p)).finally(() => setLoadingParadas(false));

    if (rota.prestadorId) {
      try {
        const { data } = await supabase
          .from("portal_tracking_realtime")
          .select("latitude, longitude, velocidade, updated_at, status")
          .eq("alocacao_id", rota.id)
          .maybeSingle();
        if (data?.latitude && data?.longitude) {
          setTrackingPos({
            latitude: data.latitude,
            longitude: data.longitude,
            velocidade: data.velocidade,
            updated_at: data.updated_at,
            status: data.status,
          });
        }
      } catch {
        // tracking não disponível
      }
    }
  };

  const ativas = rotas.filter(r => ["coleta", "em_rota", "saiu_para_rota", "aceita"].includes(r.status));
  const concluidas = rotas.filter(r => r.status === "entrega_concluida" || r.status === "finalizada");
  const kmTotal = rotas.reduce((acc, r) => acc + (r.km || 0), 0);
  const tempoTotal = rotas.reduce((acc, r) => acc + (r.tempo || 0), 0);
  const veiculosUnicos = new Set(rotas.map(r => `${r.tipoVeiculo}-${r.placa}`).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[#111827]">Roteirização</h2>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
            {loading ? "..." : `${rotas.length} rota(s)`}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[140px] h-9 bg-white border-[#E5E7EB] text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border-[#E5E7EB]">
              <SelectItem value="7dias">7 dias</SelectItem>
              <SelectItem value="30dias">30 dias</SelectItem>
              <SelectItem value="90dias">90 dias</SelectItem>
              <SelectItem value="mes_atual">Mês atual</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-9 w-9 border-[#E5E7EB]" onClick={carregarDados}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <Package className="w-5 h-5 mx-auto text-orange-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{rotas.length}</p>
            <p className="text-[10px] text-[#64748B]">Entregas</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <MapPin className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{new Set(rotas.map(r => r.regiao)).size}</p>
            <p className="text-[10px] text-[#64748B]">Regiões</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <Navigation className="w-5 h-5 mx-auto text-blue-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{kmTotal}km</p>
            <p className="text-[10px] text-[#64748B]">Distância</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <Clock className="w-5 h-5 mx-auto text-amber-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{Math.floor(tempoTotal / 60)}h {tempoTotal % 60}min</p>
            <p className="text-[10px] text-[#64748B]">Tempo Est.</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <Truck className="w-5 h-5 mx-auto text-orange-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{veiculosUnicos}</p>
            <p className="text-[10px] text-[#64748B]">Veículos</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-cyan-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{saude?.ocupacao || 0}%</p>
            <p className="text-[10px] text-[#64748B]">Ocupação</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <CheckCircle className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{saude?.sla || 0}%</p>
            <p className="text-[10px] text-[#64748B]">SLA</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${
              (saude?.atrasos || 0) > 0 ? "text-red-500" : "text-emerald-500"
            }`} />
            <p className="text-xl font-bold text-[#111827]">{saude?.atrasos || 0}</p>
            <p className="text-[10px] text-[#64748B]">Atrasos</p>
          </CardContent>
        </Card>
      </div>

      {loading && rotas.length === 0 ? (
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-8 text-center">
            <Route className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-[#475569]">Carregando rotas...</p>
          </CardContent>
        </Card>
      ) : rotas.length === 0 ? (
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-8 text-center">
            <MapPin className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-medium text-[#475569]">Nenhuma rota encontrada</p>
            <p className="text-xs text-[#64748B] mt-1">Tente ampliar o período do filtro.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {ativas.length > 0 && (
            <Card className="bg-white border-orange-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#111827] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  Rotas em andamento ({ativas.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ativas.map((rota) => (
                    <RotaCard key={rota.id} rota={rota} onDetalhes={handleVerDetalhes} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-[#111827] flex items-center gap-2">
                <Route className="w-4 h-4 text-[#F97316]" />
                {ativas.length > 0 ? "Todas as rotas" : "Rotas"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {rotas.slice(0, 30).map((rota) => (
                  <Card key={rota.id} className="bg-white border-[#E5E7EB] rounded-xl shadow-sm hover:border-slate-300 transition-all cursor-pointer"
                    onClick={() => handleVerDetalhes(rota)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            rota.status === "entrega_concluida" || rota.status === "finalizada" ? "bg-emerald-50" :
                            rota.status === "em_rota" || rota.status === "saiu_para_rota" ? "bg-orange-50" :
                            "bg-slate-50"
                          }`}>
                            <Route className={`w-4 h-4 ${
                              rota.status === "entrega_concluida" || rota.status === "finalizada" ? "text-emerald-600" :
                              rota.status === "em_rota" || rota.status === "saiu_para_rota" ? "text-orange-600" :
                              "text-slate-500"
                            }`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[#111827] text-sm truncate">{rota.nome}</p>
                            <p className="text-[10px] text-[#64748B] truncate">{rota.regiao}</p>
                          </div>
                        </div>
                        <Badge className={`shrink-0 text-[10px] ${statusCfg[rota.status]?.color || "bg-slate-50 text-slate-600"}`}>
                          {statusCfg[rota.status]?.label || rota.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[#64748B] mb-3 flex-wrap">
                        {rota.motoristaNome && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {rota.motoristaNome}
                          </span>
                        )}
                        {rota.tipoVeiculo && (
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3" /> {rota.tipoVeiculo}
                          </span>
                        )}
                        {rota.placa && <span>{rota.placa}</span>}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3 text-[#64748B]">
                          {rota.km > 0 && (
                            <span className="flex items-center gap-1"><Navigation className="w-3 h-3" /> {rota.km}km</span>
                          )}
                          {rota.tempo > 0 && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.floor(rota.tempo / 60)}h{rota.tempo % 60}m</span>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#F97316]" />
                      </div>

                      {rota.origem && rota.destino && (
                        <div className="mt-2 p-2 bg-[#F8FAFC] rounded-lg text-[10px] text-[#64748B] leading-tight">
                          <span className="text-emerald-600">✓</span> {rota.origem.split(",")[0]} <span className="text-[#9CA3AF]">→</span> <span className="text-orange-600">■</span> {rota.destino.split(",")[0]}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {insights.length > 0 && (
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#111827] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#F97316]" />
              Insights Operacionais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.map((insight) => (
                <div key={insight.id} className={`p-3 rounded-lg text-sm ${
                  insight.prioridade === "alta" ? "bg-red-50 text-red-800" :
                  insight.prioridade === "media" ? "bg-amber-50 text-amber-800" :
                  "bg-blue-50 text-blue-800"
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">
                      {insight.tipo === "alerta" ? "⚠️" : insight.tipo === "sugestao" ? "💡" : "ℹ️"}
                    </span>
                    <div>
                      <p className="font-medium text-xs">{insight.titulo}</p>
                      <p className="text-[11px] opacity-80">{insight.descricao}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl bg-white border-[#E5E7EB] shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#111827]">
              <Route className="w-5 h-5 text-[#F97316]" />
              Detalhes da Rota
            </DialogTitle>
          </DialogHeader>
          {selectedRota && (
            <div className="space-y-4 py-4">
              <PortalTrackingMap
                driverName={selectedRota.motoristaNome}
                vehicle={selectedRota.tipoVeiculo}
                plate={selectedRota.placa}
                status={selectedRota.status}
                currentPosition={trackPosToTracking(selectedRota, trackingPos)}
                mapboxToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
                ultimaAtualizacao={trackingPos?.updated_at}
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoBox label="Motorista" value={selectedRota.motoristaNome || "N/I"} />
                <InfoBox label="Veículo" value={`${selectedRota.tipoVeiculo || "N/I"}${selectedRota.placa ? ` - ${selectedRota.placa}` : ""}`} />
                <InfoBox label="Status" value={statusCfg[selectedRota.status]?.label || selectedRota.status} />
                <InfoBox label="Distância" value={selectedRota.km > 0 ? `${selectedRota.km} km` : "N/I"} />
                <InfoBox label="Tempo" value={selectedRota.tempo > 0 ? `${Math.floor(selectedRota.tempo / 60)}h ${selectedRota.tempo % 60}min` : "N/I"} />
                <InfoBox label="Aceite" value={selectedRota.aceitePrestador ? "✅ Aceito" : (selectedRota.status === "cancelada" ? "❌ Cancelado" : "⏳ Pendente")} />
              </div>

              {selectedRota.origem && selectedRota.destino && (
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Percurso</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[#111827]">{selectedRota.origem}</span>
                    <span className="text-[#9CA3AF]">→</span>
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-[#111827]">{selectedRota.destino}</span>
                  </div>
                </div>
              )}

              {/* Paradas da Rota */}
              {paradas.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#64748B] uppercase flex items-center gap-2">
                    <Package className="w-3 h-3" />
                    Paradas ({paradas.filter(p => ["entregue","nao_entregue","cancelada","devolucao"].includes(p.status)).length}/{paradas.length})
                  </h4>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {paradas.map((p) => (
                      <div key={p.id} className="flex items-start gap-2 p-2 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] cursor-pointer hover:border-[#F97316] transition-colors"
                        onClick={() => { setSelectedParada(p); setShowParadaDetail(true); }}>
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F97316]/10 text-[#F97316] flex items-center justify-center text-xs font-bold">
                          {p.sequencia}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-[#111827] truncate">{p.cliente_nome || p.destinatario || "N/I"}</p>
                            <Badge className={`text-[10px] ${p.status === "entregue" || p.status === "finalizada" ? "bg-emerald-100 text-emerald-700" : p.status === "cancelada" || p.status === "devolucao" ? "bg-red-100 text-red-700" : p.status === "em_deslocamento" || p.status === "chegou" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>
                              {p.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-[#64748B] truncate">{p.endereco}{p.cidade ? `, ${p.cidade}` : ""}{p.uf ? `-${p.uf}` : ""}</p>
                          {p.volumes && <p className="text-xs text-[#64748B]">{p.volumes} volumes{p.peso ? ` | ${p.peso} kg` : ""}{p.volumes_entregues != null ? ` | ${p.volumes_entregues} entregues` : ""}</p>}
                          {p.janela_entrega && <p className="text-xs text-[#64748B]">Janela: {p.janela_entrega}</p>}
                          {p.recebedor && <p className="text-xs text-emerald-600">Recebedor: {p.recebedor}</p>}
                          {p.ocorrencia && <p className="text-xs text-red-500">Ocorrência: {p.ocorrencia}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {loadingParadas && (
                <div className="text-center py-4 text-xs text-[#64748B]">Carregando paradas...</div>
              )}
              <div className="flex justify-end gap-2">
                {selectedRota.temComprovante && (
                  <Button variant="outline" className="border-[#E5E7EB] text-xs" onClick={() => {
                    setShowDetail(false);
                  }}>
                    <Eye className="w-3 h-3 mr-1" /> Ver Comprovante
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Parada Detail Dialog */}
      <Dialog open={showParadaDetail} onOpenChange={setShowParadaDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#F97316]" />
              Parada #{selectedParada?.sequencia} — {selectedParada?.cliente_nome || selectedParada?.destinatario || "N/I"}
            </DialogTitle>
          </DialogHeader>
          {selectedParada && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <InfoBox label="Status" value={selectedParada.status || "Não informado"} />
                <InfoBox label="Pedido" value={selectedParada.pedido || "Não informado"} />
                <InfoBox label="NF" value={selectedParada.nota_fiscal || "Não informado"} />
                <InfoBox label="Destinatário" value={selectedParada.destinatario || selectedParada.cliente_nome || "Não informado"} />
                <InfoBox label="Contato" value={selectedParada.contato || "Não informado"} />
                <InfoBox label="Prioridade" value={selectedParada.prioridade || "Normal"} />
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border">
                <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Endereço</p>
                <p className="text-sm">{selectedParada.endereco}{selectedParada.numero ? `, ${selectedParada.numero}` : ""}</p>
                {selectedParada.bairro && <p className="text-xs text-[#64748B]">{selectedParada.bairro}</p>}
                <p className="text-xs text-[#64748B]">{selectedParada.cidade}{selectedParada.uf ? `-${selectedParada.uf}` : ""} {selectedParada.cep ? `CEP: ${selectedParada.cep}` : ""}</p>
                {selectedParada.latitude && selectedParada.longitude && (
                  <p className="text-xs text-[#64748B]">GPS: {selectedParada.latitude}, {selectedParada.longitude}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InfoBox label="Volumes" value={selectedParada.volumes_entregues != null ? `${selectedParada.volumes_entregues} de ${selectedParada.volumes || 0}` : `${selectedParada.volumes || 0} volumes`} />
                <InfoBox label="Peso" value={selectedParada.peso ? `${selectedParada.peso} kg` : "Não informado"} />
                <InfoBox label="Cubagem" value={selectedParada.cubagem ? `${selectedParada.cubagem} m³` : "Não informado"} />
                <InfoBox label="Tipo Carga" value={selectedParada.tipo_carga || selectedParada.temperatura || "Não informado"} />
                <InfoBox label="Janela" value={selectedParada.janela_entrega || "Livre"} />
                <InfoBox label="Instruções" value={selectedParada.instrucoes || "Nenhuma"} />
              </div>
              {selectedParada.recebedor && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-xs font-bold text-emerald-700 uppercase">Recebedor</p>
                  <p className="text-sm font-medium">{selectedParada.recebedor}</p>
                  {selectedParada.assinatura_url && <p className="text-xs text-emerald-600">✅ Assinatura registrada</p>}
                  {selectedParada.pod_url && <p className="text-xs text-emerald-600">✅ POD disponível</p>}
                  {selectedParada.fotos && Array.isArray(selectedParada.fotos) && selectedParada.fotos.length > 0 && (
                    <p className="text-xs text-emerald-600">📷 {selectedParada.fotos.length} foto(s)</p>
                  )}
                </div>
              )}
              {selectedParada.ocorrencia && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs font-bold text-red-700 uppercase">Ocorrência</p>
                  <p className="text-sm">{selectedParada.ocorrencia}</p>
                </div>
              )}
              {selectedParada.observacoes && (
                <div className="p-3 bg-[#F8FAFC] rounded-lg border">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Observações</p>
                  <p className="text-sm">{selectedParada.observacoes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RotaCard({ rota, onDetalhes }: { rota: Rota; onDetalhes: (r: Rota) => void }) {
  return (
    <Card className="bg-orange-50/50 border-orange-200 rounded-xl shadow-sm cursor-pointer hover:border-orange-300 transition-all"
      onClick={() => onDetalhes(rota)}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
            <p className="font-medium text-sm text-[#111827] truncate">{rota.nome}</p>
          </div>
          <Badge className="bg-orange-100 text-orange-700 text-[10px] shrink-0">{statusCfg[rota.status]?.label || rota.status}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#64748B]">
          {rota.motoristaNome && <span>{rota.motoristaNome}</span>}
          {rota.tipoVeiculo && <span>{rota.tipoVeiculo} {rota.placa}</span>}
        </div>
        {rota.km > 0 && (
          <p className="text-xs text-[#64748B] mt-1">{rota.km} km</p>
        )}
      </CardContent>
    </Card>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
      <p className="text-[10px] font-bold text-[#64748B] uppercase">{label}</p>
      <p className="text-sm font-medium text-[#111827]">{value}</p>
    </div>
  );
}

function trackPosToTracking(rota: Rota, trackingPos: TrackingPosition | null): TrackingPosition | undefined {
  if (trackingPos) return trackingPos;
  return undefined;
}
