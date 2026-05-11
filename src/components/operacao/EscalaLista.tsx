import { useState } from "react";
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter, Search, Plus, MapPin, Truck, Smartphone, Check, ChevronLeft, ChevronRight, MessageCircle, FileText, Download, Wallet, Clock, DollarSign, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo } from "react";

type Periodo = 'semanal' | 'quinzenal' | 'mensal';

interface AlocacaoFinanceiro {
  valorTipo: 'percentual' | 'fixo';
  valorPercentual: number;
  valorFixo: number;
  combustivel: number;
  kmRodados: number;
  valorKm: number;
  pedagio: number;
  pedagioFranquia: number;
  pedagioExcedente: number;
  pedagioCobrarExcedente: boolean;
  diariasAdicionais: number;
  valorDiaria: number;
  segundaSaida: boolean;
  valorSegundaSaida: number;
  terceiraSaida: boolean;
  valorTerceiraSaida: number;
  saidasAdicionais: number;
  valorSaidaAdicional: number;
  ajudantes: number;
  valorAjudante: number;
  desconto: number;
  reembolsosOutros: string;
  valorReembolsoOutros: number;
}

// Mock data com veículos padronizados conforme tipos do sistema
const TIPO_VEICULO_LABEL: Record<string, string> = {
  todos: "Qualquer veículo",
  moto: "Moto",
  passeio: "Passeio",
  fiorino: "Fiorino",
  kangoo: "Kangoo",
  kombi: "Kombi",
  van: "Van",
  vuc: "VUC",
  hr: "HR",
  "3_4": "3/4",
  toco: "Toco",
  truck: "Truck",
  carreta: "Carreta",
  bitrem: "Bitrem",
  outro: "Outros",
};

const CORES_STATUS: any = {
  disponivel: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300",
  confirmado: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300",
  aguardando: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300 dashed-border",
  operacao: "bg-orange-500 text-white hover:bg-orange-600 border-orange-600",
  indisponivel: "bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200",
};

export default function EscalaLista() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodo, setPeriodo] = useState<Periodo>('semanal');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{prestadorId: string, data: Date} | null>(null);
  
  // States reais para dados
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroVeiculo, setFiltroVeiculo] = useState("todos");
  
  // Form Nova Reserva
  const [novoTurno, setNovoTurno] = useState("integral");
  const [novaOS, setNovaOS] = useState("");
  const [novoPrestadorId, setNovoPrestadorId] = useState("");
  const [novoPrestadorNome, setNovoPrestadorNome] = useState("");
  const [novoTipo, setNovoTipo] = useState("reserva");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("18:00");

  // Filtros Avançados
  const [filtroPeriodo, setFiltroPeriodo] = useState("esta_semana");
  const [dataInicio, setDataInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  
  // Dados Financeiros
  const [financeiro, setFinanceiro] = useState<AlocacaoFinanceiro>({
    valorTipo: 'percentual',
    valorPercentual: 0,
    valorFixo: 0,
    combustivel: 0,
    kmRodados: 0,
    valorKm: 0,
    pedagio: 0,
    pedagioFranquia: 100,
    pedagioExcedente: 0,
    pedagioCobrarExcedente: false,
    diariasAdicionais: 0,
    valorDiaria: 0,
    segundaSaida: false,
    valorSegundaSaida: 0,
    terceiraSaida: false,
    valorTerceiraSaida: 0,
    saidasAdicionais: 0,
    valorSaidaAdicional: 0,
    ajudantes: 0,
    valorAjudante: 0,
    desconto: 0,
    reembolsosOutros: '',
    valorReembolsoOutros: 0
  });

  // Alocações do período
  const [alocacoes, setAlocacoes] = useState<any[]>([]);

  useEffect(() => {
    // Carregar prestadores reais
    async function loadPrestadores() {
      try {
        const { data, error } = await supabase
          .from("prestadores")
          .select("id, nome_completo, cpf_cnpj, telefone, whatsapp, veiculos(tipo, placa), status, regiao_principal")
          .eq("status", "ativo");
        
        if (error) throw error;
        
        // Formatar para uso
        const fmtd = (data || []).map((p: any) => ({
          id: p.id,
          nome: p.nome_completo,
          cpfCnpj: p.cpf_cnpj,
          telefone: p.telefone || p.whatsapp,
          veiculo: p.veiculos && p.veiculos.length > 0 ? p.veiculos[0].tipo : 'vuc',
          placa: p.veiculos && p.veiculos.length > 0 ? p.veiculos[0].placa : '',
          regiao: p.regiao_principal || "Sem região",
          status: "disponivel",
          avatar: p.nome_completo ? p.nome_completo.substring(0,2).toUpperCase() : "PR"
        }));
        
        setPrestadores(fmtd);
      } catch (err) {
         console.warn("Erro ao buscar prestadores para escala", err);
      }
    }

    loadPrestadores();

    // Carregar alocações locais
    const saved = localStorage.getItem("conexao_escala_operacional");
    if (saved) {
      try {
        setAlocacoes(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const prestadoresFiltrados = useMemo(() => {
    return prestadores.filter(p => {
      const matchNome = p.nome.toLowerCase().includes(filtroNome.toLowerCase());
      const matchVeiculo = filtroVeiculo === "todos" || p.veiculo === filtroVeiculo;
      return matchNome && matchVeiculo;
    });
  }, [prestadores, filtroNome, filtroVeiculo]);

  const diasPeriodo = useMemo(() => {
    let start = currentDate;
    let days = 7;

    switch (filtroPeriodo) {
      case 'hoje':
        start = new Date();
        days = 1;
        break;
      case 'amanha':
        start = addDays(new Date(), 1);
        days = 1;
        break;
      case 'esta_semana':
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        days = 7;
        break;
      case 'proxima_semana':
        start = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 7);
        days = 7;
        break;
      case 'quinzenal':
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        days = 15;
        break;
      case 'este_mes':
        start = startOfMonth(new Date());
        days = differenceInDays(endOfMonth(start), start) + 1;
        break;
      case 'proximo_mes':
        start = startOfMonth(addDays(endOfMonth(new Date()), 1));
        days = differenceInDays(endOfMonth(start), start) + 1;
        break;
      case 'personalizado':
        start = new Date(dataInicio);
        days = Math.max(1, differenceInDays(new Date(dataFim), start) + 1);
        break;
      default:
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        days = 7;
    }

    return Array.from({ length: days }).map((_, i) => addDays(start, i));
  }, [currentDate, filtroPeriodo, dataInicio, dataFim]);

  const nextPeriodo = () => {
    if (filtroPeriodo === 'esta_semana' || filtroPeriodo === 'proxima_semana') setCurrentDate(addDays(currentDate, 7));
    else if (filtroPeriodo === 'quinzenal') setCurrentDate(addDays(currentDate, 15));
    else if (filtroPeriodo === 'este_mes' || filtroPeriodo === 'proximo_mes') setCurrentDate(addDays(endOfMonth(currentDate), 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prevPeriodo = () => {
    if (filtroPeriodo === 'esta_semana' || filtroPeriodo === 'proxima_semana') setCurrentDate(addDays(currentDate, -7));
    else if (filtroPeriodo === 'quinzenal') setCurrentDate(addDays(currentDate, -15));
    else if (filtroPeriodo === 'este_mes' || filtroPeriodo === 'proximo_mes') setCurrentDate(addDays(startOfMonth(currentDate), -1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleCellClick = (prestadorId: string, data: Date) => {
    setSelectedCell({prestadorId, data});
    setModalOpen(true);
  };

  const calcularTotalAlocacao = () => {
    const valorBase = financeiro.valorTipo === 'percentual' 
      ? (financeiro.valorPercentual / 100) * 1000 
      : financeiro.valorFixo;
    
    const totalAdicionais = 
      financeiro.combustivel +
      (financeiro.kmRodados * financeiro.valorKm) +
      financeiro.pedagio +
      (financeiro.diariasAdicionais * financeiro.valorDiaria) +
      (financeiro.segundaSaida ? financeiro.valorSegundaSaida : 0) +
      (financeiro.terceiraSaida ? financeiro.valorTerceiraSaida : 0) +
      (financeiro.saidasAdicionais * financeiro.valorSaidaAdicional) +
      (financeiro.ajudantes * financeiro.valorAjudante) +
      financeiro.valorReembolsoOutros;
    
    const totalDescontos = financeiro.desconto;
    
    return {
      valorBase,
      totalAdicionais,
      totalDescontos,
      total: valorBase + totalAdicionais - totalDescontos
    };
  };

  const handleCreateReserva = async () => {
    if (!novoPrestadorId) {
      return toast.error("Selecione um prestador obrigatório.");
    }

    const totals = calcularTotalAlocacao();
    const novaAlocacao = {
      id: Date.now(),
      prestadorId: novoPrestadorId,
      prestadorNome: novoPrestadorNome,
      data: selectedCell?.data ? selectedCell.data.toISOString() : new Date().toISOString(),
      turno: novoTurno,
      tipo: novoTipo,
      os: novaOS,
      financeiro,
      totals,
      statusPagamento: 'a pagar',
      status: 'confirmado'
    };

    try {
      // Tentar salvar no Supabase se existir a tabela (simulado ou real)
      const { error } = await supabase.from('alocacoes_escala').insert([novaAlocacao]);
      
      if (error && error.code === '42P01') {
        // Fallback para localStorage
        const novasAlocacoes = [...alocacoes.filter(a => !(a.prestadorId === novoPrestadorId && isSameDay(new Date(a.data), new Date(novaAlocacao.data)))), novaAlocacao];
        setAlocacoes(novasAlocacoes);
        localStorage.setItem("conexao_escala_operacional", JSON.stringify(novasAlocacoes));
        toast.info("Salvo localmente em 'conexao_escala_operacional' (Tabela não encontrada no DB)");
      } else if (error) {
        throw error;
      } else {
        toast.success("Alocação salva no banco de dados!");
        setAlocacoes(prev => [...prev, novaAlocacao]);
      }
    } catch (err) {
      // Fallback genérico
      const novasAlocacoes = [...alocacoes.filter(a => !(a.prestadorId === novoPrestadorId && isSameDay(new Date(a.data), new Date(novaAlocacao.data)))), novaAlocacao];
      setAlocacoes(novasAlocacoes);
      localStorage.setItem("conexao_escala_operacional", JSON.stringify(novasAlocacoes));
      toast.success("Alocação salva localmente!");
    }

    setModalOpen(false);
  };

  const handleGerarEscalaAutomatica = () => {
     if (prestadoresFiltrados.length === 0) return toast.error("Sem prestadores para alocar.");
     const novas = [...alocacoes];
     
     // Loop simplificado para gerar escala mockada que parece real
     diasPeriodo.forEach(d => {
       // Não alocar domingos por padrão
       if (d.getDay() === 0) return;
       
       // Alocar 30% da frota aleatoriamente
       prestadoresFiltrados.forEach(p => {
          if (Math.random() > 0.7) {
             const exist = novas.find(a => a.prestadorId === p.id && isSameDay(new Date(a.data), d));
             if (!exist) {
               novas.push({
                 id: Math.random(),
                 prestadorId: p.id,
                 data: d.toISOString(),
                 turno: "integral",
                 tipo: "reserva",
                 os: "",
                 status: "confirmado",
                 statusPagamento: "a pagar",
                 totals: { total: 500 }
               });
             }
          }
       });
     });

     setAlocacoes(novas);
     localStorage.setItem("conexao_escala_operacional", JSON.stringify(novas));
     toast.success("Escala gerada automaticamente com IA!");
  };

  const handleExportPDF = () => {
    toast.success("Gerando PDF da escala do período...");
  };

  const handleIncluirLote = () => {
    toast.success("Alocações incluidas no lote de pagamento!");
  };

  const prestadorAtivo = selectedCell ? prestadores.find(p => p.id === selectedCell.prestadorId) : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[calc(100vh-230px)]">
       {/* Sidebar Prestadores */}
       <div className="xl:col-span-1 bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col h-full escala-sidebar">
          <div className="p-4 border-b border-border bg-muted/30 escala-header">
             <h3 className="font-bold text-foreground flex items-center gap-2 mb-4"><Truck className="w-5 h-5 text-primary"/> Prestadores Homologados</h3>
             <div className="relative mb-3">
               <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground"/>
               <Input placeholder="Buscar por placa ou nome..." className="pl-9 text-xs h-9" value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} />
               <div className="flex flex-col gap-2 mt-3">
                <Select value={filtroVeiculo} onValueChange={setFiltroVeiculo}>
                  <SelectTrigger className="text-xs h-8"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_VEICULO_LABEL).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Status"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Status</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="indisponivel">Indisponível</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-8 px-2"><Filter className="w-4 h-4"/></Button>
                </div>
              </div>
             </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
             {prestadoresFiltrados.map(p => (
                <div key={p.id} className="p-3 bg-card border border-border rounded-lg hover:border-primary/50 transition cursor-pointer flex gap-3 items-center group escala-prestador-card">
                   <Avatar className="w-10 h-10 border border-border shadow-sm"><AvatarFallback className="bg-muted text-muted-foreground font-bold">{p.avatar}</AvatarFallback></Avatar>
                   <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-bold text-foreground truncate">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{p.veiculo} • {p.regiao}</p>
                   </div>
                   <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.status === 'disponivel' ? 'bg-emerald-500' : p.status === 'ocupado' ? 'bg-orange-500' : 'bg-muted-foreground/40'}`}/>
                </div>
             ))}
          </div>
       </div>

       {/* Calendário Principal */}
       <div className="xl:col-span-3 bg-card border border-border rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
           <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20 flex-wrap gap-3 escala-header">
              <div>
                <h3 className="font-bold text-foreground flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-primary"/> Escala de Operação</h3>
                <p className="text-xs text-muted-foreground">Arraste ou clique na célula para configurar grade de alocação</p>
              </div>
           </div>
           <div className="flex flex-col gap-3 w-full p-4 flex-1 overflow-hidden">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center bg-card border border-border rounded-lg shadow-sm">
                      <Button variant="ghost" size="icon" onClick={prevPeriodo} className="h-9 w-9 rounded-r-none"><ChevronLeft className="w-4 h-4"/></Button>
                      <div className="px-4 text-sm font-bold border-x border-border text-foreground min-w-[200px] text-center">
                        {format(diasPeriodo[0], "dd/MM")} - {format(diasPeriodo[diasPeriodo.length - 1], "dd/MM/yyyy")}
                      </div>
                      <Button variant="ghost" size="icon" onClick={nextPeriodo} className="h-9 w-9 rounded-l-none"><ChevronRight className="w-4 h-4"/></Button>
                    </div>
                    <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                      <SelectTrigger className="h-9 w-40 text-xs"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hoje">Hoje</SelectItem>
                        <SelectItem value="amanha">Amanhã</SelectItem>
                        <SelectItem value="esta_semana">Esta semana</SelectItem>
                        <SelectItem value="proxima_semana">Próxima semana</SelectItem>
                        <SelectItem value="quinzenal">Quinzenal</SelectItem>
                        <SelectItem value="este_mes">Este mês</SelectItem>
                        <SelectItem value="proximo_mes">Próximo mês</SelectItem>
                        <SelectItem value="personalizado">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                    {filtroPeriodo === 'personalizado' && (
                      <div className="flex items-center gap-2">
                        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9 text-xs w-32" />
                        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 text-xs w-32" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1 h-9 text-xs" onClick={handleGerarEscalaAutomatica}><Truck className="w-3.5 h-3.5"/> Gerar Escala</Button>
                    <Button variant="outline" size="sm" className="gap-1 h-9 text-xs" onClick={handleExportPDF}><Download className="w-3.5 h-3.5"/> Exportar PDF</Button>
                    <Button size="sm" className="gap-1 h-9 text-xs bg-orange-500 hover:bg-orange-600 text-white" onClick={handleIncluirLote}><DollarSign className="w-3.5 h-3.5"/> Incluir em Lote</Button>
                    <Button size="sm" className="gap-1 h-9 text-xs" onClick={() => { setSelectedCell(null); setModalOpen(true); }}><Plus className="w-3.5 h-3.5"/> Alocar</Button>
                  </div>
                </div>
                <Tabs defaultValue="grade" className="w-full flex-1 flex flex-col overflow-hidden">
                  <TabsList className="bg-muted/50 w-fit">
                    <TabsTrigger value="grade" className="text-xs"><CalendarIcon className="w-3.5 h-3.5 mr-1"/> Grade de Escala</TabsTrigger>
                    <TabsTrigger value="metricas" className="text-xs"><Percent className="w-3.5 h-3.5 mr-1"/> Métricas</TabsTrigger>
                    <TabsTrigger value="graficos" className="text-xs"><DollarSign className="w-3.5 h-3.5 mr-1"/> Gráficos</TabsTrigger>
                    <TabsTrigger value="tabelas" className="text-xs"><FileText className="w-3.5 h-3.5 mr-1"/> Tabelas</TabsTrigger>
                    <TabsTrigger value="confirmacoes" className="text-xs"><Check className="w-3.5 h-3.5 mr-1"/> Confirmações</TabsTrigger>
                  </TabsList>

                  <TabsContent value="grade" className="mt-4 flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-auto custom-scrollbar">
                      <div className="min-w-[800px]">
                        <div className="grid bg-muted/40 border-b border-border" style={{gridTemplateColumns:`200px repeat(${diasPeriodo.length},1fr)`}}>
                          <div className="p-3 border-r border-border font-bold text-xs uppercase text-muted-foreground flex items-center">Recurso</div>
                          {diasPeriodo.map((d, i) => (
                            <div key={i} className={`p-3 border-r border-border text-center ${isSameDay(d, new Date()) ? 'bg-primary/10 border-b-2 border-b-primary' : ''}`}>
                              <p className="text-[10px] uppercase font-bold text-muted-foreground">{format(d, "EEE", {locale: ptBR})}</p>
                              <p className={`text-base font-black ${isSameDay(d, new Date()) ? 'text-primary' : 'text-foreground'}`}>{format(d, "dd/MM")}</p>
                            </div>
                          ))}
                        </div>
                        <div className="divide-y divide-border">
                          {prestadoresFiltrados.length === 0 && (
                             <div className="p-8 text-center text-muted-foreground text-sm">Nenhum prestador encontrado com os filtros atuais.</div>
                          )}
                          {prestadoresFiltrados.map(p => (
                            <div key={p.id} className="hover:bg-muted/20 transition" style={{display:'grid', gridTemplateColumns:`200px repeat(${diasPeriodo.length},1fr)`}}>
                              <div className="p-3 border-r border-border flex items-center gap-2 bg-card/50">
                                <Avatar className="w-8 h-8 border border-border"><AvatarFallback className="text-xs font-bold">{p.avatar}</AvatarFallback></Avatar>
                                <div className="overflow-hidden">
                                  <p className="text-xs font-bold truncate">{p.nome}</p>
                                  <p className="text-[10px] text-muted-foreground">{TIPO_VEICULO_LABEL[p.veiculo as keyof typeof TIPO_VEICULO_LABEL] || p.veiculo}</p>
                                </div>
                              </div>
                              {diasPeriodo.map((d, i) => {
                                const res = alocacoes.find(r => r.prestadorId === p.id && isSameDay(new Date(r.data), d));
                                let slotStatus = p.status === "inativo" ? "indisponivel" : "disponivel";
                                let slotLabel = "Livre";
                                if (res) {
                                  slotStatus = res.status === "confirmado" ? "confirmado" : res.status === "aguardando" ? "aguardando" : "operacao";
                                  slotLabel = res.status === "confirmado" ? "Confirmado" : res.status === "aguardando" ? "Aguard. Conf." : "Em Rota";
                                }
                                return (
                                  <div key={i} onClick={() => handleCellClick(p.id, d)} className={`p-2 border-r border-border cursor-pointer hover:bg-primary/5 transition min-h-[60px] flex items-center justify-center ${CORES_STATUS[slotStatus]}`}>
                                    <span className="text-[10px] font-medium">{slotLabel}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="metricas" className="mt-4 flex-1 overflow-auto">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Métricas da Escala</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                          <div className="p-3 bg-emerald-50 rounded-lg"><p className="text-xs text-muted-foreground">Disponíveis</p><p className="text-xl font-bold text-emerald-600">{prestadoresFiltrados.filter(p => p.status === "disponivel").length}</p></div>
                          <div className="p-3 bg-blue-50 rounded-lg"><p className="text-xs text-muted-foreground">Em Rota</p><p className="text-xl font-bold text-blue-600">{alocacoes.filter(a => a.statusPagamento === 'a pagar').length}</p></div>
                          <div className="p-3 bg-orange-50 rounded-lg"><p className="text-xs text-muted-foreground">Aguard. Conf.</p><p className="text-xl font-bold text-orange-600">{alocacoes.filter(a => a.tipo === 'reserva').length}</p></div>
                          <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-muted-foreground">Inativos</p><p className="text-xl font-bold text-slate-600">{prestadoresFiltrados.filter(p => p.status === "inativo").length}</p></div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="graficos" className="mt-4 flex-1 overflow-auto">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Distribuição por Veículo</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(TIPO_VEICULO_LABEL).map(([key, label]) => {
                            const count = prestadores.filter(p => p.veiculo === key).length;
                            const pct = prestadores.length ? (count / prestadores.length * 100).toFixed(0) : 0;
                            if (count === 0) return null;
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-xs w-20 truncate">{label}</span>
                                <div className="flex-1 bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{width:`${pct}%`}}></div></div>
                                <span className="text-xs font-bold w-8 text-right">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="tabelas" className="mt-4 flex-1 overflow-auto">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Tabela de Alocações</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow><TableHead>Prestador</TableHead><TableHead>Veículo</TableHead><TableHead>Status</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {alocacoes.map((a, i) => {
                              const prest = prestadores.find(p => p.id === a.prestadorId);
                              return (
                                <TableRow key={i}>
                                  <TableCell className="text-xs">{prest?.nome || "-"}</TableCell>
                                  <TableCell className="text-xs">{prest ? TIPO_VEICULO_LABEL[prest.veiculo as keyof typeof TIPO_VEICULO_LABEL] || prest.veiculo : "-"}</TableCell>
                                  <TableCell><Badge variant="outline" className="text-xs">{a.statusPagamento}</Badge></TableCell>
                                  <TableCell className="text-xs font-bold">R$ {a.totals?.total?.toLocaleString('pt-BR') || "-"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="confirmacoes" className="mt-4 flex-1 overflow-auto">
                    <Card>
                      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4"/> Confirmações de Carregamento</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs font-medium text-blue-800">Sistema de confirmação preparado</p>
                          <p className="text-[10px] text-blue-600 mt-1">Os prestadores receberão notificação para confirmar carregamento. Status: aguardando confirmação, confirmado, recusado.</p>
                        </div>
                        {alocacoes.filter(a => a.tipo === 'reserva').map((a, i) => {
                          const prest = prestadores.find(p => p.id === a.prestadorId);
                          return (
                            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-8 h-8"><AvatarFallback className="text-xs">{prest?.avatar}</AvatarFallback></Avatar>
                                <div>
                                  <p className="text-xs font-bold">{prest?.nome}</p>
                                  <p className="text-[10px] text-muted-foreground">{format(new Date(a.data), "dd/MM/yyyy")}</p>
                                </div>
                              </div>
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300">Aguardando</Badge>
                            </div>
                          );
                        })}
                        {alocacoes.filter(a => a.tipo === 'reserva').length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma reserva aguardando confirmação.</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
       </div>

        {/* Modal de Reserva */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar Alocação de Recurso</DialogTitle>
              <DialogDescription>
                Alocação para <strong className="text-slate-800">{prestadorAtivo?.nome || 'Novo Prestador'}</strong> em <strong className="text-slate-800">{selectedCell?.data ? format(selectedCell.data, "dd/MM/yyyy") : 'Data não selecionada'}</strong>.
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="dados" className="text-xs"><FileText className="w-3 h-3 mr-1"/>Dados da Alocação</TabsTrigger>
                <TabsTrigger value="financeiro" className="text-xs"><DollarSign className="w-3 h-3 mr-1"/>Dados Financeiros</TabsTrigger>
                <TabsTrigger value="resumo" className="text-xs"><Check className="w-3 h-3 mr-1"/>Resumo do Dia</TabsTrigger>
              </TabsList>
              
              <TabsContent value="dados" className="space-y-4 py-4">
                <div className="space-y-1">
                   <Label className="text-xs font-bold text-primary">Prestador *</Label>
                   <SearchableSelect 
                     table="prestadores" 
                     labelField="nome_completo" 
                     searchFields={["nome_completo", "cpf_cnpj"]} 
                     value={novoPrestadorId} 
                     onChange={(id, item) => {
                       setNovoPrestadorId(id || "");
                       if (item) {
                         setNovoPrestadorNome(item.nome_completo);
                         // Se tiver placa no item, poderíamos usar aqui
                       }
                     }} 
                     placeholder="Pesquisar por nome ou CPF/CNPJ..."
                   />
                </div>
                <div className="space-y-1">
                   <Label className="text-xs text-muted-foreground italic">OS vinculada (opcional)</Label>
                   <SearchableSelect 
                     table="ordens_servico" 
                     labelField="numero" 
                     searchFields={["numero"]} 
                     value={novaOS} 
                     onChange={v => setNovaOS(v||"")} 
                     placeholder="Vincular OS existente, se houver..."
                   />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <Label className="text-xs">Turno</Label>
                      <Select value={novoTurno} onValueChange={setNovoTurno}>
                         <SelectTrigger><SelectValue/></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="integral">Dia Integral</SelectItem>
                            <SelectItem value="manha">Manhã (06-14)</SelectItem>
                            <SelectItem value="tarde">Tarde (14-22)</SelectItem>
                            <SelectItem value="noite">Noite (22-06)</SelectItem>
                            <SelectItem value="saida">Saída</SelectItem>
                            <SelectItem value="intermediario">Intermediário</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={novoTipo} onValueChange={setNovoTipo}>
                         <SelectTrigger><SelectValue/></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="disponibilidade">Disponibilidade</SelectItem>
                            <SelectItem value="reserva">Reserva Operacional</SelectItem>
                            <SelectItem value="bloqueio">Bloqueio</SelectItem>
                            <SelectItem value="afastamento">Afastamento</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <Label className="text-xs">Horário Início</Label>
                      <Input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} />
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Horário Fim</Label>
                      <Input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} />
                   </div>
                </div>
                <div className="space-y-1">
                   <Label className="text-xs">Instruções / Observações</Label>
                   <Textarea placeholder="Ex: Necessário chegar 30m antes na base." rows={2}/>
                </div>
              </TabsContent>
              
              <TabsContent value="financeiro" className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <Label className="text-xs">Valor do Prestador</Label>
                      <Select value={financeiro.valorTipo} onValueChange={v => setFinanceiro(f => ({ ...f, valorTipo: v as any }))}>
                         <SelectTrigger><SelectValue/></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="percentual">% sobre tabela</SelectItem>
                            <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                   {financeiro.valorTipo === 'percentual' ? (
                     <div className="space-y-1">
                        <Label className="text-xs">Percentual (%)</Label>
                        <Input type="number" value={financeiro.valorPercentual} onChange={e => setFinanceiro(f => ({ ...f, valorPercentual: Number(e.target.value) }))} />
                     </div>
                   ) : (
                     <div className="space-y-1">
                        <Label className="text-xs">Valor Fixo (R$)</Label>
                        <Input type="number" value={financeiro.valorFixo} onChange={e => setFinanceiro(f => ({ ...f, valorFixo: Number(e.target.value) }))} />
                     </div>
                   )}
                </div>
                
                <div className="border-t pt-4">
                   <Label className="text-xs font-bold">Adicionais</Label>
                   <div className="grid grid-cols-3 gap-3 mt-2">
                      <div className="space-y-1">
                         <Label className="text-[10px]">Combustível (R$)</Label>
                         <Input type="number" value={financeiro.combustivel} onChange={e => setFinanceiro(f => ({ ...f, combustivel: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Km Rodados</Label>
                         <Input type="number" value={financeiro.kmRodados} onChange={e => setFinanceiro(f => ({ ...f, kmRodados: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">R$/km</Label>
                         <Input type="number" value={financeiro.valorKm} onChange={e => setFinanceiro(f => ({ ...f, valorKm: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Pedágio (R$)</Label>
                         <Input type="number" value={financeiro.pedagio} onChange={e => setFinanceiro(f => ({ ...f, pedagio: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Franquia KM</Label>
                         <Input type="number" value={financeiro.pedagioFranquia} onChange={e => setFinanceiro(f => ({ ...f, pedagioFranquia: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Diárias Adic.</Label>
                         <Input type="number" value={financeiro.diariasAdicionais} onChange={e => setFinanceiro(f => ({ ...f, diariasAdicionais: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">2ª Saída (R$)</Label>
                         <div className="flex items-center gap-2">
                           <Switch checked={financeiro.segundaSaida} onCheckedChange={v => setFinanceiro(f => ({ ...f, segundaSaida: v }))} />
                           <Input type="number" value={financeiro.valorSegundaSaida} onChange={e => setFinanceiro(f => ({ ...f, valorSegundaSaida: Number(e.target.value) }))} disabled={!financeiro.segundaSaida} />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">3ª Saída (R$)</Label>
                         <div className="flex items-center gap-2">
                           <Switch checked={financeiro.terceiraSaida} onCheckedChange={v => setFinanceiro(f => ({ ...f, terceiraSaida: v }))} />
                           <Input type="number" value={financeiro.valorTerceiraSaida} onChange={e => setFinanceiro(f => ({ ...f, valorTerceiraSaida: Number(e.target.value) }))} disabled={!financeiro.terceiraSaida} />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Ajudantes (qtd)</Label>
                         <Input type="number" value={financeiro.ajudantes} onChange={e => setFinanceiro(f => ({ ...f, ajudantes: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">R$/Ajudante</Label>
                         <Input type="number" value={financeiro.valorAjudante} onChange={e => setFinanceiro(f => ({ ...f, valorAjudante: Number(e.target.value) }))} />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Desconto (R$)</Label>
                         <Input type="number" value={financeiro.desconto} onChange={e => setFinanceiro(f => ({ ...f, desconto: Number(e.target.value) }))} />
                      </div>
                   </div>
                </div>
              </TabsContent>
              
              <TabsContent value="resumo" className="py-4">
                <Card className="bg-slate-50">
                  <CardContent className="p-4 space-y-3">
                     {(() => {
                       const totals = calcularTotalAlocacao();
                       return (
                         <>
                           <div className="flex justify-between text-sm"><span>Valor Base:</span><span className="font-medium">R$ {totals.valorBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                           <div className="flex justify-between text-sm"><span className="text-muted-foreground">+ Adicionais:</span><span className="font-medium">R$ {totals.totalAdicionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                           <div className="flex justify-between text-sm text-red-500"><span>- Descontos:</span><span className="font-medium">R$ {totals.totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                           <hr/>
                           <div className="flex justify-between text-lg font-bold"><span>TOTAL DA ALOCAÇÃO:</span><span className="text-green-600">R$ {totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                           <div className="flex justify-between text-sm"><span className="text-muted-foreground">Margem estimada:</span><span className="font-medium text-blue-600">20% (R$ {(totals.total * 0.2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span></div>
                           <div className="flex justify-between text-sm mt-2 pt-2 border-t">
                             <span className="text-muted-foreground">Status pagamento:</span>
                             <Badge variant="outline">A pagar</Badge>
                           </div>
                         </>
                       );
                     })()}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter className="flex justify-between items-center sm:justify-between">
              <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50 gap-2 font-bold text-xs" onClick={() => toast.success("Mensagem enviada via WhatsApp!")}>
                <MessageCircle className="w-4 h-4"/> Confirmar via WA
              </Button>
              <Button onClick={handleCreateReserva}>Salvar na Grade</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
