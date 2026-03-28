import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Fuel, TrendingUp, TrendingDown, Minus, Clock, Settings, Search, FileText, AlertTriangle, Info, MapPin, SlidersHorizontal, ArrowRight, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { combustiveisService, PrecoCombustivel } from "@/services/combustiveis";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Combustiveis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "dashboard";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });
  const [loading, setLoading] = useState(true);

  // MOCKS DA ESTRUTURA
  const [comb, setComb] = useState<any>({
    "Diesel S10": { preco: 5.92, var_dia: 0.05, var_7d: 0.12, var_30d: -0.03, data: new Date().toISOString(), fonte: "combustivelapi.com.br" },
    "Diesel Comum": { preco: 5.85, var_dia: -0.01, var_7d: 0.08, var_30d: 0.02, data: new Date().toISOString(), fonte: "combustivelapi.com.br" },
    "Gasolina Comum": { preco: 5.67, var_dia: 0.00, var_7d: -0.05, var_30d: -0.10, data: new Date().toISOString(), fonte: "ANP (Backup)" },
    "Etanol": { preco: 3.89, var_dia: 0.08, var_7d: 0.15, var_30d: 0.20, data: new Date().toISOString(), fonte: "Manual" }
  });

  const [simulacao, setSimulacao] = useState(6.20);
  const [frotaConfig, setFrotaConfig] = useState([
    { tipo: "Moto", km: 30, comb: "Gasolina" },
    { tipo: "Fiorino", km: 12, comb: "Gasolina" },
    { tipo: "HR", km: 11, comb: "Diesel S10" },
    { tipo: "Van", km: 10, comb: "Diesel S10" },
    { tipo: "VUC", km: 9, comb: "Diesel S10" },
    { tipo: "3/4", km: 8, comb: "Diesel S10" },
    { tipo: "Toco", km: 7, comb: "Diesel S10" },
    { tipo: "Truck", km: 5.5, comb: "Diesel S10" },
    { tipo: "Carreta", km: 3.5, comb: "Diesel S10" },
  ]);

  useEffect(() => {
    // Simulated fetch call using our Cascade service
    combustiveisService.syncCombustivelPrice("SP", "diesel_s10").then(() => {
      setLoading(false);
    });
  }, []);

  const CardCombustivel = ({ nome, icone: Icon, data }: any) => {
    const isUp = data.var_dia > 0;
    const isDown = data.var_dia < 0;
    const isManual = data.fonte === 'Manual';

    return (
      <Card className="relative overflow-hidden group hover:border-slate-300 transition-colors shadow-sm">
        {isManual && (
          <div className="absolute top-0 right-0 bg-orange-100 text-orange-800 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">MANUAL</div>
        )}
        <CardContent className="p-5">
           <div className="flex justify-between items-start mb-4">
             <div className="flex items-center gap-2">
               <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${nome.includes('Diesel') ? 'bg-amber-100 text-amber-600' : nome.includes('Gasolina') ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                 <Icon className="w-5 h-5" />
               </div>
               <span className="font-bold text-slate-700">{nome}</span>
             </div>
             
             {isUp && <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50 gap-1"><TrendingUp className="w-3 h-3"/> SUBINDO</Badge>}
             {isDown && <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 gap-1"><TrendingDown className="w-3 h-3"/> CAINDO</Badge>}
             {!isUp && !isDown && <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50 gap-1"><Minus className="w-3 h-3"/> ESTÁVEL</Badge>}
           </div>

           <div className="mt-2">
             <div className="flex items-end gap-2">
               <span className="text-3xl font-black tracking-tight text-slate-800">{fmtMoeda(data.preco)}</span>
               <span className="text-sm font-semibold text-slate-400 mb-1">/ Litro</span>
             </div>
             <p className={`text-xs mt-1 font-bold flex items-center gap-1 ${isUp ? 'text-red-600' : isDown ? 'text-green-600' : 'text-slate-500'}`}>
                {isUp ? `+${fmtMoeda(data.var_dia)} hoje` : isDown ? `${fmtMoeda(data.var_dia)} hoje` : 'Sem alteração hoje'}
             </p>
           </div>
           
           <div className="mt-5 grid grid-cols-2 gap-2 text-xs border-t pt-4">
             <div><p className="text-slate-400">7 Dias</p><p className={`font-semibold ${data.var_7d > 0 ? 'text-red-500' : 'text-green-500'}`}>{data.var_7d > 0 ? '+' : ''}{fmtMoeda(data.var_7d)}</p></div>
             <div><p className="text-slate-400">30 Dias</p><p className={`font-semibold ${data.var_30d > 0 ? 'text-red-500' : 'text-green-500'}`}>{data.var_30d > 0 ? '+' : ''}{fmtMoeda(data.var_30d)}</p></div>
           </div>
           
           <div className="mt-4 pt-4 border-t flex justify-between items-center text-[10px]">
             <span className="text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(data.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
             <span className="text-slate-500 font-semibold">{data.fonte}</span>
           </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Fuel className="w-8 h-8 text-amber-500" /> Inteligência de Combustível
          </h1>
          <p className="text-slate-500 text-sm mt-1">Monitoramento em tempo real dos custos de base para tomada de decisão comercial e frete.</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="gap-2 h-9 py-0 border-orange-200 text-orange-700 bg-orange-50 px-3 cursor-pointer"><AlertTriangle className="w-4 h-4"/> 1 Alerta Ativo</Badge>
           <Button variant="outline"><Clock className="w-4 h-4 mr-2"/> Sincronizar Agora</Button>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-white border rounded-lg h-auto p-1 shadow-sm mb-6 flex flex-wrap justify-start">
           <TabsTrigger value="dashboard" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800 px-4 py-2"><TrendingUp className="w-4 h-4 mr-2"/> Visão de Mercado</TabsTrigger>
           <TabsTrigger value="impacto" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800 px-4 py-2"><SlidersHorizontal className="w-4 h-4 mr-2"/> Impacto Operacional</TabsTrigger>
           <TabsTrigger value="abastecimentos" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800 px-4 py-2"><Fuel className="w-4 h-4 mr-2"/> Abastecimentos / Reembolsos</TabsTrigger>
           <TabsTrigger value="historico" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800 px-4 py-2"><FileText className="w-4 h-4 mr-2"/> Histórico & DRE</TabsTrigger>
           <TabsTrigger value="config" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800 px-4 py-2"><Settings className="w-4 h-4 mr-2"/> Config. e Alertas</TabsTrigger>
        </TabsList>

        {/* --- DASHBOARD PRINCIPAL --- */}
        <TabsContent value="dashboard" className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <CardCombustivel nome="Diesel S10" icone={Fuel} data={comb["Diesel S10"]} />
              <CardCombustivel nome="Diesel Comum" icone={Fuel} data={comb["Diesel Comum"]} />
              <CardCombustivel nome="Gasolina Comum" icone={Zap} data={comb["Gasolina Comum"]} />
              <CardCombustivel nome="Etanol" icone={Zap} data={comb["Etanol"]} />
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 shadow-sm border-slate-200">
                <CardHeader className="border-b pb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">Indicadores de Impacto na Frota (Diesel S10)</CardTitle>
                      <CardDescription>Resumo dos acréscimos comparando com a base de 30 dias atrás.</CardDescription>
                    </div>
                    <Badge className="bg-slate-800 hover:bg-slate-700">Mês Vigente</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                   <div className="bg-slate-50 p-4 rounded-xl border">
                      <p className="text-xs font-bold text-slate-500 uppercase">Custo Médio/Km (VUC)</p>
                      <p className="text-3xl font-black text-slate-800 mt-2">{fmtMoeda(comb["Diesel S10"].preco / 9)}</p>
                      <p className="text-xs text-red-600 font-semibold mt-1">+{fmtMoeda((comb["Diesel S10"].preco / 9) - ((comb["Diesel S10"].preco - 0.03) / 9))} vs. mês anterior</p>
                   </div>
                   <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <p className="text-xs font-bold text-red-800 uppercase">Impacto Global Projetado</p>
                      <p className="text-3xl font-black text-red-600 mt-2">+ R$ 4.850</p>
                      <p className="text-xs text-red-700 font-semibold mt-1">Custo extra estimado este mês</p>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-xl border flex flex-col justify-center">
                      <div className="flex items-center justify-between">
                         <p className="text-sm font-bold text-slate-600">Próxima Leitura Automática API</p>
                         <Clock className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-lg font-bold text-slate-800 mt-2">12:54:10</p>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
                         <div className="bg-amber-500 h-full w-[40%]"></div>
                      </div>
                   </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-orange-200">
                <CardHeader className="bg-orange-50/50 rounded-t-xl border-b border-orange-100 pb-4">
                  <CardTitle className="text-orange-900 text-base flex gap-2 items-center"><AlertTriangle className="w-5 h-5 text-orange-600"/> Alertas Diretos</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                   <div className="border-l-4 border-red-500 pl-4 py-1">
                      <p className="font-bold text-slate-800">Alta no Diesel S10</p>
                      <p className="text-sm text-slate-600 mt-1">O preço subiu R$ 0,12/L hoje (+2,3%) na região de São Paulo.</p>
                      <div className="flex gap-2 mt-3">
                         <Button variant="outline" size="sm" className="h-7 text-[10px] w-full" onClick={() => handleTabChange('impacto')}>Ver Impacto Detalhado</Button>
                      </div>
                   </div>
                   {/* Fallback de layout */}
                   <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 pt-3 flex flex-col items-center justify-center text-center opacity-70">
                      <Info className="w-4 h-4 text-slate-400 mb-2" />
                      <p className="text-xs text-slate-500">Nenhuma variação súbita de Gasolina nas últimas 48h.</p>
                   </div>
                </CardContent>
              </Card>
           </div>
        </TabsContent>

        {/* --- IMPACTO OPERACIONAL --- */}
        <TabsContent value="impacto" className="space-y-6">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                 <CardHeader>
                    <CardTitle>Cálculo de Consumo por Perfil (km/Litro)</CardTitle>
                    <CardDescription>A base de cálculos que a Torre usará para emitir as viagens.</CardDescription>
                 </CardHeader>
                 <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Combustível</TableHead><TableHead className="text-right">Rendimento Config</TableHead><TableHead className="text-right">R$/Km Hoje</TableHead></TableRow></TableHeader>
                      <TableBody>
                         {frotaConfig.map((v, i) => {
                           const pToday = comb[v.comb].preco;
                           const custo = pToday / v.km;
                           return (
                             <TableRow key={i}>
                               <TableCell className="font-bold">{v.tipo}</TableCell>
                               <TableCell className="text-sm text-slate-500">{v.comb}</TableCell>
                               <TableCell className="text-right font-medium">{v.km} km/L</TableCell>
                               <TableCell className="text-right font-bold text-slate-800">{fmtMoeda(custo)}</TableCell>
                             </TableRow>
                           );
                         })}
                      </TableBody>
                    </Table>
                 </CardContent>
              </Card>

              <Card className="border-2 border-indigo-100 bg-indigo-50/20">
                 <CardHeader className="pb-4">
                    <CardTitle className="text-indigo-900 flex items-center gap-2"><SlidersHorizontal className="w-5 h-5"/> Simulador Tático de Margem</CardTitle>
                    <CardDescription>E se o Diesel subir repentinamente? Como isso afeta o mês?</CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-8 mt-2">
                    <div className="space-y-4">
                       <div className="flex justify-between items-center">
                          <Label className="text-base font-bold text-indigo-900">Diesel S10 Projetado: {fmtMoeda(simulacao)}</Label>
                          <Badge variant="outline" className="bg-white">{fmtMoeda(simulacao - comb["Diesel S10"].preco)} vs. Real</Badge>
                       </div>
                       <input 
                         type="range" 
                         className="w-full accent-indigo-600" 
                         min={4.00} max={8.00} step={0.05} 
                         value={simulacao} 
                         onChange={(e) => setSimulacao(Number(e.target.value))} 
                       />
                       <div className="flex justify-between text-xs text-slate-500 px-1"><span>R$ 4.00</span><span>R$ 6.00</span><span>R$ 8.00</span></div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-indigo-100 grid grid-cols-2 gap-4 shadow-sm relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
                       <div className="pl-2">
                          <p className="text-xs uppercase font-bold text-slate-500">Custo Extra Projet. Km (VUC)</p>
                          <p className="text-2xl font-black text-red-600 mt-1">+{fmtMoeda((simulacao / 9) - (comb["Diesel S10"].preco / 9))}</p>
                       </div>
                       <div>
                          <p className="text-xs uppercase font-bold text-slate-500">Impacto Mensal Est. Gasto</p>
                          <p className="text-2xl font-black text-red-600 mt-1">
                             R$ {(((simulacao / 9) - (comb["Diesel S10"].preco / 9)) * 125000).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </p>
                       </div>
                       <div className="col-span-2 pt-4 border-t mt-2 flex flex-col items-center">
                          <p className="text-sm font-semibold text-slate-600 text-center">A margem operacional atual da rede inteira cairia de <span className="text-slate-800">18.5%</span> para <span className="text-red-600">16.1%</span>.</p>
                          <Button className="w-full max-w-sm mt-4 bg-indigo-600 hover:bg-indigo-700 font-bold tracking-wide">Gerar Sugestão de Reajuste de Tabela</Button>
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>

        {/* --- ABASTECIMENTOS E REEMBOLSOS --- */}
        <TabsContent value="abastecimentos" className="space-y-6">
           <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                 <div>
                    <CardTitle>Histórico e Reembolsos</CardTitle>
                    <CardDescription>Conferência automática baseada no preço do dia reportado pela API.</CardDescription>
                 </div>
                 <Button className="bg-amber-500 hover:bg-amber-600 font-bold"><Fuel className="w-4 h-4 mr-2"/> Lançar Abastecimento</Button>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                    <TableHeader className="bg-slate-50">
                       <TableRow><TableHead>Placa/Motora</TableHead><TableHead>Data Fiscal</TableHead><TableHead>Posto</TableHead><TableHead className="text-right">Volume / Valor</TableHead><TableHead>Auditoria de Preço Lançado</TableHead><TableHead className="text-center">Status</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                       <TableRow>
                          <TableCell className="font-bold text-slate-700">ABC-1234<br/><span className="text-xs text-slate-400 font-normal">João Silva (OS-8821)</span></TableCell>
                          <TableCell className="text-sm">Ontem, 16h45</TableCell>
                          <TableCell className="text-sm text-slate-600">Posto Frango Assado</TableCell>
                          <TableCell className="text-right text-sm">
                             <div className="font-bold">100 L</div>
                             <div className="text-xs text-slate-500">{fmtMoeda(600.00)} ({fmtMoeda(6.00)}/L)</div>
                          </TableCell>
                          <TableCell>
                             <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 shadow-sm gap-1 pl-1">
                                <CheckCircle className="w-3 h-3 text-green-600"/> Dentro da Média Est. (SP)
                             </Badge>
                          </TableCell>
                          <TableCell className="text-center"><Badge className="bg-slate-800 text-white hover:bg-slate-700">Liquidado</Badge></TableCell>
                       </TableRow>
                       <TableRow className="bg-red-50/30">
                          <TableCell className="font-bold text-slate-700">XYZ-9988<br/><span className="text-xs text-slate-400 font-normal">Roberto A. (OS-8900)</span></TableCell>
                          <TableCell className="text-sm">Hoje, 09h10</TableCell>
                          <TableCell className="text-sm text-slate-600">Posto Rota 300</TableCell>
                          <TableCell className="text-right text-sm">
                             <div className="font-bold">65 L</div>
                             <div className="text-xs text-slate-500">{fmtMoeda(455.00)} <span className="text-red-600 font-bold">({fmtMoeda(7.00)}/L)</span></div>
                          </TableCell>
                          <TableCell>
                             <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50 shadow-sm gap-1 pl-1">
                                <AlertTriangle className="w-3 h-3 text-red-600"/> Divergência +18% Acima
                             </Badge>
                          </TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className="border-red-500 text-red-600 bg-white">Bloq. p/ Auditoria</Badge></TableCell>
                       </TableRow>
                    </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- CONFIGURAÇÕES --- */}
        <TabsContent value="config">
           <Card className="max-w-4xl border-slate-200">
              <CardHeader className="bg-slate-50 border-b pb-6">
                 <CardTitle>Conexões e Gatilhos (Crawlers)</CardTitle>
                 <CardDescription>Gerencie de onde puxamos as informações para a torre.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2"><Settings className="w-4 h-4 text-primary"/> Fontes de Preços (Cascata)</h4>
                       
                       <div className="space-y-3 p-4 rounded-xl border border-blue-100 bg-blue-50/30 relative">
                          <div className="absolute top-2 right-2 text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">FONTE PRIMÁRIA</div>
                          <Label className="font-bold">1. CombustivelAPI.com.br</Label>
                          <Input className="bg-white font-mono text-sm" type="password" placeholder="Key SECRETA" value="api_key_xxxxxxxxxxxxxxxxxx" readOnly />
                          <div className="flex justify-end"><Button size="sm" variant="ghost" className="h-7 text-xs text-blue-700">Testar Conexão</Button></div>
                       </div>
                       
                       <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50 relative">
                          <div className="absolute top-2 right-2 text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded">BACKUP 01</div>
                          <Label className="font-bold text-slate-600">2. Raspagem ANP Governamental</Label>
                          <p className="text-xs text-slate-400">Atuador robótico configurado via Supabase Edge Function semanalmente.</p>
                       </div>
                       
                       <div className="space-y-3 p-4 rounded-xl border border-purple-100 bg-purple-50/30">
                          <div className="flex justify-between items-center w-full">
                            <Label className="font-bold text-purple-900 flex items-center gap-2"><Sparkles className="w-4 h-4"/> IA Preditiva de Preços</Label>
                            <Badge className="bg-purple-600 hover:bg-purple-700">Em Breve (n8n)</Badge>
                          </div>
                          <p className="text-xs text-purple-700">Receberá feeds de macroeconomia para plotar a chance do Diesel subir 15 dias antes (Webhook livre em /api/combustiveis/sync-externo)</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <h4 className="font-bold text-red-800 flex items-center gap-2 border-b border-red-100 pb-2"><AlertTriangle className="w-4 h-4 text-red-600"/> Gatilhos de Alerta Automáticos</h4>
                       
                       <div className="space-y-4 bg-white p-4 rounded-xl border">
                          <div className="flex items-center justify-between">
                             <Label className="flex flex-col gap-1 cursor-pointer">
                                <span className="font-semibold text-slate-800">Alerta de Alta em 24h</span>
                                <span className="text-xs text-slate-500">Notifica a torre se o diesel subir acima dessa porcentagem.</span>
                             </Label>
                             <Switch checked={true} />
                          </div>
                          <div className="flex gap-2 items-center">
                             <Input type="number" className="w-20 rounded-lg text-center font-bold" value={2.0} />
                             <span className="text-sm font-bold text-slate-500">%  (Padrão: 2%)</span>
                          </div>
                          <hr/>
                          <div className="flex items-center justify-between">
                             <Label className="flex flex-col gap-1 cursor-pointer">
                                <span className="font-semibold text-slate-800">Push App Motorista</span>
                                <span className="text-xs text-slate-500">Comunica via push para base fixos: "Procure postos ABC, diesel subiu."</span>
                             </Label>
                             <Switch checked={false} />
                          </div>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
