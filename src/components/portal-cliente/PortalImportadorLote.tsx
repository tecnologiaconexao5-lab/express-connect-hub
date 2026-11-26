import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  MapPin,
  RefreshCw,
  Send,
  Truck,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  calcularCubagemPedido,
  calcularTotaisPedidos,
  converterPedidoPlanilha,
  detectarPendenciasDados,
  distribuirPedidosEntreVeiculos,
  getNomeTipoVeiculo,
  identificarMacroRegiao,
  normalizarColunasPlanilha,
  obterCentroideAproximado,
  type PendenciaDados,
} from "@/services/roteirizacaoService";
import { calcularDistanciaTempoRota } from "@/services/roteirizacaoMapbox";
import { calcularPreco } from "@/services/precificacao/precificacaoEngineService";
import {
  enviarLoteRoteirizadoPortal,
  type ParadaLotePortal,
} from "@/services/portalCliente/pedidosService";
import type { PedidoRoteirizacao, TipoVeiculo } from "@/types/roteirizacao";

interface PortalImportadorLoteProps {
  clienteId?: string;
  clienteNome?: string;
}

interface ColetaEndereco {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface CenarioFrotaCliente {
  tipo: TipoVeiculo;
  tipoNome: string;
  paradas: number;
  pesoKg: number;
  cubagemM3: number;
  distanciaKm: number;
  tempoMin: number;
  precoCliente: number;
  pedidos: PedidoRoteirizacao[];
}

interface ResultadoLote {
  osNumero?: string;
  pedidoId?: string;
  erro?: string;
}

const MODELO_HEADERS = [
  "numero_pedido",
  "destinatario",
  "telefone",
  "cep",
  "endereco",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "estado",
  "peso_kg",
  "quantidade_volumes",
  "comprimento_cm",
  "largura_cm",
  "altura_cm",
  "janela",
  "observacoes",
];

const MODELO_EXEMPLO = [
  ["PED-001", "João Silva", "11999998888", "01001000", "Rua Exemplo", "100", "", "Centro", "São Paulo", "SP", "5", "1", "40", "30", "30", "08:00 às 12:00", "Entregar na recepção"],
  ["PED-002", "Maria Souza", "11988887777", "04567000", "Av. Exemplo", "200", "Apto 12", "Itaim Bibi", "São Paulo", "SP", "2", "2", "30", "20", "20", "13:00 às 18:00", ""],
];

const PRICING_TIPO: Record<TipoVeiculo, string> = {
  Moto: "Moto",
  Fiorino: "Fiorino",
  HR_Bongo: "HR",
  Van_VUC: "VUC",
  Caminhao_34: "3/4",
  Caminhao_Toco: "Toco",
  Caminhao_Truck: "Truck",
  Carreta: "Carreta",
};

const fmtBRL = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PortalImportadorLote({ clienteId, clienteNome }: PortalImportadorLoteProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [clienteInfo, setClienteInfo] = useState<any>(null);
  const [coleta, setColeta] = useState<ColetaEndereco>({
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  });
  const [arquivoNome, setArquivoNome] = useState("");
  const [pedidos, setPedidos] = useState<PedidoRoteirizacao[]>([]);
  const [pendencias, setPendencias] = useState<PendenciaDados[]>([]);
  const [frota, setFrota] = useState<CenarioFrotaCliente[]>([]);
  const [distanciaKm, setDistanciaKm] = useState(0);
  const [tempoMin, setTempoMin] = useState(0);
  const [precoTotal, setPrecoTotal] = useState(0);
  const [calculando, setCalculando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoLote | null>(null);

  useEffect(() => {
    if (!clienteId) return;
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("clientes")
        .select("tenant_id, logradouro, numero, complemento, bairro, cidade, uf, cep, nome_fantasia, razao_social")
        .eq("id", clienteId)
        .maybeSingle();
      if (!ativo || !data) return;
      setClienteInfo(data);
      setColeta({
        cep: data.cep || "",
        rua: data.logradouro || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        cidade: data.cidade || "",
        uf: data.uf || "",
      });
    })();
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  const totais = useMemo(() => calcularTotaisPedidos(pedidos), [pedidos]);

  const baixarModelo = () => {
    const linhas = [MODELO_HEADERS, ...MODELO_EXEMPLO]
      .map((linha) => linha.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + linhas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importacao-entregas.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const recalcular = useCallback(
    async (lista: PedidoRoteirizacao[]) => {
      if (!clienteId || lista.length === 0) {
        setFrota([]);
        setDistanciaKm(0);
        setTempoMin(0);
        setPrecoTotal(0);
        return;
      }
      if (!coleta.cidade || !coleta.uf) {
        toast({
          title: "Endereço de coleta incompleto",
          description: "Informe cidade e UF da coleta para calcular rota e frete.",
          variant: "destructive",
        });
        return;
      }

      setCalculando(true);
      try {
        const origem = obterCentroideAproximado(coleta.cidade, coleta.uf, coleta.cep);
        const origemCoords = { lat: origem.latitude, lng: origem.longitude };
        const comCoords = lista.map((p) => {
          const c = obterCentroideAproximado(p.cidade || coleta.cidade, p.estado || coleta.uf, p.cep);
          return { ...p, latitude: c.latitude, longitude: c.longitude };
        });

        const total = await calcularDistanciaTempoRota(
          comCoords.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
          origemCoords,
          { comRetorno: true },
        );
        setDistanciaKm(total.distanciaTotalKm);
        setTempoMin(total.tempoTotalMinutos);

        const grupos = distribuirPedidosEntreVeiculos(comCoords, [], "sugestao");
        const cenarios: CenarioFrotaCliente[] = [];

        for (const grupo of grupos) {
          const pesoKg = grupo.pedidos.reduce((a, p) => a + (p.pesoKg || 0), 0);
          const cubagemM3 = grupo.pedidos.reduce((a, p) => a + calcularCubagemPedido(p), 0);
          const ultimo = grupo.pedidos[grupo.pedidos.length - 1];
          let precoCliente = 0;
          let grupoDist = total.distanciaTotalKm;
          let grupoTempo = total.tempoTotalMinutos;

          try {
            const rotaGrupo = await calcularDistanciaTempoRota(
              grupo.pedidos.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
              origemCoords,
              { comRetorno: true },
            );
            grupoDist = rotaGrupo.distanciaTotalKm;
            grupoTempo = rotaGrupo.tempoTotalMinutos;
          } catch {
            // mantem a rota consolidada como fallback
          }

          try {
            const output = await calcularPreco({
              tenant_id: clienteInfo?.tenant_id || "",
              cliente_id: clienteId,
              cliente_nome: clienteNome || clienteInfo?.nome_fantasia || clienteInfo?.razao_social,
              tipo_veiculo: PRICING_TIPO[grupo.veiculo.tipoVeiculo] || "VUC",
              tipo_operacao: "urbano",
              distancia_km: grupoDist,
              peso: pesoKg,
              cubagem: cubagemM3,
              quantidade_paradas: grupo.pedidos.length + 1,
              origem: { cidade: coleta.cidade, uf: coleta.uf, cep: coleta.cep },
              destino: { cidade: ultimo?.cidade || coleta.cidade, uf: ultimo?.estado || coleta.uf, cep: ultimo?.cep },
              modo: "preview",
            });
            if (output?.sucesso) precoCliente = Number(output.cliente.total || 0);
          } catch (e) {
            console.warn("[PortalImportadorLote] Precificação indisponível:", e);
          }

          cenarios.push({
            tipo: grupo.veiculo.tipoVeiculo,
            tipoNome: getNomeTipoVeiculo(grupo.veiculo.tipoVeiculo),
            paradas: grupo.pedidos.length,
            pesoKg,
            cubagemM3,
            distanciaKm: grupoDist,
            tempoMin: grupoTempo,
            precoCliente,
            pedidos: grupo.pedidos,
          });
        }

        setFrota(cenarios);
        setPrecoTotal(cenarios.reduce((a, c) => a + c.precoCliente, 0));
      } finally {
        setCalculando(false);
      }
    },
    [clienteId, clienteNome, clienteInfo, coleta, toast],
  );

  const lerArquivo = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const convertidos = rows
        .map((row) =>
          converterPedidoPlanilha(
            normalizarColunasPlanilha(row) as unknown as Record<string, string>,
          ),
        )
        .filter((p) => p.cidade || p.endereco || p.cep);

      if (convertidos.length === 0) {
        toast({
          title: "Planilha sem linhas válidas",
          description: "Verifique se há endereço/cidade/CEP nas linhas.",
          variant: "destructive",
        });
        return;
      }

      setArquivoNome(file.name);
      setResultado(null);
      setPedidos(convertidos);
      setPendencias(detectarPendenciasDados(convertidos));
      await recalcular(convertidos);
      toast({
        title: "Planilha importada",
        description: `${convertidos.length} linha(s) lida(s).`,
      });
    } catch (e) {
      console.error("[PortalImportadorLote] Falha ao ler planilha:", e);
      toast({
        title: "Não foi possível ler a planilha",
        description: "Use .xlsx, .xls ou .csv com cabeçalhos de endereço.",
        variant: "destructive",
      });
    }
  };

  const enviarLote = async () => {
    if (!clienteId || pedidos.length === 0 || enviando) return;
    if (!coleta.cidade || !coleta.uf) {
      toast({ title: "Informe a cidade/UF da coleta", variant: "destructive" });
      return;
    }
    if (!clienteInfo?.tenant_id) {
      toast({ title: "Cadastro incompleto", description: "Não foi possível identificar a transportadora.", variant: "destructive" });
      return;
    }
    const semCidade = pedidos.filter((p) => !p.cidade || !p.estado);
    if (semCidade.length > 0) {
      toast({
        title: `${semCidade.length} linha(s) sem cidade/UF`,
        description: "Corrija a planilha antes de enviar o lote.",
        variant: "destructive",
      });
      return;
    }

    setEnviando(true);
    setResultado(null);
    try {
      const paradas: ParadaLotePortal[] = [
        {
          tipo: "coleta",
          cep: coleta.cep,
          logradouro: coleta.rua,
          numero: coleta.numero,
          complemento: coleta.complemento,
          bairro: coleta.bairro,
          cidade: coleta.cidade,
          uf: coleta.uf,
          contato: clienteNome || clienteInfo?.nome_fantasia || "",
          telefone: "",
          volumes: 0,
          peso_kg: 0,
          cubagem_m3: 0,
        },
        ...pedidos.map<ParadaLotePortal>((p) => ({
          tipo: "entrega",
          cep: p.cep,
          logradouro: p.endereco || p.enderecoCompleto,
          numero: p.numero || "",
          complemento: p.complemento || "",
          bairro: p.bairro,
          cidade: p.cidade,
          uf: p.estado,
          contato: p.destinatario,
          telefone: p.telefone,
          email: p.email,
          janela_inicio: p.janelaInicio,
          janela_fim: p.janelaFim,
          instrucoes: p.observacoes,
          volumes: p.quantidadeVolumes || 1,
          peso_kg: p.pesoKg || 0,
          cubagem_m3: p.cubagemM3 || 0,
          comprimento_cm: p.comprimentoCm,
          largura_cm: p.larguraCm,
          altura_cm: p.alturaCm,
        })),
      ];

      const macroRegioes = [...new Set(pedidos.map((p) => identificarMacroRegiao(p.cep, p.cidade, p.bairro)))];
      const frotaAgrupada = frota.reduce<Record<string, { tipo: string; quantidade: number }>>((acc, c) => {
        if (!acc[c.tipoNome]) acc[c.tipoNome] = { tipo: c.tipoNome, quantidade: 0 };
        acc[c.tipoNome].quantidade += 1;
        return acc;
      }, {});
      const veiculoSugerido =
        Object.values(frotaAgrupada)
          .map((f) => `${f.quantidade}x ${f.tipo}`)
          .join(" + ") || "A definir";

      const res = await enviarLoteRoteirizadoPortal({
        clienteId,
        clienteNome: clienteNome || clienteInfo?.nome_fantasia || clienteInfo?.razao_social || "Cliente",
        tenantId: clienteInfo?.tenant_id || undefined,
        coleta,
        paradas,
        totais: {
          volumes: totais.volumesTotal,
          pesoKg: totais.pesoTotalKg,
          cubagemM3: totais.cubagemTotalM3,
        },
        distanciaKm,
        tempoMin,
        veiculoSugerido,
        precoEstimado: precoTotal,
        macroRegioes,
        frota: Object.values(frotaAgrupada),
      });

      if (res.sucesso) {
        setResultado({ osNumero: res.os_numero, pedidoId: res.pedido_id });
        setPedidos([]);
        setFrota([]);
        setPendencias([]);
        setArquivoNome("");
        toast({
          title: "Lote enviado para a Conexão Express",
          description: res.os_numero ? `OS ${res.os_numero} criada na fila operacional.` : "OS criada na fila operacional.",
        });
      } else {
        setResultado({ erro: res.erro || "Falha ao converter o lote em OS.", pedidoId: res.pedido_id });
        toast({
          title: "Lote registrado, conversão pendente",
          description: "A solicitação ficou disponível na aba Pedidos para reprocessar.",
          variant: "destructive",
        });
      }
    } finally {
      setEnviando(false);
    }
  };

  if (!clienteId) {
    return (
      <Card className="border-[#E5E7EB] shadow-sm rounded-2xl">
        <CardContent className="p-8 text-center text-sm text-[#64748B]">
          Selecione um cliente para importar lotes.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-[#E5E7EB] shadow-sm rounded-2xl">
        <CardHeader className="pb-3 border-b border-[#F1F5F9]">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#F97316]" />
                Importar lote de entregas
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Planilha .xlsx, .xls ou .csv. O lote vira uma OS multi-paradas na fila da Conexão Express.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl border-[#E5E7EB]" onClick={baixarModelo}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar modelo
              </Button>
              <Button
                size="sm"
                className="rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Selecionar planilha
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void lerArquivo(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          {arquivoNome && (
            <p className="text-[11px] text-[#64748B] mt-2 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3 h-3" /> {arquivoNome}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-widest flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Endereço de coleta
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#64748B]"
                onClick={() => void recalcular(pedidos)}
                disabled={pedidos.length === 0 || calculando}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${calculando ? "animate-spin" : ""}`} /> Recalcular
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Input placeholder="CEP" value={coleta.cep} onChange={(e) => setColeta({ ...coleta, cep: e.target.value })} />
              <Input placeholder="Rua / Logradouro" value={coleta.rua} onChange={(e) => setColeta({ ...coleta, rua: e.target.value })} />
              <Input placeholder="Número" value={coleta.numero} onChange={(e) => setColeta({ ...coleta, numero: e.target.value })} />
              <Input placeholder="Complemento" value={coleta.complemento} onChange={(e) => setColeta({ ...coleta, complemento: e.target.value })} />
              <Input placeholder="Bairro" value={coleta.bairro} onChange={(e) => setColeta({ ...coleta, bairro: e.target.value })} />
              <Input placeholder="Cidade *" value={coleta.cidade} onChange={(e) => setColeta({ ...coleta, cidade: e.target.value })} />
              <Input placeholder="UF *" value={coleta.uf} onChange={(e) => setColeta({ ...coleta, uf: e.target.value.toUpperCase().slice(0, 2) })} />
            </div>
          </div>

          {pendencias.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {pendencias.length} linha(s) com dados incompletos
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {pendencias.slice(0, 5).map((p) => (
                  <li key={p.pedido.id} className="text-[11px] text-amber-700">
                    {p.pedido.numeroPedido || p.pedido.destinatario || p.pedido.id.slice(0, 8)} — falta: {p.faltando.join(", ")}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-amber-700 mt-1.5">
                O envio é permitido; complete os dados no TMS após a geração da OS, se necessário.
              </p>
            </div>
          )}

          {pedidos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Resumo label="Linhas" value={String(pedidos.length)} />
              <Resumo label="Volumes" value={String(totais.volumesTotal)} />
              <Resumo label="Peso" value={`${totais.pesoTotalKg.toFixed(1)} kg`} />
              <Resumo label="Cubagem" value={`${totais.cubagemTotalM3.toFixed(2)} m³`} />
              <Resumo label="Rota" value={`${distanciaKm} km • ${Math.round(tempoMin)} min`} />
            </div>
          )}

          {frota.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {frota.map((c, idx) => (
                <div key={`${c.tipo}-${idx}`} className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-[#0F172A] flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#F97316]" /> {c.tipoNome}
                    </p>
                    <Badge className="bg-white text-[#64748B] border border-[#E5E7EB] text-[10px]">
                      {c.paradas} parada(s)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    {c.pesoKg.toFixed(1)} kg • {c.cubagemM3.toFixed(2)} m³ • {c.distanciaKm} km
                  </p>
                  <p className="text-sm font-black text-emerald-700 mt-1.5">
                    {c.precoCliente > 0 ? fmtBRL(c.precoCliente) : "Sob consulta"}
                  </p>
                  <p className="text-[10px] text-[#94A3B8]">Valor estimado ao cliente</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-[#F1F5F9]">
            <p className="text-[11px] text-[#64748B]">
              Estimativa de frete para o cliente. Custos internos e margem não são exibidos.
            </p>
            <Button
              className="rounded-xl bg-[#0F1A2E] hover:bg-[#1E293B] text-white"
              onClick={enviarLote}
              disabled={pedidos.length === 0 || enviando || calculando}
            >
              {enviando ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar Lote Roteirizado para Conexão Express
            </Button>
          </div>

          {resultado?.osNumero && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-800">Lote enviado com sucesso</p>
                <p className="text-[11px] text-emerald-700">
                  OS {resultado.osNumero} criada na fila operacional da Conexão Express.
                </p>
              </div>
            </div>
          )}
          {resultado?.erro && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-800">Lote registrado, conversão pendente</p>
                <p className="text-[11px] text-red-700">{resultado.erro}</p>
                <p className="text-[10px] text-red-600 mt-0.5">Use "Reprocessar Conversão" em Pedidos / Solicitações Enviadas.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Resumo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-2.5 text-center">
      <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide">{label}</p>
      <p className="text-sm font-extrabold text-[#0F172A]">{value}</p>
    </div>
  );
}

export default PortalImportadorLote;
