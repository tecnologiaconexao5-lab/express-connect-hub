import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

const STATUS_ENCERRADOS = ["finalizada", "cancelada"];

interface OsCotacaoRow {
  id: string;
  numero: string | null;
  prestador: string | null;
  status: string | null;
}

/**
 * Card de alerta do Dashboard: OS geradas a partir de Cotações Express (web)
 * que ainda estão sem prestador alocado.
 *
 * Fonte primária: marcador `carga.origem_cotacao` gravado na conversão
 * orçamento → OS (sem migration). Fallback legado: OS vinculadas a orçamentos
 * com `pedido_interno` (id da cotação) ou observações "Cotação web".
 */
export default function AlertaOscotacaoExpress() {
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    const filtrarPendentes = (linhas: OsCotacaoRow[]) =>
      linhas.filter((os) => {
        const temPrestador = Boolean(String(os.prestador || "").trim());
        const status = String(os.status || "").toLowerCase();
        return !temPrestador && !STATUS_ENCERRADOS.includes(status);
      }).length;

    (async () => {
      try {
        const { data: marcadas } = await supabase
          .from("ordens_servico")
          .select("id, numero, prestador, status")
          .not("carga->>origem_cotacao", "is", null)
          .limit(500);

        let candidatas: OsCotacaoRow[] = Array.isArray(marcadas) ? (marcadas as OsCotacaoRow[]) : [];

        // Fallback legado (OS geradas antes do marcador existir).
        if (candidatas.length === 0) {
          const { data: orcs } = await supabase
            .from("orcamentos")
            .select("numero")
            .or("pedido_interno.not.is.null,observacoes_gerais.ilike.%Cotação web%")
            .limit(500);

          const numeros = (Array.isArray(orcs) ? orcs : [])
            .map((o) => (o as { numero?: string | null }).numero)
            .filter((n): n is string => Boolean(n));

          if (numeros.length > 0) {
            const { data: legadas } = await supabase
              .from("ordens_servico")
              .select("id, numero, prestador, status")
              .in("orcamento_origem", numeros)
              .limit(500);
            candidatas = Array.isArray(legadas) ? (legadas as OsCotacaoRow[]) : [];
          }
        }

        if (ativo) setTotal(filtrarPendentes(candidatas));
      } catch {
        if (ativo) setTotal(0);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  if (carregando || total === 0) return null;

  return (
    <Link to="/operacao?tab=os" className="group block">
      <div className="flex items-center gap-4 rounded-xl border border-orange-200 bg-orange-50 p-4 transition hover:border-orange-300 hover:bg-orange-100/70">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
          <Truck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-orange-900">
            {total} {total === 1 ? "OS via Cotação Express pendente" : "OS via Cotação Express pendentes"} de prestador
          </p>
          <p className="text-xs text-orange-700">
            Cotações aprovadas no site aguardando alocação — clique para alocar o prestador.
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-orange-500 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
