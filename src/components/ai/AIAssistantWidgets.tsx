// src/components/ai/AIAssistantWidgets.tsx
import { useState } from "react";
import { Sparkles, BrainCircuit, Wand2, Zap, CheckCircle2, ChevronDown, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sugerirVeiculoOperacao, rankearPrestadores, melhorarTextoComercial } from "@/services/ai";
import { Skeleton } from "@/components/ui/skeleton";

export function SuggestVehicleAI({ onApply }: { onApply: (v: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [sugestao, setSugestao] = useState<any>(null);

  const handleSuggest = async () => {
    setLoading(true);
    // Dados mockados da tela que o usuario preencheu
    const res = await sugerirVeiculoOperacao(800, 4.5, "Alimentos Perecíveis (Refrigerado)", 45);
    setLoading(false);
    if(res.success) setSugestao(res.data);
  };

  return (
    <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 flex flex-col gap-3 mt-4">
       <div className="flex justify-between items-center">
         <div className="flex items-center gap-2 text-indigo-800 font-bold"><BrainCircuit className="w-5 h-5"/> Motor Cognitivo Logístico</div>
         <Button onClick={handleSuggest} disabled={loading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 font-bold shadow-md shadow-indigo-600/20"><Sparkles className="w-4 h-4 mr-2"/> Sugerir Melhor Veículo via IA</Button>
       </div>
       
       {loading && <div className="space-y-2"><Skeleton className="h-4 w-full bg-indigo-100"/><Skeleton className="h-4 w-4/5 bg-indigo-100"/></div>}
       
       {sugestao && !loading && (
          <div className="bg-white p-3 border border-indigo-200 rounded text-sm relative">
             <div className="grid grid-cols-2 gap-2 mb-2">
                <div><span className="text-xs font-bold text-slate-500 uppercase">Tipo Puxada (Veículo)</span><p className="font-bold text-lg text-slate-800">{sugestao.veiculo}</p></div>
                <div><span className="text-xs font-bold text-slate-500 uppercase">Implemento (Carroceria)</span><p className="font-bold text-lg text-slate-800">{sugestao.carroceria}</p></div>
             </div>
             <div className="bg-indigo-50 border border-indigo-100 p-2 rounded text-indigo-900 border-l-4 border-l-indigo-500 font-medium mb-3"><i>" {sugestao.justificativa} "</i></div>
             <Button onClick={() => onApply(sugestao)} variant="outline" size="sm" className="w-full font-bold text-indigo-700 hover:bg-indigo-50 border-indigo-300"><CheckCircle2 className="w-4 h-4 mr-2"/> Aplicar Sugestão aos Inputs</Button>
          </div>
       )}
    </div>
  );
}

export function AllocateProviderIA() {
  const [ranked, setRanked] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleRank = async () => {
    setLoading(true);
    const mockCandidatos = [
      { id: 1, nome: "João Transportes", veiculo: "VUC Refrigerado", distanciaColeta: 12, qualidade: 98, historicoAceite: 95 },
      { id: 2, nome: "Carlos Agregado", veiculo: "Van Std", distanciaColeta: 5, qualidade: 82, historicoAceite: 60 },
      { id: 3, nome: "LogX Express", veiculo: "Fiorino", distanciaColeta: 35, qualidade: 99, historicoAceite: 100 }
    ];
    const res = await rankearPrestadores(mockCandidatos, {});
    setLoading(false);
    if(res.success) setRanked(res.data);
  };

  return (
    <div className="mt-6 border-2 border-dashed border-purple-200 bg-purple-50/30 p-4 rounded-xl relative overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
         <div>
            <h4 className="font-bold text-purple-900 text-lg flex items-center gap-2"><Zap className="w-5 h-5 text-purple-600"/> Alocação Automática (Matchign)</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">O motor analisa distâncias (API Google), compliance do motorista (SLA local) e capacidade volumétrica exigida no contrato.</p>
         </div>
         <Button onClick={handleRank} className="bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/30 font-bold" disabled={loading}><Sparkles className="w-4 h-4 mr-2"/> Rodar Algoritmo de IA</Button>
      </div>

      {loading && <div className="space-y-3"><Skeleton className="h-16 w-full bg-purple-100 rounded-lg"/><Skeleton className="h-16 w-full bg-purple-100 rounded-lg"/></div>}

      {ranked.length > 0 && (
         <div className="space-y-3">
           {ranked.map((p, i) => (
             <div key={p.id} className="bg-white border p-3 rounded-lg shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between border-l-4 hover:border-l-purple-500 transition cursor-pointer" style={{ borderLeftColor: i === 0 ? '#9333ea' : '#e2e8f0' }}>
               <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${i === 0 ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>#{i+1}</div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-base">{p.nome} <Badge variant="secondary" className="text-[10px] ml-1 bg-slate-100">{p.veiculo}</Badge></h5>
                    <p className="text-xs text-muted-foreground">Distância da Coleta: {p.distanciaColeta}km • Qualificacao: {p.qualidade}/100</p>
                    <p className="text-[10px] text-purple-700 font-medium bg-purple-50 px-2 py-0.5 mt-1 rounded inline-block border border-purple-100">Motivo: Score total atingiu {p.score}pts com peso favorável para Distância vs Qualidade.</p>
                  </div>
               </div>
               <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                 <p className="font-bold text-lg text-slate-800"><span className="text-xs font-medium text-slate-500 font-mono uppercase mr-1">Tabela Frete</span> R$ 450,00</p>
                 <Button size="sm" className={i === 0 ? "w-full bg-green-600 hover:bg-green-700 font-bold shadow" : "w-full"} variant={i===0 ? "default" : "outline"}><CheckCircle2 className="w-4 h-4 mr-2"/> Alocar Este</Button>
               </div>
             </div>
           ))}
         </div>
      )}
    </div>
  );
}

export function AITextAssistant({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder?: string }) {
  const [loading, setLoading] = useState(false);

  const handleRewrite = async () => {
    if(!value) return;
    setLoading(true);
    const result = await melhorarTextoComercial(value, "Empatia Comercial e Argumentação Lógica de Frete");
    onChange(result);
    setLoading(false);
  };

  return (
    <div className="relative group">
       <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-12 transition-all" />
       <Button disabled={loading || !value} onClick={handleRewrite} variant="secondary" size="icon" className="absolute right-2 top-2 h-7 w-7 bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white transition shadow opacity-50 group-hover:opacity-100"><Wand2 className="w-4 h-4"/></Button>
    </div>
  );
}
