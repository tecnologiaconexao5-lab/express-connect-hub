import { LucideIcon, Activity, Package, Truck, AlertTriangle, MapPin, Clock, Zap, Wifi, WifiOff, RefreshCw, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EntregaAoVivo {
  id: string;
  numero: string;
  status: string;
  regiao: string;
  eta: string;
  sla: number;
}

interface VeiculoOnline {
  id: string;
  placa: string;
  motorista: string;
  regiao: string;
  entregas: number;
  status: "em_rota" | "disponivel" | "em_coleta";
}

interface OcorrenciaRecente {
  id: string;
  tipo: string;
  descricao: string;
  regiao: string;
  created_at: string;
  prioridade: "alta" | "media" | "baixa";
}

interface PortalCentralVivaProps {
  entregasAtivas?: EntregaAoVivo[];
  veiculosOnline?: VeiculoOnline[];
  ocorrenciasRecentes?: OcorrenciaRecente[];
  isConnected?: boolean;
  onRefresh?: () => void;
}

export function PortalCentralViva({
  entregasAtivas = [],
  veiculosOnline = [],
  ocorrenciasRecentes = [],
  isConnected = true,
  onRefresh,
}: PortalCentralVivaProps) {
  const entregasEmRota = entregasAtivas.filter((e) => e.status === "em_rota").length;
  const entregasProgramadas = entregasAtivas.filter((e) => e.status === "programacao").length;
  const veiculosEmRota = veiculosOnline.filter((v) => v.status === "em_rota").length;
  const ocorrenciasAlta = ocorrenciasRecentes.filter((o) => o.prioridade === "alta").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            {isConnected && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111827]">Central Operacional Ao Vivo</h2>
            <p className="text-sm text-[#475569] font-medium">Monitoramento em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={isConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
            {isConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {isConnected ? "Conectado" : "Offline"}
          </Badge>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#111827] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-blue-50 border-blue-100 shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center relative">
            <Package className="w-6 h-6 mx-auto text-blue-600 mb-2" />
            <p className="text-3xl font-black text-slate-900">{entregasAtivas.length}</p>
            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Ativas</p>
            <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-100 shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center relative">
            <Truck className="w-6 h-6 mx-auto text-orange-600 mb-2" />
            <p className="text-3xl font-black text-slate-900">{entregasEmRota}</p>
            <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Em Rota</p>
            <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-100 shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-blue-600 mb-2" />
            <p className="text-3xl font-black text-slate-900">{entregasProgramadas}</p>
            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Programadas</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100 shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center relative">
            <Truck className="w-6 h-6 mx-auto text-emerald-600 mb-2" />
            <p className="text-3xl font-black text-slate-900">{veiculosEmRota}</p>
            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Veículos Online</p>
            <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100 shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center relative">
            <AlertTriangle className="w-6 h-6 mx-auto text-red-600 mb-2" />
            <p className="text-3xl font-black text-slate-900">{ocorrenciasAlta}</p>
            <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">Ocorrências</p>
            {ocorrenciasAlta > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200 shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <Zap className="w-6 h-6 mx-auto text-amber-600 mb-2" />
            <p className="text-3xl font-black text-slate-900">98%</p>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SLA Atual</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b bg-[#F8FAFC]">
            <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-900 uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-orange-600" />
              Entregas em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[400px] overflow-y-auto divide-y">
            {entregasAtivas.length > 0 ? (
              entregasAtivas.map((e, idx) => (
                <div
                  key={idx}
                  className="p-4 hover:bg-accent/30 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      e.status === "em_rota" ? "bg-emerald-500 animate-pulse" : "bg-blue-500 shadow-sm shadow-blue-500/20"
                    }`} />
                    <div>
                      <p className="text-sm font-black text-slate-900 tracking-tight">{e.numero}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{e.regiao}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{e.eta}</p>
                    <Badge variant="outline" className={`text-[10px] font-black uppercase mt-1 px-2 py-0 border-2 ${
                      e.sla >= 95 ? "border-emerald-500/20 text-emerald-600 bg-emerald-500/5" : 
                      e.sla >= 80 ? "border-amber-500/20 text-amber-600 bg-amber-500/5" : 
                      "border-red-500/20 text-red-600 bg-red-500/5"
                    }`}>
                      SLA {e.sla}%
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-[#F8FAFC]">
                <p className="text-sm font-medium text-[#64748B]">Nenhuma entrega ativa</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b bg-[#F8FAFC]">
            <CardTitle className="text-sm font-black flex items-center gap-2 text-[#111827] uppercase tracking-wider">
              <Truck className="w-4 h-4 text-emerald-600" />
              Veículos Online
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[400px] overflow-y-auto divide-y">
            {veiculosOnline.length > 0 ? (
              veiculosOnline.map((v, idx) => (
                <div
                  key={idx}
                  className="p-4 hover:bg-accent/30 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      v.status === "em_rota" ? "bg-emerald-500/10" : "bg-blue-500/10"
                    }`}>
                      <Truck className={`w-5 h-5 ${
                        v.status === "em_rota" ? "text-emerald-500" : "text-blue-500"
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 tracking-tight">{v.placa}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{v.motorista}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{v.entregas} entregas</p>
                    <Badge variant="outline" className={`text-[10px] font-black uppercase mt-1 px-2 py-0 border-2 ${
                      v.status === "em_rota" ? "border-emerald-500/20 text-emerald-600 bg-emerald-500/5" : "border-blue-500/20 text-blue-600 bg-blue-500/5"
                    }`}>
                      {v.status === "em_rota" ? "Em rota" : v.status === "em_coleta" ? "Em coleta" : "Disponível"}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-[#F8FAFC]">
                <p className="text-sm font-medium text-[#64748B]">Nenhum veículo online</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b bg-[#F8FAFC]">
            <CardTitle className="text-sm font-black flex items-center gap-2 text-[#111827] uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Ocorrências Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 max-h-[400px] overflow-y-auto space-y-4 divide-y-0">
            {ocorrenciasRecentes.length > 0 ? (
              ocorrenciasRecentes.map((o, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all ${
                    o.prioridade === "alta" ? "border-red-500 bg-red-500/5" :
                    o.prioridade === "media" ? "border-amber-500 bg-amber-500/5" :
                    "border-slate-300 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-slate-900 tracking-tight">{o.tipo}</span>
                    <Badge variant="outline" className={`text-[10px] font-black uppercase px-2 py-0 border-2 ${
                      o.prioridade === "alta" ? "border-red-100 text-red-700 bg-red-50" :
                      o.prioridade === "media" ? "border-orange-100 text-orange-700 bg-orange-50" :
                      "border-slate-100 text-slate-600 bg-slate-50"
                    }`}>
                      {o.prioridade}
                    </Badge>
                  </div>
                  <p className="text-xs font-bold text-slate-600 line-clamp-2 leading-relaxed">{o.descricao}</p>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#E5E7EB]">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#64748B] uppercase">
                      <MapPin className="w-3 h-3 text-[#64748B]" />
                      <span>{o.regiao}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#64748B] uppercase">
                      <Clock className="w-3 h-3 text-[#64748B]" />
                      <span>{new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-[#F8FAFC]">
                <p className="text-sm font-medium text-[#64748B]">Nenhuma ocorrência</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}