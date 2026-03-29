import { useState } from "react";
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, FolderOpen, FileText, Save, X, DollarSign, Calculator, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conta {
  id: string;
  codigo: string;
  nome: string;
  tipo: "receita" | "custo" | "despesa" | "resultado";
  nivel: number;
  paiId?: string;
  ativa: boolean;
  total?: number;
}

interface Lancamento {
  id: string;
  contaId: string;
  data: Date;
  tipo: "debito" | "credito";
  contrapartidaId: string;
  contraPartidaId?: string;
  valor: number;
  historico: string;
  centroCusto: string;
  osVinculada?: string;
  documentoRef?: string;
  competencia: string;
  origem: "manual" | "automatico";
}

const mockPlanoContas: Conta[] = [
  { id: "1", codigo: "1", nome: "RECEITAS", tipo: "receita", nivel: 0, ativa: true },
  { id: "1.1", codigo: "1.1", nome: "Frete Rodoviário", tipo: "receita", nivel: 1, paiId: "1", ativa: true, total: 980000 },
  { id: "1.2", codigo: "1.2", nome: "Frete Dedicado", tipo: "receita", nivel: 1, paiId: "1", ativa: true, total: 320000 },
  { id: "1.3", codigo: "1.3", nome: "Serviços Logísticos", tipo: "receita", nivel: 1, paiId: "1", ativa: true, total: 128000 },
  { id: "1.4", codigo: "1.4", nome: "Outros Serviços", tipo: "receita", nivel: 1, paiId: "1", ativa: true, total: 30000 },
  
  { id: "2", codigo: "2", nome: "CUSTOS OPERACIONAIS", tipo: "custo", nivel: 0, ativa: true },
  { id: "2.1", codigo: "2.1", nome: "Custo Prestadores", tipo: "custo", nivel: 1, paiId: "2", ativa: true, total: 520000 },
  { id: "2.2", codigo: "2.2", nome: "Combustível", tipo: "custo", nivel: 1, paiId: "2", ativa: true, total: 120000 },
  { id: "2.3", codigo: "2.3", nome: "Pedágio", tipo: "custo", nivel: 1, paiId: "2", ativa: true, total: 45000 },
  { id: "2.4", codigo: "2.4", nome: "Seguro de Carga", tipo: "custo", nivel: 1, paiId: "2", ativa: true, total: 65000 },
  { id: "2.5", codigo: "2.5", nome: "Manutenção", tipo: "custo", nivel: 1, paiId: "2", ativa: true, total: 85000 },
  
  { id: "3", codigo: "3", nome: "DESPESAS", tipo: "despesa", nivel: 0, ativa: true },
  { id: "3.1", codigo: "3.1", nome: "Despesas Administrativas", tipo: "despesa", nivel: 1, paiId: "3", ativa: true, total: 95000 },
  { id: "3.2", codigo: "3.2", nome: "Despesas Comerciais", tipo: "despesa", nivel: 1, paiId: "3", ativa: true, total: 45000 },
  { id: "3.3", codigo: "3.3", nome: "Despesas Financeiras", tipo: "despesa", nivel: 1, paiId: "3", ativa: true, total: 28000 },
  { id: "3.4", codigo: "3.4", nome: "Tributos", tipo: "despesa", nivel: 1, paiId: "3", ativa: true, total: 62000 },
  
  { id: "4", codigo: "4", nome: "RESULTADO", tipo: "resultado", nivel: 0, ativa: true },
  { id: "4.1", codigo: "4.1", nome: "Lucro/Prejuízo", tipo: "resultado", nivel: 1, paiId: "4", ativa: true, total: 180750 },
];

const mockLancamentos: Lancamento[] = [
  { id: "l1", contaId: "1.1", data: new Date(2026, 2, 25), tipo: "credito", contrapartidaId: "1", valor: 15000, historico: "Recebimento FAT-2026-045", centroCusto: "SP", osVinculada: "OS-4821", documentoRef: "FAT-045", competencia: "03/2026", origem: "manual" },
  { id: "l2", contaId: "2.1", data: new Date(2026, 2, 24), tipo: "debito", contrapartidaId: "1.1", valor: 8500, historico: "Pagamento prestação de serviço", centroCusto: "SP", osVinculada: "OS-4815", documentoRef: "NF-1234", competencia: "03/2026", origem: "automatico" },
  { id: "l3", contaId: "2.2", data: new Date(2026, 2, 23), tipo: "debito", contrapartidaId: "1", valor: 3200, historico: "Abastecimento veículo", centroCusto: "SP", documentoRef: "NF-Posto", competencia: "03/2026", origem: "manual" },
];

const centrosCusto = ["SP", "RJ", "MG", "PR", "SC", "BH", "Centro-Oeste", "Norte", "Nordeste"];

const fmtFin = (v?: number) => v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const getTipoColor = (tipo: string) => {
  switch (tipo) {
    case "receita": return "bg-green-100 text-green-800";
    case "custo": return "bg-orange-100 text-orange-800";
    case "despesa": return "bg-red-100 text-red-800";
    case "resultado": return "bg-purple-100 text-purple-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

const getTipoLabel = (tipo: string) => {
  switch (tipo) {
    case "receita": return "Receita";
    case "custo": return "Custo";
    case "despesa": return "Despesa";
    case "resultado": return "Resultado";
    default: return tipo;
  }
};

export default function PlanoContas() {
  const [contas, setContas] = useState<Conta[]>(mockPlanoContas);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(mockLancamentos);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["1", "2", "3", "4"]));
  const [contaSelecionada, setContaSelecionada] = useState<string | null>(null);
  const [showModalConta, setShowModalConta] = useState(false);
  const [showModalLancamento, setShowModalLancamento] = useState(false);
  const [contaPai, setContaPai] = useState<string>("");
  const [novaConta, setNovaConta] = useState<Partial<Conta>>({});
  const [novoLancamento, setNovoLancamento] = useState<Partial<Lancamento>>({
    data: new Date(),
    tipo: "debito",
    origem: "manual",
    competencia: format(new Date(), "MM/yyyy"),
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpanded(newExpanded);
  };

  const toggleAtiva = (id: string) => {
    setContas(contas.map(c => c.id === id ? { ...c, ativa: !c.ativa } : c));
  };

  const handleNovaConta = () => {
    if (!novaConta.nome || !novaConta.codigo || !novaConta.tipo) return;
    const nova: Conta = {
      id: novaConta.codigo,
      codigo: novaConta.codigo,
      nome: novaConta.nome,
      tipo: novaConta.tipo as any,
      nivel: contaPai ? 1 : 0,
      paiId: contaPai || undefined,
      ativa: true,
      total: 0
    };
    setContas([...contas, nova]);
    setShowModalConta(false);
    setNovaConta({});
    setContaPai("");
  };

  const handleNovoLancamento = () => {
    if (!novoLancamento.valor || !novoLancamento.historico || !contaSelecionada) return;
    
    const lancamento: Lancamento = {
      id: `l${Date.now()}`,
      contaId: contaSelecionada,
      data: novoLancamento.data || new Date(),
      tipo: novoLancamento.tipo as "debito" | "credito",
      contrapartidaId: novoLancamento.contrapartidaId || "",
      valor: novoLancamento.valor,
      historico: novoLancamento.historico,
      centroCusto: novoLancamento.centroCusto || "",
      osVinculada: novoLancamento.osVinculada,
      documentoRef: novoLancamento.documentoRef,
      competencia: novoLancamento.competencia || format(new Date(), "MM/yyyy"),
      origem: novoLancamento.origem as "manual" | "automatico",
    };
    
    setLancamentos([...lancamentos, lancamento]);
    setShowModalLancamento(false);
    setNovoLancamento({
      data: new Date(),
      tipo: "debito",
      origem: "manual",
      competencia: format(new Date(), "MM/yyyy"),
    });
  };

  const getSaldoConta = (contaId: string) => {
    const lancamentosConta = lancamentos.filter(l => l.contaId === contaId);
    const debitos = lancamentosConta.filter(l => l.tipo === "debito").reduce((acc, l) => acc + l.valor, 0);
    const creditos = lancamentosConta.filter(l => l.tipo === "credito").reduce((acc, l) => acc + l.valor, 0);
    return creditos - debitos;
  };

  const getLancamentosConta = (contaId: string) => {
    return lancamentos.filter(l => l.contaId === contaId);
  };

  const contasAtivas = contas.filter(c => c.ativa && c.nivel === 1);

  const renderConta = (conta: Conta) => {
    const hasChildren = contas.some(c => c.paiId === conta.id);
    const isExpanded = expanded.has(conta.id);
    const children = contas.filter(c => c.paiId === conta.id);
    const paddingLeft = conta.nivel * 24 + 8;
    const saldo = getSaldoConta(conta.id);

    return (
      <>
        <TableRow 
          key={conta.id} 
          className={`hover:bg-muted/50 ${!conta.ativa ? 'opacity-50' : ''} ${conta.nivel === 0 ? 'bg-slate-50 font-bold' : ''}`}
        >
          <TableCell className="py-2">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${paddingLeft}px` }}>
              {hasChildren ? (
                <button onClick={() => toggleExpand(conta.id)} className="p-0.5 hover:bg-muted rounded">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              ) : <span className="w-5" />}
              {conta.nivel === 0 ? (
                <FolderOpen className="w-4 h-4 text-slate-600" />
              ) : (
                <FileText className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="font-mono text-xs w-8 text-muted-foreground">{conta.codigo}</span>
              <span>{conta.nome}</span>
            </div>
          </TableCell>
          <TableCell className="py-2">
            <Badge className={getTipoColor(conta.tipo)}>{getTipoLabel(conta.tipo)}</Badge>
          </TableCell>
          <TableCell className="py-2 text-right font-mono">
            {conta.nivel === 1 ? fmtFin(saldo) : "—"}
          </TableCell>
          <TableCell className="py-2 text-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-6 w-6 p-0 ${conta.ativa ? 'text-green-600' : 'text-red-400'}`}
              onClick={() => toggleAtiva(conta.id)}
            >
              {conta.ativa ? "●" : "○"}
            </Button>
          </TableCell>
          <TableCell className="py-2 text-right">
            <div className="flex gap-1 justify-end">
              {conta.nivel === 1 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100"
                  onClick={() => { setContaSelecionada(conta.id); setShowModalLancamento(true); }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Lançamento
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
        {hasChildren && isExpanded && children.map(renderConta)}
      </>
    );
  };

  const lancamentosDaConta = contaSelecionada ? getLancamentosConta(contaSelecionada) : [];
  const contaAtual = contas.find(c => c.id === contaSelecionada);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Plano de Contas
          </h2>
          <p className="text-sm text-muted-foreground">Estrutura hierárquica de contas contábeis com lançamentos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setContaPai(""); setShowModalConta(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de Contas */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="py-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Estrutura do Plano de Contas</CardTitle>
                <Select defaultValue="todos">
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="receita">Receitas</SelectItem>
                    <SelectItem value="custo">Custos</SelectItem>
                    <SelectItem value="despesa">Despesas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Conta</TableHead>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead className="text-right w-[120px]">Saldo</TableHead>
                    <TableHead className="text-center w-[60px]">Status</TableHead>
                    <TableHead className="text-right w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contas.filter(c => !c.paiId).map(renderConta)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por Tipo */}
        <div className="space-y-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-green-800 uppercase">Total Receitas</p>
              <p className="text-xl font-bold text-green-700 mt-1">{fmtFin(1458000)}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-orange-800 uppercase">Total Custos</p>
              <p className="text-xl font-bold text-orange-700 mt-1">{fmtFin(845000)}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-red-800 uppercase">Total Despesas</p>
              <p className="text-xl font-bold text-red-700 mt-1">{fmtFin(230000)}</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-purple-800 uppercase">Lucro/Prejuízo</p>
              <p className="text-xl font-bold text-purple-700 mt-1">{fmtFin(382000)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Nova Conta */}
      <Dialog open={showModalConta} onOpenChange={setShowModalConta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conta Contábil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Conta Pai (opcional)</Label>
              <Select value={contaPai} onValueChange={setContaPai}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione ou deixe vazio para criar grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum (Grupo Principal)</SelectItem>
                  {contas.filter(c => c.nivel === 0).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Código</Label>
              <Input className="mt-1" placeholder="Ex: 1.1.1" value={novaConta.codigo || ""} onChange={(e) => setNovaConta({...novaConta, codigo: e.target.value})} />
            </div>
            <div>
              <Label>Nome</Label>
              <Input className="mt-1" placeholder="Nome da conta" value={novaConta.nome || ""} onChange={(e) => setNovaConta({...novaConta, nome: e.target.value})} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={novaConta.tipo || ""} onValueChange={(v) => setNovaConta({...novaConta, tipo: v as any})}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="custo">Custo</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="resultado">Resultado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModalConta(false)}>Cancelar</Button>
            <Button onClick={handleNovaConta} className="bg-orange-500 hover:bg-orange-600">
              <Save className="w-4 h-4 mr-2" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Lançamento */}
      <Dialog open={showModalLancamento} onOpenChange={setShowModalLancamento}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Novo Lançamento - {contaAtual?.codigo} {contaAtual?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full mt-1 justify-start">
                      {novoLancamento.data ? format(novoLancamento.data, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={novoLancamento.data} onSelect={(d) => setNovoLancamento({...novoLancamento, data: d})} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={novoLancamento.tipo} onValueChange={(v) => setNovoLancamento({...novoLancamento, tipo: v as any})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debito">Débito</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Conta de Contrapartida</Label>
              <Select value={novoLancamento.contrapartidaId} onValueChange={(v) => setNovoLancamento({...novoLancamento, contrapartidaId: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a contrapartida" />
                </SelectTrigger>
                <SelectContent>
                  {contasAtivas.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Valor (R$)</Label>
              <Input 
                type="number" 
                className="mt-1" 
                placeholder="0,00" 
                value={novoLancamento.valor || ""}
                onChange={(e) => setNovoLancamento({...novoLancamento, valor: parseFloat(e.target.value) || 0})}
              />
            </div>

            <div>
              <Label>Histórico / Descrição</Label>
              <Textarea 
                className="mt-1" 
                placeholder="Descreva o lançamento..."
                value={novoLancamento.historico || ""}
                onChange={(e) => setNovoLancamento({...novoLancamento, historico: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Centro de Custo</Label>
                <Select value={novoLancamento.centroCusto} onValueChange={(v) => setNovoLancamento({...novoLancamento, centroCusto: v})}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {centrosCusto.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Competência</Label>
                <Input 
                  className="mt-1" 
                  placeholder="MM/AAAA"
                  value={novoLancamento.competencia || ""}
                  onChange={(e) => setNovoLancamento({...novoLancamento, competencia: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>OS Vinculada (opcional)</Label>
                <Input 
                  className="mt-1" 
                  placeholder="OS-0000"
                  value={novoLancamento.osVinculada || ""}
                  onChange={(e) => setNovoLancamento({...novoLancamento, osVinculada: e.target.value})}
                />
              </div>
              <div>
                <Label>Documento de Referência</Label>
                <Input 
                  className="mt-1" 
                  placeholder="NF, CT-e, etc."
                  value={novoLancamento.documentoRef || ""}
                  onChange={(e) => setNovoLancamento({...novoLancamento, documentoRef: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label>Tipo de Origem</Label>
              <Select value={novoLancamento.origem} onValueChange={(v) => setNovoLancamento({...novoLancamento, origem: v as any})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatico">Automático (do sistema)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModalLancamento(false)}>Cancelar</Button>
            <Button onClick={handleNovoLancamento} className="bg-orange-500 hover:bg-orange-600">
              <Save className="w-4 h-4 mr-2" /> Salvar Lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
