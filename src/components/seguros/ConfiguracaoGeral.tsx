import { useState } from "react";
import { Save, ShieldAlert, KeyRound, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function ConfiguracaoGeral() {
  const [config, setConfig] = useState({
    seguroAtivo: true,
    exigirRctrc: true,
    exigirRcdc: true,
    exigirGris: false,
    validarAntesOs: true,
    bloquearSemValidade: true,
    excecaoAdmin: true
  });
  const [loading, setLoading] = useState(false);

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Configurações de seguro salvas com sucesso!");
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
         <div>
            <h3 className="font-bold flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-indigo-600"/> Controles de Risco & Conformidade</h3>
            <p className="text-sm text-slate-500">Defina o rigor das operações vinculadas à validações de apólice.</p>
         </div>
         <Button onClick={handleSave} disabled={loading} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4"/> Salvar Políticas
         </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Card className="border-t-4 border-t-indigo-500">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
               <CardTitle className="text-base flex justify-between items-center">Ativações Globais <Badge className="bg-indigo-100 text-indigo-800 border-none">Geral</Badge></CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
               <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">Módulo de Seguros Habilitado</p>
                    <p className="text-xs text-slate-500 mt-0.5">Controla se o sistema fará a exigência global de seguros na plataforma.</p>
                  </div>
                  <Switch checked={config.seguroAtivo} onCheckedChange={(v) => setConfig({...config, seguroAtivo: v})} />
               </div>
               <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">RCTR-C Obrigatório</p>
                    <p className="text-xs text-slate-500 mt-0.5">Responsabilidade Civil do Transportador Rodoviário de Carga.</p>
                  </div>
                  <Switch checked={config.exigirRctrc} onCheckedChange={(v) => setConfig({...config, exigirRctrc: v})} disabled={!config.seguroAtivo} />
               </div>
               <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">RC-DC Obrigatório</p>
                    <p className="text-xs text-slate-500 mt-0.5">Responsabilidade Civil de Desvio de Carga (Roubo).</p>
                  </div>
                  <Switch checked={config.exigirRcdc} onCheckedChange={(v) => setConfig({...config, exigirRcdc: v})} disabled={!config.seguroAtivo} />
               </div>
               <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">Exigir Gerenciadora (GR)</p>
                    <p className="text-xs text-slate-500 mt-0.5">Torna a averbação e acompanhamento em GR estritamente obrigatórios.</p>
                  </div>
                  <Switch checked={config.exigirGris} onCheckedChange={(v) => setConfig({...config, exigirGris: v})} disabled={!config.seguroAtivo} />
               </div>
            </CardContent>
         </Card>

         <Card className="border-t-4 border-t-red-500">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
               <CardTitle className="text-base text-red-800 flex justify-between items-center">Travas Operacionais <Badge className="bg-red-100 text-red-800 border-none">Sensível</Badge></CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
               <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-red-900">Validar Seguro antes de Gerar OS</p>
                    <p className="text-xs text-slate-500 mt-0.5">Nenhuma Ordem de Serviço poderá ser emitida se a carga não possuir cobertura.</p>
                  </div>
                  <Switch checked={config.validarAntesOs} onCheckedChange={(v) => setConfig({...config, validarAntesOs: v})} />
               </div>
               <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-red-900">Bloquear Operação Analisada (Sem Validade)</p>
                    <p className="text-xs text-slate-500 mt-0.5">Bloqueia viagem se apólice global venceu ou limite GR ultrapassado.</p>
                  </div>
                  <Switch checked={config.bloquearSemValidade} onCheckedChange={(v) => setConfig({...config, bloquearSemValidade: v})} />
               </div>
               <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200 mt-4">
                  <div className="flex items-start gap-3">
                    <KeyRound className="w-5 h-5 text-amber-600 mt-1"/>
                    <div>
                      <p className="font-bold text-amber-900">Override com Autorização (Admin)</p>
                      <p className="text-[10px] text-amber-700 mt-0.5">Permite que usuários master liberem a emissão de OS com seguro quebrado ou vencido gravando log na auditoria.</p>
                    </div>
                  </div>
                  <Switch checked={config.excecaoAdmin} onCheckedChange={(v) => setConfig({...config, excecaoAdmin: v})} />
               </div>
            </CardContent>
         </Card>
         
         <div className="col-span-1 md:col-span-2">
            <div className="flex gap-4 p-4 border border-dashed rounded-lg items-center text-muted-foreground bg-slate-50/50">
               <AlertTriangle className="w-8 h-8 text-slate-400" />
               <div className="text-sm">
                  <p className="font-bold">Nota de Compliance (Regulatório)</p>
                  <p>Essas regras se aplicam ao faturamento de transporte global. Clientes classificados como DDR terão as regras contornadas pelo painel "Regras por Cliente" mesmo que "Exigir RC-DC" esteja ativado aqui.</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
