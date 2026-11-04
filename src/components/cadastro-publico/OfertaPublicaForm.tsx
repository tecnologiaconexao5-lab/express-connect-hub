import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  DollarSign,
  FileText,
  Info,
  MapPin,
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
  CARACTERISTICAS,
  CARROCERIAS,
  DIAS_SEMANA,
  MENSAGEM_OFERTA_REGISTRADA,
  MENSAGEM_SEPARACAO,
  MODALIDADES,
  REGIOES,
  TIPOS_MOTO,
  TIPOS_OFERTA,
  TIPOS_VEICULO,
  UFS,
  criarOfertaVazia,
  montarPayloadOferta,
  validarEtapaOferta,
  validarOferta,
  type Modalidade,
  type OfertaPublicaDraft,
  type TipoOferta,
} from "@/lib/ofertaPublica";

const ETAPAS = [
  { titulo: "Oferta e contato", icone: User },
  { titulo: "Região e disponibilidade", icone: MapPin },
  { titulo: "Modalidades e veículo", icone: Truck },
  { titulo: "Capacidade e valores", icone: DollarSign },
  { titulo: "Restrições e consentimento", icone: ShieldCheck },
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
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        ativo
          ? "border-orange-500 bg-orange-500 text-white"
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

function rotuloTipoOferta(tipo: TipoOferta | "") {
  return TIPOS_OFERTA.find((t) => t.value === tipo)?.label || "—";
}

function rotuloModalidades(modalidades: Modalidade[]) {
  return modalidades
    .map((m) => MODALIDADES.find((item) => item.value === m)?.label || m)
    .join(", ");
}

function rotuloDias(dias: number[]) {
  return dias
    .map((d) => DIAS_SEMANA.find((item) => item.value === d)?.label || String(d))
    .join(", ");
}

function ResumoOferta({ draft }: { draft: OfertaPublicaDraft }) {
  const regioes = [...draft.regioes, draft.outrasRegioes.trim()].filter(Boolean).join(", ");
  const veiculo =
    draft.tipoOferta === "motoboy"
      ? `Moto ${draft.tipoMoto || ""}${draft.possuiBau ? " · com baú" : ""}`.trim()
      : [draft.veiculoTipo, draft.carroceria].filter(Boolean).join(" · ");

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-orange-600" />
        <p className="text-sm font-semibold text-slate-800">Resumo da oferta</p>
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Tipo</dt>
          <dd className="font-medium text-slate-800">{rotuloTipoOferta(draft.tipoOferta)}</dd>
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
            {rotuloDias(draft.dias) || "—"} · {draft.horarioInicio || "—"} às {draft.horarioFim || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Modalidades</dt>
          <dd className="font-medium text-slate-800">{rotuloModalidades(draft.modalidades) || "—"}</dd>
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
                  draft.valorMensal ? `Mensal R$ ${draft.valorMensal}` : "",
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
  const requestIdRef = useRef<string | null>(null);

  const ehMotoboy = draft.tipoOferta === "motoboy";
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
    setCaptchaToken("");
    setCaptchaResetKey((atual) => atual + 1);
    requestIdRef.current = null;
    setConcluido(false);
  };

  if (concluido) {
    return (
      <div className="min-h-dvh bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2E1065] text-sm font-black text-white">
              CE
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Oferta de Prestadores</h1>
              <p className="text-xs text-slate-500">Conexao Express</p>
            </div>
          </header>

          <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">Oferta registrada</h2>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    Protocolo recebido
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

          <p className="text-center text-xs text-slate-500">
            Esta oferta nao cria cadastro no APP, nao aprova e nao libera acesso operacional.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2E1065] text-sm font-black text-white">
            CE
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Oferta de Prestadores</h1>
            <p className="text-xs text-slate-500">Conexão Express · motoboys, motoristas e veículos</p>
          </div>
        </header>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-wrap gap-2">
            {ETAPAS.map((item, index) => {
              const ativo = index === etapa;
              const concluida = index < etapa;
              return (
                <div
                  key={item.titulo}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
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
                  <Label>Tipo de oferta *</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {TIPOS_OFERTA.map((tipo) => {
                      const ativo = draft.tipoOferta === tipo.value;
                      return (
                        <button
                          key={tipo.value}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => atualizar("tipoOferta", tipo.value)}
                          className={cn(
                            "rounded-2xl border p-3 text-left transition-colors",
                            ativo
                              ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                              : "border-slate-200 bg-white hover:border-orange-300",
                          )}
                        >
                          <p className="text-sm font-semibold text-slate-900">{tipo.label}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{tipo.descricao}</p>
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
                      onChange={(event) => atualizar("cidade", event.target.value)}
                      placeholder="Ex.: São Paulo"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF *</Label>
                    <Select
                      value={draft.uf || undefined}
                      onValueChange={(valor) => atualizar("uf", valor)}
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
                  <div className="flex flex-wrap gap-2">
                    {REGIOES.map((regiao) => (
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="oferta-horario-inicio">Horário de início *</Label>
                    <Input
                      id="oferta-horario-inicio"
                      type="time"
                      value={draft.horarioInicio}
                      onChange={(event) => atualizar("horarioInicio", event.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="oferta-horario-fim">Horário de fim *</Label>
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
                </div>

                <InfoBox>{MENSAGEM_SEPARACAO}</InfoBox>

                <div className="grid gap-4 sm:grid-cols-2">
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

                  {ehMotoboy ? (
                    <div className="space-y-1.5">
                      <Label>Tipo de moto *</Label>
                      <Select
                        value={draft.tipoMoto || undefined}
                        onValueChange={(valor) => atualizar("tipoMoto", valor)}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_MOTO.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
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
                  )}
                </div>

                {ehMotoboy ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 sm:col-span-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Possui baú?</p>
                        <p className="text-[11px] text-slate-500">
                          Informe se a moto está equipada com baú para entregas.
                        </p>
                      </div>
                      <Checkbox
                        checked={draft.possuiBau}
                        onCheckedChange={(valor) => {
                          const ativo = valor === true;
                          setDraft((anterior) => ({
                            ...anterior,
                            possuiBau: ativo,
                            capacidadeBauLitros: ativo ? anterior.capacidadeBauLitros : "",
                          }));
                          setErros([]);
                        }}
                      />
                    </div>
                    {draft.possuiBau ? (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="oferta-bau-litros">Capacidade do baú (litros)</Label>
                        <Input
                          id="oferta-bau-litros"
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={draft.capacidadeBauLitros}
                          onChange={(event) => atualizar("capacidadeBauLitros", event.target.value)}
                          placeholder="Ex.: 90"
                          className="h-11"
                        />
                      </div>
                    ) : null}
                  </div>
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
                              {carroceria}
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
                      <Label htmlFor="oferta-ano">Ano (opcional)</Label>
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

                <div className="space-y-2">
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
                </div>
              </div>
            )}

            {etapa === 3 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
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

                <div className="space-y-2">
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Valores e condições</p>
                      <p className="text-[11px] text-slate-500">
                        Informe o que fizer sentido para a sua oferta.
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
                          }));
                          setErros([]);
                        }}
                      />
                      Valor a negociar
                    </label>
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
                      <Label htmlFor="oferta-valor-km">Valor por km (R$)</Label>
                      <Input
                        id="oferta-valor-km"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={draft.valorNegociavel}
                        value={draft.valorKm}
                        onChange={(event) => atualizar("valorKm", event.target.value)}
                        placeholder="Ex.: 2,50"
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
                      <Label htmlFor="oferta-valor-mensal">Mensalidade (R$)</Label>
                      <Input
                        id="oferta-valor-mensal"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={draft.valorNegociavel}
                        value={draft.valorMensal}
                        onChange={(event) => atualizar("valorMensal", event.target.value)}
                        placeholder="Ex.: 6000,00"
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
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button type="submit" disabled={enviando} className="gap-2 bg-orange-600 text-white hover:bg-orange-700">
                {enviando ? "Enviando..." : etapa === ETAPAS.length - 1 ? "Concluir oferta" : "Continuar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500">
          Oferta comercial de disponibilidade. Não é cadastro no APP, aprovação ou contratação.
        </p>
      </div>
    </div>
  );
}
