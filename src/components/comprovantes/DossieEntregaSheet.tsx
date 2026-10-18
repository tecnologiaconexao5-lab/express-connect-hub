import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileCheck, Hash, Building2, User, Truck, MapPin, Calendar, Clock,
  FileText, Signature, Camera, AlertTriangle, Package, Navigation,
  CheckCircle2, Download, Copy, Share2, Loader2, ExternalLink,
  Info, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { gerarPDFProfissional } from "@/utils/pdfGenerator";
import { buscarDossieComprovante, type DossieComprovante } from "@/services/comprovantes/comprovantesService";
import { Lightbox, type LightboxMedia } from "@/components/ui/lightbox";
import {
  eventTypeToLabel,
  eventTypeToCategory,
} from "@/components/torre-controle/eventAdapter";

interface DossieEntregaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podId: string;
  numeroOs?: string | null;
}

const fmtData = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtHora = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const fmtDataHora = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const SITUACAO_BADGE: Record<string, string> = {
  entregue: "bg-emerald-50 text-emerald-700 border-emerald-200",
  entregue_ressalva: "bg-amber-50 text-amber-700 border-amber-200",
  nao_entregue: "bg-red-50 text-red-700 border-red-200",
  pendente: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function DossieEntregaSheet({ open, onOpenChange, podId, numeroOs }: DossieEntregaSheetProps) {
  const { toast } = useToast();
  const [dossie, setDossie] = useState<DossieComprovante | null>(null);
  const [loading, setLoading] = useState(false);
  const [galeriaAmpliada, setGaleriaAmpliada] = useState<string | null>(null);

  useEffect(() => {
    if (open && podId) {
      setLoading(true);
      setGaleriaAmpliada(null);
      buscarDossieComprovante(podId)
        .then((d) => setDossie(d))
        .finally(() => setLoading(false));
    }
    if (!open) setDossie(null);
  }, [open, podId]);

  const medias: LightboxMedia[] = useMemo(() => {
    const pod = dossie?.pod;
    const aloc = dossie?.alocacao;
    const list: LightboxMedia[] = [];
    if (pod?.foto_entrega_url) list.push({ url: pod.foto_entrega_url, label: "Foto da Entrega" });
    if (pod?.foto_canhoto_url) list.push({ url: pod.foto_canhoto_url, label: "Canhoto Digital" });
    if (pod?.assinatura_url) list.push({ url: pod.assinatura_url, label: "Assinatura do Recebedor" });
    if (aloc?.fotos_entrega?.length) {
      aloc.fotos_entrega.forEach((url, i) => list.push({ url, label: `Evidência ${i + 1}` }));
    }
    if (aloc?.comprovante_url && !list.some((m) => m.url === aloc.comprovante_url)) {
      list.push({ url: aloc.comprovante_url, label: "Comprovante Adicional" });
    }
    return list;
  }, [dossie]);

  const timeline = useMemo(() => {
    if (!dossie) return [];
    return [...(dossie.timeline || [])].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );
  }, [dossie]);

  const handleDownload = useCallback((url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.click();
    toast({ title: "Download iniciado", description: filename });
  }, [toast]);

  const handleGerarPDF = useCallback(() => {
    if (!dossie) return;
    const linhas = [
      ["OS", dossie.ordemServico?.numero || numeroOs || "N/I"],
      ["Cliente", dossie.ordemServico?.cliente || dossie.pod?.titulo || "N/I"],
      ["Recebedor", dossie.pod?.nome_recebedor || "N/I"],
      ["Documento", dossie.pod?.documento_recebedor || "N/I"],
      ["Data/Hora", fmtDataHora(dossie.pod?.data_entrega)],
      ["Prestador", dossie.prestador?.nome_completo || dossie.alocacao?.prestador_nome || "N/I"],
      ["Veículo", dossie.prestador?.veiculo_placa || dossie.alocacao?.destino ? `${dossie.prestador?.veiculo_placa || ""}` : "N/I"],
      ["Situação", dossie.pod?.tipo || dossie.alocacao?.status || "N/I"],
      ["Observação", dossie.pod?.observacao || "—"],
    ];
    gerarPDFProfissional({
      titulo: `Comprovante - OS ${dossie.ordemServico?.numero || numeroOs || "Entrega"}`,
      subtitulo: `Recebedor: ${dossie.pod?.nome_recebedor || "N/I"}`,
      colunas: ["Campo", "Valor"],
      linhas,
    });
    toast({ title: "PDF gerado", description: "Dossiê do comprovante" });
  }, [dossie, numeroOs, toast]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full md:w-[46%] sm:max-w-none overflow-y-auto p-0" side="right">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
              <p className="text-sm text-[#64748B]">Carregando dossiê da entrega...</p>
            </div>
          ) : !dossie ? (
            <div className="p-12 text-center text-sm text-[#64748B]">
              Não foi possível carregar o comprovante.
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* HEADER */}
              <div className="flex-shrink-0 bg-gradient-to-r from-[#F97316] to-[#EA580C] px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <SheetHeader className="text-left space-y-0">
                        <SheetTitle className="text-white font-extrabold text-base leading-tight">
                          {dossie.ordemServico?.numero || numeroOs || "Comprovante de Entrega"}
                        </SheetTitle>
                        <SheetDescription className="text-white/70 text-xs">
                          Dossiê completo da entrega
                        </SheetDescription>
                      </SheetHeader>
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <Badge className={`rounded-full px-3 py-0.5 text-[10px] font-bold border ${SITUACAO_BADGE[dossie.pod?.tipo || ""] || "text-white bg-white/20 border-white/30"}`}>
                  {(dossie.pod?.tipo || "Pendente").toUpperCase()}
                </Badge>
              </div>

              {/* CONTEÚDO */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24">
                {/* IDENTIFICAÇÃO */}
                <section>
                  <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-[#F97316]" /> IDENTIFICAÇÃO
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "OS / Romaneio", value: dossie.ordemServico?.numero || numeroOs || "—", icon: Hash },
                      { label: "Cliente", value: dossie.ordemServico?.cliente || "—", icon: Building2 },
                      { label: "Prestador", value: dossie.prestador?.nome_completo || dossie.alocacao?.prestador_nome || "—", icon: User },
                      { label: "Veículo", value: dossie.prestador?.veiculo_placa || "—", icon: Truck },
                      { label: "Destinatário", value: dossie.alocacao?.destino || dossie.pod?.nome_recebedor || "—", icon: MapPin },
                      { label: "Endereço", value: dossie.alocacao?.destino || "—", icon: MapPin },
                    ].map((item, i) => (
                      <div key={i} className="p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] font-bold uppercase tracking-wider mb-0.5">
                          <item.icon className="w-3 h-3 text-[#F97316]" />{item.label}
                        </div>
                        <p className="text-xs font-bold text-[#111827] truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ENTREGA */}
                <section>
                  <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-[#F97316]" /> ENTREGA
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Situação", value: dossie.pod?.tipo || "—", icon: FileCheck },
                      { label: "Recebedor", value: dossie.pod?.nome_recebedor || "—", icon: User },
                      { label: "Documento", value: dossie.pod?.documento_recebedor || "—", icon: FileText },
                      { label: "Relação/Função", value: dossie.alocacao?.status ? dossie.alocacao.status : "—", icon: User },
                      { label: "Data", value: fmtData(dossie.pod?.data_entrega), icon: Calendar },
                      { label: "Hora", value: fmtHora(dossie.pod?.data_entrega), icon: Clock },
                    ].map((item, i) => (
                      <div key={i} className="p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] font-bold uppercase tracking-wider mb-0.5">
                          <item.icon className="w-3 h-3 text-[#F97316]" />{item.label}
                        </div>
                        <p className="text-xs font-bold text-[#111827] truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Volumes — apenas quando existirem de verdade */}
                  {dossie.volumes && (dossie.volumes.previsto != null || dossie.volumes.entregue != null) && (
                    <div className="mt-2 p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB] flex items-center justify-between">
                      <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Package className="w-3 h-3 text-[#F97316]" /> Volumes
                      </span>
                      <span className="text-xs font-bold text-[#111827]">
                        {dossie.volumes.entregue != null ? dossie.volumes.entregue : dossie.volumes.previsto} entregues
                        {dossie.volumes.previsto != null ? ` / ${dossie.volumes.previsto} previstos` : ""}
                      </span>
                    </div>
                  )}

                  {dossie.pod?.observacao && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Observação / Ressalva
                      </p>
                      <p className="text-sm text-amber-900">{dossie.pod.observacao}</p>
                    </div>
                  )}
                </section>

                {/* EVIDÊNCIAS */}
                <section>
                  <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-[#F97316]" /> EVIDÊNCIAS
                    <Badge className="ml-auto bg-[#F97316]/10 text-[#F97316] border-[#F97316]/30 rounded-full text-[9px] px-2">{medias.length} mídia(s)</Badge>
                  </h3>
                  {medias.length === 0 ? (
                    <div className="p-6 text-center bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB]">
                      <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-400">NENHUMA EVIDÊNCIA REGISTRADA</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">O motorista não registrou fotos/assinatura</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {medias.map((m, i) => (
                        <div
                          key={i}
                          className="relative group rounded-xl overflow-hidden border border-[#E5E7EB] bg-white aspect-square cursor-pointer"
                          onClick={() => setGaleriaAmpliada(m.url)}
                        >
                          <img src={m.url} alt={m.label} className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <FileCheck className="w-6 h-6 text-white opacity-0 group-hover:opacity-100" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                            <p className="text-[8px] text-white font-bold truncate">{m.label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ASSINATURA */}
                {dossie.pod?.assinatura_url && (
                  <section>
                    <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Signature className="w-3.5 h-3.5 text-[#F97316]" /> ASSINATURA DIGITAL
                    </h3>
                    <div className="bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] overflow-hidden">
                      <div className="p-3 bg-white">
                        <img
                          src={dossie.pod.assinatura_url}
                          alt="Assinatura"
                          className="w-full h-24 object-contain cursor-pointer"
                          loading="lazy"
                          onClick={() => setGaleriaAmpliada(dossie.pod!.assinatura_url!)}
                        />
                      </div>
                      <div className="p-3 space-y-1 bg-[#F8FAFC]">
                        <div className="flex items-center gap-2 text-xs text-[#64748B]">
                          <User className="w-3 h-3" /><span className="font-bold text-[#111827]">{dossie.pod.nome_recebedor || "Não informado"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#64748B]">
                          <Calendar className="w-3 h-3" />{fmtDataHora(dossie.pod.data_entrega)}
                        </div>
                        <Button size="sm" variant="outline" className="w-full mt-2 rounded-full border-[#E5E7EB] text-xs" onClick={() => handleDownload(dossie.pod!.assinatura_url!, "assinatura.jpg")}>
                          <Download className="w-3 h-3 mr-1" /> Baixar assinatura
                        </Button>
                      </div>
                    </div>
                  </section>
                )}

                {/* LOCALIZAÇÃO */}
                {dossie.gps.latitude && dossie.gps.longitude ? (
                  <section>
                    <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#F97316]" /> LOCALIZAÇÃO DA ENTREGA
                    </h3>
                    <div className="bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] p-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-[#64748B]">
                        <MapPin className="w-3 h-3 text-[#F97316]" />
                        <span className="font-medium font-mono">{dossie.gps.latitude.toFixed(6)}, {dossie.gps.longitude.toFixed(6)}</span>
                      </div>
                      {dossie.gps.gps_accuracy != null && (
                        <div className="flex items-center gap-2 text-xs text-[#64748B]">
                          <Navigation className="w-3 h-3 text-emerald-500" />
                          <span>Precisão: {dossie.gps.gps_accuracy}m</span>
                        </div>
                      )}
                      <a
                        href={`https://www.google.com/maps?q=${dossie.gps.latitude},${dossie.gps.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#F97316] font-bold hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Abrir no Google Maps
                      </a>
                    </div>
                  </section>
                ) : (
                  <section>
                    <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#F97316]" /> LOCALIZAÇÃO DA ENTREGA
                    </h3>
                    <div className="bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] p-4 text-center">
                      <p className="text-xs text-slate-400">Coordenadas GPS não registradas para esta entrega.</p>
                    </div>
                  </section>
                )}

                {/* TIMELINE — Eventos Oficiais */}
                <section>
                  <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#F97316]" /> TIMELINE DA OPERAÇÃO
                    <Badge className="ml-auto bg-[#F8FAFC] text-[#64748B] border-[#E5E7EB] rounded-full text-[9px] px-2">{timeline.length} eventos</Badge>
                  </h3>
                  {timeline.length === 0 ? (
                    <div className="p-6 text-center bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB]">
                      <p className="text-xs text-slate-400">Nenhum evento oficial registrado.</p>
                    </div>
                  ) : (
                    <div className="relative pl-8 space-y-0">
                      {timeline.map((event, i) => {
                        const cat = eventTypeToCategory(event.eventType);
                        const color =
                          cat === "finalizacao" || cat === "aceite"
                            ? "bg-emerald-50 border-emerald-400 text-emerald-600"
                            : cat === "ocorrencia" || cat === "insucesso"
                              ? "bg-amber-50 border-amber-400 text-amber-600"
                              : "bg-slate-50 border-slate-300 text-slate-400";
                        return (
                          <div key={event.id || i} className="relative pb-5 last:pb-0">
                            <div className={`absolute left-[-24px] top-0 w-5 h-5 rounded-full flex items-center justify-center border-2 ${color}`}>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            </div>
                            {i < timeline.length - 1 && <div className="absolute left-[-16px] top-5 w-0.5 h-full bg-slate-200" />}
                            <div>
                              <p className="text-sm font-bold text-[#111827]">
                                {event.title || eventTypeToLabel(event.eventType)}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-[#64748B] font-medium">
                                  {fmtDataHora(event.occurredAt)}
                                </span>
                                <span className="text-[8px] font-bold px-1.5 py-0 rounded-full uppercase tracking-wider bg-slate-100 text-slate-400">
                                  {event.source}
                                </span>
                              </div>
                              {event.description && event.description !== event.title && (
                                <p className="text-[11px] text-[#94A3B8] mt-0.5">{event.description}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* OCORRÊNCIAS */}
                {dossie.ocorrencias.length > 0 && (
                  <section>
                    <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#F97316]" /> OCORRÊNCIAS RELACIONADAS
                    </h3>
                    <div className="space-y-2">
                      {dossie.ocorrencias.map((oc) => (
                        <div key={oc.id} className="bg-[#F8FAFC] rounded-xl border border-[#E5E7EB] p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#111827] uppercase">{oc.tipo}</span>
                            <Badge className="text-[9px] bg-slate-100 text-slate-500 border-slate-200 rounded-full">{oc.status}</Badge>
                          </div>
                          {oc.descricao && <p className="text-xs text-[#64748B] mt-1">{oc.descricao}</p>}
                          <p className="text-[10px] text-[#94A3B8] mt-1">{fmtDataHora(oc.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* BOTTOM BAR */}
              <div className="flex-shrink-0 bg-white border-t border-[#E5E7EB] p-3 space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 rounded-full border-[#E5E7EB] text-[10px] font-bold h-8" onClick={handleGerarPDF}>
                    <FileText className="w-3 h-3 mr-1" /> PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-full border-[#E5E7EB] text-[10px] font-bold h-8"
                    onClick={() => {
                      if (dossie?.pod?.foto_entrega_url) {
                        navigator.clipboard.writeText(dossie.pod.foto_entrega_url);
                        toast({ title: "Link copiado", description: "Link do comprovante copiado" });
                      }
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-full border-[#E5E7EB] text-[10px] font-bold h-8"
                    onClick={() => {
                      if (dossie?.pod?.foto_entrega_url) {
                        navigator.clipboard.writeText(dossie.pod.foto_entrega_url);
                        toast({ title: "Compartilhar", description: "Link copiado para compartilhar" });
                      }
                    }}
                  >
                    <Share2 className="w-3 h-3 mr-1" /> Compartilhar
                  </Button>
                </div>
                <Button size="sm" variant="ghost" className="w-full text-xs text-[#64748B] h-7" onClick={() => onOpenChange(false)}>
                  Fechar painel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Lightbox compartilhado */}
      <Lightbox
        open={!!galeriaAmpliada}
        media={medias}
        currentUrl={galeriaAmpliada}
        onUrlChange={setGaleriaAmpliada}
        onDownload={handleDownload}
        getFilename={(url) => `comprovante_${new Date().toISOString().slice(0, 10)}.jpg`}
      />
    </>
  );
}
