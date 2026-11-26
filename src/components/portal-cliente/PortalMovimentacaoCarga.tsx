import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Package, RefreshCw, RotateCcw, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalEmptyState, PortalKpiCard } from "@/components/portal-cliente";
import {
  buscarMovimentacaoCargaCliente,
  type MovimentacaoCargaResumo,
} from "@/services/portalCliente/portalClienteService";

interface PortalMovimentacaoCargaProps {
  clienteId?: string;
}

const fmtDataHora = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleString("pt-BR");
};

export function PortalMovimentacaoCarga({ clienteId }: PortalMovimentacaoCargaProps) {
  const [periodo, setPeriodo] = useState("30dias");
  const [dados, setDados] = useState<MovimentacaoCargaResumo | null>(null);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (!clienteId) {
      setDados(null);
      return;
    }
    setLoading(true);
    try {
      setDados(await buscarMovimentacaoCargaCliente(clienteId, periodo));
    } finally {
      setLoading(false);
    }
  }, [clienteId, periodo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!clienteId) return null;

  return (
    <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
      <CardHeader className="pb-3 border-b border-[#F1F5F9]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#F97316]" />
              Movimentação de Carga & Logística Reversa
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Volumes expedidos, em trânsito e retornos à base — filtrado pela sua empresa.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[130px] h-8 rounded-lg bg-white border-[#E5E7EB] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7dias">7 dias</SelectItem>
                <SelectItem value="30dias">30 dias</SelectItem>
                <SelectItem value="90dias">90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={carregar} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PortalKpiCard
            title="Volumes Expedidos"
            value={dados?.volumesExpedidos ?? 0}
            subtitle={`${dados?.totalPedidos ?? 0} pedido(s)`}
            icon={Package}
            loading={loading}
          />
          <PortalKpiCard
            title="Entregues"
            value={dados?.volumesEntregues ?? 0}
            subtitle={`${dados?.entregues ?? 0} pedido(s) concluído(s)`}
            icon={Truck}
            status="concluido"
            loading={loading}
          />
          <PortalKpiCard
            title="Em Trânsito"
            value={dados?.volumesEmTransito ?? 0}
            subtitle={`${dados?.emTransito ?? 0} pedido(s) em rota`}
            icon={Truck}
            status="em_andamento"
            loading={loading}
          />
          <PortalKpiCard
            title="Em Devolução / Base"
            value={dados?.volumesEmDevolucao ?? 0}
            subtitle={
              (dados?.volumesDevolvidos ?? 0) > 0
                ? `${dados?.volumesDevolvidos} já retornado(s)`
                : `${dados?.emDevolucao ?? 0} em retorno`
            }
            icon={AlertTriangle}
            status={(dados?.emDevolucao ?? 0) > 0 ? "atencao" : "saudavel"}
            loading={loading}
          />
        </div>

        <div>
          <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-2">
            Timeline de devoluções / retornos
          </h4>
          {loading ? (
            <div className="py-6 text-center text-xs text-[#64748B]">Carregando movimentação...</div>
          ) : (dados?.eventos.length ?? 0) === 0 ? (
            <PortalEmptyState
              type="sem-dados"
              title="Nenhuma devolução no período"
              description="Recusas e retornos à base aparecerão aqui automaticamente."
            />
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
              {dados?.eventos.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      ev.tipo === "recusa" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {ev.tipo === "recusa" ? <AlertTriangle className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#0F172A]">{ev.titulo}</p>
                      <span className="text-[10px] text-[#94A3B8] shrink-0">{fmtDataHora(ev.data)}</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{ev.descricao}</p>
                    {ev.os_numero && (
                      <p className="text-[10px] font-bold text-[#F97316] mt-0.5">OS {ev.os_numero}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default PortalMovimentacaoCarga;
