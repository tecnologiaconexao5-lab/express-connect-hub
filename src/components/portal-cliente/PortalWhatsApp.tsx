import { LucideIcon, MessageSquare, Send, CheckCheck, Clock, MapPin, Package, Phone, Image, FileText, Link, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MensagemWhatsApp {
  id: string;
  destinatario: string;
  telefone: string;
  mensagem: string;
  tipo: "rastreio" | "comprovante" | "confirmacao" | "alerta" | "aviso";
  status: "enviada" | "entregue" | "lida" | "falhou";
  dataEnvio: string;
  osReferencia?: string;
  linkRastreio?: string;
}

interface PortalWhatsAppProps {
  onVerMensagem?: (mensagemId: string) => void;
}

const statusConfig = {
  enviada: { icon: Send, color: "text-slate-500", label: "Enviada" },
  entregue: { icon: CheckCheck, color: "text-blue-600", label: "Entregue" },
  lida: { icon: CheckCircle, color: "text-emerald-600", label: "Lida" },
  falhou: { icon: AlertCircle, color: "text-red-600", label: "Falhou" },
};

const tipoConfig = {
  rastreio: { icon: MapPin, color: "text-emerald-600 bg-emerald-50", label: "Rastreio" },
  comprovante: { icon: Image, color: "text-purple-600 bg-purple-50", label: "Comprovante" },
  confirmacao: { icon: CheckCircle, color: "text-blue-600 bg-blue-50", label: "Confirmação" },
  alerta: { icon: AlertCircle, color: "text-amber-600 bg-amber-50", label: "Alerta" },
  aviso: { icon: FileText, color: "text-slate-600 bg-slate-100", label: "Aviso" },
};

const defaultMensagens: MensagemWhatsApp[] = [];

export function PortalWhatsApp({ onVerMensagem }: PortalWhatsAppProps) {
  const mensagensEnviadas = defaultMensagens.length;
  const mensagensLidas = defaultMensagens.filter(m => m.status === "lida" || m.status === "entregue").length;
  const taxaLeitura = mensagensEnviadas > 0 ? Math.round((mensagensLidas / mensagensEnviadas) * 100) : 0;
  const qtdRastreio = defaultMensagens.filter(m => m.tipo === "rastreio").length;
  const qtdComprovante = defaultMensagens.filter(m => m.tipo === "comprovante").length;
  const qtdPendentes = defaultMensagens.filter(m => m.status === "enviada").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111827]">Central WhatsApp</h2>
            <p className="text-sm text-[#475569]">Mensagens enviadas via API</p>
          </div>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse" />
          API Ativa
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <MessageSquare className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
            <p className="text-2xl font-bold text-[#111827]">{mensagensEnviadas}</p>
            <p className="text-xs text-[#64748B]">Enviadas</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-[#111827]">{mensagensLidas}</p>
            <p className="text-xs text-[#64748B]">Entregues</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <CheckCheck className="w-6 h-6 mx-auto text-emerald-600 mb-2" />
            <p className="text-2xl font-bold text-[#111827]">{taxaLeitura}%</p>
            <p className="text-xs text-[#64748B]">Taxa Leitura</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <MapPin className="w-6 h-6 mx-auto text-purple-600 mb-2" />
            <p className="text-2xl font-bold text-[#111827]">{qtdRastreio}</p>
            <p className="text-xs text-[#64748B]">Rastreio</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <Image className="w-6 h-6 mx-auto text-cyan-600 mb-2" />
            <p className="text-2xl font-bold text-[#111827]">{qtdComprovante}</p>
            <p className="text-xs text-[#64748B]">Comprovantes</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-orange-600 mb-2" />
            <p className="text-2xl font-bold text-[#111827]">{qtdPendentes}</p>
            <p className="text-xs text-[#64748B]">Pendentes</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-500" />
            Timeline de Disparo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {defaultMensagens.map((m) => {
            const status = statusConfig[m.status];
            const tipo = tipoConfig[m.tipo];
            const StatusIcon = status.icon;
            const TipoIcon = tipo.icon;

            return (
              <div
                key={m.id}
                className="p-3 bg-white border border-[#E5E7EB] rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onVerMensagem?.(m.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {m.destinatario.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[#111827]">{m.destinatario}</span>
                      <Badge className={`${tipo.color} text-[10px]`}>
                        <TipoIcon className="w-3 h-3 mr-1" />
                        {tipo.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#475569] line-clamp-2">{m.mensagem}</p>
                    {m.osReferencia && (
                      <p className="text-[10px] text-[#F97316] mt-1">{m.osReferencia}</p>
                    )}
                    {m.linkRastreio && (
                      <div className="flex items-center gap-1 mt-1">
                        <Link className="w-3 h-3 text-blue-600" />
                        <span className="text-[10px] text-blue-600">Link de rastreio</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <StatusIcon className={`w-3 h-3 ${status.color}`} />
                      {status.label}
                    </div>
                    <p className="text-[10px] text-[#64748B] mt-1">
                      {new Date(m.dataEnvio).toLocaleString("pt-BR", { day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-emerald-50 border-emerald-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-emerald-700">Integração Evolution API / n8n</p>
              <p className="text-xs text-[#475569] mt-1">
                Sistema preparado para receber mensagens via webhook. Configure sua API em Configurações → Integrações.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
