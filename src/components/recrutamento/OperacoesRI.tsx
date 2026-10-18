import { useState, useEffect, useCallback } from "react";
import { confirmAction } from "@/lib/confirmDialog";
import { Search, MapPin, Truck, PlayCircle, PauseCircle, Archive, CheckCircle, Copy, Check, Filter, Plus, Edit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface Operacao {
  id: string;
  nome: string;
  regiao_carregamento: string | null;
  veiculo: string | null;
  status: string;
  created_at: string | null;
}

const TIPOS_VEICULO = ["Fiorino", "Kangoo", "Kombi", "Van", "VUC", "HR", "3/4", "Toco", "Truck", "Carreta", "Bitrem", "Carreta LS"];

export function OperacoesRI() {
  const [busca, setBusca] = useState("");
  const [copied, setCopied] = useState(false);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [modalCriar, setModalCriar] = useState(false);
  const [editando, setEditando] = useState<Operacao | null>(null);
  const [novaOperacao, setNovaOperacao] = useState<Partial<Operacao>>({
    status: "Ativo",
  });

  const carregarOperacoes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('operacoes')
        .select('id, nome, regiao_carregamento, veiculo, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOperacoes(data ?? []);
    } catch (err) {
      console.error('[OperacoesRI] Erro ao carregar operacoes:', err);
      setOperacoes([]);
    }
  }, []);

  useEffect(() => {
    carregarOperacoes();
  }, [carregarOperacoes]);

  const handleCopyWapp = (op: Operacao) => {
    const text = `*NOVA OPERACAO DISPONIVEL - ${op.nome}*
*Regiao de Carregamento:* ${op.regiao_carregamento || "A definir"}
*Veiculo Exigido:* ${op.veiculo || "A definir"}

Interessados favor responder "TENHO INTERESSE" para seguirmos com o cadastro!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Mensagem copiada! Abra o WhatsApp do prestador e cole.");
  };

  const handleSalvarOperacao = async () => {
    if (!novaOperacao.nome) {
      toast.error("Preencha o nome da operacao");
      return;
    }

    try {
      if (editando) {
        const { error } = await supabase
          .from('operacoes')
          .update({
            nome: novaOperacao.nome,
            regiao_carregamento: novaOperacao.regiao_carregamento || null,
            veiculo: novaOperacao.veiculo || null,
            status: novaOperacao.status || "Ativo",
          })
          .eq('id', editando.id);
        if (error) throw error;
        toast.success("Operacao atualizada!");
      } else {
        const { error } = await supabase
          .from('operacoes')
          .insert({
            nome: novaOperacao.nome,
            regiao_carregamento: novaOperacao.regiao_carregamento || null,
            veiculo: novaOperacao.veiculo || null,
            status: novaOperacao.status || "Ativo",
          });
        if (error) throw error;
        toast.success("Operacao criada!");
      }
      carregarOperacoes();
    } catch (err) {
      console.error('[OperacoesRI] Erro ao salvar:', err);
      toast.error("Erro ao salvar operacao");
    }

    setModalCriar(false);
    setEditando(null);
    setNovaOperacao({ status: "Ativo" });
  };

  const handleEditar = (op: Operacao) => {
    setEditando(op);
    setNovaOperacao({ nome: op.nome, regiao_carregamento: op.regiao_carregamento, veiculo: op.veiculo, status: op.status });
    setModalCriar(true);
  };

  const handleExclude = async (id: string) => {
    const confirmado = await confirmAction({
      title: "Excluir operação",
      description: "Tem certeza que deseja excluir esta operação?",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (confirmado) {
      try {
        const { error } = await supabase.from('operacoes').delete().eq('id', id);
        if (error) throw error;
        toast.success("Operacao excluida!");
        carregarOperacoes();
      } catch (err) {
        toast.error("Erro ao excluir");
      }
    }
  };

  const handleDuplicar = async (op: Operacao) => {
    try {
      const { error } = await supabase
        .from('operacoes')
        .insert({
          nome: `${op.nome} (Copia)`,
          regiao_carregamento: op.regiao_carregamento,
          veiculo: op.veiculo,
          status: "Ativo",
        });
      if (error) throw error;
      toast.success("Operacao duplicada!");
      carregarOperacoes();
    } catch (err) {
      toast.error("Erro ao duplicar");
    }
  };

  const handlePausar = async (op: Operacao) => {
    const novoStatus = op.status === "Pausado" ? "Ativo" : "Pausado";
    try {
      const { error } = await supabase
        .from('operacoes')
        .update({ status: novoStatus })
        .eq('id', op.id);
      if (error) throw error;
      toast.success(novoStatus === "Pausado" ? "Operacao pausada!" : "Operacao reativada!");
      carregarOperacoes();
    } catch (err) {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleArquivar = async (op: Operacao) => {
    try {
      const { error } = await supabase
        .from('operacoes')
        .update({ status: "Arquivado" })
        .eq('id', op.id);
      if (error) throw error;
      toast.success("Operacao arquivada!");
      carregarOperacoes();
    } catch (err) {
      toast.error("Erro ao arquivar");
    }
  };

  const handleFinalizar = async (op: Operacao) => {
    const confirmado = await confirmAction({
      title: "Finalizar operação",
      description: "Tem certeza que deseja FINALIZAR esta operação? Esta ação não pode ser desfeita.",
      confirmText: "Finalizar",
      cancelText: "Cancelar",
      variant: "destructive",
    });
    if (confirmado) {
      try {
        const { error } = await supabase
          .from('operacoes')
          .update({ status: "Encerrado" })
          .eq('id', op.id);
        if (error) throw error;
        toast.success("Operacao encerrada!");
        carregarOperacoes();
      } catch (err) {
        toast.error("Erro ao encerrar");
      }
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
      {/* DASHBOARD GERAL */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border shadow-sm">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Operacoes</p>
            <p className="text-2xl font-bold text-slate-800">{operacoes.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Ativas</p>
            <p className="text-2xl font-bold text-emerald-600">{operacoes.filter(o => o.status === "Ativo").length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Pausadas</p>
            <p className="text-2xl font-bold text-orange-600">{operacoes.filter(o => o.status === "Pausado").length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Encerradas</p>
            <p className="text-2xl font-bold text-slate-600">{operacoes.filter(o => o.status === "Encerrado" || o.status === "Arquivado").length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, regiao ou veiculo..."
            className="pl-9 bg-card"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Filter className="w-4 h-4 mr-2"/> Filtros</Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => setModalCriar(true)}><Plus className="w-4 h-4 mr-2"/> Nova Operacao</Button>
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
                      <CardDescription>{op.regiao_carregamento || "Sem regiao definida"}</CardDescription>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {getStatusBadge(op.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 text-sm space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400"/> {op.regiao_carregamento || "—"}</div>
                    <div className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-slate-400"/> {op.veiculo || "—"}</div>
                  </div>
                  <div className="bg-muted/50 border border-border p-3 rounded-lg flex justify-between items-center text-xs">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wide">Veiculo</span>
                    <span className="text-lg font-extrabold text-foreground">{op.veiculo || "—"}</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 flex justify-between border-t mt-2 flex-col">
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

            {/* DASHBOARD DA OPERACAO */}
            <DialogContent className="max-w-[600px] bg-card">
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2">
                  {op.nome} {getStatusBadge(op.status)}
                </DialogTitle>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <Card className="shadow-sm border">
                  <CardHeader className="py-3 px-4"><CardTitle className="text-xs text-slate-500 uppercase tracking-wider">Dados da Operacao</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold">NOME</p>
                        <p className="text-sm font-semibold">{op.nome}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold">STATUS</p>
                        <p className="text-sm font-semibold">{op.status}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold">REGIAO CARREGAMENTO</p>
                        <p className="text-sm font-semibold">{op.regiao_carregamento || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold">VEICULO</p>
                        <p className="text-sm font-semibold">{op.veiculo || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold">CRIADA EM</p>
                        <p className="text-sm font-semibold">{op.created_at ? new Date(op.created_at).toLocaleDateString('pt-BR') : "—"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setModalCriar(false)}>Fechar</Button>
                <Button onClick={() => handleEditar(op)} className="bg-green-600 hover:bg-green-700"><Edit className="w-4 h-4 mr-2"/> Editar</Button>
              </div>
            </DialogContent>
          </Dialog>
        ))}
        {operacoesFiltradas.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
            Nenhuma operacao encontrada com os filtros atuais.
          </div>
        )}
      </div>

      {/* Modal Criar/Editar Operacao */}
      <Dialog open={modalCriar} onOpenChange={(open) => { setModalCriar(open); if (!open) setEditando(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-50">
          <DialogHeader>
            <DialogTitle className="text-2xl">{editando ? "Editar Operacao" : "Nova Operacao"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <Card>
              <CardHeader className="py-3 border-b bg-white"><CardTitle className="text-base text-slate-800">Identificacao da Operacao</CardTitle></CardHeader>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                <div className="md:col-span-2">
                  <Label>Nome da Operacao</Label>
                  <Input value={novaOperacao.nome || ""} onChange={e => setNovaOperacao({...novaOperacao, nome: e.target.value})} placeholder="Ex: Rota Sul D+1" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={novaOperacao.status} onValueChange={v => setNovaOperacao({...novaOperacao, status: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Pausado">Pausado</SelectItem>
                      <SelectItem value="Encerrado">Encerrado</SelectItem>
                      <SelectItem value="Arquivado">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Regiao de Carregamento</Label>
                  <Input value={novaOperacao.regiao_carregamento || ""} onChange={e => setNovaOperacao({...novaOperacao, regiao_carregamento: e.target.value})} placeholder="Ex: Sao Paulo" />
                </div>
                <div>
                  <Label>Veiculo</Label>
                  <Select value={novaOperacao.veiculo || ""} onValueChange={v => setNovaOperacao({...novaOperacao, veiculo: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                    <SelectContent>
                      {TIPOS_VEICULO.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => { setModalCriar(false); setEditando(null); }}>Cancelar</Button>
            <Button onClick={handleSalvarOperacao} className="bg-green-600 hover:bg-green-700 px-8 font-bold">{editando ? "Salvar Alteracoes" : "Criar Operacao"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
