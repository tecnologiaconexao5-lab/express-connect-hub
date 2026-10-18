import { useState, useEffect, useCallback } from "react";
import {
  Package, MapPin, Truck, User, Calendar, Camera, FileText,
  Signature, CheckCircle2, AlertTriangle, XCircle, Eye, Loader2,
  Hash, FileCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import DossieEntregaSheet from "@/components/comprovantes/DossieEntregaSheet";
import { buscarEntregasDaOS, type EntregaOS } from "@/services/comprovantes/comprovantesService";

interface EntregasComprovantesProps {
  osId: string;
  numeroOs?: string | null;
}

const SITUACAO_BADGE: Record<string, string> = {
  entregue: "bg-emerald-50 text-emerald-700 border-emerald-200",
  entregue_ressalva: "bg-amber-50 text-amber-700 border-amber-200",
  nao_entregue: "bg-red-50 text-red-700 border-red-200",
  pendente: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_OPERACAO_LABEL: Record<string, string> = {
  planejada: "Planejada",
  aguardando_aceite: "Aguardando Aceite",
  aceita: "Aceita",
  recusada: "Recusada",
  em_rota: "Em Rota",
  concluida: "Concluída",
  cancelada: "Cancelada",
  ocorrencia: "Ocorrência",
};

/**
 * MISSÃO A23 — FASE C — Seção "Entregas e Comprovantes" dentro da OS/Romaneio.
 * Lista as alocações/entregas da OS com POD real (entregas_protocolo) e
 * reutiliza o DossieEntregaSheet (A23-A) para "Ver comprovante".
 * rota_paradas é complemento opcional — nunca quebra sem ela.
 */
export default function EntregasComprovantes({ osId, numeroOs }: EntregasComprovantesProps) {
  const [entregas, setEntregas] = useState<EntregaOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [dossiePodId, setDossiePodId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!osId) {
      setEntregas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await buscarEntregasDaOS(osId);
    setEntregas(res);
    setLoading(false);
  }, [osId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const temPod = entregas.some((e) => e.tem_pod);
  const totalCompleto = entregas.filter(
    (e) => e.tem_pod && e.tem_foto && e.tem_assinatura && e.recebedor
  ).length;

  const renderEvidencia = (ok: boolean, Icon: any, label: string) => {
    if (!ok) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold" title={label}>
        <Icon className="w-3 h-3" /> {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (entregas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-500">Nenhuma entrega vinculada a esta OS</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          As entregas aparecerão aqui quando houver alocações/programação vinculadas a este romaneio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo compacto */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
          <Package className="w-3 h-3 mr-1" /> {entregas.length} entrega(s)
        </Badge>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
          <CheckCircle2 className="w-3 h-3 mr-1" /> {temPod ? "Com POD" : "Sem POD"} · {totalCompleto} completa(s)
        </Badge>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
          <AlertTriangle className="w-3 h-3 mr-1" /> {entregas.filter((e) => !e.tem_pod).length} pendente(s)
        </Badge>
      </div>

      {/* Entregas */}
      {entregas.map((entrega, idx) => {
        const badgeCls = entrega.situacao_pod
          ? SITUACAO_BADGE[entrega.situacao_pod] || "bg-slate-100 text-slate-600 border-slate-200"
          : "bg-slate-100 text-slate-600 border-slate-200";
        return (
          <Card key={entrega.alocacao_id} className="border shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-3 border-b bg-slate-50/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#F97316]/10 text-[#F97316] flex items-center justify-center text-[11px] font-black">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Entrega {idx + 1}</span>
                  {entrega.sequencia != null && (
                    <Badge variant="outline" className="text-[9px] text-slate-500 bg-white">Parada #{entrega.sequencia}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {entrega.situacao_pod ? (
                    <Badge variant="outline" className={badgeCls}>
                      {entrega.situacao_pod === "entregue" ? <CheckCircle2 className="w-3 h-3 mr-1" />
                        : entrega.situacao_pod === "nao_entregue" ? <XCircle className="w-3 h-3 mr-1" />
                        : <AlertTriangle className="w-3 h-3 mr-1" />}
                      {entrega.situacao_label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Comprovante pendente
                    </Badge>
                  )}
                  {entrega.status_operacao && (
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                      {STATUS_OPERACAO_LABEL[entrega.status_operacao] || entrega.status_operacao}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2.5 p-4">
                {entrega.destinatario && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#F97316] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Destinatário</p>
                      <p className="text-xs font-bold text-slate-800 truncate">{entrega.destinatario}</p>
                      {entrega.endereco && <p className="text-[10px] text-slate-500 truncate">{entrega.endereco}</p>}
                    </div>
                  </div>
                )}
                {entrega.prestador_nome && (
                  <div className="flex items-start gap-2">
                    <Truck className="w-3.5 h-3.5 text-[#F97316] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Prestador</p>
                      <p className="text-xs font-bold text-slate-800 truncate">{entrega.prestador_nome}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{entrega.veiculo_placa || ""} {entrega.veiculo_tipo ? `· ${entrega.veiculo_tipo}` : ""}</p>
                    </div>
                  </div>
                )}
                {entrega.data_hora_entrega && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#F97316] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Data/Hora</p>
                      <p className="text-xs font-bold text-slate-800">
                        {new Date(entrega.data_hora_entrega).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(entrega.data_hora_entrega).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <User className="w-3.5 h-3.5 text-[#F97316] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Recebedor</p>
                    <p className="text-xs font-bold text-slate-800 truncate">{entrega.recebedor || "—"}</p>
                    {entrega.documento_recebedor && (
                      <p className="text-[10px] text-slate-500 truncate">{entrega.documento_recebedor}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Volumes — apenas quando existirem de verdade */}
              {(entrega.volume_previsto != null || entrega.volume_entregue != null) && (
                <div className="flex items-center gap-2 px-4 pb-2">
                  <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 text-[10px]">
                    <Package className="w-3 h-3 mr-1" />
                    Volumes: {entrega.volume_entregue ?? "—"} entregue(s)
                    {entrega.volume_previsto != null ? ` / ${entrega.volume_previsto} previsto(s)` : ""}
                  </Badge>
                </div>
              )}

              {entrega.observacao && (
                <div className="mx-4 mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Observação / Ressalva
                  </p>
                  <p className="text-xs text-amber-900">{entrega.observacao}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t bg-slate-50/40">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {entrega.tem_pod ? (
                    <>
                      {renderEvidencia(entrega.tem_foto, Camera, "Foto")}
                      {renderEvidencia(entrega.tem_canhoto, FileText, "Canhoto")}
                      {renderEvidencia(entrega.tem_assinatura, Signature, "Assinatura")}
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Comprovante pendente — evidência não enviada pelo App
                    </span>
                  )}
                </div>
                {entrega.tem_pod && entrega.pod_id && (
                  <Button
                    size="sm"
                    className="h-8 bg-[#F97316] hover:bg-[#EA580C] text-white text-xs"
                    onClick={() => setDossiePodId(entrega.pod_id!)}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> Ver comprovante
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <DossieEntregaSheet
        open={!!dossiePodId}
        onOpenChange={(o) => { if (!o) setDossiePodId(null); }}
        podId={dossiePodId || ""}
        numeroOs={numeroOs}
      />
    </div>
  );
}
