import { Calculator, Save, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function RegrasCalculo() {
  return (
    <div className="space-y-6 max-w-5xl">
       <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold flex items-center gap-2 text-lg"><Calculator className="w-5 h-5 text-indigo-600"/> Motor de Cálculo Tarifário (Ad-Valorem / GRIS)</h3>
            <p className="text-sm text-slate-500">Defina os percentuais globais de cobrança das taxas de seguro e risco para faturamento interno.</p>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2"><Save className="w-4 h-4"/> Aplicar Regras no Motor</Button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-sm border-t-2 border-t-blue-500">
             <CardHeader className="bg-slate-50/50 pb-3 border-b"><CardTitle className="text-base">Ad-Valorem (Referente a RCTR-C)</CardTitle></CardHeader>
             <CardContent className="pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Tipo de Cálculo</Label>
                  <Select defaultValue="perc_carga">
                     <SelectTrigger><SelectValue/></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="perc_carga">% sobre o Valor da Carga</SelectItem>
                        <SelectItem value="perc_frete">% sobre o Valor do Frete</SelectItem>
                        <SelectItem value="fixo">Valor Fixo Tarifário</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Taxa Base Ad-Valorem (%)</Label>
                  <Input defaultValue="0.30" type="number" step="0.01" />
                </div>
                <div className="space-y-1">
                  <Label>Valor Mínimo Cobrado (R$)</Label>
                  <Input defaultValue="15.00" type="number" step="0.01" />
                </div>
                <div className="space-y-1">
                  <Label>Quem Paga?</Label>
                  <Select defaultValue="cliente">
                     <SelectTrigger><SelectValue/></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="cliente">Destacar no Conhecimento para o Cliente</SelectItem>
                        <SelectItem value="embutido">Embutido no Frete (Sem destaque)</SelectItem>
                        <SelectItem value="transportadora">Custo da Transportadora</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
             </CardContent>
          </Card>

          <Card className="shadow-sm border-t-2 border-t-purple-500">
             <CardHeader className="bg-slate-50/50 pb-3 border-b"><CardTitle className="text-base">Taxa GRIS (Referente a RC-DC / Risco)</CardTitle></CardHeader>
             <CardContent className="pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Tipo de Cálculo</Label>
                  <Select defaultValue="perc_carga">
                     <SelectTrigger><SelectValue/></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="perc_carga">% sobre o Valor da Carga</SelectItem>
                        <SelectItem value="perc_frete">% sobre o Valor do Frete</SelectItem>
                        <SelectItem value="fixo">Valor Fixo Tarifário</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Taxa Base GRIS (%)</Label>
                  <Input defaultValue="0.15" type="number" step="0.01" />
                </div>
                <div className="space-y-1">
                  <Label>Valor Mínimo Cobrado (R$)</Label>
                  <Input defaultValue="10.00" type="number" step="0.01" />
                </div>
                <div className="space-y-1">
                  <Label>Agravante Zona de Risco (+%)</Label>
                  <Input defaultValue="0.05" type="number" step="0.01" />
                  <p className="text-[10px] text-muted-foreground">Somado automaticamente em áreas RJ/SP</p>
                </div>
             </CardContent>
          </Card>

          <Card className="md:col-span-2 bg-slate-900 border-none text-white shadow-lg overflow-hidden relative">
             <div className="absolute right-0 top-0 opacity-10"><Zap className="w-48 h-48" /></div>
             <CardContent className="p-6 relative z-10">
                <h4 className="font-bold mb-2 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400"/> Lógica de Aplicação nas Operações / Orçamentos</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                     <p className="font-bold text-sm text-yellow-400 mb-1">Cenário 1: Cliente DDR</p>
                     <p className="text-xs text-slate-300">O sistema zera (R$ 0,00) as taxas Ad-Valorem e GRIS da cobrança, mas o módulo validador ainda verifica apólices e averbações de segurança na emissão da OS.</p>
                  </div>
                  <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                     <p className="font-bold text-sm text-yellow-400 mb-1">Cenário 2: Cliente Normal</p>
                     <p className="text-xs text-slate-300">O motor aplica a cobrança (%) de Ad-valorem e GRIS calculadas automagicamente na cotação. E repassa os Custos ao DRE (Despesas Operacionais).</p>
                  </div>
                  <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                     <p className="font-bold text-sm text-yellow-400 mb-1">Cenário 3: Override</p>
                     <p className="text-xs text-slate-300">Caso o admin precise forçar uma apólice vencida, o rateio não será segurado mas a DRE acusará a falta de cobertura para fins contábeis.</p>
                  </div>
                </div>
             </CardContent>
          </Card>
       </div>
    </div>
  );
}
