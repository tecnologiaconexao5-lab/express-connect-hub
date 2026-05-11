import { useState, useEffect } from "react";
import { 
  Sparkles, BrainCircuit, Users, CheckCircle2, 
  XCircle, AlertTriangle, Save, Loader2, FileText,
  MessageSquare, ShieldAlert, History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { iaAutomacaoService, IaSetor, IaRegra } from "@/services/iaAutomacaoService";

export default function IaAutomacao() {
  const [setores, setSetores] = useState<IaSetor[]>([]);
  const [setorAtivo, setSetorAtivo] = useState<IaSetor | null>(null);
  const [regraAtual, setRegraAtual] = useState<IaRegra | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarSetores();
  }, []);

  async function carregarSetores() {
    setLoading(true);
    const data = await iaAutomacaoService.listarSetores();
    setSetores(data);
    if (data.length > 0) {
      selecionarSetor(data[0]);
    }
    setLoading(false);
  }

  async function selecionarSetor(setor: IaSetor) {
    setSetorAtivo(setor);
    setLoading(true);
    const regra = await iaAutomacaoService.carregarRegrasSetor(setor.id);
    
    // Se não tiver regra, cria um objeto vazio para o form
    setRegraAtual(regra || {
      setor_id: setor.id,
      instrucoes_principais: "",
      o_que_pode_fazer: "",
      o_que_nao_pode_fazer: "",
      quando_chamar_humano: ""
    });
    setLoading(false);
  }

  async function salvar() {
    if (!regraAtual || !setorAtivo) return;
    setSalvando(true);
    
    const ok = await iaAutomacaoService.salvarInstrucoes(regraAtual);
    if (ok) {
      toast.success("Regras da IA salvas com sucesso!");
    } else {
      toast.error("Erro ao salvar regras. Verifique o console.");
    }
    
    setSalvando(false);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BrainCircuit className="w-7 h-7 text-indigo-600" /> 
          IA & Automação Inteligente
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure as regras, limites e instruções de como a Inteligência Artificial atua em cada setor do TMS.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* SIDEBAR DE SETORES */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-slate-500 mb-3 px-2 uppercase tracking-wider">
            Setores de Atuação
          </h3>
          {loading && !setores.length ? (
            <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            setores.map(setor => (
              <button
                key={setor.id}
                onClick={() => selecionarSetor(setor)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between group ${
                  setorAtivo?.id === setor.id 
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm" 
                    : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50"
                }`}
              >
                <div>
                  <div className="font-medium text-sm">{setor.nome}</div>
                  <div className="text-[10px] opacity-70 mt-0.5 line-clamp-1">{setor.descricao}</div>
                </div>
                {setor.ativo && <Badge variant="outline" className="text-[10px] h-4 bg-white">Ativo</Badge>}
              </button>
            ))
          )}
        </div>

        {/* ÁREA DE CONFIGURAÇÃO DO SETOR */}
        <div className="md:col-span-3 space-y-6">
          {loading && setores.length > 0 ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
          ) : setorAtivo && regraAtual ? (
            <>
              {/* Card Resumo */}
              <Card className="border-indigo-100 bg-white shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {setorAtivo.nome}
                      </CardTitle>
                      <CardDescription className="mt-1">{setorAtivo.descricao}</CardDescription>
                    </div>
                    <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 flex gap-1">
                      <Sparkles className="w-3 h-3" /> IA Ativada
                    </Badge>
                  </div>
                </CardHeader>
              </Card>

              {/* Instruções Principais */}
              <Card>
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" /> Prompt Mestre (Instruções Principais)
                  </CardTitle>
                  <CardDescription>
                    O comportamento base da IA para este setor. Como ela deve agir, qual o tom de voz e qual seu objetivo principal.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <Textarea 
                    rows={5}
                    placeholder="Ex: Você é o assistente operacional do TMS. Seu objetivo é confirmar baixas de entrega com os motoristas. Use tom profissional mas direto..."
                    value={regraAtual.instrucoes_principais}
                    onChange={e => setRegraAtual({...regraAtual, instrucoes_principais: e.target.value})}
                    className="resize-y"
                  />
                </CardContent>
              </Card>

              {/* Limites e Regras */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-4 h-4" /> O que a IA PODE fazer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea 
                      rows={4}
                      placeholder="Ex: Enviar mensagens de aviso, aprovar baixas com foto legível, responder dúvidas sobre a rota."
                      value={regraAtual.o_que_pode_fazer}
                      onChange={e => setRegraAtual({...regraAtual, o_que_pode_fazer: e.target.value})}
                      className="text-sm bg-green-50/30 border-green-100 focus-visible:ring-green-500"
                    />
                  </CardContent>
                </Card>

                <Card className="border-red-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                      <XCircle className="w-4 h-4" /> O que a IA NÃO PODE fazer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea 
                      rows={4}
                      placeholder="Ex: Não pode dar descontos, não pode alterar valores da OS, não pode aprovar sinistros."
                      value={regraAtual.o_que_nao_pode_fazer}
                      onChange={e => setRegraAtual({...regraAtual, o_que_nao_pode_fazer: e.target.value})}
                      className="text-sm bg-red-50/30 border-red-100 focus-visible:ring-red-500"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Gatilho Humano */}
              <Card className="border-amber-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                    <ShieldAlert className="w-4 h-4" /> Quando chamar um Humano (Escalonamento)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    rows={3}
                    placeholder="Ex: Se o motorista relatar roubo, acidente, quebra do veículo, ou se usar palavras como 'urgente' e 'polícia'."
                    value={regraAtual.quando_chamar_humano}
                    onChange={e => setRegraAtual({...regraAtual, quando_chamar_humano: e.target.value})}
                    className="text-sm bg-amber-50/30 border-amber-100 focus-visible:ring-amber-500"
                  />
                  <p className="text-[10px] text-amber-700 mt-2">
                    Quando a IA detectar este cenário, ela pausará a automação e notificará a equipe na Torre de Controle.
                  </p>
                </CardContent>
              </Card>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" className="gap-2">
                  <History className="w-4 h-4" /> Ver Logs de Decisão
                </Button>
                <Button variant="secondary" className="gap-2">
                  <MessageSquare className="w-4 h-4" /> Base de Conhecimento
                </Button>
                <Button onClick={salvar} disabled={salvando} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Regras do Setor
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-20 border rounded-xl bg-slate-50 text-slate-500">
              Selecione um setor na lateral para configurar a IA.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
