import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronLeft, ChevronRight, CheckCircle2, Clock, Truck, MapPin, Camera, Signature,
  FileText, User, Calendar, Copy, Download, Image, Maximize2, Search,
  ExternalLink, Share2, Mail, Package, FileCheck, Navigation, Map, Shield,
  AlertTriangle, Info, ChevronDown, ChevronUp, ZoomIn, Star,
  Building2, Phone, Hash, FileDown, FolderOpen, CheckCheck, Percent,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { gerarPDFProfissional } from "@/utils/pdfGenerator";
import { buscarDetalhesEntregaCompleto, type ComprovanteResumo, type DetalhesEntregaCompleto } from "@/services/portalCliente/portalClienteService";
import { Lightbox } from "@/components/ui/lightbox";

interface PortalDrawerPODProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comprovante: ComprovanteResumo | null;
  allComprovantes: ComprovanteResumo[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onRefresh?: () => void;
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
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const statusAlocacaoMap: Record<string, { label: string; color: string }> = {
  planejada: { label: "Planejada", color: "text-blue-600 bg-blue-50 border-blue-200" },
  aguardando_aceite: { label: "Aguardando Aceite", color: "text-amber-600 bg-amber-50 border-amber-200" },
  aceita: { label: "Aceita", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  recusada: { label: "Recusada", color: "text-red-600 bg-red-50 border-red-200" },
  em_rota: { label: "Em Rota", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  concluida: { label: "Concluída", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  cancelada: { label: "Cancelada", color: "text-slate-600 bg-slate-50 border-slate-200" },
  ocorrencia: { label: "Ocorrência", color: "text-red-600 bg-red-50 border-red-200" },
};

export default function PortalDrawerPOD({ open, onOpenChange, comprovante, allComprovantes, currentIndex, onNavigate, onRefresh }: PortalDrawerPODProps) {
  const { toast } = useToast();
  const [detalhes, setDetalhes] = useState<DetalhesEntregaCompleto | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [galeriaAmpliada, setGaleriaAmpliada] = useState<string | null>(null);
  const [galeriaCategoria, setGaleriaCategoria] = useState<string>("todas");
  const [searchOS, setSearchOS] = useState("");
  const [searchNF, setSearchNF] = useState("");
  const [searchRecebedor, setSearchRecebedor] = useState("");
  const [mostrarComparacao, setMostrarComparacao] = useState(false);

  useEffect(() => {
    if (open && comprovante?.id) {
      setLoadingDetalhes(true);
      setGaleriaAmpliada(null);
      setMostrarComparacao(false);
      buscarDetalhesEntregaCompleto(comprovante.id).then(d => {
        setDetalhes(d);
        setLoadingDetalhes(false);
      });
    }
  }, [open, comprovante?.id]);

  const evidenceCategories = useMemo(() => {
    const pod = detalhes?.pod;
    const aloc = detalhes?.alocacao;
    return [
      {
        key: "local", label: "Local", icon: MapPin,
        items: pod?.foto_entrega_url ? [{ url: pod.foto_entrega_url, label: "Foto do Local" }] : [],
      },
      {
        key: "mercadoria", label: "Mercadoria", icon: Package,
        items: pod?.foto_entrega_url ? [{ url: pod.foto_entrega_url, label: "Foto da Mercadoria" }] : [],
      },
      {
        key: "veiculo", label: "Veículo", icon: Truck,
        items: aloc?.fotos_entrega?.map((url: string, i: number) => ({ url, label: `Veículo ${i + 1}` })) || [],
      },
      {
        key: "canhoto", label: "Canhoto", icon: FileText,
        items: pod?.foto_canhoto_url ? [{ url: pod.foto_canhoto_url, label: "Canhoto Digital" }] : [],
      },
      {
        key: "assinatura", label: "Assinatura", icon: Signature,
        items: pod?.assinatura_url ? [{ url: pod.assinatura_url, label: "Assinatura do Recebedor" }] : [],
      },
      {
        key: "extras", label: "Extras", icon: FileCheck,
        items: aloc?.comprovante_url ? [{ url: aloc.comprovante_url, label: "Comprovante Adicional" }] : [],
      },
    ];
  }, [detalhes]);

  const medias = useMemo(() => {
    return evidenceCategories.flatMap(cat =>
      cat.items.map(item => ({ categoria: cat.key, label: item.label, url: item.url, icon: cat.icon }))
    );
  }, [evidenceCategories]);

  const mediasFiltradas = useMemo(() => {
    if (galeriaCategoria === "todas") return medias;
    return medias.filter(m => m.categoria === galeriaCategoria);
  }, [medias, galeriaCategoria]);

  const timeline = useMemo(() => {
    const aloc = detalhes?.alocacao;
    const pod = detalhes?.pod;
    const timestamps: { ts: Date; icon: any; label: string; origem: string; type: "ok" | "pending" | "warning" }[] = [];

    const push = (ts: string | null | undefined, icon: any, label: string, origem: string = "App Motorista", type: "ok" | "pending" | "warning" = "ok") => {
      if (!ts) return;
      const d = new Date(ts);
      if (isNaN(d.getTime())) return;
      timestamps.push({ ts: d, icon, label, origem, type });
    };

    if (aloc?.data_aceite) push(aloc.data_aceite, CheckCircle2, "Motorista aceitou a corrida");
    if (aloc?.horario_inicio_real) push(aloc.horario_inicio_real, MapPin, "Chegada na coleta");
    if (aloc?.horario_fim_real) push(aloc.horario_fim_real, Truck, "Saída da coleta");
    if (aloc?.status === "em_rota" || aloc?.status === "concluida") {
      const ts = aloc.horario_fim_real || pod?.data_entrega || new Date().toISOString();
      push(ts, Navigation, "Em trânsito", "Sistema");
    }
    if (pod?.data_entrega) push(pod.data_entrega, MapPin, "Chegada ao destino");
    if (pod?.assinatura_url && pod?.data_entrega) push(pod.data_entrega, Signature, "Recebedor assinou digitalmente");
    if (pod?.data_entrega) push(pod.data_entrega, FileCheck, "POD enviado", "Sistema");
    if (pod?.observacao) push(pod.data_entrega || new Date().toISOString(), AlertTriangle, `Ocorrência: ${pod.observacao}`, "App Motorista", "warning");
    if (aloc?.data_finalizacao) push(aloc.data_finalizacao, CheckCircle2, "Entrega concluída");

    timestamps.sort((a, b) => a.ts.getTime() - b.ts.getTime());

    return timestamps.map((e, i) => {
      const diffMs = i > 0 ? e.ts.getTime() - timestamps[i - 1].ts.getTime() : 0;
      const diffMin = Math.round(diffMs / 60000);
      return {
        ...e,
        data: e.ts.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
        hora: e.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        duracao: diffMs > 0 && diffMin > 0 ? `${diffMin} min` : null,
      };
    });
  }, [detalhes]);

  const complianceScore = useMemo(() => {
    const checks = {
      foto: !!(detalhes?.pod?.foto_entrega_url),
      assinatura: !!(detalhes?.pod?.assinatura_url),
      gps: !!(detalhes?.gps?.latitude && detalhes?.gps?.longitude),
      recebedor: !!(detalhes?.pod?.nome_recebedor),
      horario: !!(detalhes?.pod?.data_entrega),
      documento: !!(detalhes?.pod?.documento_recebedor),
      canhoto: !!(detalhes?.pod?.foto_canhoto_url),
      motorista: !!(detalhes?.prestador?.nome_completo),
      veiculo: !!(detalhes?.prestador?.veiculo_placa),
      nf: !!(detalhes?.ordemServico?.ref_cliente),
      pedido: !!(detalhes?.ordemServico?.numero),
    };
    const total = Object.keys(checks).length;
    const ok = Object.values(checks).filter(Boolean).length;
    return { score: Math.round((ok / total) * 100), checks, ok, total };
  }, [detalhes]);

  const resumoIA = useMemo(() => {
    if (!detalhes) return "";
    const aloc = detalhes.alocacao;
    const pod = detalhes.pod;
    const prest = detalhes.prestador;
    const parts: string[] = [];

    const hora = (ts: string | null | undefined) => {
      if (!ts) return null;
      try { return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return null; }
    };
    const data = (ts: string | null | undefined) => {
      if (!ts) return null;
      try { return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return null; }
    };

    if (pod?.data_entrega) {
      parts.push(`A entrega foi realizada em ${data(pod.data_entrega)} às ${hora(pod.data_entrega)}.`);
    } else {
      parts.push("A entrega ainda não foi concluída.");
    }

    if (prest?.nome_completo) {
      parts.push(`O motorista ${prest.nome_completo} foi o responsável pela operação.`);
    }

    if (aloc?.horario_inicio_real && aloc?.horario_fim_real) {
      const inicio = new Date(aloc.horario_inicio_real).getTime();
      const fim = new Date(aloc.horario_fim_real).getTime();
      const min = Math.round((fim - inicio) / 60000);
      if (min > 0) {
        parts.push(`Chegou ao local às ${hora(aloc.horario_inicio_real)} e permaneceu ${min} minutos no local.`);
      }
    }

    if (pod?.nome_recebedor && pod?.assinatura_url) {
      parts.push(`O recebedor ${pod.nome_recebedor} assinou digitalmente confirmando o recebimento.`);
    } else if (pod?.nome_recebedor) {
      parts.push(`O recebedor identificado foi ${pod.nome_recebedor}, mas a assinatura não foi registrada.`);
    }

    if (pod?.foto_entrega_url && pod?.assinatura_url && pod?.foto_canhoto_url) {
      parts.push("Todas as evidências obrigatórias foram enviadas (foto, assinatura e canhoto).");
    } else {
      const faltando: string[] = [];
      if (!pod?.foto_entrega_url && !pod?.foto_canhoto_url) faltando.push("foto da entrega");
      if (!pod?.assinatura_url) faltando.push("assinatura do recebedor");
      if (!pod?.foto_canhoto_url) faltando.push("foto do canhoto");
      if (faltando.length > 0) {
        parts.push(`Evidência(s) não enviada(s): ${faltando.join(", ")}.`);
      }
    }

    if (pod?.observacao) {
      parts.push(`Ocorrência registrada: ${pod.observacao}.`);
    } else {
      parts.push("Não houve ocorrência operacional.");
    }

    if (complianceScore.score >= 80) {
      parts.push("O SLA foi cumprido dentro do esperado.");
    } else {
      parts.push(`O SLA ficou em ${complianceScore.score}% — abaixo do ideal.`);
    }

    return parts.join(" ");
  }, [detalhes, complianceScore]);

  const handleDownload = useCallback((url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.click();
    toast({ title: "Download iniciado", description: filename });
  }, [toast]);

  const handleDownloadZip = useCallback(() => {
    medias.forEach((m, i) => {
      setTimeout(() => handleDownload(m.url, `comprovante_${m.categoria}_${i}.jpg`), i * 200);
    });
    toast({ title: "Download em massa", description: `${medias.length} arquivo(s)` });
  }, [medias, handleDownload, toast]);

  const handleGerarPDF = useCallback(() => {
    if (!detalhes) return;
    const linhas = [
      ["OS", detalhes.ordemServico?.numero || "N/I"],
      ["Cliente", detalhes.ordemServico?.cliente || "N/I"],
      ["NF", detalhes.ordemServico?.ref_cliente || "N/I"],
      ["Recebedor", detalhes.pod.nome_recebedor || "N/I"],
      ["Documento", detalhes.pod.documento_recebedor || "N/I"],
      ["Data/Hora", fmtDataHora(detalhes.pod.data_entrega)],
      ["Prestador", detalhes.prestador?.nome_completo || "N/I"],
      ["Motorista", detalhes.prestador?.nome_completo || "N/I"],
      ["Veículo", detalhes.prestador?.veiculo_placa || "N/I"],
      ["Placa", detalhes.prestador?.veiculo_placa || "N/I"],
      ["Conformidade", `${complianceScore.score}%`],
      ["Observação", detalhes.pod.observacao || "—"],
    ];
    gerarPDFProfissional({
      titulo: `POD - ${detalhes.ordemServico?.numero || "Entrega"}`,
      subtitulo: `Recebedor: ${detalhes.pod.nome_recebedor || "N/I"}`,
      colunas: ["Campo", "Valor"],
      linhas,
    });
    toast({ title: "PDF gerado", description: "Relatório completo do POD" });
  }, [detalhes, complianceScore, toast]);

  const handleCopiarLink = useCallback(() => {
    if (detalhes?.pod?.foto_entrega_url) {
      navigator.clipboard.writeText(detalhes.pod.foto_entrega_url);
      toast({ title: "Link copiado", description: "Link do comprovante copiado" });
    }
  }, [detalhes, toast]);

  const handleCompartilhar = useCallback(() => {
    if (navigator.share && detalhes?.pod?.foto_entrega_url) {
      navigator.share({ title: `POD ${detalhes.ordemServico?.numero || ""}`, url: detalhes.pod.foto_entrega_url });
    } else {
      handleCopiarLink();
    }
  }, [detalhes, handleCopiarLink]);

  const handleEnviarEmail = useCallback(() => {
    const subject = `POD - ${detalhes?.ordemServico?.numero || "Entrega"}`;
    const body = `POD da entrega ${detalhes?.ordemServico?.numero || ""}\n\nOS: ${detalhes?.ordemServico?.numero || "N/I"}\nRecebedor: ${detalhes?.pod.nome_recebedor || "N/I"}\nData: ${fmtDataHora(detalhes?.pod.data_entrega)}\nConformidade: ${complianceScore.score}%`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    toast({ title: "Email aberto", description: "Cliente de email padrão" });
  }, [detalhes, complianceScore]);

  const buscarPorParametro = useCallback(() => {
    if (!searchOS && !searchNF && !searchRecebedor) return;
    const found = allComprovantes.findIndex(c => {
      const matchOS = !searchOS || c.titulo?.toLowerCase().includes(searchOS.toLowerCase());
      const matchNF = true;
      const matchRec = !searchRecebedor || c.nome_recebedor?.toLowerCase().includes(searchRecebedor.toLowerCase());
      return matchOS && matchNF && matchRec;
    });
    if (found >= 0) {
      onNavigate(found);
      setSearchOS(""); setSearchNF(""); setSearchRecebedor("");
    } else {
      toast({ title: "Nenhum resultado", description: "Tente outros termos de busca" });
    }
  }, [searchOS, searchNF, searchRecebedor, allComprovantes, onNavigate, toast]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && comprovante && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => onOpenChange(false)}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full md:w-[42%] bg-white shadow-2xl z-50 flex flex-col border-l border-[#E5E7EB]"
          >
            {/* HEADER */}
            <div className="flex-shrink-0 bg-gradient-to-r from-[#F97316] to-[#EA580C] px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-extrabold text-base leading-tight">{comprovante.titulo || "Comprovante"}</h2>
                    <p className="text-white/70 text-xs">{comprovante.tipo} • {fmtData(comprovante.data_entrega)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge className="bg-white/20 text-white border-white/30 rounded-full text-xs font-bold px-3">{currentIndex + 1}/{allComprovantes.length}</Badge>
                  <button onClick={() => onOpenChange(false)} className="ml-2 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-bold hover:bg-white/25 disabled:opacity-30 transition-all flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </button>
                  <button
                    onClick={() => onNavigate(Math.min(allComprovantes.length - 1, currentIndex + 1))}
                    disabled={currentIndex === allComprovantes.length - 1}
                    className="px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-bold hover:bg-white/25 disabled:opacity-30 transition-all flex items-center gap-1"
                  >
                    Próximo <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <Badge className={`rounded-full px-3 py-0.5 text-[10px] font-bold border ${statusAlocacaoMap[detalhes?.alocacao?.status || ""]?.color || "text-white bg-white/20 border-white/30"}`}>
                  {statusAlocacaoMap[detalhes?.alocacao?.status || ""]?.label || detalhes?.alocacao?.status || "Carregando..."}
                </Badge>
              </div>
            </div>

            {/* CONTEÚDO */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loadingDetalhes ? (
                <div className="p-12 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[#64748B]">Carregando dados da entrega...</p>
                </div>
              ) : (
                <div className="p-5 space-y-6 pb-24">

                  {/* 2. CABEÇALHO EXECUTIVO */}
                  <section>
                    <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-[#F97316]" /> DADOS DA ENTREGA
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "OS", value: detalhes?.ordemServico?.numero || "—", icon: Hash },
                        { label: "Pedido", value: detalhes?.ordemServico?.numero || "—", icon: Package },
                        { label: "NF", value: detalhes?.ordemServico?.ref_cliente || "—", icon: FileText },
                        { label: "Tipo", value: comprovante.tipo || "—", icon: Truck },
                        { label: "Data", value: fmtData(comprovante.data_entrega), icon: Calendar },
                        { label: "Hora", value: fmtHora(comprovante.data_entrega), icon: Clock },
                        { label: "Cliente", value: detalhes?.ordemServico?.cliente || "—", icon: Building2 },
                        { label: "Prestador", value: detalhes?.prestador?.nome_completo || detalhes?.alocacao?.prestador_nome || "—", icon: User },
                        { label: "Motorista", value: detalhes?.prestador?.nome_completo || "—", icon: User },
                        { label: "Veículo", value: detalhes?.prestador?.veiculo_tipo || "—", icon: Truck },
                        { label: "Placa", value: detalhes?.prestador?.veiculo_placa || "—", icon: Truck },
                        { label: "Recebedor", value: comprovante.nome_recebedor || "—", icon: User },
                        { label: "Documento", value: comprovante.documento_recebedor || "—", icon: FileText },
                        { label: "Telefone", value: detalhes?.prestador?.telefone || "—", icon: Phone },
                        { label: "Cidade", value: detalhes?.alocacao?.destino || "—", icon: MapPin },
                        { label: "UF", value: "", icon: MapPin },
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

                  {/* 3. TIMELINE ENTERPRISE */}
                  <section>
                    <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#F97316]" /> TIMELINE DA OPERAÇÃO
                      <Badge className="ml-auto bg-[#F8FAFC] text-[#64748B] border-[#E5E7EB] rounded-full text-[9px] px-2">{timeline.length} eventos</Badge>
                    </h3>
                    <div className="relative pl-8 space-y-0">
                      {timeline.map((event, i) => (
                        <div key={i} className="relative pb-5 last:pb-0">
                          <div className={`absolute left-[-24px] top-0 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                            event.type === "ok" ? "bg-emerald-50 border-emerald-400 text-emerald-600" :
                            event.type === "warning" ? "bg-amber-50 border-amber-400 text-amber-600" :
                            "bg-slate-50 border-slate-300 text-slate-400"
                          }`}>
                            <event.icon className="w-2.5 h-2.5" />
                          </div>
                          {i < timeline.length - 1 && (
                            <div className={`absolute left-[-16px] top-5 w-0.5 h-full ${
                              event.type === "ok" ? "bg-emerald-200" : "bg-red-200"
                            }`} />
                          )}
                          <div>
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-bold ${event.type === "warning" ? "text-amber-700" : "text-[#111827]"}`}>
                                <event.icon className={`w-3.5 h-3.5 inline mr-1 ${event.type === "warning" ? "text-amber-500" : event.type === "ok" ? "text-emerald-500" : "text-slate-300"}`} />
                                {event.label}
                              </p>
                              <div className="flex items-center gap-2">
                                {event.duracao && (
                                  <span className="text-[9px] text-[#94A3B8] font-medium bg-[#F8FAFC] px-1.5 py-0.5 rounded-full border border-[#E5E7EB]">
                                    +{event.duracao}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[#64748B] font-medium">
                                {event.data} {event.hora && `às ${event.hora}`}
                              </span>
                              <span className={`text-[8px] font-bold px-1.5 py-0 rounded-full uppercase tracking-wider ${
                                event.origem === "App Motorista" ? "bg-blue-50 text-blue-500" : "bg-slate-100 text-slate-400"
                              }`}>
                                {event.origem}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* 4. CENTRO DE EVIDÊNCIAS */}
                  <section>
                    <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Image className="w-3.5 h-3.5 text-[#F97316]" /> CENTRO DE EVIDÊNCIAS
                      <Badge className="ml-auto bg-[#F97316]/10 text-[#F97316] border-[#F97316]/30 rounded-full text-[9px] px-2">{medias.length} mídia(s)</Badge>
                    </h3>

                    {/* Grid de categorias de evidências */}
                    <div className="space-y-3">
                      {evidenceCategories.map(cat => (
                        <div key={cat.key} className="bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-[#E5E7EB]/50">
                            <div className="flex items-center gap-2">
                              <cat.icon className="w-3.5 h-3.5 text-[#F97316]" />
                              <span className="text-xs font-bold text-[#111827]">{cat.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {cat.items.length > 0 ? (
                                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 rounded-full text-[9px] px-2">
                                  {cat.items.length} foto(s)
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-400 border-slate-200 rounded-full text-[9px] px-2">
                                  NÃO ENVIADA
                                </Badge>
                              )}
                              <button
                                onClick={() => setGaleriaCategoria(galeriaCategoria === cat.key ? "todas" : cat.key)}
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-all ${
                                  galeriaCategoria === cat.key
                                    ? "bg-[#F97316] text-white"
                                    : "text-[#64748B] hover:text-[#F97316]"
                                }`}
                              >
                                {galeriaCategoria === cat.key ? "Todas" : "Filtrar"}
                              </button>
                            </div>
                          </div>
                          {cat.items.length > 0 ? (
                            <div className="p-2">
                              <div className="grid grid-cols-3 gap-2">
                                {cat.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="relative group rounded-xl overflow-hidden border border-[#E5E7EB] bg-white aspect-square cursor-pointer"
                                    onClick={() => { setGaleriaAmpliada(item.url); setZoomLevel(1); setRotate(0); }}
                                  >
                                    <img src={item.url} alt={item.label} className="w-full h-full object-cover" loading="lazy" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                      <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                                      <p className="text-[8px] text-white font-bold truncate">{item.label}</p>
                                    </div>
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDownload(item.url, `${cat.key}_${idx}.jpg`); }}
                                        className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:bg-white transition-all"
                                      >
                                        <Download className="w-3 h-3 text-[#111827]" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 text-center">
                              <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 flex items-center justify-center mb-2">
                                <Image className="w-5 h-5 text-slate-300" />
                              </div>
                              <p className="text-xs font-bold text-slate-400">NÃO ENVIADA</p>
                              <p className="text-[9px] text-slate-300 mt-0.5">O motorista não registrou esta evidência</p>
                              {cat.key === "assinatura" && (
                                <p className="text-[9px] text-amber-500 font-bold mt-1 flex items-center gap-1 justify-center">
                                  <AlertTriangle className="w-3 h-3" /> Entrega sem assinatura do recebedor
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* 5. ASSINATURA DIGITAL */}
                  {detalhes?.pod?.assinatura_url && (
                    <section>
                      <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Signature className="w-3.5 h-3.5 text-[#F97316]" /> ASSINATURA DIGITAL
                      </h3>
                      <div className="bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] overflow-hidden">
                        <div className="p-3 bg-white">
                          <img src={detalhes.pod.assinatura_url} alt="Assinatura" className="w-full h-24 object-contain" loading="lazy" />
                        </div>
                        <div className="p-3 space-y-1 bg-[#F8FAFC]">
                          <div className="flex items-center gap-2 text-xs text-[#64748B]">
                            <User className="w-3 h-3" /><span className="font-bold text-[#111827]">{detalhes.pod.nome_recebedor || "Não informado"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#64748B]">
                            <Calendar className="w-3 h-3" />{fmtDataHora(detalhes.pod.data_entrega)}
                          </div>
                          {detalhes.pod.documento_recebedor && (
                            <div className="flex items-center gap-2 text-xs text-[#64748B]">
                              <FileText className="w-3 h-3" />{detalhes.pod.documento_recebedor}
                            </div>
                          )}
                          <Button size="sm" variant="outline" className="w-full mt-2 rounded-full border-[#E5E7EB] text-xs" onClick={() => handleDownload(detalhes.pod.assinatura_url!, "assinatura.jpg")}>
                            <Download className="w-3 h-3 mr-1" /> Baixar assinatura
                          </Button>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* 6. CANHOTO DIGITAL */}
                  {detalhes?.pod?.foto_canhoto_url && (
                    <section>
                      <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-[#F97316]" /> CANHOTO DIGITAL
                      </h3>
                      <div className="bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] overflow-hidden">
                        <div className="relative group cursor-pointer" onClick={() => { setGaleriaAmpliada(detalhes.pod.foto_canhoto_url!); setZoomLevel(1); setRotate(0); }}>
                          <img src={detalhes.pod.foto_canhoto_url} alt="Canhoto" className="w-full h-48 object-contain bg-white" loading="lazy" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                            <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100" />
                          </div>
                        </div>
                        <div className="p-3 flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 rounded-full border-[#E5E7EB] text-xs" onClick={() => handleDownload(detalhes.pod.foto_canhoto_url!, "canhoto.jpg")}>
                            <Download className="w-3 h-3 mr-1" /> Baixar
                          </Button>
                          {detalhes.pod.foto_entrega_url && (
                            <Button size="sm" variant="outline" className="flex-1 rounded-full border-[#E5E7EB] text-xs" onClick={() => setMostrarComparacao(!mostrarComparacao)}>
                              <Eye className="w-3 h-3 mr-1" /> {mostrarComparacao ? "Ocultar" : "Comparar"} foto
                            </Button>
                          )}
                        </div>
                        {mostrarComparacao && detalhes.pod.foto_entrega_url && (
                          <div className="p-3 border-t border-[#E5E7EB]">
                            <p className="text-[10px] font-bold text-[#64748B] mb-2">Comparação: Canhoto × Foto da Entrega</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <img src={detalhes.pod.foto_canhoto_url} alt="Canhoto" className="w-full h-24 object-contain rounded-lg bg-white" loading="lazy" />
                                <p className="text-[9px] text-center text-[#64748B] mt-1">Canhoto</p>
                              </div>
                              <div>
                                <img src={detalhes.pod.foto_entrega_url} alt="Foto" className="w-full h-24 object-cover rounded-lg" loading="lazy" />
                                <p className="text-[9px] text-center text-[#64748B] mt-1">Foto da Entrega</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* 7. LOCALIZAÇÃO */}
                  {detalhes?.gps?.latitude && detalhes?.gps?.longitude && (
                    <section>
                      <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#F97316]" /> LOCALIZAÇÃO DA ENTREGA
                      </h3>
                      <div className="bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] overflow-hidden">
                        <div className="h-32 bg-slate-200 relative">
                          <img
                            src={`https://maps.googleapis.com/maps/api/staticmap?center=${detalhes.gps.latitude},${detalhes.gps.longitude}&zoom=15&size=400x150&markers=color:orange%7C${detalhes.gps.latitude},${detalhes.gps.longitude}&key=AIzaSyBAAAA`}
                            alt="Mapa"
                            className="w-full h-full object-cover" loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                        <div className="p-3 space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-[#64748B]">
                            <Map className="w-3 h-3 text-[#F97316]" />
                            <span className="font-medium">{detalhes.gps.latitude.toFixed(6)}, {detalhes.gps.longitude.toFixed(6)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#64748B]">
                            <Navigation className="w-3 h-3 text-emerald-500" />
                            <span>Precisão: ~10m</span>
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${detalhes.gps.latitude},${detalhes.gps.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#F97316] font-bold hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Abrir no Google Maps
                          </a>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* 8. RESUMO EXECUTIVO IA */}
                  {resumoIA && (
                    <section>
                      <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Star className="w-3.5 h-3.5 text-[#F97316]" /> RESUMO EXECUTIVO
                        <Badge className="ml-auto bg-purple-50 text-purple-600 border-purple-200 rounded-full text-[8px] px-1.5 uppercase tracking-wider font-bold">IA</Badge>
                      </h3>
                      <div className="bg-gradient-to-br from-[#F8FAFC] to-white rounded-2xl border border-[#E5E7EB] p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Star className="w-4 h-4 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-xs text-[#334155] leading-relaxed font-medium">
                              {resumoIA}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className="bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20 rounded-full text-[8px] px-2">
                                Automático
                              </Badge>
                              <span className="text-[9px] text-[#94A3B8]">
                                Resumo gerado com base nos dados da entrega
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* 9. CHECKLIST DE EVIDÊNCIAS */}
                  <section>
                    <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <CheckCheck className="w-3.5 h-3.5 text-[#F97316]" /> CHECKLIST DE EVIDÊNCIAS
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "foto", label: "Foto da Entrega" },
                        { key: "assinatura", label: "Assinatura" },
                        { key: "gps", label: "Coordenadas GPS" },
                        { key: "recebedor", label: "Nome do Recebedor" },
                        { key: "horario", label: "Data/Hora" },
                        { key: "documento", label: "Documento" },
                        { key: "canhoto", label: "Canhoto" },
                        { key: "motorista", label: "Motorista" },
                        { key: "veiculo", label: "Veículo" },
                        { key: "nf", label: "Nota Fiscal" },
                        { key: "pedido", label: "Nº Pedido" },
                      ].map(({ key, label }) => {
                        const ok = complianceScore.checks[key as keyof typeof complianceScore.checks];
                        return (
                          <div key={key} className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold ${
                            ok
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-600 border border-amber-200"
                          }`}>
                            {ok
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            }
                            <div className="min-w-0">
                              <p className="truncate">{label}</p>
                              {!ok && <p className="text-[9px] text-amber-400 font-medium">NÃO ENVIADA</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* 10. ÍNDICE DE CONFORMIDADE ENTERPRISE */}
                  <section>
                    <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Percent className="w-3.5 h-3.5 text-[#F97316]" /> ÍNDICE DE QUALIDADE
                    </h3>
                    <div className="bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] p-5">
                      <div className="text-center mb-4">
                        <div className="flex items-center justify-center gap-1 mb-2">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`text-2xl ${s <= Math.round(complianceScore.score / 20) ? "text-amber-400" : "text-slate-200"}`}>★</span>
                          ))}
                        </div>
                        <div className="text-4xl font-black text-[#0F172A] tabular-nums">{complianceScore.score}/100</div>
                        <Badge className={`mt-2 text-xs px-3 py-1 rounded-full font-bold border-2 ${
                          complianceScore.score >= 80 ? "bg-emerald-50 text-emerald-600 border-emerald-300" :
                          complianceScore.score >= 50 ? "bg-amber-50 text-amber-600 border-amber-300" :
                          "bg-red-50 text-red-600 border-red-300"
                        }`}>
                          {complianceScore.score >= 80 ? "Excelente" : complianceScore.score >= 50 ? "Regular" : "Crítico"}
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
                          {complianceScore.score >= 80 ? "✓ Contribuíram para esta nota:" : "✗ Itens que reduziram a nota:"}
                        </p>
                        {[
                          { key: "foto", label: "Foto da entrega" },
                          { key: "assinatura", label: "Assinatura do recebedor" },
                          { key: "gps", label: "Coordenadas GPS válidas" },
                          { key: "recebedor", label: "Nome do recebedor" },
                          { key: "horario", label: "Data e horário" },
                          { key: "documento", label: "Documento do recebedor" },
                          { key: "canhoto", label: "Foto do canhoto" },
                          { key: "motorista", label: "Identificação do motorista" },
                          { key: "veiculo", label: "Veículo e placa" },
                          { key: "nf", label: "Nota fiscal" },
                          { key: "pedido", label: "Número do pedido" },
                        ].map(({ key, label }) => {
                          const ok = complianceScore.checks[key as keyof typeof complianceScore.checks];
                          return (
                            <div key={key} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                              ok ? "bg-emerald-50/50 text-emerald-700" : "bg-red-50/50 text-red-600"
                            }`}>
                              {ok ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              ) : (
                                <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                              )}
                              <span className="font-medium">{label}</span>
                              {!ok && <span className="ml-auto text-[9px] text-red-400 font-bold">NÃO CONFIRMADO</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  {/* 11. OBSERVAÇÃO */}
                  {detalhes?.pod?.observacao && (
                    <section>
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Observação
                        </p>
                        <p className="text-sm text-amber-900">{detalhes.pod.observacao}</p>
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>

            {/* BOTTOM BAR — Compartilhamento Premium */}
            <div className="flex-shrink-0 bg-white border-t border-[#E5E7EB] p-3 space-y-2">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 rounded-full border-[#E5E7EB] text-[10px] font-bold h-8" onClick={handleCopiarLink}>
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-full border-[#E5E7EB] text-[10px] font-bold h-8" onClick={handleCompartilhar}>
                  <Share2 className="w-3 h-3 mr-1" /> Compartilhar
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-full border-[#E5E7EB] text-[10px] font-bold h-8" onClick={handleEnviarEmail}>
                  <Mail className="w-3 h-3 mr-1" /> Email
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 rounded-full border-[#E5E7EB] text-[10px] font-bold h-8" onClick={handleGerarPDF}>
                  <FileText className="w-3 h-3 mr-1" /> PDF
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-full border-[#E5E7EB] text-[10px] font-bold h-8" onClick={handleDownloadZip}>
                  <FolderOpen className="w-3 h-3 mr-1" /> ZIP
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-full border-[#E5E7EB] text-[10px] font-bold h-8" onClick={() => medias.filter(m => m.categoria === "assinatura").forEach(m => handleDownload(m.url, "assinatura.jpg"))}>
                  <Signature className="w-3 h-3 mr-1" /> Assinatura
                </Button>
              </div>

              {/* Navegação Inteligente */}
              <div className="flex gap-2 pt-1">
                <div className="flex-1 relative">
                  <Input placeholder="Buscar OS..." className="h-7 text-xs rounded-full bg-[#F8FAFC] border-[#E5E7EB] pl-7" value={searchOS} onChange={e => setSearchOS(e.target.value)} onKeyDown={e => e.key === "Enter" && buscarPorParametro()} />
                  <Search className="w-3 h-3 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <Button size="sm" className="h-7 rounded-full bg-[#F97316] hover:bg-[#EA580C] text-white text-[10px] font-bold px-3" onClick={buscarPorParametro}>
                  Ir
                </Button>
              </div>

              <Button size="sm" variant="ghost" className="w-full text-xs text-[#64748B] h-7" onClick={() => onOpenChange(false)}>
                Fechar painel
              </Button>
            </div>
          </motion.div>

          {/* Lightbox compartilhado (extraído para src/components/ui/lightbox.tsx) */}
          <Lightbox
            open={!!galeriaAmpliada}
            media={medias.map(m => ({ url: m.url, label: m.label }))}
            currentUrl={galeriaAmpliada}
            onUrlChange={setGaleriaAmpliada}
            onDownload={handleDownload}
            getFilename={(url) => {
              const item = medias.find(m => m.url === url);
              return item ? `comprovante_${item.categoria}_${Date.now()}.jpg` : `imagem_${Date.now()}.jpg`;
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
}
