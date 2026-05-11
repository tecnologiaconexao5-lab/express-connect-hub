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

const defaultMensagens: MensagemWhatsApp[] = [
  { id: "1", destinatario: "João Silva Santos", telefone: "(11) 99999-8888", mensagem: "Sua entrega OS-202610-1028 está a caminho! 🚚 Acompanhe em: https://rastreio.conexaoexpress.com/abc123", tipo: "rastreio", status: "lida", dataEnvio: "2026-05-08T14:30:00", osReferencia: "OS-202610-1028", linkRastreio: "https://rastreio.conexaoexpress.com/abc123" },
  { id: "2", destinatario: "Maria Oliveira", telefone: "(11) 98888-7777", mensagem: "📦 Seu pedido foi entregue! Assinatura registrada por: Carlos Manager. Muito obrigado pela preferência!", tipo: "comprovante", status: "lida", dataEnvio: "2026-05-08T13:45:00", osReferencia: "OS-202610-1028" },
  { id: "3", destinatario: "Pedro Santos", telefone: "(41) 97777-6666", mensagem: "✅ Sua OS-202610-1033 foi confirmada! Previsão de entrega: 15/05/2026", tipo: "confirmacao", status: "entregue", dataEnvio: "2026-05-07T10:00:00", osReferencia: "OS-202610-1033" },
  { id: "4", destinatario: "Ricardo Costa", telefone: "(71) 9999-0000", mensagem: "⚠️ Atenção: Sua entrega OS-202610-1015 está com atraso. Estamos tomando medidas para resolver.", tipo: "alerta", status: "lida", dataEnvio: "2026-05-06T16:00:00", osReferencia: "OS-202610-1015" },
  { id: "5", destinatario: "Ana Paula", telefone: "(81) 4444-5555", mensagem: "📋 Lembrete: Sua coleta OS-202610-1040 está agendada para amanhã às 08:00.", tipo: "aviso", status: "entregue", dataEnvio: "2026-05-05T18:00:00", osReferencia: "OS-202610-1040" },
  { id: "6", destinatario: "Carlos Manager", telefone: "(31) 3333-4444", mensagem: "🔗 Link de rastreamento: https://rastreio.conexaoexpress.com/xyz789 - Use para acompanhar sua entrega em tempo real", tipo: "rastreio", status: "enviada", dataEnvio: "2026-05-08T15:00:00", osReferencia: "OS-202610-1060", linkRastreio: "https://rastreio.conexaoexpress.com/xyz789" },
];

export function PortalWhatsApp({ onVerMensagem }: PortalWhatsAppProps) {
  const mensagensEnviadas = defaultMensagens.length;
  const mensagensLidas = defaultMensagens.filter(m => m.status === "lida" || m.status === "entregue").length;
  const taxaLeitura = Math.round((mensagensLidas / mensagensEnviadas) * 100);

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
            <p className="text-2xl font-bold text-[#111827]">{mensagensEnviadas - 2}</p>
            <p className="text-xs text-[#64748B]">Rastreio</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <Image className="w-6 h-6 mx-auto text-cyan-600 mb-2" />
            <p className="text-2xl font-bold text-[#111827]">1</p>
            <p className="text-xs text-[#64748B]">Comprovantes</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-orange-600 mb-2" />
            <p className="text-2xl font-bold text-[#111827]">2</p>
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
