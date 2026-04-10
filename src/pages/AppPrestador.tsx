import { useState } from "react";
import { Search, MapPin, Truck, AlertTriangle, ShieldCheck, ShieldAlert, CheckCircle2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AppPrestador() {
  const [iniciouRota, setIniciouRota] = useState(false);
  const [checks, setChecks] = useState({
    seguro: false,
    gerenciadora: false,
    rastreio: false
  });

  const allChecked = checks.seguro && checks.gerenciadora && checks.rastreio;

  if (iniciouRota) {
     return (
        <div className="max-w-md mx-auto items-center justify-center p-6 bg-slate-900 border rounded-2xl shadow-xl min-h-[80vh] flex flex-col pt-12 relative overflow-hidden">
           <MapPin className="w-16 h-16 text-emerald-400 absolute opacity-10 top-10 left-10" />
           <Truck className="w-24 h-24 text-emerald-400 mb-6 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
           <h2 className="text-3xl font-bold text-white tracking-wider">ROTA INICIADA</h2>
           <p className="text-emerald-400 mt-2">Você está sendo monitorado em tempo real.</p>
           
           <div className="mt-12 bg-slate-800 w-full rounded-xl p-4 border border-slate-700">
             <div className="flex justify-between font-mono text-sm text-slate-300">
                <span>Apólice: RCTR-C Ativa</span>
                <span className="text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> OK</span>
             </div>
             <div className="flex justify-between font-mono text-sm text-slate-300 mt-2">
                <span>Sinal Isca/Macro:</span>
                <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Conectado</span>
             </div>
           </div>
        </div>
     );
  }

  return (
    <div className="max-w-md mx-auto bg-slate-50 border rounded-2xl shadow-lg min-h-[80vh] pb-12 flex flex-col relative">
      <div className="bg-indigo-600 text-white p-6 rounded-t-2xl pb-10">
         <h2 className="text-xl font-bold">App Motorista / Parceiro</h2>
         <p className="text-indigo-200 text-sm mt-1">Sua lista de viagem atual</p>
      </div>

      <div className="px-4 -mt-6">
         <Card className="shadow-lg border-0 mb-4">
            <CardContent className="p-4">
               <div className="flex justify-between items-start mb-2">
                  <Badge className="bg-indigo-100 text-indigo-800 border-none hover:bg-indigo-100">Pronta para Iniciar</Badge>
                  <p className="text-xs font-mono font-bold text-slate-500">OS #45199</p>
               </div>
               <h3 className="font-bold text-lg text-slate-800 mt-1">CD São Paulo → Loja RJ</h3>
               <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Truck className="w-4 h-4"/> 14 Entregas (8.5 Toneladas)</p>
            </CardContent>
         </Card>

         <h3 className="font-bold text-sm text-slate-500 uppercase mt-6 mb-3 ml-1 tracking-wider">Checklist de Liberação de Risco</h3>

         <div className="space-y-3">
            <button 
              className={`w-full p-4 rounded-xl text-left flex justify-between items-center border shadow-sm transition-colors ${checks.seguro ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
              onClick={() => setChecks({...checks, seguro: !checks.seguro})}
            >
               <div>
                  <p className={`font-bold flex items-center gap-2 ${checks.seguro ? 'text-emerald-700' : 'text-slate-700'}`}>
                    <ShieldCheck className="w-5 h-5"/> Seguro da Carga Validado
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Apólice ou termo de responsabilidade em mãos.</p>
               </div>
               {checks.seguro && <CheckCircle2 className="w-6 h-6 text-emerald-500"/>}
            </button>

            <button 
              className={`w-full p-4 rounded-xl text-left flex justify-between items-center border shadow-sm transition-colors ${checks.gerenciadora ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
              onClick={() => setChecks({...checks, gerenciadora: !checks.gerenciadora})}
            >
               <div>
                  <p className={`font-bold flex items-center gap-2 ${checks.gerenciadora ? 'text-emerald-700' : 'text-slate-700'}`}>
                    <AlertTriangle className="w-5 h-5"/> Gerenciadora de Risco (GR)
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Telefone da GR salvo, macro enviada, travas ok.</p>
               </div>
               {checks.gerenciadora && <CheckCircle2 className="w-6 h-6 text-emerald-500"/>}
            </button>

            <button 
              className={`w-full p-4 rounded-xl text-left flex justify-between items-center border shadow-sm transition-colors ${checks.rastreio ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
              onClick={() => setChecks({...checks, rastreio: !checks.rastreio})}
            >
               <div>
                  <p className={`font-bold flex items-center gap-2 ${checks.rastreio ? 'text-emerald-700' : 'text-slate-700'}`}>
                    <Search className="w-5 h-5"/> Rastreamento App Conectado
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">GPS ativado e conexão estabelecida.</p>
               </div>
               {checks.rastreio && <CheckCircle2 className="w-6 h-6 text-emerald-500"/>}
            </button>
         </div>

         <div className="mt-8">
            <Button 
              className="w-full h-14 text-lg font-bold gap-2 rounded-xl"
              disabled={!allChecked}
              onClick={() => setIniciouRota(true)}
              variant={allChecked ? "default" : "secondary"}
            >
               {!allChecked ? "Complete o check-list de Risco" : <><Play className="w-5 h-5 fill-current"/> INICIAR VIAGEM SEGURO</>}
            </Button>
         </div>
      </div>
    </div>
  );
}
