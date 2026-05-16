import { ArrowLeft, FileText, Calculator, Truck, MapPin, Package, Phone, Mail, Copy as CopyIcon, Send, Printer, Calendar, Route } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { gerarPdfOrcamento } from "@/components/comercial/orcamentoPdf";
import type { Orcamento, OrcamentoStatus } from "./types";
import { STATUS_CONFIG } from "./types";

interface Props {
  orcamento: Orcamento;
  onVoltar: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  expirado: "Expirado"
};

export default function OrcamentoPreview({ orcamento, onVoltar }: Props) {
  const copiarTexto = () => {
    const texto = `
      ORÇAMENTO: ${orcamento.numero}
CLIENTE: ${orcamento.cliente}
CNPJ: ${orcamento.clienteCnpj || "—"}
DATA: ${orcamento.dataEmissao ? new Date(orcamento.dataEmissao).toLocaleDateString("pt-BR") : "—"}
VALOR: R$ ${orcamento.valores.valorFinal?.toFixed(2) || "0,00"}

ORIGEM: ${orcamento.enderecos.find(e => e.tipo === "coleta")?.endereco || "—"}
DESTINO: ${[...orcamento.enderecos].reverse().find(e => e.tipo === "entrega")?.endereco || "—"}

VECTOR: ${orcamento.veiculo?.tipo?.toUpperCase() || "—"}
STATUS: ${STATUS_LABELS[orcamento.status] || orcamento.status}
    `.trim();
    navigator.clipboard.writeText(texto);
    toast.success("Dados do orçamento copiados!");
  };

  const formatarValor = (valor?: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
  };

  const getStatusBadge = (status?: string) => {
    const cores = STATUS_CONFIG[status as OrcamentoStatus];
    return <Badge className={cores?.color || "bg-gray-500"}>{STATUS_LABELS[status || "rascunho"]}</Badge>;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Header Fixo */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-50 sticky top-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onVoltar}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <h1 className="text-lg font-bold">ORÇAMENTO {orcamento.numero}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copiarTexto}>
            <CopyIcon className="w-4 h-4 mr-2" /> Copiar Dados
          </Button>
          <Button variant="outline" onClick={async () => await gerarPdfOrcamento(orcamento)}>
            <FileText className="w-4 h-4 mr-2" /> Baixar PDF
          </Button>
          {orcamento.status === "aprovado" && (
            <Button variant="default">
              <Send className="w-4 h-4 mr-2" /> Gerar OS
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Cabeçalho do Orçamento */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="bg-orange-50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-orange-600">ORÇAMENTO</CardTitle>
                  <p className="text-sm text-muted-foreground">Nº {orcamento.numero}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(orcamento.status)}
                  <p className="text-xs text-muted-foreground mt-1">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {orcamento.dataEmissao ? new Date(orcamento.dataEmissao).toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <p className="font-semibold">{orcamento.cliente || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CNPJ</Label>
                  <p className="font-semibold">{orcamento.clienteCnpj || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Unidade</Label>
                  <p className="font-semibold">{orcamento.unidade || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <p className="font-semibold">{orcamento.responsavel || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Valores */}
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Valores
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Final</p>
                  <p className="text-2xl font-bold text-blue-600">{formatarValor(orcamento.valores?.valorFinal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo Prestador</p>
                  <p className="text-2xl font-bold text-orange-600">{formatarValor(orcamento.valores?.custoEstimado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margem</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(((orcamento.valores?.valorFinal || 0) - (orcamento.valores?.custoEstimado || 0)) / (orcamento.valores?.valorFinal || 1) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Veículo Sugerido */}
          {orcamento.veiculo?.tipo && (
            <Card className="border-none shadow-md rounded-2xl">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Veículo Sugerido
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-semibold">{orcamento.veiculo.tipo?.toUpperCase() || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Subcategoria</p>
                    <p className="font-semibold">{orcamento.veiculo.subcategoria || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Carroceria</p>
                    <p className="font-semibold">{orcamento.veiculo.carroceria || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Térmica</p>
                    <p className="font-semibold">{orcamento.veiculo.termica || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Carga */}
          {orcamento.carga && (
            <Card className="border-none shadow-md rounded-2xl">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Package className="w-4 h-4" /> Carga
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-semibold">{orcamento.carga.tipo || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Peso</p>
                    <p className="font-semibold">{orcamento.carga.peso || 0} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cubagem</p>
                    <p className="font-semibold">{orcamento.carga.cubagem?.toFixed(4) || 0} m³</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Volumes</p>
                    <p className="font-semibold">{orcamento.carga.volumes || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Endereços */}
          {orcamento.enderecos && orcamento.enderecos.length > 0 && (
            <Card className="border-none shadow-md rounded-2xl">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Endereços / Rotas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {orcamento.enderecos.map((end, idx) => (
                  <div key={idx} className="mb-4 last:mb-0 p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge>{end.tipo?.toUpperCase() || "PONTO"}</Badge>
                      <span className="font-semibold">{end.nomeLocal || `Ponto ${idx + 1}`}</span>
                    </div>
                    <p className="text-sm">{end.endereco || "—"}</p>
                    {end.responsavel && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <Phone className="w-3 h-3 inline mr-1" />
                        {end.responsavel} {end.telefone && `(${end.telefone})`}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          {orcamento.observacoes && (
            <Card className="border-none shadow-md rounded-2xl">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-sm font-bold">Observações</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">{orcamento.observacoes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
