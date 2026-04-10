import { AlertTriangle, ShieldAlert, Shield, Ban, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AlertasPainel() {
  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-l-4 border-l-amber-500">
             <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-slate-500 font-bold">Apólices Vencendo</CardTitle></CardHeader>
             <CardContent>
                <div className="flex items-center gap-2">
                   <AlertTriangle className="w-6 h-6 text-amber-500" />
                   <p className="text-2xl font-bold text-slate-800">1</p>
                </div>
                <p className="text-[10px] font-bold text-amber-600 mt-1">Tokio Marine S.A (em <Badge className="bg-amber-100 text-amber-800 border-none scale-75 ml-1">15 dias</Badge>)</p>
             </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-red-500 bg-red-50/30">
             <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-red-800 font-bold">Apólices Vencidas</CardTitle></CardHeader>
             <CardContent>
                <div className="flex items-center gap-2">
                   <ShieldAlert className="w-6 h-6 text-red-600" />
                   <p className="text-2xl font-bold text-red-900">0</p>
                </div>
                <p className="text-[10px] font-bold text-red-600 mt-1">Nenhum vencimento detectado</p>
             </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-slate-800">
             <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-slate-500 font-bold">Operações Bloqueadas</CardTitle></CardHeader>
             <CardContent>
                <div className="flex items-center gap-2">
                   <Ban className="w-6 h-6 text-slate-800" />
                   <p className="text-2xl font-bold text-slate-800">2</p>
                </div>
                <p className="text-[10px] font-bold text-slate-500 mt-1">Bloqueios sistêmicos por limite estourado</p>
             </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-emerald-500">
             <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-slate-500 font-bold">Integridade Rastreio GR</CardTitle></CardHeader>
             <CardContent>
                <div className="flex items-center gap-2">
                   <Shield className="w-6 h-6 text-emerald-500" />
                   <p className="text-2xl font-bold text-slate-800">98%</p>
                </div>
                <p className="text-[10px] font-bold text-emerald-600 mt-1">Sinal das ISCAS comunicando OK</p>
             </CardContent>
          </Card>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
             <CardHeader className="pb-2 border-b bg-slate-50/50">
                <CardTitle className="text-base text-red-800 flex items-center gap-2"><Ban className="w-4 h-4"/> Bloqueios Ativos de Ordem de Serviço (OS)</CardTitle>
             </CardHeader>
             <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between items-center bg-red-50 border border-red-100 p-3 rounded-xl">
                   <div>
                      <p className="font-bold text-red-900 text-sm">OS #45091 - Rota SP x BA</p>
                      <p className="text-xs text-red-700">Motivo: Carga avaliada em R$ 1.8M ultrapassa limite Máximo (R$ 1.5M) da apólice.</p>
                      <p className="text-[10px] text-slate-500 mt-1">Cliente: Samsung Eletrônicos</p>
                   </div>
                   <Badge className="bg-red-600 text-white border-none">Bloqueado</Badge>
                </div>
                <div className="flex justify-between items-center bg-red-50 border border-red-100 p-3 rounded-xl">
                   <div>
                      <p className="font-bold text-red-900 text-sm">OS #45102 - Rota MG x RJ</p>
                      <p className="text-xs text-red-700">Motivo: Motorista com sinal amarelo na verificadora Buonny.</p>
                      <p className="text-[10px] text-slate-500 mt-1">Cliente: Amazon Logística (Exigência Contratual Restrita)</p>
                   </div>
                   <Badge className="bg-amber-500 text-white border-none">Retido GR</Badge>
                </div>
             </CardContent>
          </Card>

          <Card className="shadow-sm">
             <CardHeader className="pb-2 border-b bg-slate-50/50">
                <CardTitle className="text-base text-slate-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600"/> Histórico de "Overrides" (Liberações Admin)</CardTitle>
             </CardHeader>
             <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded-xl">
                   <div>
                      <p className="font-bold text-slate-800 text-sm">OS #44900 - Extensão de Cobertura Aceita</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">Autorizado por: admin.master@express.com</p>
                   </div>
                   <div className="text-right">
                      <Badge variant="outline" className="text-slate-500 border-slate-300">Há 2 dias</Badge>
                   </div>
                </div>
             </CardContent>
          </Card>
       </div>
    </div>
  );
}
