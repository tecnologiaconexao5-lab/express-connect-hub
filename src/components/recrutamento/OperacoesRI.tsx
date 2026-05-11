import { useState, useEffect } from "react";
import { Search, MapPin, Truck, Target, Users, PlayCircle, PauseCircle, Archive, CheckCircle, Copy, Check, Filter, Plus, Edit, Trash2, XCircle, History, Clock, Route, Calendar, DollarSign, TrendingUp, AlertTriangle, ChevronRight, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Operacao {
  id: number;
  nome: string;
  cliente: string;
  regiao: string;
  rota: string;
  veiculo: string;
  tipoCarga: string;
  valorSaida: number;
  kmIncluso: number;
  kmExcedente: number;
  valorKmExcedente: number;
  diaria: number;
  status: string;
  prioridade: string;
  dataInicio: string;
  recurrencia: string;
  captados: number;
  aprovados: number;
  vagas: number;
  lucroMedio: number;
  eficiencia: number;
  secoRefrigerado: string;
  observacoes: string;
  historico: HistoricoItem[];
  tipoProduto?: string;
  pesoCarga?: string;
  dimensoes?: string;
  horarioCarregamento?: string;
  localCarregamento?: string;
  formaPagamento?: string;
  valorPrestador?: number;
  imposto?: number;
  custoSeguro?: number;
}

interface HistoricoItem {
  id: number;
  acao: string;
  data: string;
  usuario: string;
  observacao: string;
}

const mockOperacoes: Operacao[] = [
  { 
    id: 1, 
    nome: "Rota Sul D+1", 
    cliente: "Magazine Luiza", 
    regiao: "São Paulo", 
    rota: "SP x Curitiba x Porto Alegre",
    veiculo: "Carreta", 
    tipoCarga: "seco", 
    valorSaida: 14500, 
    kmIncluso: 1200,
    kmExcedente: 0,
    valorKmExcedente: 8.50,
    diaria: 2,
    status: "Ativo", 
    prioridade: "alta",
    dataInicio: "2026-05-01",
    recurrencia: "diaria",
    captados: 12, 
    aprovados: 3, 
    vagas: 5, 
    lucroMedio: 3800, 
    eficiencia: 92, 
    secoRefrigerado: "seco", 
    observacoes: "Operação consolidada com cliente histórico",
    historico: [
      { id: 1, acao: "Criação", data: "2026-03-15", usuario: "admin", observacao: "Operação criada" },
      { id: 2, acao: "Início", data: "2026-05-01", usuario: "admin", observacao: "Início das operações" }
    ]
  },
  { 
    id: 2, 
    nome: "Distribuição Capital", 
    cliente: "Amazon", 
    regiao: "São Paulo (Metropolitana)", 
    rota: "CD São Paulo x Entregas Metropolitanas",
    veiculo: "Van", 
    tipoCarga: "refrigerado", 
    valorSaida: 650, 
    kmIncluso: 100,
    kmExcedente: 0,
    valorKmExcedente: 3.50,
    diaria: 1,
    status: "Ativo", 
    prioridade: "media",
    dataInicio: "2026-04-01",
    recurrencia: "diaria",
    captados: 45, 
    aprobados: 12, 
    vagas: 15, 
    lucroMedio: 150, 
    eficiencia: 88, 
    secoRefrigerado: "refrigerado", 
    observacoes: "Alta rotatividade - operação intensiva",
    historico: []
  },
  { 
    id: 3, 
    nome: "Transferência NE", 
    cliente: "Mercado Livre", 
    regiao: "São Paulo", 
    rota: "SP x Salvador x Recife",
    veiculo: "Truck", 
    tipoCarga: "seco", 
    valorSaida: 8200, 
    kmIncluso: 2500,
    kmExcedente: 0,
    valorKmExcedente: 6.50,
    diaria: 3,
    status: "Pausado", 
    prioridade: "baixa",
    dataInicio: "",
    recurrencia: "semanal",
    captados: 8, 
    aprobados: 1, 
    vagas: 2, 
    lucroMedio: 1900, 
    eficiencia: 76, 
    secoRefrigerado: "seco", 
    observacoes: "Pausada temporariamente por reestruturação",
    historico: []
  },
];

const TIPOS_VEICULO = ["Fiorino", "Kangoo", "Kombi", "Van", "VUC", "HR", "3/4", "Toco", "Truck", "Carreta", "Bitrem", "Carreta LS"];

export function OperacoesRI() {
  const userRole = "admin"; // Temporário, deve vir do contexto de auth
  const canViewFinanceiro = (role: string) => {
    return role === "admin" || role === "financeiro";
  };
  const [busca, setBusca] = useState("");
  const [copied, setCopied] = useState(false);
  const [showWappConfirm, setShowWappConfirm] = useState<any>(null);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [modalCriar, setModalCriar] = useState(false);
  const [editando, setEditando] = useState<Operacao | null>(null);
  const [novaOperacao, setNovaOperacao] = useState<Partial<Operacao>>({
    status: "Ativo",
    secoRefrigerado: "seco",
    vagas: 1,
    valor: 0,
    captados: 0,
    aprovados: 0,
    lucroMedio: 0,
    eficiencia: 85
  });

  const handleCopyWapp = (op: any) => {
    const text = `*🚨 NOVA OPERAÇÃO DISPONÍVEL - ${op.nome} 🚨*
📍 *Região de Carregamento:* ${op.regiao}
⏰ *Horário de Carregamento:* ${op.horarioCarregamento || "A confirmar"}
🚚 *Tipo de Veículo Exigido:* ${op.veiculo}
📦 *Tipo de Produto:* ${op.tipoProduto || op.secoRefrigerado}
💰 *Valor Estimado:* R$ ${(op.valorPrestador || 0).toFixed(2)}
💳 *Forma de Pagamento:* ${op.formaPagamento || "A confirmar"}

Interessados favor responder "TENHO INTERESSE" para seguirmos com o cadastro!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Simular abertura do wame para o prestador se houvesse numero, mas aqui copiamos o template geral.
    toast.success("Mensagem copiada! Abra o WhatsApp do prestador e cole.");
  };

  const enviarWhatsAppSelecionados = () => {
    handleCopyWapp(showWappConfirm);
    setShowWappConfirm(null);
  };
  
  useEffect(() => {
    const saved = localStorage.getItem("recrutamento_operacoes");
    if (saved) {
      try {
        setOperacoes(JSON.parse(saved));
      } catch(e) {}
    } else {
      setOperacoes(mockOperacoes);
      localStorage.setItem("recrutamento_operacoes", JSON.stringify(mockOperacoes));
    }
  }, []);

  const persist = (ops: Operacao[]) => {
    setOperacoes(ops);
    localStorage.setItem("recrutamento_operacoes", JSON.stringify(ops));
  };

const handleSalvarOperacao = () => {
    if (!novaOperacao.nome || !novaOperacao.cliente || !novaOperacao.veiculo) {
      toast.error("Preencha nome, cliente e veículo");
      return;
    }
    if ((novaOperacao.vagas || 0) < 1) {
      toast.error("A quantidade de veículos não pode ser menor que 1");
      return;
    }
    if ((novaOperacao.diaria || 0) < 1) {
      toast.error("A quantidade de dias não pode ser menor que 1");
      return;
    }
    if ((novaOperacao.imposto || 0) < 0) {
      toast.error("O imposto não pode ser negativo");
      return;
    }
    if ((novaOperacao.custoSeguro || 0) < 0) {
      toast.error("O seguro não pode ser negativo");
      return;
    }
    
    const valor_cliente = novaOperacao.valorSaida || 0;
    const imposto_valor = (valor_cliente * (novaOperacao.imposto || 0)) / 100;
    const seguro_valor = (valor_cliente * (novaOperacao.custoSeguro || 0)) / 100;
    const receita_liquida = valor_cliente - imposto_valor;
    const custo_unitario = (novaOperacao.valorPrestador || 0) + seguro_valor;
    const lucro_unitario = receita_liquida - custo_unitario;
    
    if (valor_cliente > 0 && valor_cliente < custo_unitario) {
      toast.warning("Atenção: Margem negativa detectada.");
    }
    
    if (!novaOperacao.valorPrestador) {
      toast.warning("Salvo como rascunho sem valor prestador.");
    }

    const opToSave: Operacao = {
      id: editando ? editando.id : Date.now(),
      nome: novaOperacao.nome || "",
      cliente: novaOperacao.cliente || "",
      regiao: novaOperacao.regiao || "",
      rota: novaOperacao.rota || "",
      veiculo: novaOperacao.veiculo || "",
      tipoCarga: novaOperacao.tipoCarga || "seco",
      valorSaida: novaOperacao.valorSaida || novaOperacao.valor || 0,
      kmIncluso: novaOperacao.kmIncluso || 0,
      kmExcedente: novaOperacao.kmExcedente || 0,
      valorKmExcedente: novaOperacao.valorKmExcedente || 0,
      diaria: novaOperacao.diaria || 1,
      status: novaOperacao.status || "Ativo",
      prioridade: novaOperacao.prioridade || "media",
      dataInicio: novaOperacao.dataInicio || "",
      recurrencia: novaOperacao.recurrencia || "diaria",
      captados: novaOperacao.captados || 0,
      aprovados: novaOperacao.aprovados || 0,
      vagas: novaOperacao.vagas || 1,
      lucroMedio: lucro_unitario,
      eficiencia: novaOperacao.eficiencia || 85,
      secoRefrigerado: novaOperacao.secoRefrigerado || "seco",
      observacoes: novaOperacao.observacoes || "",
      tipoProduto: novaOperacao.tipoProduto || "",
      pesoCarga: novaOperacao.pesoCarga || "",
      dimensoes: novaOperacao.dimensoes || "",
      horarioCarregamento: novaOperacao.horarioCarregamento || "",
      localCarregamento: novaOperacao.localCarregamento || "",
      formaPagamento: novaOperacao.formaPagamento || "",
      valorPrestador: novaOperacao.valorPrestador || 0,
      imposto: novaOperacao.imposto || 0,
      custoSeguro: novaOperacao.custoSeguro || 0,
      historico: editando ? (editando.historico || []) : [
        { id: Date.now(), acao: "Criação", data: new Date().toISOString().split("T")[0], usuario: "usuário", observacao: "Operação criada via sistema" }
      ]
    } as Operacao;

    if (editando) {
      const novas = operacoes.map(o => o.id === editando.id ? opToSave : o);
      persist(novas);
      toast.success("Operação atualizada!");
    } else {
      persist([...operacoes, opToSave]);
      toast.success("Operação salva! Match inteligente processado.");
      
      // Auto match na criação
      import("@/lib/matchPrestadores").then(module => {
         const prestadoresLocal = JSON.parse(localStorage.getItem("banco_motoristas_tms") || "[]");
         module.matchPrestadoresParaOperacao(opToSave, prestadoresLocal).then(() => {
            console.log("Match processado em background.");
         });
      });
    }
    
    setModalCriar(false);
    setEditando(null);
    setNovaOperacao({ status: "Ativo", secoRefrigerado: "seco", vagas: 1, diaria: 1, valorSaida: 0, valor: 0, captados: 0, aprovados: 0, lucroMedio: 0, eficiencia: 85 });
  };

  const handleEditar = (op: Operacao) => {
    setEditando(op);
    setNovaOperacao(op);
    setModalCriar(true);
  };

  const handleExclude = (id: number) => {
    if (window.confirm("Tem certeza que deseja excluir esta operação?")) {
      persist(operacoes.filter(o => o.id !== id));
      toast.success("Operação excluída!");
    }
  };

  const handleDuplicar = (op: Operacao) => {
    const duplicada: Operacao = {
      ...op,
      id: Date.now(),
      nome: `${op.nome} (Cópia)`,
      status: "Ativo",
      captados: 0,
      aprovados: 0,
      historico: [
        { id: Date.now(), acao: "Duplicação", data: new Date().toISOString().split("T")[0], usuario: "usuário", observacao: `Duplicada a partir de ${op.nome}` }
      ]
    };
    persist([...operacoes, duplicada]);
    toast.success("Operação duplicada!");
  };

  const handlePausar = (op: Operacao) => {
    const novas = operacoes.map(o => {
      if (o.id === op.id) {
        return {
          ...o,
          status: o.status === "Pausado" ? "Ativo" : "Pausado",
          historico: [
            ...(o.historico || []),
            { id: Date.now(), acao: o.status === "Pausado" ? "Reativação" : "Pausa", data: new Date().toISOString().split("T")[0], usuario: "usuário", observacao: o.status === "Pausado" ? "Operação reativada" : "Operação pausada" }
          ]
        };
      }
      return o;
    });
    persist(novas);
    toast.success(novas.find(o => o.id === op.id)?.status === "Pausado" ? "Operação pausada!" : "Operação reativada!");
  };

  const handleArquivar = (op: Operacao) => {
    const novas = operacoes.map(o => {
      if (o.id === op.id) {
        return {
          ...o,
          status: "Arquivado",
          historico: [
            ...(o.historico || []),
            { id: Date.now(), acao: "Arquivamento", data: new Date().toISOString().split("T")[0], usuario: "usuário", observacao: "Operação arquivada" }
          ]
        };
      }
      return o;
    });
    persist(novas);
    toast.success("Operação arquivada!");
  };

  const handleFinalizar = (op: Operacao) => {
    if (window.confirm("Tem certeza que deseja FINALIZAR esta operação? Esta ação não pode ser desfeita.")) {
      const novas = operacoes.map(o => {
        if (o.id === op.id) {
          return {
            ...o,
            status: "Encerrado",
            historico: [
              ...(o.historico || []),
              { id: Date.now(), acao: "Encerramento", data: new Date().toISOString().split("T")[0], usuario: "usuário", observacao: "Operação encerrada definitivamente" }
            ]
          };
        }
        return o;
      });
      persist(novas);
      toast.success("Operação encerrada!");
    }
  };

  const getPrioridadeBadge = (p: string) => {
    switch (p) {
      case "urgente":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Urgente</Badge>;
      case "alta":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Alta</Badge>;
      case "media":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Média</Badge>;
      case "baixa":
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Baixa</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "Ativo":
        return <Badge className="bg-green-600 hover:bg-green-700"><PlayCircle className="w-3 h-3 mr-1"/>Ativo</Badge>;
      case "Pausado":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200"><PauseCircle className="w-3 h-3 mr-1"/>Pausado</Badge>;
      case "Encerrado":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200"><CheckCircle className="w-3 h-3 mr-1"/>Encerrado</Badge>;
      case "Arquivado":
        return <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200"><Archive className="w-3 h-3 mr-1"/>Arquivado</Badge>;
      default:
        return <Badge>{s}</Badge>;
    }
  };

  const operacoesFiltradas = operacoes.filter(o => 
    JSON.stringify(o).toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* DASHBOARD GERAL RECRUTAMENTO */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-white border shadow-sm">
           <CardContent className="p-4 flex flex-col justify-center">
             <p className="text-[10px] text-muted-foreground uppercase font-bold">Vagas Abertas</p>
             <p className="text-2xl font-bold text-slate-800">{operacoes.reduce((acc, op) => acc + (op.vagas || 0), 0)}</p>
           </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm">
           <CardContent className="p-4 flex flex-col justify-center">
             <p className="text-[10px] text-muted-foreground uppercase font-bold">Vagas Preenchidas</p>
             <p className="text-2xl font-bold text-emerald-600">{operacoes.reduce((acc, op) => acc + (op.aprovados || 0), 0)}</p>
           </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm">
           <CardContent className="p-4 flex flex-col justify-center">
             <p className="text-[10px] text-muted-foreground uppercase font-bold">Vagas Pendentes</p>
             <p className="text-2xl font-bold text-orange-600">{operacoes.reduce((acc, op) => acc + ((op.vagas || 0) - (op.aprovados || 0)), 0)}</p>
           </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm">
           <CardContent className="p-4 flex flex-col justify-center">
             <p className="text-[10px] text-muted-foreground uppercase font-bold">Op. Abertas</p>
             <p className="text-2xl font-bold text-indigo-600">{operacoes.filter(o => o.status === "Ativo" || o.status === "Aberta").length}</p>
           </CardContent>
        </Card>
        {canViewFinanceiro(userRole) && (
          <>
            <Card className="bg-white border shadow-sm">
               <CardContent className="p-4 flex flex-col justify-center">
                 <p className="text-[10px] text-muted-foreground uppercase font-bold">Faturamento Prev.</p>
                 <p className="text-lg font-bold text-slate-800">R$ {operacoes.reduce((acc, op) => acc + ((op.valorSaida || op.valor || 0) * (op.vagas || 1) * (op.diaria || 1)), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
               </CardContent>
            </Card>
            <Card className="bg-white border shadow-sm">
               <CardContent className="p-4 flex flex-col justify-center">
                 <p className="text-[10px] text-muted-foreground uppercase font-bold">Lucro Previsto</p>
                 <p className="text-lg font-bold text-emerald-600">R$ {operacoes.reduce((acc, op) => acc + ((op.lucroMedio || 0) * (op.vagas || 1) * (op.diaria || 1)), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
               </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, cliente, rota ou veículo..." 
            className="pl-9 bg-card" 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
           <Button variant="outline"><Filter className="w-4 h-4 mr-2"/> Filtros</Button>
           <Button className="bg-green-600 hover:bg-green-700" onClick={() => setModalCriar(true)}><Plus className="w-4 h-4 mr-2"/> Nova Operação</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {operacoesFiltradas.map((op) => (
          <Dialog key={op.id}>
            <DialogTrigger asChild>
              <Card className="hover:border-primary/50 cursor-pointer transition-all shadow-sm group hover:shadow-lg hover:-translate-y-0.5">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{op.nome}</CardTitle>
                      <CardDescription>{op.cliente}</CardDescription>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {getPrioridadeBadge(op.prioridade)}
                      {getStatusBadge(op.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 text-sm space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400"/> {op.regiao}</div>
                    <div className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-slate-400"/> {op.veiculo}</div>
                  </div>
                  {(op.rota || op.kmIncluso) && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Route className="w-3 h-3"/> {op.rota || "N/A"} • {op.kmIncluso || 0}km incluído{(op.valorKmExcedente || op.valorKmExcedente > 0) && ` + R$${op.valorKmExcedente}/km`}
                    </div>
                  )}
                  <div className="bg-muted/50 border border-border p-3 rounded-lg flex justify-between items-center text-xs">
                     <span className="font-semibold text-muted-foreground uppercase tracking-wide">Valor de Saída</span>
                     <span className="text-lg font-extrabold text-foreground">R$ {Number(op.valorSaida || op.valor).toFixed(2)}</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 flex justify-between border-t mt-2 flex-col">
                  <div className="flex gap-4 w-full py-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="w-3 h-3"/> {op.captados} Captados</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Target className="w-3 h-3"/> {op.vagas} Vagas</div>
                    {op.diaria > 0 && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="w-3 h-3"/> {op.diaria}d</div>}
                  </div>
                  <div className="flex gap-2 w-full border-t pt-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handlePausar(op)}>
                      {op.status === "Pausado" ? <PlayCircle className="w-3 h-3 mr-1"/> : <PauseCircle className="w-3 h-3 mr-1"/>}
                      {op.status === "Pausado" ? "Ativar" : "Pausar"}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handleDuplicar(op)}><Copy className="w-3 h-3 mr-1"/> Duplicar</Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handleEditar(op)}><Edit className="w-3 h-3 mr-1"/> Editar</Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleExclude(op.id)}><Trash2 className="w-3 h-3 mr-1"/></Button>
                  </div>
                </CardFooter>
              </Card>
            </DialogTrigger>

            {/* DASHBOARD DA OPERAÇÃO */}
            <DialogContent className="max-w-[800px] bg-card">
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2">
                   {op.nome} <Badge variant="outline" className="text-xs bg-white text-slate-500 font-normal">{op.cliente}</Badge>
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="geral" className="mt-4">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="metas">Metas</TabsTrigger>
                  {canViewFinanceiro(userRole) && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
                  <TabsTrigger value="match">Match</TabsTrigger>
                </TabsList>
                
                <TabsContent value="geral" className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* COLUNA 1: INDICADORES OPERACIONAIS */}
                    <div className="lg:col-span-1 space-y-4">
                      <Card className="shadow-sm border-0 border-t-2 border-indigo-500">
                        <CardHeader className="py-3 px-4"><CardTitle className="text-xs text-slate-500 uppercase tracking-wider">Métricas de Captação</CardTitle></CardHeader>
                        <CardContent className="px-4 pb-4 space-y-3">
                           <div className="flex justify-between items-center">
                             <span className="text-sm font-semibold">Vagas Abertas</span>
                             <Badge variant="outline" className="font-mono text-indigo-600 bg-indigo-50">{op.vagas}</Badge>
                           </div>
                           <div className="flex justify-between items-center">
                             <span className="text-sm">Cadastrados (Funil)</span>
                             <span className="font-mono">{op.captados}</span>
                           </div>
                           <div className="flex justify-between items-center">
                             <span className="text-sm">Aprovados</span>
                             <span className="font-mono text-green-600 font-bold">{op.aprovados}</span>
                           </div>
                           <div className="flex justify-between items-center">
                             <span className="text-sm">Reprovados</span>
                             <span className="font-mono text-red-500">{op.captados - op.aprovados}</span>
                           </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* COLUNA 2: FINANCEIRO E AÇÕES */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CARD INDICADORES FINANCEIROS RESTRITO E VISUAL EXECUTIVO */}
                        <Card className="shadow-sm border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
                          <CardHeader className="py-3 px-4 border-b bg-slate-50/50"><CardTitle className="text-xs text-slate-500 uppercase flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5"/> Desempenho Estimado</CardTitle></CardHeader>
                          <CardContent className="p-4 grid grid-cols-2 gap-4">
                             <div>
                               <p className="text-[10px] text-slate-400 font-bold">LUCRO MÉDIO OP</p>
                               <p className="text-lg font-bold text-emerald-600">R$ {op.lucroMedio.toFixed(2)}</p>
                             </div>
                             <div>
                               <p className="text-[10px] text-slate-400 font-bold">EFICIÊNCIA</p>
                               <p className="text-lg font-bold text-slate-700">{op.eficiencia}%</p>
                             </div>
                             <div className="col-span-2">
                               <p className="text-[10px] text-slate-400 font-bold">CUSTO VS RECEITA</p>
                               <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                 <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${op.eficiencia}%`}}></div>
                               </div>
                             </div>
                          </CardContent>
                        </Card>

                        {/* CARD AÇÕES RÁPIDAS WHATSAPP */}
                        <Card className="shadow-sm border-0 border-t-2 border-emerald-500 bg-emerald-50/30">
                          <CardContent className="p-4 flex flex-col justify-center h-full space-y-3">
                             <p className="text-sm font-semibold text-emerald-800 text-center">Divulgação Rápida WAPP</p>
                             <Button onClick={() => handleCopyWapp(op)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold gap-2">
                               {copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                               {copied ? "Template Copiado" : "Gerar Mensagem"}
                             </Button>
                             <p className="text-[10px] text-center text-emerald-600/80">Mensagem otimizada para atração de parceiros, sem vínculo.</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* INFOS GERAIS FOOTER */}
                      <Card className="bg-slate-50 border shadow-sm">
                         <CardContent className="p-3">
                           <div className="flex gap-4 items-center">
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><MapPin className="w-3.5 h-3.5"/> Carregamento: {op.regiao}</span>
                              <span className="text-slate-300">|</span>
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Truck className="w-3.5 h-3.5"/> Veículo: {op.veiculo}</span>
                              <span className="text-slate-300">|</span>
                              <span className="text-xs font-bold text-slate-700">R$ {op.valorSaida?.toFixed(2) || "0.00"} (Ref. Saída)</span>
                           </div>
                         </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="metas" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Meta de Veículos</p><p className="text-2xl font-bold">{op.vagas}</p></CardContent></Card>
                    <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Preenchidos</p><p className="text-2xl font-bold text-emerald-600">{op.aprovados}</p></CardContent></Card>
                    <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-bold text-orange-600">{(op.vagas || 0) - (op.aprovados || 0)}</p></CardContent></Card>
                    <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Progresso</p><p className="text-2xl font-bold text-indigo-600">{Math.round(((op.aprovados || 0) / (op.vagas || 1)) * 100)}%</p></CardContent></Card>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Interessados (Funil)</p><p className="text-xl font-bold">{op.captados}</p></CardContent></Card>
                    <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Aprovados</p><p className="text-xl font-bold text-green-600">{op.aprovados}</p></CardContent></Card>
                    <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Recusados</p><p className="text-xl font-bold text-red-600">{(op.captados || 0) - (op.aprovados || 0)}</p></CardContent></Card>
                  </div>
                </TabsContent>
                
                {canViewFinanceiro(userRole) && (
                  <TabsContent value="financeiro" className="space-y-4">
                    {(() => {
                      const v_cliente = op.valorSaida || op.valor || 0;
                      const p_imposto = op.imposto || 0;
                      const p_seguro = op.custoSeguro || 0;
                      const v_prestador = op.valorPrestador || 0;
                      const qtd_v = op.vagas || 1;
                      const qtd_d = op.diaria || 1;

                      const i_val = (v_cliente * p_imposto) / 100;
                      const s_val = (v_cliente * p_seguro) / 100;
                      const rec_liq = v_cliente - i_val;
                      const custo_un = v_prestador + s_val;
                      const lucro_un = rec_liq - custo_un;

                      const faturamento_total = v_cliente * qtd_v * qtd_d;
                      const lucro_total = lucro_un * qtd_v * qtd_d;

                      return (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card><CardContent className="p-4 text-center"><p className="text-[10px] uppercase text-muted-foreground font-bold">Valor Cliente (Saída)</p><p className="text-xl font-bold">R$ {v_cliente.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></CardContent></Card>
                            <Card><CardContent className="p-4 text-center"><p className="text-[10px] uppercase text-muted-foreground font-bold">Imposto / Seguro</p><p className="text-xl font-bold text-red-500">R$ {(i_val + s_val).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></CardContent></Card>
                            <Card><CardContent className="p-4 text-center"><p className="text-[10px] uppercase text-muted-foreground font-bold">Valor Prestador</p><p className="text-xl font-bold text-orange-600">R$ {v_prestador.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></CardContent></Card>
                            <Card><CardContent className="p-4 text-center"><p className="text-[10px] uppercase text-muted-foreground font-bold">Lucro Unitário</p><p className="text-xl font-bold text-emerald-600">R$ {lucro_un.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></CardContent></Card>
                          </div>
                          <Card className="bg-slate-50 border"><CardContent className="p-4">
                            <div className="flex flex-col gap-2">
                              <p className="text-sm font-semibold text-slate-700 flex justify-between">
                                <span>Faturamento Total Estimado ({qtd_v} veículos x {qtd_d} dias):</span> 
                                <span className="text-lg">R$ {faturamento_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                              </p>
                              <p className="text-sm font-semibold text-slate-700 flex justify-between">
                                <span>Lucro Total Estimado ({qtd_v} veículos x {qtd_d} dias):</span> 
                                <span className="text-lg text-emerald-600">R$ {lucro_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                              </p>
                            </div>
                          </CardContent></Card>
                        </>
                      );
                    })()}
                  </TabsContent>
                )}
                
                <TabsContent value="match" className="space-y-4">
                  {(() => {
                    const matchesLocais = JSON.parse(localStorage.getItem(`match_operacao_${op.id}`) || "[]");
                    return (
                      <>
                        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border">
                          <div>
                            <h4 className="font-bold text-slate-800">Match Inteligente</h4>
                            <p className="text-xs text-muted-foreground">Foram encontrados {matchesLocais.length} prestadores compatíveis</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => {
                              import("@/lib/matchPrestadores").then(m => {
                                m.matchPrestadoresParaOperacao(op, JSON.parse(localStorage.getItem("banco_motoristas_tms") || "[]")).then(() => {
                                  toast.success("Match reprocessado!");
                                });
                              });
                            }}>Recalcular</Button>
                            <Button onClick={() => setShowWappConfirm(op)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold gap-2">
                              Enviar WhatsApp para selecionados
                            </Button>
                          </div>
                        </div>
                        {matchesLocais.length === 0 ? (
                          <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg bg-white">
                            <Target className="w-8 h-8 mx-auto text-slate-300 mb-2"/>
                            <p className="text-sm">O algoritmo de match ainda não encontrou sugestões ({op.regiao} - {op.veiculo}).</p>
                          </div>
                        ) : (
                          <div className="border rounded-lg bg-white overflow-hidden">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                                <tr>
                                  <th className="p-3">Prestador</th>
                                  <th className="p-3">Veículo</th>
                                  <th className="p-3">Região</th>
                                  <th className="p-3">Telefone</th>
                                  <th className="p-3">Score Match</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matchesLocais.map((m: any, idx: number) => (
                                  <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                                    <td className="p-3 font-medium">{m.motoristaNome}</td>
                                    <td className="p-3">{m.motoristaVeiculo}</td>
                                    <td className="p-3">{m.motoristaRegiao}</td>
                                    <td className="p-3">{m.motoristaTelefone}</td>
                                    <td className="p-3 font-bold text-emerald-600">{m.scoreMatch}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </TabsContent>
              </Tabs>

            </DialogContent>
          </Dialog>
        ))}
        {operacoesFiltradas.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
             Nenhuma operação encontrada com os filtros atuais.
          </div>
        )}
      </div>

      {/* Modal Criar/Editar Operação */}
      <Dialog open={modalCriar} onOpenChange={(open) => { setModalCriar(open); if (!open) setEditando(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-50">
          <DialogHeader>
            <DialogTitle className="text-2xl">{editando ? "Editar Operação" : "Nova Operação"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Bloco 1 — Identificação da Operação */}
            <Card>
              <CardHeader className="py-3 border-b bg-white"><CardTitle className="text-base text-slate-800 flex items-center gap-2">Bloco 1 — Identificação da Operação</CardTitle></CardHeader>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                <div className="md:col-span-2">
                  <Label>Nome da Operação</Label>
                  <Input value={novaOperacao.nome || ""} onChange={e => setNovaOperacao({...novaOperacao, nome: e.target.value})} placeholder="Ex: Rota Sul D+1" />
                </div>
                <div>
                  <Label>Cliente</Label>
                  <Input value={novaOperacao.cliente || ""} onChange={e => setNovaOperacao({...novaOperacao, cliente: e.target.value})} placeholder="Ex: Magazine Luiza" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={novaOperacao.status} onValueChange={v => setNovaOperacao({...novaOperacao, status: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aberta">Aberta</SelectItem>
                      <SelectItem value="Em preenchimento">Em preenchimento</SelectItem>
                      <SelectItem value="Completa">Completa</SelectItem>
                      <SelectItem value="Em operação">Em operação</SelectItem>
                      <SelectItem value="Finalizada">Finalizada</SelectItem>
                      <SelectItem value="Pausado">Pausado</SelectItem>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={novaOperacao.prioridade || "media"} onValueChange={v => setNovaOperacao({...novaOperacao, prioridade: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Recorrência</Label>
                  <Select value={novaOperacao.recurrencia || "diaria"} onValueChange={v => setNovaOperacao({...novaOperacao, recurrencia: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unica">Única</SelectItem>
                      <SelectItem value="diaria">Diária</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data Início</Label>
                  <Input type="date" value={novaOperacao.dataInicio || ""} onChange={e => setNovaOperacao({...novaOperacao, dataInicio: e.target.value})} />
                </div>
              </CardContent>
            </Card>

            {/* Bloco 2 — Operação Logística */}
            <Card>
              <CardHeader className="py-3 border-b bg-white"><CardTitle className="text-base text-slate-800 flex items-center gap-2">Bloco 2 — Operação Logística</CardTitle></CardHeader>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                <div>
                  <Label>Tipo Produto Transportado</Label>
                  <Input value={novaOperacao.tipoProduto || ""} onChange={e => setNovaOperacao({...novaOperacao, tipoProduto: e.target.value})} placeholder="Ex: Medicamento" />
                </div>
                <div>
                  <Label>Tipo Veículo</Label>
                  <Select value={novaOperacao.veiculo} onValueChange={v => setNovaOperacao({...novaOperacao, veiculo: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                    <SelectContent>
                      {TIPOS_VEICULO.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo Carga</Label>
                  <Select value={novaOperacao.secoRefrigerado} onValueChange={v => setNovaOperacao({...novaOperacao, secoRefrigerado: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seco">Seco</SelectItem>
                      <SelectItem value="refrigerado">Refrigerado</SelectItem>
                      <SelectItem value="ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Peso da Carga</Label>
                  <Input value={novaOperacao.pesoCarga || ""} onChange={e => setNovaOperacao({...novaOperacao, pesoCarga: e.target.value})} placeholder="Ex: 500kg" />
                </div>
                <div>
                  <Label>Dimensões</Label>
                  <Input value={novaOperacao.dimensoes || ""} onChange={e => setNovaOperacao({...novaOperacao, dimensoes: e.target.value})} placeholder="Ex: 2x2x2m" />
                </div>
                <div>
                  <Label>Região</Label>
                  <Input value={novaOperacao.regiao || ""} onChange={e => setNovaOperacao({...novaOperacao, regiao: e.target.value})} placeholder="Ex: São Paulo" />
                </div>
                <div>
                  <Label>Rota</Label>
                  <Input value={novaOperacao.rota || ""} onChange={e => setNovaOperacao({...novaOperacao, rota: e.target.value})} placeholder="Ex: SP x Curitiba" />
                </div>
                <div>
                  <Label>Local de Carregamento</Label>
                  <Input value={novaOperacao.localCarregamento || ""} onChange={e => setNovaOperacao({...novaOperacao, localCarregamento: e.target.value})} placeholder="Ex: CD São Paulo" />
                </div>
                <div>
                  <Label>Horário de Carregamento</Label>
                  <Input value={novaOperacao.horarioCarregamento || ""} onChange={e => setNovaOperacao({...novaOperacao, horarioCarregamento: e.target.value})} placeholder="Ex: 08:00" />
                </div>
              </CardContent>
            </Card>

            {/* Bloco 3 — Capacidade e Meta */}
            <Card>
              <CardHeader className="py-3 border-b bg-white"><CardTitle className="text-base text-slate-800 flex items-center gap-2">Bloco 3 — Capacidade e Meta</CardTitle></CardHeader>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                <div>
                  <Label>Quantidade Veículos Necessários</Label>
                  <Input type="number" value={novaOperacao.vagas || ""} onChange={e => setNovaOperacao({...novaOperacao, vagas: parseInt(e.target.value) || 1})} min="1"/>
                </div>
                <div>
                  <Label>Quantidade Dias</Label>
                  <Input type="number" value={novaOperacao.diaria || ""} onChange={e => setNovaOperacao({...novaOperacao, diaria: parseInt(e.target.value) || 1})} min="1"/>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-semibold text-slate-600">Meta Total: {(novaOperacao.vagas || 1) * (novaOperacao.diaria || 1)} diárias</p>
                </div>
              </CardContent>
            </Card>

            {/* Bloco 4 — Condições ao Prestador */}
            <Card>
              <CardHeader className="py-3 border-b bg-white"><CardTitle className="text-base text-slate-800 flex items-center gap-2">Bloco 4 — Condições ao Prestador</CardTitle></CardHeader>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                <div>
                  <Label>Valor Prestador (R$)</Label>
                  <Input type="number" step="0.01" value={novaOperacao.valorPrestador || ""} onChange={e => setNovaOperacao({...novaOperacao, valorPrestador: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <Label>Forma Pagamento</Label>
                  <Input value={novaOperacao.formaPagamento || ""} onChange={e => setNovaOperacao({...novaOperacao, formaPagamento: e.target.value})} placeholder="Ex: Quinzenal" />
                </div>
                <div>
                  <Label>Franquia KM <span className="text-xs text-muted-foreground font-normal">(ida + volta)</span></Label>
                  <Input type="number" value={novaOperacao.kmIncluso || ""} onChange={e => setNovaOperacao({...novaOperacao, kmIncluso: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <Label>Valor KM Excedente (R$)</Label>
                  <Input type="number" step="0.01" value={novaOperacao.valorKmExcedente || ""} onChange={e => setNovaOperacao({...novaOperacao, valorKmExcedente: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="md:col-span-2">
                  <Label>Observações Operacionais</Label>
                  <Textarea value={novaOperacao.observacoes || ""} onChange={e => setNovaOperacao({...novaOperacao, observacoes: e.target.value})} placeholder="Instruções para o motorista..." className="resize-none" />
                </div>
              </CardContent>
            </Card>

            {/* Bloco 5 — Financeiro Restrito */}
            {canViewFinanceiro(userRole) && (
              <Card className="border-emerald-200">
                <CardHeader className="py-3 border-b bg-emerald-50"><CardTitle className="text-base text-emerald-800 flex items-center gap-2">Bloco 5 — Financeiro Restrito</CardTitle></CardHeader>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-emerald-50/30">
                  <div>
                    <Label>Valor Cliente Saída (R$)</Label>
                    <Input type="number" step="0.01" value={novaOperacao.valorSaida || novaOperacao.valor || ""} onChange={e => setNovaOperacao({...novaOperacao, valorSaida: parseFloat(e.target.value) || 0, valor: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div>
                    <Label>Imposto (%)</Label>
                    <Input type="number" step="0.01" value={novaOperacao.imposto || ""} onChange={e => setNovaOperacao({...novaOperacao, imposto: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div>
                    <Label>Seguro (%)</Label>
                    <Input type="number" step="0.01" value={novaOperacao.custoSeguro || ""} onChange={e => setNovaOperacao({...novaOperacao, custoSeguro: parseFloat(e.target.value) || 0})} />
                  </div>
                  
                  {(() => {
                    const v_cliente = novaOperacao.valorSaida || 0;
                    const p_imposto = novaOperacao.imposto || 0;
                    const p_seguro = novaOperacao.custoSeguro || 0;
                    const v_prestador = novaOperacao.valorPrestador || 0;
                    const qtd_v = novaOperacao.vagas || 1;
                    const qtd_d = novaOperacao.diaria || 1;

                    const i_val = (v_cliente * p_imposto) / 100;
                    const s_val = (v_cliente * p_seguro) / 100;
                    const rec_liq = v_cliente - i_val;
                    const custo_un = v_prestador + s_val;
                    const lucro_un = rec_liq - custo_un;
                    const margem = rec_liq > 0 ? (lucro_un / rec_liq) * 100 : 0;
                    const lucro_tot = lucro_un * qtd_v * qtd_d;

                    return (
                      <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-white rounded-lg border shadow-sm">
                        <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Receita Líquida (Unit.)</p><p className="font-bold text-slate-800">R$ {rec_liq.toFixed(2)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Custo Prestador (Unit.)</p><p className="font-bold text-orange-600">R$ {custo_un.toFixed(2)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Lucro Unitário</p><p className="font-bold text-emerald-600">R$ {lucro_un.toFixed(2)}</p></div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">Margem (%)</p>
                          <p className={`font-bold ${margem < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{margem.toFixed(2)}%</p>
                        </div>
                        <div className="col-span-2 md:col-span-4 border-t pt-2 mt-2 flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-600">Lucro Total Estimado:</span>
                          <span className={`text-lg font-extrabold ${lucro_tot < 0 ? 'text-red-600' : 'text-emerald-600'}`}>R$ {lucro_tot.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => { setModalCriar(false); setEditando(null); }}>Cancelar</Button>
            <Button onClick={handleSalvarOperacao} className="bg-green-600 hover:bg-green-700 px-8 font-bold">{editando ? "Salvar Alterações" : "Criar Operação"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmação WhatsApp */}
      <Dialog open={!!showWappConfirm} onOpenChange={(open) => { if (!open) setShowWappConfirm(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disparar WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 text-center">
            <Target className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-sm text-slate-600">
              Você está prestes a gerar a mensagem de convite para os prestadores compatíveis com a operação <strong>{showWappConfirm?.nome}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              A mensagem será copiada para sua área de transferência para envio manual através do WhatsApp (failover).
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowWappConfirm(null)}>Cancelar</Button>
            <Button onClick={enviarWhatsAppSelecionados} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Check className="w-4 h-4 mr-2" /> Confirmar Geração
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
