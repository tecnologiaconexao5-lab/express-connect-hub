import { LucideIcon, Truck, Users, Package, Thermometer, AlertTriangle, CheckCircle, Clock, MapPin, Phone, Car, Bike, Box, Snowflake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

interface VeiculoEscala {
  id: string;
  tipo: "moto" | "fiorino" | "van" | "hr" | "vuc" | "truck";
  modelo: string;
  placa: string;
  capacidadePeso: number;
  capacidadeVolume: number;
  tipoCarroceria: "seco" | "refrigerado";
  status: "disponivel" | "em_rota" | "manutencao" | "reservado";
  ocupacao: number;
  entregasAtribuidas: number;
  motorista: {
    nome: string;
    telefone?: string;
    foto?: string;
  };
  regiao?: string;
}

interface PortalEscalaOperacionalProps {
  onVerVeiculo?: (veiculoId: string) => void;
  onContatarMotorista?: (telefone: string) => void;
}

const tipoVeiculoConfig = {
  moto: { icon: "🏍️", label: "Moto", capacidade: 30, volume: 0.05 },
  fiorino: { icon: "🚐", label: "Fiorino", capacidade: 300, volume: 2 },
  van: { icon: "🚐", label: "Van", capacidade: 600, volume: 4 },
  hr: { icon: "🚚", label: "HR", capacidade: 1000, volume: 8 },
  vuc: { icon: "🚚", label: "VUC", capacidade: 2000, volume: 15 },
  truck: { icon: "🚛", label: "Truck", capacidade: 10000, volume: 50 },
};

const statusConfig = {
  disponivel: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Disponível" },
  em_rota: { bg: "bg-blue-50", text: "text-blue-700", label: "Em Rota" },
  manutencao: { bg: "bg-amber-50", text: "text-amber-700", label: "Manutenção" },
  reservado: { bg: "bg-purple-50", text: "text-purple-700", label: "Reservado" },
};

export function PortalEscalaOperacional({ onVerVeiculo, onContatarMotorista }: PortalEscalaOperacionalProps) {
  const [showVeiculoModal, setShowVeiculoModal] = useState(false);
  const [selectedVeiculoDetail, setSelectedVeiculoDetail] = useState<VeiculoEscala | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const veiculos: VeiculoEscala[] = [
    {
      id: "1",
      tipo: "van",
      modelo: "Mercedes Sprinter",
      placa: "ABC-1234",
      capacidadePeso: 600,
      capacidadeVolume: 4,
      tipoCarroceria: "seco",
      status: "em_rota",
      ocupacao: 450,
      entregasAtribuidas: 12,
      motorista: { nome: "Carlos Silva", telefone: "(11) 99999-8888" },
      regiao: "Zona Sul",
    },
    {
      id: "2",
      tipo: "fiorino",
      modelo: "Fiat Fiorino",
      placa: "XYZ-5678",
      capacidadePeso: 300,
      capacidadeVolume: 2,
      tipoCarroceria: "seco",
      status: "disponivel",
      ocupacao: 0,
      entregasAtribuidas: 0,
      Motorista: { nome: "Pedro Santos" },
      regiao: "Centro",
    },
    {
      id: "3",
      tipo: "hr",
      modelo: "Hyundai HR",
      placa: "DEF-9012",
      capacidadePeso: 1000,
      capacidadeVolume: 8,
      tipoCarroceria: "refrigerado",
      status: "em_rota",
      ocupacao: 850,
      entregasAtribuidas: 8,
      motorista: { nome: "Marcos Oliveira", telefone: "(11) 98888-7777" },
      regiao: "Zona Oeste",
    },
    {
      id: "4",
      tipo: "moto",
      modelo: "Honda Biz",
      placa: "GHI-3456",
      capacidadePeso: 30,
      capacidadeVolume: 0.05,
      tipoCarroceria: "seco",
      status: "em_rota",
      ocupacao: 25,
      entregasAtribuidas: 15,
      motorista: { nome: "João Costa", telefone: "(11) 97777-6666" },
      regiao: "Centro",
    },
    {
      id: "5",
      tipo: "vuc",
      modelo: "Ford Transit",
      placa: "JKL-7890",
      capacidadePeso: 2000,
      capacidadeVolume: 15,
      tipoCarroceria: "seco",
      status: "reservado",
      ocupacao: 1800,
      entregasAtribuidas: 5,
      motorista: { nome: "Ricardo Alves" },
      regiao: "ABC",
    },
    {
      id: "6",
      tipo: "van",
      modelo: "Mercedes Sprinter",
      placa: "MNO-1122",
      capacidadePeso: 600,
      capacidadeVolume: 4,
      tipoCarroceria: "refrigerado",
      status: "manutencao",
      ocupacao: 0,
      entregasAtribuidas: 0,
      motorist: { nome: "André Souza" },
      regiao: "Zona Leste",
    },
  ];

  const veiculosPorTipo = veiculos.reduce((acc, v) => {
    acc[v.tipo] = (acc[v.tipo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const veiculosDisponiveis = veiculos.filter(v => v.status === "disponivel").length;
  const veiculosEmRota = veiculos.filter(v => v.status === "em_rota").length;
  const totalEntregas = veiculos.reduce((acc, v) => acc + v.entregasAtribuidas, 0);
  const ocupacaoMedia = Math.round(veiculos.reduce((acc, v) => acc + (v.ocupacao / v.capacidadePeso) * 100, 0) / Math.max(veiculos.length, 1));
  const refrigerados = veiculos.filter(v => v.tipoCarroceria === "refrigerado").length;

  const veiculosFiltrados = veiculos.filter(v => {
    if (filtroTipo !== "todos" && v.tipo !== filtroTipo) return false;
    if (filtroStatus !== "todos" && v.status !== filtroStatus) return false;
    return true;
  });

  const handleVerVeiculoClick = (veiculo: VeiculoEscala) => {
    setSelectedVeiculoDetail(veiculo);
    setShowVeiculoModal(true);
    onVerVeiculo?.(veiculo.id);
  };

  const handleLigar = (telefone?: string) => {
    if (telefone) {
      window.location.href = `tel:${telefone.replace(/\D/g, '')}`;
    } else {
      alert("Telefone não informado");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#111827]">Escala Operacional</h2>
        <div className="flex items-center gap-2 text-sm text-[#475569]">
          <span>{veiculos.length} veículos</span>
          <span className="text-[#64748B]">•</span>
          <span>{veiculos.reduce((acc, v) => acc + v.entregasAtribuidas, 0)} entregas</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-white border-[#E5E7EB] rounded-2xl">
          <CardContent className="p-3 text-center">
            <Truck className="w-5 h-5 mx-auto text-[#F97316] mb-1" />
            <p className="text-xl font-bold text-[#111827]">{veiculos.length}</p>
            <p className="text-[10px] text-[#64748B]">Veículos</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl">
          <CardContent className="p-3 text-center">
            <CheckCircle className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{veiculosDisponiveis}</p>
            <p className="text-[10px] text-[#64748B]">Disponíveis</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl">
          <CardContent className="p-3 text-center">
            <Truck className="w-5 h-5 mx-auto text-blue-600 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{veiculosEmRota}</p>
            <p className="text-[10px] text-[#64748B]">Em Rota</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl">
          <CardContent className="p-3 text-center">
            <Package className="w-5 h-5 mx-auto text-[#F97316] mb-1" />
            <p className="text-xl font-bold text-[#111827]">{totalEntregas}</p>
            <p className="text-[10px] text-[#64748B]">Entregas</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto text-cyan-600 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{ocupacaoMedia}%</p>
            <p className="text-[10px] text-[#64748B]">Ocupação</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] rounded-2xl">
          <CardContent className="p-3 text-center">
            <Snowflake className="w-5 h-5 mx-auto text-blue-600 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{refrigerados}</p>
            <p className="text-[10px] text-[#64748B]">Refrigerados</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(veiculosPorTipo).map(([tipo, count]) => (
          <Badge key={tipo} className="bg-[#F8FAFC] text-[#475569] px-3 py-1 cursor-pointer" onClick={() => setFiltroTipo(filtroTipo === tipo ? "todos" : tipo)}>
            {tipoVeiculoConfig[tipo as keyof typeof tipoVeiculoConfig]?.icon} {tipoVeiculoConfig[tipo as keyof typeof tipoVeiculoConfig]?.label}: {count}
          </Badge>
        ))}
      </div>

      <div className="space-y-3">
        {veiculosFiltrados.map((veiculo) => {
          const config = tipoVeiculoConfig[veiculo.tipo];
          const statusStyle = statusConfig[veiculo.status];
          const ocupacaoPercent = Math.round((veiculo.ocupacao / veiculo.capacidadePeso) * 100);

          return (
            <Card
              key={veiculo.id}
              className="bg-white border-[#E5E7EB] hover:border-[#CBD5E1] transition-all cursor-pointer rounded-2xl"
              onClick={() => handleVerVeiculoClick(veiculo)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] flex items-center justify-center text-2xl">
                      {config.icon}
                    </div>
                    <div>
                      <p className="font-medium text-[#111827]">{veiculo.modelo}</p>
                      <p className="text-xs text-[#64748B]">{veiculo.placa}</p>
                    </div>
                  </div>
                  <Badge className={`${statusStyle.bg} ${statusStyle.text}`}>
                    {statusStyle.label}
                  </Badge>
                </div>

                {veiculo.motorista && (
                  <div className="flex items-center gap-2 mb-3 p-2 bg-[#F8FAFC] rounded-2xl">
                    <div className="w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center text-white text-xs font-bold">
                      {veiculo.motorista.nome.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#111827]">{veiculo.motorista.nome}</p>
                      {veiculo.motorista.telefone && (
                        <p className="text-[10px] text-[#64748B]">{veiculo.motorista.telefone}</p>
                      )}
                    </div>
                    {veiculo.motorista.telefone && (
                      <Badge variant="outline" className="border-[#E5E7EB] text-[#475569] text-xs" onClick={(e) => {
                        e.stopPropagation();
                        onContatarMotorista?.(veiculo.motorista.telefone!);
                      }}>
                        <Phone className="w-3 h-3" />
                      </Badge>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2 bg-[#F8FAFC] rounded-lg">
                    <p className="text-[10px] text-[#64748B]">Capacidade</p>
                    <p className="text-sm text-[#111827]">{veiculo.capacidadePeso}kg</p>
                  </div>
                  <div className="p-2 bg-[#F8FAFC] rounded-lg">
                    <p className="text-[10px] text-[#64748B]">Volume</p>
                    <p className="text-sm text-[#111827]">{veiculo.capacidadeVolume}m³</p>
                  </div>
                  <div className="p-2 bg-[#F8FAFC] rounded-lg">
                    <p className="text-[10px] text-[#64748B]">Entregas</p>
                    <p className="text-sm text-[#111827]">{veiculo.entregasAtribuidas}</p>
                  </div>
                  <div className="p-2 bg-[#F8FAFC] rounded-lg">
                    <p className="text-[10px] text-[#64748B]">Região</p>
                    <p className="text-sm text-[#111827]">{veiculo.regiao || "N/A"}</p>
                  </div>
                </div>

                {veiculo.tipoCarroceria === "refrigerado" && (
                  <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-2xl mb-3">
                    <Snowflake className="w-4 h-4 text-blue-700" />
                    <span className="text-xs text-blue-700">Refrigerado</span>
                  </div>
                )}

                {veiculo.status !== "manutencao" && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B]">Ocupação</span>
                      <span className={ocupacaoPercent > 90 ? "text-red-700" : ocupacaoPercent > 70 ? "text-amber-700" : "text-emerald-700"}>
                        {ocupacaoPercent}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ocupacaoPercent > 90 ? "bg-red-500" : ocupacaoPercent > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(ocupacaoPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {veiculos.filter(v => v.status === "manutencao").length > 0 && (
        <Card className="bg-amber-50 border-amber-200 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span className="text-sm text-amber-800">
                {veiculos.filter(v => v.status === "manutencao").length} veículo(s) em manutenção - podem estar disponíveis em breve
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Detalhes Veículo */}
      <Dialog open={showVeiculoModal} onOpenChange={setShowVeiculoModal}>
        <DialogContent className="max-w-lg bg-white border-[#E5E7EB] shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-[#111827]">
              <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] flex items-center justify-center text-2xl">
                {selectedVeiculoDetail ? tipoVeiculoConfig[selectedVeiculoDetail.tipo]?.icon : "🚐"}
              </div>
              <div>
                <span className="text-lg font-bold">{selectedVeiculoDetail?.modelo}</span>
                <p className="text-xs text-[#64748B] font-normal">Placa: {selectedVeiculoDetail?.placa}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedVeiculoDetail && (
            <div className="space-y-4 py-4">
              {selectedVeiculoDetail.motorista && (
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase mb-2">Motorista</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#111827]">{selectedVeiculoDetail.motorista.nome}</p>
                      {selectedVeiculoDetail.motorista.telefone && (
                        <p className="text-xs text-[#64748B]">{selectedVeiculoDetail.motorista.telefone}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#E5E7EB]"
                      onClick={() => handleLigar(selectedVeiculoDetail.motorista.telefone)}
                    >
                      <Phone className="w-4 h-4 mr-1" />
                      Ligar
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Capacidade</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedVeiculoDetail.capacidadePeso}kg</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Volume</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedVeiculoDetail.capacidadeVolume}m³</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Entregas</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedVeiculoDetail.entregasAtribuidas}</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Região</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedVeiculoDetail.regiao || "N/A"}</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Status</p>
                  <Badge className={`${statusConfig[selectedVeiculoDetail.status]?.bg} ${statusConfig[selectedVeiculoDetail.status]?.text}`}>
                    {statusConfig[selectedVeiculoDetail.status]?.label}
                  </Badge>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Ocupação</p>
                  <p className={`text-sm font-medium ${Math.round((selectedVeiculoDetail.ocupacao / selectedVeiculoDetail.capacidadePeso) * 100) > 90 ? "text-red-600" : "text-[#111827]"}`}>
                    {Math.round((selectedVeiculoDetail.ocupacao / selectedVeiculoDetail.capacidadePeso) * 100)}%
                  </p>
                </div>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                <p className="text-[10px] font-bold text-[#64748B] uppercase">Tipo</p>
                <p className="text-sm font-medium text-[#111827]">{selectedVeiculoDetail.tipoCarroceria === "refrigerado" ? "Refrigerado" : "Seco"}</p>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" className="bg-white border-[#E5E7EB]" onClick={() => setShowVeiculoModal(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
