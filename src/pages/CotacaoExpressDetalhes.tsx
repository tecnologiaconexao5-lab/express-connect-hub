// ============================================================
// MISSÃO COTACAO-EXPRESS — FASE 2 (endereços completos)
// Rota pública /cotacao-express/detalhes/:id
//
// Chamada somente DEPOIS da aprovação do valor no WhatsApp:
// o cliente já sabe o preço, então aqui pedimos os dados que
// faltam (número, complemento, contato, instruções) — em lote,
// uma tela por parada de referência, com 1 clique.
// Ao salvar → status 'Pronto para OS' → alerta na Torre de
// Controle e orçamento aberto com os dados já preenchidos.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, Loader2, MapPin } from "lucide-react";
import {
  buscarCotacao,
  salvarDetalhesFase2,
  type CotacaoPublica,
  type DetalheParadaCotacao,
} from "@/services/cotacoes/cotacaoPublicaService";

const vazioDetalhe = (sequencia: number): DetalheParadaCotacao => ({
  sequencia,
  numero: "",
  complemento: "",
  contato: "",
  observacoes: "",
});

// Mensagem oficial da conclusão (texto exato definido pela operação).
const MENSAGEM_CONCLUSAO =
  "Perfeito! Tudo pronto para a emissão da sua Ordem de Serviço. Recebemos os endereços completos da rota. Nossa equipe já está montando a OS e você recebe a confirmação pelo WhatsApp.";

export default function CotacaoExpressDetalhes() {
  const { id } = useParams<{ id: string }>();

  const [carregando, setCarregando] = useState(true);
  const [cotacao, setCotacao] = useState<CotacaoPublica | null>(null);
  const [detalhes, setDetalhes] = useState<DetalheParadaCotacao[]>([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) {
      setErro("Link inválido. Confira a mensagem recebida.");
      setCarregando(false);
      return;
    }
    const res = await buscarCotacao(id);
    if (!res.ok || !res.dado) {
      setErro(res.erro || "Cotação não encontrada.");
      setCarregando(false);
      return;
    }
    const c = res.dado;
    setCotacao(c);
    // Já finalizada → mostra o sucesso direto (idempotente)
    if (c.status === "Pronto para OS") {
      setDetalhes(c.detalhes);
      setConcluido(true);
      setCarregando(false);
      return;
    }
    setDetalhes(
      c.paradas.map((parada) => {
        const existente = c.detalhes.find((d) => d.sequencia === parada.sequencia);
        return existente || vazioDetalhe(parada.sequencia);
      }),
    );
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const atualizarDetalhe = (sequencia: number, campo: keyof DetalheParadaCotacao, valor: string) =>
    setDetalhes((prev) =>
      prev.map((d) => (d.sequencia === sequencia ? { ...d, [campo]: valor } : d)),
    );

  const validacao = useMemo(() => {
    for (const detalhe of detalhes) {
      if (!detalhe.numero.trim()) return "Preencha o número de todas as paradas.";
      if (!detalhe.contato.trim())
        return "Informe o nome de quem recebe em cada parada.";
    }
    return "";
  }, [detalhes]);

  const enviar = async () => {
    if (enviando || !id) return;
    if (validacao) {
      setErro(validacao);
      return;
    }
    setEnviando(true);
    try {
      const res = await salvarDetalhesFase2(id, detalhes);
      if (!res.ok) {
        setErro(res.erro || "Não foi possível salvar agora. Tente novamente.");
        return;
      }
      setCotacao(res.dado || null);
      setErro("");
      setConcluido(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setEnviando(false);
    }
  };

  const primeiroNome = (cotacao?.nome_cliente || "").trim().split(" ")[0];

  // ------------------------------------------------------------
  // CARREGANDO
  // ------------------------------------------------------------
  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-slate-100 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-sm text-slate-500">Carregando sua cotação...</p>
      </div>
    );
  }

  // ------------------------------------------------------------
  // ERRO
  // ------------------------------------------------------------
  if (!cotacao) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-100 flex flex-col">
        <header className="px-4 py-4">
          <img
            src="/logos/logo-conexao-colorido.png"
            alt="Conexão Express"
            className="h-10 w-auto"
          />
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
            <h1 className="text-xl font-bold text-slate-900">Cotação não encontrada</h1>
            <p className="mt-2 text-sm text-slate-500">
              O link pode ter sido substituído por uma versão mais recente. Fale conosco no
              WhatsApp para reenviarmos.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------
  // SUCESSO
  // ------------------------------------------------------------
  if (concluido) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden">
        {/* Fundo em tela cheia — Parceria Logística como marca d'água */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/Parceria logistica.png')" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/55 to-orange-50/70"
        />

        <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl animate-fade-in">
            <img
              src="/logos/logo-conexao-colorido.png"
              alt="Conexão Express"
              className="mx-auto mb-5 h-14 w-auto"
            />
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-[15px] leading-relaxed text-slate-700">{MENSAGEM_CONCLUSAO}</p>
          </div>
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------
  // FORMULÁRIO DA FASE 2
  // ------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-100 flex flex-col">
      <header className="px-4 py-4 flex items-center justify-between">
        <img
          src="/logos/logo-conexao-colorido.png"
          alt="Conexão Express"
          className="h-10 w-auto"
        />
        <span className="rounded-full bg-orange-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-700">
          Detalhes da rota
        </span>
      </header>

      <main className="flex-1 px-4 pb-40 pt-2">
        <div className="mx-auto w-full max-w-xl space-y-5 animate-fade-in">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-orange-600">
              Etapa final · Endereços completos
            </span>
            <h1 className="mt-1 text-2xl font-bold leading-snug text-slate-900">
              {primeiroNome ? `Último passo, ${primeiroNome}! ` : "Último passo! "}
              Precisamos dos números.
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Com esses dados fechamos a OS da sua rota e ela entra na fila.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <span className="font-bold text-slate-700">Rota aprovada:</span>{" "}
            {cotacao.paradas.map((p) => p.endereco).join(" → ")}
          </div>

          {detalhes.map((detalhe, idx) => {
            const parada = cotacao.paradas[idx];
            const tipo = parada?.tipo === "retirada" ? "Retirada" : `Entrega ${idx}`;
            return (
              <div
                key={`detalhe-${detalhe.sequencia}`}
                className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-orange-500" />
                  Parada {detalhe.sequencia} · {tipo} · {parada?.endereco}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`num-${detalhe.sequencia}`}>Número *</Label>
                    <Input
                      id={`num-${detalhe.sequencia}`}
                      className="h-12 rounded-xl text-base"
                      placeholder="Ex.: 1250"
                      value={detalhe.numero}
                      onChange={(e) =>
                        atualizarDetalhe(detalhe.sequencia, "numero", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`comp-${detalhe.sequencia}`}>Complemento</Label>
                    <Input
                      id={`comp-${detalhe.sequencia}`}
                      className="h-12 rounded-xl text-base"
                      placeholder="Ex.: sala 12, fundos"
                      value={detalhe.complemento}
                      onChange={(e) =>
                        atualizarDetalhe(detalhe.sequencia, "complemento", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`contato-${detalhe.sequencia}`}>
                    Nome de quem recebe / retira *
                  </Label>
                  <Input
                    id={`contato-${detalhe.sequencia}`}
                    autoComplete="name"
                    className="h-12 rounded-xl text-base"
                    placeholder="Ex.: João Souza"
                    value={detalhe.contato}
                    onChange={(e) =>
                      atualizarDetalhe(detalhe.sequencia, "contato", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`obs-${detalhe.sequencia}`}>
                    Observações ou instruções
                  </Label>
                  <Textarea
                    id={`obs-${detalhe.sequencia}`}
                    className="min-h-[72px] rounded-xl text-base"
                    placeholder="Ex.: contato na portaria, horário de recebimento..."
                    value={detalhe.observacoes}
                    onChange={(e) =>
                      atualizarDetalhe(detalhe.sequencia, "observacoes", e.target.value)
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-xl">
          <Button
            type="button"
            className="h-12 w-full rounded-xl bg-orange-500 text-base font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600"
            onClick={() => void enviar()}
            disabled={enviando}
          >
            {enviando ? (
              "Enviando..."
            ) : (
              <>
                Enviar dados da rota <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          {erro && (
            <p className="mt-2 text-center text-xs font-semibold text-red-500">{erro}</p>
          )}
        </div>
      </div>
    </div>
  );
}
