import { useState } from "react";
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, FolderOpen, FileText, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

const mockPlanoContas: Conta[] = [
  // Receitas
  { id: "1", codigo: "1", nome: "RECEITAS", tipo: "receita", nivel: 0, ativa: true },
  { id: "1.1", codigo: "1.1", nome: "Frete Rodoviário", tipo: "receita", nivel: 1, paiId: "1", ativa: true, total: 980000 },
  { id: "1.2", codigo: "1.2", nome: "Frete Dedicado", tipo: "receita", nivel: 1, paiId: "1", ativa: true, total: 320000 },
  { id: "1.3", codigo: "1.3", nome: "Serviços Logísticos", tipo: "receita", nivel: 1, paiId: "1", ativa: true, total: 128000 },
  { id: "1.4", codigo: "1.4", nome: "Outros Serviços", tipo: "receita", nivel: 1, paiId: "1", ativa: true, total: 30000 },
  
  // Custos Operacionais
  { id: "2", codigo: "2", nome: "CUSTOS OPERACIONAIS", tipo: "custo", nivel: 0, ativa: true },
  { id: "2.1", codigo: "2.1", nome: "Custo Prestadores", tipo: "custo", nivel: 1, paiId: "2", ativa: true, total: 520000 },
  { id: "2.2", codigo: "2.2", nome: "Combustível", tipo: "custo", nivel: 1, paiId: "2", ativa: true, total: 120000 },
  { id: "2.3", codigo: "2.3", nome: "Pedágio", tipo: "custo", nivel: 1, paiId: "2", ativa: true, total: 45000 },
  { id: "2.4", codigo: "2.4", nome: "Seguro de Carga", tipo: "custo", nivel: 1, paiId: "2", ativa: true, total: 65000 },
  { id: "2.5", codigo: "2.5", nome: "Manutenção", tipo: "custo", nivel: 1, paiId: "2", ativa: true, total: 85000 },
  
  // Despesas
  { id: "3", codigo: "3", nome: "DESPESAS", tipo: "despesa", nivel: 0, ativa: true },
  { id: "3.1", codigo: "3.1", nome: "Despesas Administrativas", tipo: "despesa", nivel: 1, paiId: "3", ativa: true, total: 95000 },
  { id: "3.2", codigo: "3.2", nome: "Despesas Comerciais", tipo: "despesa", nivel: 1, paiId: "3", ativa: true, total: 45000 },
  { id: "3.3", codigo: "3.3", nome: "Despesas Financeiras", tipo: "despesa", nivel: 1, paiId: "3", ativa: true, total: 28000 },
  { id: "3.4", codigo: "3.4", nome: "Tributos", tipo: "despesa", nivel: 1, paiId: "3", ativa: true, total: 62000 },
  
  // Resultado
  { id: "4", codigo: "4", nome: "RESULTADO", tipo: "resultado", nivel: 0, ativa: true },
  { id: "4.1", codigo: "4.1", nome: "Lucro/Prejuízo", tipo: "resultado", nivel: 1, paiId: "4", ativa: true, total: 180750 },
];

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["1", "2", "3", "4"]));
  const [editando, setEditando] = useState<string | null>(null);
  const [novaConta, setNovaConta] = useState<Partial<Conta>>({});
  const [showModal, setShowModal] = useState(false);
  const [contaPai, setContaPai] = useState<string>("");

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
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
    setShowModal(false);
    setNovaConta({});
    setContaPai("");
  };

  const renderConta = (conta: Conta) => {
    const hasChildren = contas.some(c => c.paiId === conta.id);
    const isExpanded = expanded.has(conta.id);
    const children = contas.filter(c => c.paiId === conta.id);
    const paddingLeft = conta.nivel * 24 + 8;

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
              ) : (
                <span className="w-5" />
              )}
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
            {conta.nivel === 1 ? fmtFin(conta.total) : "—"}
          </TableCell>
          <TableCell className="py-2 text-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-6 w-6 p-0 ${conta.ativa ? 'text-green-600' : 'text-red-400'}`}
              onClick={() => toggleAtiva(conta.id)}
              title={conta.ativa ? "Ativo" : "Inativo"}
            >
              {conta.ativa ? "●" : "○"}
            </Button>
          </TableCell>
          <TableCell className="py-2 text-right">
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Edit2 className="w-3 h-3" />
              </Button>
              {conta.nivel === 1 && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500">
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
        {hasChildren && isExpanded && children.map(renderConta)}
      </>
    );
  };

  const contasRoot = contas.filter(c => !c.paiId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Plano de Contas
          </h2>
          <p className="text-sm text-muted-foreground">Estrutura hierárquica de contas contábeis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setContaPai(""); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Estrutura do Plano de Contas</CardTitle>
            <div className="flex gap-2">
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[400px]">Conta</TableHead>
                <TableHead className="w-[120px]">Tipo</TableHead>
                <TableHead className="text-right w-[140px]">Saldo</TableHead>
                <TableHead className="text-center w-[60px]">Status</TableHead>
                <TableHead className="text-right w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contasRoot.map(renderConta)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumo por Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

      {/* Modal Nova Conta */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Conta Pai (opcional)</label>
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
              <label className="text-sm font-medium">Código</label>
              <Input 
                className="mt-1" 
                placeholder="Ex: 1.1.1"
                value={novaConta.codigo || ""}
                onChange={(e) => setNovaConta({...novaConta, codigo: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input 
                className="mt-1" 
                placeholder="Nome da conta"
                value={novaConta.nome || ""}
                onChange={(e) => setNovaConta({...novaConta, nome: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
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
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleNovaConta} className="bg-orange-500 hover:bg-orange-600">
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
