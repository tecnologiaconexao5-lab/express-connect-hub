// ============================================================
// RADAR OPERACIONAL — Combustíveis (Mobile)
// Cards com o preço médio diário de Gasolina, Etanol e Diesel
// na região de São Paulo/SP. Fonte: services/radarCombustivel.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  Fuel,
  Loader2,
  MapPin,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buscarRadarCombustivel,
  formatarAtualizacaoRadar,
  formatarPrecoCombustivel,
  formatarVariacaoCombustivel,
  RADAR_REGIAO_PADRAO,
  type PrecoCombustivelRadar,
  type RadarCombustivelResultado,
  type TipoCombustivelRadar,
} from "@/services/radarCombustivel";

const ESTILOS_CARD: Record<
  TipoCombustivelRadar,
  { gradiente: string; anel: string; icone: string }
> = {
  gasolina: {
    gradiente: "from-orange-500 via-orange-500 to-amber-400",
    anel: "ring-orange-200",
    icone: "bg-white/20 text-white",
  },
  etanol: {
    gradiente: "from-emerald-600 via-emerald-500 to-lime-500",
    anel: "ring-emerald-200",
    icone: "bg-white/20 text-white",
  },
  diesel: {
    gradiente: "from-slate-900 via-slate-800 to-slate-700",
    anel: "ring-slate-300",
    icone: "bg-white/15 text-white",
  },
};

function CardCombustivel({ preco }: { preco: PrecoCombustivelRadar }) {
  const estilo = ESTILOS_CARD[preco.id];
  const alta = preco.tendencia === "alta";
  const baixa = preco.tendencia === "baixa";
  const TendenciaIcone = baixa ? TrendingDown : TrendingUp;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg ring-1",
        estilo.gradiente,
        estilo.anel,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10"
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", estilo.icone)}>
            <Fuel className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">Preço médio</p>
            <p className="text-sm font-black leading-tight">{preco.nome}</p>
          </div>
        </div>

        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold",
            alta ? "bg-red-500/25 text-red-50" : baixa ? "bg-emerald-500/25 text-emerald-50" : "bg-white/20 text-white",
          )}
        >
          <TendenciaIcone className="h-3 w-3" />
          {formatarVariacaoCombustivel(preco.variacaoPercentual)}
        </span>
      </div>

      <div className="mt-3 flex items-end gap-1">
        <span className="text-[26px] font-black leading-none tracking-tight">
          {formatarPrecoCombustivel(preco.preco)}
        </span>
        <span className="pb-0.5 text-[10px] font-semibold text-white/75">/ litro</span>
      </div>
    </div>
  );
}

export default function RadarCombustivelView({ ativo = true }: { ativo?: boolean }) {
  const [dados, setDados] = useState<RadarCombustivelResultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await buscarRadarCombustivel();
      setDados(resultado);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os preços.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!ativo || dados || carregando) return;
    void carregar();
  }, [ativo, dados, carregando, carregar]);

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <Fuel className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-black leading-tight text-slate-900">Radar de Combustível</h2>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <MapPin className="h-3 w-3" /> {dados ? `${dados.regiao}/${dados.uf}` : RADAR_REGIAO_PADRAO}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando}
            aria-label="Atualizar preços"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {carregando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
          <Clock className="h-3 w-3" />
          {dados
            ? `Atualizado em ${formatarAtualizacaoRadar(dados.atualizadoEm)}`
            : "Consultando a média diária..."}
        </p>
      </section>

      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          {erro}
          <button type="button" onClick={() => void carregar()} className="ml-2 underline">
            Tentar novamente
          </button>
        </div>
      )}

      {!dados && !erro && (
        <div className="grid grid-cols-1 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[118px] animate-pulse rounded-2xl border border-slate-200 bg-slate-200/70"
            />
          ))}
        </div>
      )}

      {dados && (
        <>
          <div className="grid grid-cols-1 gap-3">
            {dados.precos.map((preco) => (
              <CardCombustivel key={preco.id} preco={preco} />
            ))}
          </div>

          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] leading-tight text-slate-500">
            {dados.fonte}. Valores de referência para cálculo de custo da operação — confirme o preço
            no posto antes do abastecimento.
          </p>
        </>
      )}
    </div>
  );
}
