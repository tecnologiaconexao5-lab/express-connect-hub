// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO 46 — PORTAL DO DESTINATÁRIO (RASTREAMENTO PÚBLICO)
// Rota: /rastreamento/:token
// Mostra status, previsão e timeline simples — sem dados internos ou financeiros
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Package, MapPin, Clock, CheckCircle, Truck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { obterOSPorToken } from "@/services/communicationHubService";

const STATUS_MAP: Record<string, { label: string; step: number; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pedido Recebido", step: 0, color: "bg-blue-500", icon: <Package className="h-5 w-5" /> },
  agendada: { label: "Em Preparação", step: 1, color: "bg-blue-500", icon: <Package className="h-5 w-5" /> },
  aguardando_aceite: { label: "Aguardando Motorista", step: 1, color: "bg-yellow-500", icon: <Truck className="h-5 w-5" /> },
  aceita: { label: "Motorista Confirmado", step: 1, color: "bg-yellow-500", icon: <Truck className="h-5 w-5" /> },
  em_rota: { label: "Em Trânsito", step: 2, color: "bg-orange-500", icon: <Truck className="h-5 w-5" /> },
  em_andamento: { label: "Em Andamento", step: 2, color: "bg-orange-500", icon: <Truck className="h-5 w-5" /> },
  concluida: { label: "Entregue", step: 3, color: "bg-green-500", icon: <CheckCircle className="h-5 w-5" /> },
  finalizada: { label: "Entregue", step: 3, color: "bg-green-500", icon: <CheckCircle className="h-5 w-5" /> },
  cancelada: { label: "Cancelado", step: -1, color: "bg-red-500", icon: <AlertTriangle className="h-5 w-5" /> },
  ocorrencia: { label: "Com Ocorrência", step: 2, color: "bg-red-500", icon: <AlertTriangle className="h-5 w-5" /> },
};

const STEPS = [
  { num: 0, label: "Registrado" },
  { num: 1, label: "Em Preparação" },
  { num: 2, label: "Em Trânsito" },
  { num: 3, label: "Entregue" },
];

export default function RastreamentoPublico() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErro("Token não informado.");
      setLoading(false);
      return;
    }
    obterOSPorToken(token).then((result) => {
      if (!result) {
        setErro("Link inválido ou expirado. Solicite um novo link de rastreamento.");
        setLoading(false);
        return;
      }
      setDados(result);
      setLoading(false);
    }).catch(() => {
      setErro("Erro ao buscar informações. Tente novamente.");
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (erro || !dados?.os) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{erro || "Dados não encontrados."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { os, alocacao, pod, link } = dados;
  const statusInfo = STATUS_MAP[os.status] || STATUS_MAP.pendente;
  const currentStep = statusInfo.step >= 0 ? statusInfo.step : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header com branding */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary">Conexão Express</h1>
            <p className="text-xs text-muted-foreground">Rastreamento de Entrega</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status atual */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Status da Entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={`${statusInfo.color} text-white mb-3`}>
              {statusInfo.label}
            </Badge>
            {os.numero && (
              <p className="text-sm text-muted-foreground">Pedido: {os.numero}</p>
            )}
            {alocacao?.horario_inicio_real && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Início: {new Date(alocacao.horario_inicio_real).toLocaleString("pt-BR")}
              </p>
            )}
            {pod?.data_hora_entrega && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Entregue: {new Date(pod.data_hora_entrega).toLocaleString("pt-BR")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Barra de progresso */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              {STEPS.map((step, i) => (
                <div key={step.num} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    currentStep >= step.num ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                  }`}>
                    {currentStep > step.num ? <CheckCircle className="h-4 w-4" /> : step.num + 1}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 text-center">{step.label}</span>
                </div>
              ))}
            </div>
            <div className="relative h-2 bg-gray-200 rounded-full mt-2">
              <div
                className="absolute h-2 bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, (currentStep / (STEPS.length - 1)) * 100))}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Informações da entrega (apenas públicas) */}
        {os.origem && os.destino && (
          <Card>
            <CardContent className="py-4 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <p className="text-sm">{os.origem}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Destino</p>
                  <p className="text-sm">{os.destino}</p>
                </div>
              </div>
              {os.prestador_nome && (
                <div className="flex items-start gap-2">
                  <Truck className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Entregador</p>
                    <p className="text-sm">{os.prestador_nome}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* POD (se disponível) */}
        {pod && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <p className="text-sm font-medium">Comprovante de Entrega</p>
              </div>
              <p className="text-sm">Recebedor: {pod.nome_recebedor || "Não informado"}</p>
              {pod.data_hora_entrega && (
                <p className="text-xs text-muted-foreground mt-1">
                  Data: {new Date(pod.data_hora_entrega).toLocaleString("pt-BR")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer branding */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Entrega acompanhada por Conexão Express — tecnologia logística inteligente.
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            © Conexão Express Transportes
          </p>
        </div>
      </div>
    </div>
  );
}
