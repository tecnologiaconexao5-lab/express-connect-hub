import { useState } from "react";
import { Brain, Truck, Calculator, FileCheck, Sparkles, CheckCircle, ArrowRight, Package, MapPin, CreditCard, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { sugerirVeiculo, VEICULO_PARAMETROS } from "@/constants/tiposVeiculo";
import { calcularComposicaoFinanceira } from "@/services/financeiro/composicaoFinanceiraService";
import { supabase } from "@/lib/supabase";

interface SugestaoVeiculo {
  tipo: string;
  motivo: string;
  capacidadeKg: number;
}

export default function TesteInteligencia() {
  const [etapa, setEtapa] = useState(0);
  const [dados, setDados] = useState({
    peso: 0,
    cubagem: 0,
    refrigerada: false,
    cliente: "Empresa Teste",
    tipoVeiculo: "",
    distanciaKm: 45,
    valorCliente: 350,
    pedagio: 25,
    custoPrestador: 0
  });
  const [sugestaoVeiculo, setSugestaoVeiculo] = useState<SugestaoVeiculo | null>(null);
  const [calculoValores, setCalculoValores] = useState<any>(null);
  const [composicao, setComposicao] = useState<any>(null);

  const executarInteligencias = async () => {
    toast.info("Executando inteligências operacionais...", { duration: 2000 });
    
    // 1. Sugestão de Veículo
    await new Promise(r => setTimeout(r, 500));
    const tipoSugerido = sugerirVeiculo(dados.peso, dados.cubagem, 0, 0, 0);
    const params = tipoSugerido ? VEICULO_PARAMETROS[tipoSugerido] : null;
    setSugestaoVeiculo({
      tipo: tipoSugerido || "carreta",
      motivo: params ? `Capacidade: ${params.pesoMax}kg, ${params.cubagemMax}m³` : "Veículo padrão",
      capacidadeKg: params?.pesoMax || 0
    });
    setDados(prev => ({ ...prev, tipoVeiculo: tipoSugerido || "carreta" }));
    setEtapa(1);
    toast.success(`1. Veículo sugerido: ${tipoSugerido}`, { duration: 2000 });

    // 2. Cálculo de Valores
    await new Promise(r => setTimeout(r, 600));
    
    // Buscar tabela de valores do Supabase
    const { data: tabela } = await supabase
      .from("tabelas_valores")
      .select("*")
      .ilike("tipo_veiculo", dados.tipoVeiculo)
      .lte("km_inicial", dados.distanciaKm)
      .gte("km_final", dados.distanciaKm)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    
    if (tabela) {
      const valorBase = Number(tabela.valor_base) || 0;
      const valorKm = Number(tabela.valor_km) || 0;
      const valorMinimo = Number(tabela.valor_minimo) || 0;
      const distanciaExcedente = Math.max(0, dados.distanciaKm - (tabela.franquia_km || 0));
      const valorExcedente = distanciaExcedente * valorKm;
      const valorCalculado = Math.max(valorMinimo, valorBase + valorExcedente);
      
      const custoPrestador = valorCalculado * (Number(tabela.percentual_prestador || 80) / 100);
      
      setCalculoValores({
        tabelaNome: tabela.nome,
        distanciaKm: dados.distanciaKm,
        valorBase,
        valorKm,
        valorMinimo,
        distanciaExcedente,
        valorExcedente,
        valorCliente: dados.valorCliente,
        custoPrestador: Math.round(custoPrestador * 100) / 100,
        margem: Math.round((dados.valorCliente - custoPrestador - dados.pedagio) * 100) / 100
      });
      setDados(prev => ({ ...prev, custoPrestador }));
    } else {
      // Simulação sem tabela
      const custoSimulado = dados.distanciaKm * 2.5;
      setCalculoValores({
        tabelaNome: "Tabela Genérica (simulação)",
        distanciaKm: dados.distanciaKm,
        custoPrestador: custoSimulado,
        valorCliente: dados.valorCliente,
        margem: Math.round((dados.valorCliente - custoSimulado - dados.pedagio) * 100) / 100
      });
      setDados(prev => ({ ...prev, custoPrestador: custoSimulado }));
    }
    setEtapa(2);
    toast.success("2. Valores calculados automaticamente", { duration: 2000 });

    // 3. Composição Financeira
    await new Promise(r => setTimeout(r, 400));
    const composicaoCalc = calcularComposicaoFinanceira({
      valor_cliente: dados.valorCliente,
      valor_prestador: dados.custoPrestador,
      pedagio_valor: dados.pedagio,
      imposto_percentual: 4.5,
      seguro_valor: 0,
      outros_custos: 0
    });
    setComposicao(composicaoCalc);
    setEtapa(3);
    toast.success("3. Composição financeira gerada", { duration: 2000 });

    // 4. Simulação de integração OS → Financeiro
    await new Promise(r => setTimeout(r, 300));
    setEtapa(4);
    toast.success("4. Registros financeiros criados", { duration: 2000 });
  };

  const etapasNomes = [
    { icon: Truck, label: "Identificação de Carga" },
    { icon: Brain, label: "Sugestão de Veículo" },
    { icon: Calculator, label: "Cálculo de Valores" },
    { icon: CreditCard, label: "Integração Financeira" }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Inteligência Operacional</h1>
          <p className="text-muted-foreground">Demonstração das automações inteligentes do sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-6">
        {etapasNomes.map((e, i) => (
          <div key={i} className={`flex items-center gap-2 p-3 rounded-lg border ${etapa >= i ? 'bg-primary/10 border-primary' : 'bg-muted/30'}`}>
            <e.icon className={`w-4 h-4 ${etapa >= i ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-medium ${etapa >= i ? '' : 'text-muted-foreground'}`}>{e.label}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-500" />
            1. Dados da Carga
          </CardTitle>
          <CardDescription>Informe os dados da carga para ver a inteligência em ação</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">Peso (kg)</Label>
            <Input type="number" value={dados.peso} onChange={(e) => setDados({ ...dados, peso: Number(e.target.value) })} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs">Cubagem (m³)</Label>
            <Input type="number" value={dados.cubagem} onChange={(e) => setDados({ ...dados, cubagem: Number(e.target.value) })} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs">Distância (km)</Label>
            <Input type="number" value={dados.distanciaKm} onChange={(e) => setDados({ ...dados, distanciaKm: Number(e.target.value) })} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs">Valor Cliente (R$)</Label>
            <Input type="number" value={dados.valorCliente} onChange={(e) => setDados({ ...dados, valorCliente: Number(e.target.value) })} placeholder="0" />
          </div>
        </CardContent>
      </Card>

      <Button 
        onClick={executarInteligencias} 
        disabled={etapa === 4}
        className="w-full py-6 text-lg gap-2"
      >
        {etapa < 4 ? (
          <>
            <Sparkles className="w-5 h-5" />
            Executar Inteligências
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            Inteligências Executadas
          </>
        )}
      </Button>

      {sugestaoVeiculo && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-800">
              <Brain className="w-4 h-4" />
              Sugestão de Veículo (IA)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-lg text-orange-900">{sugestaoVeiculo.tipo}</p>
                <p className="text-sm text-orange-700">{sugestaoVeiculo.motivo}</p>
              </div>
              <Badge className="bg-orange-500 text-white">Sugerido Automaticamente</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {calculoValores && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
              <Calculator className="w-4 h-4" />
              Cálculo Automático de Valores
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tabela utilizada:</span>
              <span className="font-medium">{calculoValores.tabelaNome}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Distância:</span>
              <span className="font-medium">{calculoValores.distanciaKm} km</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor Cliente:</span>
              <span className="font-bold text-blue-600">R$ {calculoValores.valorCliente.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Custo Prestador:</span>
              <span className="font-bold text-orange-600">R$ {calculoValores.custoPrestador.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pedágio:</span>
              <span className="font-medium">R$ {dados.pedagio.toFixed(2)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm bg-green-50 p-2 rounded">
              <span className="text-green-800 font-medium">Margem Bruta:</span>
              <span className="font-bold text-green-700">R$ {calculoValores.margem.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {composicao && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-green-800">
              <CreditCard className="w-4 h-4" />
              Composição Financeira Completa
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-2 bg-white rounded">
              <p className="text-xs text-muted-foreground">Valor Cliente</p>
              <p className="font-bold text-blue-600">R$ {composicao.valor_cliente.toFixed(2)}</p>
            </div>
            <div className="text-center p-2 bg-white rounded">
              <p className="text-xs text-muted-foreground">Custo Prestador</p>
              <p className="font-bold text-orange-600">R$ {composicao.valor_prestador.toFixed(2)}</p>
            </div>
            <div className="text-center p-2 bg-white rounded">
              <p className="text-xs text-muted-foreground">Impostos (4.5%)</p>
              <p className="font-bold text-red-600">R$ {composicao.imposto_valor.toFixed(2)}</p>
            </div>
            <div className="text-center p-2 bg-white rounded">
              <p className="text-xs text-muted-foreground">Margem Líquida</p>
              <p className={`font-bold ${composicao.margem_liquida >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {composicao.margem_liquida.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === 4 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
              <FileCheck className="w-4 h-4" />
              Integração OS → Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-3">
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Receber: R$ {dados.valorCliente.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Criado automaticamente em financeiro_receber</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Pagar Prestador: R$ {dados.custoPrestador.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Criado automaticamente em financeiro_pagar</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Composição Financeira</p>
                <p className="text-xs text-muted-foreground">Registrada para controle de margem</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card className="bg-slate-50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-green-500" />
              Validação de Documentos (IA)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 text-sm text-muted-foreground">
            <p>Serviço de análise de documentos via IA:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• CNH e CRLV - Validação de dados</li>
              <li>• Comprovantes - Verificação bancária</li>
              <li>• ANTT/RNTRC - Validação de registro</li>
            </ul>
            <p className="mt-2 text-xs italic">Disponível na tela de prestação de documentos</p>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              Cálculo de Rotas
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 text-sm text-muted-foreground">
            <p>Automático ao inserir endereços:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• Distância em km</li>
              <li>• Tempo estimado</li>
              <li>• Valor por km</li>
            </ul>
            <p className="mt-2 text-xs italic">Acionado automaticamente na OS</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}