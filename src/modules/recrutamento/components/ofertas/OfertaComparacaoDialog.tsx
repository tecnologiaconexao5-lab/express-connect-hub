import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PremiumBadge } from "../design-system/PremiumBadge";
import { DIAS_SEMANA, MODALIDADES } from "@/lib/ofertaPublica";
import {
  STATUS_OFERTA_LABELS,
  TIPO_OFERTA_LABELS,
  type OfertaPublica,
  type OfertaStatus,
} from "../../services/ofertasPublicasService";

interface OfertaComparacaoDialogProps {
  ofertas: OfertaPublica[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_VARIANT: Record<OfertaStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  nova: "info",
  em_analise: "warning",
  em_contato: "info",
  convertida: "success",
  descartada: "danger",
  arquivada: "default",
  duplicada: "warning",
};

function valor(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dias(diasDisponiveis: number[]): string {
  if (!diasDisponiveis.length) return "—";
  return diasDisponiveis
    .map((dia) => DIAS_SEMANA.find((item) => item.value === dia)?.label ?? String(dia))
    .join(", ");
}

function modalidades(valores: string[]): string {
  if (!valores.length) return "—";
  return valores.map((item) => MODALIDADES.find((m) => m.value === item)?.label ?? item).join(", ");
}

function linhas(oferta: OfertaPublica): Array<{ rotulo: string; valor: string }> {
  return [
    { rotulo: "Status", valor: STATUS_OFERTA_LABELS[oferta.status] },
    { rotulo: "Tipo", valor: TIPO_OFERTA_LABELS[oferta.tipoOferta] },
    { rotulo: "Contato", valor: [oferta.telefone, oferta.email].filter(Boolean).join(" · ") || "—" },
    { rotulo: "Cidade/UF", valor: [oferta.cidade, oferta.uf].filter(Boolean).join(" / ") || "—" },
    { rotulo: "Regiões", valor: oferta.regioes.join(", ") || "—" },
    { rotulo: "Dias", valor: dias(oferta.diasDisponiveis) },
    { rotulo: "Horário", valor: `${oferta.horarioInicio || "—"} às ${oferta.horarioFim || "—"}` },
    { rotulo: "Modalidades", valor: modalidades(oferta.modalidades) },
    { rotulo: "Veículo", valor: [oferta.veiculoTipo, oferta.veiculoModelo, oferta.carroceria].filter(Boolean).join(" · ") || "—" },
    { rotulo: "Capacidade", valor: [oferta.capacidadeKg !== null ? `${oferta.capacidadeKg} kg` : "", oferta.capacidadeM3 !== null ? `${oferta.capacidadeM3} m³` : ""].filter(Boolean).join(" · ") || "—" },
    { rotulo: "Diária", valor: valor(oferta.valorDiaria) },
    { rotulo: "Por km", valor: valor(oferta.valorKm) },
    { rotulo: "Saída", valor: valor(oferta.valorSaida) },
    { rotulo: "Mensal", valor: valor(oferta.valorMensal) },
    { rotulo: "Condições", valor: oferta.condicoesComerciais || "—" },
    { rotulo: "Restrições", valor: oferta.restricoes || "—" },
  ];
}

export function OfertaComparacaoDialog({ ofertas, open, onOpenChange }: OfertaComparacaoDialogProps) {
  const rotulos = ofertas.length ? linhas(ofertas[0]).map((item) => item.rotulo) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparar ofertas</DialogTitle>
          <DialogDescription>
            Compare disponibilidade, regiões, veículos, capacidades, valores e condições. A seleção é apenas para análise e não altera as ofertas.
          </DialogDescription>
        </DialogHeader>

        {ofertas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Selecione de 2 a 4 ofertas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-28 border-b border-border/60 bg-background p-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Critério
                  </th>
                  {ofertas.map((oferta) => (
                    <th key={oferta.id} className="min-w-[180px] border-b border-border/60 p-2 align-top">
                      <p className="text-sm font-semibold text-foreground">{oferta.nome}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{oferta.protocolo}</p>
                      <PremiumBadge className="mt-1" variant={STATUS_VARIANT[oferta.status]}>
                        {STATUS_OFERTA_LABELS[oferta.status]}
                      </PremiumBadge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rotulos.map((rotulo) => (
                  <tr key={rotulo} className="align-top">
                    <th className="sticky left-0 z-10 border-b border-border/40 bg-background p-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {rotulo}
                    </th>
                    {ofertas.map((oferta) => {
                      const linha = linhas(oferta).find((item) => item.rotulo === rotulo);
                      return (
                        <td key={`${oferta.id}-${rotulo}`} className="border-b border-border/40 p-2 text-foreground">
                          {linha?.valor || "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
