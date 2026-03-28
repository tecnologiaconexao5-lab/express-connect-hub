import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Package, Truck, CheckCircle2, Clock, AlertTriangle, MapPin, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Tracking() {
  const { codigo } = useParams();
  const [codigoBusca, setCodigoBusca] = useState(codigo || "");
  const [loading, setLoading] = useState(!codigo);
  const [os, setOs] = useState<any>(null);
  
  // Fake tracking details to demonstrate layout requested:
  useEffect(() => {
    if (codigo) buscarRastreio(codigo);
  }, [codigo]);

  const buscarRastreio = (cod: string) => {
    setLoading(true);
    // Mock simulation
    setTimeout(() => {
       setOs({
         codigo: cod.startsWith("CEX") ? cod : `CEX-202603-${cod}`,
         statusCode: "em_transito", // pedido_criado, coletado, em_transito, saiu_entrega, entregue, ocorrencia
         previsao: "Hoje até 18:00",
         origem: "São Paulo / SP",
         destino: "Rio de Janeiro / RJ",
         transportador: "João Silva - VAN",
         eventos: [
           { id: 1, tipo: "pedido_recebido", titulo: "Sua solicitação foi registrada", data: "25/03/2026", hora: "08:30" },
           { id: 2, tipo: "pedido_confirmado", titulo: "Operação confirmada pela transportadora", data: "25/03/2026", hora: "09:15" },
           { id: 3, tipo: "prestador_alocado", titulo: "Transportador designado para sua entrega", data: "25/03/2026", hora: "14:20" },
           { id: 4, tipo: "coletado", titulo: "Mercadoria coletada com sucesso", data: "26/03/2026", hora: "09:00" },
           { id: 5, tipo: "em_transito", titulo: "Mercadoria em rota de entrega", data: "26/03/2026", hora: "10:30", atual: true },
         ]
       });
       setLoading(false);
    }, 1200);
  };

  const getStepVisual = () => {
    const s = os?.statusCode;
    let step = 1;
    if (s === 'coletado') step = 2;
    if (s === 'em_transito' || s === 'saiu_entrega') step = 3;
    if (s === 'entregue') step = 4;
    
    return (
      <div className="flex w-full items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 z-0 rounded-full overflow-hidden">
           <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${(step-1) * 33.3}%` }} />
        </div>
        
        {["Pedido Criado", "Coletado", "Em Trânsito", "Entregue"].map((label, i) => {
           const done = i + 1 <= step;
           const current = i + 1 === step;
           return (
             <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors duration-500 ${done ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-slate-200 text-slate-400'}`}>
                   {done && !current ? <CheckCircle2 className="w-5 h-5"/> : i+1}
                </div>
                <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${done ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
             </div>
           );
        })}
      </div>
    );
  };

  if (loading && !os) {
    return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center"><div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center animate-pulse"><Package className="w-8 h-8 text-white" /></div><p className="mt-4 font-bold text-slate-500">Localizando pacote...</p></div>;
  }

  if (!os && !codigo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col pt-20 items-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center mb-6 shadow-lg"><Package className="w-8 h-8 text-white" /></div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Conexão Express Rastreio</h1>
        <p className="text-slate-500 mb-8 text-center max-w-sm">Insira seu código de rastreamento para acompanhar a sua entrega em tempo real.</p>
        <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
           <Label className="mb-2 block">Código de Rastreio</Label>
           <div className="flex gap-2">
             <Input className="h-12 text-lg font-bold uppercase" placeholder="CEX-..." value={codigoBusca} onChange={e => setCodigoBusca(e.target.value.toUpperCase())} />
             <Button className="h-12 px-6 bg-orange-500 hover:bg-orange-600 font-bold" onClick={() => buscarRastreio(codigoBusca)}>Buscar</Button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b py-4 px-6 sticky top-0 md:relative z-20 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-bold text-lg text-white shadow-md">CE</div>
             <div className="hidden sm:block">
               <h1 className="font-bold text-slate-800 leading-none">Conexão Express</h1>
               <p className="text-xs text-slate-500 font-medium">Tracking Intelligence</p>
             </div>
           </div>
           
           <Button variant="outline" className="gap-2 font-semibold text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => alert("Modal Notificações Whatsapp aberto")}><Clock className="w-4 h-4"/> Receber Atualizações</Button>
        </div>
      </header>

      {/* TRACKING CONTENT */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-6">
        
        {/* BIG STATUS CARD */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -mr-10 -mt-20 pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10 mb-10">
            <div>
               <p className="text-sm font-bold text-orange-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                 Atualizado agora
               </p>
               <h2 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">{os.codigo}</h2>
               <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl text-slate-700 font-medium">
                  <Clock className="w-5 h-5 text-slate-400" />
                  Previsão de Entrega: <strong className="text-slate-800">{os.previsao}</strong>
               </div>
            </div>
            <div className="text-left md:text-right">
               <Badge className="bg-orange-500 text-white font-bold text-sm px-4 py-1.5 uppercase shadow-md pointer-events-none">Em Trânsito</Badge>
            </div>
          </div>

          {getStepVisual()}
          
          {/* INFO CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-8 border-t border-slate-100">
            <div className="flex gap-4 items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
               <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-slate-500"/></div>
               <div><p className="text-[10px] font-bold text-slate-400 uppercase">Saindo de</p><p className="text-sm font-bold text-slate-700">{os.origem}</p></div>
            </div>
            <div className="flex gap-4 items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
               <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-orange-500"/></div>
               <div><p className="text-[10px] font-bold text-orange-400 uppercase">Indo para</p><p className="text-sm font-bold text-slate-700">{os.destino}</p></div>
            </div>
            <div className="flex gap-4 items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
               <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><Truck className="w-5 h-5 text-slate-500"/></div>
               <div><p className="text-[10px] font-bold text-slate-400 uppercase">Transportador</p><p className="text-sm font-bold text-slate-700">{os.transportador}</p></div>
            </div>
          </div>
        </div>

        {/* TIMELINE */}
        <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 pb-12">
           <h3 className="text-lg font-bold text-slate-800 mb-8 border-b pb-4">Histórico Detalhado</h3>
           
           <div className="relative border-l-2 border-slate-100 ml-4 space-y-8">
              {[...os.eventos].reverse().map((ev: any, i: number) => (
                <div key={ev.id} className="relative pl-8">
                  <div className={`absolute w-6 h-6 rounded-full border-4 flex items-center justify-center -left-[13px] top-1 transition-colors duration-500
                    ${ev.atual ? 'bg-orange-500 border-orange-100 shadow-lg shadow-orange-500/40 ring-4 ring-orange-500/20' : 'bg-slate-200 border-white'}
                  `}>
                     {ev.atual && <div className="w-2 h-2 bg-white rounded-full animate-ping" />}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
                     <div>
                       <h4 className={`text-base font-bold ${ev.atual ? 'text-orange-600' : 'text-slate-700'}`}>{ev.titulo}</h4>
                       {ev.tipo === 'em_transito' && <p className="text-sm text-slate-500 mt-1">A sua encomenda está em rota com o prestador parceiro.</p>}
                       {ev.tipo === 'entregue' && <p className="text-sm text-slate-500 mt-1 font-semibold text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Entregue e assinado com sucesso.</p>}
                     </div>
                     <div className="text-left sm:text-right shrink-0">
                       <p className="text-sm font-bold text-slate-600">{ev.data}</p>
                       <p className="text-xs text-slate-400 font-medium">{ev.hora}</p>
                     </div>
                  </div>
                </div>
              ))}
           </div>
        </div>

      </main>

      <footer className="mt-8 py-6 text-center text-slate-500 text-sm border-t bg-white">
        <p>Desenvolvido com tecnologia <strong>Conexão Express TMS</strong></p>
      </footer>
    </div>
  );
}
