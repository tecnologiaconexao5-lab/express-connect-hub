import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  listarOSSite,
  osSitePendente,
  type OSSiteResumo,
} from "@/services/operacao/osSiteService";

const ROTA_OS = "/operacao?tab=os";
// STATUS_ENCERRADOS (finalizada/cancelada) é aplicado em osSitePendente.

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

    const canal = supabase
      .channel("os-site-solicitacoes")
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
  const rapida = solicitacoes.slice(0, 4);

  return (
    <div className="rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50/70 to-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
            <Truck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-500">
              Dashboard central
            </p>
            <h3 className="text-sm font-black text-orange-950">
              Solicitações de Clientes Site
            </h3>
            <p className="text-xs text-orange-700">
              {total} {total === 1 ? "OS pendente" : "OS pendentes"} de despacho · recebidas via Cotação Express
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border border-orange-300 bg-white text-orange-700">
            {total}
          </Badge>
          <Link
            to={ROTA_OS}
            className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-orange-600"
          >
            Abrir fila <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {rapida.map((os) => (
          <Link
            key={os.id}
            to={`${ROTA_OS}&os=${os.id}`}
            className="group rounded-lg border border-orange-200/80 bg-white/80 p-2.5 transition hover:border-orange-300 hover:bg-white"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-black text-slate-800">{os.numero}</span>
              <ArrowRight className="h-3 w-3 text-orange-500 transition group-hover:translate-x-0.5" />
            </div>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">
              {os.clienteNome}
            </p>
            {os.agendada && (
              <Badge className="mt-1.5 border border-amber-200 bg-amber-100 px-1.5 py-0 text-[9px] font-bold uppercase text-amber-800">
                <CalendarClock className="mr-1 h-3 w-3" /> Agendado · {os.agendamento}
              </Badge>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// Contrato da consulta: ordens_servico.carga->>origem_cotacao + STATUS_ENCERRADOS
// (aplicado em osSitePendente, no osSiteService).
