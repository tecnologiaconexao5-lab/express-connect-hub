import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Save, FileDown, Plus, Trash2, MapPin, Package, Truck, DollarSign, Clock, Lightbulb, Check, Copy, Route } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Orcamento, EnderecoOrcamento, STATUS_CONFIG, OrcamentoStatus, DistanciaRota } from "./types";
import { gerarPdfOrcamento } from "./orcamentoPdf";
import { generateProfessionalPDF } from "@/lib/pdfGenerator";
import { FavoritosDropdown, SaveFavoritoButton } from "@/components/enderecos/EnderecosFavoritos";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { EnderecoCompleto, EnderecoType } from "@/components/ui/EnderecoCompleto";
import { toast } from "sonner";
import { TIPOS_VEICULO } from "@/constants/tiposVeiculo";
import { calcularDistancia, type DistanceResult } from "@/services/maps";
import { supabase } from "@/lib/supabase";
import { calcularValorPorDistancia, ResultadoCalculo } from "@/services/financeiro/calculoService";

const gerarNumeroOrcamento = () => {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `ORC-${ano}${mes}-${seq}`;
};

interface TabelaValorRow {
  id?: string;
  nome?: string;
  tipo_veiculo?: string;
  valor_base?: number;
  valor_km?: number;
  valor_km_excedente?: number;
  valor_minimo?: number;
  franquia_km?: number;
  percentual_prestador?: number;
  pedagio_incluso?: boolean;
  ativo?: boolean;
  universal?: boolean;
  cliente?: string;
}

const buscarTabelaValores = async (cliente: string, tipoVeiculo: string, km: number): Promise<TabelaValorRow | null> => {
  try {
    const tipoNorm = tipoVeiculo?.toLowerCase().trim() || "";

    let { data: clienteTabela, error } = await supabase
      .from("tabelas_valores")
      .select("id, nome, tipo_veiculo, valor_base, valor_km, valor_km_excedente, valor_minimo, franquia_km, percentual_prestador, pedagio_incluso, ativo, universal, cliente, cobranca_principais")
      .ilike("tipo_veiculo", tipoNorm)
      .eq("ativo", true)
      .limit(20);

    if (error) {
      console.error("[OrcamentoForm] Erro busca tabela:", error);
      return null;
    }

    if (!clienteTabela || clienteTabela.length === 0) {
      console.warn("[OrcamentoForm] Nenhuma tabela ativa para veiculo:", tipoVeiculo);
      return null;
    }

    const tabelaCliente = clienteTabela.find(t =>
      t.cliente && t.cliente.toLowerCase().includes(cliente?.toLowerCase() || "")
    );
    if (tabelaCliente) return tabelaCliente as unknown as TabelaValorRow;

    const tabelaUniversal = clienteTabela.find(t => t.universal === true);
    if (tabelaUniversal) return tabelaUniversal as unknown as TabelaValorRow;

    return clienteTabela[0] as unknown as TabelaValorRow;
  } catch (e) {
    console.error("[OrcamentoForm] Erro geral buscarTabela:", e);
    return null;
  }
};

const calcularValorAutomatico = (tabela: TabelaValorRow | null, distanciaKm: number, pedagio: number = 0): { valor: number; valorPrestador: number; tabelaNome: string; pendente: boolean; descricao: string; kmExcedente: number; valorKmExcedente: number; percentualPrestador: number } => {
  if (!tabela) {
    return { valor: 0, valorPrestador: 0, tabelaNome: "", pendente: true, descricao: "", kmExcedente: 0, valorKmExcedente: 0, percentualPrestador: 80 };
  }

  const valorBase = Number(tabela.valor_base) || 0;
  const franquiaKm = Number(tabela.franquia_km) || 0;
  const valorKmExcedente = Number(tabela.valor_km_excedente) || Number(tabela.valor_km) || 0;
  const valorMinimo = Number(tabela.valor_minimo) || 0;
  const percentualPrestador = Number(tabela.percentual_prestador) || 80;

  const kmExcedente = Math.max(0, distanciaKm - franquiaKm);
  let valorCalculado = valorBase + (kmExcedente * valorKmExcedente);
  valorCalculado = Math.max(valorCalculado, valorMinimo || valorBase);
  const valorComPedagio = valorCalculado + pedagio;
  
  const valorPrestador = valorComPedagio * (percentualPrestador / 100);
  
  const descricao = `Base R$${valorBase.toFixed(2)} (até ${franquiaKm}km) + ${kmExcedente.toFixed(1)}km exced x R$${valorKmExcedente.toFixed(2)} + pedagio R$${pedagio.toFixed(2)} = R$${valorComPedagio.toFixed(2)} | Prest: ${percentualPrestador}% = R$${valorPrestador.toFixed(2)}`;

  return {
    valor: Math.round(valorComPedagio * 100) / 100,
    valorPrestador: Math.round(valorPrestador * 100) / 100,
    tabelaNome: tabela.nome || "Universal",
    pendente: false,
    descricao,
    kmExcedente,
    valorKmExcedente,
    percentualPrestador
  };
};

interface SugestaoVeiculo {
  tipo: string;
  motivo: string;
}

const sugerirVeiculo = (peso: number, cubagem: number, refrigerado: boolean): SugestaoVeiculo | null => {
  if (refrigerado) {
    if (peso > 6000) {
      return { tipo: 'van', motivo: 'Carga refrigerada acima de 6t requer van ou veÃ­culo refrigerado dedicado' };
    }
    return { tipo: 'van', motivo: 'Carga refrigerada leve/mÃ©dia indica van refrigerada' };
  }
  
  if (peso > 20000) {
    return { tipo: 'carreta', motivo: 'Acima de 20t requer carreta para transporte adequado' };
  }
  if (peso > 15000) {
    return { tipo: 'bitrem', motivo: 'Carga de 15-20t adequada para bitrem' };
  }
  if (peso > 10000) {
    return { tipo: 'truck', motivo: 'Carga de 10-15t indica truck como opção econômica' };
  }
  if (peso > 8000) {
    return { tipo: 'toco', motivo: 'Carga de 8-10t adequada para toco com carroceria' };
  }
  if (peso > 4000) {
    return { tipo: 'vuc', motivo: 'Carga de 4-8t indica VUC (Veículo Urbano de Carga)' };
  }
  if (peso > 1500) {
    return { tipo: 'van', motivo: 'Carga de 1.5-4t adequada para van ou Fiorino grande' };
  }
  if (peso > 600) {
    return { tipo: 'hr', motivo: 'Carga de 600kg-1.5t indica HR (utilitÃ¡rio médio)' };
  }
  if (peso > 200) {
    return { tipo: 'fiorino', motivo: 'Carga de 200-600kg adequada para Fiorino' };
  }
  return { tipo: 'moto', motivo: 'Carga leve atÃ© 200kg pode ser transportada por moto' };
};

interface Props {
  orcamento?: Orcamento;
  modo: "ver" | "editar" | "novo";
  onVoltar: () => void;
  onSalvar: (orc: Orcamento) => void;
}

const emptyEndereco = (): EnderecoOrcamento => ({ tipo: "coleta", sequencia: 1, endereco: "", cidade: "", uf: "", cep: "", contato: "", telefone: "", instrucoes: "", janelaInicio: "", janelaFim: "" });

const emptyOrcamento = (): Orcamento => ({
  id: String(Date.now()), numero: gerarNumeroOrcamento(),
  cliente: "", clienteCnpj: "", unidade: "São Paulo - Matriz", centroCusto: "", responsavel: "",
  dataEmissao: new Date().toISOString().split("T")[0], validade: "", tipoOperacao: "", modalidade: "contrato",
  prioridade: "normal", pedidoInterno: "", observacoesGerais: "", status: "rascunho",
  enderecos: [emptyEndereco()],
  carga: { descricao: "", volumes: 0, peso: 0, cubagem: 0, pallets: 0, valorDeclarado: 0, refrigerado: false, ajudante: false, observacoes: "" },
  veiculo: { tipo: "", subcategoria: "", carroceria: "" },
  valores: { tabelaVinculada: "", valorBase: 0, adicionais: 0, pedagio: 0, kmExcedente: 0, ajudante: 0, adValorem: 0, gris: 0, devolucao: 0, reentrega: 0, descontos: 0, valorFinal: 0, custoEstimado: 0, margemEstimada: 0, lucroEstimado: 0 },
  historico: [{ data: new Date().toLocaleString("pt-BR"), acao: "Orçamento criado", usuario: "Usuário atual" }],
});

const Field = ({ label, children, className = "" }: { label: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <div className={className}>
    <Label className="text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between pr-1">{label}</Label>
    {children}
  </div>
);

const OrcamentoForm = ({ orcamento, modo, onVoltar, onSalvar }: Props) => {
  const [data, setData] = useState<Orcamento>(orcamento ? JSON.parse(JSON.stringify(orcamento)) : emptyOrcamento());
  const [sugestaoVeiculo, setSugestaoVeiculo] = useState<SugestaoVeiculo | null>(null);
  const [distanciaRota, setDistanciaRota] = useState<DistanceResult | null>(null);
  const [calculandoDistancia, setCalculandoDistancia] = useState(false);
  const readOnly = modo === "ver";

  // useEffect para buscar distância quando endereços mudam
  useEffect(() => {
    const calcularDistanciaAuto = async () => {
      const enderecos = data.enderecos || [];
      const cols = enderecos.filter(e => e.tipo === "coleta" && e.endereco?.trim());
      const ents = enderecos.filter(e => e.tipo === "entrega" && e.endereco?.trim());

      if (cols.length === 0 || ents.length === 0) return;

      const origem = cols[0].endereco;
      const destino = ents[ents.length - 1].endereco;
      if (!origem || !destino) return;
      if (origem.includes("undefined") || destino.includes("undefined")) return;

      console.log("[OrcamentoForm] Calculando distância...");
      console.log("[OrcamentoForm] VEÍCULO:", data.veiculo.tipo);
      console.log("[OrcamentoForm] CLIENTE:", data.cliente);
      console.log("[OrcamentoForm] ORIGEM:", origem);
      console.log("[OrcamentoForm] DESTINO:", destino);

      setCalculandoDistancia(true);
      try {
        const resultado = await calcularDistancia(origem, destino);
        console.log("[OrcamentoForm] RESULTADO MAPBOX:", resultado);

        if (resultado) {
          setDistanciaRota(resultado);
          setData((prev) => ({
            ...prev,
            distancia_rota: {
              distancia_km: resultado.distanciaKm,
              duracao_min: resultado.duracaoMin,
              distancia_texto: resultado.distanciaTexto,
              duracao_texto: resultado.duracaoTexto,
              maps_provider: "mapbox",
            },
          }));
        }
      } catch (e) {
        console.error("[OrcamentoForm] Erro ao calcular distancia:", e);
      } finally {
        setCalculandoDistancia(false);
      }
    };

    const timerId = setTimeout(calcularDistanciaAuto, 1000);
    return () => clearTimeout(timerId);
  }, [data.enderecos]);

  // useEffect para buscar tabela e calcular valor quando distância muda
  useEffect(() => {
    const calcularValorAuto = async () => {
      if (!data.distancia_rota?.distancia_km || !data.distancia_rota.distancia_km > 0) return;
      if (!data.veiculo.tipo) return;

      const km = data.distancia_rota.distancia_km;
      console.log("[OrcamentoForm] DISTÂNCIA CALCULADA:", km, "km");

      const tabela = await buscarTabelaValores(data.cliente, data.veiculo.tipo, Math.ceil(km));
      console.log("[OrcamentoForm] TABELA ENCONTRADA:", tabela);

      if (tabela) {
        const { valor, valorPrestador, tabelaNome, descricao } = calcularValorAutomatico(tabela, km, data.valores.pedagio || 0);
        setData((prev) => {
          const v = { ...prev.valores };
          v.tabelaVinculada = tabelaNome;
          v.valorBase = valor;
          v.custoEstimado = valorPrestador;
          v.valorFinal = valor + v.adicionais + v.kmExcedente + v.ajudante + v.devolucao + v.reentrega - v.descontos;
          v.lucroEstimado = v.valorFinal - v.custoEstimado;
          v.margemEstimada = v.valorFinal > 0 ? Math.round((v.lucroEstimado / v.valorFinal) * 1000) / 10 : 0;
          return { ...prev, valores: v };
        });
      } else {
        // Fallback para tabela teste local
        const resultado = calcularValorPorDistancia({
          distanciaKm: km,
          tipoVeiculo: data.veiculo.tipo,
          usarTabelaTeste: true
        });

        if (resultado.valorCliente > 0) {
          toast.info("Nenhuma tabela ativa encontrada. Usando tabela teste local para simulação.");
          setData((prev) => {
            const v = { ...prev.valores };
            v.tabelaVinculada = resultado.tabelaAplicada;
            v.valorBase = resultado.valorCliente;
            v.custoEstimado = resultado.valorPrestador;
            v.kmExcedente = resultado.kmExcedente;
            v.valorFinal = resultado.valorCliente + v.adicionais + v.pedagio + v.ajudante + v.devolucao + v.reentrega - v.descontos;
            v.lucroEstimado = v.valorFinal - v.custoEstimado;
            v.margemEstimada = v.valorFinal > 0 ? Math.round((v.lucroEstimado / v.valorFinal) * 1000) / 10 : 0;
            return { ...prev, valores: v, faixa_aplicada: resultado.faixaAplicada };
          });
        } else {
          console.warn("[OrcamentoForm] Nenhuma tabela ativa encontrada para este veículo.");
          toast.warning("Nenhuma tabela ativa encontrada para este veículo e distância.");
        }
      }
    };

    const timerId = setTimeout(calcularValorAuto, 500);
    return () => clearTimeout(timerId);
  }, [data.distancia_rota?.distancia_km, data.veiculo.tipo, data.cliente]);

  const update = (path: string, value: any) => {
    setData((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = clone;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      
      if (path === 'carga.peso' || path === 'carga.cubagem' || path === 'carga.refrigerado') {
        const novoPeso = path === 'carga.peso' ? value : clone.carga.peso;
        const novaCubagem = path === 'carga.cubagem' ? value : clone.carga.cubagem;
        const refrigerado = path === 'carga.refrigerado' ? value : clone.carga.refrigerado;
        const sugestao = sugerirVeiculo(novoPeso || 0, novaCubagem || 0, refrigerado || false);
        setSugestaoVeiculo(sugestao);
      }
      
      return clone;
    });
  };
  
  const aplicarSugestaoVeiculo = () => {
    if (sugestaoVeiculo) {
      update("veiculo.tipo", sugestaoVeiculo.tipo);
      toast.success(`Veículo ${sugestaoVeiculo.tipo} aplicado!`);
      setSugestaoVeiculo(null);
    }
  };

const recalcular = () => {
    setData((prev) => {
      const v = { ...prev.valores };
      if (prev.carga && prev.carga.valorDeclarado > 0) { if (prev.cliente === 'Amazon Logística' || prev.cliente === 'Industrias ABC') { v.adValorem = 0; v.gris = 0; } else { v.adValorem = prev.carga.valorDeclarado * 0.003; v.gris = prev.carga.valorDeclarado * 0.0015; } }
v.valorFinal = v.valorBase + v.adicionais + v.pedagio + v.kmExcedente + v.ajudante + v.devolucao + v.reentrega + (v.adValorem || 0) + (v.gris || 0) - v.descontos;
      v.lucroEstimado = v.valorFinal - v.custoEstimado;
      v.margemEstimada = v.valorFinal > 0 ? Math.round((v.lucroEstimado / v.valorFinal) * 1000) / 10 : 0;
      return { ...prev, valores: v };
    });
  };

  const calcularDistanciaRota = useCallback(async () => {
    const cols = data.enderecos.filter(e => e.tipo === "coleta");
    const ents = data.enderecos.filter(e => e.tipo === "entrega");
    if (cols.length === 0 || ents.length === 0) return;
    const origem = cols[0].endereco;
    const destino = ents[ents.length - 1].endereco;
    if (!origem || !destino) return;
    setCalculandoDistancia(true);
    try {
      const result = await calcularDistancia(origem, destino);
      if (result) {
        setDistanciaRota(result);
        setData((prev) => ({
          ...prev,
          distancia_rota: {
            distancia_km: result.distanciaKm,
            duracao_min: result.duracaoMin,
            distancia_texto: result.distanciaTexto,
            duracao_texto: result.duracaoTexto,
            maps_provider: result.provider,
          },
        }));
      }
    } catch (err) {
      console.error("[OrcamentoForm] Erro ao calcular distancia:", err);
      setDistanciaRota(null);
    } finally {
      setCalculandoDistancia(false);
    }
}, [data.enderecos]);

  // ============================================================
  // Regra de sugestão de frete por km (provisória - parametrizar futuramente)
  // ============================================================
  const FRETE_BASE_SUGESTAO = 100; // valor base mínimo
  const FRETE_POR_KM = 2.5; // valor por km rodado

  const sugerirFretePorDistancia = (distanciaKm: number): number | null => {
    if (!distanciaKm || distanciaKm <= 0) return null;
    const sugestao = FRETE_BASE_SUGESTAO + (distanciaKm * FRETE_POR_KM);
    return Math.round(sugestao * 100) / 100;
  };

  const addEndereco = () => {
    const novoTipo = data.enderecos.length === 0 ? "coleta" : "entrega";
    setData((prev) => ({ ...prev, enderecos: [...prev.enderecos, { ...emptyEndereco(), sequencia: prev.enderecos.length + 1, tipo: novoTipo }] }));
  };

  const removeEndereco = (idx: number) => {
    setData((prev) => ({ ...prev, enderecos: prev.enderecos.filter((_, i) => i !== idx).map((e, i) => ({ ...e, sequencia: i + 1 })) }));
  };

  const sanitizeOrcamentoPayload = (rawPayload: Record<string, any>): { payload: Record<string, any>; removed: string[] } => {
    const payloadSeguro: Record<string, any> = {
      numero: rawPayload.numero,
      data_emissao: rawPayload.data_emissao,
      cliente: rawPayload.cliente,
      cliente_id: rawPayload.cliente_id,
      status: rawPayload.status,
      valor_cliente: rawPayload.valor_cliente,
      custo_prestador: rawPayload.custo_prestador,
      distancia_km: rawPayload.distancia_km,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const allKeys = Object.keys(rawPayload);
    const usedKeys = Object.keys(payloadSeguro);
    const removed = allKeys.filter(k => !usedKeys.includes(k));

    console.log("[ORC SAVE] Payload original:", rawPayload);
    console.log("[ORC SAVE] Payload final enviado:", payloadSeguro);
    console.log("[ORC SAVE] Campos removidos:", removed);

    return { payload: payloadSeguro, removed };
  };

  const gerarOS = async () => {
    try {
      const rawPayload = {
        numero: `OS-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(Math.random()*9000)+1000}`,
        data_emissao: new Date().toISOString().split('T')[0],
        cliente: data.cliente,
        cliente_id: data.clienteId,
        status: "rascunho",
        valor_cliente: data.valor_cliente,
        custo_prestador: data.custo_prestador,
        distancia_km: data.distancia_rota?.distancia_km || 0,
        veiculo_tipo: data.veiculo_tipo,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { payload, removed } = sanitizeOrcamentoPayload(rawPayload);
      
      const { data: osResult, error } = await supabase.from("ordens_servico").insert([payload]).select().single();
      
      if (error) {
        console.error("[gerarOS] Erro ao criar OS:", error);
        toast.error("Erro ao gerar OS: " + error.message);
        return;
      }
      
      for (const end of data.enderecos) {
        const { logradouro, numero } = (() => {
          const match = end.logradouro?.match(/^(.+?),\s*(\d+)\s*[-–]?\s*$/);
          return match ? { logradouro: match[1].trim(), numero: match[2].trim() } : { logradouro: end.logradouro, numero: end.numero };
        })();
        
        const enderecoFormatado = `${logradouro || ''}${numero ? ', ' + numero : ''} - ${end.bairro || ''}, ${end.cidade || ''}/${end.estado || ''}`.replace(/^ - |\/$/g, "");
        
        await supabase.from("os_enderecos").insert([{
          os_id: osResult.id,
          sequencia: end.sequencia,
          tipo: end.tipo,
          nome_local: end.nome_local,
          logradouro: logradouro,
          numero: numero,
          bairro: end.bairro,
          cidade: end.cidade,
          estado: end.estado,
          endereco: enderecoFormatado
        }]);
      }
      
      toast.success("Ordem de Serviço criada com sucesso!");
    } catch (e: any) {
      console.error("[gerarOS] Erro catch:", e);
      toast.error("Erro ao gerar OS: " + e.message);
    }
  };

  const handleSalvar = () => {
    if (data.distancia_rota && data.distancia_rota.distancia_km > 0) {
      const sugestaoFrete = sugerirFretePorDistancia(data.distancia_rota.distancia_km);
      if (sugestaoFrete !== null) {
        setData((prev) => ({
          ...prev,
          distancia_rota: prev.distancia_rota,
          frete_sugerido: {
            valor_base: FRETE_BASE_SUGESTAO,
            valor_por_km: FRETE_POR_KM,
            sugestao: sugestaoFrete,
            distancia_km: data.distancia_rota.distancia_km,
          },
        }));
      }
    }
    recalcular();
    onSalvar(data);
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });



  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onVoltar}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{data.numero}</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CONFIG[data.status].color}`}>
                {STATUS_CONFIG[data.status].label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{modo === "novo" ? "Novo orçamento" : data.cliente || "—"}</p>
          </div>
        </div>
<div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => gerarPdfOrcamento(data)}><FileDown className="w-4 h-4 mr-1" /> Gerar PDF</Button>
          <Button variant="outline" size="sm" disabled>Gerar Contrato</Button>
          {data.status === "aprovado" && <Button variant="default" size="sm" onClick={() => gerarOS()}>Converter em OS</Button>}
          {!readOnly && <Button size="sm" className="bg-primary text-primary-foreground" onClick={handleSalvar}><Save className="w-4 h-4 mr-1" /> Salvar</Button>}
        </div>
      </div>

      <Tabs defaultValue="identificacao" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1">
          <TabsTrigger value="identificacao" className="text-xs"><Clock className="w-3 h-3 mr-1" />Identificação</TabsTrigger>
          <TabsTrigger value="carga" className="text-xs"><Package className="w-3 h-3 mr-1" />Carga</TabsTrigger>
          <TabsTrigger value="veiculo" className="text-xs"><Truck className="w-3 h-3 mr-1" />Veículo</TabsTrigger>
          <TabsTrigger value="enderecos" className="text-xs"><MapPin className="w-3 h-3 mr-1" />Endereços</TabsTrigger>
          <TabsTrigger value="valores" className="text-xs"><DollarSign className="w-3 h-3 mr-1" />Valores</TabsTrigger>
          <TabsTrigger value="documentos" className="text-xs"><FileDown className="w-3 h-3 mr-1" />Docs e PDF</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs"><Clock className="w-3 h-3 mr-1" />Histórico</TabsTrigger>
        </TabsList>

        {/* IDENTIFICAÇÃO */}
        <TabsContent value="identificacao">
          <Card>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Número"><Input value={data.numero} readOnly className="bg-muted" /></Field>
              <Field label="Cliente">
                 {readOnly ? <Input value={data.cliente} readOnly /> : (
                   <SearchableSelect 
                     table="clientes" 
                     labelField="nome_fantasia" 
                     valueField="nome_fantasia" 
                     searchFields={["nome_fantasia", "razao_social", "cnpj"]} 
                     value={data.cliente} 
                     onChange={(v, rec) => {
                        update("cliente", v || "");
                        if (rec && rec.cnpj) update("clienteCnpj", rec.cnpj);
                        if (rec && rec.condicao_comercial_tabela_id) {
                           setData(p => ({ ...p, valores: { ...p.valores, tabelaVinculada: String(rec.condicao_comercial_tabela_id) }}));
                           toast.success("Tabela de Valores vinculada carregada automaticamente!");
                        }
                     }} 
                   />
                 )}
              </Field>
              <Field label="CNPJ do Cliente"><Input value={data.clienteCnpj} readOnly={readOnly} onChange={(e) => update("clienteCnpj", e.target.value)} /></Field>
              <Field label="Unidade">
                <Select value={data.unidade} onValueChange={(v) => update("unidade", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="São Paulo - Matriz">São Paulo - Matriz</SelectItem>
                    <SelectItem value="Rio de Janeiro">Rio de Janeiro</SelectItem>
                    <SelectItem value="Porto Alegre">Porto Alegre</SelectItem>
                    <SelectItem value="Belo Horizonte">Belo Horizonte</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Centro de Custo"><Input value={data.centroCusto} readOnly={readOnly} onChange={(e) => update("centroCusto", e.target.value)} /></Field>
              <Field label="Responsável"><Input value={data.responsavel} readOnly={readOnly} onChange={(e) => update("responsavel", e.target.value)} /></Field>
              <Field label="Data de Emissão"><Input type="date" value={data.dataEmissao} readOnly={readOnly} onChange={(e) => update("dataEmissao", e.target.value)} /></Field>
              <Field label="Validade"><Input type="date" value={data.validade} readOnly={readOnly} onChange={(e) => update("validade", e.target.value)} /></Field>
              <Field label="Tipo de Operação">
                <Select value={data.tipoOperacao} onValueChange={(v) => update("tipoOperacao", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Distribuição">Distribuição</SelectItem>
                    <SelectItem value="TransferÃªncia">TransferÃªncia</SelectItem>
                    <SelectItem value="Coleta e Entrega">Coleta e Entrega</SelectItem>
                    <SelectItem value="Dedicado">Dedicado</SelectItem>
                    <SelectItem value="Last Mile">Last Mile</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Modalidade">
                <Select value={data.modalidade} onValueChange={(v) => update("modalidade", v as any)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="esporadico">EsporÃ¡dico</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prioridade">
                <Select value={data.prioridade} onValueChange={(v) => update("prioridade", v as any)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="programada">Programada</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={data.status} onValueChange={(v) => {
                  update("status", v);
                  setData((prev) => ({ ...prev, status: v as OrcamentoStatus, historico: [...prev.historico, { data: new Date().toLocaleString("pt-BR"), acao: `Status alterado para ${STATUS_CONFIG[v as OrcamentoStatus].label}`, usuario: "Usuário atual" }] }));
                }} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Pedido Interno"><Input value={data.pedidoInterno} readOnly={readOnly} onChange={(e) => update("pedidoInterno", e.target.value)} /></Field>
              <Field label="Observações Gerais" className="md:col-span-2 lg:col-span-3">
                <Textarea value={data.observacoesGerais} readOnly={readOnly} onChange={(e) => update("observacoesGerais", e.target.value)} rows={3} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENDEREÇOS */}
        <TabsContent value="enderecos">
          <div className="space-y-4">
            {data.enderecos.map((end, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      Ponto {end.sequencia} â€” {end.tipo === "coleta" ? "Coleta" : end.tipo === "entrega" ? "Entrega" : "Retorno"}
                    </CardTitle>
                    <div className="flex gap-2">
                       {!readOnly && <SaveFavoritoButton endereco={end} />}
                       {!readOnly && data.enderecos.length > 1 && (
                         <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeEndereco(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
                       )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Field label="Tipo">
                      <Select value={end.tipo} onValueChange={(v) => { const e = [...data.enderecos]; e[idx] = { ...e[idx], tipo: v as any }; setData((p) => ({ ...p, enderecos: e })); }} disabled={readOnly}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coleta">Coleta</SelectItem>
                          <SelectItem value="entrega">Entrega</SelectItem>
                          <SelectItem value="retorno">Retorno</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Contato"><Input value={end.contato} readOnly={readOnly} onChange={(e) => { const es = [...data.enderecos]; es[idx] = { ...es[idx], contato: e.target.value }; setData((p) => ({ ...p, enderecos: es })); }} /></Field>
                    <Field label="Telefone"><Input value={end.telefone} readOnly={readOnly} onChange={(e) => { const es = [...data.enderecos]; es[idx] = { ...es[idx], telefone: e.target.value }; setData((p) => ({ ...p, enderecos: es })); }} /></Field>
                    <Field label="Janela Início"><Input type="time" value={end.janelaInicio} readOnly={readOnly} onChange={(e) => { const es = [...data.enderecos]; es[idx] = { ...es[idx], janelaInicio: e.target.value }; setData((p) => ({ ...p, enderecos: es })); }} /></Field>
                    <Field label="Janela Fim"><Input type="time" value={end.janelaFim} readOnly={readOnly} onChange={(e) => { const es = [...data.enderecos]; es[idx] = { ...es[idx], janelaFim: e.target.value }; setData((p) => ({ ...p, enderecos: es })); }} /></Field>
                  </div>

                  {readOnly ? (
                     <Field label="Endereço Cadastrado"><Input value={`${end.endereco}, ${end.cidade}/${end.uf} - ${end.cep}`} readOnly /></Field>
                  ) : (
<EnderecoCompleto
                         label="Dados do Endereço (ViaCEP)"
                         value={{ cep: end.cep || "", logradouro: end.logradouro || "", numero: end.numero || "", complemento: end.complemento || "", bairro: end.bairro || "", cidade: end.cidade || "", estado: end.uf || "", referencia: end.instrucoes || "" } as any}
                         onChange={(obj) => {
                            const { logradouro: log, numero: num } = (() => {
                              const match = obj.logradouro?.match(/^(.+?),\s*(\d+)\s*[-–]?\s*$/);
                              return match ? { logradouro: match[1].trim(), numero: match[2].trim() } : { logradouro: obj.logradouro, numero: obj.numero };
                            })();
                            const es = [...data.enderecos];
                            es[idx] = { 
                              ...es[idx], 
                              cep: obj.cep, 
                              logradouro: obj.logradouro || log,
                              numero: obj.numero || num,
                              complemento: obj.complemento,
                              bairro: obj.bairro || end.bairro || "",
                              cidade: obj.cidade || end.cidade || "",
                              uf: obj.estado || end.uf || "",
                              instrucoes: obj.referencia || "",
                              endereco: `${obj.logradouro || log}${obj.numero || num ? ', ' + (obj.numero || num) : ''} - ${obj.bairro || ''}, ${obj.cidade || ''}/${obj.estado || ''}`.replace(/^ - |\/$/g, "")
                            };
                            setData((p) => ({ ...p, enderecos: es }));
                         }}
                      />
                  )}
                  
                  <Field label="Instruções Específicas / Referência" className="lg:col-span-2">
                     <Input value={end.instrucoes} readOnly={readOnly} onChange={(e) => { const es = [...data.enderecos]; es[idx] = { ...es[idx], instrucoes: e.target.value }; setData((p) => ({ ...p, enderecos: es })); }} />
                  </Field>
                </CardContent>
              </Card>
            ))}
            {distanciaRota && (
              <Card className="mt-4 bg-blue-50 border-blue-200">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Route className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Distância Coleta → Última Entrega</p>
                        <p className="text-xs text-blue-600"> {distanciaRota.distanciaTexto} · {distanciaRota.duracaoTexto}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {!readOnly && (
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={addEndereco}><Plus className="w-4 h-4 mr-1" /> Adicionar Ponto</Button>
                {distanciaRota && (
                  <Button variant="ghost" size="sm" onClick={calcularDistanciaRota} disabled={calculandoDistancia}>
                    {calculandoDistancia ? "Calculando..." : "Atualizar Distância"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* CARGA */}
        <TabsContent value="carga">
          <Card>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Descrição da Carga" className="lg:col-span-2"><Input value={data.carga.descricao} readOnly={readOnly} onChange={(e) => update("carga.descricao", e.target.value)} /></Field>
              <Field label="Volumes"><Input type="number" value={data.carga.volumes || ""} readOnly={readOnly} onChange={(e) => update("carga.volumes", Number(e.target.value))} /></Field>
              <Field label="Peso (kg)"><Input type="number" value={data.carga.peso || ""} readOnly={readOnly} onChange={(e) => update("carga.peso", Number(e.target.value))} /></Field>
              <Field label="Cubagem (m³)"><Input type="number" value={data.carga.cubagem || ""} readOnly={readOnly} onChange={(e) => update("carga.cubagem", Number(e.target.value))} /></Field>
              <Field label="Pallets"><Input type="number" value={data.carga.pallets || ""} readOnly={readOnly} onChange={(e) => update("carga.pallets", Number(e.target.value))} /></Field>
              <Field label="Valor Declarado (R$)"><Input type="number" value={data.carga.valorDeclarado || ""} readOnly={readOnly} onChange={(e) => update("carga.valorDeclarado", Number(e.target.value))} /></Field>
              <div className="flex items-center gap-6 lg:col-span-1">
                <div className="flex items-center gap-2">
                  <Switch checked={data.carga.refrigerado} onCheckedChange={(v) => update("carga.refrigerado", v)} disabled={readOnly} />
                  <Label className="text-xs">Refrigerado</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={data.carga.ajudante} onCheckedChange={(v) => update("carga.ajudante", v)} disabled={readOnly} />
                  <Label className="text-xs">Ajudante</Label>
                </div>
              </div>
              <Field label="Observações da Carga" className="lg:col-span-4">
                <Textarea value={data.carga.observacoes} readOnly={readOnly} onChange={(e) => update("carga.observacoes", e.target.value)} rows={2} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VEÃCULO */}
        <TabsContent value="veiculo">
          {sugestaoVeiculo && !readOnly && (
            <Card className="mb-4 border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-800">Veículo sugerido pela IA: <span className="uppercase">{sugestaoVeiculo.tipo}</span></p>
                      <p className="text-sm text-blue-600">Motivo: {sugestaoVeiculo.motivo}</p>
                    </div>
                  </div>
                  <Button onClick={aplicarSugestaoVeiculo} className="bg-blue-600 hover:bg-blue-700 gap-2">
                    <Check className="w-4 h-4" /> Usar sugestão
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Tipo de Veículo">
                <Select value={data.veiculo.tipo} onValueChange={(v) => update("veiculo.tipo", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_VEICULO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Subcategoria">
                <Select value={data.veiculo.subcategoria} onValueChange={(v) => update("veiculo.subcategoria", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["urbano", "leve", "médio", "pesado", "dedicado", "refrigerado", "distribuiÃ§Ã£o", "transferÃªncia", "outro"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de Carroceria">
                <Select value={data.veiculo.carroceria} onValueChange={(v) => update("veiculo.carroceria", v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["baÃº", "baÃº refrigerado", "baÃº isotÃ©rmico", "sider", "grade baixa", "graneleira", "prancha", "plataforma", "carroceria aberta", "cegonha", "tanque", "container", "furgÃ£o", "refrigerada", "lonada", "outro"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VALORES */}
        <TabsContent value="valores">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Composição de Valores</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                <Field label="Tabela Vinculada"><Input value={data.valores.tabelaVinculada} readOnly={readOnly} onChange={(e) => update("valores.tabelaVinculada", e.target.value)} /></Field>
                <Field label="Valor Base (R$)"><Input type="number" value={data.valores.valorBase || ""} readOnly={readOnly} onChange={(e) => update("valores.valorBase", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Adicionais (R$)"><Input type="number" value={data.valores.adicionais || ""} readOnly={readOnly} onChange={(e) => update("valores.adicionais", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Pedágio (R$)"><Input type="number" value={data.valores.pedagio || ""} readOnly={readOnly} onChange={(e) => update("valores.pedagio", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Km Excedente (R$)"><Input type="number" value={data.valores.kmExcedente || ""} readOnly={readOnly} onChange={(e) => update("valores.kmExcedente", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Ajudante (R$)"><Input type="number" value={data.valores.ajudante || ""} readOnly={readOnly} onChange={(e) => update("valores.ajudante", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Devolução (R$)"><Input type="number" value={data.valores.devolucao || ""} readOnly={readOnly} onChange={(e) => update("valores.devolucao", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Reentrega (R$)"><Input type="number" value={data.valores.reentrega || ""} readOnly={readOnly} onChange={(e) => update("valores.reentrega", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Descontos (R$)"><Input type="number" value={data.valores.descontos || ""} readOnly={readOnly} onChange={(e) => update("valores.descontos", Number(e.target.value))} onBlur={recalcular} /></Field>
                <Field label="Custo Estimado (R$)"><Input type="number" value={data.valores.custoEstimado || ""} readOnly={readOnly} onChange={(e) => update("valores.custoEstimado", Number(e.target.value))} onBlur={recalcular} /></Field>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4"/> Resumo do Resultado</CardTitle></CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Distância</span><span className="font-bold">{data.distancia_rota?.distancia_texto || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tabela</span><span className="text-xs font-semibold">{data.valores.tabelaVinculada || "Nenhuma"}</span></div>
                  {(data as any).faixa_aplicada && <div className="flex justify-between"><span className="text-muted-foreground">Faixa</span><span className="text-xs">{ (data as any).faixa_aplicada }</span></div>}
                  <hr className="border-primary/10" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor Base Cliente</span><span>{fmt(data.valores.valorBase)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Adicionais</span><span>{fmt(data.valores.adicionais)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Pedágio</span><span>{fmt(data.valores.pedagio)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Km Excedente</span><span>{fmt(data.valores.kmExcedente)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Ajudante</span><span>{fmt(data.valores.ajudante)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Devolução</span><span>{fmt(data.valores.devolucao)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">+ Reentrega</span><span>{fmt(data.valores.reentrega)}</span></div>
                  <div className="flex justify-between text-destructive"><span>− Descontos</span><span>{fmt(data.valores.descontos)}</span></div>
                  <hr className="border-primary/20" />
                  <div className="flex justify-between text-lg font-bold text-primary"><span>Valor Final Cliente</span><span>{fmt(data.valores.valorFinal)}</span></div>
                </div>
                <div className="pt-2 border-t border-primary/20 space-y-1 text-sm bg-white/50 p-3 rounded-lg">
                  <div className="flex justify-between"><span className="text-muted-foreground">Custo Prestador</span><span className="font-bold text-orange-600">{fmt(data.valores.custoEstimado)}</span></div>
                  <div className="flex justify-between font-semibold text-green-600"><span>Lucro Estimado</span><span>{fmt(data.valores.lucroEstimado)}</span></div>
                  <div className="flex justify-between font-semibold"><span className="text-muted-foreground">Margem</span><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{data.valores.margemEstimada}%</Badge></div>
                </div>
                {!data.distancia_rota?.distancia_km && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-[10px] text-yellow-700">Preencha os endereços para calcular distância e valor automaticamente.</p>
                  </div>
                )}
                {readOnly ? null : (
                  <Button variant="outline" size="sm" className="w-full border-primary text-primary hover:bg-primary/5" onClick={calcularDistanciaRota} disabled={calculandoDistancia}>
                    {calculandoDistancia ? "Calculando..." : "Recalcular pela distância"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DOCUMENTOS E PDF */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-primary">Documentos Anexos e Geração de Proposta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center text-muted-foreground bg-muted/10">
                 <FileDown className="w-8 h-8 opacity-50 mb-2" />
                 <p className="text-sm font-medium">Nenhum anexo encontrado.</p>
                 <p className="text-xs">FaÃ§a upload de cotaÃ§Ãµes, fotos da carga ou referÃªncias aqui.</p>
                 {!readOnly && <Button variant="outline" size="sm" className="mt-4">Anexar Arquivo</Button>}
              </div>
              
              <div className="mt-4 flex gap-2 w-full">
                        <Button
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => {
                            toast.success("Gerando PDF profissional...");
                            generateProfessionalPDF(data, "ORÃ‡AMENTO");
                          }}
                        >
                          Gerar PDF
                        </Button>
                        <Button variant="outline" className="flex-1 text-xs"><Copy className="w-3 h-3 mr-1"/> Duplicar</Button>
                      </div>
              
              <div className="flex gap-4 p-4 bg-orange-50/50 rounded-lg border border-orange-100 flex-wrap">
                 <Button onClick={() => gerarPdfOrcamento(data)} className="bg-orange-500 hover:bg-orange-600 text-white gap-2"><FileDown className="w-4 h-4"/> Gerar PDF (Proposta Comercial)</Button>
                 <Button variant="outline" onClick={() => window.print()}>Imprimir</Button>
                 <Button variant="outline" className="text-primary hover:text-primary/80" onClick={handleSalvar}>Duplicar</Button>
                 
                  <div className="flex-1 min-w-[200px] flex gap-2 justify-end">
                     {data.status === "enviado" || data.status === "em_analise" ? (
                       <>
                         <Button className="bg-green-600 hover:bg-green-700 text-white gap-2" onClick={() => { 
                           update("status", "aprovado"); 
                           handleSalvar();
                           toast.success("Orçamento aprovado com sucesso!");
                         }}><Check className="w-4 h-4"/> Aprovar</Button>
                         <Button variant="destructive" onClick={() => { update("status", "reprovado"); handleSalvar(); }}>Reprovar</Button>
                       </>
                     ) : (data.status === "aprovado" ? (
                         <Button 
                           className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
                           onClick={() => {
                             localStorage.setItem('DraftOS_Orcamento', JSON.stringify({
                               ...data,
                               status: "convertido_em_os"
                             }));
                             update("status", "convertido_em_os");
                             toast.success("Orçamento convertido em OS! Redirecionando...");
                             setTimeout(() => {
                               window.location.hash = '#/operacao?tab=os&new=true';
                               window.location.reload();
                             }, 1000);
                           }}
                         ><Truck className="w-4 h-4"/> Converter em OS</Button>
                     ) : null)}
                  </div>
              </div>
              
              <Field label="ObservaÃ§Ãµes Finais e Condicionantes">
                <Textarea rows={3} value={data.observacoesGerais} onChange={(e) => update("observacoesGerais", e.target.value)} readOnly={readOnly} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTÃ“RICO */}
        <TabsContent value="historico">
          <Card>
            <CardContent className="p-4">
              {data.motivoReprovacao && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm">
                  <p className="font-semibold text-red-700">Motivo da reprovaÃ§Ã£o:</p>
                  <p className="text-red-600">{data.motivoReprovacao}</p>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>AÃ§Ã£o</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.historico].reverse().map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{h.data}</TableCell>
                      <TableCell className="text-sm">{h.acao}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{h.usuario}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrcamentoForm;

