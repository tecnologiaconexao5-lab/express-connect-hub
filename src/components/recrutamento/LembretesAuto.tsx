import { useState } from "react";
import { Mail, Clock, AlertTriangle, CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function LembretesAuto() {
  const [tarefas] = useState([
    { id: 1, publico: "Interessados sem contato há 15 dias", qtd: 14, urgencia: "media" },
    { id: 2, publico: "Documentação pendente há 7 dias", qtd: 5, urgencia: "alta" },
    { id: 3, publico: "Aprovados ociosos há mais de 30 dias", qtd: 22, urgencia: "baixa" }
  ]);

  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-amber-500 shadow-sm">
         <CardHeader>
            <CardTitle className="text-amber-800 flex flex-row items-center gap-2"><Clock className="w-5 h-5"/> Régua de Retenção de Potenciais</CardTitle>
            <CardDescription className="text-slate-600 font-medium">Não perca o investimento em marketing captação de frota ativando automaticamente a base.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            {tarefas.map(t => (
               <div key={t.id} className="p-4 border rounded-xl flex items-center justify-between bg-white hover:border-amber-400 transition hover:shadow-sm">
                  <div className="flex items-center gap-4">
                     <div className={`p-3 rounded-xl shrink-0 ${t.urgencia === 'alta' ? 'bg-red-100 text-red-600' : t.urgencia === 'media' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                        <AlertTriangle className="w-6 h-6"/>
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-800">{t.publico}</h4>
                        <p className="text-xs font-mono font-bold text-slate-500 mt-1"><span className="text-base text-slate-800">{t.qtd}</span> candidatos elegíveis na fila</p>
                     </div>
                  </div>
                  <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 bg-green-50/50 gap-2 font-bold" onClick={() => toast.success(`Lembretes massivos disparados via WhatsApp para ${t.qtd} prestadores.`)}>
                    <Mail className="w-4 h-4"/> Disparar Lote Integrado (Variáveis Aut.)
                  </Button>
               </div>
            ))}
         </CardContent>
      </Card>
    </div>
  );
}
