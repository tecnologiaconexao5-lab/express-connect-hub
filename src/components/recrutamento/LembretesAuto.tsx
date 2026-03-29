import { useState } from "react";
import { Mail, Clock, AlertTriangle, CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Automacao {
  id: number;
  nome: string;
  descricao: string;
  dias: number;
  ativa: boolean;
  qtd: number;
  urgencia: "alta" | "media" | "baixa";
  mensagem: string;
}

export function LembretesAuto() {
  const [automacoes, setAutomacoes] = useState<Automacao[]>([
    { id: 1, nome: "Lembrete D+15 para interessados sem retorno", descricao: "Interessados sem contato há 15 dias", dias: 15, ativa: true, qtd: 14, urgencia: "media", mensagem: "Olá! Notamos que você demonstrou interesse em nossas oportunidades. Gostaria de saber mais sobre nossas vagas?" },
    { id: 2, nome: "Lembrete D+30 para aprovados sem ativar", descricao: "Aprovados sem ativar há mais de 30 dias", dias: 30, ativa: true, qtd: 22, urgencia: "baixa", mensagem: "Olá! Você foi aprovado em nosso processo de seleção. Precisamos confirmar sua disponibilidade para iniciar as operações." },
    { id: 3, nome: "Reengajamento inativos 60 dias", descricao: "Candidatos inativos há mais de 60 dias", dias: 60, ativa: true, qtd: 8, urgencia: "baixa", mensagem: "Olá! Estamos com novas oportunidades disponíveis. Gostaria de atualizar seu perfil em nosso banco de talentos?" },
    { id: 4, nome: "Documentação pendente D+7", descricao: "Documentação pendente há 7 dias", dias: 7, ativa: false, qtd: 5, urgencia: "alta", mensagem: "Olá! Falta apenas alguns documentos para completar seu cadastro. Por favor, nos envie para acelerar o processo!" },
  ]);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAutomacao, setSelectedAutomacao] = useState<Automacao | null>(null);

  const toggleAutomacao = (id: number) => {
    setAutomacoes(prev => prev.map(a => a.id === id ? { ...a, ativa: !a.ativa } : a));
    toast.success("Automação atualizada com sucesso!");
  };

  const openConfig = (automacao: Automacao) => {
    setSelectedAutomacao(automacao);
    setShowConfigModal(true);
  };

  const getUrgenciaColor = (urgencia: string) => {
    if (urgencia === 'alta') return 'bg-red-100 text-red-600';
    if (urgencia === 'media') return 'bg-orange-100 text-orange-600';
    return 'bg-slate-100 text-slate-500';
  };

  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-amber-500 shadow-sm">
         <CardHeader>
            <CardTitle className="text-amber-800 flex flex-row items-center gap-2"><Clock className="w-5 h-5"/> Automações de Lembrete (WhatsApp)</CardTitle>
            <CardDescription className="text-slate-600 font-medium">Configure e ative automações para não perder o investimento em captação.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <Card className="bg-green-50 border-green-200"><CardContent className="p-3"><p className="text-xs font-bold text-green-700">Ativas</p><p className="text-xl font-black text-green-600">{automacoes.filter(a => a.ativa).length}</p></CardContent></Card>
              <Card className="bg-amber-50 border-amber-200"><CardContent className="p-3"><p className="text-xs font-bold text-amber-700">Pendentes</p><p className="text-xl font-black text-amber-600">{automacoes.filter(a => !a.ativa).length}</p></CardContent></Card>
              <Card className="bg-blue-50 border-blue-200"><CardContent className="p-3"><p className="text-xs font-bold text-blue-700">Total na Fila</p><p className="text-xl font-black text-blue-600">{automacoes.reduce((acc, a) => acc + a.qtd, 0)}</p></CardContent></Card>
            </div>

            {automacoes.map(a => (
               <div key={a.id} className={`p-4 border rounded-xl flex items-center justify-between bg-white transition hover:shadow-sm ${a.ativa ? 'border-green-200' : 'border-slate-200 opacity-60'}`}>
                  <div className="flex items-center gap-4">
                     <button onClick={() => toggleAutomacao(a.id)} className={`w-12 h-6 rounded-full transition-colors ${a.ativa ? 'bg-green-500' : 'bg-slate-300'} relative`}>
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${a.ativa ? 'translate-x-6' : 'translate-x-0.5'}`}/>
                     </button>
                     <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800">{a.nome}</h4>
                          {a.ativa ? <Badge className="bg-green-100 text-green-800 text-[10px]">ATIVO</Badge> : <Badge variant="outline" className="text-[10px]">INATIVO</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{a.descricao}</p>
                        <p className="text-xs font-mono font-bold text-slate-500 mt-1"><span className="text-base text-slate-800">{a.qtd}</span> candidatos elegíveis</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Button variant="outline" size="sm" className="gap-2" onClick={() => openConfig(a)}>
                       Configurar
                     </Button>
                     <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 bg-green-50/50 gap-2 font-bold" disabled={!a.ativa} onClick={() => toast.success(`Lembretes disparados via WhatsApp para ${a.qtd} prestadores.`)}>
                       <Mail className="w-4 h-4"/> Disparar
                     </Button>
                  </div>
               </div>
            ))}
         </CardContent>
      </Card>

      {/* MODAL CONFIGURAÇÃO */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Configurar Automação</DialogTitle></DialogHeader>
          {selectedAutomacao && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Automação</Label>
                <Input value={selectedAutomacao.nome} onChange={(e) => setSelectedAutomacao({...selectedAutomacao, nome: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={selectedAutomacao.descricao} onChange={(e) => setSelectedAutomacao({...selectedAutomacao, descricao: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Disparar após (dias)</Label>
                  <Input type="number" value={selectedAutomacao.dias} onChange={(e) => setSelectedAutomacao({...selectedAutomacao, dias: parseInt(e.target.value)})} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="ativa" checked={selectedAutomacao.ativa} onChange={(e) => setSelectedAutomacao({...selectedAutomacao, ativa: e.target.checked})} className="rounded"/>
                  <Label htmlFor="ativa" className="text-sm">Automação Ativa</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mensagem Padrão</Label>
                <Textarea value={selectedAutomacao.mensagem} onChange={(e) => setSelectedAutomacao({...selectedAutomacao, mensagem: e.target.value})} rows={4} />
                <p className="text-xs text-muted-foreground">Use {"{{nome}}"} para variáveis automáticas</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>Cancelar</Button>
            <Button className="bg-primary" onClick={() => { toast.success("Automação salva!"); setShowConfigModal(false); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
