// ============================================================
// MISSÃO COTACAO-EXPRESS — FASE 1 (pré-cadastro de alta conversão)
// Rota pública /cotacao-express — link do WhatsApp/site.
//
// CRO: 1 pergunta por tela, mobile-first, SEM menu do TMS,
// SEM campos de complemento/contato (fricção zero aqui — esses
// dados só são pedidos na Fase 2, depois da aprovação do valor).
//
// Passos: 1 contato → 2 carga → 3 trajeto dinâmico (até 8 paradas)
//         → 4 data/hora → 5 sucesso.
// ============================================================
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, CheckCircle2, Info, MapPin, Plus, Truck, X } from "lucide-react";
import {
  criarCotacaoFase1,
  MAX_PARADAS_COTACAO,
} from "@/services/cotacoes/cotacaoPublicaService";

const TOTAL_ETAPAS = 4;

const mascararTelefone = (valor: string): string => {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export default function CotacaoExpress() {
  const [etapa, setEtapa] = useState(1);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [descricao, setDescricao] = useState("");
  const [peso, setPeso] = useState("");
  const [dimensoes, setDimensoes] = useState("");
  const [paradas, setParadas] = useState<string[]>(["", ""]);
  const [dataDesejada, setDataDesejada] = useState("");
  const [horaDesejada, setHoraDesejada] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const progresso = useMemo(
    () => Math.min(100, Math.round((Math.min(etapa, TOTAL_ETAPAS) / TOTAL_ETAPAS) * 100)),
    [etapa],
  );

  const atualizarParada = (idx: number, valor: string) =>
    setParadas((prev) => prev.map((p, i) => (i === idx ? valor : p)));

  const adicionarParada = () => {
    if (paradas.length >= MAX_PARADAS_COTACAO) {
      setErro(`Limite de ${MAX_PARADAS_COTACAO} endereços por rota.`);
      return;
    }
    setErro("");
    setParadas((prev) => [...prev, ""]);
  };

  const removerParada = (idx: number) => {
    if (paradas.length <= 2) return;
    setParadas((prev) => prev.filter((_, i) => i !== idx));
  };

  const validarEtapa = (atual: number): string => {
    if (atual === 1) {
      if (nome.trim().length < 2) return "Digite seu nome para continuarmos.";
      if (telefone.replace(/\D/g, "").length < 10)
        return "Informe um WhatsApp com DDD (ex.: 11 99999-9999).";
    }
    if (atual === 2) {
      if (descricao.trim().length < 3) return "Descreva brevemente o que será transportado.";
      if (peso && (!(Number(peso) > 0))) return "Peso deve ser um valor em kg.";
    }
    if (atual === 3) {
      const preenchidas = paradas.filter((p) => p.trim().length >= 3);
      if (preenchidas.length < 2) return "Informe a retirada e pelo menos 1 entrega.";
      if (preenchidas.length > MAX_PARADAS_COTACAO)
        return `Limite de ${MAX_PARADAS_COTACAO} endereços.`;
    }
    if (atual === 4 && !dataDesejada) return "Escolha a data desejada da coleta.";
    return "";
  };

  const avancar = () => {
    const problema = validarEtapa(etapa);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro("");
    if (etapa < TOTAL_ETAPAS) {
      setEtapa(etapa + 1);
      return;
    }
    void enviar();
  };

  const voltar = () => {
    setErro("");
    setEtapa((e) => Math.max(1, e - 1));
  };

  const enviar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const res = await criarCotacaoFase1({
        nome_cliente: nome,
        telefone,
        carga_descricao: descricao,
        carga_peso: peso ? Number(peso) : null,
        carga_dimensoes: dimensoes,
        paradas,
        data_desejada: dataDesejada,
        hora_desejada: horaDesejada,
      });
      if (!res.ok) {
        setErro(res.erro || "Não foi possível enviar agora. Tente novamente.");
        return;
      }
      setErro("");
      setEtapa(5);
    } finally {
      setEnviando(false);
    }
  };

  const rotuloParada = (idx: number) =>
    idx === 0 ? "1ª parada — Retirada" : `${idx + 1}ª parada — Entrega ${idx}`;

  const rotuloTipoParada = (idx: number) => (idx === 0 ? "retirada" : "entrega");

  // ------------------------------------------------------------
  // PASSO 5 — sucesso
  // ------------------------------------------------------------
  if (etapa === 5) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-100 flex flex-col">
        <header className="px-4 py-4 flex items-center justify-between">
          <span className="text-sm font-extrabold tracking-tight text-slate-900">
            ⚡ CONEXÃO EXPRESS
          </span>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-700">
            Cotação Express
          </span>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl animate-fade-in">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="text-2xl font-bold leading-snug text-slate-900">
              Tudo certo, {nome.trim().split(" ")[0]}! 🚀
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              Analisaremos a rota e enviaremos o valor no WhatsApp. Após sua aprovação,
              pediremos os detalhes finais do endereço.
            </p>
            <p className="mt-6 text-xs text-slate-400">
              Fique atento à mensagem de número (11) 4000-0000.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------
  // PASSOS 1 a 4
  // ------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-100 flex flex-col">
      <header className="px-4 py-4 flex items-center justify-between">
        <span className="text-sm font-extrabold tracking-tight text-slate-900">
          ⚡ CONEXÃO EXPRESS
        </span>
        <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-700">
          Cotação Express
        </span>
      </header>

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
            Pergunta {etapa} de {TOTAL_ETAPAS}
          </span>
          <span>{progresso}%</span>
        </div>
      </div>

      <main className="flex-1 px-4 pt-6 pb-40">
        <div className="mx-auto w-full max-w-xl space-y-6 animate-fade-in" key={etapa}>
          {/* ETAPA 1 — contato */}
          {etapa === 1 && (
            <>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-orange-600">
                  Etapa 1 · Quem pediu
                </span>
                <h1 className="mt-1 text-2xl font-bold leading-snug text-slate-900">
                  Para quem enviamos a proposta?
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Leva 30 segundos. Sem cadastro, sem senha.
                </p>
              </div>
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
            </>
          )}

          {/* ETAPA 2 — carga */}
          {etapa === 2 && (
            <>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-orange-600">
                  Etapa 2 · A carga
                </span>
                <h1 className="mt-1 text-2xl font-bold leading-snug text-slate-900">
                  O que será transportado?
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Uma descrição rápida já nos permite calcular o frete.
                </p>
              </div>
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
            </>
          )}

          {/* ETAPA 3 — trajeto dinâmico (apenas uma referência por parada) */}
          {etapa === 3 && (
            <>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-orange-600">
                  Etapa 3 · O trajeto
                </span>
                <h1 className="mt-1 text-2xl font-bold leading-snug text-slate-900">
                  De onde buscamos e para onde entregamos?
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Só a referência: <strong>CEP, bairro ou rua</strong>. Número e complemento
                  pedimos depois, quando o valor for aprovado.
                </p>
              </div>

              <div className="space-y-3">
                {paradas.map((parada, idx) => (
                  <div
                    key={`parada-${idx}`}
                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <MapPin className="h-3.5 w-3.5 text-orange-500" />
                        {rotuloParada(idx)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {rotuloTipoParada(idx)}
                      </span>
                    </div>
                    <Input
                      className="h-12 rounded-xl text-base"
                      placeholder="CEP, bairro ou rua"
                      value={parada}
                      onChange={(e) => atualizarParada(idx, e.target.value)}
                    />
                    {paradas.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removerParada(idx)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" /> Remover parada
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={adicionarParada}
                  disabled={paradas.length >= MAX_PARADAS_COTACAO}
                  className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-orange-300 bg-orange-50/50 py-3 text-sm font-bold text-orange-700 transition hover:bg-orange-50 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Adicionar parada
                  <span className="text-xs font-medium text-orange-500/80">
                    ({paradas.length}/{MAX_PARADAS_COTACAO})
                  </span>
                </button>
              </div>
            </>
          )}

          {/* ETAPA 4 — data/hora */}
          {etapa === 4 && (
            <>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-orange-600">
                  Etapa 4 · Quando
                </span>
                <h1 className="mt-1 text-2xl font-bold leading-snug text-slate-900">
                  Quando você precisa disso?
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Data desejada da retirada. O horário é opcional.
                </p>
              </div>
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="cot-data">Data desejada *</Label>
                  <Input
                    id="cot-data"
                    type="date"
                    className="h-12 rounded-xl text-base"
                    value={dataDesejada}
                    onChange={(e) => setDataDesejada(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cot-hora">Horário desejado (opcional)</Label>
                  <Input
                    id="cot-hora"
                    type="time"
                    className="h-12 rounded-xl text-base"
                    value={horaDesejada}
                    onChange={(e) => setHoraDesejada(e.target.value)}
                  />
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                  <span className="font-bold text-slate-700">Rota:</span>{" "}
                  {paradas.filter((p) => p.trim()).join(" → ") || "—"}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Barra de ações fixa (mobile-first) */}
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
          <Button
            type="button"
            className="h-12 rounded-xl bg-orange-500 px-6 text-base font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600"
            onClick={avancar}
            disabled={enviando}
          >
            {enviando ? (
              "Enviando..."
            ) : etapa === TOTAL_ETAPAS ? (
              <>
                <Truck className="mr-2 h-4 w-4" /> Quero minha cotação
              </>
            ) : (
              <>
                Continuar <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
        {erro && (
          <p className="mx-auto mt-2 w-full max-w-xl text-center text-xs font-semibold text-red-500">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
