import { useState, useMemo } from "react";
import { Calculator, MapPin, Truck, CheckCircle2, Search, ArrowRight, ShieldAlert, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { EnderecoCompleto, EnderecoType } from "@/components/ui/EnderecoCompleto";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function SimuladorFrete() {
  const [origem, setOrigem] = useState<EnderecoType>({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
  const [destino, setDestino] = useState<EnderecoType>({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
  
  const [cliente, setCliente] = useState("");
  const [tabelaCobranca, setTabelaCobranca] = useState("Geral (Padrão Esporádico)");
  const [tipoVeiculo, setTipoVeiculo] = useState("");
  const [peso, setPeso] = useState(0);
  const [cubagem, setCubagem] = useState(0);
  const [valorNF, setValorNF] = useState(0);
  const [temAjudante, setTemAjudante] = useState(false);
  const [pedagioAuto, setPedagioAuto] = useState(true);

  const [resultado, setResultado] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Simulador Engine Falso / Didático
  const calcularEngine = () => {
    if (!cliente) return toast.error("Selecione um cliente ou prospeto para ancorar a tabela.");
    if (!origem.cep || !destino.cep) return toast.error("Preencha CEP de origem e destino.");
    
    setIsCalculating(true);
    setTimeout(() => {
       // Dados fixos da tabela mockada para demonstrar cálculo real
       const valorBaseTabela = 350.00; // Fracionado Base VUC SP
       const addPeso = peso > 500 ? (peso - 500) * 0.45 : 0; // Ex: 45 centavos por kg extra
       const valorRisco = (valorNF * 0.003); // 0.3% Ad Valorem
       const custoPedagio = pedagioAuto ? 48.90 : 0; // Fake Google Maps Fetch
       const custoAjudante = temAjudante ? 120.00 : 0;

       const subCustoAptoOperacional = 280.00 + custoAjudante + custoPedagio;

       const finalBase = valorBaseTabela + addPeso;
       const valorFaturarCliente = finalBase + custoPedagio + custoAjudante + valorRisco;
       const margemDinheiro = valorFaturarCliente - subCustoAptoOperacional;
       const margemPorcent = (margemDinheiro / valorFaturarCliente) * 100;

       setResultado({
         tabelaUsada: tabelaCobranca,
         valorBase: finalBase,
         custoPedagio,
         custoAjudante,
         custoRisco: valorRisco,
         totalCobrar: valorFaturarCliente,
         totalCusto: subCustoAptoOperacional,
         lucroEstimado: margemDinheiro,
         margemSist: margemPorcent
       });
       setIsCalculating(false);
       toast.success("Simulação processada com sucesso via motor de cálculo.");
    }, 1200);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1400px] mx-auto pb-10">
      
      {/* FORMULÁRIO ENGINE */}
      <div className="lg:col-span-8 space-y-6">
         <Card className="border-t-4 border-t-primary shadow-sm">
           <CardHeader className="pb-4 border-b">
              <CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5 text-primary"/> Novo Cálculo de Frete Comercial</CardTitle>
              <CardDescription>Cálculo em tempo real testando todas as faixas métricas da Matriz ativa do cliente.</CardDescription>
           </CardHeader>
           <CardContent className="pt-6 space-y-6 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label className="text-sm font-bold text-slate-700 mb-2 block">1. Cliente Vinculado na Tabela</Label>
                    <SearchableSelect table="clientes" labelField="nome_fantasia" searchFields={["nome_fantasia"]} value={cliente} onChange={(v, r) => { setCliente(v || ""); if(r) setTabelaCobranca(`Tabela Dinâmica ${r.nome_fantasia}`); }} placeholder="Buscar cliente prospecto ou ativo" />
                 </div>
                 <div className="bg-white border rounded p-3 text-xs flex items-center justify-between text-slate-500">
                    <div>
                      <span className="font-bold text-slate-700 block mb-1">Tabela Aplicada ao Motor</span>
                      <span className="text-primary font-bold flex items-center gap-1"><BadgeCheck className="w-4 h-4"/> {tabelaCobranca}</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-[10px]">Alterar Manualmente</Button>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <Label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-500"/> De (Origem da Carga)</Label>
                   <EnderecoCompleto value={origem} onChange={setOrigem} required/>
                 </div>
                 <div>
                   <Label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-green-500"/> Para (Destino Final)</Label>
                   <EnderecoCompleto value={destino} onChange={setDestino} required/>
                 </div>
              </div>

              <div className="border-t pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div>
                    <Label className="text-xs font-bold text-slate-600 block mb-1">Perfil Veículo Exigido</Label>
                    <Select value={tipoVeiculo} onValueChange={setTipoVeiculo}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Automático" /></SelectTrigger>
                      <SelectContent><SelectItem value="vuc">VUC 3 Ton</SelectItem><SelectItem value="toco">Caminhão Toco</SelectItem><SelectItem value="hr">HR / Fiorino</SelectItem></SelectContent>
                    </Select>
                 </div>
                 <div><Label className="text-xs font-bold text-slate-600 block mb-1">Peso Cubado (Kg)</Label><Input className="bg-white font-bold text-center" type="number" value={peso || ""} onChange={e=>setPeso(Number(e.target.value))} placeholder="0.0"/></div>
                 <div><Label className="text-xs font-bold text-slate-600 block mb-1">Cubagem (m³)</Label><Input className="bg-white font-bold text-center" type="number" value={cubagem || ""} onChange={e=>setCubagem(Number(e.target.value))} placeholder="0.0"/></div>
                 <div><Label className="text-xs font-bold text-slate-600 block mb-1">Valor NF de Risco (R$)</Label><Input className="bg-white font-bold text-center border-orange-200" type="number" value={valorNF || ""} onChange={e=>setValorNF(Number(e.target.value))} placeholder="R$ 0,00"/></div>
              </div>

              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between gap-4 mt-4">
                 <div className="flex gap-6">
                    <div className="flex items-center space-x-2">
                       <Switch checked={pedagioAuto} onCheckedChange={setPedagioAuto} id="ped"/>
                       <Label htmlFor="ped" className="font-semibold text-blue-900 cursor-pointer text-sm">Roteirizar Pedágio Auto.</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                       <Switch checked={temAjudante} onCheckedChange={setTemAjudante} id="aju"/>
                       <Label htmlFor="aju" className="font-semibold text-blue-900 cursor-pointer text-sm">Gatilho p/ 1 Ajudante</Label>
                    </div>
                 </div>
                 <Button className="font-bold tracking-wider px-8 h-12 text-sm shadow-md" onClick={calcularEngine} disabled={isCalculating}>
                    {isCalculating ? "Motor Processando as Faixas..." : "Calcular Preço Final"}
                 </Button>
              </div>
           </CardContent>
         </Card>
      </div>

      {/* RESULTADO (SIDEBAR) */}
      <div className="lg:col-span-4 space-y-4">
         {resultado ? (
           <Card className="border-2 border-primary overflow-hidden shadow-lg animate-fade-in relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"/>
              <CardHeader className="bg-slate-50 border-b pb-4">
                <CardTitle className="flex justify-center text-primary text-xl">PROPOSTA COMERCIAL</CardTitle>
                <CardDescription className="text-center font-bold text-slate-800 text-xs uppercase">{resultado.tabelaUsada}</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                 
                 <div className="space-y-3 font-mono text-sm tracking-tight text-slate-600 border-b pb-4">
                    <div className="flex justify-between items-center"><span className="uppercase font-semibold">Valor Base Faixa (Peso/Km)</span> <span className="text-slate-900">R$ {resultado.valorBase.toFixed(2)}</span></div>
                    {resultado.custoPedagio > 0 && <div className="flex justify-between items-center"><span className="uppercase text-blue-600">+ Auto Pedágio (Eixos)</span> <span className="text-blue-700">R$ {resultado.custoPedagio.toFixed(2)}</span></div>}
                    {resultado.custoAjudante > 0 && <div className="flex justify-between items-center"><span className="uppercase text-orange-600">+ Adicional Ajudante</span> <span className="text-orange-700">R$ {resultado.custoAjudante.toFixed(2)}</span></div>}
                    {resultado.custoRisco > 0 && <div className="flex justify-between items-center"><span className="uppercase text-purple-600">+ Ad Valorem / Risco</span> <span className="text-purple-700">R$ {resultado.custoRisco.toFixed(2)}</span></div>}
                 </div>

                 <div className="bg-slate-900 text-white rounded-xl p-4 text-center transform hover:scale-105 transition shadow-xl mt-[-10px] z-10 relative">
                    <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mb-1">Total a Faturar Cliente</p>
                    <p className="text-4xl font-black text-emerald-400">R$ {resultado.totalCobrar.toFixed(2)}</p>
                 </div>

                 <div className="space-y-2 pt-2 bg-slate-50 p-4 rounded-lg border">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase"><span>Custo Repasse Viagem</span> <span className="text-slate-800 text-sm">R$ {resultado.totalCusto.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-700 uppercase pt-2 border-t"><span>Lucro Operacional Líquido</span> <span className="text-sm">R$ {resultado.lucroEstimado.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center text-xs font-bold text-emerald-700 uppercase">
                       <span>Yield de Margem (%)</span> 
                       <span className={`text-base font-black px-2 py-0.5 rounded ${resultado.margemSist > 25 ? 'bg-emerald-100' : resultado.margemSist > 15 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                         {resultado.margemSist.toFixed(1)}%
                       </span>
                    </div>
                 </div>

                 <div className="flex flex-col gap-2 pt-2">
                    <Button className="w-full h-11 bg-primary font-bold text-xs"><ArrowRight className="w-4 h-4 mr-2"/> Transferir P/ Orçamento Formal</Button>
                    <Button variant="outline" className="w-full text-xs">Salvar como Rascunho de Simulação</Button>
                 </div>
              </CardContent>
           </Card>
         ) : (
           <Card className="h-full border-dashed flex flex-col items-center justify-center p-8 text-center text-slate-400 opacity-70">
              <Calculator className="w-16 h-16 text-slate-200 mb-4"/>
              <h3 className="font-bold text-slate-600 mb-2">Aguardando Parâmetros</h3>
              <p className="text-sm">Preencha o motor de busca e calibre suas rotas para ter a análise cirúrgica da viagem garantindo que não haja margem negativa.</p>
           </Card>
         )}
      </div>
    </div>
  );
}
