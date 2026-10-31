// ============================================================
// Portal do Prestador — Aba "Rede" (Rede de Oportunidades)
// Lista as OS publicadas na rede com valor, rota e distância.
// Aba de demonstração/visualização no app mobile do prestador.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Network,
  Package,
  RefreshCw,
  Route,
  Truck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ExecucaoOSDialog from "@/components/portal-prestador/ExecucaoOSDialog";
import {
  aceitarOportunidadeRede,
  buscarOportunidadesRede,
  formatarDistanciaOportunidade,
  formatarMoedaOportunidade,
  type OportunidadeRedeMobile,
} from "@/services/portal-prestador/redeOportunidadesService";

function formatarPrazo(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "Sem prazo";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CardOportunidade({
  oportunidade,
  onAbrir,
}: {
  oportunidade: OportunidadeRedeMobile;
  onAbrir: (oportunidade: OportunidadeRedeMobile) => void;
}) {
  return (
    <motion.button
      type="button"
      data-testid="rede-oportunidade-card"
      whileTap={{ scale: 0.98 }}
      onClick={() => onAbrir(oportunidade)}
      className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Network className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">OS na rede</p>
            <p className="text-sm font-bold text-foreground">{oportunidade.osNumero || oportunidade.osId || "—"}</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          Disponível
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-start gap-1.5 text-xs text-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="line-clamp-1">{oportunidade.origem}</span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-foreground">
          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="line-clamp-1">{oportunidade.destino}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1">
            <Route className="h-3.5 w-3.5" /> {formatarDistanciaOportunidade(oportunidade.distanciaKm)}
          </span>
          <span className="flex items-center gap-1">
            <Truck className="h-3.5 w-3.5" /> {oportunidade.veiculo}
          </span>
        </div>
        <span className="text-base font-black text-emerald-600">
          {formatarMoedaOportunidade(oportunidade.valorPrestador)}
        </span>
      </div>
    </motion.button>
  );
}

function DetalheOportunidade({
  oportunidade,
  onClose,
  onAceita,
}: {
  oportunidade: OportunidadeRedeMobile | null;
  onClose: () => void;
  onAceita: (oportunidade: OportunidadeRedeMobile) => void;
}) {
  const [aceitando, setAceitando] = useState(false);

  const handleAceitar = async () => {
    if (!oportunidade) return;
    setAceitando(true);
    try {
      await aceitarOportunidadeRede(oportunidade.id);
      toast.success("Oportunidade aceita!", {
        description: `OS ${oportunidade.osNumero || oportunidade.osId} reservada para você.`,
      });
      onAceita(oportunidade);
      onClose();
    } catch (error) {
      toast.error("Não foi possível aceitar a oportunidade.", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setAceitando(false);
    }
  };

  return (
    <Dialog open={Boolean(oportunidade)} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Detalhes da Oportunidade
          </DialogTitle>
          <DialogDescription>
            OS {oportunidade?.osNumero || oportunidade?.osId || "—"} publicada pela Torre de Controle.
          </DialogDescription>
        </DialogHeader>

        {oportunidade && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-emerald-50 p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Valor do repasse</p>
              <p className="text-2xl font-black text-emerald-700">
                {formatarMoedaOportunidade(oportunidade.valorPrestador)}
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-border p-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Retirada</p>
                  <p className="text-foreground">{oportunidade.origem}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Entrega</p>
                  <p className="text-foreground">{oportunidade.destino}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-muted/50 p-2.5">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                  <Route className="h-3 w-3" /> Distância
                </p>
                <p className="font-bold text-foreground">{formatarDistanciaOportunidade(oportunidade.distanciaKm)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-2.5">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                  <Truck className="h-3 w-3" /> Veículo
                </p>
                <p className="font-bold text-foreground">{oportunidade.veiculo}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-2.5">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                  <Package className="h-3 w-3" /> Carga
                </p>
                <p className="font-bold capitalize text-foreground">{oportunidade.tipoCarga}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-2.5">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                  <Clock className="h-3 w-3" /> Prazo
                </p>
                <p className="font-bold text-foreground">{formatarPrazo(oportunidade.prazoExpiracao)}</p>
              </div>
            </div>

            <Button
              className="h-12 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={aceitando}
              onClick={() => void handleAceitar()}
            >
              {aceitando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {aceitando ? "Aceitando..." : "Aceitar Oportunidade"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function RedeTab() {
  const [oportunidades, setOportunidades] = useState<OportunidadeRedeMobile[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<OportunidadeRedeMobile | null>(null);
  const [emAndamento, setEmAndamento] = useState<OportunidadeRedeMobile | null>(null);
  const [finalizada, setFinalizada] = useState(false);
  const [execucaoAberta, setExecucaoAberta] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await buscarOportunidadesRede();
      setOportunidades(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar a rede.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Network className="h-5 w-5 text-primary" />
            Rede de Oportunidades
          </h1>
          <p className="text-sm text-muted-foreground">
            {carregando
              ? "Buscando oportunidades..."
              : `${oportunidades.length} oportunidade(s) disponível(is) para você`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          aria-label="Atualizar oportunidades"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {erro && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-semibold text-destructive">
          {erro}
          <button type="button" onClick={() => void carregar()} className="ml-2 underline">
            Tentar novamente
          </button>
        </div>
      )}

      {carregando && oportunidades.length === 0 && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-muted/60" />
          ))}
        </div>
      )}

      {!carregando && !erro && oportunidades.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Network className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-semibold text-foreground">Nenhuma oportunidade agora</p>
          <p className="text-xs text-muted-foreground">
            Assim que a Torre publicar uma OS, ela aparece aqui.
          </p>
        </div>
      )}

      {emAndamento && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                {finalizada ? "OS concluída" : "OS em andamento"}
              </p>
              <p className="text-sm font-black text-emerald-900">
                {emAndamento.osNumero || emAndamento.osId}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-emerald-800">
                {emAndamento.origem} → {emAndamento.destino}
              </p>
            </div>
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
                finalizada ? "bg-blue-100 text-blue-700" : "bg-emerald-600 text-white"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              {finalizada ? "Concluída" : "Em andamento"}
            </span>
          </div>
          <Button
            type="button"
            className="mt-3 h-10 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => setExecucaoAberta(true)}
          >
            <Route className="h-4 w-4" />
            {finalizada ? "Ver comprovantes da OS" : "Ver OS em andamento"}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {oportunidades.map((oportunidade) => (
          <CardOportunidade
            key={oportunidade.id}
            oportunidade={oportunidade}
            onAbrir={setSelecionada}
          />
        ))}
      </div>

      <DetalheOportunidade
        oportunidade={selecionada}
        onClose={() => setSelecionada(null)}
        onAceita={(oportunidade) => {
          setEmAndamento(oportunidade);
          setFinalizada(false);
        }}
      />

      <ExecucaoOSDialog
        oportunidade={emAndamento}
        open={execucaoAberta}
        onOpenChange={setExecucaoAberta}
        onFinalizada={() => setFinalizada(true)}
      />
    </div>
  );
}
