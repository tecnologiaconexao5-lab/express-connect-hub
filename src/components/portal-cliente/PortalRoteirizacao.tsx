import { LucideIcon, Route, MapPin, Truck, Package, Clock, Navigation, AlertTriangle, CheckCircle, Fuel, Users, Calendar, TrendingUp, Filter, Plus, X, ArrowRight, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DestinoInput {
  id: string;
  endereco: string;
  cep?: string;
  prioridade: "alta" | "media" | "baixa";
  tipo: "padrao" | "urgente" | "moto" | "refrigerado";
}

interface Rota {
  id: string;
  nome: string;
  regiao: string;
  veiculo: string;
  capacidade: number;
  ocupacao: number;
  pesoTotal: number;
  volumeTotal: number;
  km: number;
  tempo: number;
  paradas: DestinoInput[];
  status: "otimizada" | "em_otimizacao" | "manual";
}

interface PortalRoteirizacaoProps {
  onGerarRoteiro?: (destinos: DestinoInput[]) => void;
  onVerDetalhes?: (rotaId: string) => void;
}

const veiculosConfig = {
  moto: { icon: "🏍️", label: "Moto", capacidadePeso: 30, capacidadeVolume: 0.05 },
  fiorino: { icon: "🚐", label: "Fiorino", capacidadePeso: 300, capacidadeVolume: 2 },
  van: { icon: "🚐", label: "Van", capacidadePeso: 600, capacidadeVolume: 4 },
  hr: { icon: "🚚", label: "HR", capacidadePeso: 1000, capacidadeVolume: 8 },
  vuc: { icon: "🚚", label: "VUC", capacidadePeso: 2000, capacidadeVolume: 15 },
  truck: { icon: "🚛", label: "Truck", capacidadePeso: 10000, capacidadeVolume: 50 },
};

const tipoServicoLabels = {
  padrao: { label: "Padrão", color: "bg-slate-50 text-slate-600" },
  urgente: { label: "Urgente", color: "bg-red-50 text-red-700" },
  moto: { label: "Moto", color: "bg-amber-50 text-amber-700" },
  refrigerado: { label: "Refrigerado", color: "bg-blue-50 text-blue-700" },
};

const prioridadeLabels = {
  alta: { label: "🔴 Alta", color: "bg-red-50 text-red-700" },
  media: { label: "🟡 Média", color: "bg-amber-50 text-amber-700" },
  baixa: { label: "🟢 Baixa", color: "bg-emerald-50 text-emerald-700" },
};

export function PortalRoteirizacao({ onGerarRoteiro, onVerDetalhes }: PortalRoteirizacaoProps) {
  const [destinos, setDestinos] = useState<DestinoInput[]>([]);
  const [novoEndereco, setNovoEndereco] = useState("");
  const [showAgendarModal, setShowAgendarModal] = useState(false);
  const [showDetalheModal, setShowDetalheModal] = useState(false);
  const [selectedRotaDetail, setSelectedRotaDetail] = useState<Rota | null>(null);
  const [agendarData, setAgendarData] = useState({ data: "", hora: "", observacao: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rotas, setRotas] = useState<Rota[]>([
    {
      id: "1",
      nome: "Rota Zona Sul",
      regiao: "Zona Sul",
      veiculo: "Van",
      capacidade: 600,
      ocupacao: 450,
      pesoTotal: 380,
      volumeTotal: 2.8,
      km: 42,
      tempo: 180,
      paradas: [],
      status: "otimizada",
    },
    {
      id: "2",
      nome: "Rota Centro",
      regiao: "Centro",
      veiculo: "Fiorino",
      capacidade: 300,
      ocupacao: 280,
      pesoTotal: 245,
      volumeTotal: 1.5,
      km: 28,
      tempo: 120,
      paradas: [],
      status: "otimizada",
    },
    {
      id: "3",
      nome: "Rota Zona Oeste",
      regiao: "Zona Oeste",
      veiculo: "HR",
      capacidade: 1000,
      ocupacao: 650,
      pesoTotal: 620,
      volumeTotal: 5.2,
      km: 65,
      tempo: 240,
      paradas: [],
      status: "em_otimizacao",
    },
  ]);

  const adicionarDestino = () => {
    if (!novoEndereco.trim()) return;
    const novo: DestinoInput = {
      id: Date.now().toString(),
      endereco: novoEndereco,
      prioridade: "media",
      tipo: "padrao",
    };
    setDestinos([...destinos, novo]);
    setNovoEndereco("");
  };

  const removerDestino = (id: string) => {
    setDestinos(destinos.filter(d => d.id !== id));
  };

  const gerarRoteiro = () => {
    if (destinos.length > 0) {
      onGerarRoteiro?.(destinos);
    }
  };

  const handleVerDetalhesRota = (rota: Rota) => {
    setSelectedRotaDetail(rota);
    setShowDetalheModal(true);
    onVerDetalhes?.(rota.id);
  };

  const handleImportarCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        const novosDestinos: DestinoInput[] = lines.slice(1).map((line, idx) => {
          const parts = line.split(',');
          return {
            id: `csv-${Date.now()}-${idx}`,
            endereco: parts[0]?.trim() || "",
            cep: parts[1]?.trim(),
            prioridade: "media",
            tipo: "padrao",
          };
        }).filter(d => d.endereco);
        setDestinos(prev => [...prev, ...novosDestinos]);
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAgendar = () => {
    if (agendarData.data && agendarData.hora) {
      setShowAgendarModal(false);
      setAgendarData({ data: "", hora: "", observacao: "" });
    }
  };

  const totalEntregas = destinos.length > 0 ? destinos.length : rotas.reduce((acc, r) => acc + r.paradas.length, 0);
  const regioesAtendidas = new Set(rotas.map(r => r.regiao)).size;
  const kmTotal = destinos.length > 0 ? destinos.length * 8 : rotas.reduce((acc, r) => acc + r.km, 0);
  const tempoTotal = destinos.length > 0 ? destinos.length * 15 : rotas.reduce((acc, r) => acc + r.tempo, 0);
  const veiculosNecessarios = destinos.length > 0 ? Math.ceil(destinos.length / 5) : rotas.length;
  const ocupacaoMedia = Math.round(rotas.reduce((acc, r) => acc + (r.ocupacao / r.capacidade) * 100, 0) / Math.max(rotas.length, 1));
  const custoEstimado = kmTotal * 4.5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#111827]">Roteirização Inteligente</h2>
        <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white" onClick={gerarRoteiro}>
          <Route className="w-4 h-4 mr-2" />
          Gerar Novo Roteiro
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <Package className="w-5 h-5 mx-auto text-orange-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{totalEntregas}</p>
            <p className="text-[10px] text-[#64748B]">Entregas</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <MapPin className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{regioesAtendidas}</p>
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
            <p className="text-xl font-bold text-[#111827]">{Math.floor(tempoTotal / 60)}h</p>
            <p className="text-[10px] text-[#64748B]">Tempo Est.</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <Truck className="w-5 h-5 mx-auto text-orange-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{veiculosNecessarios}</p>
            <p className="text-[10px] text-[#64748B]">Veículos</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto text-cyan-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{ocupacaoMedia}%</p>
            <p className="text-[10px] text-[#64748B]">Ocupação</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <Fuel className="w-5 h-5 mx-auto text-red-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">R$ {custoEstimado.toLocaleString()}</p>
            <p className="text-[10px] text-[#64748B]">Custo Est.</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
            <p className="text-xl font-bold text-[#111827]">95%</p>
            <p className="text-[10px] text-[#64748B]">Eficiência</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#111827] text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#F97316]" />
            Adicionar Destinos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Digite o endereço ou CEP..."
              className="flex-1 bg-white border-[#E5E7EB] text-[#111827]"
              value={novoEndereco}
              onChange={(e) => setNovoEndereco(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionarDestino()}
            />
            <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white" onClick={adicionarDestino}>
              Adicionar
            </Button>
          </div>

          {destinos.length > 0 && (
            <div className="space-y-2 mb-3">
              {destinos.map((destino, idx) => (
                <div key={destino.id} className="flex items-center justify-between p-2 bg-[#F8FAFC] rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-orange-50 text-[#F97316] text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-[#111827]">{destino.endereco}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={tipoServicoLabels[destino.tipo].color}>{tipoServicoLabels[destino.tipo].label}</Badge>
                    <Badge className={prioridadeLabels[destino.prioridade].color}>{prioridadeLabels[destino.prioridade].label}</Badge>
                    <Button variant="ghost" size="icon" className="w-6 h-6 text-[#64748B] hover:text-red-500" onClick={() => removerDestino(destino.id)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-[#E5E7EB] text-[#475569] bg-white text-xs">
              <Filter className="w-3 h-3 mr-1" />
              Filtrar por Tipo
            </Button>
            <Button variant="outline" className="border-[#E5E7EB] text-[#475569] bg-white text-xs" onClick={() => setShowAgendarModal(true)}>
              <Calendar className="w-3 h-3 mr-1" />
              Agendar
            </Button>
            <Button variant="outline" className="border-[#E5E7EB] text-[#475569] bg-white text-xs" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="w-3 h-3 mr-1" />
              Importar CSV
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              className="hidden"
              onChange={handleImportarCSV}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rotas.map((rota) => (
          <Card
            key={rota.id}
            className="bg-white border-[#E5E7EB] rounded-2xl shadow-sm hover:border-slate-300 transition-all cursor-pointer"
            onClick={() => handleVerDetalhesRota(rota)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    rota.status === "otimizada" ? "bg-emerald-50" : "bg-amber-50"
                  }`}>
                    <Route className={`w-5 h-5 ${
                      rota.status === "otimizada" ? "text-emerald-600" : "text-amber-600"
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-[#111827]">{rota.nome}</p>
                    <p className="text-xs text-[#64748B]">{rota.regiao}</p>
                  </div>
                </div>
                <Badge className={
                  rota.status === "otimizada" ? "bg-emerald-50 text-emerald-700" :
                  rota.status === "em_otimizacao" ? "bg-amber-50 text-amber-700" :
                  "bg-slate-50 text-slate-600"
                }>
                  {rota.status === "otimizada" ? "Otimizada" :
                   rota.status === "em_otimizacao" ? "Em Otimização" : "Manual"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 bg-[#F8FAFC] rounded">
                  <p className="text-[10px] text-[#64748B]">Veículo</p>
                  <p className="text-sm text-[#111827]">{veiculosConfig[rota.veiculo.toLowerCase() as keyof typeof veiculosConfig]?.icon} {rota.veiculo}</p>
                </div>
                <div className="p-2 bg-[#F8FAFC] rounded">
                  <p className="text-[10px] text-[#64748B]">Capacidade</p>
                  <p className="text-sm text-[#111827]">{rota.ocupacao}/{rota.capacidade}kg</p>
                </div>
                <div className="p-2 bg-[#F8FAFC] rounded">
                  <p className="text-[10px] text-[#64748B]">Distância</p>
                  <p className="text-sm text-[#111827]">{rota.km}km</p>
                </div>
                <div className="p-2 bg-[#F8FAFC] rounded">
                  <p className="text-[10px] text-[#64748B]">Tempo</p>
                  <p className="text-sm text-[#111827]">{Math.floor(rota.tempo / 60)}h {rota.tempo % 60}min</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">Ocupação</span>
                  <span className={`${
                    rota.ocupacao / rota.capacidade > 0.9 ? "text-red-600" :
                    rota.ocupacao / rota.capacidade > 0.7 ? "text-amber-600" :
                    "text-emerald-600"
                  }`}>
                    {Math.round((rota.ocupacao / rota.capacidade) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      rota.ocupacao / rota.capacidade > 0.9 ? "bg-red-500" :
                      rota.ocupacao / rota.capacidade > 0.7 ? "bg-amber-500" :
                      "bg-emerald-500"
                    }`}
                    style={{ width: `${(rota.ocupacao / rota.capacidade) * 100}%` }}
                  />
                </div>
              </div>

              <Button variant="ghost" size="sm" className="w-full mt-3 text-[#F97316] text-xs">
                Ver Detalhes <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal Agendar */}
      <Dialog open={showAgendarModal} onOpenChange={setShowAgendarModal}>
        <DialogContent className="bg-white border-[#E5E7EB] shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#111827]">
              <Calendar className="w-5 h-5 text-[#F97316]" />
              Agendar Roteiro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase">Data</label>
              <Input
                type="date"
                className="bg-white border-[#E5E7EB]"
                value={agendarData.data}
                onChange={(e) => setAgendarData({ ...agendarData, data: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase">Hora</label>
              <Input
                type="time"
                className="bg-white border-[#E5E7EB]"
                value={agendarData.hora}
                onChange={(e) => setAgendarData({ ...agendarData, hora: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase">Observação</label>
              <Input
                placeholder="Observações adicionais..."
                className="bg-white border-[#E5E7EB]"
                value={agendarData.observacao}
                onChange={(e) => setAgendarData({ ...agendarData, observacao: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="bg-white border-[#E5E7EB]" onClick={() => setShowAgendarModal(false)}>Cancelar</Button>
            <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white" onClick={handleAgendar}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes da Rota */}
      <Dialog open={showDetalheModal} onOpenChange={setShowDetalheModal}>
        <DialogContent className="max-w-2xl bg-white border-[#E5E7EB] shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#111827]">
              <Route className="w-5 h-5 text-[#F97316]" />
              Detalhes da Rota
            </DialogTitle>
          </DialogHeader>
          {selectedRotaDetail && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Nome</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedRotaDetail.nome}</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Região</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedRotaDetail.regiao}</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Veículo</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedRotaDetail.veiculo}</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Distância</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedRotaDetail.km}km</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Tempo</p>
                  <p className="text-sm font-medium text-[#111827]">{Math.floor(selectedRotaDetail.tempo / 60)}h {selectedRotaDetail.tempo % 60}min</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Capacidade</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedRotaDetail.capacidade}kg</p>
                </div>
              </div>
              {selectedRotaDetail.paradas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#64748B] uppercase">Sequência de Paradas</p>
                  {selectedRotaDetail.paradas.map((p, idx) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 bg-[#F8FAFC] rounded-lg">
                      <span className="w-6 h-6 rounded-full bg-[#F97316] text-white text-xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-[#111827]">{p.endereco}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                <p className="text-[10px] font-bold text-[#64748B] uppercase">Entregas</p>
                <p className="text-sm font-medium text-[#111827]">{selectedRotaDetail.ocupacao}kg / {selectedRotaDetail.capacidade}kg</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
