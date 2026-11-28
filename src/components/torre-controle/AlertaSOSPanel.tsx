import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  ShieldAlert,
  Siren,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  atualizarDistanciaProximaParada,
  atualizarStatusOcorrenciaSeguranca,
  beepAlertaSos,
  calcularDistanciaProximaParada,
  encerrarOcorrenciaSeguranca,
  listarOcorrenciasSeguranca,
  PARECERES_TORRE,
  parecerTorreLabel,
  SEVERIDADE_OCORRENCIA_SEGURANCA,
  SEVERIDADE_TONE,
  STATUS_OCORRENCIA_SEGURANCA,
  TIPO_OCORRENCIA_SEGURANCA,
  urlAssinadaFotoSeguranca,
  type DistanciaProximaParada,
  type OcorrenciaSegurancaApp,
  type ParecerTorre,
} from "@/services/operacao/segurancaAppService";
import { formatarDataHoraBR } from "@/lib/formatDates";

const TIPOS_COM_ALERTA_CRITICO = new Set(["sos_emergencia", "acidente", "roubo_furto", "pane_mecanica"]);

function soDigitos(valor?: string | null): string {
  return String(valor || "").replace(/\D/g, "");
}

export default function AlertaSOSPanel() {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaSegurancaApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selecionada, setSelecionada] = useState<OcorrenciaSegurancaApp | null>(null);
  const [fotos, setFotos] = useState<Record<string, string | null>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [distancia, setDistancia] = useState<DistanciaProximaParada | null>(null);
  const [distanciaLoading, setDistanciaLoading] = useState(false);
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [parecer, setParecer] = useState<ParecerTorre | "">("");
  const [observacaoEncerramento, setObservacaoEncerramento] = useState("");
  const [salvandoEncerramento, setSalvandoEncerramento] = useState(false);
  const idsConhecidos = useRef<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const dados = await listarOcorrenciasSeguranca({ status: "todos", limite: 120 });
      const abertas = dados.filter((o) => o.status !== "encerrada");
      setOcorrencias(abertas);
      for (const o of abertas) idsConhecidos.current.add(o.id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getUser().then(({ data }) => {
      if (ativo) setAuthUserId(data.user?.id || null);
    });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("torre-sos-seguranca-app")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ocorrencias_seguranca_app" },
        (payload) => {
          const novo = payload.new as OcorrenciaSegurancaApp | undefined;
          if (!novo) {
            void carregar();
            return;
          }
          if (novo.status === "encerrada") {
            setOcorrencias((prev) => prev.filter((o) => o.id !== novo.id));
            return;
          }
          const ehNovo = !idsConhecidos.current.has(novo.id);
          idsConhecidos.current.add(novo.id);
          setOcorrencias((prev) => {
            const semAtual = prev.filter((o) => o.id !== novo.id);
            return [novo, ...semAtual];
          });
          if (ehNovo && TIPOS_COM_ALERTA_CRITICO.has(novo.tipo) && novo.severidade === "critica") {
            beepAlertaSos();
            toast.error(
              `SOS: ${TIPO_OCORRENCIA_SEGURANCA[novo.tipo] || novo.tipo} acionado por prestador parceiro.`,
              { duration: 15000 },
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregar]);

  // Fallback de segurança: mantém a Torre atualizada mesmo se a tabela ainda
  // não estiver incluída na publicação supabase_realtime.
  useEffect(() => {
    const timer = setInterval(() => {
      void listarOcorrenciasSeguranca({ status: "todos", limite: 120 }).then((dados) => {
        setOcorrencias(dados.filter((o) => o.status !== "encerrada"));
      });
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  const criticas = useMemo(
    () => ocorrencias.filter((o) => o.severidade === "critica" || TIPOS_COM_ALERTA_CRITICO.has(o.tipo)),
    [ocorrencias],
  );

  async function abrirDetalhe(ocorrencia: OcorrenciaSegurancaApp) {
    setSelecionada(ocorrencia);
    setDialogOpen(true);
    setDistancia(null);
    setDistanciaLoading(true);

    const paths = (ocorrencia.fotos_paths || []).filter(Boolean);
    const [entradas] = await Promise.all([
      Promise.all(paths.map(async (p) => [p, await urlAssinadaFotoSeguranca(p)] as const)),
      calcularDistanciaProximaParada(ocorrencia)
        .then(async (d) => {
          setDistancia(d);
          setDistanciaLoading(false);
          if (d) await atualizarDistanciaProximaParada(ocorrencia.id, d.km);
        })
        .catch(() => setDistanciaLoading(false)),
    ]);
    setFotos(Object.fromEntries(entradas));
  }

  async function alterarStatus(ocorrencia: OcorrenciaSegurancaApp, status: "em_atendimento" | "encerrada") {
    setSalvando(ocorrencia.id);
    try {
      await atualizarStatusOcorrenciaSeguranca({ id: ocorrencia.id, status, usuarioId: authUserId });
      toast.success(status === "encerrada" ? "Atendimento encerrado." : "Atendimento assumido pela Torre de Controle.");
      setDialogOpen(false);
      setSelecionada(null);
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o atendimento.");
    } finally {
      setSalvando(null);
    }
  }

  async function handleEncerrar() {
    if (!selecionada) return;
    if (!parecer) {
      toast.error("Selecione o Parecer Operacional para encerrar o chamado.");
      return;
    }
    setSalvandoEncerramento(true);
    try {
      await encerrarOcorrenciaSeguranca({
        ocorrencia: selecionada,
        parecer,
        observacao: observacaoEncerramento,
        usuarioId: authUserId,
      });
      toast.success(
        parecer === "acionamento_indevido"
          ? "Chamado encerrado com alerta de confiabilidade registrado."
          : "Chamado encerrado com parecer registrado.",
      );
      setEncerrarOpen(false);
      setDialogOpen(false);
      setSelecionada(null);
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível encerrar o chamado.");
    } finally {
      setSalvandoEncerramento(false);
    }
  }

  if (loading && ocorrencias.length === 0) return null;
  if (ocorrencias.length === 0) return null;

  const maisRecente = ocorrencias[0];

  return (
    <>
      <Card className="border-2 border-red-300 bg-red-50/70 shadow-md">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 animate-pulse">
            <Siren className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-red-800">
                {ocorrencias.length} alerta(s) de segurança ativo(s)
              </p>
              {criticas.length > 0 && (
                <Badge className="bg-red-700 text-white border-red-800">{criticas.length} crítico(s)</Badge>
              )}
            </div>
            <p className="text-xs text-red-700 mt-0.5 truncate">
              Mais recente: {TIPO_OCORRENCIA_SEGURANCA[maisRecente.tipo] || maisRecente.tipo}
              {maisRecente.prestador_nome ? ` · ${maisRecente.prestador_nome}` : ""}
              {maisRecente.os_numero ? ` · Serviço ${maisRecente.os_numero}` : ""}
              {` · ${formatarDataHoraBR(maisRecente.created_at)}`}
            </p>
            <div className="mt-1 space-y-0.5">
              <p className="text-[11px] font-bold text-red-800">
                Bloqueado para Novas Oportunidades (Aguardando Liberação da Torre)
              </p>
              <p className="text-[11px] text-red-700">
                Repasse da OS Retido até Conferência de Carga (Retorno à Base ou Transbordo)
              </p>
            </div>
          </div>
          <Button className="bg-red-700 hover:bg-red-800 text-white shrink-0" onClick={() => { setSelecionada(null); setDialogOpen(true); }}>
            <ShieldAlert className="w-4 h-4 mr-2" /> Abrir central SOS
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelecionada(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Siren className="w-5 h-5" /> Central de segurança SOS
            </DialogTitle>
            <DialogDescription>Alertas em tempo real acionados pelos prestadores parceiros.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {ocorrencias.map((o) => (
                <button
                  key={o.id}
                  onClick={() => void abrirDetalhe(o)}
                  className={`w-full text-left rounded-lg border p-3 transition ${
                    selecionada?.id === o.id ? "border-red-400 bg-red-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-red-700">
                      {TIPO_OCORRENCIA_SEGURANCA[o.tipo] || o.tipo}
                    </span>
                    <Badge variant="outline" className={SEVERIDADE_TONE[o.severidade]}>{SEVERIDADE_OCORRENCIA_SEGURANCA[o.severidade]}</Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 truncate">{o.prestador_nome || "Prestador parceiro"}</p>
                  <p className="text-[10px] text-muted-foreground">{formatarDataHoraBR(o.created_at)} · {STATUS_OCORRENCIA_SEGURANCA[o.status]}</p>
                </button>
              ))}
            </div>

            <div>
              {!selecionada ? (
                <div className="h-full min-h-[220px] flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  Selecione um alerta para ver detalhes e assumir o atendimento.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={SEVERIDADE_TONE[selecionada.severidade]}>
                      {SEVERIDADE_OCORRENCIA_SEGURANCA[selecionada.severidade]}
                    </Badge>
                    <Badge variant="secondary">{STATUS_OCORRENCIA_SEGURANCA[selecionada.status]}</Badge>
                    <span className="text-xs text-muted-foreground">{formatarDataHoraBR(selecionada.created_at)}</span>
                  </div>

                  <h3 className="text-lg font-bold text-red-700">
                    {TIPO_OCORRENCIA_SEGURANCA[selecionada.tipo] || selecionada.tipo}
                  </h3>
                  {selecionada.descricao && <p className="text-sm text-slate-700">{selecionada.descricao}</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <Info label="Prestador parceiro" valor={selecionada.prestador_nome || "—"} />
                    <Info label="Serviço / OS" valor={selecionada.os_numero || "—"} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selecionada.latitude != null && selecionada.longitude != null && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://www.google.com/maps?q=${selecionada.latitude},${selecionada.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin className="w-4 h-4 mr-1.5" /> Ver localização
                        </a>
                      </Button>
                    )}
                    {(selecionada.prestador_whatsapp || selecionada.prestador_telefone) && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://wa.me/55${soDigitos(selecionada.prestador_whatsapp || selecionada.prestador_telefone)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Phone className="w-4 h-4 mr-1.5" /> Falar com o prestador
                        </a>
                      </Button>
                    )}
                  </div>

                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
                    {distanciaLoading ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando distância até a próxima parada...
                      </span>
                    ) : distancia ? (
                      <>
                        <p><strong>Próxima parada:</strong> {distancia.descricao}</p>
                        <p>
                          <strong>Distância do acionamento:</strong> {distancia.km.toFixed(2)} km
                          ({distancia.metros.toLocaleString("pt-BR")} m)
                        </p>
                      </>
                    ) : (
                      <span>Sem coordenadas suficientes para calcular a distância até a próxima parada.</span>
                    )}
                  </div>

                  {(selecionada.fotos_paths || []).length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {(selecionada.fotos_paths || []).map((p) => (
                        <a key={p} href={fotos[p] || "#"} target="_blank" rel="noreferrer" className="aspect-square rounded-lg border overflow-hidden bg-slate-50">
                          {fotos[p] ? (
                            <img src={fotos[p] as string} alt="Evidência SOS" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">Carregando</span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {selecionada.status === "aberta" && (
                      <Button
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => void alterarStatus(selecionada, "em_atendimento")}
                        disabled={salvando === selecionada.id}
                      >
                        {salvando === selecionada.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                        Assumir atendimento
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="text-emerald-700 border-emerald-300"
                      onClick={() => { setParecer(""); setObservacaoEncerramento(""); setEncerrarOpen(true); }}
                      disabled={salvando === selecionada.id || salvandoEncerramento}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Encerrar com parecer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={encerrarOpen} onOpenChange={setEncerrarOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" /> Encerrar chamado com parecer
            </DialogTitle>
            <DialogDescription>
              O Parecer Operacional é obrigatório e será gravado no histórico da ocorrência.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Parecer Operacional *</label>
              <Select value={parecer} onValueChange={(v) => setParecer(v as ParecerTorre)}>
                <SelectTrigger><SelectValue placeholder="Selecione o parecer" /></SelectTrigger>
                <SelectContent>
                  {PARECERES_TORRE.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {parecer && (
                <p className="text-xs text-muted-foreground mt-1">
                  {PARECERES_TORRE.find((p) => p.value === parecer)?.descricao}
                </p>
              )}
            </div>
            {parecer === "acionamento_indevido" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                Este parecer registra um alerta de confiabilidade no histórico do prestador parceiro.
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Observações do encerramento</label>
              <Textarea
                rows={4}
                value={observacaoEncerramento}
                onChange={(e) => setObservacaoEncerramento(e.target.value)}
                placeholder="Detalhe a análise da Torre de Controle..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncerrarOpen(false)} disabled={salvandoEncerramento}>Cancelar</Button>
            <Button onClick={() => void handleEncerrar()} disabled={!parecer || salvandoEncerramento}>
              {salvandoEncerramento && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}
