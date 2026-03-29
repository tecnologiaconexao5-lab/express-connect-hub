import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, MapPin, Truck, Users, Star, Clock, Search, Filter, ArrowRight, X } from "lucide-react";

interface Vaga {
  id: number;
  tipoVeiculo: string;
  regiao: string;
  quantidade: number;
  descricao: string;
  scoreMinimo: number;
  aceitaRefrigerado: boolean;
  candidatosCompatíveis: number;
  status: "aberta" | "pausada" | "preenchida";
  createdAt: number;
}

const mockVagas: Vaga[] = [
  { id: 1, tipoVeiculo: "VAN", regiao: "ABC Paulista", quantidade: 3, descricao: "Precisamos de 3 van's para operação semanal", scoreMinimo: 70, aceitaRefrigerado: false, candidatosCompatíveis: 4, status: "aberta", createdAt: Date.now() - 172800000 },
  { id: 2, tipoVeiculo: "Fiorino", regiao: "São Paulo - Leste", quantidade: 2, descricao: "Operação de entrega dedicada com rotas fixas", scoreMinimo: 80, aceitaRefrigerado: true, candidatosCompatíveis: 6, status: "aberta", createdAt: Date.now() - 86400000 },
  { id: 3, tipoVeiculo: "Carreta LS", regiao: "Campinas", quantidade: 1, descricao: "Transporte de carga lotação para região Sudeste", scoreMinimo: 75, aceitaRefrigerado: false, candidatosCompatíveis: 2, status: "aberta", createdAt: Date.now() - 259200000 },
  { id: 4, tipoVeiculo: "3/4 Refrigerado", regiao: "Guarulhos", quantidade: 4, descricao: "Entrega de produtos frios - experiência com refrigeração", scoreMinimo: 85, aceitaRefrigerado: true, candidatosCompatíveis: 3, status: "pausada", createdAt: Date.now() - 432000000 },
];

export function MuralVagas() {
  const [vagas, setVagas] = useState<Vaga[]>(mockVagas);
  const [showNovaVaga, setShowNovaVaga] = useState(false);
  const [vagaSelecionada, setVagaSelecionada] = useState<Vaga | null>(null);

  const getStatusColor = (status: string) => {
    if (status === "aberta") return "bg-green-100 text-green-800 border-green-300";
    if (status === "pausada") return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-slate-100 text-slate-800 border-slate-300";
  };

  const getVeiculoIcon = (tipo: string) => {
    if (tipo.includes("Refrigerado")) return <Truck className="w-4 h-4 text-blue-500"/>;
    if (tipo.includes("Fiorino") || tipo.includes("Van")) return <Truck className="w-4 h-4 text-orange-500"/>;
    if (tipo.includes("Carreta")) return <Truck className="w-4 h-4 text-purple-500"/>;
    return <Truck className="w-4 h-4 text-slate-500"/>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground"/>
            <Input placeholder="Buscar vagas por veículo ou região" className="pl-9 h-9 text-xs"/>
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1"><Filter className="w-4 h-4"/> Filtros</Button>
        </div>
        <Button className="bg-primary gap-2" onClick={() => setShowNovaVaga(true)}><Plus className="w-4 h-4"/> Criar Vaga</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {vagas.map(vaga => (
          <Card key={vaga.id} className={`hover:shadow-lg transition-all cursor-pointer ${vaga.status === 'aberta' ? 'border-l-4 border-l-green-500' : vaga.status === 'pausada' ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-slate-300'}`} onClick={() => setVagaSelecionada(vaga)}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getVeiculoIcon(vaga.tipoVeiculo)}
                  <CardTitle className="text-base">{vaga.tipoVeiculo}</CardTitle>
                </div>
                <Badge variant="outline" className={`text-[10px] ${getStatusColor(vaga.status)}`}>
                  {vaga.status === "aberta" ? "Aberta" : vaga.status === "pausada" ? "Pausada" : "Preenchida"}
                </Badge>
              </div>
              <CardDescription className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {vaga.regiao}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3">{vaga.descricao}</p>
              
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs bg-slate-50">
                  <Users className="w-3 h-3 mr-1"/> {vaga.quantidade} vagas
                </Badge>
                {vaga.aceitaRefrigerado && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    Refrigerado
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3"/>
                  <span>{Math.floor((Date.now() - vaga.createdAt) / 86400000)}d</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-sm font-bold ${vaga.candidatosCompatíveis > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                    {vaga.candidatosCompatíveis}
                  </span>
                  <span className="text-[10px] text-muted-foreground">cand.</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Score mínimo</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500"/>
                    <span className="font-bold">{vaga.scoreMinimo}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* CARD CRIAR NOVA VAGA */}
        <Card className="border-dashed border-2 border-slate-300 hover:border-primary hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center min-h-[200px]" onClick={() => setShowNovaVaga(true)}>
          <div className="text-center">
            <Plus className="w-8 h-8 mx-auto text-slate-400 mb-2"/>
            <p className="text-sm text-slate-500 font-medium">Criar Nova Vaga</p>
          </div>
        </Card>
      </div>

      {/* MODAL NOVA VAGA */}
      <Dialog open={showNovaVaga} onOpenChange={setShowNovaVaga}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Criar Nova Vaga</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Veículo</Label>
                <Input placeholder="Ex: Fiorino, Van, Carreta" />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" placeholder="1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Região</Label>
              <Input placeholder="Ex: São Paulo - Leste" />
            </div>
            <div className="space-y-2">
              <Label>Descrição da Necessidade</Label>
              <Textarea placeholder="Descreva os detalhes da operação..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Score Mínimo</Label>
                <Input type="number" placeholder="70" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="refrigerado" className="rounded"/>
                <Label htmlFor="refrigerado" className="text-sm">Aceita Refrigerado</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovaVaga(false)}>Cancelar</Button>
            <Button className="bg-primary">Publicar Vaga</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALHE VAGA */}
      <Dialog open={!!vagaSelecionada} onOpenChange={() => setVagaSelecionada(null)}>
        <DialogContent className="max-w-2xl">
          {vagaSelecionada && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    {getVeiculoIcon(vagaSelecionada.tipoVeiculo)}
                    {vagaSelecionada.tipoVeiculo} - {vagaSelecionada.regiao}
                  </DialogTitle>
                  <Badge variant="outline" className={getStatusColor(vagaSelecionada.status)}>
                    {vagaSelecionada.status === "aberta" ? "Aberta" : vagaSelecionada.status === "pausada" ? "Pausada" : "Preenchida"}
                  </Badge>
                </div>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm">{vagaSelecionada.descricao}</p>
                
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground"/>
                    <span className="text-sm">{vagaSelecionada.quantidade} vagas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500"/>
                    <span className="text-sm">Score mínimo: {vagaSelecionada.scoreMinimo}</span>
                  </div>
                  {vagaSelecionada.aceitaRefrigerado && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">Refrigerado</Badge>
                  )}
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-green-800">Candidatos Compatíveis</p>
                      <p className="text-sm text-green-600">Baseado no score mínimo e região</p>
                    </div>
                    <span className="text-3xl font-black text-green-600">{vagaSelecionada.candidatosCompatíveis}</span>
                  </div>
                </div>

                <div className="text-center">
                  <Button className="bg-primary gap-2">
                    Ver Candidatos Compatíveis
                    <ArrowRight className="w-4 h-4"/>
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2">Pausar Vaga</Button>
                <Button variant="outline" className="gap-2 text-red-600">Encerrar Vaga</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
