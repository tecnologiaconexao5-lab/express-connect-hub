// ============================================================
// COTACAO-EXPRESS PREMIUM — campo de endereço do fluxo conversacional
// Autocomplete Mapbox (mesma fonte do TMS) desenhado para "boliche"
// de chat: digita → sugestões → toque preenche. Sempre controlado
// (texto + sugestao ficam no pai) para o chat guardar o histórico.
//
// PREMIUM: ao selecionar uma sugestão, o endereço aparece
// DESTRINCHADO (rua, bairro, cidade, CEP) para o cliente confirmar
// visualmente; e o modo manual oferece as perguntas naturais do
// consultor: "Qual o CEP?", "Qual o nome da rua ou AV?",
// "Qual o bairro?", "Em qual município?".
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Edit3, Loader2, MapPin, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { buscarSugestoesEnderecos, type SugestaoEndereco } from "@/services/maps/mapboxProvider";
import { cepCompleto8, limparCepParcialDoTexto } from "@/lib/cepCotacao";

const DEBOUNCE_MS = 300;
const VIACEP_TIMEOUT_MS = 8000;
const MSG_CEP_NAO_ENCONTRADO = "CEP não encontrado. Por favor, preencha o endereço manualmente.";
const MSG_CEP_FALHA = "Não conseguimos consultar o CEP agora. Preencha o endereço manualmente.";

export interface CampoEnderecoChatProps {
  id: string;
  texto: string;
  sugestao: SugestaoEndereco | null;
  onTexto: (valor: string) => void;
  onSelecionar: (sugestao: SugestaoEndereco) => void;
  /** Confirmação manual (endereço montado pelas partes: rua/bairro/município/CEP). */
  onConfirmarManual?: (enderecoMontado: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

interface CamposManual {
  cep: string;
  rua: string;
  bairro: string;
  municipio: string;
}

const CAMPOS_VAZIOS = (): CamposManual => ({ cep: "", rua: "", bairro: "", municipio: "" });

const somenteDigitos = (v: string) => v.replace(/\D/g, "");

const formatarCep = (valor: string): string => {
  const d = somenteDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

/** Detecta um CEP brasileiro válido de 8 dígitos no texto digitado (ignora traço). */
const ehCepValido = (texto: string): boolean => /^\d{5}-?\d{3}$/.test(texto.trim());

/**
 * Monta o endereço manual confirmado — o CEP só entra na string se
 * tiver exatamente 8 dígitos (`cepCompleto8`), nunca um parcial.
 */
const montarEnderecoManual = (c: CamposManual): string =>
  [c.rua.trim(), c.bairro.trim(), c.municipio.trim(), cepCompleto8(c.cep)]
    .filter(Boolean)
    .join(", ");

interface RespostaViaCep {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  complemento?: string;
  unidade?: string;
  localidade?: string;
  uf?: string;
}

/** Consulta o ViaCEP (ou null em falha/abort). */
async function consultarViaCepJson(
  digitos: string,
  signal?: AbortSignal,
): Promise<RespostaViaCep | null> {
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { signal });
    if (!resp.ok) return null;
    const json = (await resp.json()) as RespostaViaCep;
    if (json.erro || !json.localidade) return null;
    return json;
  } catch {
    return null;
  }
}

/** Monta o place_name enriquecido (rua, bairro, cidade - UF, CEP). */
function montarPlaceName(s: SugestaoEndereco): string {
  const rua = [s.rua, s.numero].filter(Boolean).join(", ");
  const cidadeUf = s.cidade ? (s.uf ? `${s.cidade} - ${s.uf}` : s.cidade) : s.uf || "";
  return [rua, s.bairro, cidadeUf, cepCompleto8(s.cep || "")].filter(Boolean).join(", ");
}

/**
 * Monta uma SugestaoEndereco a partir de uma resposta VÁLIDA do ViaCEP
 * (dados oficiais dos Correios). lat/lng ficam NaN de propósito: o
 * cálculo de rota geocoda o endereço completo em background quando
 * precisar de coordenadas (Mapbox só entra nesse momento, pelo texto).
 */
function montarSugestaoViaCep(json: RespostaViaCep): SugestaoEndereco {
  const cep = cepCompleto8(json.cep || "");
  const rua = json.logradouro || "";
  const bairro = json.bairro || json.complemento || json.unidade || "";
  const cidade = json.localidade || "";
  const uf = json.uf || "";
  const cidadeUf = cidade ? (uf ? `${cidade} - ${uf}` : cidade) : uf || "";
  const placeName = [rua, bairro, cidadeUf, cep].filter(Boolean).join(", ");
  return {
    id: `viacep-${cep}`,
    place_name: placeName,
    rua,
    numero: "",
    bairro,
    cidade,
    uf,
    cep,
    lat: Number.NaN,
    lng: Number.NaN,
  };
}

/**
 * Busca REVERSA no ViaCEP (UF + cidade + logradouro) — resgata o CEP
 * completo (8 dígitos) quando o Mapbox só devolveu um CEP parcial
 * (ex.: "06473") ou nenhum CEP. Retorna null em falha/nenhum match.
 */
async function consultarViaCepPorEndereco(
  uf: string,
  cidade: string,
  logradouro: string,
  prefixoParcial = "",
): Promise<RespostaViaCep | null> {
  try {
    const url =
      `https://viacep.com.br/ws/${encodeURIComponent(uf.trim().toUpperCase())}` +
      `/${encodeURIComponent(cidade.trim())}/${encodeURIComponent(logradouro.trim())}/json/`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const dados: unknown = await resp.json();
    if (!Array.isArray(dados)) return null;
    const candidatos = (dados as RespostaViaCep[]).filter((item) => {
      const c = somenteDigitos(item.cep || "");
      return c.length === 8 && !item.erro && item.localidade;
    });
    if (candidatos.length === 0) return null;
    // Prioriza o resultado cujo CEP casa com o prefixo parcial original (ex.: "06473")
    const comPrefixo = prefixoParcial
      ? candidatos.find((item) => somenteDigitos(item.cep || "").startsWith(prefixoParcial))
      : undefined;
    return comPrefixo || candidatos[0];
  } catch {
    return null;
  }
}

/**
 * Corrige sugestões Mapbox consultando o ViaCEP e GARANTE CEP estrito:
 * - CEP completo (8 dígitos) faltando bairro/rua → busca pelo CEP;
 * - CEP parcial/ausente + rua/cidade/UF → busca reversa (UF/cidade/logradouro)
 *   para resgatar o CEP de 8 dígitos;
 * - se ainda não houver 8 dígitos → CEP fica vazio (nunca exibir parcial);
 * - o place_name é reconstruído/limpo para não conter o CEP parcial.
 */
async function enriquecerSugestaoComViaCep(
  item: SugestaoEndereco,
): Promise<SugestaoEndereco> {
  const digitosOriginais = somenteDigitos(item.cep || "");
  const cepValido = digitosOriginais.length === 8;
  const faltaBairro = !item.bairro?.trim();
  const faltaRua = !item.rua?.trim();
  const temBaseReversa = Boolean(item.rua?.trim() && item.cidade?.trim() && item.uf?.trim());

  let cepFinal = cepValido ? formatarCep(digitosOriginais) : "";
  let json: RespostaViaCep | null = null;

  if (cepValido && (faltaBairro || faltaRua)) {
    // Cenário 1: CEP completo presente mas faltando bairro/rua → busca pelo CEP
    json = await consultarViaCepJson(digitosOriginais);
  } else if (!cepValido && temBaseReversa) {
    // Cenário 2: CEP parcial/ausente → busca reversa para resgatar 8 dígitos
    json = await consultarViaCepPorEndereco(
      item.uf as string,
      item.cidade as string,
      item.rua as string,
      digitosOriginais,
    );
    const resgatado = somenteDigitos(json?.cep || "");
    if (resgatado.length === 8) cepFinal = formatarCep(resgatado);
  }

  // Resultado final com CEP estrito: só 8 dígitos formatados ou ""
  const enriquecida: SugestaoEndereco = {
    ...item,
    cep: cepFinal,
    rua: item.rua?.trim() || json?.logradouro || "",
    bairro: item.bairro?.trim() || json?.bairro || json?.complemento || json?.unidade || "",
    cidade: item.cidade?.trim() || json?.localidade || "",
    uf: item.uf?.trim() || json?.uf || "",
  };

  const mudou =
    enriquecida.rua !== item.rua ||
    enriquecida.bairro !== item.bairro ||
    enriquecida.cidade !== item.cidade ||
    enriquecida.uf !== item.uf ||
    enriquecida.cep !== item.cep;
  if (!mudou) return item;

  // place_name sem CEP parcial: reconstrói quando há base; senão limpa o texto original
  const temBase = Boolean(enriquecida.rua?.trim() || enriquecida.cidade?.trim());
  const placeFinal = temBase
    ? montarPlaceName(enriquecida)
    : limparCepParcialDoTexto(item.place_name || "", digitosOriginais);
  return { ...enriquecida, place_name: placeFinal || item.place_name };
}

/** Linha do destrinchamento (rua/bairro/cidade/CEP) do endereço confirmado. */
function LinhaEndereco({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {rotulo}
      </span>
      <span className="min-w-0 truncate text-right text-[13px] font-semibold text-slate-700">
        {valor || "—"}
      </span>
    </div>
  );
}

export default function CampoEnderecoChat({
  id,
  texto,
  sugestao,
  onTexto,
  onSelecionar,
  onConfirmarManual,
  placeholder = "CEP, bairro ou rua",
  autoFocus = false,
}: CampoEnderecoChatProps) {
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [manual, setManual] = useState<CamposManual>(CAMPOS_VAZIOS);
  const [erroManual, setErroManual] = useState("");
  const [cepStatus, setCepStatus] = useState<"ocioso" | "buscando" | "ok" | "erro">("ocioso");
  const [cepMensagem, setCepMensagem] = useState("");
  const sequenciaRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cepUltimoBuscadoRef = useRef("");
  const cepSequenciaRef = useRef(0);
  const cepAbortRef = useRef<AbortController | null>(null);
  const ruaManualRef = useRef<HTMLInputElement>(null);

  // Fecha o dropdown ao tocar fora
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: MouseEvent) => {
      if (!containerRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  // Busca com debounce + descarte de respostas velhas
  useEffect(() => {
    const termo = texto.trim();
    const digitando = !sugestao || termo !== sugestao.place_name;
    if (digitando) setSugestoes([]);
    if (termo.length < 3 || !digitando) {
      setCarregando(false);
      return;
    }

    const meu = ++sequenciaRef.current;
    const timer = window.setTimeout(async () => {
      setCarregando(true);
      try {
        // ---- INTERCEPTADOR DE CEP (bug: Mapbox trata CEP como texto genérico) ----
        // Um CEP de 8 dígitos (ex.: "04194250") digitado no autocomplete ia
        // direto ao Mapbox text search, que devolve endereços absurdos (ex.:
        // Santa Catarina para um CEP de SP). Quando o cliente digita um CEP
        // válido, paramos o Mapbox e consultamos o ViaCEP (dados oficiais dos
        // Correios); o Mapbox só entra depois, em background, para lat/lng.
        if (ehCepValido(termo)) {
          const digitos = somenteDigitos(termo);
          const json = await consultarViaCepJson(digitos);
          if (meu !== sequenciaRef.current) return;
          if (json) {
            // Sucesso: sugestão 100% oficial dos Correios no topo do dropdown.
            setSugestoes([montarSugestaoViaCep(json)]);
            setAberto(true);
          } else {
            // CEP inexistente/erro do ViaCEP → sem sugestão falsa; mantém o
            // campo aberto para o cliente digitar o endereço (modo manual).
            setSugestoes([]);
            setAberto(false);
          }
          return;
        }

        // ---- FLUXO NORMAL MAPBOX (texto livre, com proximity SP) ----
        const resultados = await buscarSugestoesEnderecos(termo);
        if (meu !== sequenciaRef.current) return;
        setSugestoes(resultados);
        setAberto(resultados.length > 0);
      } catch {
        if (meu !== sequenciaRef.current) return;
        setSugestoes([]);
      } finally {
        if (meu === sequenciaRef.current) setCarregando(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [texto, sugestao]);

  // ---- ViaCEP: busca automática quando o CEP completo (8 dígitos) é digitado ----
  // Guardas anti-loop: (1) só dispara com 8 dígitos; (2) só dispara quando o CEP
  // limpo muda (cepUltimoBuscadoRef); (3) AbortController cancela a requisição
  // anterior ao desmontar/alterar; (4) resposta obsoleta é descartada por sequência.
  useEffect(() => {
    const digitos = somenteDigitos(manual.cep);
    if (digitos.length < 8) {
      setCepStatus("ocioso");
      setCepMensagem("");
      return;
    }
    if (digitos === cepUltimoBuscadoRef.current) return;
    cepUltimoBuscadoRef.current = digitos;

    const meu = ++cepSequenciaRef.current;
    cepAbortRef.current?.abort();
    const controle = new AbortController();
    cepAbortRef.current = controle;

    setCepStatus("buscando");
    setCepMensagem("");
    const timer = window.setTimeout(async () => {
      try {
        const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
          signal: controle.signal,
        });
        if (!resp.ok) throw new Error(`http ${resp.status}`);
        const json = (await resp.json()) as {
          erro?: boolean;
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
        };
        if (meu !== cepSequenciaRef.current) return;
        if (json.erro || !json.localidade) {
          setCepStatus("erro");
          setCepMensagem(MSG_CEP_NAO_ENCONTRADO);
          toast.error(MSG_CEP_NAO_ENCONTRADO);
          return;
        }
        // Preenche só os campos vazios (não sobrescreve o que o cliente já digitou)
        setManual((m) => ({
          ...m,
          rua: m.rua.trim() || json.logradouro || "",
          bairro: m.bairro.trim() || json.bairro || json.complemento || json.unidade || "",
          municipio:
            m.municipio.trim() ||
            (json.localidade ? (json.uf ? `${json.localidade} - ${json.uf}` : json.localidade) : ""),
        }));
        setCepStatus("ok");
        setCepMensagem("Endereço encontrado ✓");
        // Sem campo de "Número" nesta etapa: foca o próximo campo (Rua)
        window.setTimeout(() => ruaManualRef.current?.focus(), 50);
      } catch {
        if (controle.signal.aborted || meu !== cepSequenciaRef.current) return;
        setCepStatus("erro");
        setCepMensagem(MSG_CEP_FALHA);
        toast.error(MSG_CEP_FALHA);
      } finally {
        if (meu === cepSequenciaRef.current) setCepStatus((s) => (s === "buscando" ? "ocioso" : s));
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controle.abort();
    };
  }, [manual.cep]);

  const selecionar = useCallback(
    (item: SugestaoEndereco) => {
      setAberto(false);
      setSugestoes([]);
      setCarregando(true);
      void (async () => {
        try {
          // Enriquece bairro/rua via ViaCEP quando o Mapbox omite (evita "—")
          const enriquecida = await enriquecerSugestaoComViaCep(item);
          setModoManual(false);
          setErroManual("");
          onSelecionar(enriquecida);
        } finally {
          setCarregando(false);
        }
      })();
    },
    [onSelecionar],
  );

  const teclado = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Escape") {
      setAberto(false);
      return;
    }
    if (evento.key === "Enter" && aberto && sugestoes.length > 0) {
      evento.preventDefault();
      selecionar(sugestoes[0]);
    }
  };

  const abrirManual = () => {
    // Pré-carrega o manual com o que já se sabe da sugestão.
    if (sugestao) {
      setManual({
        // CEP parcial (ex.: 5 dígitos) nunca entra no manual — fica vazio p/ digitar
        cep: cepCompleto8(sugestao.cep || ""),
        rua: [sugestao.rua, sugestao.numero].filter(Boolean).join(", "),
        bairro: sugestao.bairro || "",
        municipio: sugestao.cidade ? (sugestao.uf ? `${sugestao.cidade} - ${sugestao.uf}` : sugestao.cidade) : "",
      });
      // CEP já conhecido: não disparar ViaCEP ao abrir o modo manual.
      cepUltimoBuscadoRef.current = somenteDigitos(sugestao.cep || "");
    } else {
      cepUltimoBuscadoRef.current = "";
    }
    setCepStatus("ocioso");
    setCepMensagem("");
    setErroManual("");
    setModoManual(true);
    setAberto(false);
  };

  const voltarBusca = () => {
    cepAbortRef.current?.abort();
    setCepStatus("ocioso");
    setCepMensagem("");
    setModoManual(false);
    setErroManual("");
  };

  const confirmarManual = () => {
    if (manual.rua.trim().length < 3) {
      setErroManual("Informe o nome da rua ou AV para continuarmos.");
      return;
    }
    if (manual.municipio.trim().length < 2) {
      setErroManual("Informe o município (cidade - UF).");
      return;
    }
    const montado = montarEnderecoManual(manual);
    cepAbortRef.current?.abort();
    setErroManual("");
    setModoManual(false);
    onConfirmarManual?.(montado);
  };

  // Card de confirmação destrinchado quando já há endereço escolhido
  const enderecoConfirmado = sugestao || (modoManual ? null : null);

  return (
    <div ref={containerRef} className="relative space-y-3">
      {/* ---------------- BUSCA (autocomplete) ---------------- */}
      {!modoManual && (
        <>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-500" />
            <Input
              id={id}
              className="h-12 rounded-xl pl-9 text-base"
              placeholder={placeholder}
              autoComplete="off"
              autoFocus={autoFocus}
              role="combobox"
              aria-expanded={aberto}
              value={texto}
              onChange={(e) => {
                onTexto(e.target.value);
                setAberto(true);
              }}
              onFocus={() => sugestoes.length > 0 && setAberto(true)}
              onKeyDown={teclado}
            />
            {carregando && (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
          </div>

          {aberto && sugestoes.length > 0 && (
            <ul className="absolute left-0 right-0 top-14 z-30 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              {sugestoes.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selecionar(item)}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-orange-50"
                  >
                    <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.place_name}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {[item.bairro, item.cidade, item.uf].filter(Boolean).join(" · ") || " "}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* -------- DESTRINCHAMENTO (confirmação visual) -------- */}
          {enderecoConfirmado && !aberto && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Endereço reconhecido — confira se está certo
              </div>
              <div className="mt-2 space-y-0.5">
                <LinhaEndereco
                  rotulo="Rua / AV"
                  valor={[enderecoConfirmado.rua, enderecoConfirmado.numero].filter(Boolean).join(", ")}
                />
                <LinhaEndereco rotulo="Bairro" valor={enderecoConfirmado.bairro} />
                <LinhaEndereco rotulo="Cidade" valor={enderecoConfirmado.cidade} />
                <LinhaEndereco rotulo="UF" valor={enderecoConfirmado.uf} />
                <LinhaEndereco rotulo="CEP" valor={cepCompleto8(enderecoConfirmado.cep || "")} />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  onClick={abrirManual}
                >
                  <Edit3 className="mr-1 h-3 w-3" /> Corrigir manualmente
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg text-slate-500"
                  onClick={() => {
                    onTexto("");
                    onSelecionar({
                      id: "",
                      place_name: "",
                      rua: "",
                      numero: "",
                      bairro: "",
                      cidade: "",
                      uf: "",
                      cep: "",
                      lat: Number.NaN,
                      lng: Number.NaN,
                    });
                    setManual(CAMPOS_VAZIOS);
                  }}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Trocar
                </Button>
              </div>
            </div>
          )}

          {/* Atalho para o modo manual (perguntas naturais) */}
          {!enderecoConfirmado && (
            <button
              type="button"
              onClick={abrirManual}
              className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-orange-600 hover:underline"
            >
              Não encontrei — preencher rua, bairro e cidade na mão
            </button>
          )}
        </>
      )}

      {/* ---------------- MANUAL (perguntas naturais) ---------------- */}
      {modoManual && (
        <div className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-orange-600">
            Preenchimento manual
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-manual-cep`} className="text-sm font-semibold text-slate-700">
              Qual o CEP?
            </Label>
            <div className="relative">
              <Input
                id={`${id}-manual-cep`}
                inputMode="numeric"
                autoComplete="postal-code"
                className="h-11 rounded-xl bg-white pr-10 text-base"
                placeholder="00000-000"
                value={manual.cep}
                onChange={(e) => setManual((m) => ({ ...m, cep: formatarCep(e.target.value) }))}
              />
              {cepStatus === "buscando" && (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-orange-500" />
              )}
            </div>
            {cepStatus === "buscando" && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando endereço...
              </p>
            )}
            {cepStatus === "ok" && cepMensagem && (
              <p className="text-xs font-semibold text-emerald-600">{cepMensagem}</p>
            )}
            {cepStatus === "erro" && cepMensagem && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                {cepMensagem}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-manual-rua`} className="text-sm font-semibold text-slate-700">
              Qual o nome da rua ou AV? *
            </Label>
            <Input
              id={`${id}-manual-rua`}
              ref={ruaManualRef}
              autoComplete="address-line1"
              className="h-11 rounded-xl bg-white text-base"
              placeholder="Ex.: Avenida Sumaré"
              value={manual.rua}
              onChange={(e) => setManual((m) => ({ ...m, rua: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-manual-bairro`} className="text-sm font-semibold text-slate-700">
              Qual o bairro?
            </Label>
            <Input
              id={`${id}-manual-bairro`}
              autoComplete="address-level3"
              className="h-11 rounded-xl bg-white text-base"
              placeholder="Ex.: Vila Madalena"
              value={manual.bairro}
              onChange={(e) => setManual((m) => ({ ...m, bairro: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-manual-municipio`} className="text-sm font-semibold text-slate-700">
              Em qual município? *
            </Label>
            <Input
              id={`${id}-manual-municipio`}
              autoComplete="address-level2"
              className="h-11 rounded-xl bg-white text-base"
              placeholder="Ex.: São Paulo - SP"
              value={manual.municipio}
              onChange={(e) => setManual((m) => ({ ...m, municipio: e.target.value }))}
            />
          </div>
          {erroManual && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {erroManual}
            </p>
          )}
          <div className="flex w-full flex-row gap-2">
            <Button
              type="button"
              className="h-11 flex-1 rounded-xl bg-orange-500 font-bold text-white hover:bg-orange-600"
              onClick={confirmarManual}
            >
              <Check className="mr-1.5 h-4 w-4" /> Confirmar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl border-slate-300 text-slate-600"
              onClick={voltarBusca}
            >
              <Search className="mr-1.5 h-4 w-4" /> Buscar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
