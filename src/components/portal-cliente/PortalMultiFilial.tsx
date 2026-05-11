import { LucideIcon, Building2, Warehouse, Store, MapPin, Users, Package, Truck, TrendingUp, TrendingDown, DollarSign, Activity, Plus, Phone, Mail, MapPinned } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

interface Unidade {
  id: string;
  nome: string;
  tipo: "matriz" | "filial" | "cd" | "unidade" | "cc";
  cidade: string;
  uf: string;
  entregas: number;
  entregasConcluidas: number;
  atrasadas: number;
  sla: number;
  receita: number;
  custo: number;
  funcionarios: number;
  veiculos: number;
}

interface PortalMultiFilialProps {
  onSelectUnidade?: (unidadeId: string) => void;
  onConsolidado?: () => void;
}

const tipoConfig = {
  matriz: { icon: "🏢", label: "Matriz", color: "bg-slate-50 text-slate-700" },
  filial: { icon: "🏪", label: "Filial", color: "bg-slate-50 text-slate-700" },
  cd: { icon: "🏭", label: "CD", color: "bg-slate-50 text-slate-700" },
  unidade: { icon: "🏬", label: "Unidade", color: "bg-slate-50 text-slate-700" },
  cc: { icon: "💼", label: "Centro de Custo", color: "bg-slate-50 text-slate-700" },
};

export function PortalMultiFilial({ onSelectUnidade, onConsolidado }: PortalMultiFilialProps) {
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<string | null>(null);
  const [showDetalheModal, setShowDetalheModal] = useState(false);
  const [showSolicitarModal, setShowSolicitarModal] = useState(false);
  const [selectedUnidadeDetail, setSelectedUnidadeDetail] = useState<Unidade | null>(null);
  const [solicitarForm, setSolicitarForm] = useState({
    nome: "", cnpj: "", responsavel: "", telefone: "", email: "", endereco: "", centroCusto: "", observacoes: ""
  });

  const unidades: Unidade[] = [
    {
      id: "1",
      nome: "Matriz São Paulo",
      tipo: "matriz",
      cidade: "São Paulo",
      uf: "SP",
      entregas: 1250,
      entregasConcluidas: 1180,
      atrasadas: 15,
      sla: 96,
      receita: 450000,
      custo: 280000,
      funcionarios: 45,
      veiculos: 12,
    },
    {
      id: "2",
      nome: "Filial Mooca",
      tipo: "filial",
      cidade: "São Paulo",
      uf: "SP",
      entregas: 890,
      entregasConcluidas: 850,
      atrasadas: 8,
      sla: 94,
      receita: 320000,
      custo: 195000,
      funcionarios: 28,
      veiculos: 8,
    },
    {
      id: "3",
      nome: "Filial ABC",
      tipo: "filial",
      cidade: "Santo André",
      uf: "SP",
      entregas: 650,
      entregasConcluidas: 620,
      atrasadas: 5,
      sla: 95,
      receita: 240000,
      custo: 145000,
      funcionarios: 18,
      veiculos: 5,
    },
    {
      id: "4",
      nome: "CD Interlagos",
      tipo: "cd",
      cidade: "São Paulo",
      uf: "SP",
      entregas: 2100,
      entregasConcluidas: 2000,
      atrasadas: 22,
      sla: 92,
      receita: 680000,
      custo: 420000,
      funcionarios: 65,
      veiculos: 25,
    },
    {
      id: "5",
      nome: "Unidade Zona Sul",
      tipo: "unidade",
      cidade: "São Paulo",
      uf: "SP",
      deliveries: 420,
      entregasConcluidas: 400,
      atrasadas: 3,
      sla: 98,
      receita: 180000,
      custo: 95000,
      funcionarios: 12,
      veiculos: 4,
    },
  ];

  const consolidado = {
    entregas: unidades.reduce((acc, u) => acc + u.entregas, 0),
    concluidas: unidades.reduce((acc, u) => acc + u.entregasConcluidas, 0),
    atrasadas: unidades.reduce((acc, u) => acc + u.atrasadas, 0),
    sla: Math.round(unidades.reduce((acc, u) => acc + u.sla, 0) / unidades.length),
    receita: unidades.reduce((acc, u) => acc + u.receita, 0),
    custo: unidades.reduce((acc, u) => acc + u.custo, 0),
    funcionarios: unidades.reduce((acc, u) => acc + u.funcionarios, 0),
    veiculos: unidades.reduce((acc, u) => acc + u.veiculos, 0),
  };

  const handleSelectUnidade = (id: string) => {
    const unidade = unidades.find(u => u.id === id);
    setUnidadeSelecionada(id);
    if (unidade) {
      setSelectedUnidadeDetail(unidade);
      setShowDetalheModal(true);
    }
    onSelectUnidade?.(id);
  };

  const handleSolicitarFilial = () => {
    if (solicitarForm.nome && solicitarForm.responsavel) {
      setShowSolicitarModal(false);
      setSolicitarForm({ nome: "", cnpj: "", responsavel: "", telefone: "", email: "", endereco: "", centroCusto: "", observacoes: "" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#111827]">Visão Multi-Filial</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-[#F97316] hover:bg-[#EA580C] text-white" onClick={() => setShowSolicitarModal(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Solicitar Nova Filial
          </Button>
          <Badge
            className={`cursor-pointer ${!unidadeSelecionada ? "bg-[#F97316]/10 text-[#F97316]" : "bg-[#F8FAFC] text-[#64748B]"}`}
            onClick={() => { setUnidadeSelecionada(null); onConsolidado?.(); }}
          >
            <Building2 className="w-3 h-3 mr-1" />
            Consolidado
          </Badge>
          {unidades.map(u => (
            <Badge
              key={u.id}
              className={`cursor-pointer ${unidadeSelecionada === u.id ? "bg-[#F97316]/10 text-[#F97316]" : "bg-[#F8FAFC] text-[#64748B]"}`}
              onClick={() => handleSelectUnidade(u.id)}
            >
              {tipoConfig[u.tipo].icon} {u.nome.split(" ")[1] || u.nome}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="bg-white border-[#E5E7EB] shadow-sm">
          <CardContent className="p-3 text-center">
            <Package className="w-5 h-5 mx-auto text-purple-400 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{consolidado.entregas}</p>
            <p className="text-[10px] text-[#64748B]">Total Entregas</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm">
          <CardContent className="p-3 text-center">
            <CheckCircle className="w-5 h-5 mx-auto text-emerald-400 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{consolidado.concluidas}</p>
            <p className="text-[10px] text-[#64748B]">Concluídas</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm">
          <CardContent className="p-3 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto text-amber-400 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{consolidado.atrasadas}</p>
            <p className="text-[10px] text-[#64748B]">Atrasadas</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm">
          <CardContent className="p-3 text-center">
            <Activity className="w-5 h-5 mx-auto text-blue-400 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{consolidado.sla}%</p>
            <p className="text-[10px] text-[#64748B]">SLA Médio</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm">
          <CardContent className="p-3 text-center">
            <DollarSign className="w-5 h-5 mx-auto text-green-400 mb-1" />
            <p className="text-xl font-bold text-[#111827]">R$ {(consolidado.receita / 1000).toFixed(0)}k</p>
            <p className="text-[10px] text-[#64748B]">Receita</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm">
          <CardContent className="p-3 text-center">
            <DollarSign className="w-5 h-5 mx-auto text-red-400 mb-1" />
            <p className="text-xl font-bold text-[#111827]">R$ {(consolidado.custo / 1000).toFixed(0)}k</p>
            <p className="text-[10px] text-[#64748B]">Custo</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto text-cyan-400 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{consolidado.funcionarios}</p>
            <p className="text-[10px] text-[#64748B]">Funcionários</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-[#E5E7EB] shadow-sm">
          <CardContent className="p-3 text-center">
            <Truck className="w-5 h-5 mx-auto text-orange-400 mb-1" />
            <p className="text-xl font-bold text-[#111827]">{consolidado.veiculos}</p>
            <p className="text-[10px] text-[#64748B]">Veículos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {unidades.map((unidade) => {
          const config = tipoConfig[unidade.tipo];
          const margem = ((unidade.receita - unidade.custo) / unidade.receita) * 100;

          return (
            <Card
              key={unidade.id}
              className={`bg-white border-[#E5E7EB] hover:border-[#D1D5DB] transition-all cursor-pointer ${
                unidadeSelecionada === unidade.id ? "ring-2 ring-[#F97316]/50" : ""
              }`}
              onClick={() => handleSelectUnidade(unidade.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{config.icon}</span>
                    <div>
                      <p className="font-medium text-[#111827]">{unidade.nome}</p>
                      <p className="text-xs text-[#475569]">{unidade.cidade}/{unidade.uf}</p>
                    </div>
                  </div>
                  <Badge className={config.color}>{config.label}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-2 bg-[#F8FAFC] rounded">
                    <p className="text-[10px] text-[#64748B]">Entregas</p>
                    <p className="text-sm font-medium text-[#111827]">{unidade.entregas}</p>
                  </div>
                  <div className="p-2 bg-[#F8FAFC] rounded">
                    <p className="text-[10px] text-[#64748B]">SLA</p>
                    <p className={`text-sm font-medium ${unidade.sla >= 95 ? "text-emerald-600" : unidade.sla >= 90 ? "text-amber-600" : "text-red-600"}`}>
                      {unidade.sla}%
                    </p>
                  </div>
                  <div className="p-2 bg-[#F8FAFC] rounded">
                    <p className="text-[10px] text-[#64748B]">Receita</p>
                    <p className="text-sm font-medium text-[#111827]">R$ {(unidade.receita / 1000).toFixed(0)}k</p>
                  </div>
                  <div className="p-2 bg-[#F8FAFC] rounded">
                    <p className="text-[10px] text-[#64748B]">Margem</p>
                    <p className={`text-sm font-medium ${margem >= 30 ? "text-emerald-600" : margem >= 15 ? "text-amber-600" : "text-red-600"}`}>
                      {margem.toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#64748B]">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {unidade.funcionarios}
                  </span>
                  <span className="flex items-center gap-1">
                    <Truck className="w-3 h-3" /> {unidade.veiculos}
                  </span>
                  <span className={`flex items-center gap-1 ${unidade.atrasadas > 10 ? "text-red-600" : "text-[#64748B]"}`}>
                    <AlertTriangle className="w-3 h-3" /> {unidade.atrasadas} atrasos
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal Detalhes Filial */}
      <Dialog open={showDetalheModal} onOpenChange={setShowDetalheModal}>
        <DialogContent className="max-w-lg bg-white border-[#E5E7EB] shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-[#111827]">
              <span className="text-2xl">{selectedUnidadeDetail ? tipoConfig[selectedUnidadeDetail.tipo]?.icon : "🏢"}</span>
              <div>
                <span className="text-lg font-bold">{selectedUnidadeDetail?.nome}</span>
                <p className="text-xs text-[#64748B] font-normal">{selectedUnidadeDetail?.cidade}/{selectedUnidadeDetail?.uf}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedUnidadeDetail && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Entregas</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedUnidadeDetail.entregas}</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">SLA</p>
                  <p className={`text-sm font-medium ${selectedUnidadeDetail.sla >= 95 ? "text-emerald-600" : selectedUnidadeDetail.sla >= 90 ? "text-amber-600" : "text-red-600"}`}>
                    {selectedUnidadeDetail.sla}%
                  </p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Receita</p>
                  <p className="text-sm font-medium text-[#111827]">R$ {(selectedUnidadeDetail.receita / 1000).toFixed(0)}k</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Funcionários</p>
                  <p className="text-sm font-medium text-[#111827]">{selectedUnidadeDetail.funcionarios}</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" className="bg-white border-[#E5E7EB]" onClick={() => setShowDetalheModal(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Solicitar Nova Filial */}
      <Dialog open={showSolicitarModal} onOpenChange={setShowSolicitarModal}>
        <DialogContent className="max-w-lg bg-white border-[#E5E7EB] shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#111827]">
              <Building2 className="w-5 h-5 text-[#F97316]" />
              Solicitar Nova Filial
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase">Nome da Filial *</label>
              <Input placeholder="Ex: Filial Campinas" className="bg-white border-[#E5E7EB]"
                value={solicitarForm.nome}
                onChange={(e) => setSolicitarForm({ ...solicitarForm, nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase">CNPJ (opcional)</label>
              <Input placeholder="00.000.000/0000-00" className="bg-white border-[#E5E7EB]"
                value={solicitarForm.cnpj}
                onChange={(e) => setSolicitarForm({ ...solicitarForm, cnpj: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#64748B] uppercase">Responsável *</label>
                <Input placeholder="Nome completo" className="bg-white border-[#E5E7EB]"
                  value={solicitarForm.responsavel}
                  onChange={(e) => setSolicitarForm({ ...solicitarForm, responsavel: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#64748B] uppercase">Telefone</label>
                <Input placeholder="(00) 00000-0000" className="bg-white border-[#E5E7EB]"
                  value={solicitarForm.telefone}
                  onChange={(e) => setSolicitarForm({ ...solicitarForm, telefone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase">E-mail</label>
              <Input placeholder="contato@empresa.com" className="bg-white border-[#E5E7EB]" type="email"
                value={solicitarForm.email}
                onChange={(e) => setSolicitarForm({ ...solicitarForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase">Endereço Completo</label>
              <Input placeholder="Rua, número, bairro, cidade - UF" className="bg-white border-[#E5E7EB]"
                value={solicitarForm.endereco}
                onChange={(e) => setSolicitarForm({ ...solicitarForm, endereco: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase">Centro de Custo</label>
              <Input placeholder="Código do centro de custo" className="bg-white border-[#E5E7EB]"
                value={solicitarForm.centroCusto}
                onChange={(e) => setSolicitarForm({ ...solicitarForm, centroCusto: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase">Observações</label>
              <Input placeholder="Observações adicionais..." className="bg-white border-[#E5E7EB]"
                value={solicitarForm.observacoes}
                onChange={(e) => setSolicitarForm({ ...solicitarForm, observacoes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="bg-white border-[#E5E7EB]" onClick={() => setShowSolicitarModal(false)}>Cancelar</Button>
            <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white" onClick={handleSolicitarFilial}>Solicitar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckCircle(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}

function AlertTriangle(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
