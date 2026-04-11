import React, { useState } from "react";
import { Plus, Building2, Wallet, Banknote, MoreHorizontal, ArrowRightLeft, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ContasBancarias() {
  const [contas, setContas] = useState([
    { id: 1, banco: "Itaú", nome: "Conta Corrente Principal", agencia: "1234", conta: "56789-0", tipo: "Conta Corrente", titular: "Express Connect Transportes LTDA", saldo: 145000.50, status: "Ativa", empresa: "Matriz (SP)" },
    { id: 2, banco: "Bradesco", nome: "Conta Reserva / Impostos", agencia: "4321", conta: "98765-4", tipo: "C. Poupança", titular: "Express Connect Transportes LTDA", saldo: 85200.00, status: "Ativa", empresa: "Matriz (SP)" },
    { id: 3, banco: "Nubank", nome: "Cartão Corporativo Digital", agencia: "0001", conta: "11223344-5", tipo: "Conta Digital", titular: "Express Connect Hub", saldo: 12500.00, status: "Ativa", empresa: "Matriz (SP)" },
    { id: 4, banco: "Caixa Física", nome: "Caixa Interno (Pequenos Gastos)", agencia: "-", conta: "-", tipo: "Caixinha", titular: "Financeiro Interno", saldo: 1250.75, status: "Ativa", empresa: "Matriz (SP)" },
  ]);

  const [transferencias, setTransferencias] = useState<Transferencia[]>(() => {
    try {
      const saved = localStorage.getItem("transferencias_financeiras");
      return saved ? JSON.parse(saved) : mockTransferencias;
    } catch (e) {
      console.error("Erro ao carregar transferências:", e);
      return mockTransferencias;
    }
  });

  const [showNovaConta, setShowNovaConta] = useState(false);
  const [showTransferencia, setShowTransferencia] = useState(false);
  const [contaEditando, setContaEditando] = useState<ContaFinanceira | null>(null);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);

  const [novaConta, setNovaConta] = useState({
    nome: "",
    tipo: "corrente" as const,
    banco: "",
    agencia: "",
    conta: "",
    digito: "",
    titular: "",
    cpfCnpj: "",
    saldoInicial: 0,
    ativa: true,
    principal: false,
    contaContabil: "",
    centroResultado: "",
    unidade: "matriz_sp",
    observacoes: ""
  });

  const [novaTransferencia, setNovaTransferencia] = useState({
    contaOrigemId: "",
    contaDestinoId: "",
    valor: 0,
    data: new Date().toISOString().split("T")[0],
    descricao: "",
    taxa: 0
  });

  useEffect(() => {
    try {
      localStorage.setItem("contas_financeiras", JSON.stringify(contas));
    } catch (e) {
      console.error("Erro ao salvar contas:", e);
    }
  }, [contas]);

  useEffect(() => {
    try {
      localStorage.setItem("transferencias_financeiras", JSON.stringify(transferencias));
    } catch (e) {
      console.error("Erro ao salvar transferências:", e);
    }
  }, [transferencias]);

  const saldoTotal = useMemo(() => {
    return contas.filter(c => c.ativa).reduce((acc, c) => acc + c.saldoAtual, 0);
  }, [contas]);

  const saldoContasAtivas = useMemo(() => {
    return contas.filter(c => c.ativa).length;
  }, [contas]);

  const saldoCaixas = useMemo(() => {
    return contas.filter(c => c.tipo === "caixa" && c.ativa).reduce((acc, c) => acc + c.saldoAtual, 0);
  }, [contas]);

  const saldoBancario = useMemo(() => {
    return contas.filter(c => c.tipo !== "caixa" && c.ativa).reduce((acc, c) => acc + c.saldoAtual, 0);
  }, [contas]);

  const filtradas = useMemo(() => {
    if (!busca.trim()) return contas;
    const term = busca.toLowerCase();
    return contas.filter(c => 
      c.nome.toLowerCase().includes(term) ||
      c.banco.toLowerCase().includes(term) ||
      c.titular.toLowerCase().includes(term)
    );
  }, [contas, busca]);

  const handleSalvarConta = useCallback(() => {
    setLoading(true);
    try {
      const nomeConta = novaConta.nome?.trim() || "";
      
      if (!nomeConta) {
        toast.error("Nome da conta é obrigatório");
        setLoading(false);
        return;
      }

      const duplicada = contas.find(c => 
        c.nome.toLowerCase() === nomeConta.toLowerCase() && 
        (!contaEditando || c.id !== contaEditando.id)
      );
      
      if (duplicada) {
        toast.error("Já existe uma conta cadastrada com este nome");
        setLoading(false);
        return;
      }

      const saldoInicial = isValidNumber(novaConta.saldoInicial) ? novaConta.saldoInicial : 0;
      const saldoAtual = contaEditando 
        ? contaEditando.saldoAtual 
        : saldoInicial;

      const conta: ContaFinanceira = {
        id: contaEditando?.id || generateId(),
        nome: nomeConta,
        tipo: novaConta.tipo || "corrente",
        banco: novaConta.banco || "-",
        agencia: novaConta.agencia || "-",
        conta: novaConta.conta || "-",
        digito: novaConta.digito || "",
        titular: novaConta.titular || "-",
        cpfCnpj: novaConta.cpfCnpj || undefined,
        saldoInICIAL: saldoInicial,
        saldoAtual: saldoAtual,
        ativa: novaConta.ativa,
        principal: novaConta.principal,
        unidadeId: novaConta.unidade,
        planoContaId: novaConta.contaContabil || undefined,
        centroResultadoId: novaConta.centroResultado || undefined,
        observacoes: novaConta.observacoes || undefined,
        criadoEm: contaEditando?.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };

      if (contaEditando) {
        setContas(prev => prev.map(c => c.id === conta.id ? conta : c));
        toast.success(`Conta "${conta.nome}" atualizada com sucesso!`);
      } else {
        setContas(prev => [...prev, conta]);
        toast.success(`Conta "${conta.nome}" cadastrada com sucesso!`);
      }

      setShowNovaConta(false);
      setContaEditando(null);
      setNovaConta({
        nome: "", tipo: "corrente", banco: "", agencia: "", conta: "", digito: "", titular: "", cpfCnpj: "", saldoInicial: 0, ativa: true, principal: false, contaContabil: "", centroResultado: "", unidade: "matriz_sp", observacoes: ""
      });
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [novaConta, contaEditando, contas]);

  const handleTransferencia = useCallback(() => {
    setLoading(true);
    try {
      const { contaOrigemId, contaDestinoId, valor, data, descricao, taxa } = novaTransferencia;
      
      if (!contaOrigemId || !contaDestinoId || !valor) {
        toast.error("Preencha todos os campos obrigatórios");
        setLoading(false);
        return;
      }

      if (contaOrigemId === contaDestinoId) {
        toast.error("As contas de origem e destino devem ser diferentes");
        setLoading(false);
        return;
      }

      const origem = contas.find(c => c.id === contaOrigemId);
      const destino = contas.find(c => c.id === contaDestinoId);
      
      if (!origem) {
        toast.error("Conta de origem não encontrada");
        setLoading(false);
        return;
      }

      if (!destino) {
        toast.error("Conta de destino não encontrada");
        setLoading(false);
        return;
      }

      if (origem.saldoAtual < valor) {
        toast.error(`Saldo insuficiente! Saldo atual: ${formatCurrency(origem.saldoAtual)}`);
        setLoading(false);
        return;
      }

      const valorTaxa = isValidNumber(taxa) ? taxa : 0;
      const valorTotalDebito = valor + valorTaxa;

      const transferencia: Transferencia = {
        id: generateId(),
        contaOrigemId,
        contaDestinoId,
        valor,
        data: data || new Date().toISOString().split("T")[0],
        descricao: descricao?.trim() || "Transferência entre contas",
        taxa: valorTaxa || undefined,
        status: "realizada",
        createdAt: new Date().toISOString()
      };

      setContas(prev => prev.map(c => {
        if (c.id === contaOrigemId) {
          return { 
            ...c, 
            saldoAtual: c.saldoAtual - valorTotalDebito,
            atualizadoEm: new Date().toISOString()
          };
        }
        if (c.id === contaDestinoId) {
          return { 
            ...c, 
            saldoAtual: c.saldoAtual + valor,
            atualizadoEm: new Date().toISOString()
          };
        }
        return c;
      }));

      setTransferencias(prev => [...prev, transferencia]);
      
      toast.success(`Transferência de ${formatCurrency(valor)} realizada com sucesso!`);
      
      setShowTransferencia(false);
      setNovaTransferencia({ 
        contaOrigemId: "", 
        contaDestinoId: "", 
        valor: 0, 
        data: new Date().toISOString().split("T")[0], 
        descricao: "", 
        taxa: 0 
      });
    } catch (error) {
      console.error("Erro na transferência:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [novaTransferencia, contas]);

  const handleEditar = useCallback((conta: ContaFinanceira) => {
    try {
      setContaEditando(conta);
      setNovaConta({
        nome: conta.nome,
        tipo: conta.tipo,
        banco: conta.banco,
        agencia: conta.agencia,
        conta: conta.conta,
        digito: conta.digito,
        titular: conta.titular,
        cpfCnpj: conta.cpfCnpj || "",
        saldoInicial: conta.saldoInicial,
        ativa: conta.ativa,
        principal: conta.principal,
        contaContabil: conta.planoContaId || "",
        centroResultado: conta.centroResultadoId || "",
        unidade: conta.unidadeId || "matriz_sp",
        observacoes: conta.observacoes || ""
      });
      setShowNovaConta(true);
    } catch (error) {
      console.error("Erro ao editar conta:", error);
      toast.error("Erro ao carregar dados da conta");
    }
  }, []);

  const handleExcluir = useCallback((id: string) => {
    try {
      if (confirm("Tem certeza que deseja excluir esta conta?")) {
        setContas(prev => prev.filter(c => c.id !== id));
        toast.success("Conta excluída");
      }
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      toast.error(getErrorMessage(error));
    }
  }, []);

  const contasaAtivas = useMemo(() => contas.filter(c => c.ativa), [contas]);
>>>>>>> f8ce7c3 (backup: organizar estado do projeto)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            Contas da Empresa, Caixas e Bancos
          </h2>
          <p className="text-sm text-muted-foreground">Gestão de saldos, contas bancárias e caixas internos</p>
        </div>
        <div className="flex gap-2">
<<<<<<< HEAD
           <Button variant="outline" className="gap-2"><ArrowRightLeft className="w-4 h-4"/> Transferência entre Contas</Button>
           <Dialog>
             <DialogTrigger asChild>
               <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"><Plus className="w-4 h-4"/> Nova Conta/Caixa</Button>
             </DialogTrigger>
             <DialogContent className="max-w-xl">
               <DialogHeader>
                 <DialogTitle>Cadastro de Conta Financeira</DialogTitle>
               </DialogHeader>
               <div className="grid grid-cols-2 gap-4 py-4">
                 <div className="col-span-2">
                   <Label>Nome da Conta/Identificação</Label>
                   <Input placeholder="Ex: Conta Corrente Principal Itaú" />
                 </div>
                 <div>
                   <Label>Tipo de Conta</Label>
                   <Select>
                     <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="corrente">Conta Corrente</SelectItem>
                       <SelectItem value="poupanca">Conta Poupança</SelectItem>
                       <SelectItem value="digital">Conta Digital / Carteira</SelectItem>
                       <SelectItem value="caixinha">Caixa Físico (Interno)</SelectItem>
                       <SelectItem value="investimento">Conta Investimento</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div>
                   <Label>Instituição Financeira / Banco</Label>
                   <Input placeholder="Itaú, Bradesco, Nubank, Caixa..." />
                 </div>
                 <div>
                   <Label>Agência</Label>
                   <Input placeholder="0000" />
                 </div>
                 <div>
                   <Label>Número da Conta</Label>
                   <Input placeholder="00000-0" />
                 </div>
                 <div className="col-span-2">
                   <Label>Titular da Conta / Razão Social</Label>
                   <Input placeholder="Nome na conta..." />
                 </div>
                 <div>
                   <Label>Saldo Inicial R$</Label>
                   <Input placeholder="0,00" type="number" />
                 </div>
                 <div>
                   <Label>Vincular Empresa/Unidade</Label>
                   <Select>
                     <SelectTrigger><SelectValue placeholder="Matriz (SP)" /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="matriz">Matriz (SP)</SelectItem>
                       <SelectItem value="filial_rj">Filial (RJ)</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               <DialogFooter>
                 <Button variant="outline">Cancelar</Button>
                 <Button>Salvar Conta</Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>
=======
          <Dialog open={showTransferencia} onOpenChange={setShowTransferencia}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50" disabled={loading}>
                <ArrowRightLeft className="w-4 h-4"/> Transferência
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader className="space-y-2">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-600"/>
                  Transferência entre Contas
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Conta Origem <span className="text-red-500">*</span></Label>
                  <Select 
                    value={novaTransferencia.contaOrigemId} 
                    onValueChange={(v) => setNovaTransferencia({...novaTransferencia, contaOrigemId: v})}
                    disabled={loading}
                  >
                    <SelectTrigger className="border-indigo-200 focus:ring-indigo-200"><SelectValue placeholder="Selecione a conta de origem" /></SelectTrigger>
                    <SelectContent>
                      {contasaAtivas.map(c => (
                        <SelectItem key={c.id} value={c.id} className="focus:bg-indigo-50">
                          <div className="flex items-center justify-between w-full">
                            <span>{c.nome}</span>
                            <span className="text-muted-foreground text-xs ml-2">{formatCurrency(c.saldoAtual)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-center">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Conta Destino <span className="text-red-500">*</span></Label>
                  <Select 
                    value={novaTransferencia.contaDestinoId} 
                    onValueChange={(v) => setNovaTransferencia({...novaTransferencia, contaDestinoId: v})}
                    disabled={loading}
                  >
                    <SelectTrigger className="border-indigo-200 focus:ring-indigo-200"><SelectValue placeholder="Selecione a conta de destino" /></SelectTrigger>
                    <SelectContent>
                      {contasaAtivas.filter(c => c.id !== novaTransferencia.contaOrigemId).map(c => (
                        <SelectItem key={c.id} value={c.id} className="focus:bg-indigo-50">{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Valor (R$) <span className="text-red-500">*</span></Label>
                    <Input 
                      type="number" 
                      value={novaTransferencia.valor || ""} 
                      onChange={(e) => setNovaTransferencia({...novaTransferencia, valor: Number(e.target.value)})}
                      placeholder="0,00"
                      className="border-indigo-200 focus:ring-indigo-200 font-mono"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Data da Transferência</Label>
                    <Input 
                      type="date" 
                      value={novaTransferencia.data} 
                      onChange={(e) => setNovaTransferencia({...novaTransferencia, data: e.target.value})}
                      className="border-indigo-200 focus:ring-indigo-200"
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Taxa/Tarifa (R$)</Label>
                  <Input 
                    type="number" 
                    value={novaTransferencia.taxa || ""} 
                    onChange={(e) => setNovaTransferencia({...novaTransferencia, taxa: Number(e.target.value)})}
                    placeholder="0,00"
                    className="border-indigo-200 focus:ring-indigo-200 font-mono"
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Descrição / Observação</Label>
                  <Textarea 
                    value={novaTransferencia.descricao} 
                    onChange={(e) => setNovaTransferencia({...novaTransferencia, descricao: e.target.value})}
                    placeholder="Descrição da transferência..."
                    className="resize-none border-indigo-200 focus:ring-indigo-200"
                    disabled={loading}
                  />
                </div>
                
                {novaTransferencia.valor > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="text-sm font-medium text-indigo-700">Total a debitar:</span>
                      <p className="text-xs text-indigo-500 mt-0.5">Incluindo taxa</p>
                    </div>
                    <span className="text-xl font-black text-indigo-700">{formatCurrency(novaTransferencia.valor + (novaTransferencia.taxa || 0))}</span>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowTransferencia(false)} disabled={loading} className="border-indigo-200">Cancelar</Button>
                <Button 
                  onClick={handleTransferencia} 
                  disabled={loading || !novaTransferencia.contaOrigemId || !novaTransferencia.contaDestinoId || !novaTransferencia.valor} 
                  className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4"/>}
                  Confirmar Transferência
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showNovaConta} onOpenChange={(open) => { setShowNovaConta(open); if (!open) setContaEditando(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md hover:shadow-lg transition-all">
                <Plus className="w-4 h-4"/> Nova Conta/Caixa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="space-y-2 border-b pb-4">
                <DialogTitle className="text-xl flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-indigo-600"/>
                  {contaEditando ? "Editar Conta Financeira" : "Nova Conta Financeira"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
                    <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                      <Building2 className="w-4 h-4"/> Dados da Conta
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <Label className="text-sm font-medium">Nome da Conta/Identificação <span className="text-red-500">*</span></Label>
                        <Input 
                          value={novaConta.nome} 
                          onChange={(e) => setNovaConta({...novaConta, nome: e.target.value})} 
                          placeholder="Ex: Conta Corrente Principal Itaú"
                          className="border-slate-200 focus:ring-indigo-200"
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tipo de Conta <span className="text-red-500">*</span></Label>
                        <Select 
                          value={novaConta.tipo} 
                          onValueChange={(v: any) => setNovaConta({...novaConta, tipo: v})}
                          disabled={loading}
                        >
                          <SelectTrigger className="border-slate-200 focus:ring-indigo-200"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {TIPOS_CONTA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-600">Instituição Financeira</Label>
                        <Select 
                          value={novaConta.banco || ""} 
                          onValueChange={(v) => setNovaConta({...novaConta, banco: v === "_empty" ? "" : v})}
                          disabled={loading}
                        >
                          <SelectTrigger className="border-slate-200 focus:ring-indigo-200"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_empty">- Não informado -</SelectItem>
                            {BANCOS.map(b => <SelectItem key={b.value} value={b.label}>{b.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-600">Agência</Label>
                        <Input 
                          value={novaConta.agencia} 
                          onChange={(e) => setNovaConta({...novaConta, agencia: e.target.value})} 
                          placeholder="0000"
                          className="border-slate-200 focus:ring-indigo-200 font-mono"
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-600">Número da Conta</Label>
                        <Input 
                          value={novaConta.conta} 
                          onChange={(e) => setNovaConta({...novaConta, conta: e.target.value})} 
                          placeholder="00000"
                          className="border-slate-200 focus:ring-indigo-200 font-mono"
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-600">Dígito</Label>
                        <Input 
                          value={novaConta.digito} 
                          onChange={(e) => setNovaConta({...novaConta, digito: e.target.value})} 
                          placeholder="0"
                          className="w-20 border-slate-200 focus:ring-indigo-200 font-mono"
                          disabled={loading}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label className="text-sm font-medium text-slate-600">Titular da Conta / Razão Social</Label>
                        <Input 
                          value={novaConta.titular} 
                          onChange={(e) => setNovaConta({...novaConta, titular: e.target.value})} 
                          placeholder="Nome na conta..."
                          className="border-slate-200 focus:ring-indigo-200"
                          disabled={loading}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label className="text-sm font-medium text-slate-600">CPF/CNPJ do Titular</Label>
                        <Input 
                          value={novaConta.cpfCnpj} 
                          onChange={(e) => setNovaConta({...novaConta, cpfCnpj: e.target.value})} 
                          placeholder="00.000.000/0001-00"
                          className="border-slate-200 focus:ring-indigo-200 font-mono"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 space-y-4">
                    <h4 className="font-semibold text-sm text-emerald-700 flex items-center gap-2">
                      <Wallet className="w-4 h-4"/> Configurações Financeiras
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-600">Saldo Inicial R$</Label>
                        <Input 
                          type="number" 
                          value={novaConta.saldoInicial || ""} 
                          onChange={(e) => setNovaConta({...novaConta, saldoInicial: Number(e.target.value)})} 
                          placeholder="0,00"
                          className="border-slate-200 focus:ring-indigo-200 font-mono"
                          disabled={loading || !!contaEditando}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-600">Vincular Empresa/Unidade</Label>
                        <Select 
                          value={novaConta.unidade} 
                          onValueChange={(v) => setNovaConta({...novaConta, unidade: v})}
                          disabled={loading}
                        >
                          <SelectTrigger className="border-slate-200 focus:ring-indigo-200"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {UNIDADES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-600">Status</Label>
                        <Select 
                          value={novaConta.ativa ? "ativa" : "inativa"} 
                          onValueChange={(v: any) => setNovaConta({...novaConta, ativa: v === "ativa"})}
                          disabled={loading}
                        >
                          <SelectTrigger className="border-slate-200 focus:ring-indigo-200"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ativa">Ativa</SelectItem>
                            <SelectItem value="inativa">Inativa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input 
                          type="checkbox" 
                          id="principal" 
                          checked={novaConta.principal} 
                          onChange={(e) => setNovaConta({...novaConta, principal: e.target.checked})}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                          disabled={loading}
                        />
                        <Label htmlFor="principal" className="text-sm text-slate-600">Conta Principal (Padrão para operações)</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-600">Observações Internas</Label>
                      <Textarea 
                        value={novaConta.observacoes} 
                        onChange={(e) => setNovaConta({...novaConta, observacoes: e.target.value})} 
                        placeholder="Observações sobre esta conta..."
                        className="resize-none border-slate-200 focus:ring-indigo-200"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowNovaConta(false); setContaEditando(null); }} disabled={loading} className="border-slate-300">Cancelar</Button>
                <Button 
                  onClick={handleSalvarConta} 
                  disabled={loading || !novaConta.nome.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {contaEditando ? "Atualizar" : "Salvar"} Conta
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
>>>>>>> f8ce7c3 (backup: organizar estado do projeto)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-600 to-blue-800 text-white shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-100 flex items-center gap-2">
              <Wallet className="w-4 h-4"/> Saldo Consolidado Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{formatCurrency(saldoTotal)}</div>
            <p className="text-xs text-indigo-200 mt-2">Soma de todas as contas e caixas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-sm font-semibold">Contas Cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Conta/Identificação</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Agência/Conta</TableHead>
                <TableHead>Empresa Vinculada</TableHead>
                <TableHead className="text-right">Saldo Atual (R$)</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map(conta => (
                <TableRow key={conta.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="font-semibold text-sm">{conta.nome}</div>
                    <div className="text-xs text-muted-foreground">{conta.tipo}</div>
                  </TableCell>
                  <TableCell className="font-medium text-sm flex items-center gap-2 mt-2">
                     <Building2 className="w-4 h-4 text-slate-400" />
                     {conta.banco}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{conta.agencia} / {conta.conta}</TableCell>
                  <TableCell className="text-xs">{conta.empresa}</TableCell>
                  <TableCell className="text-right font-bold text-sm text-foreground">
                    {formatCurrency(conta.saldo)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{conta.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="w-4 h-4 text-muted-foreground"/></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
