import { useState } from "react";
import { Brain, CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function TriagemIA() {
  const [analisando, setAnalisando] = useState(false);
  const [analiseIa, setAnaliseIa] = useState("");

  const runIa = () => {
     setAnalisando(true);
     setTimeout(() => {
        setAnaliseIa("Perfil excepcionalmente compatível com a nossa necessidade estrutural para a Leste de São Paulo (Déficit de -3 VUCs nesta rota). \nApresenta alta capacidade de documentação. Histórico de WhatsApp sugere proatividade. Score Inteligente: 92/100. Recomendação: Acelerar aprovação e enviar app.");
        setAnalisando(false);
        toast.success("Análise de Inteligência Artificial processada via Anthropic Pipeline.");
     }, 1500);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="border-primary flex flex-col items-center justify-center p-8 bg-primary/5 shadow-sm min-h-[400px]">
        <Avatar className="w-24 h-24 mb-4 border-4 border-white shadow-xl"><AvatarFallback className="text-2xl font-black text-primary bg-primary/10">RA</AvatarFallback></Avatar>
        <h3 className="text-xl font-bold text-slate-800">Rafael Almeida (VUC/HR)</h3>
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-1">SÃO PAULO - LESTE</p>
        
        <div className="flex gap-2 mt-4 text-xs font-mono mb-8">
           <Badge variant="outline" className="bg-white border-slate-300 uppercase shadow-sm">CNPJ Ativo: Sim</Badge>
           <Badge variant="outline" className="bg-white border-slate-300 uppercase shadow-sm">Exp: 8 Anos</Badge>
        </div>

        <div className="flex gap-3 w-full max-w-sm justify-center">
           <Button variant="outline" className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100"><XCircle className="w-4 h-4 mr-2"/> Reprovar</Button>
           <Button variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" onClick={() => toast.success("Chat aberto.")}><MessageCircle className="w-4 h-4 mr-2"/> Solicitar Info</Button>
           <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => toast.success("Aprovado, Whatsapp disparado.")}><CheckCircle2 className="w-4 h-4 mr-2"/> Avançar Doc</Button>
        </div>
      </Card>

      <Card className="bg-slate-900 border-0 flex flex-col overflow-hidden relative group min-h-[400px]">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20 relative z-10">
           <h3 className="font-bold text-blue-400 flex items-center gap-2"><Brain className="w-5 h-5"/> Avaliação Cognitiva da Triagem</h3>
           <Button size="sm" variant="outline" className="bg-transparent border-blue-500/50 text-blue-300 hover:bg-blue-500/20" onClick={runIa} disabled={analisando}>
              {analisando ? "Processando Contexto..." : "Analisar Perfil com IA"}
           </Button>
        </div>
        <CardContent className="flex-1 p-8 flex items-center justify-center text-center relative z-10">
           {analiseIa ? (
              <p className="text-emerald-300 font-mono text-sm leading-relaxed text-left opacity-90">{analiseIa}</p>
           ) : (
              <div className="space-y-4">
                 <Brain className="w-16 h-16 text-slate-700 mx-auto opacity-50"/>
                 <p className="text-slate-500 text-sm max-w-xs mx-auto">A IA cruza a demanda reprimida de OS na região, perfil do veículo e resposta de triagem para gerar um score preditivo.</p>
              </div>
           )}
        </CardContent>
        {analisando && <div className="absolute inset-0 bg-blue-500/10 animate-pulse z-0 decoration-clone pointer-events-none"/>}
      </Card>
    </div>
  );
}
