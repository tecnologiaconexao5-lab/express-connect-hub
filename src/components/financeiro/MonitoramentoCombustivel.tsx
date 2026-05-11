import { useState, useEffect } from "react";
import { Fuel, TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, AlertTriangle, RefreshCw, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { combustivelService } from "@/services/combustivelService";
import { CombustivelTipo, MonitoramentoCombustivel } from "@/types/combustivel";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";

const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const MonitoramentoCombustivelCard = () => {
  const [tipo, setTipo] = useState<CombustivelTipo>('diesel');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dados, setDados] = useState<MonitoramentoCombustivel>({
    combustivel_tipo: 'diesel',
    preco_base: 5.85,
    preco_atual: 5.85,
    variacao_percentual: 0,
    data_consulta: new Date().toISOString(),
    fonte: 'ANP',
    percentual_sugerido_reajuste: 0,
    aplicar_somente_no_componente_veiculo: true
  });

  const consultarPreco = async () => {
    setLoading(true);
    try {
      const result = await combustivelService.buscarPrecoCombustivelAtual(tipo);
      const variacao = combustivelService.calcularVariacaoCombustivel(dados.preco_base, result.preco);
      const sugestao = combustivelService.calcularSugestaoReajusteVeiculo(variacao);
      
      setDados(prev => ({
        ...prev,
        preco_atual: result.preco,
        fonte: result.fonte,
        variacao_percentual: variacao,
        percentual_sugerido_reajuste: sugestao,
        data_consulta: new Date().toISOString()
      }));

      console.log(`[COMBUSTIVEL] Preço base: R$ ${dados.preco_base.toFixed(2)}`);
      console.log(`[COMBUSTIVEL] Preço atual: R$ ${result.preco.toFixed(2)}`);
      console.log(`[COMBUSTIVEL] Variação: ${variacao.toFixed(2)}%`);
      console.log(`[COMBUSTIVEL] Sugestão calculada: ${sugestao.toFixed(2)}%`);

      toast.success("Consulta realizada com sucesso!");
    } catch (error) {
      toast.error("Erro ao consultar preço atual. Permitindo preenchimento manual.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    consultarPreco();
  }, [tipo]);

  const handleManualPriceChange = (val: string) => {
    const preco = parseFloat(val.replace(',', '.'));
    if (isNaN(preco)) return;

    const variacao = combustivelService.calcularVariacaoCombustivel(dados.preco_base, preco);
    const sugestao = combustivelService.calcularSugestaoReajusteVeiculo(variacao);

    setDados(prev => ({
      ...prev,
      preco_atual: preco,
      variacao_percentual: variacao,
      percentual_sugerido_reajuste: sugestao,
      fonte: 'Manual'
    }));
  };

  const aplicarSugestao = async () => {
    setLoading(true);
    try {
      await combustivelService.aplicarReajuste(tipo, dados.percentual_sugerido_reajuste);
      console.log(`[COMBUSTIVEL] Usuário aplicou sugestão`);
      toast.success("Sugestão de reajuste aplicada com sucesso!");
      setShowConfirm(false);
      // Resetar base para o novo atual para futuras consultas? 
      // Por enquanto manter conforme regra de não alterar automático.
    } catch (error) {
      toast.error("Erro ao aplicar reajuste.");
    } finally {
      setLoading(false);
    }
  };

  const ignorarSugestao = () => {
    toast.info("Sugestão ignorada.");
    setDados(prev => ({
      ...prev,
      percentual_sugerido_reajuste: 0,
      variacao_percentual: 0,
      preco_base: prev.preco_atual // Assume o atual como nova base se ignorado?
    }));
  };

  const isUp = dados.variacao_percentual > 0.1; // threshold de 0.1%
  const isDown = dados.variacao_percentual < -0.1;

  return (
    <Card className="border-amber-200 bg-amber-50/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Monitoramento de Combustível</CardTitle>
              <CardDescription>Sugestão de reajuste baseada na variação de mercado</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-white border-amber-200 text-amber-700 gap-1.5 py-1 px-3">
            <Clock className="w-3.5 h-3.5" />
            Última consulta: {new Date(dados.data_consulta).toLocaleTimeString()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Coluna 1: Tipo e Base */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Tipo de Combustível</Label>
              <Select value={tipo} onValueChange={(v: CombustivelTipo) => setTipo(v)}>
                <SelectTrigger className="bg-white border-amber-100">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diesel">Diesel S10</SelectItem>
                  <SelectItem value="gasolina">Gasolina Comum</SelectItem>
                  <SelectItem value="etanol">Etanol</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Preço Base (Tabela)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={dados.preco_base} 
                onChange={(e) => setDados({...dados, preco_base: parseFloat(e.target.value)})}
                className="bg-white border-amber-100 font-bold"
              />
            </div>
          </div>

          {/* Coluna 2: Preço Atual e Fonte */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-500">Preço Atual (Mercado)</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  step="0.01" 
                  value={dados.preco_atual} 
                  onChange={(e) => handleManualPriceChange(e.target.value)}
                  className={`bg-white border-amber-100 font-black text-lg h-10 ${loading ? 'opacity-50' : ''}`}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1 h-8 w-8 text-amber-600 hover:bg-amber-100"
                  onClick={consultarPreco}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Fonte de Dados</Label>
              <p className="text-xs font-medium text-slate-600 truncate">{dados.fonte}</p>
            </div>
          </div>

          {/* Coluna 3: Variação */}
          <div className="flex flex-col justify-center items-center p-4 bg-white rounded-xl border border-amber-100 shadow-inner">
            <Label className="text-xs font-bold uppercase text-slate-500 mb-2">Variação Percentual</Label>
            <div className={`flex items-center gap-2 text-2xl font-black ${isUp ? 'text-red-600' : isDown ? 'text-green-600' : 'text-slate-400'}`}>
              {isUp && <TrendingUp className="w-6 h-6" />}
              {isDown && <TrendingDown className="w-6 h-6" />}
              {!isUp && !isDown && <Minus className="w-6 h-6" />}
              {dados.variacao_percentual > 0 ? '+' : ''}{dados.variacao_percentual.toFixed(2)}%
            </div>
            {isUp && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase">Alta Detectada</p>}
          </div>

          {/* Coluna 4: Sugestão e Ações */}
          <div className="flex flex-col justify-between">
            <div className="p-3 bg-slate-900 rounded-xl text-white">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Sugestão de Reajuste</p>
              <p className="text-xl font-black text-amber-400">
                {dados.percentual_sugerido_reajuste > 0 ? '+' : ''}{dados.percentual_sugerido_reajuste.toFixed(2)}%
              </p>
              <p className="text-[9px] text-slate-400 mt-1 leading-tight">
                Aplicar somente no componente <span className="text-amber-200">veículo/frete</span>.
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button 
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                onClick={() => setShowConfirm(true)}
                disabled={dados.percentual_sugerido_reajuste === 0}
              >
                Aplicar Sugestão
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 text-xs border-slate-200"
                onClick={ignorarSugestao}
              >
                Ignorar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar Aplicação de Reajuste
            </DialogTitle>
            <DialogDescription className="pt-2">
              O sistema identificou uma variação de <strong>{dados.variacao_percentual.toFixed(2)}%</strong> no preço do {tipo}.
              <br/><br/>
              Deseja aplicar o reajuste de <strong>{dados.percentual_sugerido_reajuste.toFixed(2)}%</strong> somente sobre o componente <strong>veículo/frete</strong>?
              <br/><br/>
              <span className="text-xs text-muted-foreground italic">
                * Taxas administrativas, pedágio, ajudantes e impostos permanecerão inalterados.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex sm:justify-between gap-2 pt-4">
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>Cancelar</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white font-bold" onClick={aplicarSugestao}>
              Sim, Aplicar Reajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
