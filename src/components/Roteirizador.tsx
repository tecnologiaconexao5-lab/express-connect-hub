import { useState } from "react";
import { Plus, Trash2, GripVertical, Download, Upload, MapPin, Package, Truck, Calendar, Clock, AlertCircle, CheckCircle, FileText, Calculator, ChevronDown, ChevronRight, X, Package2, Weight, Ruler, DollarSign, Route, Building, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Parada {
  id: string;
  seq: number;
  destinatario: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  mercadoria: string;
  qtdVolumes: number;
  peso: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  valorNF: number;
  janelaInicio?: string;
  janelaFim?: string;
  prioridade: "urgente" | "normal";
  status: "nao_iniciada" | "em_rota" | "entregue";
}

interface VeiculoSugerido {
  tipo: string;
  quantidade: number;
  paradas: number;
  regiao: string;
  pesoTotal: number;
  capacidade: number;
  percentualUtilizado: number;
}

const tiposVeiculos = [
  { tipo: "Van", capacidade: 800, maxVolumes: 20 },
  { tipo: "VUC", capacidade: 1500, maxVolumes: 35 },
  { tipo: "Toco", capacidade: 6000, maxVolumes: 80 },
  { tipo: "Truck", capacidade: 10000, maxVolumes: 120 },
  { tipo: "Carreta", capacidade: 25000, maxVolumes: 250 },
  { tipo: "Bitrem", capacidade: 35000, maxVolumes: 350 },
];

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Roteirizador() {
  const [paradas, setParadas] = useState<Parada[]>([
    { id: "1", seq: 1, destinatario: "Magazine Luiza", cep: "02541-000", logradouro: "Av. Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP", mercadoria: "Eletrodomésticos", qtdVolumes: 50, peso: 450, valorNF: 25000, prioridade: "normal", status: "nao_iniciada" },
    { id: "2", seq: 2, destinatario: "Americanas", cep: "01002-000", logradouro: "Av. Brigadeiro Luís Antônio", numero: "500", bairro: "共和", cidade: "São Paulo", uf: "SP", mercadoria: "Eletrônicos", qtdVolumes: 30, peso: 120, valorNF: 45000, prioridade: "urgente", status: "nao_iniciada" },
    { id: "3", seq: 3, destinatario: "Mercado Livre", cep: "04543-000", logradouro: "Av. Nações Unidas", numero: "3000", bairro: "Brooklin", cidade: "São Paulo", uf: "SP", mercadoria: "Variados", qtdVolumes: 100, peso: 280, valorNF: 18000, prioridade: "normal", status: "nao_iniciada" },
  ]);

  const [showModalParada, setShowModalParada] = useState(false);
  const [novaParada, setNovaParada] = useState<Partial<Parada>>({ prioridade: "normal", status: "nao_iniciada" });
  const [origem, setOrigem] = useState({ cep: "04543-000", endereco: "Av. Nações Unidas, 3000 - São Paulo" });
  const [configRota, setConfigRota] = useState({ horaInicio: "08:00", horaRetorno: "20:00", considerarJanelas: false, dividirRegiao: false });
  const [frotaSugerida, setFrotaSugerida] = useState<VeiculoSugerido[]>([]);
  const [veiculosCriados, setVeiculosCriados] = useState<string[]>([]);

  const pesoTotal = paradas.reduce((acc, p) => acc + p.peso, 0);
  const volumesTotal = paradas.reduce((acc, p) => acc + p.qtdVolumes, 0);

  const calcularCubagem = (p: Parada) => {
    if (!p.comprimento || !p.largura || !p.altura) return 0;
    return (p.comprimento * p.largura * p.altura) / 6000;
  };

  const adicionarParada = () => {
    if (!novaParada.destinatario || !novaParada.cep) {
      toast.error("Preencha destinatário e CEP");
      return;
    }
    const nova: Parada = {
      id: `p${Date.now()}`,
      seq: paradas.length + 1,
      destinatario: novaParada.destinatario || "",
      cep: novaParada.cep || "",
      logradouro: novaParada.logradouro || "",
      numero: novaParada.numero || "",
      bairro: novaParada.bairro || "",
      cidade: novaParada.cidade || "",
      uf: novaParada.uf || "",
      mercadoria: novaParada.mercadoria || "",
      qtdVolumes: novaParada.qtdVolumes || 1,
      peso: novaParada.peso || 0,
      comprimento: novaParada.comprimento,
      largura: novaParada.largura,
      altura: novaParada.altura,
      valorNF: novaParada.valorNF || 0,
      janelaInicio: novaParada.janelaInicio,
      janelaFim: novaParada.janelaFim,
      prioridade: novaParada.prioridade as "urgente" | "normal" || "normal",
      status: "nao_iniciada",
    };
    setParadas([...paradas, nova]);
    setShowModalParada(false);
    setNovaParada({ prioridade: "normal", status: "nao_iniciada" });
    toast.success("Parada adicionada");
  };

  const removerParada = (id: string) => {
    setParadas(paradas.filter(p => p.id !== id).map((p, i) => ({ ...p, seq: i + 1 })));
  };

  const calcularFrota = () => {
    const pesoRestante = pesoTotal;
    const sugestoes: VeiculoSugerido[] = [];
    
    // Agrupar por região simples (uf)
    const porUF = paradas.reduce((acc, p) => {
      if (!acc[p.uf]) acc[p.uf] = { peso: 0, qtd: 0 };
      acc[p.uf].peso += p.peso;
      acc[p.uf].qtd += 1;
      return acc;
    }, {} as Record<string, { peso: number; qtd: number }>);

    // Calcular veículo ideal por região
    Object.entries(porUF).forEach(([uf, dados]) => {
      const capacidade = tiposVeiculos.find(t => t.tipo === "Carreta")?.capacidade || 25000;
      const qtdVeiculos = Math.ceil(dados.peso / capacidade);
      
      sugestoes.push({
        tipo: "Carreta",
        quantidade: qtdVeiculos,
        paradas: dados.qtd,
        regiao: uf,
        pesoTotal: dados.peso,
        capacidade: capacidade * qtdVeiculos,
        percentualUtilizado: (dados.peso / (capacidade * qtdVeiculos)) * 100,
      });
    });

    setFrotaSugerida(sugestoes);
    toast.success("Frota calculada com sucesso!");
  };

  const criarOS = () => {
    setVeiculosCriados([...veiculosCriados, `OS-${Date.now()}`]);
    toast.success("OSs geradas com sucesso!");
  };

  const gerarModeloExcel = () => {
    const headers = ["destinatario", "cep", "logradouro", "numero", "bairro", "cidade", "uf", "mercadoria", "qtd_volumes", "peso_kg", "comprimento_cm", "largura_cm", "altura_cm", "valor_nf", "janela_inicio", "janela_fim", "prioridade"];
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_roteirizador.csv";
    a.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "nao_iniciada": return <Badge variant="outline">Não iniciada</Badge>;
      case "em_rota": return <Badge className="bg-blue-500">Em rota</Badge>;
      case "entregue": return <Badge className="bg-green-500">Entregue</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Route className="w-6 h-6 text-primary" />
            Roteirizador Enterprise
          </h2>
          <p className="text-sm text-muted-foreground">Planejamento de rotas e distribuição de frota</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={gerarModeloExcel}>
            <Download className="w-4 h-4 mr-2" /> Baixar Modelo
          </Button>
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" /> Importar Planilha
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Painel Esquerdo */}
        <div className="lg:col-span-2 space-y-4">
          {/* Configurações da Rota */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Configurações da Rota
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Origem (Base/CD)</Label>
                <Input 
                  placeholder="CEP de origem" 
                  value={origem.cep}
                  onChange={(e) => setOrigem({ ...origem, cep: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Horário Início</Label>
                  <Input type="time" value={configRota.horaInicio} onChange={(e) => setConfigRota({...configRota, horaInicio: e.target.value})} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Máx. Retorno</Label>
                  <Input type="time" value={configRota.horaRetorno} onChange={(e) => setConfigRota({...configRota, horaRetorno: e.target.value})} className="mt-1" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Considerar janelas</Label>
                <Switch checked={configRota.considerarJanelas} onCheckedChange={(v) => setConfigRota({...configRota, considerarJanelas: v})} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Dividir por região</Label>
                <Switch checked={configRota.dividirRegiao} onCheckedChange={(v) => setConfigRota({...configRota, dividirRegiao: v})} />
              </div>
            </CardContent>
          </Card>

          {/* Resumo Paradas */}
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Paradas ({paradas.length})
              </CardTitle>
              <Button size="sm" onClick={() => setShowModalParada(true)}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto space-y-2 p-3">
                {paradas.map((parada, index) => (
                  <div key={parada.id} className="flex items-center gap-2 bg-white border rounded-lg p-2 hover:shadow-sm transition">
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {parada.seq}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{parada.destinatario}</p>
                      <p className="text-xs text-muted-foreground">{parada.cidade}/{parada.uf}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono">{parada.qtdVolumes} vol</p>
                      <p className="text-xs text-muted-foreground">{parada.peso}kg</p>
                    </div>
                    {parada.prioridade === "urgente" && (
                      <Badge variant="destructive" className="text-[10px]">URG</Badge>
                    )}
                    {getStatusBadge(parada.status)}
                    <Button variant="ghost" size="icon" className="w-6 h-6 text-red-500" onClick={() => removerParada(parada.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {paradas.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma parada adicionada</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Calcular Frota */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">Totais</p>
                  <p className="text-xs text-muted-foreground">{paradas.length} paradas | {volumesTotal} volumes | {pesoTotal}kg</p>
                </div>
                <Button onClick={calcularFrota} className="bg-green-600 hover:bg-green-700">
                  <Calculator className="w-4 h-4 mr-2" /> Calcular Frota
                </Button>
              </div>
              
              {frotaSugerida.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-medium">Sugestão de Frota:</p>
                  {frotaSugerida.map((sug, i) => (
                    <div key={i} className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="w-5 h-5 text-green-600" />
                          <span className="font-bold">{sug.tipo}</span>
                          <Badge>x{sug.quantidade}</Badge>
                        </div>
                        <Badge variant="outline" className="bg-white">{sug.regiao}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex gap-4">
                        <span>{sug.paradas} paradas</span>
                        <span>{sug.pesoTotal}kg</span>
                        <span className={sug.percentualUtilizado > 80 ? "text-green-600" : "text-yellow-600"}>
                          {sug.percentualUtilizado.toFixed(0)}% capacidade
                        </span>
                      </div>
                    </div>
                  ))}
                  <Button className="w-full mt-2" onClick={criarOS} disabled={veiculosCriados.length > 0}>
                    <FileText className="w-4 h-4 mr-2" /> 
                    {veiculosCriados.length > 0 ? `${veiculosCriados.length} OS Criadas` : "Criar OS para cada veículo"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel Direito - Mapa */}
        <div className="lg:col-span-3">
          <Card className="h-[calc(100vh-250px)]">
            <CardContent className="h-full flex items-center justify-center bg-slate-100">
              <div className="text-center text-muted-foreground">
                <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Mapa Interativo</p>
                <p className="text-sm">Configure a API do Mapbox para visualizar as rotas</p>
                <p className="text-xs mt-2">{paradas.length} paradas carregadas</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Adicionar Parada */}
      <Dialog open={showModalParada} onOpenChange={setShowModalParada}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Parada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Destinatário</Label>
                <Input 
                  value={novaParada.destinatario || ""}
                  onChange={(e) => setNovaParada({...novaParada, destinatario: e.target.value})}
                  placeholder="Nome do destinatário"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>CEP</Label>
                <Input 
                  value={novaParada.cep || ""}
                  onChange={(e) => setNovaParada({...novaParada, cep: e.target.value})}
                  placeholder="00000-000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={novaParada.prioridade} onValueChange={(v) => setNovaParada({...novaParada, prioridade: v as any})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Logradouro</Label>
                <Input 
                  value={novaParada.logradouro || ""}
                  onChange={(e) => setNovaParada({...novaParada, logradouro: e.target.value})}
                  placeholder="Rua, Av..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Número</Label>
                <Input 
                  value={novaParada.numero || ""}
                  onChange={(e) => setNovaParada({...novaParada, numero: e.target.value})}
                  placeholder="S/N"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input 
                  value={novaParada.bairro || ""}
                  onChange={(e) => setNovaParada({...novaParada, bairro: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input 
                  value={novaParada.cidade || ""}
                  onChange={(e) => setNovaParada({...novaParada, cidade: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input 
                  value={novaParada.uf || ""}
                  onChange={(e) => setNovaParada({...novaParada, uf: e.target.value})}
                  placeholder="SP"
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label>Mercadoria</Label>
                <Input 
                  value={novaParada.mercadoria || ""}
                  onChange={(e) => setNovaParada({...novaParada, mercadoria: e.target.value})}
                  placeholder="Descrição da mercadoria"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Qtd Volumes</Label>
                <Input 
                  type="number"
                  value={novaParada.qtdVolumes || ""}
                  onChange={(e) => setNovaParada({...novaParada, qtdVolumes: parseInt(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Peso (kg)</Label>
                <Input 
                  type="number"
                  value={novaParada.peso || ""}
                  onChange={(e) => setNovaParada({...novaParada, peso: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Valor NF (R$)</Label>
                <Input 
                  type="number"
                  value={novaParada.valorNF || ""}
                  onChange={(e) => setNovaParada({...novaParada, valorNF: parseFloat(e.target.value) || 0})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Janela Início</Label>
                <Input type="time" value={novaParada.janelaInicio || ""} onChange={(e) => setNovaParada({...novaParada, janelaInicio: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label>Janela Fim</Label>
                <Input type="time" value={novaParada.janelaFim || ""} onChange={(e) => setNovaParada({...novaParada, janelaFim: e.target.value})} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModalParada(false)}>Cancelar</Button>
            <Button onClick={adicionarParada} className="bg-orange-500">Adicionar Parada</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
