import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { 
  LayoutDashboard, 
  Upload, 
  MapPin, 
  Truck, 
  Route, 
  Map as MapIcon, 
  FileCheck, 
  Download, 
  AlertTriangle, 
  Package, 
  Scale, 
  Boxes, 
  MapPinned,
  Thermometer,
  Clock,
  Flag,
  FileText,
ChevronRight, 
  CheckCircle,
  XCircle,
  Save,
  Plus
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MapboxMap from "@/components/MapboxMap";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  PedidoRoteirizacao, 
  VeiculoRoteirizacao,
  ResultadoRoteirizacao,
  AlertaRoteirizacao,
  GrupoPedidos,
  TipoVeiculo,
  CAPACIDADES_PADRAO_VEICULOS,
  CABECALHO_PLANILHA,
  ModoRoteirizacao
} from "@/types/roteirizacao";
import {
  calcularCubagemPedido,
  calcularTotaisPedidos,
  agruparPorFaixaCep,
  agruparPorRegiao,
  agruparPorCidade,
  validarListaPedidos,
  sugerirVeiculosNecessarios,
  distribuirPedidosEntreVeiculos,
  gerarResumoRoteirizacao,
  gerarAlertasPorDemandaxFrota,
  getNomeTipoVeiculo,
  getIconeTipoVeiculo,
  optimizarSequenciaParadas,
  estimarDistanciaTempoLocal
} from "@/services/roteirizacaoService";
import { calcularDistanciaTempoRota } from "@/services/roteirizacaoMapbox";

const mockPedidos: PedidoRoteirizacao[] = [
  {
    id: "1",
    numeroPedido: "PED-2024-001",
    cliente: "Magazine Luiza",
    destinatario: "João Silva",
    telefone: "11999999999",
    cep: "01234-567",
    enderecoCompleto: "Rua Augusta, 150, Consolação",
    bairro: "Consolação",
    cidade: "São Paulo",
    estado: "SP",
    latitude: -23.5505,
    longitude: -46.6333,
    pesoKg: 2.5,
    quantidadeVolumes: 1,
    comprimentoCm: 30,
    larguraCm: 20,
    alturaCm: 15,
    cubagemM3: 0.009,
    tipoCarga: "seco",
    secoOuRefrigerado: "seco",
    prioridade: "alta",
    observacoes: "Cliente prefers morning delivery",
    status: "pendente"
  },
  {
    id: "2",
    numeroPedido: "PED-2024-002",
    cliente: "Americanas",
    destinatario: "Maria Santos",
    telefone: "11988888888",
    cep: "04567-890",
    enderecoCompleto: "Av. Paulista, 1000, Bela Vista",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
    latitude: -23.5629,
    longitude: -46.6544,
    pesoKg: 5.0,
    quantidadeVolumes: 2,
    comprimentoCm: 40,
    larguraCm: 30,
    alturaCm: 20,
    cubagemM3: 0.048,
    tipoCarga: "seco",
    secoOuRefrigerado: "seco",
    prioridade: "media",
    status: "pendente"
  },
  {
    id: "3",
    numeroPedido: "PED-2024-003",
    cliente: "iFood",
    destinatario: "Restaurante Sabor",
    telefone: "11977777777",
    cep: "02345-678",
    enderecoCompleto: "Rua das Laranjeiras, 500, Laranjeiras",
    bairro: "Laranjeiras",
    cidade: "São Paulo",
    estado: "SP",
    latitude: -23.6500,
    longitude: -46.6500,
    pesoKg: 15.0,
    quantidadeVolumes: 3,
    comprimentoCm: 60,
    larguraCm: 40,
    alturaCm: 30,
    cubagemM3: 0.216,
    tipoCarga: "refrigerado",
    secoOuRefrigerado: "refrigerado",
    temperaturaMinima: 5,
    janelaInicio: "10:00",
    janelaFim: "14:00",
    prioridade: "urgente",
    observacões: "Manter refrigerado",
    status: "pendente"
  },
  {
    id: "4",
    numeroPedido: "PED-2024-004",
    cliente: "Mercado Livre",
    destinatario: "Carlos Oliveira",
    telefone: "11966666666",
    cep: "05678-901",
    enderecoCompleto: "Rua do Comércio, 200, Centro",
    bairro: "Centro",
    cidade: "Osasco",
    estado: "SP",
    latitude: -23.5327,
    longitude: -46.7917,
    pesoKg: 0.5,
    quantidadeVolumes: 1,
    comprimentoCm: 20,
    larguraCm: 15,
    alturaCm: 10,
    cubagemM3: 0.003,
    tipoCarga: "seco",
    secoOuRefrigerado: "seco",
    prioridade: "baixa",
    status: "pendente"
  },
  {
    id: "5",
    numeroPedido: "PED-2024-005",
    cliente: "Shopee",
    destinatario: "Ana Paula",
    telefone: "11955555555",
    cep: "06789-012",
    enderecoCompleto: "Av. Nacional, 350, Jardim",
    bairro: "Jardim",
    cidade: "Barueri",
    estado: "SP",
    latitude: -23.5088,
    longitude: -46.8789,
    pesoKg: 8.0,
    quantidadeVolumes: 1,
    comprimentoCm: 50,
    larguraCm: 35,
    alturaCm: 25,
    cubagemM3: 0.044,
    tipoCarga: "seco",
    secoOuRefrigerado: "seco",
    prioridade: "media",
    status: "pendente"
  }
];

const mockVeiculos: VeiculoRoteirizacao[] = [
  {
    id: "v1",
    tipoVeiculo: "Fiorino",
    placa: "ABC-1234",
    motorista: "José Carlos",
    prestadorId: "p1",
    cepBasePrestador: "01234-000",
    regiaoBase: "Centro",
    capacidadePesoKg: 500,
    capacidadeCubagemM3: 2.5,
    tipoOperacao: "seco",
    disponivel: true,
    contratoOuAvulso: "contrato"
  },
  {
    id: "v2",
    tipoVeiculo: "Van_VUC",
    placa: "DEF-5678",
    motorista: "Pedro Santos",
    prestadorId: "p2",
    cepBasePrestador: "04567-000",
    regiaoBase: "Zona Sul",
    capacidadePesoKg: 1200,
    capacidadeCubagemM3: 6,
    tipoOperacao: "seco",
    disponivel: true,
    contratoOuAvulso: "avulso"
  },
  {
    id: "v3",
    tipoVeiculo: "Van_VUC",
    placa: "GHI-9012",
    motorista: "Ricardo Souza",
    prestadorId: "p3",
    cepBasePrestador: "05678-000",
    regiaoBase: "Zona Oeste",
    capacidadePesoKg: 1200,
    capacidadeCubagemM3: 6,
    tipoOperacao: "refrigerado",
    temperaturaMinima: 0,
    disponivel: true,
    contratoOuAvulso: "contrato"
  },
  {
    id: "v4",
    tipoVeiculo: "Caminhao_34",
    placa: "JKL-3456",
    motorista: "Marcos Silva",
    prestadorId: "p4",
    cepBasePrestador: "01000-000",
    regiaoBase: "Norte",
    capacidadePesoKg: 3000,
    capacidadeCubagemM3: 15,
    tipoOperacao: "seco",
    disponivel: true,
    contratoOuAvulso: "contrato"
  }
];

const veiculosSugeridos = sugerirVeiculosNecessarios(mockPedidos, ['seco', 'refrigerado']);

const RoteirizadorWeb = () => {
  const [activeTab, setActiveTab] = useState("visao_geral");
  const [pedidos, setPedidos] = useState<PedidoRoteirizacao[]>(mockPedidos);
  const [veiculos, setVeiculos] = useState<VeiculoRoteirizacao[]>(mockVeiculos);
  const [modoRoteirizacao, setModoRoteirizacao] = useState<ModoRoteirizacao>("sugestao");
  
  
  const [importedPedidos, setImportedPedidos] = useState<PedidoRoteirizacao[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState("");

  const processImportData = (data: any[]) => {
    const novosPedidos: PedidoRoteirizacao[] = data.map((row, index) => {
      const p = {
        id: "IMP-" + Date.now() + "-" + index,
        numeroPedido: row.numero_pedido || row.numeroPedido || `SEM-NUM-${index}`,
        cliente: row.cliente || "Não informado",
        destinatario: row.destinatario || "Não informado",
        telefone: row.telefone || "",
        cep: (row.cep || "").toString().replace(/\D/g, ''),
        enderecoCompleto: row.endereco || "",
        bairro: row.bairro || "",
        cidade: row.cidade || "",
        estado: row.estado || "",
        latitude: 0,
        longitude: 0,
        pesoKg: parseFloat(row.peso_kg) || parseFloat(row.peso) || 0,
        quantidadeVolumes: parseInt(row.quantidade_volumes) || parseInt(row.volumes) || 0,
        comprimentoCm: parseFloat(row.comprimento_cm) || 0,
        larguraCm: parseFloat(row.largura_cm) || 0,
        alturaCm: parseFloat(row.altura_cm) || 0,
        cubagemM3: 0,
        tipoCarga: row.tipo_carga || "seco",
        secoOuRefrigerado: (row.seco_ou_refrigerado || "seco").toLowerCase().includes("refri") ? "refrigerado" : "seco",
        temperaturaMinima: parseFloat(row.temperatura_minima) || undefined,
        janelaInicio: row.janela_inicio || "",
        janelaFim: row.janela_fim || "",
        prioridade: (row.prioridade || "normal").toLowerCase(),
        observacoes: row.observacoes || "",
        status: "pendente" as const
      };
      p.cubagemM3 = calcularCubagemPedido(p as any);
      return p as PedidoRoteirizacao;
    });
    setImportedPedidos(novosPedidos);
    setFileError("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setFileError("");
    setImportedPedidos([]);

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processImportData(results.data);
          setIsUploading(false);
        },
        error: (err) => {
          setFileError("Erro ao ler CSV: " + err.message);
          setIsUploading(false);
        }
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const wsname = workbook.SheetNames[0];
          const ws = workbook.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          processImportData(data);
        } catch (err: any) {
          setFileError("Erro ao ler Excel: " + err.message);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setFileError("Formato de arquivo não suportado. Use .csv ou .xlsx");
      setIsUploading(false);
    }
    
    e.target.value = '';
  };

  const confirmarImportacao = () => {
    const validos = importedPedidos.filter(p => !validarListaPedidos([p]).some(a => a.tipo === 'erro'));
    if (validos.length === 0) {
      toast.error("Nenhum pedido válido para importar.");
      return;
    }
    if (validos.length < importedPedidos.length) {
      toast.warning(`Foram ignorados ${importedPedidos.length - validos.length} pedidos inválidos.`);
    }
    setPedidos(validos);
    setImportedPedidos([]);
    toast.success(`${validos.length} pedidos importados com sucesso!`);
    setActiveTab("visao_geral");
  };

  const limparImportacao = () => {
    setImportedPedidos([]);
    setFileError("");
  };

  const totaisImportados = calcularTotaisPedidos(importedPedidos);

  const totais = calcularTotaisPedidos(pedidos);
  const alertasValidacao = validarListaPedidos(pedidos);
  const alertasDemandaxFrota = gerarAlertasPorDemandaxFrota(pedidos, veiculos);
  const gruposFaixaCep = agruparPorFaixaCep(pedidos);
  const gruposRegiao = agruparPorRegiao(pedidos);
  
  const [distribuicaoGerada, setDistribuicaoGerada] = useState<ReturnType<typeof distribuirPedidosEntreVeiculos>>([]);
  const [isGerando, setIsGerando] = useState(false);
  const [rotasCalculadas, setRotasCalculadas] = useState<Map<number, { distanciaKm: number; tempoMin: number; origem: string; alertas: string[]; routeCoordinates?: [number, number][] }>>(new Map());
  const [isCalculandoRotas, setIsCalculandoRotas] = useState(false);
  const [salvandoRota, setSalvandoRota] = useState<number | null>(null);

  // Manual Add Form
  const [novoPedido, setNovoPedido] = useState<Partial<PedidoRoteirizacao>>({
    numeroPedido: "", cliente: "", destinatario: "", cep: "", enderecoCompleto: "",
    bairro: "", cidade: "", estado: "", pesoKg: 0, quantidadeVolumes: 1, tipoCarga: "seco"
  });

  const handleAdicionarManual = () => {
    if (!novoPedido.cep || !novoPedido.cidade || !novoPedido.estado) {
      toast.error("Preencha ao menos CEP, Cidade e UF.");
      return;
    }
    const pedidoCompleto: PedidoRoteirizacao = {
      ...novoPedido,
      id: "MAN-" + Date.now(),
      numeroPedido: novoPedido.numeroPedido || "MAN-" + Date.now(),
      cliente: novoPedido.cliente || "Manual",
      destinatario: novoPedido.destinatario || "Manual",
      telefone: novoPedido.telefone || "",
      cep: novoPedido.cep || "",
      enderecoCompleto: novoPedido.enderecoCompleto || "",
      bairro: novoPedido.bairro || "",
      cidade: novoPedido.cidade || "",
      estado: novoPedido.estado || "",
      latitude: 0,
      longitude: 0,
      pesoKg: novoPedido.pesoKg || 0,
      quantidadeVolumes: novoPedido.quantidadeVolumes || 1,
      cubagemM3: novoPedido.cubagemM3 || 0.01,
      tipoCarga: novoPedido.tipoCarga || "seco",
      secoOuRefrigerado: novoPedido.tipoCarga?.includes("refri") ? "refrigerado" : "seco",
      status: "pendente",
      prioridade: "normal",
    } as PedidoRoteirizacao;

    // Simulate geocoding via Mapbox if available, but for now we just push.
    // Geocoding can be done automatically via a separate mapbox geocode call.
    setPedidos([pedidoCompleto, ...pedidos]);
    toast.success("Parada manual adicionada!");
    setNovoPedido({
      numeroPedido: "", cliente: "", destinatario: "", cep: "", enderecoCompleto: "",
      bairro: "", cidade: "", estado: "", pesoKg: 0, quantidadeVolumes: 1, tipoCarga: "seco"
    });
  };

  const handleSalvarRotaNoSupabase = async (resultado: any, index: number) => {
    setSalvandoRota(index);
    try {
      const calculo = rotasCalculadas.get(index);
      
      const { data: rotaData, error: rotaError } = await supabase.from("rotas").insert([{
        nome: `Rota ${getNomeTipoVeiculo(resultado.veiculo.tipoVeiculo)} - ${resultado.veiculo.placa || 'Sem Placa'}`,
        data_rota: new Date().toISOString().split('T')[0],
        tipo_rota: "entrega",
        distancia_km: calculo?.distanciaKm || 0,
        duracao_min: calculo?.tempoMin || 0,
        peso_total: resultado.pedidos.reduce((acc: number, p: any) => acc + (p.pesoKg || 0), 0),
        volumes_total: resultado.pedidos.reduce((acc: number, p: any) => acc + (p.quantidadeVolumes || 0), 0),
        veiculo_sugerido: resultado.veiculo.tipoVeiculo,
        status: "pendente",
        metadata: { placa: resultado.veiculo.placa, origemCalculo: calculo?.origem }
      }]).select().single();

      if (rotaError) throw rotaError;

      const paradasToInsert = resultado.pedidos.map((p: PedidoRoteirizacao, i: number) => ({
        rota_id: rotaData.id,
        sequencia: i + 1,
        cliente_nome: p.cliente,
        telefone: p.telefone,
        cep: p.cep,
        endereco: p.enderecoCompleto,
        bairro: p.bairro,
        cidade: p.cidade,
        uf: p.estado,
        latitude: p.latitude || null,
        longitude: p.longitude || null,
        peso: p.pesoKg,
        volumes: p.quantidadeVolumes,
        cubagem: p.cubagemM3,
        status: "pendente",
        prioridade: p.prioridade
      }));

      const { error: paradasError } = await supabase.from("rota_paradas").insert(paradasToInsert);
      if (paradasError) throw paradasError;

      toast.success("Rota salva no banco com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar rota: " + e.message);
    } finally {
      setSalvandoRota(null);
    }
  };

  const handleGerarRoteiros = () => {
    setIsGerando(true);
    setTimeout(() => {
      try {
        const veiculosParaUso = modoRoteirizacao === 'sugestao' ? veiculosSugeridos as any : veiculos;
        const res = distribuirPedidosEntreVeiculos(pedidos, veiculosParaUso, modoRoteirizacao);
        setDistribuicaoGerada(res);
        setRotasCalculadas(new Map());
        toast.success("Roteiros gerados com sucesso!");
        setActiveTab("roteiros");
      } catch (err: any) {
        toast.error("Erro ao gerar roteiros: " + err.message);
      } finally {
        setIsGerando(false);
      }
    }, 500);
  };

  const calcularDistanciaTempoUmaRota = async (pedidosRota: PedidoRoteirizacao[], index: number) => {
    setIsCalculandoRotas(true);
    try {
      const pedidosOrdenados = optimizarSequenciaParadas(pedidosRota);
      
      const resultado = await calcularDistanciaTempoRota(
        pedidosOrdenados.map(p => ({ latitude: p.latitude, longitude: p.longitude }))
      );

      const novoMapa = new Map(rotasCalculadas);
      novoMapa.set(index, {
        distanciaKm: resultado.distanciaTotalKm,
        tempoMin: resultado.tempoTotalMinutos,
        origem: resultado.origemCalculo,
        alertas: resultado.alertas,
        routeCoordinates: resultado.routeCoordinates
      });
      setRotasCalculadas(novoMapa);

      return resultado;
    } catch (err) {
      const estimativa = estimarDistanciaTempoLocal(pedidosRota);
      const novoMapa = new Map(rotasCalculadas);
      novoMapa.set(index, {
        distanciaKm: estimativa.distanciaTotalKm,
        tempoMin: estimativa.tempoTotalMinutos,
        origem: 'estimativa_local',
        alertas: estimativa.alertas,
      });
      setRotasCalculadas(novoMapa);
      return estimativa;
    } finally {
      setIsCalculandoRotas(false);
    }
  };

  const calcularTodasAsRotas = async () => {
    setIsCalculandoRotas(true);
    try {
      for (let i = 0; i < distribuicao.length; i++) {
        const resultado = distribuicao[i];
        const pedidosRota = resultado.pedidos;
        const pedidosOrdenados = optimizarSequenciaParadas(pedidosRota);
        
        const calcResultado = await calcularDistanciaTempoRota(
          pedidosOrdenados.map(p => ({ latitude: p.latitude, longitude: p.longitude }))
        );

        const novoMapa = new Map(rotasCalculadas);
        novoMapa.set(i, {
          distanciaKm: calcResultado.distanciaTotalKm,
          tempoMin: calcResultado.tempoTotalMinutos,
          origem: calcResultado.origemCalculo,
          alertas: calcResultado.alertas,
          routeCoordinates: calcResultado.routeCoordinates
        });
        setRotasCalculadas(novoMapa);
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      toast.success("Cálculo de distâncias concluído!");
    } catch (err: any) {
      toast.error("Erro ao calcular rotas: " + err.message);
    } finally {
      setIsCalculandoRotas(false);
    }
  };

  const distribuicao = distribuicaoGerada.length > 0 ? distribuicaoGerada : distribuirPedidosEntreVeiculos(pedidos, veiculos, modoRoteirizacao);
  

  const resumo = gerarResumoRoteirizacao(distribuicao, pedidos);

  const downloadModeloPlanilha = () => {
    const csvContent = CABECALHO_PLANILHA.join(",") + "\n" + 
      "PED-2024-001,Magazine Luiza,João Silva,11999999999,01234-567,Rua Augusta 150,Consolação,São Paulo,SP,2.5,1,30,20,15,seco,seco,,08:00,12:00,media,\n" +
      "PED-2024-002,Americanas,Maria Santos,11988888888,04567-890,Av Paulista 1000,Bela Vista,São Paulo,SP,5.0,2,40,30,20,seco,seco,,,alta,";
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modelo_importacao_pedidos.csv";
    link.click();
  };

  const getAlertaIcon = (tipo: 'erro' | 'aviso' | 'sugestao') => {
    switch (tipo) {
      case 'erro': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'aviso': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'sugestao': return <AlertTriangle className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Route className="w-6 h-6 text-primary" />
            Roteirizador Web Profissional
          </h2>
          <p className="text-sm text-muted-foreground">Planejamento de rotas multipontos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadModeloPlanilha}>
            <Download className="w-4 h-4 mr-2" />
            Baixar Modelo
          </Button>
          <Button size="sm" onClick={() => setActiveTab("importar")}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Planilha
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleGerarRoteiros} disabled={isGerando}>
            <Route className="w-4 h-4 mr-2" />
            {isGerando ? "Gerando..." : "Gerar Roteiros Inteligentes"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card border w-full justify-start overflow-x-auto flex-wrap">
          <TabsTrigger value="visao_geral" className="gap-1">
            <LayoutDashboard className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="importar" className="gap-1">
            <Upload className="w-4 h-4" />
            Importar Pedidos
          </TabsTrigger>
          <TabsTrigger value="agrupamento" className="gap-1">
            <MapPin className="w-4 h-4" />
            Agrupamento
          </TabsTrigger>
          <TabsTrigger value="veiculos" className="gap-1">
            <Truck className="w-4 h-4" />
            Veículos
          </TabsTrigger>
          <TabsTrigger value="roteiros" className="gap-1">
            <Route className="w-4 h-4" />
            Roteiros
          </TabsTrigger>
          <TabsTrigger value="mapa" className="gap-1">
            <MapIcon className="w-4 h-4" />
            Mapa
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1">
            <FileCheck className="w-4 h-4" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao_geral" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" />
                  Total de Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totais.totalPedidos}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Scale className="w-4 h-4 text-green-500" />
                  Peso Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totais.pesoTotalKg.toFixed(1)} kg</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-purple-500" />
                  Cubagem Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totais.cubagemTotalM3.toFixed(2)} m³</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPinned className="w-4 h-4 text-orange-500" />
                  Regiões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totais.regioesIdentificadas.length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-500" />
                  Veículos Necessários
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{veiculosSugeridos.length}</p>
                <p className="text-xs text-muted-foreground">
                  {veiculosSugeridos.map(v => getNomeTipoVeiculo(v.tipo)).join(", ")}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="w-4 h-4 text-teal-500" />
                  Veículos Disponíveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{veiculos.filter(v => v.disponivel).length}</p>
                <p className="text-xs text-muted-foreground">
                  {veiculos.filter(v => v.disponivel && v.contratoOuAvulso === 'contrato').length} contrato, {veiculos.filter(v => v.disponivel && v.contratoOuAvulso === 'avulso').length} avulso
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Pedidos Alocados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{resumo.totalPedidos - resumo.pedidosNaoAlocados}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Não Alocados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{resumo.pedidosNaoAlocados}</p>
              </CardContent>
            </Card>
          </div>

          {(alertasValidacao.length > 0 || alertasDemandaxFrota.length > 0) && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  Alertas e Problemas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...alertasValidacao, ...alertasDemandaxFrota].map((alerta, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      {getAlertaIcon(alerta.tipo)}
                      <span>{alerta.mensagem}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Modo de Roteirização</CardTitle>
              <CardDescription>Escolha como os veículos serão selecionados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button 
                  variant={modoRoteirizacao === "sugestao" ? "default" : "outline"}
                  onClick={() => setModoRoteirizacao("sugestao")}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Sistema Sugere Veículos
                </Button>
                <Button 
                  variant={modoRoteirizacao === "disponiveis" ? "default" : "outline"}
                  onClick={() => setModoRoteirizacao("disponiveis")}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Usar Disponíveis
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Parada Manual</CardTitle>
              <CardDescription>Insira uma parada pontual sem precisar de planilha</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>CEP *</Label>
                  <Input value={novoPedido.cep} onChange={e => setNovoPedido({...novoPedido, cep: e.target.value})} placeholder="Ex: 01001-000" />
                </div>
                <div>
                  <Label>Cidade *</Label>
                  <Input value={novoPedido.cidade} onChange={e => setNovoPedido({...novoPedido, cidade: e.target.value})} placeholder="Ex: São Paulo" />
                </div>
                <div>
                  <Label>UF *</Label>
                  <Input value={novoPedido.estado} onChange={e => setNovoPedido({...novoPedido, estado: e.target.value})} placeholder="Ex: SP" />
                </div>
                <div>
                  <Label>Destinatário</Label>
                  <Input value={novoPedido.destinatario} onChange={e => setNovoPedido({...novoPedido, destinatario: e.target.value})} placeholder="Nome" />
                </div>
                <div>
                  <Label>Endereço Completo</Label>
                  <Input value={novoPedido.enderecoCompleto} onChange={e => setNovoPedido({...novoPedido, enderecoCompleto: e.target.value})} placeholder="Rua, Número..." />
                </div>
                <div>
                  <Label>Peso (kg)</Label>
                  <Input type="number" value={novoPedido.pesoKg || ''} onChange={e => setNovoPedido({...novoPedido, pesoKg: parseFloat(e.target.value)})} placeholder="Ex: 5.5" />
                </div>
                <div>
                  <Label>Tipo Carga</Label>
                  <Select value={novoPedido.tipoCarga} onValueChange={v => setNovoPedido({...novoPedido, tipoCarga: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seco">Seco</SelectItem>
                      <SelectItem value="refrigerado">Refrigerado</SelectItem>
                      <SelectItem value="fragil">Frágil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={handleAdicionarManual}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Parada
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Importar Planilha</CardTitle>
              <CardDescription>
                Faça upload de uma planilha CSV ou Excel com os pedidos a serem roteirizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {importedPedidos.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center relative hover:bg-slate-50 transition-colors">
                  <input 
                    type="file" 
                    accept=".csv, .xlsx, .xls" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-sm text-gray-600 mb-4">
                    Arraste a planilha aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Formatos aceitos: .csv, .xlsx, .xls
                  </p>
                  <Button variant="outline" className="pointer-events-none">
                    {isUploading ? 'Processando...' : 'Selecionar Arquivo'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 border rounded-lg">
                    <div>
                      <h4 className="font-bold text-slate-800">Preview da Importação</h4>
                      <p className="text-sm text-slate-500">{importedPedidos.length} linhas processadas</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={limparImportacao}>Limpar</Button>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={confirmarImportacao}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirmar Importação
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Total Pedidos</p>
                      <p className="text-xl font-bold">{totaisImportados.totalPedidos}</p>
                    </div>
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Válidos</p>
                      <p className="text-xl font-bold text-green-600">
                        {importedPedidos.filter(p => !validarListaPedidos([p]).some(a => a.tipo === 'erro')).length}
                      </p>
                    </div>
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Inválidos (Bloqueados)</p>
                      <p className="text-xl font-bold text-red-600">
                        {importedPedidos.filter(p => validarListaPedidos([p]).some(a => a.tipo === 'erro')).length}
                      </p>
                    </div>
                    <div className="bg-white border rounded p-3 text-center">
                      <p className="text-xs text-muted-foreground">Cubagem / Peso</p>
                      <p className="text-sm font-bold text-blue-600">
                        {totaisImportados.cubagemTotalM3.toFixed(2)}m³ / {totaisImportados.pesoTotalKg.toFixed(0)}kg
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto border rounded-lg max-h-[400px]">
                    <Table>
                      <TableHeader className="bg-slate-100 sticky top-0 z-10">
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Nº Pedido</TableHead>
                          <TableHead>Destinatário</TableHead>
                          <TableHead>CEP</TableHead>
                          <TableHead>Cidade/UF</TableHead>
                          <TableHead>Peso</TableHead>
                          <TableHead>Cubagem</TableHead>
                          <TableHead>Alertas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importedPedidos.map((pedido, i) => {
                          const validacoes = validarListaPedidos([pedido]);
                          const erros = validacoes.filter(a => a.tipo === 'erro');
                          const avisos = validacoes.filter(a => a.tipo === 'aviso');
                          const statusColor = erros.length > 0 ? "bg-red-100 text-red-800" : avisos.length > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800";
                          const statusLabel = erros.length > 0 ? "Inválido" : avisos.length > 0 ? "Alerta" : "Válido";
                          
                          return (
                            <TableRow key={i} className={erros.length > 0 ? "bg-red-50/50" : ""}>
                              <TableCell><Badge variant="outline" className={statusColor}>{statusLabel}</Badge></TableCell>
                              <TableCell className="font-medium text-xs">{pedido.numeroPedido}</TableCell>
                              <TableCell className="text-xs">{pedido.destinatario}</TableCell>
                              <TableCell className="text-xs font-mono">{pedido.cep || '-'}</TableCell>
                              <TableCell className="text-xs">{pedido.cidade}/{pedido.estado}</TableCell>
                              <TableCell className="text-xs">{pedido.pesoKg}kg</TableCell>
                              <TableCell className="text-xs">{calcularCubagemPedido(pedido).toFixed(3)}m³</TableCell>
                              <TableCell className="text-xs max-w-xs truncate text-red-600">
                                {erros.length > 0 ? erros[0].mensagem : (avisos.length > 0 ? avisos[0].mensagem : "-")}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {fileError && <p className="text-red-500 mt-4 text-sm font-bold text-center">{fileError}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modelo da Planilha</CardTitle>
              <CardDescription>Baixe o modelo para preenchimento correto</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={downloadModeloPlanilha}>
                <Download className="w-4 h-4 mr-2" />
                Baixar Modelo CSV
              </Button>
              <div className="mt-4 overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {CABECALHO_PLANILHA.map(cab => (
                        <TableHead key={cab} className="text-xs whitespace-nowrap">{cab}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      {CABECALHO_PLANILHA.map((cab, idx) => (
                        <TableCell key={idx} className="text-xs text-muted-foreground whitespace-nowrap">exemplo</TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agrupamento" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agrupamento por Região/CEP</CardTitle>
              <CardDescription>Visualize como os pedidos foram agrupados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Por Faixa de CEP
                  </h4>
                  <div className="grid gap-2">
                    {gruposFaixaCep.map(grupo => (
                      <div key={grupo.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{grupo.nome}</p>
                          <p className="text-sm text-muted-foreground">{grupo.pedidos.length} pedidos</p>
                        </div>
                        <div className="text-right text-sm">
                          <p>{grupo.pesoTotalKg.toFixed(1)} kg</p>
                          <p className="text-muted-foreground">{grupo.cubagemTotalM3.toFixed(2)} m³</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <MapPinned className="w-4 h-4" />
                    Por Região/Bairro
                  </h4>
                  <div className="grid gap-2">
                    {gruposRegiao.map(grupo => (
                      <div key={grupo.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{grupo.nome}</p>
                          <p className="text-sm text-muted-foreground">{grupo.pedidos.length} pedidos</p>
                        </div>
                        <div className="text-right text-sm">
                          <p>{grupo.pesoTotalKg.toFixed(1)} kg</p>
                          <p className="text-muted-foreground">{grupo.cubagemTotalM3.toFixed(2)} m³</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="veiculos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Veículos Disponíveis</CardTitle>
              <CardDescription>Frota disponível para roteirização</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Região Base</TableHead>
                    <TableHead>Peso máx.</TableHead>
                    <TableHead>Cubagem máx.</TableHead>
                    <TableHead>Tipo Operação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contrato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {veiculos.map(veiculo => (
                    <TableRow key={veiculo.id}>
                      <TableCell className="font-medium">
                        {getIconeTipoVeiculo(veiculo.tipoVeiculo)} {getNomeTipoVeiculo(veiculo.tipoVeiculo)}
                      </TableCell>
                      <TableCell>{veiculo.placa}</TableCell>
                      <TableCell>{veiculo.motorista}</TableCell>
                      <TableCell>{veiculo.regiaoBase}</TableCell>
                      <TableCell>{veiculo.capacidadePesoKg} kg</TableCell>
                      <TableCell>{veiculo.capacidadeCubagemM3} m³</TableCell>
                      <TableCell>
                        <Badge variant={veiculo.tipoOperacao === 'refrigerado' ? 'blue' : 'outline'}>
                          {veiculo.tipoOperacao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={veiculo.disponivel ? 'default' : 'destructive'}>
                          {veiculo.disponivel ? 'Disponível' : 'Indisponível'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={veiculo.contratoOuAvulso === 'contrato' ? 'default' : 'outline'}>
                          {veiculo.contratoOuAvulso}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capacidades Padrão</CardTitle>
              <CardDescription>Valores de referência por tipo de veículo</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Capacidade Peso</TableHead>
                    <TableHead>Capacidade Cubagem</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CAPACIDADES_PADRAO_VEICULOS.map(cap => (
                    <TableRow key={cap.tipo}>
                      <TableCell className="font-medium">
                        {getIconeTipoVeiculo(cap.tipo as TipoVeiculo)} {cap.tipo.replace('_', ' ')}
                      </TableCell>
                      <TableCell>{cap.capacidadePesoKg} kg</TableCell>
                      <TableCell>{cap.capacidadeCubagemM3} m³</TableCell>
                      <TableCell className="text-muted-foreground">{cap.observacao || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        
        <TabsContent value="roteiros" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Roteiros Gerados</CardTitle>
                <CardDescription>Distribuição inteligente dos pedidos entre os veículos</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={calcularTodasAsRotas} 
                  disabled={isCalculandoRotas || distribuicao.length === 0}
                >
                  <MapIcon className="w-4 h-4 mr-2"/>
                  {isCalculandoRotas ? "Calculando..." : "Calcular Todas as Rotas"}
                </Button>
                <Button onClick={handleGerarRoteiros} disabled={isGerando}>
                   <Route className="w-4 h-4 mr-2"/>
                   {isGerando ? "Recalculando..." : "Atualizar Roteiros"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {distribuicao.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed">
                    <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum roteiro gerado.</p>
                    <p className="text-sm text-slate-500">Clique em "Gerar Roteiros Inteligentes" para distribuir a carga.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Rotas Geradas</p>
                         <p className="text-2xl font-bold">{distribuicao.length}</p>
                       </div>
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Pedidos Alocados</p>
                         <p className="text-2xl font-bold text-green-600">{resumo.totalPedidos - resumo.pedidosNaoAlocados}</p>
                       </div>
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Não Alocados</p>
                         <p className="text-2xl font-bold text-red-600">{resumo.pedidosNaoAlocados}</p>
                       </div>
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Ocupação Média</p>
                         <p className="text-2xl font-bold text-blue-600">{resumo.ocupacaoMedia.toFixed(1)}%</p>
                       </div>
                    </div>

                    {resumo.pedidosNaoAlocados > 0 && (
                      <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                           <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                           <div>
                             <h4 className="font-bold text-red-800">Atenção: {resumo.pedidosNaoAlocados} pedidos não alocados</h4>
                             <p className="text-sm text-red-600 mb-2">Estes pedidos excederam a capacidade da frota ou não possuem veículos compatíveis (ex: falta de refrigerado).</p>
                             <div className="bg-white/60 p-2 rounded text-sm text-red-800 font-medium border border-red-100">
                               Sugestão Extra: {
                                 sugerirVeiculosNecessarios(
                                   pedidos.filter(p => !distribuicao.some(d => d.pedidos.some(dp => dp.id === p.id))),
                                   ['seco', 'refrigerado']
                                 ).map(s => `${s.quantidade}x ${getNomeTipoVeiculo(s.tipo)}`).join(', ') || 'Nenhuma'
                               }
                             </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {distribuicao.map((resultado, idx) => {
                      const pesoUsado = resultado.pedidos.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
                      const cubagemUsada = resultado.pedidos.reduce((acc, p) => acc + calcularCubagemPedido(p), 0);
                      const ocupacaoPeso = resultado.veiculo.capacidadePesoKg > 0 ? (pesoUsado / resultado.veiculo.capacidadePesoKg) * 100 : 0;
                      const ocupacaoCubagem = resultado.veiculo.capacidadeCubagemM3 > 0 ? (cubagemUsada / resultado.veiculo.capacidadeCubagemM3) * 100 : 0;
                      
                      return (
                        <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-slate-50 p-4 border-b">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="text-3xl bg-white w-12 h-12 flex items-center justify-center rounded-lg shadow-sm border">
                                  {getIconeTipoVeiculo(resultado.veiculo.tipoVeiculo)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-slate-800">{getNomeTipoVeiculo(resultado.veiculo.tipoVeiculo)}</h3>
                                    <Badge variant="outline" className="font-mono bg-white">{resultado.veiculo.placa || 'S/PLACA'}</Badge>
                                    {resultado.veiculo.tipoOperacao === 'refrigerado' && (
                                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200"><Thermometer className="w-3 h-3 mr-1"/> Refrig.</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-500">{resultado.veiculo.motorista || 'Sem motorista vinculado'}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge variant={ocupacaoPeso > 90 || ocupacaoCubagem > 90 ? 'destructive' : ocupacaoPeso > 70 || ocupacaoCubagem > 70 ? 'default' : 'outline'} className="text-sm px-3 py-1">
                                  {Math.max(ocupacaoPeso, ocupacaoCubagem).toFixed(0)}% Ocupação Máx
                                </Badge>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => calcularDistanciaTempoUmaRota(resultado.pedidos, idx)}
                                    disabled={isCalculandoRotas}
                                  >
                                    <MapIcon className="w-3 h-3 mr-1" />
                                    {rotasCalculadas.get(idx) ? 'Recalcular' : 'Calcular Distância'}
                                  </Button>
                                  {rotasCalculadas.get(idx) && (
                                    <Button 
                                      size="sm" 
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => handleSalvarRotaNoSupabase(resultado, idx)}
                                      disabled={salvandoRota === idx}
                                    >
                                      <Save className="w-3 h-3 mr-1" />
                                      {salvandoRota === idx ? 'Salvando...' : 'Salvar Rota'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Paradas / Entregas</p>
                                <p className="font-bold text-slate-700">{resultado.pedidos.length}</p>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Peso (kg)</p>
                                <div className="flex items-end justify-between">
                                  <p className="font-bold text-slate-700">{pesoUsado.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ {resultado.veiculo.capacidadePesoKg}</span></p>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 mt-1 rounded-full overflow-hidden">
                                  <div className={`h-full ${ocupacaoPeso > 90 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(ocupacaoPeso, 100)}%` }}></div>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Cubagem (m³)</p>
                                <div className="flex items-end justify-between">
                                  <p className="font-bold text-slate-700">{cubagemUsada.toFixed(2)} <span className="text-xs font-normal text-slate-400">/ {resultado.veiculo.capacidadeCubagemM3}</span></p>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 mt-1 rounded-full overflow-hidden">
                                  <div className={`h-full ${ocupacaoCubagem > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(ocupacaoCubagem, 100)}%` }}></div>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Distância / Tempo</p>
                                {rotasCalculadas.get(idx) ? (
                                  <div>
                                    <p className="font-bold text-slate-700">{rotasCalculadas.get(idx)?.distanciaKm} km</p>
                                    <p className="text-xs text-slate-500">{rotasCalculadas.get(idx)?.tempoMin} min</p>
                                    <Badge variant={rotasCalculadas.get(idx)?.origem === 'mapbox' ? 'default' : 'outline'} className="text-[10px] mt-1">
                                      {rotasCalculadas.get(idx)?.origem === 'mapbox' ? 'Mapbox' : 'Estimado'}
                                    </Badge>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">Não calculado</p>
                                )}
                              </div>
                            </div>

                            {rotasCalculadas.get(idx)?.alertas && rotasCalculadas.get(idx)!.alertas.length > 0 && (
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                                {rotasCalculadas.get(idx)?.alertas.map((alerta, idxA) => (
                                  <p key={idxA} className="text-amber-700">⚠️ {alerta}</p>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                            <Table>
                              <TableHeader className="bg-slate-50 sticky top-0">
                                <TableRow>
                                  <TableHead className="w-12 text-center">#</TableHead>
                                  <TableHead>Pedido</TableHead>
                                  <TableHead>CEP</TableHead>
                                  <TableHead>Destinatário / Cidade</TableHead>
                                  <TableHead className="text-right">Peso</TableHead>
                                  <TableHead className="text-right">Cubagem</TableHead>
                                  <TableHead className="text-center">Tipo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {resultado.pedidos.map((pedido, i) => (
                                  <TableRow key={pedido.id} className="hover:bg-slate-50">
                                    <TableCell className="text-center text-slate-500">{i + 1}</TableCell>
                                    <TableCell className="font-medium text-xs">
                                      {pedido.numeroPedido}
                                      {pedido.prioridade === 'urgente' && <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0 h-4">URGENTE</Badge>}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono">{pedido.cep}</TableCell>
                                    <TableCell className="text-xs">
                                      <p className="font-medium truncate max-w-[150px]" title={pedido.destinatario}>{pedido.destinatario}</p>
                                      <p className="text-slate-500 truncate max-w-[150px]">{pedido.cidade}/{pedido.estado}</p>
                                    </TableCell>
                                    <TableCell className="text-right text-xs">{pedido.pesoKg} kg</TableCell>
                                    <TableCell className="text-right text-xs">{calcularCubagemPedido(pedido).toFixed(3)} m³</TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={pedido.secoOuRefrigerado === 'refrigerado' ? 'blue' : 'outline'} className="text-[10px]">
                                        {pedido.secoOuRefrigerado === 'refrigerado' ? 'Refri' : 'Seco'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
<TabsContent value="mapa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mapa de Visualização</CardTitle>
              <CardDescription>Visualização geográfica das rotas geradas (resumo)</CardDescription>
            </CardHeader>
            <CardContent>
              {distribuicao.length === 0 ? (
                <div className="h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">
                    Gere os roteiros e calcule as distâncias primeiro para visualizar no mapa
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-[600px] w-full rounded-lg overflow-hidden border">
                    <MapboxMap 
                      title="Rotas e Paradas"
                      locations={distribuicao.flatMap((res, rIdx) => 
                        res.pedidos.map((p, pIdx) => ({
                          id: p.id,
                          numero: p.numeroPedido,
                          latitude: p.latitude || 0,
                          longitude: p.longitude || 0,
                          status: "aguardando",
                          cliente: p.cliente,
                          sequencia: pIdx + 1
                        }))
                      ).filter(l => l.latitude !== 0 && l.longitude !== 0)}
                      routeCoordinates={Array.from(rotasCalculadas.values()).find(r => r.routeCoordinates && r.routeCoordinates.length > 0)?.routeCoordinates}
                    />
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                    <p className="text-sm text-amber-700">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      Visualizando o traçado da primeira rota calculada e as paradas de todas as rotas. 
                      Calcule a distância de cada rota na aba Roteiros para ver a linha da rota no mapa.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auditoria de Dados</CardTitle>
              <CardDescription>Validação e verificação de consistencia</CardDescription>
            </CardHeader>
            <CardContent>
              {alertasValidacao.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Todos os pedidos passaram na validação
                </p>
              ) : (
                <div className="space-y-2">
                  {alertasValidacao.map((alerta, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 border rounded-lg">
                      {getAlertaIcon(alerta.tipo)}
                      <div>
                        <p className="font-medium">{alerta.codigo}</p>
                        <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Pedidos</CardTitle>
              <CardDescription>Todos os pedidos carregados para roteirização</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CEP</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Peso</TableHead>
                    <TableHead>Cubagem</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidos.map(pedido => (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium">{pedido.numeroPedido}</TableCell>
                      <TableCell>{pedido.cliente}</TableCell>
                      <TableCell>{pedido.cep}</TableCell>
                      <TableCell>{pedido.cidade}</TableCell>
                      <TableCell>{pedido.pesoKg} kg</TableCell>
                      <TableCell>{calcularCubagemPedido(pedido).toFixed(3)} m³</TableCell>
                      <TableCell>
                        <Badge variant={pedido.secoOuRefrigerado === 'refrigerado' ? 'blue' : 'outline'}>
                          {pedido.secoOuRefrigerado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={pedido.prioridade === 'urgente' ? 'destructive' : pedido.prioridade === 'alta' ? 'default' : 'outline'}>
                          {pedido.prioridade}
                        </Badge>
                      </TableCell>
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

export default RoteirizadorWeb;