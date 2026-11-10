import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, Clock3, MapPin, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { FUSO_BR, formatarHoraBR, hojeISOSP, parseDataHoraSP } from "@/lib/formatDates";
import {
  listarOSSite,
  osSitePendente,
  type OSSiteResumo,
} from "@/services/operacao/osSiteService";

const ROTA_OS = "/operacao?tab=os";
// STATUS_ENCERRADOS (finalizada/cancelada) é aplicado em osSitePendente.

/** Horário exato da solicitação em America/Sao_Paulo (HH:mm; com data fora de hoje). */
const formatarHorarioSolicitacao = (iso?: string | null): string => {
  const d = parseDataHoraSP(iso);
  if (!d) return "";
  const hora = formatarHoraBR(iso);
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  if (dia === hojeISOSP()) return hora;
  const diaMes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    day: "2-digit",
    month: "2-digit",
  }).format(d);
  return `${diaMes} · ${hora}`;
};

/**
 * Banner do Dashboard: OS criadas pela Cotação Express e ainda sem prestador.
 *
 * Fonte: `ordens_servico` marcadas com `carga->>origem_cotacao` (ver osSiteService).
 * Atualiza por Realtime e por polling de segurança.
 */
export default function AlertaOscotacaoExpress() {
  const [solicitacoes, setSolicitacoes] = useState<OSSiteResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    const rows = await listarOSSite(100);
    setSolicitacoes(rows.filter(osSitePendente));
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    void carregar();

    const agendarRefetch = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => {
        if (ativo) void carregar();
      }, 800);
    };

    // Nome único por montagem: evita reutilizar um canal já subscrito quando o
    // componente remonta (o Supabase rejeitaria novos `.on()` após `.subscribe()`).
    const nomeCanal = `os-site-solicitacoes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const canal = supabase
      .channel(nomeCanal)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordens_servico" },
        agendarRefetch,
      )
      .subscribe();

    const intervalo = setInterval(() => {
      if (ativo) void carregar();
    }, 60_000);

    return () => {
      ativo = false;
      clearInterval(intervalo);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      void supabase.removeChannel(canal);
    };
  }, [carregar]);

  if (carregando || solicitacoes.length === 0) return null;

  const total = solicitacoes.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* faixa da marca */}
      <div className="h-1 w-full bg-gradient-to-r from-[#2E1065] via-violet-500 to-orange-500" />

      <div className="flex flex-col gap-3 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2E1065] to-violet-700 text-white shadow-sm">
            <Truck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600">
              Dashboard central
            </p>
            <h3 className="truncate text-sm font-black text-slate-900">
              Solicitações de Clientes Site
            </h3>
            <p className="truncate text-[11px] text-slate-500">
              {total} {total === 1 ? "solicitação" : "solicitações"} aguardando despacho · Cotação Express
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-black text-orange-700">
            {total}
          </Badge>
          <Link
            to={ROTA_OS}
            className="inline-flex items-center gap-1 rounded-lg bg-[#2E1065] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-violet-800"
          >
            Abrir fila <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Cards em rolagem horizontal (todos visíveis por swipe/scroll) */}
      <div className="mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:thin]">
        {solicitacoes.map((os) => {
          const horario = formatarHorarioSolicitacao(os.createdAt);
          return (
            <Link
              key={os.id}
              to={`${ROTA_OS}&os=${os.id}`}
              className="group w-[220px] shrink-0 snap-start rounded-xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[11px] font-black tracking-tight text-slate-800">
                  {os.numero}
                </span>
                <ArrowRight className="h-3 w-3 shrink-0 text-orange-500 transition group-hover:translate-x-0.5" />
              </div>

              {horario && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                  <Clock3 className="h-3 w-3 text-violet-500" /> {horario}
                </p>
              )}

              <p className="mt-1.5 truncate text-[11px] font-semibold text-slate-700">
                {os.clienteNome}
              </p>

              {os.rotaResumo && (
                <p className="mt-1 flex items-start gap-1 text-[10px] leading-snug text-slate-500">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-orange-500" />
                  <span className="line-clamp-2 break-words">{os.rotaResumo}</span>
                </p>
              )}

              {os.agendada && (
                <Badge className="mt-2 gap-1 whitespace-nowrap border border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] font-bold normal-case tracking-normal text-amber-800">
                  <CalendarClock className="h-3 w-3" /> Agendado · {os.agendamento}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// Contrato da consulta: ordens_servico.carga->>origem_cotacao + STATUS_ENCERRADOS
// (aplicado em osSitePendente, no osSiteService).
