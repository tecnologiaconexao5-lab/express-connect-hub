// ============================================================
// MISSAO COTACAO-EXPRESS-V2 — FASE 1 (fluxo conversacional com preço)
// Rota pública /cotacao-express — link do WhatsApp/site.
//
// CRO: 1 pergunta por vez, no ritmo de um chat, com o VALOR do frete
// calculado em tempo real (rota Mapbox + precificação oficial) exibido
// na mesma tela, e botão verde de aprovação que libera a Fase 2.
// SEM menu do TMS, SEM campos de complemento/contato (fricção zero —
// esses dados entram só na Fase 2, depois da aprovação).
//
// Etapas: 1 quem pediu → 2 a carga → 3 retirada → 4 entrega
//         → 5 pontos extras → 6 cálculo → 7 proposta → 8 sucesso.
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
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Navigation,
  Plus,
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
import type { SugestaoEndereco } from "@/services/maps/mapboxProvider";

const TOTAL_ETAPAS = 4;

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

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [descricao, setDescricao] = useState("");
  const [peso, setPeso] = useState("");
  const [dimensoes, setDimensoes] = useState("");
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

  const falar = (texto: string) =>
    setMensagens((prev) => [...prev, { id: seqMensagemRef.current++, autor: "bot", texto }]);

  const responder = (texto: string) =>
    setMensagens((prev) => [...prev, { id: seqMensagemRef.current++, autor: "eu", texto }]);

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
      : etapa === 5
        ? `Rota · ${paradas.filter((p) => enderecoDaParada(p)).length} pontos`
        : etapa === 6
          ? "Calculando o preço…"
          : "Proposta pronta";

  // ------------------------------------------------------------
  // Validações
  // ------------------------------------------------------------
  const validarIdentificacao = (): string => {
    if (nome.trim().length < 2) return "Digite seu nome para continuarmos.";
    if (telefone.replace(/\D/g, "").length < 10)
      return "Informe um WhatsApp com DDD (ex.: 11 99999-9999).";
    return "";
  };

  const validarCarga = (): string => {
    if (descricao.trim().length < 3) return "Descreva brevemente o que será transportado.";
    if (peso && !(Number(peso) > 0)) return "Peso deve ser um valor em kg.";
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

  const avancarCarga = () => {
    const problema = validarCarga();
    if (problema) return setErro(problema);
    setErro("");
    const resumo = [descricao.trim(), peso ? `${peso} kg` : ""].filter(Boolean).join(" · ");
    responder(resumo);
    falar(
      "Legal. E onde o nosso motorista deve retirar essa carga? (Digite o endereço, CEP ou Bairro)",
    );
    setEtapa(3);
  };

  const avancarRetirada = () => {
    const problema = validarEndereco(0);
    if (problema) return setErro(problema);
    setErro("");
    responder(enderecoDaParada(paradas[0]));
    falar("Perfeito. E para onde vamos levar?");
    setEtapa(4);
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
      setEtapa(5);
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
      setEtapa(5);
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
    falar(MENSAGEM_CALCULO);
    setEtapa(6);
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

      const resultado = await calcularRotaEFreteCotacao(pontos, peso ? Number(peso) : null);
      if (!resultado) {
        falar(MENSAGEM_ERRO_CALCULO);
        setEtapa(5);
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
        carga_dimensoes: dimensoes,
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

      setEtapa(7);
    } catch {
      falar(MENSAGEM_ERRO_CALCULO);
      setEtapa(5);
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
          carga_dimensoes: dimensoes,
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
      setEtapa(8);
    } finally {
      setProcessando(false);
    }
  };

  // ------------------------------------------------------------
  // Botão primário da barra fixa (etapas 1..5)
  // ------------------------------------------------------------
  const handleAvancar = () => {
    switch (etapa) {
      case 1:
        avancarIdentificacao();
        break;
      case 2:
        avancarCarga();
        break;
      case 3:
        avancarRetirada();
        break;
      case 4:
        avancarEntrega(false);
        break;
      case 5:
        avancarExtras(false);
        break;
      default:
        break;
    }
  };

  // ------------------------------------------------------------
  // ETAPA 8 — sucesso + passagem para a Fase 2
  // ------------------------------------------------------------
  if (etapa === 8) {
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

              {/* ETAPA 2 — a carga */}
              {etapa === 2 && (
                <div className="space-y-4">
                  <Rotulo
                    titulo="A carga"
                    subtitulo="Uma descrição rápida já nos permite calcular o frete."
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="cot-descricao">Descrição da carga *</Label>
                    <Textarea
                      id="cot-descricao"
                      className="min-h-[96px] rounded-xl text-base"
                      placeholder="Ex.: 2 caixas de documentos, volumes pequenos..."
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cot-peso">Peso estimado (kg)</Label>
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
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cot-dimensoes">Dimensões estimadas</Label>
                      <Input
                        id="cot-dimensoes"
                        className="h-12 rounded-xl text-base"
                        placeholder="Ex.: 40x40x40 cm"
                        value={dimensoes}
                        onChange={(e) => setDimensoes(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-xs text-orange-700">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      De referência: motos transportam até <strong>40kg</strong>. Acima disso,
                      sugerimos carro ou utilitário — nós calculamos o melhor veículo para você.
                    </span>
                  </div>
                </div>
              )}

              {/* ETAPA 3 — retirada */}
              {etapa === 3 && (
                <div className="space-y-4">
                  <Rotulo
                    titulo="A retirada"
                    subtitulo="Só a referência: CEP, bairro ou rua. Número e complemento pedimos depois, quando o valor for aprovado."
                  />
                  <CampoEnderecoChat
                    id={`cot-parada-${0}`}
                    texto={paradas[0]?.endereco || ""}
                    sugestao={paradas[0]?.sugestao || null}
                    onTexto={(v) => trocarParada(0, { endereco: v, sugestao: null })}
                    onSelecionar={(s) => trocarParada(0, { endereco: s.place_name, sugestao: s })}
                    autoFocus
                  />
                </div>
              )}

              {/* ETAPA 4 — entrega */}
              {etapa === 4 && (
                <div className="space-y-4">
                  <Rotulo
                    titulo="A entrega"
                    subtitulo="Quanto mais preciso, mais fiel fica o preço."
                  />
                  <CampoEnderecoChat
                    id={`cot-parada-${1}`}
                    texto={paradas[1]?.endereco || ""}
                    sugestao={paradas[1]?.sugestao || null}
                    onTexto={(v) => trocarParada(1, { endereco: v, sugestao: null })}
                    onSelecionar={(s) => trocarParada(1, { endereco: s.place_name, sugestao: s })}
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

              {/* ETAPA 5 — pontos extras */}
              {etapa === 5 && (
                <div className="space-y-4">
                  <Rotulo
                    titulo="Pontos extras"
                    subtitulo="Adicione paradas intermediárias, se houver."
                  />
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

              {/* ETAPA 6 — cálculo */}
              {etapa === 6 && (
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

              {/* ETAPA 7 — proposta com preço + aprovação */}
              {etapa === 7 && precificacao && (
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
                        {precificacao.rotulo_veiculo}
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
          {erro && etapa !== 6 && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600">
              {erro}
            </p>
          )}
          {avisoCadastro && etapa === 7 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-700">
              {avisoCadastro}
            </p>
          )}

          <div ref={fimRef} />
        </div>
      </main>

      {/* Barra de ações fixa (mobile-first) */}
      {etapa <= 5 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="h-12 rounded-xl text-slate-500"
              onClick={voltar}
              disabled={etapa === 1}
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

function BotaoPrincipal({ etapa, onAvancar }: { etapa: number; onAvancar: () => void }) {
  const calcular = etapa === 4 || etapa === 5;
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
