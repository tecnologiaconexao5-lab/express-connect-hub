import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Save, Plus, Trash2, Calendar, Shield, CreditCard, FileText, Truck, MapPin, CheckCircle, Package, Lightbulb, Upload, X, Download, File, FilePlus, Check, Route, AlertTriangle, Calculator, Clock, ChevronDown, CheckCircle2, MessageCircle, Copy as CopyIcon, Send, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { generateProfessionalPDF } from "@/lib/pdfGenerator";
import { OrdemServico, OSEndereco, OSHistorico, OSCarga, STATUS_CORES, OSStatus } from "./osTypes";
import { FavoritosDropdown, SaveFavoritoButton } from "@/components/enderecos/EnderecosFavoritos";
import CompartilharRastreioModal from "./CompartilharRastreioModal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { EnderecoCompleto, EnderecoType } from "@/components/ui/EnderecoCompleto";
import { TIPOS_VEICULO, sugerirVeiculo, VEICULO_PARAMETROS } from "@/constants/tiposVeiculo";
import { toOSInsert, toOSUpdate } from "@/lib/dbMappers";
import { calcularDistancia } from "@/services/maps";
import type { DistanceResult } from "@/services/maps/types";
import { calcularValorPorDistancia, ResultadoCalculo } from "@/services/financeiro/calculoService";
import { calcularCubagem, sugerirVeiculosPorCarga, verificarAlertasCubagem, type ResultadoCubagem, type SugestaoVeiculo, type AlertaCubagem } from "@/services/operacao/cargaService";
import { gerarMensagemWhatsAppOS, generatePDFCliente, generatePDFPrestador } from "@/lib/pdfGenerator";
import { copiarWhatsApp } from "@/lib/pdfGenerator";
import { enviarMensagem as WhatsAppEnviar } from "@/services/integracoes/whatsappService";
import { disparaEventoAutomacao } from "@/services/integracoes/automacaoCentralService";
import { enviarWebhookWhatsAppOSCriada } from "@/services/integracoes/whatsAppOSService";
import { enviarWhatsAppAutomatico } from "@/services/whatsappAutomation";
import {
  gerarMensagemOSCriada,
  gerarMensagemOSAtualizada,
  gerarMensagemPrestadorAcionado,
  gerarMensagemOSFinalizada,
  gerarMensagemOcorrenciaOS,
} from "@/services/osWhatsAppTemplates";

const separarNumeroLogradouro = (endereco: string): { logradouro: string; numero: string } => {
  const match = endereco?.match(/^(.+?),\s*(\d+)\s*[-–]?\s*$/);
  if (match) {
    return { logradouro: match[1].trim(), numero: match[2].trim() };
  }
  return { logradouro: endereco || "", numero: "" };
};

// ============================================================
// TESTE WHATSAPP REAL - remover após validação
// ============================================================
const testarWhatsAppReal = async () => {
  console.log("[TESTE WhatsApp] Iniciando teste real...");
  const testNumber = "SEU_NUMERO_AQUI".replace(/\D/g, "");
  const testMsg = "🚀 TESTE REAL TMS CONEXÃO EXPRESS - " + new Date().toISOString();
  
  const result = await WhatsAppEnviar(testNumber, testMsg);
  console.log("[TESTE WhatsApp] Resultado:", result);
  return result;
};

interface TabelaValorRow {
  id?: string;
  nome?: string;
  tipo_veiculo?: string;
  km_inicial?: number;
  km_final?: number;
  valor_base?: number;
  valor_km?: number;
  valor_km_excedente?: number;
  valor_minimo?: number;
  franquia_km?: number;
  percentual_prestador?: number;
  pedagio_incluso?: boolean;
  ativo?: boolean;
  universal?: boolean;
  cliente_id?: string;
}

const buscarTabelaValores = async (cliente: string, tipoVeiculo: string, km: number): Promise<TabelaValorRow | null> => {
  try {
    const tipoVeiculoNorm = tipoVeiculo?.toLowerCase().trim() || "";
    let { data: clienteTabela, error } = await supabase
      .from("tabelas_valores")
      .select("*")
      .ilike("tipo_veiculo", tipoVeiculoNorm)
      .lte("km_inicial", km)
      .gte("km_final", km)
      .eq("ativo", true);

    if (error) throw error;
    if (clienteTabela && clienteTabela.length > 0) {
      return clienteTabela[0] as TabelaValorRow;
    }
    return null;
  } catch (e) {
    console.error("Erro busca tabela:", e);
    return null;
  }
};

const calcularValorAutomatico = (tabela: TabelaValorRow | null, distanciaKm: number) => {
  if (!tabela) return { valor: 0, valorPrestador: 0, tabelaNome: "", pendente: true, descricao: "" };
  const valorBase = Number(tabela.valor_base) || 0;
  const franquiaKm = Number(tabela.franquia_km) || 0;
  const valorKmExcedente = Number(tabela.valor_km_excedente) || 0;
  const kmExcedente = Math.max(0, distanciaKm - franquiaKm);
  const valorCalculado = valorBase + (kmExcedente * valorKmExcedente);
  const valorPrestador = valorCalculado * ((tabela.percentual_prestador || 80) / 100);
  return {
    valor: valorCalculado,
    valorPrestador,
    tabelaNome: tabela.nome || "Tabela Padrão",
    pendente: false,
    descricao: `Base R$${valorBase} + ${kmExcedente}km exced.`
  };
};

interface SugestaoVeiculo { tipo: string; motivo: string; }

interface DocumentoOS {
  id: string;
  tipo: 'nf' | 'cte' | 'xml' | 'comprovante' | 'foto' | 'outro';
  nome: string;
  url?: string;
  dataUpload: string;
}

interface Props {
  os?: OrdemServico;
  modo: "ver" | "editar" | "novo";
  onVoltar: () => void;
  onSalvar: () => void;
}

const emptyEnd = (): OSEndereco => ({ sequencia: 1, tipo: "coleta", nomeLocal: "", endereco: "", referencia: "", instrucoes: "", contato: "", telefone: "", janelaInicio: "", janelaFim: "", agendamento: false, statusPonto: "pendente", observacoes: "" });

const emptyCarga = (): OSCarga => ({
  tipo: "Seca", descricao: "", volumes: 0, peso: 0, cubagem: 0, pallets: 0, valorDeclarado: 0, qtdNotas: 0,
  refrigerada: false, ajudante: false, fragil: false, empilhavel: true, risco: false, perigosa: false, controlada: false,
  conferencia: false, equipamento: "", condicao: "", comprimento: 0, largura: 0, altura: 0, pesoPorVolume: 0, 
  temperaturaMinima: 0, temperaturaMaxima: 0, observacoesCarga: ""
});

const emptyOS = (): OrdemServico => {
  const agora = new Date();
  const dataHoje = agora.toISOString().split("T")[0];
  return {
    numero: `OS-${agora.getFullYear()}${String(agora.getMonth()+1).padStart(2,'0')}-${Math.floor(Math.random()*9000)+1000}`,
    data: dataHoje, cliente: "", unidade: "", centroCusto: "", orcamentoOrigem: "", prestador: "", veiculoAlocado: "", veiculoPlaca: "",
    tipoOperacao: "Coleta e Entrega", modalidade: "esporadico", prioridade: "normal", status: "rascunho", responsavel: "", refCliente: "", pedidoInterno: "", slaOperacao: "", observacoesGerais: "",
    comprovanteObrigatorio: true, cteObrigatorio: false, xmlObrigatorio: false, operacaoDedicada: false,
    carga: emptyCarga(),
    veiculoTipo: "", veiculoSubcategoria: "", veiculoCarroceria: "", veiculoTermica: "seco", isReserva: false, retornoObrigatorio: false,
    dataProgramada: dataHoje, janelaOperacional: "", previsaoInicio: `${dataHoje}T${agora.getHours().toString().padStart(2,'0')}:${agora.getMinutes().toString().padStart(2,'0')}`, previsaoTermino: "", tipoEscala: "", instrucoesOperacionaisOS: "", observacaoTorre: "",
    tabelaAplicada: "", valorCliente: 0, custoPrestador: 0, pedagio: 0, ajudante: 0, adicionais: 0, descontos: 0, reembolsoPrevisto: 0, contaContabil: "", centroCustoFin: "", statusFaturamento: "a faturar", statusPagamento: "a pagar",
    emailDestinatario: "", whatsappDestinatario: "", notificarDestinatario: true, eventosTracker: "principais",
    enderecos: [emptyEnd()], historico: [{ data: new Date().toISOString(), acao: "OS Criada", status_novo: "rascunho", usuario: "Usuário" }]
  };
};

const Field = ({ label, children, className = "" }: { label: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <div className={className}>
    <Label className="text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between pr-1">{label}</Label>
    {children}
  </div>
);

const OrdemServicoForm = ({ os, modo, onVoltar, onSalvar }: Props) => {
  const [data, setData] = useState<OrdemServico>(os ? JSON.parse(JSON.stringify(os)) : emptyOS());
  const osInicialRef = useRef<OrdemServico>(data);
  const [isSaving, setIsSaving] = useState(false);
  const [sugestaoVeiculo, setSugestaoVeiculo] = useState<SugestaoVeiculo | null>(null);
  const [sugestoesVeiculo, setSugestoesVeiculo] = useState<SugestaoVeiculo[]>([]);
  const [resultadoCubagem, setResultadoCubagem] = useState<ResultadoCubagem | null>(null);
  const [alertasCubagem, setAlertasCubagem] = useState<AlertaCubagem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoOS[]>([]);
  const [calculandoDistancia, setCalculandoDistancia] = useState(false);
  const [distanciaRota, setDistanciaRota] = useState<DistanceResult | null>(null);
  const [faixaCalculada, setFaixaCalculada] = useState("");
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false);
  const [enviarWhatsAppAuto, setEnviarWhatsAppAuto] = useState(false);
  const readOnly = modo === "ver";
  const [visualizacaoOS, setVisualizacaoOS] = useState<"cliente" | "prestador">("cliente");

const calculaRotaEValor = async () => {
    try {
      const enderecos = data.enderecos ?? [];
      const origem = (enderecos ?? []).find(e => e?.tipo === "coleta" && e?.endereco?.trim()) || (enderecos ?? []).find(e => e?.endereco?.trim());
      const destino = [...(enderecos ?? [])].reverse().find(e => e?.tipo === "entrega" && e?.endereco?.trim()) || (enderecos ?? [])[(enderecos?.length ?? 1) - 1];
      
      if (!origem || !destino || !origem.endereco || !destino.endereco) {
        toast.warning("Adicione pelo menos dois endereços com coleta e entrega para calcular a rota.");
        return;
      }
      
      setCalculandoDistancia(true);
      toast.info("Calculando rota e distância...");
      const resultado = await calcularDistancia(origem.endereco, destino.endereco);
      
      if (!resultado) {
        toast.error("Não foi possível calcular a rota. Verifique os endereços.");
        return;
      }
      
      setDistanciaRota(resultado);
      setData(p => ({ 
        ...p, 
        distanciaKm: resultado.distanciaKm,
        tempoEstimado: resultado.duracaoTexto
      }));
      
      // Buscar tabela real primeiro
      if (data.veiculoTipo) {
        const tabela = await buscarTabelaValores(data.cliente, data.veiculoTipo, Math.ceil(resultado.distanciaKm));
        
        if (tabela) {
          const calc = calcularValorAutomatico(tabela, resultado.distanciaKm);
          setData(p => ({ 
            ...p, 
            valorCliente: calc.valor, 
            custoPrestador: calc.valorPrestador,
            tabelaAplicada: calc.tabelaNome,
            faixaAplicada: calc.descricao
          }));
          setFaixaCalculada(calc.descricao);
        } else {
          // Fallback Tabela Teste
          const resCalc = calcularValorPorDistancia({
            distanciaKm: resultado.distanciaKm,
            tipoVeiculo: data.veiculoTipo
          });
          
          if (resCalc.valorCliente > 0) {
            setData(p => ({ 
              ...p, 
              valorCliente: resCalc.valorCliente, 
              custoPrestador: resCalc.valorPrestador,
              tabelaAplicada: resCalc.tabelaAplicada,
              faixaAplicada: resCalc.faixaAplicada
            }));
            setFaixaCalculada(resCalc.faixaAplicada);
          } else {
            toast.error("Não foi possível calcular valor. Verifique distância e veículo.");
          }
        }
      }
      toast.success(`Rota calculada: ${resultado.distanciaTexto || resultado.distanciaKm + ' km'}`);
    } catch (e) {
      console.error("Erro no cálculo automático:", e);
      toast.error("Erro ao calcular rota: " + (e instanceof Error ? e.message : "Erro desconhecido"));
    } finally {
      setCalculandoDistancia(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(calculaRotaEValor, 2000);
    return () => clearTimeout(timer);
  }, [data.enderecos, data.veiculoTipo, data.cliente]);

  useEffect(() => {
    osInicialRef.current = data;
  }, [os]);

  const copiarWhatsApp = () => {
    const msg = gerarMensagemWhatsAppOS(data);
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  };

  const enviarWhatsAppPrestador = async () => {
    if (!data.prestador) {
      toast.error("Selecione um prestador antes de enviar via WhatsApp");
      return;
    }

    setEnviandoWhatsApp(true);
    const startTime = Date.now();

    try {
      const { data: prestadores } = await supabase
        .from("prestadores")
        .select("telefone")
        .eq("nome", data.prestador)
        .limit(1);

      if (!prestadores || prestadores.length === 0 || !prestadores[0].telefone) {
        toast.error("Telefone do prestador não encontrado");
        await registrarLog({
          tipo: 'whatsapp',
          acao: 'enviar_os_prestador',
          status: 'erro',
          mensagem: 'Telefone do prestador não encontrado',
          payload: { prestador: data.prestador, os: data.numero }
        });
        return;
      }

      const telefone = prestadores[0].telefone.replace(/\D/g, '');
      const msg = gerarMensagemWhatsAppOS(data);

      const result = await WhatsAppEnviar(telefone, msg);

      const duracao = Date.now() - startTime;

      if (result.ok) {
        toast.success(`Mensagem enviada para ${data.prestador}!`);
        await registrarLog({
          tipo: 'whatsapp',
          acao: 'enviar_os_prestador',
          status: 'sucesso',
          mensagem: `OS ${data.numero} enviada para prestador`,
          payload: { prestador: data.prestador, telefone, os: data.numero },
          duracaoMs: duracao
        });
      } else {
        toast.error(`Falha ao enviar: ${result.error}`);
        await registrarLog({
          tipo: 'whatsapp',
          acao: 'enviar_os_prestador',
          status: 'erro',
          mensagem: result.error || 'Erro desconhecido',
          payload: { prestador: data.prestador, os: data.numero },
          erro: result.error,
          duracaoMs: duracao
        });
      }
    } catch (e: any) {
      await registrarLog({
        tipo: 'whatsapp',
        acao: 'enviar_os_prestador',
        status: 'erro',
        mensagem: e.message || 'Erro ao enviar WhatsApp',
        payload: { prestador: data.prestador, os: data.numero },
        erro: e
      });
      toast.error("Erro ao enviar WhatsApp");
    } finally {
      setEnviandoWhatsApp(false);
    }
  };

  const update = (field: keyof OrdemServico, value: any) => setData(p => ({ ...p, [field]: value ?? (typeof p[field] === 'number' ? 0 : '') }));
  const updateCarga = (field: keyof OSCarga, value: any) => {
    const novaCarga = { ...data.carga, [field]: value ?? (typeof (data.carga as any)[field] === 'number' ? 0 : '') };
    setData(p => ({ ...p, carga: novaCarga }));
    
    const calcCubagem = calcularCubagem({
      peso: Number(novaCarga.peso) || 0,
      volumes: Number(novaCarga.volumes) || 0,
      comprimento: Number(novaCarga.comprimento) || 0,
      largura: Number(novaCarga.largura) || 0,
      altura: Number(novaCarga.altura) || 0,
      cubagem: Number(novaCarga.cubagem) || 0,
      tipo: novaCarga.tipo as any
    });
    setResultadoCubagem(calcCubagem);
    
    const alertas = verificarAlertasCubagem({
      peso: Number(novaCarga.peso) || 0,
      volumes: Number(novaCarga.volumes) || 0,
      comprimento: Number(novaCarga.comprimento) || 0,
      largura: Number(novaCarga.largura) || 0,
      altura: Number(novaCarga.altura) || 0,
      tipo: novaCarga.tipo as any
    }, calcCubagem);
    setAlertasCubagem(alertas);
    
    const novasSugestoes = sugerirVeiculosPorCarga({
      peso: Number(novaCarga.peso) || 0,
      volumes: Number(novaCarga.volumes) || 0,
      comprimento: Number(novaCarga.comprimento) || 0,
      largura: Number(novaCarga.largura) || 0,
      altura: Number(novaCarga.altura) || 0,
      cubagem: Number(novaCarga.cubagem) || 0,
      tipo: novaCarga.tipo as any
    });
    setSugestoesVeiculo(novasSugestoes);
    
    if (novasSugestoes.length > 0 && novasSugestoes[0].adequado) {
      setSugestaoVeiculo(novasSugestoes[0]);
      setData(p => ({ ...p, veiculoTipo: novasSugestoes[0].tipo }));
    } else {
      setSugestaoVeiculo(null);
    }
  };

  const sanitizeOrdemServicoPayload = (rawPayload: Record<string, any>): { payload: Record<string, any>; removed: string[] } => {
    const payloadSeguro: Record<string, any> = {
      numero: rawPayload.numero,
      data: rawPayload.data,
      cliente_id: rawPayload.cliente_id,
      unidade: rawPayload.unidade,
      centro_custo: rawPayload.centro_custo,
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

    console.log("[OS SAVE] Payload original:", rawPayload);
    console.log("[OS SAVE] Payload final enviado:", payloadSeguro);
    console.log("[OS SAVE] Campos removidos:", removed);

    return { payload: payloadSeguro, removed };
  };

  const handleSalvar = async () => {
    try {
      setIsSaving(true);
      const rawPayload = data.id ? toOSUpdate(data) : toOSInsert(data);
      
      const { payload: sanitizedPayload, removed } = sanitizeOrdemServicoPayload(rawPayload);

      const { data: dbResult, error } = data.id 
        ? await supabase.from("ordens_servico").update(sanitizedPayload).eq("id", data.id).select().single()
        : await supabase.from("ordens_servico").insert([sanitizedPayload]).select().single();

      if (error) throw error;
      const savedOS = dbResult;
      toast.success("Ordem de Serviço salva com sucesso!");

      if (enviarWhatsAppAuto && data.prestador) {
        setEnviandoWhatsApp(true);
        try {
          const { data: prestadores } = await supabase
            .from("prestadores")
            .select("telefone")
            .eq("nome", data.prestador)
            .limit(1);

          if (prestadores && prestadores.length > 0 && prestadores[0].telefone) {
            const telefone = prestadores[0].telefone.replace(/\D/g, '');
            const msg = gerarMensagemWhatsAppOS(data);
            const result = await WhatsAppEnviar(telefone, msg);
            
            if (result.ok) {
              toast.success(`WhatsApp enviado para ${data.prestador}!`);
              await registrarLog({
                tipo: 'whatsapp',
                acao: 'enviar_os_auto',
                status: 'sucesso',
                mensagem: `OS ${data.numero} enviada automaticamente`,
                payload: { prestador: data.prestador, telefone, os: data.numero }
              });
            } else {
              toast.error(`Falha ao enviar WhatsApp: ${result.error}`);
              await registrarLog({
                tipo: 'whatsapp',
                acao: 'enviar_os_auto',
                status: 'erro',
                mensagem: result.error || 'Erro ao enviar',
                payload: { prestador: data.prestador, os: data.numero },
                erro: result.error
              });
            }
          }
        } catch (e: any) {
          toast.error("Erro ao enviar WhatsApp: " + e.message);
        } finally {
          setEnviandoWhatsApp(false);
        }
      }

      const isNovaOS = !data.id;
      const tipoEvento = isNovaOS ? "OS_CRIADA" : "OS_ATUALIZADA";

      const enderecos = data.enderecos || [];
      const coleta = enderecos.find(e => e.tipo === "coleta");
      const entrega = [...enderecos].reverse().find(e => e.tipo === "entrega");

      const telefoneCliente = data.whatsappDestinatario || coleta?.telefone || "";
      const telefonePrestador = "";

      const automacaoResult = await disparaEventoAutomacao(
        "operacional",
        tipoEvento,
        {
          cliente: data.cliente,
          prestador: data.prestador,
          origem: coleta?.endereco || "",
          destino: entrega?.endereco || "",
          km: data.distanciaKm || data.distanciaRota?.distanciaKm || 0,
          tipoVeiculo: data.veiculoTipo,
          tipoCarga: data.carga?.tipo || "",
          valorCliente: data.valorCliente,
          valorPrestador: data.custoPrestador,
          status: data.status,
          telefoneCliente: telefoneCliente,
          telefonePrestador: telefonePrestador
        },
        {
          osId: savedOS?.id || data.id || "",
          telefoneCliente: telefoneCliente.replace(/\D/g, ""),
          telefonePrestador: telefonePrestador.replace(/\D/g, "")
        }
      );

      if (automacaoResult.sucesso) {
        console.log(`[AutomacaoCentral] ${tipoEvento} disparada com sucesso`);
      } else {
        console.warn(`[AutomacaoCentral] ${tipoEvento} falhou: ${automacaoResult.erro}`);
      }

      if (isNovaOS && telefoneCliente) {
        await enviarWebhookWhatsAppOSCriada(
          telefoneCliente,
          {
            origem: coleta?.endereco || "",
            destino: entrega?.endereco || "",
            cliente: data.cliente,
            numeroOS: data.numero
          }
        );
      }

      const msgContext = {
        numero: data.numero,
        cliente: data.cliente,
        origem: coleta?.endereco || "",
        destino: entrega?.endereco || "",
        prestador: data.prestador,
        status: data.status,
        placa: data.veiculoPlaca,
      };

      const osInicial = osInicialRef.current;
      const prestadorMudou = !!data.prestador && data.prestador !== osInicial.prestador;
      const statusFinalizada = data.status === "finalizada" && osInicial.status !== "finalizada";
      const statusOcorrencia = data.status === "ocorrencia" && osInicial.status !== "ocorrencia";
      const telefoneDestino = telefoneCliente || "5511912133010";

      enviarWhatsAppAutomatico({
        telefone: telefoneDestino,
        mensagem: isNovaOS ? gerarMensagemOSCriada(msgContext) : gerarMensagemOSAtualizada(msgContext),
      });

      if (prestadorMudou) {
        enviarWhatsAppAutomatico({
          telefone: telefoneDestino,
          mensagem: gerarMensagemPrestadorAcionado(msgContext),
        });
      }

      if (statusFinalizada) {
        enviarWhatsAppAutomatico({
          telefone: telefoneDestino,
          mensagem: gerarMensagemOSFinalizada(msgContext),
        });
      }

      if (statusOcorrencia) {
        enviarWhatsAppAutomatico({
          telefone: telefoneDestino,
          mensagem: gerarMensagemOcorrenciaOS(msgContext),
        });
      }

      onSalvar();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Header Fixo */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-50 sticky top-0">
        <div className="flex items-center gap-4 flex-1">
          {/* Botão Salvar fixo à esquerda */}
          {!readOnly && (
            <Button onClick={handleSalvar} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600 text-white min-w-[120px]">
              <Save className="w-4 h-4 mr-2" /> {isSaving ? "Salvando..." : "Salvar OS"}
            </Button>
          )}
          
          {/* Botões de visualização - só aparecem após salvar (data.id existe) */}
          {modo === "ver" && data.id && (
            <div className="flex gap-2 items-center">
              <div className="bg-slate-100 rounded-lg p-1 flex">
                <Button 
                  variant={visualizacaoOS === "cliente" ? "default" : "ghost"} 
                  size="sm"
                  onClick={() => setVisualizacaoOS("cliente")}
                  className={visualizacaoOS === "cliente" ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  <Eye className="w-4 h-4 mr-2" /> OS Cliente
                </Button>
                <Button 
                  variant={visualizacaoOS === "prestador" ? "default" : "ghost"} 
                  size="sm"
                  onClick={() => setVisualizacaoOS("prestador")}
                  className={visualizacaoOS === "prestador" ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  <Truck className="w-4 h-4 mr-2" /> OS Prestador
                </Button>
              </div>
              
              {visualizacaoOS === "prestador" && (
                <>
                    <Button variant="outline" className="border-green-200 text-green-600 hover:bg-green-50" onClick={copiarWhatsApp}>
                      <CopyIcon className="w-4 h-4 mr-2" /> Copiar WhatsApp
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-green-600 text-green-700 hover:bg-green-50" 
                      onClick={enviarWhatsAppPrestador}
                      disabled={enviandoWhatsApp || !data.prestador}
                    >
                      <Send className="w-4 h-4 mr-2" /> {enviandoWhatsApp ? "Enviando..." : "Enviar WhatsApp"}
                    </Button>
                  </>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50">
                    <Download className="w-4 h-4 mr-2" /> PDF OS
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => generatePDFCliente(data)}>
                    <FileText className="w-4 h-4 mr-2" /> PDF Cliente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => generatePDFPrestador(data)}>
                    <Truck className="w-4 h-4 mr-2" /> PDF Prestador
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          
          {/* Durante criação (novo/editar), mostrar apenas info */}
          {!readOnly && !data.id && (
            <div className="text-sm text-muted-foreground">
              OS ainda não salva. Salve primeiro para liberar ações.
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{data.cliente || "Cliente não definido"} • {data.unidade || "Unidade não definida"}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="max-w-7xl mx-auto space-y-6 pb-24">
          <Tabs defaultValue="identificacao" className="w-full">
            <TabsList className="bg-white border p-1 rounded-xl mb-6 shadow-sm flex flex-wrap h-auto gap-1">
              <TabsTrigger value="identificacao" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-4 py-2 text-xs font-semibold"><FileText className="w-4 h-4 mr-2"/> 1. Identificação</TabsTrigger>
              <TabsTrigger value="carga" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-4 py-2 text-xs font-semibold"><Package className="w-4 h-4 mr-2"/> 2. Carga</TabsTrigger>
              <TabsTrigger value="veiculo" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-4 py-2 text-xs font-semibold"><Truck className="w-4 h-4 mr-2"/> 3. Veículo</TabsTrigger>
              <TabsTrigger value="enderecos" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-4 py-2 text-xs font-semibold"><MapPin className="w-4 h-4 mr-2"/> 4. Rotas e Paradas</TabsTrigger>
              <TabsTrigger value="valores" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-4 py-2 text-xs font-semibold"><CreditCard className="w-4 h-4 mr-2"/> 5. Torre & Financeiro</TabsTrigger>
              <TabsTrigger value="historico" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-4 py-2 text-xs font-semibold"><Clock className="w-4 h-4 mr-2"/> 6. Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="identificacao" className="space-y-6">
              <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-primary"/> Dados Gerais</CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  <Field label="Nº OS"><Input value={data.numero} readOnly className="bg-slate-50 font-bold" /></Field>
                  <Field label="Data de Emissão"><Input type="date" value={data.data} readOnly={readOnly} onChange={(e) => update("data", e.target.value)} /></Field>
                  <Field label="Cliente">
                    <SearchableSelect table="clientes" labelField="nome_fantasia" valueField="nome_fantasia" returnField="id" value={data.cliente} onChange={(v, record) => { update("cliente", v); update("clienteId", record?.id || null); }} disabled={readOnly} searchFields={["nome_fantasia", "razao_social"]} />
                  </Field>
                  <Field label="Tipo de Operação">
                    <Select value={data.tipoOperacao} onValueChange={(v) => update("tipoOperacao", v)} disabled={readOnly}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Coleta">Coleta</SelectItem>
                        <SelectItem value="Entrega">Entrega</SelectItem>
                        <SelectItem value="Coleta e Entrega">Coleta e Entrega</SelectItem>
                        <SelectItem value="Transferência">Transferência</SelectItem>
                        <SelectItem value="Retirada">Retirada</SelectItem>
                        <SelectItem value="Distribuição">Distribuição</SelectItem>
                        <SelectItem value="Reentrega">Reentrega</SelectItem>
                        <SelectItem value="Devolução">Devolução</SelectItem>
                        <SelectItem value="Apoio Operacional">Apoio Operacional</SelectItem>
                        <SelectItem value="Dedicado">Dedicado</SelectItem>
                        <SelectItem value="Emergencial">Emergencial</SelectItem>
                        <SelectItem value="Agendado">Agendado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Unidade"><Input value={data.unidade} readOnly={readOnly} onChange={(e) => update("unidade", e.target.value)} /></Field>
                  <div className="md:col-span-3 lg:col-span-4">
                    <Field label="Instruções Operacionais da OS">
                      <Textarea value={data.instrucoesOperacionaisOS} readOnly={readOnly} onChange={(e) => update("instrucoesOperacionaisOS", e.target.value)} rows={3} placeholder="Descreva aqui orientações importantes para a coleta, entrega e restrições do cliente..." />
                    </Field>
                  </div>
                  
                  <div className="md:col-span-3 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-bold text-blue-900 flex items-center gap-2"><Calendar className="w-4 h-4"/> Serviço Programado?</Label>
                        <Switch checked={!!data.dataProgramada} onCheckedChange={(v) => {
                          if (v) {
                            update("dataProgramada", new Date().toISOString().split("T")[0]);
                          } else {
                            update("dataProgramada", "");
                          }
                        }} disabled={readOnly} />
                      </div>
                      {data.dataProgramada && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                          <Field label="Data Programada"><Input type="date" value={data.dataProgramada} readOnly={readOnly} onChange={(e) => update("dataProgramada", e.target.value)} /></Field>
                          <Field label="Observações"><Textarea value={data.observacaoTorre} readOnly={readOnly} onChange={(e) => update("observacaoTorre", e.target.value)} rows={2} /></Field>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <Field label="Status Operacional">
                        <Select value={data.status} onValueChange={(v) => update("status", v)} disabled={readOnly}>
                          <SelectTrigger className="h-10 font-semibold"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CORES).map(([key, val]) => (
                              <SelectItem key={key} value={key} className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full inline-block mr-2 ${val.twClass.split(' ')[0]}`}></span> {val.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Prioridade">
                        <Select value={data.prioridade} onValueChange={(v) => update("prioridade", v)} disabled={readOnly}>
                          <SelectTrigger><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="urgente">Urgente / Crítica</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="enderecos" className="space-y-6">
              <div className="flex items-center justify-between sticky top-0 bg-slate-50 py-2 z-10">
                <h3 className="text-lg font-bold flex items-center gap-2"><MapPin className="w-5 h-5 text-primary"/> Itinerário da OS</h3>
                {!readOnly && (
                  <Button onClick={() => update("enderecos", [...(data.enderecos || []), emptyEnd()])} variant="outline" className="border-primary text-primary hover:bg-primary/5">
                    <Plus className="w-4 h-4 mr-2"/> Adicionar Parada
                  </Button>
                )}
              </div>
              
{data.enderecos && data.enderecos.length > 0 ? (
                <div className="space-y-4">
                  {data.enderecos.map((end, idx) => (
                    <Card key={idx} className="border-none shadow-sm rounded-xl overflow-hidden group">
                      <CardHeader className="bg-slate-50 py-3 flex flex-row items-center justify-between px-6">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="rounded-full w-6 h-6 flex items-center justify-center p-0 font-bold">{idx + 1}</Badge>
                          <Select value={end.tipo || "coleta"} onValueChange={(v) => {
                            const e = [...(data.enderecos || [])];
                            e[idx].tipo = v as any;
                            update("enderecos", e);
                          }} disabled={readOnly}>
                            <SelectTrigger className="w-[120px] h-8 text-xs font-bold uppercase"><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="coleta">Coleta</SelectItem>
                              <SelectItem value="entrega">Entrega</SelectItem>
                              <SelectItem value="apoio">Apoio Operacional</SelectItem>
                              <SelectItem value="retorno">Retorno</SelectItem>
                              <SelectItem value="devolucao">Devolução</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-sm font-semibold text-slate-700">{end.nomeLocal || "Nova Parada"}</span>
                        </div>
                        {!readOnly && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 transition-colors" onClick={() => update("enderecos", (data.enderecos || []).filter((_, i) => i !== idx))}>
                            <Trash2 className="w-4 h-4"/>
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div className="md:col-span-3">
                           <EnderecoCompleto 
                             label="Endereço"
                             value={{
                               cep: end.cep || "", logradouro: end.logradouro || "", numero: end.numero || "",
                               bairro: end.bairro || "", cidade: end.cidade || "", estado: end.estado || "",
                               referencia: end.instrucoes || "", latitude: end.latitude, longitude: end.longitude,
                             } as any}
                             onChange={(obj) => {
                               const e = [...(data.enderecos || [])];
                               const { logradouro: log, numero: num } = separarNumeroLogradouro(obj.logradouro || "");
                               e[idx] = { 
                                 ...e[idx], 
                                 ...obj, 
                                 logradouro: obj.logradouro || log,
                                 numero: obj.numero || num,
                                 bairro: obj.bairro || end.bairro || "",
                                 cidade: obj.cidade || end.cidade || "",
                                 estado: obj.estado || end.estado || "",
                                 endereco: `${obj.logradouro || log}${obj.numero || num ? ', ' + (obj.numero || num) : ''} - ${obj.bairro || ''}, ${obj.cidade || ''}/${obj.estado || ''}`.replace(/^ - |\/$/g, "")
                               };
                               update("enderecos", e);
                             }}
                             readOnly={readOnly}
                           />
                         </div>
                         <div className="space-y-4">
                            <Field label="Nome Local"><Input value={end.nomeLocal || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].nomeLocal = e.target.value; update("enderecos", t); }} placeholder="Ex: Hospital X, Fábrica Y..." /></Field>
                            <div className="grid grid-cols-2 gap-2">
                               <Field label="Setor"><Input value={end.setor || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].setor = e.target.value; update("enderecos", t); }} /></Field>
                               <Field label="Responsável"><Input value={end.responsavel || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].responsavel = e.target.value; update("enderecos", t); }} /></Field>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <Field label="Telefone"><Input value={end.telefone || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].telefone = e.target.value; update("enderecos", t); }} /></Field>
                               <Field label="Ramal"><Input value={end.ramal || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].ramal = e.target.value; update("enderecos", t); }} /></Field>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <Field label="Email"><Input type="email" value={end.email || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].email = e.target.value; update("enderecos", t); }} placeholder="email@ex.com" /></Field>
                               <Field label="Canal">
                                 <Select value={end.enviarWhatsApp ? "whatsapp" : "email"} onValueChange={(v) => { const t = [...(data.enderecos || [])]; t[idx].enviarWhatsApp = v === "whatsapp"; update("enderecos", t); }} disabled={readOnly}>
                                   <SelectTrigger><SelectValue/></SelectTrigger>
                                   <SelectContent>
                                     <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                     <SelectItem value="email">Email</SelectItem>
                                   </SelectContent>
                                 </Select>
                               </Field>
                            </div>
                            <Field label="Janela Operacional">
                              <div className="flex items-center gap-2">
                                <Input type="time" value={end.janelaInicio || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].janelaInicio = e.target.value; update("enderecos", t); }} />
                                <span>às</span>
                                <Input type="time" value={end.janelaFim || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].janelaFim = e.target.value; update("enderecos", t); }} />
                              </div>
                            </Field>
                            <Field label="Observação do Ponto"><Textarea value={end.observacaoPonto || ""} readOnly={readOnly} onChange={(e) => { const t = [...(data.enderecos || [])]; t[idx].observacaoPonto = e.target.value; update("enderecos", t); }} rows={2} /></Field>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-slate-400">Nenhum endereço adicionado</div>
              )}
              
              <div className="flex items-center justify-between mb-4">
                <Button 
                  onClick={calculaRotaEValor} 
                  disabled={calculandoDistancia || !data.enderecos || data.enderecos.length < 2}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Route className="w-4 h-4 mr-2" /> 
                  {calculandoDistancia ? "Calculando..." : "Calcular Rota"}
                </Button>
                {calculandoDistancia && <span className="text-sm text-green-600">Calculando distância e tempo...</span>}
              </div>

              {(distanciaRota || data.distanciaKm) && (
                <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-green-50/50 border-green-100">
                  <CardHeader className="bg-green-50 pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-green-700"><Route className="w-4 h-4"/> Resumo da Rota</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                        <p className="text-xs text-green-600 font-medium">Distância Total</p>
                        <p className="text-xl font-bold text-green-800">{distanciaRota?.distanciaTexto || `${data.distanciaKm || 0} km`}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                        <p className="text-xs text-green-600 font-medium">Tempo Estimado</p>
                        <p className="text-xl font-bold text-green-800">{distanciaRota?.duracaoTexto || data.tempoEstimado || "—"}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                        <p className="text-xs text-green-600 font-medium">Pontos</p>
                        <p className="text-xl font-bold text-green-800">{data.enderecos?.length || 0}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-green-100">
                        <p className="text-xs text-green-600 font-medium">Pedágio</p>
                        <p className="text-xs font-bold text-green-800">{data.pedagio > 0 ? `R$ ${data.pedagio.toFixed(2)}` : "Não identificado"}</p>
                        <p className="text-[9px] text-green-600">Informe manualmente se houver</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4">
                      <Select value="rapida" onValueChange={() => {}} disabled={readOnly}>
                        <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Tipo de rota" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rapida">Rota mais rápida</SelectItem>
                          <SelectItem value="curta">Rota mais curta</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-green-700">Use o cálculo atual com distância e tempo estimado calculado automaticamente</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="carga" className="space-y-6">
              <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2"><Package className="w-5 h-5 text-primary"/> Detalhamento da Carga</CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                  <Field label="Tipo Carga" className="lg:col-span-2">
                    <Select value={data.carga.tipo} onValueChange={(v) => updateCarga("tipo", v)} disabled={readOnly}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Seca">Seca</SelectItem>
                        <SelectItem value="Refrigerada">Refrigerada</SelectItem>
                        <SelectItem value="Congelada">Congelada</SelectItem>
                        <SelectItem value="Mista">Mista</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Descrição" className="lg:col-span-4"><Input value={data.carga.descricao} readOnly={readOnly} onChange={(e) => updateCarga("descricao", e.target.value)} /></Field>
                  <Field label="Volumes"><Input type="number" value={data.carga.volumes} readOnly={readOnly} onChange={(e) => updateCarga("volumes", Number(e.target.value))} /></Field>
                  <Field label="Peso (Kg)"><Input type="number" value={data.carga.peso} readOnly={readOnly} onChange={(e) => updateCarga("peso", Number(e.target.value))} /></Field>
                  <Field label="Cubagem (m³)">
                    <Input type="number" value={data.carga.cubagem || resultadoCubagem?.cubagemTotal || 0} readOnly={readOnly} onChange={(e) => updateCarga("cubagem", Number(e.target.value))} />
                    {resultadoCubagem?.cubagemManual && <span className="text-xs text-amber-600 italic">Cubagem alterada manualmente</span>}
                  </Field>
                  <Field label="Valor Declarado"><Input type="number" value={data.carga.valorDeclarado} readOnly={readOnly} onChange={(e) => updateCarga("valorDeclarado", Number(e.target.value))} /></Field>
                  
                  <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <Field label="Dimensões (CxLxA cm)">
                      <div className="flex items-center gap-1">
                        <Input type="number" placeholder="C" value={data.carga.comprimento} readOnly={readOnly} onChange={(e) => updateCarga("comprimento", Number(e.target.value))} />
                        <Input type="number" placeholder="L" value={data.carga.largura} readOnly={readOnly} onChange={(e) => updateCarga("largura", Number(e.target.value))} />
                        <Input type="number" placeholder="A" value={data.carga.altura} readOnly={readOnly} onChange={(e) => updateCarga("altura", Number(e.target.value))} />
                      </div>
                    </Field>
                    <Field label="Peso por Volume (kg)">
                      <Input type="number" value={resultadoCubagem?.pesoPorVolume?.toFixed(2) || data.carga.pesoPorVolume || 0} readOnly className="bg-slate-50" />
                    </Field>
                    {(data.carga.tipo === 'Refrigerada' || data.carga.tipo === 'Congelada' || data.carga.tipo === 'Mista') && (
                      <Field label="Temperatura (Mín/Máx)">
                        <div className="flex items-center gap-2">
                          <Input type="number" placeholder="Min" value={data.carga.temperaturaMinima} readOnly={readOnly} onChange={(e) => updateCarga("temperaturaMinima", Number(e.target.value))} />
                          <Input type="number" placeholder="Max" value={data.carga.temperaturaMaxima} readOnly={readOnly} onChange={(e) => updateCarga("temperaturaMaxima", Number(e.target.value))} />
                        </div>
                      </Field>
                    )}
                  </div>

                  <div className="lg:col-span-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">Volume Unit.</p>
                        <p className="text-lg font-bold text-blue-800">{resultadoCubagem?.volumeUnitario?.toFixed(4) || "0.0000"} m³</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">Peso/Volume</p>
                        <p className="text-lg font-bold text-blue-800">{resultadoCubagem?.pesoPorVolume?.toFixed(2) || "0.00"} kg</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">Cubagem Total</p>
                        <p className="text-lg font-bold text-blue-800">{resultadoCubagem?.cubagemTotal?.toFixed(4) || "0.0000"} m³</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-blue-600 font-medium">Tipo Carga</p>
                        <p className="text-lg font-bold text-blue-800">{resultadoCubagem?.tipoCarga || "Seca"}</p>
                      </div>
                    </div>
                    
                    {(alertasCubagem ?? []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {(alertasCubagem ?? []).map((alerta: any, i: number) => (
                          <div key={i} className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                            alerta.tipo === "alerta" ? "bg-red-50 text-red-700 border border-red-200" :
                            alerta.tipo === "aviso" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            <AlertTriangle className="w-4 h-4" />
                            <span>{alerta.mensagem}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-6">
                    <Field label="Observações da Carga"><Textarea value={data.carga.observacoesCarga} readOnly={readOnly} onChange={(e) => updateCarga("observacoesCarga", e.target.value)} rows={2} /></Field>
                  </div>

                  <div className="lg:col-span-6 grid grid-cols-2 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-100 mt-2">
                    <div className="flex items-center gap-3"><Switch checked={data.carga.refrigerada || data.carga.tipo === 'Refrigerada'} onCheckedChange={(v) => updateCarga("refrigerada", v)} disabled={readOnly} /><Label className="text-sm font-medium">Refrigerada</Label></div>
                    <div className="flex items-center gap-3"><Switch checked={data.carga.fragil} onCheckedChange={(v) => updateCarga("fragil", v)} disabled={readOnly} /><Label className="text-sm font-medium">Frágil</Label></div>
                    <div className="flex items-center gap-3"><Switch checked={data.carga.ajudante} onCheckedChange={(v) => updateCarga("ajudante", v)} disabled={readOnly} /><Label className="text-sm font-medium">Ajudante</Label></div>
                    <div className="flex items-center gap-3"><Switch checked={data.carga.risco} onCheckedChange={(v) => updateCarga("risco", v)} disabled={readOnly} /><Label className="text-sm font-medium">Carga de Risco</Label></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="veiculo" className="space-y-6">
              {sugestoesVeiculo.length > 0 && (
                <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-blue-50/50 border-blue-100">
                  <CardHeader className="bg-blue-50 pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-700"><Truck className="w-4 h-4"/> Sugestões por Carga</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
<div className="flex flex-wrap gap-2">
                      {(sugestoesVeiculo ?? []).slice(0, 4).map((s: any, i: number) => (
                        <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${s.adequado ? 'bg-white border-blue-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{s.label}</span>
                            <span className="text-[10px] text-muted-foreground">{s.motivo}</span>
                          </div>
                          <Button 
                            variant={s.adequado ? "default" : "outline"} 
                            size="sm" 
                            className="ml-2 h-7 text-xs" 
                            onClick={() => {
                              if (s && s.tipo) {
                                update("veiculoTipo", s.tipo);
                                const tipoCarga = data?.carga?.tipo;
                                if (tipoCarga === "Refrigerada" || tipoCarga === "Congelada" || tipoCarga === "Mista") {
                                  update("veiculoTermica", s.refrigerado ? (tipoCarga === "Congelada" ? "congelado" : "refrigerado") : "seco");
                                }
                                toast.success(`${s.label} selecionado`);
                              }
                            }} 
                            disabled={readOnly || !s?.adequado}
                          >Aplicar</Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-blue-600 flex items-center gap-4">
                      <span>Peso necessário: <strong>{resultadoCubagem?.cubagemTotal ? (data.carga.peso || 0) + ' kg' : 'N/A'}</strong></span>
                      <span>Cubagem necessária: <strong>{resultadoCubagem?.cubagemTotal?.toFixed(4) || '0'} m³</strong></span>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-primary"/> Especificações do Veículo</CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Field label="Tipo de Veículo">
                    <Select value={data.veiculoTipo} onValueChange={(v) => update("veiculoTipo", v)} disabled={readOnly}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {TIPOS_VEICULO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Sugestão por Carga">
                    <div className="flex items-center gap-2">
                      <Input value={sugestaoVeiculo?.label || "—"} readOnly className="bg-slate-50 italic text-blue-600" />
                      <Button variant="outline" size="sm" onClick={() => {
                        if (sugestaoVeiculo?.tipo) {
                          update("veiculoTipo", sugestaoVeiculo.tipo);
                          toast.info(`Veículo ${sugestaoVeiculo.label} selecionado`);
                        }
                      }} disabled={readOnly || !sugestaoVeiculo}>Aplicar</Button>
                    </div>
                    {sugestaoVeiculo?.motivo && (
                      <span className="text-xs text-blue-600 italic">{sugestaoVeiculo.motivo}</span>
                    )}
                  </Field>
                  <Field label="Classificação Térmica">
                    <Select value={data.veiculoTermica} onValueChange={(v) => update("veiculoTermica", v)} disabled={readOnly}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="seco">Baú Seco</SelectItem><SelectItem value="refrigerado">Refrigerado</SelectItem><SelectItem value="congelado">Congelado</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  <Field label="Carroceria">
                     <Select value={data.veiculoCarroceria} onValueChange={(v) => update("veiculoCarroceria", v)} disabled={readOnly}>
                       <SelectTrigger><SelectValue/></SelectTrigger>
                       <SelectContent><SelectItem value="bau">Baú Fechado</SelectItem><SelectItem value="sider">Sider</SelectItem><SelectItem value="grade">Grade Baixa</SelectItem><SelectItem value="carreta">Carreta</SelectItem></SelectContent>
                     </Select>
                  </Field>
                  <div className="flex items-center gap-3 mt-6 lg:col-span-2"><Switch checked={data.retornoObrigatorio} onCheckedChange={(v) => update("retornoObrigatorio", v)} disabled={readOnly} /><Label className="text-sm font-medium text-orange-700">Retorno Obrigatório (Logística Reversa)</Label></div>
                  <div className="lg:col-span-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    <span>Veículo sugerido automaticamente com base na carga. Pode ser alterado pela torre conforme disponibilidade.</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

<TabsContent value="valores" className="space-y-6">
              <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-blue-50/30 border-blue-100">
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Valor Cliente</p>
                      <p className="text-lg font-bold text-blue-700">R$ {data.valorCliente.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-orange-600 font-medium">Prestador</p>
                      <p className="text-lg font-bold text-orange-700">R$ {data.custoPrestador.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 font-medium">Pedágio</p>
                      <p className="text-lg font-bold text-green-700">R$ {data.pedagio.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 font-medium">Margem</p>
                      <p className="text-lg font-bold text-purple-700">{data.valorCliente > 0 ? (((data.valorCliente - data.custoPrestador) / data.valorCliente) * 100).toFixed(1) : 0}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Distância</p>
                      <p className="text-lg font-bold text-slate-700">{distanciaRota?.distanciaKm?.toFixed(1) || data.distanciaKm || 0} km</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Tabela</p>
                      <p className="text-xs font-bold text-slate-700">{data.tabelaAplicada || "Padrão"}</p>
                    </div>
                  </div>
                  {faixaCalculada && (
                    <div className="mt-2 text-xs text-center text-slate-500">
                      {faixaCalculada} • Distância calculada automaticamente a partir da rota •{" "}
                      <span className="text-blue-600">Valores calculados conforme tabela do cliente ou fallback teste</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-md rounded-2xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary"/> Composição Financeira</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500">Valores Operacionais</h4>
                        <Field label="Valor p/ Cliente">
                          <div className="relative">
                            <Input type="number" value={data.valorCliente} readOnly={readOnly} onChange={(e) => update("valorCliente", Number(e.target.value))} className="text-lg font-bold text-blue-600 pr-8" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-400">R$</span>
                          </div>
                        </Field>
                        <Field label="Valor p/ Prestador">
                          <div className="relative">
                            <Input type="number" value={data.custoPrestador} readOnly={readOnly} onChange={(e) => update("custoPrestador", Number(e.target.value))} className="text-lg font-bold text-orange-600 pr-8" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-orange-400">R$</span>
                          </div>
                        </Field>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500">Adicionais e Taxas</h4>
                        <div className="grid grid-cols-2 gap-2">
                           <Field label="Pedágio">
                             <div className="relative">
                               <Input type="number" value={data.pedagio} readOnly={readOnly} onChange={(e) => update("pedagio", Number(e.target.value))} />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                             </div>
                           </Field>
                           <Field label="Ajudante">
                             <div className="relative">
                               <Input type="number" value={data.ajudante} readOnly={readOnly} onChange={(e) => update("ajudante", Number(e.target.value))} />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                             </div>
                           </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                           <Field label="Adicionais">
                             <div className="relative">
                               <Input type="number" value={data.adicionais} readOnly={readOnly} onChange={(e) => update("adicionais", Number(e.target.value))} />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                             </div>
                           </Field>
                           <Field label="Desconto">
                             <div className="relative">
                               <Input type="number" value={data.descontos} readOnly={readOnly} onChange={(e) => update("descontos", Number(e.target.value))} />
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                             </div>
                           </Field>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <Field label="Status Faturamento">
                         <Select value={data.statusFaturamento} onValueChange={(v) => update("statusFaturamento", v)} disabled={readOnly}>
                           <SelectTrigger><SelectValue/></SelectTrigger>
                           <SelectContent>
                             <SelectItem value="a vista">A vista</SelectItem>
                             <SelectItem value="a faturar">A faturar</SelectItem>
                             <SelectItem value="contrato">Contrato</SelectItem>
                             <SelectItem value="cortesia">Cortesia</SelectItem>
                             <SelectItem value="cancelado">Cancelado</SelectItem>
                           </SelectContent>
                         </Select>
                       </Field>
                       <Field label="Forma de Cobrança">
                         <Input value={data.tabelaAplicada || "Padrão"} readOnly className="bg-slate-50" />
                       </Field>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-primary/5 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-primary"><Truck className="w-5 h-5"/> Alocação Torre</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <Field label="Data Programada"><Input type="date" value={data.dataProgramada} readOnly={readOnly} onChange={(e) => update("dataProgramada", e.target.value)} /></Field>
                    <Field label="Início Previsto"><Input type="datetime-local" value={data.previsaoInicio} readOnly={readOnly} onChange={(e) => update("previsaoInicio", e.target.value)} /></Field>
                    <Field label="Parceiro / Prestador">
                      <SearchableSelect table="prestadores" labelField="nome" valueField="nome" value={data.prestador} onChange={(v) => update("prestador", v)} disabled={readOnly} />
                    </Field>
                    <Field label="Placa Alocada"><Input value={data.veiculoPlaca} readOnly={readOnly} onChange={(e) => update("veiculoPlaca", e.target.value)} placeholder="ABC-1234" /></Field>
                   
                   <div className="flex items-center justify-between pt-4 border-t">
                     <div className="flex items-center gap-2">
                       <Switch checked={enviarWhatsAppAuto} onCheckedChange={(v) => setEnviarWhatsAppAuto(v)} disabled={readOnly || !data.prestador} />
                       <Label className="text-sm font-medium">Enviar WhatsApp auto ao salvar</Label>
                     </div>
                     {enviarWhatsAppAuto && data.prestador && (
                       <Badge variant="outline" className="text-green-600 border-green-300"> will send to {data.prestador}</Badge>
                     )}
                   </div>

                   <Card className="mt-4 border-none shadow-md rounded-2xl overflow-hidden bg-primary/5 border-primary/20">
                     <CardHeader className="pb-2">
                       <CardTitle className="text-base font-bold flex items-center gap-2 text-primary"><Send className="w-5 h-5"/> Envios e Acompanhamento</CardTitle>
                       <CardDescription className="text-muted-foreground">Enviar mensagens de acompanhamento para OS</CardDescription>
                     </CardHeader>
                     <CardContent className="p-4 space-y-3">
                       <div className="grid grid-cols-1 gap-2">
                         <Button variant="outline" className="justify-start text-left h-auto py-2" onClick={async () => {
                           const telef = data.whatsappDestinatario || data.enderecos?.[0]?.telefone;
                           if (!telef) { toast.error("Telefone do cliente não encontrado"); return; }
                           const msg = `Sua encomenda está em trânsito pela Conexão Express.\nStatus: saiu para entrega.\nPrevisão: ${data.previsaoTermino || "em breve"}.\nEndereço: ${data.enderecos?.[data.enderecos?.length - 1]?.endereco || ""}`;
                           await WhatsAppEnviar(telef.replace(/\D/g, ""), msg);
                           toast.success("Acompanhamento enviado!");
                         }} disabled={readOnly || !data.id}>
                           <MessageCircle className="w-4 h-4 mr-2" /> Acompanhamento Cliente Final
                         </Button>
                         <Button variant="outline" className="justify-start text-left h-auto py-2" onClick={async () => {
                           if (!data.prestador) { toast.error("Selecione um prestador primeiro"); return; }
                           const { data: p } = await supabase.from("prestadores").select("telefone").eq("nome", data.prestador).single();
                           if (!p?.telefone) { toast.error("Telefone do prestador não encontrado"); return; }
                           const msg = `Instruções da OS ${data.numero}\nColeta: ${data.enderecos?.[0]?.endereco || ""}\nEntrega: ${data.enderecos?.[data.enderecos?.length - 1]?.endereco || ""}\nValor que será pago: R$ ${data.custoPrestador.toFixed(2)}`;
                           await WhatsAppEnviar(p.telefone.replace(/\D/g, ""), msg);
                           toast.success("Instruções enviadas ao prestador!");
                         }} disabled={readOnly || !data.prestador || !data.id}>
                           <Truck className="w-4 h-4 mr-2" /> Instruções Motorista/Prestador
                         </Button>
                         <Button variant="outline" className="justify-start text-left h-auto py-2" onClick={async () => {
                           const col = data.enderecos?.find(e => e.tipo === "coleta") || data.enderecos?.[0];
                           if (!col?.telefone) { toast.error("Telefone do cliente não encontrado"); return; }
                           const msg = `Ordem de Serviço criada.\nOS: ${data.numero}\nStatus: em programação.\nOrigem: ${col?.endereco || ""}\nDestino: ${data.enderecos?.[data.enderecos?.length - 1]?.endereco || ""}`;
                           await WhatsAppEnviar(col.telefone.replace(/\D/g, ""), msg);
                           toast.success("Aviso enviado ao cliente!");
                         }} disabled={readOnly || !data.id}>
                           <FileText className="w-4 h-4 mr-2" /> Aviso Cliente Contratante
                         </Button>
                       </div>
                       <p className="text-xs text-muted-foreground mt-2">As mensagens são enviadas via WhatsApp. O salvamento da OS não é bloqueado por falhas no envio.</p>
                     </CardContent>
                   </Card>
                    
                    <div className="pt-4 border-t space-y-2">
                       <div className="flex justify-between text-xs"><span className="text-muted-foreground">Distância:</span><span className="font-bold">{distanciaRota?.distanciaTexto || "—"}</span></div>
                       <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tabela:</span><span className="font-bold">{data.tabelaAplicada || "Padrão"}</span></div>
                       <div className="flex justify-between text-xs"><span className="text-muted-foreground">Faixa:</span><span className="font-bold">{faixaCalculada || "N/A"}</span></div>
                       <div className="flex justify-between text-sm pt-2"><span className="text-muted-foreground">Lucro Est.:</span><span className="font-bold text-green-600">R$ {(data.valorCliente - data.custoPrestador).toFixed(2)}</span></div>
                    </div>
                  </CardContent>
                </Card>

                {data.veiculoTipo === 'moto' && (
                  <Card className="lg:col-span-3 border-none shadow-md rounded-2xl overflow-hidden bg-green-50 border-green-100">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-bold flex items-center gap-2 text-green-700"><MessageCircle className="w-5 h-5"/> Mensagem para Prestador — WhatsApp</CardTitle>
                      <CardDescription className="text-green-600">Texto para copiar e enviar manualmente. Não envia WhatsApp automaticamente.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <Textarea value={gerarMensagemWhatsAppOS(data)} readOnly className="bg-white font-mono text-sm h-48 border-green-200" />
                      <Button onClick={copiarWhatsApp} className="w-full bg-green-600 hover:bg-green-700 text-white">
                        <CopyIcon className="w-4 h-4 mr-2" /> Copiar Mensagem
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

<TabsContent value="historico" className="space-y-6">
                <Card className="border-none shadow-md rounded-2xl overflow-hidden bg-green-50/30 border-green-100">
                  <CardHeader className="bg-green-50 pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-green-700"><Clock className="w-4 h-4"/> Resumo Operacional</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Eventos</p>
                        <p className="text-lg font-bold text-slate-700">{(data.historico || []).length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Veículo</p>
                        <p className="text-lg font-bold text-slate-700">{data.veiculoTipo || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Carga</p>
                        <p className="text-lg font-bold text-slate-700">{data.carga?.tipo || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Distância</p>
                        <p className="text-lg font-bold text-slate-700">{distanciaRota?.distanciaKm?.toFixed(1) || data.distanciaKm || 0} km</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Tempo</p>
                        <p className="text-lg font-bold text-slate-700">{distanciaRota?.duracaoTexto || data.tempoEstimado || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Valor Cliente</p>
                        <p className="text-lg font-bold text-blue-700">R$ {(data.valorCliente || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-orange-600 font-medium">Valor Prestador</p>
                        <p className="text-lg font-bold text-orange-700">R$ {(data.custoPrestador || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-green-600 font-medium">Tabela</p>
                        <p className="text-lg font-bold text-green-700">{data.tabelaAplicada || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-600 font-medium">Prestador</p>
                        <p className="text-lg font-bold text-purple-700">{data.prestador || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Status</p>
                        <p className="text-lg font-bold text-slate-700">{STATUS_CORES[data.status as OSStatus]?.label || data.status}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                   <CardHeader className="bg-slate-50/50 border-b pb-4">
                     <CardTitle className="text-base font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-primary"/> Histórico Operacional Completo</CardTitle>
                   </CardHeader>
                   <CardContent className="p-6">
                      <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
                         {(data.historico || []).map((h, i) => (
                           <div key={i} className="relative flex items-start gap-6 pl-12 group">
                             <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-primary shadow-sm group-last:border-slate-300">
                                <CheckCircle2 className="w-5 h-5 text-primary group-last:text-slate-300" />
                             </div>
                             <div>
                               <p className="text-sm font-bold text-slate-800">{h.acao}</p>
                               <div className="flex items-center gap-3 mt-1">
                                 <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(h.data).toLocaleString('pt-BR')}</span>
                                 <span className="text-[10px] uppercase font-bold text-primary flex items-center gap-1"><Avatar className="w-4 h-4"><AvatarFallback className="text-[8px]">{h.usuario[0]}</AvatarFallback></Avatar> {h.usuario}</span>
                               </div>
                               {h.status_novo && <Badge variant="outline" className="mt-2 text-[9px] uppercase tracking-wider">{STATUS_CORES[h.status_novo as OSStatus]?.label || h.status_novo}</Badge>}
                             </div>
                           </div>
                         ))}
                      </div>
                   </CardContent>
                 </Card>

                 <Card className="border-none shadow-md rounded-2xl overflow-hidden">
                   <CardHeader className="bg-slate-50/50 border-b pb-4">
                     <CardTitle className="text-base font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-primary"/> Comprovantes e Evidências</CardTitle>
                   </CardHeader>
                   <CardContent className="p-6 space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Recebedor Nome"><Input value={ (data as any).recebedorNome || "" } readOnly={readOnly} onChange={(e) => setData(p => ({ ...p, recebedorNome: e.target.value }))} /></Field>
                        <Field label="Recebedor Documento"><Input value={ (data as any).recebedorDocumento || "" } readOnly={readOnly} onChange={(e) => setData(p => ({ ...p, recebedorDocumento: e.target.value }))} /></Field>
                        <Field label="Função/Vínculo">
                          <Select value={ (data as any).recebedorFuncao || "" } onValueChange={(v) => setData(p => ({ ...p, recebedorFuncao: v }))} disabled={readOnly}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Porteiro">Porteiro</SelectItem>
                              <SelectItem value="Recepção">Recepção</SelectItem>
                              <SelectItem value="Almoxarifado">Almoxarifado</SelectItem>
                              <SelectItem value="Segurança">Segurança</SelectItem>
                              <SelectItem value="Morador">Morador</SelectItem>
                              <SelectItem value="Vizinho">Vizinho</SelectItem>
                              <SelectItem value="Familiar">Familiar</SelectItem>
                              <SelectItem value="Funcionário">Funcionário</SelectItem>
                              <SelectItem value="Outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <Field label="Data Entrega"><Input type="date" value={ (data as any).dataEntrega || "" } readOnly={readOnly} onChange={(e) => setData(p => ({ ...p, dataEntrega: e.target.value }))} /></Field>
                        <Field label="Hora Entrega"><Input type="time" value={ (data as any).dataEntrega ? new Date((data as any).dataEntrega).toTimeString().slice(0,5) : "" } readOnly={readOnly} onChange={(e) => setData(p => ({ ...p, horaEntrega: e.target.value }))} /></Field>
                     </div>

                     <Field label="Observação da Entrega"><Textarea value={ (data as any).observacaoEntrega || "" } readOnly={readOnly} onChange={(e) => setData(p => ({ ...p, observacaoEntrega: e.target.value }))} rows={2} /></Field>
                     
                     <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase text-slate-500">Fotos da Entrega</Label>
                        <div className="border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50">
                           <Package className="w-8 h-8 text-slate-300 mb-2" />
                           <p className="text-xs text-slate-400">Aguardando evidência do aplicativo do prestador.</p>
                           <p className="text-[9px] text-slate-300 mt-1">Permite foto de entrega, foto de coleta, canhoto assinado e assinatura digital</p>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase text-slate-500">Assinatura Digital</Label>
                        <div className="h-24 border rounded-xl bg-slate-50 flex items-center justify-center">
                           <span className="text-[10px] text-slate-400 italic">Nenhuma assinatura registrada</span>
                        </div>
                     </div>
                   </CardContent>
                 </Card>
                </div>
             </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default OrdemServicoForm;
