// ============================================================
// MISSAO COTACAO-EXPRESS-V2 PREMIUM — FASE 1 (fluxo conversacional)
// Rota pública /cotacao-express — link do WhatsApp/site.
//
// CRO: 1 pergunta por vez, no ritmo de um chat, com o VALOR do frete
// calculado em tempo real (rota Mapbox + precificação oficial) exibido
// na mesma tela, e botão verde de aprovação que libera a Fase 2.
// SEM menu do TMS, SEM campos de complemento/contato (fricção zero —
// esses dados entram só na Fase 2, depois da aprovacao).
//
// PREMIUM: a carga é capturada em 3 perguntas (o que / peso /
// dimensões) e o motor `analisarCargaCotacao` (peso + cubagem)
// indica o veículo ao cliente com a regra de SLA (moto imediata,
// demais 24h) — sem aviso genérico de 40kg. Endereços com
// destrinchamento visual e modo manual (perguntas naturais).
//
// Etapas: 1 quem pediu → 2 o que transportar → 3 peso →
//         4 dimensões → 5 retirada → 6 entrega → 7 pontos extras
//         → 8 cálculo → 9 proposta → 10 sucesso.
// ============================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Gauge,
  MapPin,
  Navigation,
  Package,
  Plus,
  Ruler,
  Sparkles,
  Truck,
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

const TOTAL_ETAPAS = 7;

const MENSAGEM_ABERTURA =
  "Olá! Vamos calcular o seu frete rapidinho. Como posso te chamar?";

const MENSAGEM_CALCULO = "Deixa comigo — calculando a rota e o melhor preço ⚡";

const MENSAGEM_ERRO_CALCULO =
  "Ops, não conseguimos calcular essa rota agora. Confira os endereços e tente de novo.";

interface ParadaEstado {
  endereco: string;
  sugestao: SugestaoEndereco | null;
}

interface MensagemChat {
  id: number;
  autor: "bot" | "eu";
  texto: string;
}

const paradaVazia = (): ParadaEstado => ({ endereco: "", sugestao: null });

const mascararTelefone = (valor: string): string => {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const rotuloParada = (idx: number) =>
  idx === 0 ? "retirada" : `entrega ${idx}`;

const enderecoDaParada = (p: ParadaEstado): string =>
  p.sugestao?.place_name?.trim() || p.endereco.trim();

export default function CotacaoExpress() {
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState(1);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([
    { id: 0, autor: "bot", texto: MENSAGEM_ABERTURA },
  ]);
  const seqMensagemRef = useRef(1);
  const fimRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [descricao, setDescricao] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [largura, setLargura] = useState("");
  const [profundidade, setProfundidade] = useState("");
  const [dimensoesIgnoradas, setDimensoesIgnoradas] = useState(false);
  const [recomendacao, setRecomendacao] = useState<RecomendacaoVeiculoCotacao | null>(null);
  const [paradas, setParadas] = useState<ParadaEstado[]>([paradaVazia(), paradaVazia()]);
  const [dataDesejada, setDataDesejada] = useState("");
  const [horaDesejada, setHoraDesejada] = useState("");

  const [rota, setRota] = useState<{ km: number; duracaoMin: number; paradas: number } | null>(null);
  const [precificacao, setPrecificacao] = useState<PrecificacaoCotacao | null>(null);
  const [cotacaoId, setCotacaoId] = useState<string | null>(null);

  const [erro, setErro] = useState("");
  const [avisoCadastro, setAvisoCadastro] = useState("");
  const [processando, setProcessando] = useState(false);

  const primeiroNome = nome.trim().split(" ")[0] || "";

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, etapa]);

  // Limpa timers pendentes (fala atrasada da recomendação) no unmount.
  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const falar = (texto: string) =>
    setMensagens((prev) => [...prev, { id: seqMensagemRef.current++, autor: "bot", texto }]);

  const responder = (texto: string) =>
    setMensagens((prev) => [...prev, { id: seqMensagemRef.current++, autor: "eu", texto }]);

  /** Fala do bot com pausa natural (indicação de veículo "digitando…"). */
  const falarApos = (texto: string, ms = 900) => {
    const timer = window.setTimeout(() => falar(texto), ms);
    timersRef.current.push(timer);
  };

  const progresso = useMemo(
    () =>
      etapa <= TOTAL_ETAPAS
        ? Math.min(100, Math.round((etapa / TOTAL_ETAPAS) * 100))
        : 100,
    [etapa],
  );

  const rotuloProgresso =
    etapa <= TOTAL_ETAPAS
      ? `Pergunta ${etapa} de ${TOTAL_ETAPAS}`
      : etapa === 8
        ? "Calculando o preço…"
        : etapa === 9
          ? "Proposta pronta"
          : "Concluído";

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

  const avancarIdentificacao = () => {
    const problema = validarIdentificacao();
    if (problema) return setErro(problema);
    setErro("");
    responder(`${nome.trim()} · ${telefone.trim()}`);
    falar(`Muito prazer, ${primeiroNome}! O que você precisa transportar hoje?`);
    setEtapa(2);
  };

  const avancarDescricao = () => {
    const problema = validarDescricao();
    if (problema) return setErro(problema);
    setErro("");
    responder(descricao.trim());
    falar("Certo! Qual o peso estimado da carga (em kg)?");
    setEtapa(3);
  };

  const avancarPeso = () => {
    const problema = validarPeso();
    if (problema) return setErro(problema);
    setErro("");
    responder(`${String(peso).replace(".", ",")} kg`);
    falar("Perfeito. Quais as dimensões da mercadoria? (Altura, Largura e Profundidade)");
    setEtapa(4);
  };

  const avancarDimensoes = () => {
    const problema = validarDimensoes();
    if (problema) return setErro(problema);
    setErro("");
    responder(
      dimensoesTexto || (dimensoesIgnoradas ? "Não sei as dimensões" : "Dimensões não informadas"),
    );

    // Motor de indicação: peso + cubagem → veículo + SLA.
    const rec = analisarCargaCotacao({
      pesoKg: Number(peso) > 0 ? Number(peso) : null,
      alturaCm: Number(altura) || null,
      larguraCm: Number(largura) || null,
      profundidadeCm: Number(profundidade) || null,
    });
    setRecomendacao(rec);
    falarApos(rec.mensagemBot, 900);
    falarApos(
      "Combinado! Agora me diga onde a carga será retirada. (Digite o endereço, CEP ou bairro)",
      1800,
    );
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
    responder("Não sei as dimensões");
    falarApos(rec.mensagemBot, 900);
    falarApos(
      "Combinado! Agora me diga onde a carga será retirada. (Digite o endereço, CEP ou bairro)",
      1800,
    );
    setEtapa(5);
  };

  const avancarRetirada = () => {
    const problema = validarEndereco(0);
    if (problema) return setErro(problema);
    setErro("");
    responder(enderecoDaParada(paradas[0]));
    falar("Perfeito. E para onde vamos levar?");
    setEtapa(6);
  };

  const avancarEntrega = (adicionarOutro: boolean) => {
    const problema = validarEndereco(1);
    if (problema) return setErro(problema);
    const limite = adicionarOutro ? adicionarParada() : "";
    if (limite) return setErro(limite);
    setErro("");
    responder(enderecoDaParada(paradas[1]));
    if (adicionarOutro) {
      falar("Certo! Precisamos de mais algum ponto no caminho?");
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
    responder(enderecoDaParada(paradas[paradas.length - 1]));
    if (adicionarOutro) {
      falar("Certo! Precisamos de mais algum ponto no caminho?");
      setEtapa(7);
      return;
    }
    void calcular();
  };

  const voltar = () => {
    setErro("");
    setEtapa((e) => Math.max(5, e - 1));
  };

  // ------------------------------------------------------------
  // Cálculo de rota + preço (e pré-registro da cotação)
  // ------------------------------------------------------------
  const calcular = async () => {
    falar(MENSAGEM_CALCULO);
    setEtapa(8);
    setErro("");
    setAvisoCadastro("");

    try {
      const pontos: PontoRotaCotacao[] = paradas
        .map((p) => ({
          endereco: enderecoDaParada(p),
          lat: p.sugestao?.lat ?? null,
          lng: p.sugestao?.lng ?? null,
        }))
        .filter((p) => p.endereco.length > 0);

      const resultado = await calcularRotaEFreteCotacao(
        pontos,
        peso ? Number(peso) : null,
        recomendacao?.tipo ?? null,
      );
      if (!resultado) {
        falar(MENSAGEM_ERRO_CALCULO);
        setEtapa(7);
        setErro(MENSAGEM_ERRO_CALCULO);
        return;
      }

      const { rota: rotaCalculada, precificacao: preco } = resultado;
      setRota(rotaCalculada);
      setPrecificacao(preco);

      falar(
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
      falar(MENSAGEM_ERRO_CALCULO);
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
      const pontos = paradas
        .map((p) => ({
          endereco: enderecoDaParada(p),
          lat: p.sugestao?.lat ?? null,
          lng: p.sugestao?.lng ?? null,
        }))
        .filter((p) => p.endereco.length > 0);

      let id = cotacaoId;
      if (!id) {
        const res = await criarCotacaoFase1({
          nome_cliente: nome,
          telefone,
          carga_descricao: descricao,
          carga_peso: peso ? Number(peso) : null,
          carga_dimensoes: dimensoesTexto,
          paradas: pontos.map((p) => p.endereco),
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

      falar(`Fechou, ${primeiroNome}! Aprovação registrada ✅ Último passo rápido…`);
      setEtapa(10);
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

  // ------------------------------------------------------------
  // ETAPA 10 — sucesso + passagem para a Fase 2
  // ------------------------------------------------------------
  if (etapa === 10) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-100 flex flex-col">
        <Cabecalho />
        <main className="flex-1 flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl animate-fade-in">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="text-2xl font-bold leading-snug text-slate-900">
              Tudo certo, {primeiroNome}! 🚀
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              Sua aprovação de <strong>{formatarBrl(precificacao?.valor || 0)}</strong> foi
              registrada. Falta só confirmar o número e o contato de quem recebe.
            </p>
            <Button
              type="button"
              className="mt-6 h-13 w-full rounded-xl bg-orange-500 text-base font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600"
              onClick={() => cotacaoId && navigate(`/cotacao-express/detalhes/${cotacaoId}`)}
              disabled={!cotacaoId}
            >
              Continuar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="mt-4 text-xs text-slate-400">
              Leva menos de 1 minuto — é o último passo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-100 flex flex-col">
      <Cabecalho />

      {/* Progresso (Typeform) */}
      <div className="px-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span>
            {etapa <= TOTAL_ETAPAS ? (
              <>
                Pergunta {etapa} de {TOTAL_ETAPAS}
              </>
            ) : (
              rotuloProgresso
            )}
          </span>
          <span>{progresso}%</span>
        </div>
      </div>

      <main className="flex-1 px-4 pt-5 pb-40">
        <div className="mx-auto w-full max-w-xl space-y-4">
          {/* Conversa */}
          {mensagens.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={m.autor === "bot" ? "flex justify-start" : "flex justify-end"}
            >
              <div
                className={
                  m.autor === "bot"
                    ? "max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-[15px] leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-100"
                    : "max-w-[85%] rounded-2xl rounded-tr-sm bg-orange-500 px-4 py-2.5 text-[15px] font-medium leading-relaxed text-white shadow-md"
                }
              >
                {m.texto}
              </div>
            </motion.div>
          ))}

          {/* Cartão da pergunta atual */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`pergunta-${etapa}`}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ duration: 0.28 }}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              {/* ETAPA 1 — quem pediu */}
              {etapa === 1 && (
                <div className="space-y-4">
                  <Rotulo titulo="Quem pediu" subtitulo="Leva 30 segundos. Sem cadastro, sem senha." />
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
                    subtitulo="Altura, Largura e Profundidade em cm. Ajuda a confirmar o veículo."
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
                            {rotuloParada(idx)}
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
                      Calculando a rota e o melhor preço…
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

              {/* ETAPA 9 — proposta com preço + aprovação */}
              {etapa === 9 && precificacao && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                      <Sparkles className="h-3.5 w-3.5" /> Proposta instantânea
                    </div>
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

                    {/* SLA do veículo indicado */}
                    {recomendacao && (
                      <div
                        className={
                          recomendacao.cabeMoto
                            ? "mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700"
                            : "mt-3 flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-700"
                        }
                      >
                        {recomendacao.cabeMoto ? (
                          <Gauge className="h-3.5 w-3.5" />
                        ) : (
                          <CalendarClock className="h-3.5 w-3.5" />
                        )}
                        {recomendacao.slaRotulo}
                      </div>
                    )}

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

                  <Button
                    type="button"
                    className="h-13 w-full rounded-xl bg-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700"
                    onClick={() => void aprovar()}
                    disabled={processando}
                  >
                    <Truck className="mr-2 h-5 w-5" />
                    {processando ? "Registrando..." : "Aprovar e Solicitar Motorista"}
                  </Button>
                  <p className="text-center text-xs text-slate-400">
                    Sem compromisso — depois é só confirmar o número de quem recebe.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Erros */}
          {erro && etapa !== 8 && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600">
              {erro}
            </p>
          )}
          {avisoCadastro && etapa === 9 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-700">
              {avisoCadastro}
            </p>
          )}

          <div ref={fimRef} />
        </div>
      </main>

      {/* Barra de ações fixa (mobile-first) */}
      {etapa <= 7 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="h-12 rounded-xl text-slate-500"
              onClick={voltar}
              disabled={etapa <= 5}
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

function Cabecalho() {
  return (
    <header className="px-4 py-4 flex items-center justify-between">
      <span className="text-sm font-extrabold tracking-tight text-slate-900">
        ⚡ CONEXÃO EXPRESS
      </span>
      <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-700">
        Cotação Express
      </span>
    </header>
  );
}

function Rotulo({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div>
      <span className="text-[11px] font-bold uppercase tracking-widest text-orange-600">
        Etapa · {titulo}
      </span>
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
          ? "flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3"
          : "flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-3"
      }
    >
      <Package
        className={`mt-0.5 h-4 w-4 shrink-0 ${recomendacao.cabeMoto ? "text-emerald-600" : "text-amber-600"}`}
      />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Veículo indicado
        </p>
        <p className="mt-0.5 text-sm font-bold text-slate-800">{recomendacao.nome}</p>
        <p
          className={`mt-0.5 text-xs font-semibold ${recomendacao.cabeMoto ? "text-emerald-700" : "text-amber-700"}`}
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
      className={
        calcular
          ? "h-12 flex-1 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
          : "h-12 flex-1 rounded-xl bg-orange-500 font-bold text-white hover:bg-orange-600"
      }
      onClick={onAvancar}
    >
      {calcular ? "Calcular agora" : "Continuar"}
      {calcular ? <Sparkles className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
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
      <span className="text-emerald-600">{icone}</span>
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
