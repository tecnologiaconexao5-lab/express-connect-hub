import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Navigation,
  Loader2,
  MapPin,
  Gauge,
  Clock,
  Battery,
  ExternalLink,
  Satellite,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import MapboxMap, { type MapLocation } from "@/components/MapboxMap";
import { formatarDataHoraBR } from "@/lib/formatDates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  os: { id: string; numero?: string | null; cliente?: string | null } | null;
}

interface Telemetria {
  latitude: number;
  longitude: number;
  velocidade: number | null;
  precisao: number | null;
  bateria: number | null;
  status: string | null;
  statusOperacional: string | null;
  origem: string | null;
  atualizadoEm: string | null;
}

/** Rótulos operacionais enviados pelo App (metadata.status_operacional). */
const STATUS_OPERACIONAL_LABEL: Record<string, string> = {
  em_deslocamento: "Em deslocamento",
  em_coleta: "Em coleta",
  na_coleta: "Na coleta",
  em_entrega: "Em entrega",
  na_entrega: "Na entrega",
  parado: "Parado",
  ocorrencia: "Ocorrência",
  finalizado: "Finalizado",
  online: "Online",
};

/**
 * LOTE 2 — Rastreamento real da OS.
 * Lê a telemetria que o App envia para `portal_tracking_realtime`
 * (fonte atual: origem = app_motorista).
 */
export default function RastreamentoOSDialog({ open, onOpenChange, os }: Props) {
  const [posicao, setPosicao] = useState<Telemetria | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!open || !os?.id) return;
    let ativo = true;
    setCarregando(true);
    setErro("");

    const buscar = async () => {
      try {
        const { data: aloc } = await supabase
          .from("alocacoes_escala")
          .select("id")
          .eq("ordem_servico_id", os.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const alocacaoId = aloc?.id ? String(aloc.id) : os.id;

        const { data, error } = await supabase
          .from("portal_tracking_realtime")
          .select(
            "latitude, longitude, velocidade, precisao, bateria, status, origem, captured_at, updated_at, metadata",
          )
          .or(`os_id.eq.${os.id},alocacao_id.eq.${alocacaoId}`)
          .order("captured_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (!ativo) return;
        if (error) throw error;

        if (!data) {
          setPosicao(null);
          setErro("Aguardando telemetria do App do motorista...");
          return;
        }

        const metadata = (data.metadata || {}) as Record<string, unknown>;
        setPosicao({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          velocidade: data.velocidade != null ? Number(data.velocidade) : null,
          precisao: data.precisao != null ? Number(data.precisao) : null,
          bateria: data.bateria != null ? Number(data.bateria) : null,
          status: data.status ? String(data.status) : null,
          statusOperacional: metadata.status_operacional
            ? String(metadata.status_operacional)
            : null,
          origem: data.origem ? String(data.origem) : null,
          atualizadoEm: data.captured_at || data.updated_at || null,
        });
        setErro("");
      } catch (e) {
        if (ativo) {
          setPosicao(null);
          setErro(e instanceof Error ? e.message : "Não foi possível ler a telemetria.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void buscar();
    const timer = setInterval(() => void buscar(), 8000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [open, os?.id]);

  const velocidadeKmh =
    posicao?.velocidade != null && Number.isFinite(posicao.velocidade)
      ? posicao.velocidade * 3.6
      : null;
  // Bateria 0/ausente = NÃO informada pelo App (não exibir "0%").
  const bateriaPct =
    posicao?.bateria != null && posicao.bateria > 0
      ? posicao.bateria <= 1
        ? posicao.bateria * 100
        : posicao.bateria
      : null;

  // GPS: classifica pela idade real do último ponto (não pela origem).
  const minutosGps =
    posicao?.atualizadoEm != null
      ? Math.max(0, Math.floor((Date.now() - new Date(posicao.atualizadoEm).getTime()) / 60000))
      : null;
  const gpsState: "atualizado" | "antigo" | "muito_antigo" | "sem_rastreamento" =
    minutosGps == null
      ? "sem_rastreamento"
      : minutosGps <= 2
        ? "atualizado"
        : minutosGps <= 15
          ? "antigo"
          : "muito_antigo";
  const gpsLabel =
    gpsState === "atualizado"
      ? "GPS OK"
      : gpsState === "antigo"
        ? "GPS desatualizado"
        : gpsState === "muito_antigo"
          ? "GPS muito antigo"
          : "Sem GPS";
  const statusLabel =
    STATUS_OPERACIONAL_LABEL[String(posicao?.statusOperacional || posicao?.status || "")] ||
    posicao?.statusOperacional ||
    posicao?.status ||
    "online";

  const localizacao: MapLocation | null = posicao
    ? {
        id: os?.id || "os",
        numero: os?.numero || "OS",
        latitude: posicao.latitude,
        longitude: posicao.longitude,
        status: "em_rota",
        cliente: os?.cliente || undefined,
        speed: velocidadeKmh ?? undefined,
        accuracy: posicao.precisao ?? undefined,
        bateria: bateriaPct ?? undefined,
        lastLocationAt: posicao.atualizadoEm || undefined,
        osNumero: os?.numero || undefined,
        currentStage: statusLabel,
        gpsState,
      }
    : null;

  const linkMaps = posicao
    ? `https://www.google.com/maps?q=${posicao.latitude},${posicao.longitude}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-500" /> Rastreamento em Tempo Real
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            OS {os?.numero || "—"} · {os?.cliente || "—"}
          </p>
        </DialogHeader>

        {carregando && !posicao ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Lendo telemetria do App...
          </div>
        ) : !posicao ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Satellite className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Sem posição no momento</p>
            <p className="max-w-sm text-xs text-slate-500">{erro || "Aguardando telemetria do App do motorista..."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border">
              <MapboxMap
                locations={[localizacao!]}
                height="240px"
                showControls={false}
                showClustering={false}
                style="dark"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                  <Gauge className="h-3 w-3" /> Velocidade
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {velocidadeKmh != null ? `${velocidadeKmh.toFixed(1)} km/h` : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                  <MapPin className="h-3 w-3" /> Precisão
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {posicao.precisao != null ? `${posicao.precisao.toFixed(0)} m` : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                  <Battery className="h-3 w-3" /> Bateria
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {bateriaPct != null ? `${bateriaPct.toFixed(0)}%` : "Não informada"}
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                  <Satellite className="h-3 w-3" /> GPS
                </p>
                <p className={`mt-1 text-sm font-bold ${
                  gpsState === "atualizado"
                    ? "text-emerald-600"
                    : gpsState === "antigo"
                      ? "text-amber-600"
                      : "text-rose-600"
                }`}>
                  {gpsLabel}
                </p>
                {minutosGps != null && (
                  <p className="text-[10px] text-slate-500">
                    há {minutosGps < 60 ? `${minutosGps} min` : `${Math.floor(minutosGps / 60)}h`}
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                  <Clock className="h-3 w-3" /> Atualizado
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {posicao.atualizadoEm ? formatarDataHoraBR(posicao.atualizadoEm) : "—"}
                </p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                <Badge className="mt-1 bg-emerald-100 text-emerald-700">
                  {statusLabel}
                </Badge>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Origem</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{posicao.origem || "app_motorista"}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3 text-xs text-slate-600">
              <span>
                {posicao.latitude.toFixed(6)}, {posicao.longitude.toFixed(6)}
              </span>
              <a
                href={linkMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-blue-600 hover:underline"
              >
                Abrir no Google Maps <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
