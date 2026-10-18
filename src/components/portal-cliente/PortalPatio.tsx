import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Truck, Clock, CheckCircle, AlertTriangle, MapPin, Bell, Package,
  FileText, ArrowRight, Pause, AlertCircle, Search, Filter, RefreshCw,
  Calendar, Timer, AlertOctagon, CheckSquare, XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { buscarStatusPatioCliente, obterMetricasPatio } from "@/services/patioService";
import { PATIO_STATUS_LABELS, type PatioCheckin, type PatioStatus } from "@/types/patio";
import { PortalEmptyState, PortalKpiCard } from "@/components/portal-cliente";

interface PortalPatioProps {
  clienteId: string;
  clienteNome?: string;
}

const iconMap: Record<string, any> = {
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Bell,
  Package,
  FileText,
  ArrowRight,
  Pause,
  AlertCircle,
  AlertOctagon,
  CheckSquare,
  XCircle,
};

export default function PortalPatio({ clienteId, clienteNome }: PortalPatioProps) {
  const [checkins, setCheckins] = useState<PatioCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PatioStatus | "todos">("todos");
  const [activeTab, setActiveTab] = useState("todos");
  const [metrics, setMetrics] = useState<{
    totalHoje: number;
    aguardando: number;
    emCarregamento: number;
    concluidosHoje: number;
    tempoMedioEspera: number;
    tempoMedioCarregamento: number;
    docasOcupadas: number;
  } | null>(null);

  const carregarDados = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setErro(null);
      const [checkinsData, metricsData] = await Promise.all([
        buscarStatusPatioCliente(clienteId),
        obterMetricasPatio(),
      ]);
      setCheckins(checkinsData);
      setMetrics(metricsData);
    } catch (error) {
      console.error("Erro ao carregar dados do pátio:", error);
      setErro("Não foi possível carregar os dados do pátio. Tente novamente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (clienteId) {
      carregarDados();
      const interval = setInterval(() => carregarDados(true), 60000);
      return () => clearInterval(interval);
    }
  }, [clienteId]);

  const checkinsFiltrados = checkins.filter((checkin) => {
    const matchSearch =
      checkin.veiculo_placa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checkin.motorista_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checkin.numero_os?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checkin.destino?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = statusFilter === "todos" || checkin.status === statusFilter;

    return matchSearch && matchStatus;
  });

  const checkinsPorStatus = {
    aguardando: checkins.filter((c) =>
      ["aguardando_fila", "aguardando_checkin", "aguardando_liberacao"].includes(c.status)
    ),
    emDoca: checkins.filter((c) =>
      ["em_doca", "carregamento_iniciado", "carregamento_pausado"].includes(c.status)
    ),
    carregando: checkins.filter((c) => c.status === "carregamento_iniciado"),
    liberados: checkins.filter((c) =>
      ["liberado_para_saida", "saiu_do_patio", "carregamento_concluido"].includes(c.status)
    ),
  };

  const formatarTempo = (minutos: number) => {
    if (minutos < 60) return `${minutos}min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h${mins > 0 ? ` ${mins}min` : ""}`;
  };

  const getStatusDetalhes = (status: PatioStatus) => {
    const detalhes = PATIO_STATUS_LABELS[status];
    const Icone = iconMap[detalhes.icone] || Truck;
    return { ...detalhes, Icone };
  };

  const calcularTempoExcedido = (checkin: PatioCheckin) => {
    if (!checkin.horario_chegada) return 0;
    const chegada = new Date(checkin.horario_chegada).getTime();
    const agora = Date.now();
    const minutosDecorridos = Math.floor((agora - chegada) / 60000);
    const sla = checkin.sla_espera_min || 120;
    return Math.max(0, minutosDecorridos - sla);
  };

  if (!clienteId) {
    return (
      <PortalEmptyState
        title="Cliente não identificado"
        description="Faça login novamente para acessar os dados do pátio."
        icon={Truck}
      />
    );
  }

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Carregando dados do pátio...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <PortalEmptyState
        title="Erro ao carregar"
        description={erro}
        icon={AlertCircle}
        actionLabel="Tentar novamente"
        onAction={() => carregarDados(true)}
      />
    );
  }

  if (checkins.length === 0) {
    return (
      <PortalEmptyState
        title="Nenhum veículo no pátio"
        description="Não há veículos da sua empresa no pátio no momento."
        icon={Truck}
        actionLabel="Atualizar"
        onAction={() => carregarDados(true)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Controle de Pátio
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Acompanhe em tempo real a posição dos seus veículos
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => carregarDados(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* KPIs */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <PortalKpiCard
            title="Veículos Hoje"
            value={metrics.totalHoje.toString()}
            icon={Truck}
            description="Total de check-ins hoje"
            trend="neutral"
          />
          <PortalKpiCard
            title="Aguardando"
            value={metrics.aguardando.toString()}
            icon={Clock}
            description="Na fila ou aguardando"
            trend={metrics.aguardando > 5 ? "negative" : "neutral"}
          />
          <PortalKpiCard
            title="Em Carregamento"
            value={metrics.emCarregamento.toString()}
            icon={Package}
            description="Veículos carregando"
            trend="positive"
          />
          <PortalKpiCard
            title="Concluídos Hoje"
            value={metrics.concluidosHoje.toString()}
            icon={CheckCircle}
            description="Operações finalizadas"
            trend="positive"
          />
        </div>
      )}

      {/* KPIs Secundários */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-slate-400" />
                Tempo Médio de Espera
              </CardDescription>
              <CardTitle className="text-2xl">
                {formatarTempo(Math.round(metrics.tempoMedioEspera))}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-400" />
                Tempo Médio de Carregamento
              </CardDescription>
              <CardTitle className="text-2xl">
                {formatarTempo(Math.round(metrics.tempoMedioCarregamento))}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                Docas Ocupadas
              </CardDescription>
              <CardTitle className="text-2xl">{metrics.docasOcupadas}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filtros e Busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por placa, motorista, OS ou destino..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as PatioStatus | "todos")}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {Object.entries(PATIO_STATUS_LABELS).map(([status, { label }]) => (
                    <SelectItem key={status} value={status}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs por Status */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="todos">
            Todos ({checkins.length})
          </TabsTrigger>
          <TabsTrigger value="aguardando">
            Aguardando ({checkinsPorStatus.aguardando.length})
          </TabsTrigger>
          <TabsTrigger value="em-doca">
            Em Doca ({checkinsPorStatus.emDoca.length})
          </TabsTrigger>
          <TabsTrigger value="liberados">
            Liberados ({checkinsPorStatus.liberados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="mt-4">
          <VeiculosLista
            checkins={checkinsFiltrados}
            getStatusDetalhes={getStatusDetalhes}
            formatarTempo={formatarTempo}
            calcularTempoExcedido={calcularTempoExcedido}
          />
        </TabsContent>

        <TabsContent value="aguardando" className="mt-4">
          <VeiculosLista
            checkins={checkinsPorStatus.aguardando.filter((c) =>
              searchTerm
                ? c.veiculo_placa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.motorista_nome?.toLowerCase().includes(searchTerm.toLowerCase())
                : true
            )}
            getStatusDetalhes={getStatusDetalhes}
            formatarTempo={formatarTempo}
            calcularTempoExcedido={calcularTempoExcedido}
          />
        </TabsContent>

        <TabsContent value="em-doca" className="mt-4">
          <VeiculosLista
            checkins={checkinsPorStatus.emDoca.filter((c) =>
              searchTerm
                ? c.veiculo_placa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.motorista_nome?.toLowerCase().includes(searchTerm.toLowerCase())
                : true
            )}
            getStatusDetalhes={getStatusDetalhes}
            formatarTempo={formatarTempo}
            calcularTempoExcedido={calcularTempoExcedido}
          />
        </TabsContent>

        <TabsContent value="liberados" className="mt-4">
          <VeiculosLista
            checkins={checkinsPorStatus.liberados.filter((c) =>
              searchTerm
                ? c.veiculo_placa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.motorista_nome?.toLowerCase().includes(searchTerm.toLowerCase())
                : true
            )}
            getStatusDetalhes={getStatusDetalhes}
            formatarTempo={formatarTempo}
            calcularTempoExcedido={calcularTempoExcedido}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface VeiculosListaProps {
  checkins: PatioCheckin[];
  getStatusDetalhes: (status: PatioStatus) => any;
  formatarTempo: (minutos: number) => string;
  calcularTempoExcedido: (checkin: PatioCheckin) => number;
}

function VeiculosLista({
  checkins,
  getStatusDetalhes,
  formatarTempo,
  calcularTempoExcedido,
}: VeiculosListaProps) {
  if (checkins.length === 0) {
    return (
      <PortalEmptyState
        title="Nenhum veículo encontrado"
        description="Não há veículos neste status no momento."
        icon={Truck}
      />
    );
  }

  return (
    <div className="grid gap-4">
      {checkins.map((checkin) => {
        const detalhes = getStatusDetalhes(checkin.status);
        const Icone = detalhes.Icone || Truck;
        const tempoExcedido = calcularTempoExcedido(checkin);

        return (
          <motion.div
            key={checkin.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-l-4" style={{ borderLeftColor: "var(--status-color)" }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <Icone className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {checkin.veiculo_placa || "Placa não informada"}
                        </h3>
                        <Badge variant="outline" className={detalhes.cor}>
                          {detalhes.label}
                        </Badge>
                        {checkin.prioridade && checkin.prioridade > 5 && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Prioridade
                          </Badge>
                        )}
                        {tempoExcedido > 0 && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertOctagon className="w-3 h-3" />
                            {formatarTempo(tempoExcedido)} excedido
                          </Badge>
                        )}
                      </div>

                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        {checkin.motorista_nome && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <MapPin className="w-4 h-4" />
                            <span>Motorista: {checkin.motorista_nome}</span>
                          </div>
                        )}
                        {checkin.destino && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <ArrowRight className="w-4 h-4" />
                            <span>Destino: {checkin.destino}</span>
                          </div>
                        )}
                        {checkin.numero_os && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <FileText className="w-4 h-4" />
                            <span>OS: {checkin.numero_os}</span>
                          </div>
                        )}
                        {checkin.doca_nome && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <MapPin className="w-4 h-4" />
                            <span>Doca: {checkin.doca_nome}</span>
                          </div>
                        )}
                        {checkin.posicao_fila && checkin.status.includes("aguardando") && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Clock className="w-4 h-4" />
                            <span>Posição na fila: #{checkin.posicao_fila}</span>
                          </div>
                        )}
                        {checkin.tempo_aguardando_min > 0 && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Timer className="w-4 h-4" />
                            <span>Esperando: {formatarTempo(checkin.tempo_aguardando_min)}</span>
                          </div>
                        )}
                        {checkin.tempo_carregando_min > 0 && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Package className="w-4 h-4" />
                            <span>Carregando: {formatarTempo(checkin.tempo_carregando_min)}</span>
                          </div>
                        )}
                        {checkin.horario_chegada && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Chegou: {new Date(checkin.horario_chegada).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      {checkin.observacao && (
                        <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400 mt-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{checkin.observacao}</span>
                        </div>
                      )}

                      {checkin.risco_atraso && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mt-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Risco de atraso identificado</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Bell className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Notificar sobre atualizações</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

// Select component simples para evitar import extra
function Select({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300"
    >
      {children}
    </select>
  );
}

function SelectTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function SelectValue({ placeholder }: { placeholder: string }) {
  return <span className="text-sm">{placeholder}</span>;
}

function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <option value={value} className="text-sm">
      {children}
    </option>
  );
}