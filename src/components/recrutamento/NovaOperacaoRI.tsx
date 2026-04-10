import { useState } from "react";
import { Copy, Check, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NovaOperacaoRI() {
  const [formData, setFormData] = useState({
    nomeOperacao: "",
    cliente: "",
    regiaoCarregamento: "",
    tipoVeiculo: "",
    capacidadeKg: "",
    capacidadeM3: "",
    valorSaida: 0,
    kmFranquia: 0,
    valorKmAdicional: 0,
    diasOperacao: "",
    diasOperadosMes: 22,
    consumoEconomico: 0,
    consumoNormal: 0,
    consumoPesado: 0,
    valorCombustivel: 0,
    manutencaoKm: 0,
    pneuKm: 0,
    documentacaoAnual: 0,
    qtdeParadasMin: 0,
    qtdeParadasMax: 0,
    tipoProduto: "",
    tipoEntrega: "",
    ajudante: "Nao",
    horarioCarregamento: "",
    tipoOperacao: "",
    tipoPagamento: "",
    regraPagamento: "",
    observacoes: "Operação padronizada. Valores de referência poderão variar conforme negociação específica e performance.",
  });

  const [copied, setCopied] = useState(false);

  const calculateFinanceiro = () => {
    // Diário
    const receitaDiaria = formData.valorSaida;
    
    // Custos Combustível
    const combEco = formData.consumoEconomico > 0 ? (formData.kmFranquia / formData.consumoEconomico) * formData.valorCombustivel : 0;
    const combNorm = formData.consumoNormal > 0 ? (formData.kmFranquia / formData.consumoNormal) * formData.valorCombustivel : 0;
    const combPes = formData.consumoPesado > 0 ? (formData.kmFranquia / formData.consumoPesado) * formData.valorCombustivel : 0;
    
    // Desgaste
    const desgasteDiario = formData.kmFranquia * (formData.manutencaoKm + formData.pneuKm);
    
    // Doc
    const diasUteisMes = formData.diasOperadosMes || 22;
    const docRateadaDiaria = formData.documentacaoAnual > 0 ? (formData.documentacaoAnual / 12) / diasUteisMes : 0;
    
    // Custo Total Diário (usando o normal como baseline para lucro geral)
    const custoTotalDiaNormal = combNorm + desgasteDiario + docRateadaDiaria;
    
    // Lucro Diário Estimado
    const lucroDiarioNormal = receitaDiaria - custoTotalDiaNormal;
    const lucroDiarioEco = receitaDiaria - (combEco + desgasteDiario + docRateadaDiaria);
    const lucroDiarioPes = receitaDiaria - (combPes + desgasteDiario + docRateadaDiaria);

    // Por Parada
    const ganhoParadaMin = formData.qtdeParadasMin > 0 ? lucroDiarioNormal / formData.qtdeParadasMin : 0;
    const ganhoParadaMax = formData.qtdeParadasMax > 0 ? lucroDiarioNormal / formData.qtdeParadasMax : 0;

    // Mensal
    const lucroMensal = lucroDiarioNormal * diasUteisMes;

    // Custo por KM
    const custoPorKm = formData.kmFranquia > 0 ? custoTotalDiaNormal / formData.kmFranquia : 0;

    return {
      receitaDiaria,
      combEco, combNorm, combPes,
      desgasteDiario,
      docRateadaDiaria,
      custoTotalDiaNormal,
      lucroDiarioNormal, lucroDiarioEco, lucroDiarioPes,
      ganhoParadaMin, ganhoParadaMax,
      lucroMensal,
      custoPorKm
    };
  };

  const sim = calculateFinanceiro();

  const handleCopyWapp = () => {
    const text = `
*OPERAÇÃO: ${formData.nomeOperacao || 'Nova Operação'}*
📍 Região: ${formData.regiaoCarregamento || '-'}
🚚 Veículo: ${formData.tipoVeiculo || '-'}

*💰 RESUMO FINANCEIRO ESTIMADO:*
- Receita Bruta / Saída: R$ ${formData.valorSaida.toFixed(2)}
- KM Franquia: ${formData.kmFranquia}km
- Ganho Estimado por Parada: R$ ${sim.ganhoParadaMax.toFixed(2)} a R$ ${sim.ganhoParadaMin.toFixed(2)}

*📊 DETALHES OPERACIONAIS:*
- Produto: ${formData.tipoProduto || '-'}
- Carga: ${formData.tipoEntrega || '-'}
- Paradas: ${formData.qtdeParadasMin} a ${formData.qtdeParadasMax}
- Horário Carregamento: ${formData.horarioCarregamento || '-'}

*💸 PAGAMENTO:*
- Frequência: ${formData.tipoPagamento || '-'} (${formData.regraPagamento || '-'})

📌 *REGRAS E OBSERVAÇÕES:*
${formData.observacoes}
`.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-6">
        {/* BLOCO 1 */}
        <Card className="border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
            <CardTitle className="text-base flex items-center gap-2">1. Dados da Operação</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1"><Label>Nome da Operação</Label><Input value={formData.nomeOperacao} onChange={(e) => setFormData({...formData, nomeOperacao: e.target.value})} placeholder="Ex: Rota SP Interior" /></div>
            <div className="space-y-1"><Label>Cliente</Label><Input value={formData.cliente} onChange={(e) => setFormData({...formData, cliente: e.target.value})} /></div>
            <div className="space-y-1"><Label>Região Carregamento</Label><Input value={formData.regiaoCarregamento} onChange={(e) => setFormData({...formData, regiaoCarregamento: e.target.value})} /></div>
            <div className="space-y-1">
              <Label>Tipo de Veículo</Label>
              <Select value={formData.tipoVeiculo} onValueChange={(val) => setFormData({...formData, tipoVeiculo: val})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fiorino">Fiorino (Utilitário)</SelectItem>
                  <SelectItem value="Van">Van / VUC</SelectItem>
                  <SelectItem value="3/4">Caminhão 3/4</SelectItem>
                  <SelectItem value="Toco">Caminhão Toco</SelectItem>
                  <SelectItem value="Truck">Caminhão Truck</SelectItem>
                  <SelectItem value="Carreta">Carreta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Capacidade (kg)</Label><Input type="number" value={formData.capacidadeKg} onChange={(e) => setFormData({...formData, capacidadeKg: e.target.value})} /></div>
            <div className="space-y-1"><Label>Capacidade (m³)</Label><Input type="number" value={formData.capacidadeM3} onChange={(e) => setFormData({...formData, capacidadeM3: e.target.value})} /></div>
          </CardContent>
        </Card>

        {/* BLOCO 2 e 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-t-4 border-t-green-500 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-base text-green-700">2. Financeiro Referência</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Valor Saída (R$)</Label><Input type="number" value={formData.valorSaida || ''} onChange={(e) => setFormData({...formData, valorSaida: Number(e.target.value)})} /></div>
                <div className="space-y-1"><Label>KM Franquia</Label><Input type="number" value={formData.kmFranquia || ''} onChange={(e) => setFormData({...formData, kmFranquia: Number(e.target.value)})} /></div>
                <div className="space-y-1"><Label>Adicional R$/km</Label><Input type="number" value={formData.valorKmAdicional || ''} onChange={(e) => setFormData({...formData, valorKmAdicional: Number(e.target.value)})} /></div>
                <div className="space-y-1"><Label>Dias Úteis/Mês</Label><Input type="number" value={formData.diasOperadosMes || ''} onChange={(e) => setFormData({...formData, diasOperadosMes: Number(e.target.value)})} /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-orange-500 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-base text-orange-700">3. Consumo Estimado</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 gap-4">
               <div className="space-y-1"><Label>Valor Combustível/L</Label><Input type="number" value={formData.valorCombustivel || ''} onChange={(e) => setFormData({...formData, valorCombustivel: Number(e.target.value)})} /></div>
               <div className="space-y-1"><Label>Consumo Normal (km/l)</Label><Input type="number" value={formData.consumoNormal || ''} onChange={(e) => setFormData({...formData, consumoNormal: Number(e.target.value)})} /></div>
               <div className="space-y-1"><Label>Consumo Eco (km/l)</Label><Input type="number" value={formData.consumoEconomico || ''} onChange={(e) => setFormData({...formData, consumoEconomico: Number(e.target.value)})} /></div>
               <div className="space-y-1"><Label>Consumo Pesado</Label><Input type="number" value={formData.consumoPesado || ''} onChange={(e) => setFormData({...formData, consumoPesado: Number(e.target.value)})} /></div>
            </CardContent>
          </Card>
        </div>

        {/* BLOCO 4 e 5 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-t-4 border-t-red-500 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-base text-red-700">4. Custos Fixos/Var</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 gap-4">
               <div className="space-y-1"><Label>Manutenção (R$/km)</Label><Input type="number" step="0.01" value={formData.manutencaoKm || ''} onChange={(e) => setFormData({...formData, manutencaoKm: Number(e.target.value)})} /></div>
               <div className="space-y-1"><Label>Pneu (R$/km)</Label><Input type="number" step="0.01" value={formData.pneuKm || ''} onChange={(e) => setFormData({...formData, pneuKm: Number(e.target.value)})} /></div>
               <div className="space-y-1 col-span-2"><Label>Doc. Veículo (Anual) R$</Label><Input type="number" value={formData.documentacaoAnual || ''} onChange={(e) => setFormData({...formData, documentacaoAnual: Number(e.target.value)})} /></div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-blue-500 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-base text-blue-700">5. Escopo da Viagem</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 gap-4">
               <div className="space-y-1"><Label>Min Paradas</Label><Input type="number" value={formData.qtdeParadasMin || ''} onChange={(e) => setFormData({...formData, qtdeParadasMin: Number(e.target.value)})} /></div>
               <div className="space-y-1"><Label>Máx Paradas</Label><Input type="number" value={formData.qtdeParadasMax || ''} onChange={(e) => setFormData({...formData, qtdeParadasMax: Number(e.target.value)})} /></div>
               <div className="space-y-1"><Label>Produto</Label><Input value={formData.tipoProduto} onChange={(e) => setFormData({...formData, tipoProduto: e.target.value})} placeholder="Linha Branca, Doc..." /></div>
               <div className="space-y-1">
                 <Label>Ajudante?</Label>
                 <Select value={formData.ajudante} onValueChange={(val) => setFormData({...formData, ajudante: val})}>
                   <SelectTrigger><SelectValue/></SelectTrigger>
                   <SelectContent><SelectItem value="Nao">Não Necessário</SelectItem><SelectItem value="Sim">Obrigatório</SelectItem></SelectContent>
                 </Select>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* BLOCO 6 e 7 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-t-4 border-t-purple-500 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20"><CardTitle className="text-base text-purple-700">6. Horários / Setup</CardTitle></CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 gap-4">
               <div className="space-y-1"><Label>Horário Carga</Label><Input type="time" value={formData.horarioCarregamento} onChange={(e) => setFormData({...formData, horarioCarregamento: e.target.value})} /></div>
               <div className="space-y-1">
                 <Label>Tipo Entrega</Label>
                 <Select value={formData.tipoOperacao} onValueChange={(val) => setFormData({...formData, tipoOperacao: val})}>
                   <SelectTrigger><SelectValue placeholder="D+0 / D+1"/></SelectTrigger>
                   <SelectContent><SelectItem value="D+0">D+0 (Same day)</SelectItem><SelectItem value="D+1">D+1 (Next day)</SelectItem></SelectContent>
                 </Select>
               </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-cyan-500 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20"><CardTitle className="text-base text-cyan-700">7. Regras de Pagamento</CardTitle></CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <Label>Ciclo Faturamento</Label>
                 <Select value={formData.tipoPagamento} onValueChange={(val) => setFormData({...formData, tipoPagamento: val})}>
                   <SelectTrigger><SelectValue placeholder="Semanal, Quinz..."/></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="Semanal">Semanal</SelectItem>
                     <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                     <SelectItem value="Mensal">Mensal</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-1"><Label>Regra (Ex: D+14)</Label><Input value={formData.regraPagamento} onChange={(e) => setFormData({...formData, regraPagamento: e.target.value})} /></div>
            </CardContent>
          </Card>
        </div>

        {/* BLOCO 8 */}
        <Card className="border-t-4 border-t-slate-800 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/20"><CardTitle className="text-base">8. Regras & Observações do Acordo</CardTitle></CardHeader>
          <CardContent className="pt-4">
            <Textarea 
              rows={4} 
              value={formData.observacoes} 
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
              className="resize-none font-mono text-sm" 
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pb-8">
          <Button variant="outline" size="lg">Cancelar</Button>
          <Button size="lg" className="bg-primary text-white gap-2">Criar Operação</Button>
        </div>
      </div>

      {/* DASHBOARD LATERAL - SIMULAÇÃO */}
      <div className="lg:w-[400px] w-full shrink-0">
        <div className="sticky top-6">
          <Card className="bg-slate-900 border-none text-slate-100 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Calculator className="w-24 h-24" /></div>
            <CardHeader className="pb-4 relative z-10">
              <CardTitle className="text-xl flex items-center gap-2">Simulator Inteligente ⚡</CardTitle>
              <CardDescription className="text-slate-400">Projeção estimada de ganhos operacionais diários em tempo real.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
                 <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Receita Diária Estimada</p>
                 <p className="text-3xl font-bold text-green-400">R$ {sim.receitaDiaria.toFixed(2)}</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Projeção Diária - Custos</p>
                <div className="flex justify-between text-sm">
                   <span className="text-slate-300">Combustível (Normal)</span>
                   <span className="font-mono text-red-300">- R$ {sim.combNorm.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-slate-300">Desgaste/Pneus</span>
                   <span className="font-mono text-red-300">- R$ {sim.desgasteDiario.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-slate-300">Doc/Rateio</span>
                   <span className="font-mono text-red-300">- R$ {sim.docRateadaDiaria.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between text-sm font-semibold">
                   <span className="text-slate-200">Custo Total Dia</span>
                   <span className="font-mono text-red-400">R$ {sim.custoTotalDiaNormal.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-900/40 rounded-lg border border-indigo-500/30">
                 <p className="text-xs text-indigo-300 uppercase font-semibold mb-1">Margem Líquida Diária</p>
                 <div className="flex justify-between items-end">
                   <p className="text-2xl font-bold text-indigo-100">R$ {sim.lucroDiarioNormal.toFixed(2)}</p>
                   <p className="text-xs text-indigo-400 mb-1 font-mono">{(sim.receitaDiaria > 0 ? (sim.lucroDiarioNormal / sim.receitaDiaria) * 100 : 0).toFixed(1)}%</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div className="p-3 bg-slate-800/80 rounded border border-slate-700">
                    <p className="text-[10px] text-slate-400 mb-1">GANHO POR PARADA</p>
                    <p className="font-mono text-sm">R$ {sim.ganhoParadaMax.toFixed(2)} ~ {sim.ganhoParadaMin.toFixed(2)}</p>
                 </div>
                 <div className="p-3 bg-slate-800/80 rounded border border-slate-700">
                    <p className="text-[10px] text-slate-400 mb-1">PERFORMANCE MENSAL</p>
                    <p className="font-mono text-sm text-green-300">R$ {sim.lucroMensal.toFixed(2)}</p>
                 </div>
              </div>

              <div className="pt-4 flex gap-2">
                <Button 
                  onClick={handleCopyWapp} 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-bold"
                >
                  {copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4" />}
                  {copied ? "Template Copiado!" : "Gerar Template WhatsApp"}
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
