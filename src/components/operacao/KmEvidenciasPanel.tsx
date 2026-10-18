// ═══════════════════════════════════════════════════════════════════════════════
// A29-D — PAINEL DE KM NO TMS OFICIAL
// KmEvidenciasPanel.tsx — exibe (somente leitura) as evidências de KM registradas
// pelo App Motorista para uma OS: KM inicial + foto, KM final + foto, KM
// percorrido e horários/tempos disponíveis (timeline). Sem escrita/fabricação.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { Gauge, Camera, Clock, Timer, RefreshCw, ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  buscarKmEvidenciasDaOS,
  type AlocacaoKmEvidencias,
  type KmEvidenciasDaOS,
} from "@/services/operacao/kmEvidenciasService";

const fmtDt = (v?: string | null): string =>
  v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const fmtDia = (v?: string | null): string =>
  v ? new Date(v + "T12:00:00").toLocaleDateString("pt-BR") : "—";

const fmtNum = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `${v} km`;

function FotoKm({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div className="h-16 w-24 rounded-md border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-[9px] text-slate-400 gap-0.5">
        <ImageOff className="w-3.5 h-3.5" /> sem foto
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Abrir foto em nova aba">
      <img src={url} alt={alt} loading="lazy" className="h-16 w-24 object-cover rounded-md border border-slate-200 hover:opacity-80 transition-opacity" />
    </a>
  );
}

function TempoLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-600 tabular-nums text-right">{valor}</span>
    </div>
  );
}

function CardAlocacao({ alocacao }: { alocacao: AlocacaoKmEvidencias }) {
  const km = alocacao.km;
  const kmRodado = km?.km_rodado ??
    (km?.km_inicial !== null && km?.km_inicial !== undefined && km?.km_final !== null && km?.km_final !== undefined
      ? km.km_final! - km.km_inicial!
      : null);
  const statusLabel = (alocacao.status || "—").replace(/_/g, " ");

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Alocação {alocacao.alocacao_id.slice(0, 8)}…
        </p>
        <div className="flex items-center gap-1">
          {alocacao.placa && <span className="text-[10px] text-slate-400 font-mono">{alocacao.placa}</span>}
          <Badge variant="outline" className="text-[9px] capitalize">
            {statusLabel}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-slate-100 bg-white p-2">
          <p className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Camera className="w-3 h-3" /> KM Inicial
          </p>
          <p className="text-sm font-extrabold text-slate-700 tabular-nums mt-0.5">{fmtNum(km?.km_inicial)}</p>
          <div className="mt-1.5"><FotoKm url={km?.foto_km_inicial_url} alt="Foto KM inicial" /></div>
        </div>
        <div className="rounded-md border border-slate-100 bg-white p-2">
          <p className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Camera className="w-3 h-3" /> KM Final
          </p>
          <p className="text-sm font-extrabold text-slate-700 tabular-nums mt-0.5">{fmtNum(km?.km_final)}</p>
          <div className="mt-1.5"><FotoKm url={km?.foto_km_final_url} alt="Foto KM final" /></div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md bg-white border border-slate-100 px-2 py-1.5">
        <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
          <Gauge className="w-3 h-3" /> KM Percorrido
        </span>
        <span className="text-sm font-extrabold text-indigo-600 tabular-nums">{fmtNum(kmRodado)}</span>
      </div>

      {km?.km_adicional ? (
        <p className="text-[10px] text-slate-400">
          KM adicional: <strong>{km.km_adicional} km</strong>
          {km.valor_adicional_estimado ? ` · est. R$ ${km.valor_adicional_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}
        </p>
      ) : null}

      <div className="rounded-md border border-slate-100 bg-white p-2 space-y-1">
        <p className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Horários / Tempos
        </p>
        <TempoLinha label="Data da programação" valor={fmtDia(alocacao.tempos.data_escala)} />
        <TempoLinha label="Aceite" valor={fmtDt(alocacao.tempos.data_aceite)} />
        <TempoLinha label="Início real" valor={fmtDt(alocacao.tempos.horario_inicio_real)} />
        <TempoLinha label="Fim real" valor={fmtDt(alocacao.tempos.horario_fim_real)} />
        <TempoLinha label="Finalização" valor={fmtDt(alocacao.tempos.data_finalizacao)} />
        <div className="flex items-center justify-between gap-2 text-[11px] border-t border-slate-50 pt-1">
          <span className="text-slate-400 flex items-center gap-1">
            <Timer className="w-3 h-3" /> Tempo total
          </span>
          <span className="font-bold text-slate-600 tabular-nums">
            {alocacao.tempos.tempo_total_minutos != null ? `${alocacao.tempos.tempo_total_minutos} min` : "—"}
          </span>
        </div>
      </div>

      {alocacao.timeline.length > 0 && (
        <div className="rounded-md border border-slate-100 bg-white p-2">
          <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Timeline do App ({alocacao.timeline.length})</p>
          <div className="max-h-24 overflow-y-auto space-y-0.5 pr-1">
            {alocacao.timeline.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-slate-600 truncate capitalize">{t.title || t.type || "evento"}</span>
                <span className="text-slate-400 tabular-nums shrink-0">{fmtDt(t.event_time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KmEvidenciasPanel({
  osId,
  alocacaoId,
}: {
  osId: string | null;
  alocacaoId?: string | null;
}) {
  const [dados, setDados] = useState<KmEvidenciasDaOS | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = async () => {
    if (!osId) return;
    setCarregando(true);
    const res = await buscarKmEvidenciasDaOS(osId);
    setDados(res);
    setCarregando(false);
  };

  useEffect(() => {
    setDados(null);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osId]);

  const alocacoes = useMemo(() => {
    const lista = dados?.alocacoes ?? [];
    return alocacaoId ? lista.filter((a) => a.alocacao_id === alocacaoId) : lista;
  }, [dados, alocacaoId]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-[#F97316]" /> Painel de KM (App)
        </p>
        <button
          type="button"
          onClick={carregar}
          disabled={carregando || !osId}
          className="text-[9px] text-slate-400 hover:text-[#F97316] flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${carregando ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {carregando ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !dados ? (
        <p className="text-[10px] text-slate-400">
          Sem retorno — OS sem vínculo ou evidências indisponíveis. As fotos/quilometragens são enviadas pelo App Motorista (prova física no dispositivo).
        </p>
      ) : dados.total_alocacoes === 0 || alocacoes.length === 0 ? (
        <p className="text-[10px] text-slate-400">
          Nenhuma evidência de KM registrada para esta OS. As fotos e quilometragens serão exibidas assim que o App as enviar.
        </p>
      ) : (
        <div className="space-y-2">
          {alocacoes.map((a) => (
            <CardAlocacao key={a.alocacao_id} alocacao={a} />
          ))}
        </div>
      )}
    </div>
  );
}
