// ============================================================
// MISSAO COTACAO-EXPRESS-PREMIUM-WIZARD — FASE 1 (wizard premium)
// Rota pública /cotacao-express — link do WhatsApp/site.
//
// CRO: wizard minimalista — 1 etapa por vez com animação suave de
// entrada/saída (framer-motion), SEM histórico de chat. Carga capturada
// em 3 perguntas (o que / peso / dimensões) e o motor `analisarCargaCotacao`
// (peso + cubagem) indica o veículo com a regra de SLA (moto imediata,
// demais 24h) — sem aviso genérico de 40kg. Endereços com
// destrinchamento visual e modo manual (perguntas naturais).
//
// Após o cálculo, o cliente vê o RESUMO da cotação (carga, veículo
// indicado + SLA e o VALOR do frete em destaque) e aprova com o botão
// verde "Aprovar Frete" — que segue direto para a Fase 2
// (/cotacao-express/detalhes/:id), onde número e contato são pedidos.
// SEM menu do TMS (fricção zero — esses dados entram só na Fase 2,
// depois da aprovacao).
//
// Etapas: 1 quem pediu → 2 o que transportar → 3 peso →
//         4 dimensões → 5 retirada → 6 entrega → 7 pontos extras
//         → 8 cálculo → 9 resumo da cotação → Fase 2 (detalhes/:id).
//
// UX avançada: Voltar passo a passo (preserva dados), layout centralizado
// responsivo, autocomplete Mapbox com proximity SP, tipos de parada
// (Retirada / Entrega / Retirada e Entrega) + "Adicionar Retorno" (clona a
// origem como último ponto) e "Salvar PDF / Imprimir" no resumo.
// ============================================================
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock,
  Gauge,
  MapPin,
  Navigation,
  Package,
  Plus,
  Printer,
  Ruler,
  Truck,
  Undo2,
  X,
} from "lucide-react";
import CampoEnderecoChat from "@/components/cotacao/CampoEnderecoChat";
import {
  aprovarCotacao,
  criarCotacaoFase1,
  MAX_PARADAS_COTACAO,
  STATUS_AGUARDANDO_APROVACAO,
} from "@/services/cotacoes/cotacaoPublicaService";
import {
  calcularRotaEFreteCotacao,
  formatarBrl,
  type PontoRotaCotacao,
  type PrecificacaoCotacao,
} from "@/services/cotacoes/cotacaoCalculoService";
import {
  analisarCargaCotacao,
  formatarLitros,
  type RecomendacaoVeiculoCotacao,
} from "@/lib/veiculoCotacao";
import type { SugestaoEndereco } from "@/services/maps/mapboxProvider";

const MENSAGEM_CALCULO = "Deixa comigo — calculando a rota e o melhor preço ⚡";

const MENSAGEM_ERRO_CALCULO =
  "Ops, não conseguimos calcular essa rota agora. Confira os endereços e tente de novo.";

type TipoParada = "retirada" | "entrega" | "retirada_entrega";

interface ParadaEstado {
  endereco: string;
  sugestao: SugestaoEndereco | null;
  tipo: TipoParada;
  /** true quando a parada foi clonada da origem pelo "Adicionar Retorno". */
  retorno?: boolean;
}

const paradaVazia = (tipo: TipoParada = "entrega"): ParadaEstado => ({
  endereco: "",
  sugestao: null,
  tipo,
});

const ROTULO_TIPO_PARADA: Record<TipoParada, string> = {
  retirada: "Retirada",
  entrega: "Entrega",
  retirada_entrega: "Retirada e Entrega",
};

const mascararTelefone = (valor: string): string => {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const rotuloParada = (p: ParadaEstado) =>
  p.retorno ? "Retorno" : (ROTULO_TIPO_PARADA[p.tipo] ?? "Entrega");

const enderecoDaParada = (p: ParadaEstado): string =>
  p.sugestao?.place_name?.trim() || p.endereco.trim();

export default function CotacaoExpress() {
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState(1);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [descricao, setDescricao] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [largura, setLargura] = useState("");
  const [profundidade, setProfundidade] = useState("");
  const [dimensoesIgnoradas, setDimensoesIgnoradas] = useState(false);
  const [recomendacao, setRecomendacao] = useState<RecomendacaoVeiculoCotacao | null>(null);
  const [paradas, setParadas] = useState<ParadaEstado[]>([
    paradaVazia("retirada"),
    paradaVazia("entrega"),
  ]);
  const [dataDesejada, setDataDesejada] = useState("");
  const [horaDesejada, setHoraDesejada] = useState("");

  const [rota, setRota] = useState<{ km: number; duracaoMin: number; paradas: number } | null>(null);
  const [precificacao, setPrecificacao] = useState<PrecificacaoCotacao | null>(null);
  const [frasePreco, setFrasePreco] = useState("");
  const [cotacaoId, setCotacaoId] = useState<string | null>(null);

  const [erro, setErro] = useState("");
  const [avisoCadastro, setAvisoCadastro] = useState("");
  const [processando, setProcessando] = useState(false);

  const primeiroNome = nome.trim().split(" ")[0] || "";

  const dimensoesTexto = useMemo(() => {
    const a = Number(altura);
    const l = Number(largura);
    const p = Number(profundidade);
    if (a > 0 && l > 0 && p > 0) return `${a}x${l}x${p} cm`;
    return "";
  }, [altura, largura, profundidade]);

  // ------------------------------------------------------------
  // Validações
  // ------------------------------------------------------------
  const validarIdentificacao = (): string => {
    if (nome.trim().length < 2) return "Digite seu nome para continuarmos.";
    if (telefone.replace(/\D/g, "").length < 10)
      return "Informe um WhatsApp com DDD (ex.: 11 99999-9999).";
    return "";
  };

  const validarDescricao = (): string => {
    if (descricao.trim().length < 3) return "Descreva brevemente o que será transportado.";
    return "";
  };

  const validarPeso = (): string => {
    if (!(Number(peso) > 0)) return "Informe o peso estimado em kg (ex.: 12).";
    return "";
  };

  const validarDimensoes = (): string => {
    if (dimensoesIgnoradas) return "";
    const algumPreenchido = [altura, largura, profundidade].some((v) => Number(v) > 0);
    if (!algumPreenchido) return ""; // todas vazias → cliente optou por não informar
    const faltando = [
      ["Altura", altura],
      ["Largura", largura],
      ["Profundidade", profundidade],
    ].filter(([, v]) => !(Number(v) > 0));
    if (faltando.length > 0)
      return `Preencha ${faltando.map(([n]) => n).join(", ")} (em cm) ou use "Não sei as dimensões".`;
    return "";
  };

  const validarEndereco = (idx: number): string => {
    const p = paradas[idx];
    if (!p) return "Informe o endereço.";
    const texto = enderecoDaParada(p);
    if (texto.length < 3)
      return idx === 0
        ? "Digite a retirada e escolha uma sugestão da lista."
        : "Digite o endereço e escolha uma sugestão da lista.";
    if (idx === 1 && paradas[0] && enderecoDaParada(paradas[0]) === texto)
      return "A entrega precisa ser diferente da retirada.";
    return "";
  };

  const validarExtras = (): string => {
    const ultimo = paradas.length - 1;
    return validarEndereco(ultimo);
  };

  // ------------------------------------------------------------
  // Navegação entre etapas
  // ------------------------------------------------------------
  const trocarParada = (idx: number, valor: Partial<ParadaEstado>) =>
    setParadas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...valor } : p)));

  const confirmarEnderecoManual = (idx: number, montado: string) =>
    trocarParada(idx, { endereco: montado, sugestao: null });

  const adicionarParada = (): string => {
    if (paradas.length >= MAX_PARADAS_COTACAO)
      return `Limite de ${MAX_PARADAS_COTACAO} endereços por rota.`;
    setParadas((prev) => [...prev, paradaVazia()]);
    return "";
  };

  const removerUltimaParada = () =>
    setParadas((prev) => (prev.length <= 2 ? prev : prev.slice(0, -1)));

  /**
   * "Adicionar Retorno": clona o Ponto 1 (origem) como último ponto com
   * tipo Entrega (exibido como "Retorno") — a rota passa a retornar à
   * origem e o cliente vê km/valor recalculados na etapa de cálculo.
   */
  const adicionarRetorno = (): string => {
    const origem = paradas[0];
    if (!origem || enderecoDaParada(origem).length < 3)
      return "Preencha a retirada (Ponto 1) antes de adicionar o retorno.";
    if (paradas.length >= MAX_PARADAS_COTACAO)
      return `Limite de ${MAX_PARADAS_COTACAO} endereços por rota.`;
    setParadas((prev) => [
      ...prev,
      { endereco: origem.endereco, sugestao: origem.sugestao, tipo: "entrega", retorno: true },
    ]);
    return "";
  };

  const handleAdicionarRetorno = (irParaExtras: boolean) => {
    const limite = adicionarRetorno();
    if (limite) return setErro(limite);
    setErro("");
    if (irParaExtras) setEtapa(7);
  };

  const avancarIdentificacao = () => {
    const problema = validarIdentificacao();
    if (problema) return setErro(problema);
    setErro("");
    setEtapa(2);
  };

  const avancarDescricao = () => {
    const problema = validarDescricao();
    if (problema) return setErro(problema);
    setErro("");
    setEtapa(3);
  };

  const avancarPeso = () => {
    const problema = validarPeso();
    if (problema) return setErro(problema);
    setErro("");
    setEtapa(4);
  };

  const avancarDimensoes = () => {
    const problema = validarDimensoes();
    if (problema) return setErro(problema);
    setErro("");

    // Motor de indicação: peso + cubagem → veículo + SLA.
    const rec = analisarCargaCotacao({
      pesoKg: Number(peso) > 0 ? Number(peso) : null,
      alturaCm: Number(altura) || null,
      larguraCm: Number(largura) || null,
      profundidadeCm: Number(profundidade) || null,
    });
    setRecomendacao(rec);
    setEtapa(5);
  };

  const avancarPularDimensoes = () => {
    setDimensoesIgnoradas(true);
    setAltura("");
    setLargura("");
    setProfundidade("");
    setErro("");
    // Mesmo sem dimensões, o motor indica veículo pelo peso.
    const rec = analisarCargaCotacao({
      pesoKg: Number(peso) > 0 ? Number(peso) : null,
      alturaCm: null,
      larguraCm: null,
      profundidadeCm: null,
    });
    setRecomendacao(rec);
    setEtapa(5);
  };

  const avancarRetirada = () => {
    const problema = validarEndereco(0);
    if (problema) return setErro(problema);
    setErro("");
    setEtapa(6);
  };

  const avancarEntrega = (adicionarOutro: boolean) => {
    const problema = validarEndereco(1);
    if (problema) return setErro(problema);
    const limite = adicionarOutro ? adicionarParada() : "";
    if (limite) return setErro(limite);
    setErro("");
    if (adicionarOutro) {
      setEtapa(7);
      return;
    }
    void calcular();
  };

  const avancarExtras = (adicionarOutro: boolean) => {
    const problema = validarExtras();
    if (problema) return setErro(problema);
    const limite = adicionarOutro ? adicionarParada() : "";
    if (limite) return setErro(limite);
    setErro("");
    if (adicionarOutro) {
      setEtapa(7);
      return;
    }
    void calcular();
  };

  const voltar = () => {
    setErro("");
    setEtapa((e) => Math.max(1, e - 1));
  };

  // ------------------------------------------------------------
  // Cálculo de rota + preço (e pré-registro da cotação)
  // ------------------------------------------------------------
  const calcular = async () => {
    setEtapa(8);
    setErro("");
    setAvisoCadastro("");

    try {
      const pontosComTipo = paradas
        .map((p) => ({
          endereco: enderecoDaParada(p),
          lat: p.sugestao?.lat ?? null,
          lng: p.sugestao?.lng ?? null,
          tipo: p.tipo,
        }))
        .filter((p) => p.endereco.length > 0);
      const pontos: PontoRotaCotacao[] = pontosComTipo.map(({ tipo: _tipo, ...resto }) => resto);

      const resultado = await calcularRotaEFreteCotacao(
        pontos,
        peso ? Number(peso) : null,
        recomendacao?.tipo ?? null,
      );
      if (!resultado) {
        setEtapa(7);
        setErro(MENSAGEM_ERRO_CALCULO);
        return;
      }

      const { rota: rotaCalculada, precificacao: preco } = resultado;
      setRota(rotaCalculada);
      setPrecificacao(preco);

      setFrasePreco(
        `Prontinho, ${primeiroNome}! O valor do seu frete fica em ${formatarBrl(preco.valor)}.`,
      );

      // Pré-registro: a Torre de Controle recebe o alerta mesmo se o
      // cliente fechar a aba antes de aprovar.
      const res = await criarCotacaoFase1({
        nome_cliente: nome,
        telefone,
        carga_descricao: descricao,
        carga_peso: peso ? Number(peso) : null,
        carga_dimensoes: dimensoesTexto,
        paradas: pontos.map((p) => p.endereco),
        paradasTipos: pontosComTipo.map((p) => p.tipo),
        data_desejada: "",
        hora_desejada: "",
        status: STATUS_AGUARDANDO_APROVACAO,
        precificacao: preco,
        pontosRota: pontos,
      });
      if (res.ok && res.dado) {
        setCotacaoId(res.dado);
      } else {
        setAvisoCadastro(
          "Não foi possível pré-registrar agora — clique em aprovar para tentar de novo.",
        );
      }

      setEtapa(9);
    } catch {
      setEtapa(7);
      setErro(MENSAGEM_ERRO_CALCULO);
    }
  };

  // ------------------------------------------------------------
  // Aprovação → Fase 2
  // ------------------------------------------------------------
  const aprovar = async () => {
    if (processando || !precificacao) return;
    setProcessando(true);
    setErro("");
    try {
      const pontosComTipo = paradas
        .map((p) => ({
          endereco: enderecoDaParada(p),
          lat: p.sugestao?.lat ?? null,
          lng: p.sugestao?.lng ?? null,
          tipo: p.tipo,
        }))
        .filter((p) => p.endereco.length > 0);
      const pontos: PontoRotaCotacao[] = pontosComTipo.map(({ tipo: _tipo, ...resto }) => resto);

      let id = cotacaoId;
      if (!id) {
        const res = await criarCotacaoFase1({
          nome_cliente: nome,
          telefone,
          carga_descricao: descricao,
          carga_peso: peso ? Number(peso) : null,
          carga_dimensoes: dimensoesTexto,
          paradas: pontos.map((p) => p.endereco),
          paradasTipos: pontosComTipo.map((p) => p.tipo),
          data_desejada: dataDesejada,
          hora_desejada: horaDesejada,
          status: STATUS_AGUARDANDO_APROVACAO,
          precificacao,
          pontosRota: pontos,
        });
        if (!res.ok || !res.dado) {
          setErro(res.erro || "Não foi possível registrar agora. Tente novamente.");
          return;
        }
        id = res.dado;
        setCotacaoId(id);
      }

      const aprovado = await aprovarCotacao(id, {
        valor: precificacao.valor,
        dataDesejada,
        horaDesejada,
      });
      if (!aprovado.ok) {
        setErro(aprovado.erro || "Não foi possível concluir a aprovação. Tente novamente.");
        return;
      }

      // Aprovação registrada → Fase 2 (número, contato e observações).
      toast.success(
        `Aprovação registrada, ${primeiroNome}! Falta só confirmar o número de quem recebe.`,
      );
      navigate(`/cotacao-express/detalhes/${id}`);
    } finally {
      setProcessando(false);
    }
  };

  // ------------------------------------------------------------
  // Botão primário da barra fixa (etapas 1..7)
  // ------------------------------------------------------------
  const handleAvancar = () => {
    switch (etapa) {
      case 1:
        avancarIdentificacao();
        break;
      case 2:
        avancarDescricao();
        break;
      case 3:
        avancarPeso();
        break;
      case 4:
        avancarDimensoes();
        break;
      case 5:
        avancarRetirada();
        break;
      case 6:
        avancarEntrega(false);
        break;
      case 7:
        avancarExtras(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden print:bg-white">
      {/* Camada 1 — gradiente suave da marca (atrás de tudo) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[-2] bg-gradient-to-br from-orange-50 via-white to-slate-100 print:hidden"
      />
      {/* Camada 2 — marca d'água da etapa ativa (sutil, não interfere na leitura) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[-1] bg-cover bg-center bg-no-repeat bg-fixed opacity-[0.04] print:hidden"
        style={{ backgroundImage: `url('${bgPorEtapa(etapa)}')` }}
      />

      <Cabecalho />

      <main className="relative z-0 flex-1 px-4 pt-5 pb-40 print:px-0 print:pt-0 print:pb-0">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {/* Cartão da etapa atual (wizard minimalista) */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`pergunta-${etapa}`}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ duration: 0.28 }}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-xl sm:shadow-lg print:rounded-none print:border-0 print:p-0 print:shadow-none"
            >
              {/* ETAPA 1 — quem pediu */}
              {etapa === 1 && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-orange-600">
                    Olá! Que bom ter você aqui 👋
                  </p>
                  <Rotulo
                    titulo="Como posso te chamar?"
                    subtitulo="Leva 30 segundos. Sem cadastro, sem senha."
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="cot-nome">Seu nome *</Label>
                    <Input
                      id="cot-nome"
                      autoComplete="name"
                      className="h-12 rounded-xl text-base"
                      placeholder="Ex.: Maria Silva"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cot-telefone">WhatsApp com DDD *</Label>
                    <Input
                      id="cot-telefone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className="h-12 rounded-xl text-base"
                      placeholder="(11) 99999-9999"
                      value={telefone}
                      onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                    />
                    <p className="text-xs text-slate-400">
                      Enviamos a cotação por aqui — nada de spam.
                    </p>
                  </div>
                </div>
              )}

              {/* ETAPA 2 — o que transportar */}
              {etapa === 2 && (
                <div className="space-y-4">
                  <Rotulo
                    titulo="O que transportar"
                    subtitulo="Uma descrição rápida já nos permite seguir."
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="cot-descricao">O que você precisa transportar? *</Label>
                    <Textarea
                      id="cot-descricao"
                      className="min-h-[96px] rounded-xl text-base"
                      placeholder="Ex.: 2 caixas de documentos, volumes pequenos..."
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* ETAPA 3 — peso */}
              {etapa === 3 && (
                <div className="space-y-4">
                  <Rotulo
                    titulo="Peso da carga"
                    subtitulo="Com o peso certo já indicamos o veículo ideal."
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="cot-peso">Qual o peso estimado (em kg)? *</Label>
                    <Input
                      id="cot-peso"
                      type="number"
                      min={0}
                      inputMode="decimal"
                      className="h-12 rounded-xl text-base"
                      placeholder="Ex.: 12"
                      value={peso}
                      onChange={(e) => setPeso(e.target.value)}
                    />
                    <p className="text-xs text-slate-400">
                      Um valor aproximado já serve — ajustamos depois.
                    </p>
                  </div>
                </div>
              )}

              {/* ETAPA 4 — dimensões */}
              {etapa === 4 && (
                <div className="space-y-4">
                  <Rotulo
                    titulo="Dimensões da carga"
                    subtitulo="Quais as dimensões da mercadoria? (Altura, Largura e Profundidade) em cm. Ajuda a confirmar o veículo."
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cot-altura" className="text-xs font-semibold text-slate-600">
                        Altura (cm)
                      </Label>
                      <Input
                        id="cot-altura"
                        type="number"
                        min={0}
                        inputMode="decimal"
                        className="h-12 rounded-xl text-base"
                        placeholder="40"
                        value={altura}
                        onChange={(e) => {
                          setAltura(e.target.value);
                          setDimensoesIgnoradas(false);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cot-largura" className="text-xs font-semibold text-slate-600">
                        Largura (cm)
                      </Label>
                      <Input
                        id="cot-largura"
                        type="number"
                        min={0}
                        inputMode="decimal"
                        className="h-12 rounded-xl text-base"
                        placeholder="40"
                        value={largura}
                        onChange={(e) => {
                          setLargura(e.target.value);
                          setDimensoesIgnoradas(false);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="cot-profundidade"
                        className="text-xs font-semibold text-slate-600"
                      >
                        Prof. (cm)
                      </Label>
                      <Input
                        id="cot-profundidade"
                        type="number"
                        min={0}
                        inputMode="decimal"
                        className="h-12 rounded-xl text-base"
                        placeholder="40"
                        value={profundidade}
                        onChange={(e) => {
                          setProfundidade(e.target.value);
                          setDimensoesIgnoradas(false);
                        }}
                      />
                    </div>
                  </div>
                  {dimensoesTexto && (
                    <p className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                      <Ruler className="h-3.5 w-3.5 text-orange-500" />
                      Cubagem calculada: {dimensoesTexto}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={avancarPularDimensoes}
                    className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-orange-600 hover:underline"
                  >
                    Não sei as dimensões — indicar veículo só pelo peso
                  </button>
                </div>
              )}

              {/* ETAPA 5 — retirada */}
              {etapa === 5 && (
                <div className="space-y-4">
                  <Rotulo
                    titulo="A retirada"
                    subtitulo="Só a referência: CEP, bairro ou rua. Número e complemento pedimos depois, quando o valor for aprovado."
                  />
                  <CardVeiculoIndicado recomendacao={recomendacao} />
                  <CampoEnderecoChat
                    id={`cot-parada-${0}`}
                    texto={paradas[0]?.endereco || ""}
                    sugestao={paradas[0]?.sugestao || null}
                    onTexto={(v) => trocarParada(0, { endereco: v, sugestao: null })}
                    onSelecionar={(s) => trocarParada(0, { endereco: s.place_name, sugestao: s })}
                    onConfirmarManual={(m) => confirmarEnderecoManual(0, m)}
                    autoFocus
                  />
                </div>
              )}

              {/* ETAPA 6 — entrega */}
              {etapa === 6 && (
                <div className="space-y-4">
                  <Rotulo
                    titulo="A entrega"
                    subtitulo="Quanto mais preciso, mais fiel fica o preço."
                  />
                  <CardVeiculoIndicado recomendacao={recomendacao} />
                  <CampoEnderecoChat
                    id={`cot-parada-${1}`}
                    texto={paradas[1]?.endereco || ""}
                    sugestao={paradas[1]?.sugestao || null}
                    onTexto={(v) => trocarParada(1, { endereco: v, sugestao: null })}
                    onSelecionar={(s) => trocarParada(1, { endereco: s.place_name, sugestao: s })}
                    onConfirmarManual={(m) => confirmarEnderecoManual(1, m)}
                    autoFocus
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl border-orange-300 text-orange-700 hover:bg-orange-50"
                      onClick={() => avancarEntrega(true)}
                      disabled={paradas.length >= MAX_PARADAS_COTACAO}
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> Outro ponto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl border-slate-300 text-slate-600 hover:bg-slate-50"
                      onClick={() => handleAdicionarRetorno(true)}
                      disabled={paradas.length >= MAX_PARADAS_COTACAO}
                    >
                      <Undo2 className="mr-1.5 h-4 w-4" /> Adicionar Retorno
                    </Button>
                    <span className="text-xs font-semibold text-slate-400">
                      {paradas.length}/{MAX_PARADAS_COTACAO} pontos
                    </span>
                  </div>
                </div>
              )}

              {/* ETAPA 7 — pontos extras */}
              {etapa === 7 && (
                <div className="space-y-4">
                  <Rotulo
                    titulo="Pontos extras"
                    subtitulo="Adicione paradas intermediárias, se houver."
                  />
                  <CardVeiculoIndicado recomendacao={recomendacao} />
                  <ul className="space-y-1.5">
                    {paradas.map((p, idx) => (
                      <li
                        key={`chip-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"
                      >
                        <span className="min-w-0 truncate">
                          {idx + 1}. {enderecoDaParada(p) || "—"}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                            {rotuloParada(p)}
                          </span>
                          {idx >= 2 && (
                            <button
                              type="button"
                              onClick={() =>
                                setParadas((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-slate-400 hover:text-red-500"
                              aria-label={`Remover ${idx + 1}ª parada`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <CampoEnderecoChat
                    id={`cot-parada-${paradas.length - 1}`}
                    texto={paradas[paradas.length - 1]?.endereco || ""}
                    sugestao={paradas[paradas.length - 1]?.sugestao || null}
                    onTexto={(v) =>
                      trocarParada(paradas.length - 1, { endereco: v, sugestao: null })
                    }
                    onSelecionar={(s) =>
                      trocarParada(paradas.length - 1, { endereco: s.place_name, sugestao: s })
                    }
                    onConfirmarManual={(m) => confirmarEnderecoManual(paradas.length - 1, m)}
                    placeholder="Mais um endereço (CEP, bairro ou rua)"
                    autoFocus
                  />
                  {/* Tipo da última parada (retirada / entrega / retirada e entrega) */}
                  <div className="grid grid-cols-3 gap-2">
                    {(["retirada", "entrega", "retirada_entrega"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => trocarParada(paradas.length - 1, { tipo: t })}
                        className={
                          paradas[paradas.length - 1]?.tipo === t
                            ? "h-10 rounded-xl bg-orange-500 px-1 text-xs font-bold uppercase tracking-wide text-white"
                            : "h-10 rounded-xl border border-slate-300 bg-white px-1 text-xs font-bold uppercase tracking-wide text-slate-500 hover:border-orange-400"
                        }
                      >
                        {ROTULO_TIPO_PARADA[t]}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl border-orange-300 text-orange-700 hover:bg-orange-50"
                      onClick={() => avancarExtras(true)}
                      disabled={paradas.length >= MAX_PARADAS_COTACAO}
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> Outro ponto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl border-slate-300 text-slate-600 hover:bg-slate-50"
                      onClick={() => handleAdicionarRetorno(false)}
                      disabled={paradas.length >= MAX_PARADAS_COTACAO}
                    >
                      <Undo2 className="mr-1.5 h-4 w-4" /> Adicionar Retorno
                    </Button>
                    <button
                      type="button"
                      onClick={removerUltimaParada}
                      disabled={paradas.length <= 2}
                      className="text-xs font-semibold text-slate-400 hover:text-red-500 disabled:opacity-40"
                    >
                      Remover último
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 8 — cálculo */}
              {etapa === 8 && (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-2 w-2 rounded-full bg-orange-500"
                          animate={{ opacity: [0.25, 1, 0.25] }}
                          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </span>
                    <span className="text-sm font-semibold text-slate-600">
                      {MENSAGEM_CALCULO}
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-500">
                    {paradas
                      .filter((p) => enderecoDaParada(p))
                      .map((p, idx) => (
                        <li key={`calc-${idx}`} className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-orange-500" />
                          <span className="min-w-0 truncate">{enderecoDaParada(p)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* ETAPA 9 — RESUMO DA COTAÇÃO (aprovação → Fase 2) */}
              {etapa === 9 && precificacao && (
                <div className="space-y-4">
                  {/* Cabeçalho exclusivo da impressão (versão colorida do logo) */}
                  <div className="hidden print:mb-4 print:block">
                    <img
                      src="/logos/logo-conexao-colorido.png"
                      alt="Conexão Express"
                      className="h-10 w-auto print:h-20"
                    />
                    <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Proposta de Cotação — Conexão Express
                    </p>
                  </div>
                  <div className="flex items-start justify-between gap-3 print:hidden">
                    <Rotulo
                      titulo="Resumo da Cotação"
                      subtitulo="Confira a carga, o veículo indicado e o valor. Número e contato de quem recebe pedimos na próxima tela."
                    />
                    <img
                      src="/logos/logo-conexao-oficial.png"
                      alt="Conexão Express"
                      className="h-12 w-auto shrink-0"
                    />
                  </div>

                  {/* O que será transportado */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                      <Package className="h-3.5 w-3.5" /> O que será transportado
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{descricao}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                        {String(peso).replace(".", ",")} kg
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                        {dimensoesTexto || "Dimensões não informadas"}
                      </span>
                    </div>
                  </div>

                  {/* Veículo indicado + SLA */}
                  <div
                    className={
                      recomendacao?.cabeMoto
                        ? "rounded-2xl border border-orange-200 bg-orange-50/70 p-4"
                        : "rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
                    }
                  >
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                      Veículo indicado
                    </span>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-black text-slate-900">
                        {recomendacao?.nome || precificacao.rotulo_veiculo}
                      </p>
                      {recomendacao && (
                        <span
                          className={
                            recomendacao.cabeMoto
                              ? "inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white"
                              : "inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white"
                          }
                        >
                          {recomendacao.cabeMoto ? (
                            <Gauge className="h-3.5 w-3.5" />
                          ) : (
                            <CalendarClock className="h-3.5 w-3.5" />
                          )}
                          {recomendacao.slaRotulo}
                        </span>
                      )}
                    </div>
                    {recomendacao && (
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        {recomendacao.mensagemBot}
                      </p>
                    )}
                    {recomendacao?.litros != null && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Cubagem: {formatarLitros(recomendacao.litros)}
                      </p>
                    )}
                  </div>

                  {/* VALOR DO FRETE EM DESTAQUE */}
                  <div className="rounded-2xl border border-orange-200 bg-gradient-to-b from-orange-50 to-white p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-600">
                      Proposta instantânea
                    </div>
                    {frasePreco && (
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">
                        {frasePreco}
                      </p>
                    )}
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-4xl font-black tracking-tight text-slate-900">
                        {formatarBrl(precificacao.valor)}
                      </span>
                      <span className="mb-1.5 text-xs font-semibold text-slate-500">
                        frete estimado
                      </span>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <InfoPrazo icone={<Navigation className="h-3.5 w-3.5" />}>
                        {rota ? `${rota.km.toFixed(1).replace(".", ",")} km` : "—"}
                      </InfoPrazo>
                      <InfoPrazo icone={<Clock className="h-3.5 w-3.5" />}>
                        {rota ? formatarDuracao(rota.duracaoMin) : "—"}
                      </InfoPrazo>
                      <InfoPrazo icone={<Truck className="h-3.5 w-3.5" />}>
                        {recomendacao?.nome || precificacao.rotulo_veiculo}
                      </InfoPrazo>
                      <InfoPrazo icone={<MapPin className="h-3.5 w-3.5" />}>
                        {precificacao.paradas} parada(s)
                      </InfoPrazo>
                    </dl>

                    <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                      {precificacao.aviso}
                      {precificacao.tabela ? ` Fonte: ${precificacao.tabela}.` : ""}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cot-data">Quando precisa? (opcional)</Label>
                      <Input
                        id="cot-data"
                        type="date"
                        className="h-12 rounded-xl text-base"
                        value={dataDesejada}
                        onChange={(e) => setDataDesejada(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cot-hora">Horário (opcional)</Label>
                      <Input
                        id="cot-hora"
                        type="time"
                        className="h-12 rounded-xl text-base"
                        value={horaDesejada}
                        onChange={(e) => setHoraDesejada(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:hidden">
                    <Button
                      type="button"
                      className="h-13 w-full rounded-xl bg-orange-500 text-base font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600"
                      onClick={() => void aprovar()}
                      disabled={processando}
                    >
                      <Truck className="mr-2 h-5 w-5" />
                      {processando ? "Registrando..." : "Aprovar Frete"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-13 w-full rounded-xl border-slate-300 text-base font-bold text-slate-700 hover:bg-slate-50"
                      onClick={() => window.print()}
                    >
                      <Printer className="mr-2 h-5 w-5" />
                      Salvar PDF / Imprimir
                    </Button>
                  </div>
                  <p className="text-center text-xs text-slate-400 print:hidden">
                    Sem compromisso — depois é só confirmar o número de quem recebe.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Erros */}
          {erro && etapa !== 8 && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600 print:hidden">
              {erro}
            </p>
          )}
          {avisoCadastro && etapa === 9 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-700 print:hidden">
              {avisoCadastro}
            </p>
          )}
        </div>
      </main>

      {/* Barra de ações fixa (mobile-first) */}
      {etapa <= 7 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="h-12 rounded-xl text-slate-500"
              onClick={voltar}
              disabled={etapa <= 1}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <BotaoPrincipal etapa={etapa} onAvancar={handleAvancar} />
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Subcomponentes (escopo de módulo — identidade estável p/ React)
// ------------------------------------------------------------

// ETAPA-UI — marca d'água institucional por etapa do wizard (imagens em /public).
const bgPorEtapa = (etapa: number): string => {
  if (etapa === 1) return "/bg-callcenter.png"; // identificação
  if (etapa === 2) return "/Frota 2.png"; // o que transportar (frota/soluções)
  if (etapa === 3 || etapa === 4) return "/bg-tecnologia.png"; // peso, dimensões e veículo
  if (etapa === 5 || etapa === 6 || etapa === 7) return "/bg-entregador1.jpg"; // endereços e rota
  return "/Equipe.png"; // cálculo e resumo da cotação (antes de aprovar)
};

function Cabecalho() {
  const [logoOk, setLogoOk] = useState(true);
  return (
    <header className="relative z-10 flex items-center justify-between border-b-2 border-orange-500 bg-[#2E1065] px-4 py-3 shadow-md print:hidden">
      {logoOk ? (
        <img
          src="/logos/logo-conexao-oficial.png"
          alt="Conexão Express"
          className="h-12 w-auto"
          onError={() => setLogoOk(false)}
        />
      ) : (
        <span className="text-sm font-extrabold tracking-tight text-white">
          ⚡ CONEXÃO EXPRESS
        </span>
      )}
      <span className="rounded-full bg-orange-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
        Cotação Express
      </span>
    </header>
  );
}

function Rotulo({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div>
      <p className="text-lg font-bold text-slate-900">{titulo}</p>
      <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>
    </div>
  );
}

/** Mini-painel "Veículo indicado" (etapas 5–7) — consultor logístico. */
function CardVeiculoIndicado({
  recomendacao,
}: {
  recomendacao: RecomendacaoVeiculoCotacao | null;
}) {
  if (!recomendacao) return null;
  return (
    <div
      className={
        recomendacao.cabeMoto
          ? "flex items-start gap-2.5 rounded-2xl border border-orange-200 bg-orange-50/70 p-3"
          : "flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-3"
      }
    >
      <Package
        className={`mt-0.5 h-4 w-4 shrink-0 ${recomendacao.cabeMoto ? "text-orange-600" : "text-amber-600"}`}
      />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Veículo indicado
        </p>
        <p className="mt-0.5 text-sm font-bold text-slate-800">{recomendacao.nome}</p>
        <p
          className={`mt-0.5 text-xs font-semibold ${recomendacao.cabeMoto ? "text-orange-600" : "text-amber-700"}`}
        >
          {recomendacao.slaRotulo}
        </p>
        {recomendacao.litros !== null && (
          <p className="mt-0.5 text-[11px] text-slate-500">
            Cubagem: {formatarLitros(recomendacao.litros)}
          </p>
        )}
        <p className="mt-0.5 text-[11px] text-slate-400">{recomendacao.justificativa}</p>
      </div>
    </div>
  );
}

function BotaoPrincipal({ etapa, onAvancar }: { etapa: number; onAvancar: () => void }) {
  const calcular = etapa === 6 || etapa === 7;
  return (
    <Button
      type="button"
      className="h-12 flex-1 rounded-xl bg-orange-500 font-bold text-white hover:bg-orange-600"
      onClick={onAvancar}
    >
      {calcular ? "Calcular agora" : "Continuar"}
      {!calcular && <ArrowRight className="ml-2 h-4 w-4" />}
    </Button>
  );
}

function InfoPrazo({
  icone,
  children,
}: {
  icone: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 font-semibold text-slate-600 ring-1 ring-slate-200">
      <span className="text-orange-600">{icone}</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function formatarDuracao(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return "—";
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
