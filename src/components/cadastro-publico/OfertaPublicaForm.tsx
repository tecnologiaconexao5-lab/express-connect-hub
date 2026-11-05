import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bike,
  Building2,
  Car,
  Check,
  DollarSign,
  FileText,
  Info,
  MapPin,
  MapPinned,
  RotateCcw,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OfertaCaptcha } from "@/components/cadastro-publico/OfertaCaptcha";
import { obterConfigCaptcha } from "@/lib/ofertaCaptcha";
import { supabase } from "@/lib/supabase";
import {
  ABASTECIMENTO_OPCOES,
  ALTA_DEMANDA_OPCOES,
  ATITUDE_IMPREVISTO_OPCOES,
  BUSCA_CONTRATO_OPCOES,
  CARACTERISTICAS,
  CARGA_FRAGIL_OPCOES,
  CARROCERIAS,
  CATEGORIAS_ATUACAO,
  COMPARTIMENTOS_MOTO,
  COMPROMETIMENTO_OPCOES,
  DIAS_SEMANA,
  DISCLAIMER_OFERTA,
  DIVERGENCIA_ENTREGA_OPCOES,
  HORARIO_PADRAO,
  MANUTENCAO_OPCOES,
  MEDIA_PARADAS_OPCOES,
  MENSAGEM_OFERTA_REGISTRADA,
  MENSAGEM_SEPARACAO,
  MODALIDADES,
  MODALIDADES_EXTRAS,
  OPERACAO_OPCOES,
  TECNOLOGIA_OPCOES,
  TIPOS_VEICULO,
  UFS,
  VALORIZA_PARCERIA_OPCOES,
  criarOfertaVazia,
  montarPayloadOferta,
  regioesParaUf,
  sugerirUfPorCidade,
  validarEtapaOferta,
  validarOferta,
  type BuscaContrato,
  type CategoriaAtuacao,
  type CompartimentoMoto,
  type Modalidade,
  type OfertaPublicaDraft,
} from "@/lib/ofertaPublica";

const ETAPAS = [
  { titulo: "Oferta e contato", icone: User },
  { titulo: "Região e disponibilidade", icone: MapPin },
  { titulo: "Modalidades e veículo", icone: Truck },
  { titulo: "Capacidade e valores", icone: DollarSign },
  { titulo: "Restrições e consentimento", icone: ShieldCheck },
];

const LOGO_OFERTAS = "/logos/logo-conexao-colorido.png";

const ICONES_CATEGORIA: Record<CategoriaAtuacao, typeof Bike> = {
  motoboy: Bike,
  motorista_agregado: Truck,
  motorista: Car,
  frotista: Building2,
};

const TURNOS_RAPIDOS: Array<{
  id: string;
  label: string;
  dias?: number[];
  inicio?: string;
  fim?: string;
}> = [
  { id: "segunda_sexta", label: "Segunda a Sexta", dias: [1, 2, 3, 4, 5] },
  { id: "finais_semana", label: "Finais de semana e feriados", dias: [0, 6] },
  { id: "madrugada", label: "Madrugada", inicio: "00:00", fim: "06:00" },
  { id: "manha", label: "Manhã (08h-12h)", inicio: "08:00", fim: "12:00" },
  { id: "tarde", label: "Tarde (14h-18h)", inicio: "14:00", fim: "18:00" },
  { id: "noite", label: "Noite", inicio: "18:00", fim: "23:00" },
];

function Chip({
  ativo,
  children,
  onClick,
}: {
  ativo: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
        ativo
          ? "border-orange-500 bg-orange-500 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function PerguntaEscolha({
  numero,
  pergunta,
  opcoes,
  valor,
  onChange,
  colunas = 1,
}: {
  numero: number;
  pergunta: string;
  opcoes: readonly string[];
  valor: string;
  onChange: (valor: string) => void;
  colunas?: 1 | 2;
}) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label={pergunta}>
      <Label>
        {numero}. {pergunta}
      </Label>
      <div className={cn("grid gap-2", colunas === 2 && "sm:grid-cols-2")}>
        {opcoes.map((opcao) => {
          const ativo = valor === opcao;
          return (
            <button
              key={opcao}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => onChange(opcao)}
              className={cn(
                "flex min-h-[48px] w-full items-center rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-colors",
                ativo
                  ? "border-orange-500 bg-orange-50 text-orange-900 ring-2 ring-orange-200"
                  : "border-slate-200 bg-white text-slate-600 hover:border-orange-300",
              )}
            >
              {opcao}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function mensagemErroEnvio(status: number | undefined, codigo: string, mensagem: string): string {
  if (status === 404 || status === 503 || codigo === "configuracao_indisponivel") {
    return "O canal de envio ainda nao esta disponivel. Tente novamente mais tarde.";
  }
  if (status === 403 || codigo === "captcha_invalido") {
    return "Nao foi possivel validar a protecao anti-spam. Recarregue a pagina e tente novamente.";
  }
  if (status === 429 || codigo === "muitas_tentativas") {
    return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.";
  }
  if (status === 413 || codigo === "payload_muito_grande") {
    return "A oferta enviada e muito grande. Reduza os textos e tente novamente.";
  }
  if (status === 400) {
    return "Os dados nao passaram na validacao do servidor. Revise os campos e tente novamente.";
  }
  if (!status) {
    return "Nao foi possivel conectar ao canal de envio. Verifique sua internet e tente novamente.";
  }
  return mensagem || "Nao foi possivel registrar a oferta. Tente novamente.";
}

function rotuloCategoria(categoria: CategoriaAtuacao | "") {
  return CATEGORIAS_ATUACAO.find((item) => item.value === categoria)?.label || "—";
}

function rotuloModalidades(modalidades: Modalidade[], extras: string[] = []) {
  const base = modalidades.map(
    (m) => MODALIDADES.find((item) => item.value === m)?.label || m,
  );
  return [...base, ...extras].join(", ");
}

function rotuloCompartimento(compartimento: CompartimentoMoto | "") {
  if (!compartimento) return "";
  return COMPARTIMENTOS_MOTO.find((item) => item.value === compartimento)?.label || "";
}

function rotuloDias(dias: number[]) {
  return dias
    .map((d) => DIAS_SEMANA.find((item) => item.value === d)?.label || String(d))
    .join(", ");
}

function ResumoOferta({ draft }: { draft: OfertaPublicaDraft }) {
  const regioes = [...draft.regioes, draft.outrasRegioes.trim()].filter(Boolean).join(", ");
  const veiculo =
    draft.categoriaAtuacao === "motorista"
      ? "Sem veículo próprio"
      : draft.tipoOferta === "motoboy"
        ? `Moto ${[draft.marcaMoto, draft.veiculoModelo || draft.tipoMoto].filter(Boolean).join(" ")}${
            draft.compartimento
              ? " - " + rotuloCompartimento(draft.compartimento)
              : draft.possuiBau
                ? " - Baú"
                : ""
          }`.trim()
        : [draft.veiculoTipo, draft.carroceria].filter(Boolean).join(" - ");

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-orange-600" />
        <p className="text-sm font-semibold text-slate-800">Resumo da oferta</p>
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Categoria</dt>
          <dd className="font-medium text-slate-800">{rotuloCategoria(draft.categoriaAtuacao)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Contato</dt>
          <dd className="font-medium text-slate-800">
            {draft.nome || "—"} · {draft.telefone || "—"}
            {draft.email ? ` · ${draft.email}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Região</dt>
          <dd className="font-medium text-slate-800">
            {[draft.cidade, draft.uf].filter(Boolean).join("/") || "—"}
            {regioes ? ` · ${regioes}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Disponibilidade</dt>
          <dd className="font-medium text-slate-800">
            {rotuloDias(draft.dias) || "—"} · {draft.horarioInicio || HORARIO_PADRAO.inicio} às{" "}
            {draft.horarioFim || HORARIO_PADRAO.fim}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Modalidades</dt>
          <dd className="font-medium text-slate-800">
            {rotuloModalidades(draft.modalidades, draft.modalidadesExtras) || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Veículo</dt>
          <dd className="font-medium text-slate-800">{veiculo || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Capacidade</dt>
          <dd className="font-medium text-slate-800">
            {[
              draft.capacidadeKg ? `${draft.capacidadeKg} kg` : "",
              draft.capacidadeM3 ? `${draft.capacidadeM3} m³` : "",
              draft.capacidadeBauLitros ? `${draft.capacidadeBauLitros} L de baú` : "",
            ]
              .filter(Boolean)
              .join(" · ") || "Não informada"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Valores</dt>
          <dd className="font-medium text-slate-800">
            {draft.valorNegociavel
              ? "A negociar"
              : [
                  draft.valorDiaria ? `Diária R$ ${draft.valorDiaria}` : "",
                  draft.valorKm ? `R$ ${draft.valorKm}/km` : "",
                  draft.valorSaida ? `Saída R$ ${draft.valorSaida}` : "",
                  draft.valorSemanal ? `Semanal R$ ${draft.valorSemanal}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
          </dd>
        </div>
      </dl>
      {draft.condicoesComerciais ? (
        <p className="text-xs text-slate-600">
          <span className="font-medium text-slate-700">Condições:</span> {draft.condicoesComerciais}
        </p>
      ) : null}
      {draft.restricoes ? (
        <p className="text-xs text-slate-600">
          <span className="font-medium text-slate-700">Restrições:</span> {draft.restricoes}
        </p>
      ) : null}
      {draft.observacoes ? (
        <p className="text-xs text-slate-600">
          <span className="font-medium text-slate-700">Observações:</span> {draft.observacoes}
        </p>
      ) : null}
    </div>
  );
}

export function OfertaPublicaForm() {
  const [draft, setDraft] = useState<OfertaPublicaDraft>(criarOfertaVazia);
  const [etapa, setEtapa] = useState(0);
  const [erros, setErros] = useState<string[]>([]);
  const [concluido, setConcluido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [turnoPersonalizado, setTurnoPersonalizado] = useState(false);
  const requestIdRef = useRef<string | null>(null);

  const ehMotoboy = draft.tipoOferta === "motoboy";
  const semVeiculo = draft.categoriaAtuacao === "motorista";
  const regioesDisponiveis = draft.uf ? regioesParaUf(draft.uf) : [];
  const ufSugerida = sugerirUfPorCidade(draft.cidade);
  const EtapaIcone = ETAPAS[etapa].icone;

  const regioesSelecionadas = useMemo(
    () => [...draft.regioes, draft.outrasRegioes.trim()].filter(Boolean).join(", "),
    [draft.regioes, draft.outrasRegioes],
  );

  const atualizar = <K extends keyof OfertaPublicaDraft>(
    campo: K,
    valor: OfertaPublicaDraft[K],
  ) => {
    setDraft((anterior) => ({ ...anterior, [campo]: valor }));
    setErros([]);
    setErroEnvio(null);
    requestIdRef.current = null;
  };

  const alternarLista = <T,>(lista: T[], valor: T): T[] =>
    lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];

  const limparFeedback = () => {
    setErros([]);
    setErroEnvio(null);
    requestIdRef.current = null;
  };

  const atualizarCidade = (valor: string) => {
    const ufSugerida = sugerirUfPorCidade(valor);
    setDraft((anterior) => {
      const sugestaoAnterior = sugerirUfPorCidade(anterior.cidade);
      const podeAutocompletar = !anterior.uf || anterior.uf === sugestaoAnterior;
      const uf = ufSugerida && podeAutocompletar ? ufSugerida : anterior.uf;
      return {
        ...anterior,
        cidade: valor,
        uf,
        ...(uf !== anterior.uf
          ? { regioes: anterior.regioes.filter((regiao) => regioesParaUf(uf).includes(regiao)) }
          : {}),
      };
    });
    limparFeedback();
  };

  const atualizarUf = (uf: string) => {
    setDraft((anterior) => ({
      ...anterior,
      uf,
      regioes: anterior.regioes.filter((regiao) => regioesParaUf(uf).includes(regiao)),
    }));
    limparFeedback();
  };

  const selecionarCategoria = (categoria: CategoriaAtuacao) => {
    const config = CATEGORIAS_ATUACAO.find((item) => item.value === categoria);
    if (!config) return;
    setDraft((anterior) => ({
      ...anterior,
      categoriaAtuacao: categoria,
      tipoOferta: config.tipoOferta,
      ...(categoria === "motorista"
        ? {
            veiculoCategoria: "terceiro",
            veiculoTipo: "Outro",
            carroceria: "Outra",
            veiculoModelo: "",
            veiculoPlaca: "",
            veiculoAno: "",
            tipoMoto: "",
            marcaMoto: "",
            cilindrada: "",
            compartimento: "",
            possuiBau: false,
            capacidadeBauLitros: "",
          }
        : {}),
      ...(categoria === "motoboy"
        ? {
            veiculoTipo: "moto",
            modalidadesExtras: anterior.modalidadesExtras.filter(
              (modalidade) => modalidade !== "Agregado",
            ),
          }
        : {}),
    }));
    limparFeedback();
  };

  const selecionarTurno = (turnoId: string) => {
    if (turnoId === "personalizado") {
      setTurnoPersonalizado(true);
      return;
    }
    const turno = TURNOS_RAPIDOS.find((item) => item.id === turnoId);
    if (!turno) return;
    setTurnoPersonalizado(false);
    setDraft((anterior) => ({
      ...anterior,
      ...(turno.dias ? { dias: turno.dias } : {}),
      horarioInicio: turno.inicio ?? (anterior.horarioInicio || HORARIO_PADRAO.inicio),
      horarioFim: turno.fim ?? (anterior.horarioFim || HORARIO_PADRAO.fim),
    }));
    limparFeedback();
  };

  const atualizarCompartimento = (compartimento: CompartimentoMoto) => {
    setDraft((anterior) => ({
      ...anterior,
      compartimento,
      possuiBau: compartimento === "bau",
      capacidadeBauLitros: compartimento === "sem" ? "" : anterior.capacidadeBauLitros,
    }));
    limparFeedback();
  };

  const alternarModalidadeExtra = (modalidade: string) => {
    setDraft((anterior) => ({
      ...anterior,
      modalidadesExtras: alternarLista(anterior.modalidadesExtras, modalidade),
    }));
    limparFeedback();
  };

  const enviarOferta = async () => {
    if (enviando) return;
    const captchaConfig = obterConfigCaptcha();
    if (captchaConfig && !captchaToken.trim()) {
      setErroEnvio("Conclua a verificacao anti-spam antes de enviar a oferta.");
      return;
    }
    setErros([]);
    setErroEnvio(null);
    setEnviando(true);
    const payload = montarPayloadOferta(draft);
    const requestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;

    try {
      const { data, error } = await supabase.functions.invoke("ofertas-publicas", {
        body: payload,
        headers: {
          "x-idempotency-key": requestId,
          ...(captchaToken.trim() ? { "x-captcha-token": captchaToken.trim() } : {}),
        },
      });

      if (error) {
        const response = (error as { context?: Response }).context;
        const status = response?.status;
        let codigo = "";
        try {
          const corpo = (await response?.clone().json()) as { error?: unknown } | undefined;
          codigo = typeof corpo?.error === "string" ? corpo.error : "";
        } catch {
          codigo = "";
        }
        setErroEnvio(mensagemErroEnvio(status, codigo, error.message));
        if (status === 403 || codigo === "captcha_invalido") {
          setCaptchaToken("");
          setCaptchaResetKey((atual) => atual + 1);
        }
        return;
      }

      const corpo = data as { protocolo?: unknown } | null;
      const protocoloRecebido = typeof corpo?.protocolo === "string" ? corpo.protocolo : "";
      if (!protocoloRecebido) {
        setErroEnvio("O backend nao retornou um protocolo. A oferta nao foi confirmada.");
        return;
      }

      setProtocolo(protocoloRecebido);
      setConcluido(true);
    } catch {
      setErroEnvio(
        "Falha de rede ao enviar a oferta. Nenhuma confirmacao foi recebida; tente novamente."
      );
    } finally {
      setEnviando(false);
    }
  };

  const avancar = async () => {
    if (enviando) return;
    const errosEtapa = validarEtapaOferta(etapa, draft);
    if (errosEtapa.length > 0) {
      setErros(errosEtapa);
      return;
    }
    setErros([]);
    if (etapa === 1 && (!draft.horarioInicio || !draft.horarioFim)) {
      setDraft((anterior) => ({
        ...anterior,
        horarioInicio: anterior.horarioInicio || HORARIO_PADRAO.inicio,
        horarioFim: anterior.horarioFim || HORARIO_PADRAO.fim,
      }));
    }
    if (etapa < ETAPAS.length - 1) {
      setEtapa((atual) => atual + 1);
      return;
    }
    const errosFinais = validarOferta(draft);
    if (errosFinais.length > 0) {
      setErros(errosFinais);
      return;
    }
    await enviarOferta();
  };

  const voltar = () => {
    setErros([]);
    setEtapa((atual) => Math.max(0, atual - 1));
  };

  const recomecar = () => {
    setDraft(criarOfertaVazia());
    setEtapa(0);
    setErros([]);
    setErroEnvio(null);
    setProtocolo(null);
    setTurnoPersonalizado(false);
    setCaptchaToken("");
    setCaptchaResetKey((atual) => atual + 1);
    requestIdRef.current = null;
    setConcluido(false);
  };

  if (concluido) {
    return (
      <div className="min-h-dvh bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-1">
              <img src={LOGO_OFERTAS} alt="Conexão Express" className="h-full w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Seja um Prestador Parceiro</h1>
              <p className="text-xs text-slate-500">Conexão Express</p>
            </div>
          </header>

          <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    Perfil Recebido com Sucesso!
                  </h2>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    PRÉ-CADASTRO CONCLUÍDO
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{MENSAGEM_OFERTA_REGISTRADA}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Protocolo</p>
              <p className="mt-1 break-all font-mono text-lg font-bold text-emerald-900">
                {protocolo}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={recomecar} className="gap-2 text-slate-600">
                <RotateCcw className="h-4 w-4" /> Nova oferta
              </Button>
            </div>
          </div>

          <p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-slate-500">
            {DISCLAIMER_OFERTA}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-orange-400 to-amber-300" />
          <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-1 sm:h-14 sm:w-14">
              <img src={LOGO_OFERTAS} alt="Conexão Express" className="h-full w-auto object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight text-slate-900 sm:text-2xl">
                Seja um Prestador Parceiro
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                Processo seletivo Conexão Express - Motoboys, Motoristas e Frotistas
              </p>
            </div>
          </div>
        </header>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-wrap gap-2">
            {ETAPAS.map((item, index) => {
              const ativo = index === etapa;
              const concluida = index < etapa;
              return (
                <div
                  key={item.titulo}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium sm:text-xs",
                    ativo
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : concluida
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-500",
                  )}
                >
                  {concluida ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold">
                      {index + 1}
                    </span>
                  )}
                  {item.titulo}
                </div>
              );
            })}
          </div>

          <div className="mb-5 flex items-center gap-2">
            <EtapaIcone className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                Etapa {etapa + 1} de {ETAPAS.length}
              </p>
              <h2 className="text-lg font-bold text-slate-900">{ETAPAS[etapa].titulo}</h2>
            </div>
          </div>

          {erros.length > 0 && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" /> Verifique os campos
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {erros.map((erro) => (
                  <li key={erro}>{erro}</li>
                ))}
              </ul>
            </div>
          )}

          {erroEnvio && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" /> Envio nao confirmado
              </div>
              <p className="mt-1 text-xs">{erroEnvio}</p>
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void avancar();
            }}
            className="space-y-6"
          >
            {etapa === 0 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Categoria de Atuação *</Label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {CATEGORIAS_ATUACAO.map((categoria) => {
                      const ativo = draft.categoriaAtuacao === categoria.value;
                      const IconeCategoria = ICONES_CATEGORIA[categoria.value];
                      return (
                        <button
                          key={categoria.value}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => selecionarCategoria(categoria.value)}
                          className={cn(
                            "flex min-h-[112px] w-full flex-col gap-2 rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                            ativo
                              ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                              : "border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-xl",
                              ativo ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600",
                            )}
                          >
                            <IconeCategoria className="h-5 w-5" />
                          </span>
                          <span className="text-base font-semibold text-slate-900">
                            {categoria.label}
                          </span>
                          <span className="text-xs leading-relaxed text-slate-500">
                            {categoria.descricao}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="oferta-nome">Nome completo *</Label>
                    <Input
                      id="oferta-nome"
                      value={draft.nome}
                      onChange={(event) => atualizar("nome", event.target.value)}
                      placeholder="Seu nome ou nome da empresa"
                      autoComplete="name"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="oferta-telefone">Telefone / WhatsApp *</Label>
                    <Input
                      id="oferta-telefone"
                      value={draft.telefone}
                      onChange={(event) => atualizar("telefone", event.target.value)}
                      placeholder="(11) 99999-9999"
                      inputMode="tel"
                      autoComplete="tel"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="oferta-email">E-mail (opcional)</Label>
                    <Input
                      id="oferta-email"
                      type="email"
                      value={draft.email}
                      onChange={(event) => atualizar("email", event.target.value)}
                      placeholder="voce@exemplo.com"
                      autoComplete="email"
                      className="h-11"
                    />
                  </div>
                </div>

                <InfoBox>
                  Este formulário é uma oferta comercial. Não é cadastro no APP, não é aprovação
                  e não garante contratação.
                </InfoBox>
              </div>
            )}

            {etapa === 1 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                  <div className="space-y-1.5">
                    <Label htmlFor="oferta-cidade">Cidade *</Label>
                    <Input
                      id="oferta-cidade"
                      value={draft.cidade}
                      onChange={(event) => atualizarCidade(event.target.value)}
                      placeholder="Ex.: São Paulo"
                      className="h-11"
                    />
                    {ufSugerida ? (
                      <p className="text-[11px] text-emerald-700">
                        UF identificada automaticamente: <span className="font-semibold">{ufSugerida}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Ao digitar a cidade, tentamos preencher a UF automaticamente.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF *</Label>
                    <Select
                      value={draft.uf || undefined}
                      onValueChange={atualizarUf}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {UFS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Regiões atendidas *</Label>
                  {regioesDisponiveis.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {regioesDisponiveis.map((regiao) => (
                        <Chip
                          key={regiao}
                          ativo={draft.regioes.includes(regiao)}
                          onClick={() =>
                            atualizar("regioes", alternarLista(draft.regioes, regiao))
                          }
                        >
                          {regiao}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
                      Selecione a UF acima para ver as regiões disponíveis para o seu estado.
                    </p>
                  )}
                  <Input
                    value={draft.outrasRegioes}
                    onChange={(event) => atualizar("outrasRegioes", event.target.value)}
                    placeholder="Outras regiões (separadas por vírgula)"
                    className="mt-2 h-10"
                  />
                  {regioesSelecionadas ? (
                    <p className="text-[11px] text-slate-500">
                      Selecionado: <span className="font-medium text-slate-700">{regioesSelecionadas}</span>
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <Label>Turnos e disponibilidade *</Label>
                  <p className="text-xs text-slate-500">
                    Escolha um turno rápido. A hora exata fica disponível em “Horário Personalizado”.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TURNOS_RAPIDOS.map((turno) => {
                      const ativo = turno.dias
                        ? turno.dias.every((dia) => draft.dias.includes(dia))
                        : draft.horarioInicio === turno.inicio && draft.horarioFim === turno.fim;
                      return (
                        <Chip key={turno.id} ativo={ativo} onClick={() => selecionarTurno(turno.id)}>
                          {turno.label}
                        </Chip>
                      );
                    })}
                    <Chip ativo={turnoPersonalizado} onClick={() => selecionarTurno("personalizado")}>
                      Horário Personalizado
                    </Chip>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dias disponíveis *</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map((dia) => (
                      <Chip
                        key={dia.value}
                        ativo={draft.dias.includes(dia.value)}
                        onClick={() => atualizar("dias", alternarLista(draft.dias, dia.value))}
                      >
                        {dia.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className={cn("space-y-2", !turnoPersonalizado && "hidden")}>
                  <p className="text-xs text-slate-500">
                    Informe a hora exata apenas se quiser um horário diferente dos turnos rápidos.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-horario-inicio">Horário de início</Label>
                      <Input
                        id="oferta-horario-inicio"
                        type="time"
                        value={draft.horarioInicio}
                        onChange={(event) => atualizar("horarioInicio", event.target.value)}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-horario-fim">Horário de fim</Label>
                      <Input
                        id="oferta-horario-fim"
                        type="time"
                        value={draft.horarioFim}
                        onChange={(event) => atualizar("horarioFim", event.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {etapa === 2 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Modalidades de atendimento *</Label>
                  <p className="text-[11px] text-slate-500">
                    Você pode marcar mais de uma modalidade para a mesma oferta.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {MODALIDADES.map((modalidade) => (
                      <Chip
                        key={modalidade.value}
                        ativo={draft.modalidades.includes(modalidade.value)}
                        onClick={() =>
                          atualizar(
                            "modalidades",
                            alternarLista(draft.modalidades, modalidade.value),
                          )
                        }
                      >
                        {modalidade.label}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Também atendo
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {MODALIDADES_EXTRAS.filter(
                        (modalidade) => !(ehMotoboy && modalidade === "Agregado"),
                      ).map((modalidade) => (
                        <Chip
                          key={modalidade}
                          ativo={draft.modalidadesExtras.includes(modalidade)}
                          onClick={() => alternarModalidadeExtra(modalidade)}
                        >
                          {modalidade}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>

                <InfoBox>{MENSAGEM_SEPARACAO}</InfoBox>

                <div className={cn("grid gap-4", !ehMotoboy && "sm:grid-cols-2")}>
                  <div className="space-y-1.5">
                    <Label>{ehMotoboy ? "A moto é *" : "Categoria do veículo *"}</Label>
                    <Select
                      value={draft.veiculoCategoria || undefined}
                      onValueChange={(valor) => atualizar("veiculoCategoria", valor)}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proprio">Próprio</SelectItem>
                        <SelectItem value="agregado">Agregado</SelectItem>
                        <SelectItem value="terceiro">Terceiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!ehMotoboy ? (
                    <div className="space-y-1.5">
                      <Label>Tipo de veículo *</Label>
                      <Select
                        value={draft.veiculoTipo || undefined}
                        onValueChange={(valor) => atualizar("veiculoTipo", valor)}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_VEICULO.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                {ehMotoboy ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-marca-moto">Marca da Moto</Label>
                      <Input
                        id="oferta-marca-moto"
                        value={draft.marcaMoto}
                        onChange={(event) => atualizar("marcaMoto", event.target.value)}
                        placeholder="Ex.: Honda"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-modelo-moto">Modelo da Moto</Label>
                      <Input
                        id="oferta-modelo-moto"
                        value={draft.veiculoModelo}
                        onChange={(event) => atualizar("veiculoModelo", event.target.value)}
                        placeholder="Ex.: CG 160"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-cilindrada">Cilindrada (cc)</Label>
                      <Input
                        id="oferta-cilindrada"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={draft.cilindrada}
                        onChange={(event) => atualizar("cilindrada", event.target.value)}
                        placeholder="Ex.: 160"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2" role="radiogroup" aria-label="Compartimento da moto">
                      <Label>Você possui baú ou compartimento? *</Label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {COMPARTIMENTOS_MOTO.map((item) => {
                          const ativo = draft.compartimento === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              role="radio"
                              aria-checked={ativo}
                              onClick={() => atualizarCompartimento(item.value)}
                              className={cn(
                                "flex min-h-[48px] items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                                ativo
                                  ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-orange-300",
                              )}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-bau-litros">Capacidade (litros)</Label>
                      <Input
                        id="oferta-bau-litros"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        disabled={draft.compartimento === "sem"}
                        value={draft.capacidadeBauLitros}
                        onChange={(event) => atualizar("capacidadeBauLitros", event.target.value)}
                        placeholder={draft.compartimento === "sem" ? "Não se aplica" : "Ex.: 90"}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Busca contrato fixo ou entregas esporádicas? *</Label>
                      <Select
                        value={draft.buscaContrato || undefined}
                        onValueChange={(valor) => atualizar("buscaContrato", valor as BuscaContrato)}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUSCA_CONTRATO_OPCOES.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : semVeiculo ? (
                  <InfoBox>
                    Você não precisa ter veículo neste momento. Vamos considerar o seu perfil para
                    oportunidades em que a operação disponibilize o veículo.
                  </InfoBox>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Carroceria *</Label>
                      <Select
                        value={draft.carroceria || undefined}
                        onValueChange={(valor) => atualizar("carroceria", valor)}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {CARROCERIAS.map((carroceria) => (
                            <SelectItem key={carroceria} value={carroceria}>
                              {carroceria === "Grade baixa" ? "Grade Baixa" : carroceria}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-modelo">Modelo (opcional)</Label>
                      <Input
                        id="oferta-modelo"
                        value={draft.veiculoModelo}
                        onChange={(event) => atualizar("veiculoModelo", event.target.value)}
                        placeholder="Ex.: Fiorino 1.4"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-placa">Placa (opcional)</Label>
                      <Input
                        id="oferta-placa"
                        value={draft.veiculoPlaca}
                        onChange={(event) =>
                          atualizar("veiculoPlaca", event.target.value.toUpperCase())
                        }
                        placeholder="ABC1D23"
                        maxLength={7}
                        className="h-11 uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-ano">Ano *</Label>
                      <Input
                        id="oferta-ano"
                        type="number"
                        min="1980"
                        max="2100"
                        value={draft.veiculoAno}
                        onChange={(event) => atualizar("veiculoAno", event.target.value)}
                        placeholder="2024"
                        className="h-11"
                      />
                    </div>
                  </div>
                )}

                <div className={cn("space-y-2", ehMotoboy && "hidden")}>
                  <Label>Características do veículo (opcional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {CARACTERISTICAS.map((caracteristica) => (
                      <Chip
                        key={caracteristica}
                        ativo={draft.caracteristicas.includes(caracteristica)}
                        onClick={() =>
                          atualizar(
                            "caracteristicas",
                            alternarLista(draft.caracteristicas, caracteristica),
                          )
                        }
                      >
                        {caracteristica}
                      </Chip>
                    ))}
                  </div>
                  {draft.caracteristicas.includes("Rastreador") ? (
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="oferta-marca-rastreador">Qual a marca do rastreador?</Label>
                      <Input
                        id="oferta-marca-rastreador"
                        value={draft.marcaRastreador}
                        onChange={(event) => atualizar("marcaRastreador", event.target.value)}
                        placeholder="Ex.: Autotrac"
                        className="h-11"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {etapa === 3 && (
              <div className="space-y-5">
                <div className={cn("grid gap-4 sm:grid-cols-2", (semVeiculo || ehMotoboy) && "hidden")}>
                  <div className="space-y-1.5">
                    <Label htmlFor="oferta-cap-kg">Capacidade de carga (kg)</Label>
                    <Input
                      id="oferta-cap-kg"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={draft.capacidadeKg}
                      onChange={(event) => atualizar("capacidadeKg", event.target.value)}
                      placeholder="Ex.: 1500"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="oferta-cap-m3">Capacidade cúbica (m³)</Label>
                    <Input
                      id="oferta-cap-m3"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={draft.capacidadeM3}
                      onChange={(event) => atualizar("capacidadeM3", event.target.value)}
                      placeholder="Ex.: 15"
                      className="h-11"
                    />
                  </div>
                </div>

                <div className={cn("space-y-2", (semVeiculo || ehMotoboy) && "hidden")}>
                  <Label>Dimensões internas (m) — opcional</Label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { chave: "comprimentoM" as const, rotulo: "Comprimento" },
                      { chave: "larguraM" as const, rotulo: "Largura" },
                      { chave: "alturaM" as const, rotulo: "Altura" },
                    ].map((campo) => (
                      <div key={campo.chave} className="space-y-1.5">
                        <Label htmlFor={`oferta-${campo.chave}`} className="text-xs text-slate-500">
                          {campo.rotulo}
                        </Label>
                        <Input
                          id={`oferta-${campo.chave}`}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={draft[campo.chave]}
                          onChange={(event) => atualizar(campo.chave, event.target.value)}
                          placeholder="0,00"
                          className="h-10"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Expectativas de Remuneração
                      </p>
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        Informe a sua expectativa. Entenda as modalidades: Diária (valor fixo por
                        dia de disposição), Saída (taxa base por viagem) e Adicional por Km (valor
                        cobrado por quilômetro rodado).
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <Checkbox
                        checked={draft.valorNegociavel}
                        onCheckedChange={(valor) => {
                          const ativo = valor === true;
                          setDraft((anterior) => ({
                            ...anterior,
                            valorNegociavel: ativo,
                            valorDiaria: ativo ? "" : anterior.valorDiaria,
                            valorKm: ativo ? "" : anterior.valorKm,
                            valorSaida: ativo ? "" : anterior.valorSaida,
                            valorMensal: ativo ? "" : anterior.valorMensal,
                            valorSemanal: ativo ? "" : anterior.valorSemanal,
                          }));
                          setErros([]);
                        }}
                      />
                      Valor a negociar
                    </label>
                  </div>

                  <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-900">
                    Baseie a sua expectativa financeira considerando uma média de 100 km rodados por dia.
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-valor-diaria">Diária (R$)</Label>
                      <Input
                        id="oferta-valor-diaria"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={draft.valorNegociavel}
                        value={draft.valorDiaria}
                        onChange={(event) => atualizar("valorDiaria", event.target.value)}
                        placeholder="Ex.: 250,00"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-valor-km">Adicional por Km (R$)</Label>
                      <Input
                        id="oferta-valor-km"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={draft.valorNegociavel}
                        value={draft.valorKm}
                        onChange={(event) => atualizar("valorKm", event.target.value)}
                        placeholder="Ex.: 1,00"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-valor-saida">Saída (R$)</Label>
                      <Input
                        id="oferta-valor-saida"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={draft.valorNegociavel}
                        value={draft.valorSaida}
                        onChange={(event) => atualizar("valorSaida", event.target.value)}
                        placeholder="Ex.: 80,00"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-valor-semanal">
                        {ehMotoboy ? "Valor de Contrato Desejado (R$)" : "Valor Semanal (R$)"}
                      </Label>
                      <Input
                        id="oferta-valor-semanal"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={draft.valorNegociavel}
                        value={draft.valorSemanal}
                        onChange={(event) => atualizar("valorSemanal", event.target.value)}
                        placeholder="Ex.: 1500,00"
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="oferta-condicoes">Condições comerciais</Label>
                    <Textarea
                      id="oferta-condicoes"
                      value={draft.condicoesComerciais}
                      onChange={(event) => atualizar("condicoesComerciais", event.target.value)}
                      placeholder="Ex.: valor mínimo por saída, pedágio, aguardo, forma de pagamento."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Seu perfil profissional</p>
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        Queremos conhecer a sua realidade atual. Estas informações ajudam-nos a
                        entender o seu perfil de trabalho e expectativas, não sendo uma exigência
                        da Conexão Express.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-perfil-carregamento">
                        Em qual operação/cliente você carrega principalmente hoje? (Nome da operação)
                      </Label>
                      <Input
                        id="oferta-perfil-carregamento"
                        value={draft.perfilCarregamento}
                        onChange={(event) => atualizar("perfilCarregamento", event.target.value)}
                        placeholder="Ex.: Mercado Livre, Correios, Operação de Cosméticos, etc."
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="oferta-faturamento-mensal">
                        Qual a sua média de faturamento mensal atual?
                      </Label>
                      <Input
                        id="oferta-faturamento-mensal"
                        value={draft.faturamentoMensal}
                        onChange={(event) => atualizar("faturamentoMensal", event.target.value)}
                        placeholder="Ex.: R$ 4.000 a R$ 6.000"
                        className="h-11"
                      />
                      <p className="text-[11px] text-slate-500">
                        Para entendermos o seu perfil de ganhos.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 rounded-2xl border border-slate-200 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Conte-nos um pouco sobre você
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Perguntas rápidas e opcionais para conhecermos o seu jeito de trabalhar.
                    </p>
                  </div>

                  <PerguntaEscolha
                    numero={1}
                    pergunta="Quando ocorre um imprevisto ou atraso na rota, qual costuma ser a sua primeira atitude?"
                    opcoes={ATITUDE_IMPREVISTO_OPCOES}
                    valor={draft.atitudeImprevisto}
                    onChange={(valor) => atualizar("atitudeImprevisto", valor)}
                  />

                  <PerguntaEscolha
                    numero={2}
                    pergunta="O que mais valoriza numa parceria de entregas?"
                    opcoes={VALORIZA_PARCERIA_OPCOES}
                    valor={draft.valorizaParceria}
                    onChange={(valor) => atualizar("valorizaParceria", valor)}
                    colunas={2}
                  />

                  <PerguntaEscolha
                    numero={3}
                    pergunta="Com qual tipo de operação logística está mais acostumado?"
                    opcoes={OPERACAO_OPCOES}
                    valor={draft.tipoOperacaoLogistica}
                    onChange={(valor) => atualizar("tipoOperacaoLogistica", valor)}
                    colunas={2}
                  />

                  <PerguntaEscolha
                    numero={4}
                    pergunta="Como organiza a manutenção do seu veículo?"
                    opcoes={MANUTENCAO_OPCOES}
                    valor={draft.manutencaoVeiculo}
                    onChange={(valor) => atualizar("manutencaoVeiculo", valor)}
                  />

                  <PerguntaEscolha
                    numero={5}
                    pergunta="Ao transportar uma carga frágil, qual o seu foco?"
                    opcoes={CARGA_FRAGIL_OPCOES}
                    valor={draft.focoCargaFragil}
                    onChange={(valor) => atualizar("focoCargaFragil", valor)}
                    colunas={2}
                  />

                  <PerguntaEscolha
                    numero={6}
                    pergunta="Se houver divergência na entrega com o cliente final, o que faz?"
                    opcoes={DIVERGENCIA_ENTREGA_OPCOES}
                    valor={draft.posturaDivergencia}
                    onChange={(valor) => atualizar("posturaDivergencia", valor)}
                  />

                  <PerguntaEscolha
                    numero={7}
                    pergunta="Como lida com aplicativos de rotas e entregas?"
                    opcoes={TECNOLOGIA_OPCOES}
                    valor={draft.facilidadeTecnologia}
                    onChange={(valor) => atualizar("facilidadeTecnologia", valor)}
                  />

                  <PerguntaEscolha
                    numero={8}
                    pergunta="Em semanas de alta demanda, você..."
                    opcoes={ALTA_DEMANDA_OPCOES}
                    valor={draft.disponibilidadeAltaDemanda}
                    onChange={(valor) => atualizar("disponibilidadeAltaDemanda", valor)}
                    colunas={2}
                  />

                  <div className="space-y-1.5">
                    <Label htmlFor="oferta-consumo-kml">
                      9. Qual a média de km por litro que o seu veículo costuma fazer?
                    </Label>
                    <Input
                      id="oferta-consumo-kml"
                      value={draft.consumoMedioKmL}
                      onChange={(event) => atualizar("consumoMedioKmL", event.target.value)}
                      placeholder="Ex.: 12 km/l"
                      className="h-11"
                    />
                  </div>

                  <PerguntaEscolha
                    numero={10}
                    pergunta="Como costuma organizar o abastecimento para uma operação fixa?"
                    opcoes={ABASTECIMENTO_OPCOES}
                    valor={draft.abastecimentoOperacao}
                    onChange={(valor) => atualizar("abastecimentoOperacao", valor)}
                  />

                  <PerguntaEscolha
                    numero={11}
                    pergunta="Se assumir uma rota fixa, mas surgir uma entrega avulsa pagando mais no mesmo dia, o que você faz?"
                    opcoes={COMPROMETIMENTO_OPCOES}
                    valor={draft.comprometimentoRotaFixa}
                    onChange={(valor) => atualizar("comprometimentoRotaFixa", valor)}
                  />

                  <PerguntaEscolha
                    numero={12}
                    pergunta="Quantas entregas/paradas costuma fazer por dia em média?"
                    opcoes={MEDIA_PARADAS_OPCOES}
                    valor={draft.mediaParadasDia}
                    onChange={(valor) => atualizar("mediaParadasDia", valor)}
                    colunas={2}
                  />
                </div>

                <InfoBox>{MENSAGEM_SEPARACAO}</InfoBox>
              </div>
            )}

            {etapa === 4 && (
              <div className="space-y-5">
                <ResumoOferta draft={draft} />

                <div className="space-y-1.5">
                  <Label htmlFor="oferta-restricoes">Restrições e condições de atendimento</Label>
                  <Textarea
                    id="oferta-restricoes"
                    value={draft.restricoes}
                    onChange={(event) => atualizar("restricoes", event.target.value)}
                    placeholder="Ex.: não atende finais de semana, restrição de região, necessidade de ajudante."
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="oferta-observacoes">Observações</Label>
                  <Textarea
                    id="oferta-observacoes"
                    value={draft.observacoes}
                    onChange={(event) => atualizar("observacoes", event.target.value)}
                    placeholder="Outras informações relevantes para a sua oferta."
                    rows={3}
                  />
                </div>

                <OfertaCaptcha onToken={setCaptchaToken} resetKey={captchaResetKey} />

                <div className="rounded-2xl border border-slate-200 p-4">
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <Checkbox
                      checked={draft.consentimento}
                      onCheckedChange={(valor) => atualizar("consentimento", valor === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Autorizo a Conexão Express a utilizar os dados informados para analisar
                      esta oferta e entrar em contato sobre disponibilidade e condições de
                      atendimento. Entendo que o envio desta oferta não representa aprovação,
                      contratação ou liberação de acesso ao APP.
                    </span>
                  </label>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Ao concluir, a oferta sera enviada ao canal seguro. O protocolo so sera
                    exibido apos a confirmacao real do backend.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={voltar}
                disabled={etapa === 0}
                className="h-11 w-full gap-2 sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button
                type="submit"
                disabled={enviando}
                className="h-11 w-full gap-2 bg-orange-600 text-white hover:bg-orange-700 sm:w-auto"
              >
                {enviando ? "Enviando..." : etapa === ETAPAS.length - 1 ? "Concluir oferta" : "Continuar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>

        <p className="mx-auto max-w-2xl px-2 text-center text-xs leading-relaxed text-slate-500">
          {DISCLAIMER_OFERTA}
        </p>
      </div>
    </div>
  );
}
