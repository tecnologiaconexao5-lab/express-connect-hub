import { useRef } from "react";
import { ArrowLeft, Download, FileText, Truck, MapPin, Package, Phone, Mail, Copy as CopyIcon, Send, Printer, Clock, User, Calendar, Route, CopyPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { gerarMensagemWhatsAppOS, generatePDFCliente, generatePDFPrestador } from "@/lib/pdfGenerator";
import type { OrdemServico, OSEndereco, OSCarga, OSStatus } from "./osTypes";
import { STATUS_CORES } from "./osTypes";
import { supabase } from "@/lib/supabase";

interface Props {
  os: OrdemServico;
  onVoltar: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  agendada: "Agendada",
  em_coleta: "Em Coleta",
  em_transporte: "Em Transporte",
  em_entrega: "Em Entrega",
  finalizada: "Finalizada",
  cancelada: "Cancelada"
};

export default function OrdemServicoPreview({ os, onVoltar }: Props) {
  const copiarWhatsApp = () => {
    const msg = gerarMensagemWhatsAppOS(os);
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  };

  const enviarWhatsAppPrestador = async () => {
    if (!os.prestador) {
      toast.error("Prestador não identificado nesta OS");
      return;
    }
    try {
      const { data: prestadorData } = await supabase
        .from("prestadores")
        .select("telefone")
        .eq("nome", os.prestador)
        .single();
      
      if (!prestadorData?.telefone) {
        toast.error("Telefone do prestador não cadastrado");
        return;
      }
      
      const telefone = prestadorData.telefone.replace(/\D/g, "");
      const msg = gerarMensagemWhatsAppOS(os);
      
      toast.success(`WhatsApp será enviado para ${prestadorData.telefone}`);
      console.log("[WhatsApp] Enviando para:", telefone, "mensagem:", msg);
    } catch (e: any) {
      toast.error("Erro ao enviar WhatsApp: " + e.message);
    }
  };

  const formatarData = (data?: string) => {
    if (!data) return "—";
    try {
      return new Date(data).toLocaleString("pt-BR");
    } catch {
      return data;
    }
  };

  const formatarValor = (valor?: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
  };

  const getStatusBadge = (status?: string) => {
    const cores = STATUS_CORES[status as OSStatus];
    return <Badge className={cores?.twClass || "bg-gray-500"}>{STATUS_LABELS[status || "rascunho"]}</Badge>;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Header Fixo */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-50 sticky top-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onVoltar}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <h1 className="text-lg font-bold">OS {os.numero}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copiarWhatsApp}>
            <CopyIcon className="w-4 h-4 mr-2" /> Copiar WhatsApp
          </Button>
          <Button variant="outline" onClick={enviarWhatsAppPrestador}>
            <Send className="w-4 h-4 mr-2" /> Enviar WhatsApp
          </Button>
          <Button variant="outline" onClick={() => toast.success("OS Duplicada!")}>
            <CopyPlus className="w-4 h-4 mr-2" /> Duplicar OS
          </Button>
          <Button variant="outline" onClick={() => generatePDFCliente(os)}>
            <FileText className="w-4 h-4 mr-2" /> PDF Cliente
          </Button>
          <Button variant="outline" onClick={() => generatePDFPrestador(os)}>
            <Truck className="w-4 h-4 mr-2" /> PDF Prestador
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Cabeçalho da OS */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="bg-orange-50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-orange-600">ORDEM DE SERVIÇO</CardTitle>
                  <p className="text-sm text-muted-foreground">Nº {os.numero}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(os.status)}
                  <p className="text-xs text-muted-foreground mt-1">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {formatarData(os.data)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <LabelRow label="Cliente">{os.cliente || "—"}</LabelRow>
                  <LabelRow label="Unidade">{os.unidade || "—"}</LabelRow>
                  <LabelRow label="Tipo de Operação">{os.tipoOperacao || "—"}</LabelRow>
                </div>
                <div>
                  <LabelRow label="Responsável">{os.responsavel || "—"}</LabelRow>
                  <LabelRow label="Prioridade">{os.prioridade || "normal"}</LabelRow>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Veículo */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Truck className="w-4 h-4" /> Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="font-semibold">{os.veiculoTipo || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Placa</p>
                  <p className="font-semibold">{os.veiculoPlaca || "Pendente"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Carroceria</p>
                  <p className="font-semibold">{os.veiculoCarroceria || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Carroceria</p>
                  <p className="font-semibold">{os.veiculoTermica || "seco"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Carga */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Package className="w-4 h-4" /> Carga
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="font-semibold">{os.carga?.tipo || "Seca"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Volumes</p>
                  <p className="font-semibold">{os.carga?.volumes || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peso</p>
                  <p className="font-semibold">{os.carga?.peso || 0} kg</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cubagem</p>
                  <p className="font-semibold">{os.carga?.cubagem || 0} m³</p>
                </div>
              </div>
              {os.carga?.descricao && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="text-sm">{os.carga.descricao}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Itinerário */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Route className="w-4 h-4" /> Itinerário
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {os.enderecos?.map((endereco: OSEndereco, idx: number) => (
                  <div key={idx} className="flex gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{endereco.tipo}</Badge>
                        <span className="font-semibold">{endereco.nomeLocal || "Local não identificado"}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{endereco.endereco || "Endereço não informado"}</p>
                      {endereco.telefone && (
                        <p className="text-sm mt-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {endereco.telefone}
                        </p>
                      )}
                      {endereco.contato && (
                        <p className="text-sm flex items-center gap-1">
                          <User className="w-3 h-3" /> {endereco.contato}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-4">
                <div className="flex-1 p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-xs text-blue-600">Distância</p>
                  <p className="font-bold text-blue-800">{os.distanciaKm || 0} km</p>
                </div>
                <div className="flex-1 p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-xs text-blue-600">Tempo Estimado</p>
                  <p className="font-bold text-blue-800">{os.tempoEstimado || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prestador */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="w-4 h-4" /> Prestador / Motorista
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {os.prestador ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="font-semibold">{os.prestador}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Veículo</p>
                    <p className="font-semibold">{os.veiculoAlocado || "—"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Prestador não asignado</p>
              )}
            </CardContent>
          </Card>

          {/* Valores */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <span className="text-green-600">R$</span> Valores
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Cliente</p>
                  <p className="font-bold text-lg">{formatarValor(os.valorCliente)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo Prestador</p>
                  <p className="font-bold text-lg">{formatarValor(os.custoPrestador)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pedágio</p>
                  <p className="font-bold text-lg">{formatarValor(os.pedagio)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instruções */}
          {os.instrucoesOperacionaisOS && (
            <Card className="border-none shadow-md rounded-2xl">
              <CardHeader className="bg-slate-50 border-b py-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="text-orange-600">📝</span> Instruções
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm whitespace-pre-wrap">{os.instrucoesOperacionaisOS}</p>
              </CardContent>
            </Card>
          )}

          {/* Histórico */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4" /> Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                {os.historico?.map((h: any, idx: number) => (
                  <div key={idx} className="relative pl-6">
                    <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-200 border-2 border-white"></span>
                    <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-2">
                         <span className="text-xs text-muted-foreground font-mono">{formatarData(h.data)}</span>
                         <Badge variant="secondary" className="text-[10px]">{h.acao}</Badge>
                       </div>
                       <p className="text-sm font-medium">{h.status_novo || h.acao}</p>
                       <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3"/> {h.usuario}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4" /> Documentos e Comprovantes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {os.documentos && os.documentos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {os.documentos.map((doc: any, i: number) => (
                    <div key={i} className="p-3 border rounded-lg flex items-center gap-3 bg-white">
                       <FileText className="w-5 h-5 text-blue-600"/>
                       <div className="flex-1 min-w-0">
                         <p className="text-xs font-semibold truncate">{doc.nome || "Documento"}</p>
                         <p className="text-[10px] text-muted-foreground uppercase">{doc.tipo || "anexo"}</p>
                       </div>
                       <Button variant="ghost" size="icon" className="h-6 w-6"><Download className="w-3 h-3"/></Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg bg-slate-50">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                  <p className="text-sm">Nenhum documento anexado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LabelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="font-medium">{children}</p>
    </div>
  );
}