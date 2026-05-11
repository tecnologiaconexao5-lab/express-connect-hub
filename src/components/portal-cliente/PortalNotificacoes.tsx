import { LucideIcon, Bell, Mail, MessageSquare, Smartphone, Check, CheckCheck, Filter, Search, AlertTriangle, Package, DollarSign, Clock, CheckCircle, X, Trash2, FileCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: "entrega_concluida" | "ocorrencia" | "atraso" | "comprovante" | "boleto" | "os_criada" | "coleta_iniciada" | "motorista_definido" | "mensagem";
  canal: "whatsapp" | "email" | "portal" | "push";
  prioridade: "alta" | "media" | "baixa";
  lida: boolean;
  created_at: string;
  acao?: string;
}

interface PortalNotificacoesProps {
  onAction?: (notificacaoId: string, acao: string) => void;
}

const tipoConfig = {
  entrega_concluida: {
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    label: "Entrega Concluída",
  },
  ocorrencia: {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
    label: "Ocorrência",
  },
  atraso: {
    icon: Clock,
    color: "text-orange-600",
    bg: "bg-orange-50",
    label: "Atraso",
  },
  comprovante: {
    icon: FileCheck,
    color: "text-orange-600",
    bg: "bg-orange-50",
    label: "Comprovante",
  },
  boleto: {
    icon: DollarSign,
    color: "text-orange-600",
    bg: "bg-orange-50",
    label: "Boleto",
  },
  mensagem: {
    icon: MessageSquare,
    color: "text-orange-600",
    bg: "bg-orange-50",
    label: "Mensagem",
  },
  os_criada: {
    icon: Package,
    color: "text-blue-600",
    bg: "bg-blue-50",
    label: "OS Criada",
  },
  coleta_iniciada: {
    icon: Package,
    color: "text-orange-600",
    bg: "bg-orange-50",
    label: "Coleta Iniciada",
  },
  motorista_definido: {
    icon: MessageSquare,
    color: "text-blue-600",
    bg: "bg-blue-50",
    label: "Motorista Definido",
  },
};

const canalConfig = {
  whatsapp: { icon: MessageSquare, color: "text-emerald-600" },
  email: { icon: Mail, color: "text-blue-600" },
  portal: { icon: Bell, color: "text-orange-600" },
  push: { icon: Smartphone, color: "text-blue-600" },
};

const defaultNotificacoes: Notificacao[] = [
  { id: "1", titulo: "Entrega Concluída", mensagem: "OS-202610-1028 foi entregue com sucesso em São Paulo/SP", tipo: "entrega_concluida", canal: "whatsapp", prioridade: "baixa", lida: false, created_at: "2026-05-08T14:30:00", acao: "Ver OS" },
  { id: "2", titulo: "Ocorrência Registrada", mensagem: "Atraso por trânsito na entrega OS-202610-1045", tipo: "ocorrencia", canal: "portal", prioridade: "alta", lida: false, created_at: "2026-05-08T13:15:00", acao: "Ver Ocorrência" },
  { id: "3", titulo: "SLA em Risco", mensagem: "3 entregas com previsão para as próximas 2h podem atrasar", tipo: "atraso", canal: "portal", prioridade: "media", lida: false, created_at: "2026-05-08T12:00:00" },
  { id: "4", titulo: "Comprovante Anexado", mensagem: "Foto e assinatura da entrega OS-202610-1033 disponíveis", tipo: "comprovante", canal: "whatsapp", prioridade: "baixa", lida: true, created_at: "2026-05-08T10:45:00", acao: "Ver Comprovante" },
  { id: "5", titulo: "Boleto Vencendo", mensagem: "Fatura FAT-0046 vence em 5 dias - R$ 15.000,00", tipo: "boleto", canal: "email", prioridade: "media", lida: true, created_at: "2026-05-07T09:00:00", acao: "Ver Fatura" },
  { id: "6", titulo: "Nova OS Criada", mensagem: "OS-202610-1060 criada com sucesso", tipo: "os_criada", canal: "portal", prioridade: "baixa", lida: true, created_at: "2026-05-07T08:30:00" },
  { id: "7", titulo: "Motorista Atribuído", mensagem: "Carlos Silva foi designado para entrega OS-202610-1055", tipo: "motorista_definido", canal: "whatsapp", prioridade: "baixa", lida: true, created_at: "2026-05-06T16:20:00" },
  { id: "8", titulo: "Coleta Iniciada", mensagem: "Coleta OS-202610-1040 em andamento", tipo: "coleta_iniciada", canal: "portal", prioridade: "baixa", lida: true, created_at: "2026-05-06T14:00:00" },
];

export function PortalNotificacoes({ onAction }: PortalNotificacoesProps) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>(defaultNotificacoes);
  const [filtro, setFiltro] = useState<"todas" | "nao_lidas">("todas");
  const [busca, setBusca] = useState("");

  const filtradas = notificacoes.filter(n => {
    if (filtro === "nao_lidas" && n.lida) return false;
    if (busca && !n.titulo.toLowerCase().includes(busca.toLowerCase()) && !n.mensagem.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const marcarLida = (id: string) => {
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const marcarTodasLida = () => {
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const deletar = (id: string) => {
    setNotificacoes(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Central de Notificações</h2>
            <p className="text-sm font-bold text-slate-500">{naoLidas} notificações não lidas</p>
          </div>
        </div>
        <Button variant="outline" className="border-slate-200 text-slate-700 font-bold px-6 rounded-xl hover:bg-slate-50" onClick={marcarTodasLida}>
          <CheckCheck className="w-4 h-4 mr-2" />
          Marcar todas como lida
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar notificações por título ou mensagem..."
            className="pl-10 bg-white border-slate-200 text-slate-900 rounded-xl h-11 shadow-sm focus:ring-orange-500/20 focus:border-orange-500"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button
          variant={filtro === "todas" ? "default" : "outline"}
          className={filtro === "todas" ? "bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-100" : "border-slate-200 text-slate-600 font-bold"}
          onClick={() => setFiltro("todas")}
        >
          <Filter className="w-4 h-4 mr-1" />
          Todas
        </Button>
        <Button
          variant={filtro === "nao_lidas" ? "default" : "outline"}
          className={filtro === "nao_lidas" ? "bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-100" : "border-slate-200 text-slate-600 font-bold"}
          onClick={() => setFiltro("nao_lidas")}
        >
          Não lidas ({naoLidas})
        </Button>
      </div>

      <div className="space-y-3">
        {filtradas.map((n) => {
          const config = tipoConfig[n.tipo];
          const canal = canalConfig[n.canal];
          const Icon = config.icon;
          const CanalIcon = canal.icon;

          return (
            <Card
              key={n.id}
              className={`bg-white border-slate-200 rounded-2xl hover:border-orange-200 hover:shadow-md transition-all cursor-pointer ${
                !n.lida ? "border-l-4 border-l-orange-500" : ""
              }`}
              onClick={() => !n.lida && marcarLida(n.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-black text-slate-900 tracking-tight">{n.titulo}</h4>
                      {n.prioridade === "alta" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100 font-black uppercase">Alta</span>
                      )}
                      {!n.lida && (
                        <span className="w-2 h-2 rounded-full bg-orange-500 shadow-sm shadow-orange-500/40" />
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-600 line-clamp-2 leading-relaxed">{n.mensagem}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${canal.color} uppercase tracking-wider`}>
                        <CanalIcon className="w-3 h-3" />
                        {n.canal}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {new Date(n.created_at).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {n.acao && onAction && (
                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">{n.acao} →</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {onAction && n.acao && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-[#F97316]"
                        onClick={(e) => { e.stopPropagation(); onAction(n.id, n.acao!); }}
                      >
                        {n.acao}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-slate-400 hover:text-red-400"
                      onClick={(e) => { e.stopPropagation(); deletar(n.id); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtradas.length === 0 && (
          <Card className="bg-white border-[#E5E7EB] border-dashed rounded-2xl">
            <CardContent className="p-8 text-center">
              <Bell className="w-12 h-12 mx-auto text-[#64748B] mb-3" />
              <p className="text-sm text-[#475569]">Nenhuma notificação encontrada</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}