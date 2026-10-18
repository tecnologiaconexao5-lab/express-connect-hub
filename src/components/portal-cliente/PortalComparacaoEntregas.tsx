import { useMemo } from "react";
import {
  X, CheckCircle2, AlertTriangle, Clock, Truck, MapPin, Camera, Signature,
  FileText, User, Calendar, Percent, Star, BarChart3, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComprovanteResumo } from "@/services/portalCliente/portalClienteService";

interface PortalComparacaoEntregasProps {
  comprovantes: ComprovanteResumo[];
  onClose: () => void;
}

const calcScore = (comp: ComprovanteResumo) => {
  const checks = {
    foto: !!(comp.foto_entrega_url || comp.foto_canhoto_url),
    assinatura: !!comp.assinatura_url,
    recebedor: !!comp.nome_recebedor,
    documento: !!comp.documento_recebedor,
    horario: !!comp.data_entrega,
    canhoto: !!comp.foto_canhoto_url,
  };
  const ok = Object.values(checks).filter(Boolean).length;
  return { score: Math.round((ok / Object.keys(checks).length) * 100), checks, ok, total: Object.keys(checks).length };
};

const fmtData = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function PortalComparacaoEntregas({ comprovantes, onClose }: PortalComparacaoEntregasProps) {
  const scores = useMemo(() => comprovantes.map(c => ({ id: c.id, ...calcScore(c) })), [comprovantes]);

  const rows: { label: string; icon: any; render: (c: ComprovanteResumo, idx: number) => string | number | React.ReactNode }[] = [
    {
      label: "OS", icon: FileText,
      render: (c) => c.titulo || "—",
    },
    {
      label: "Score", icon: Percent,
      render: (_, i) => {
        const s = scores[i].score;
        return (
          <div className="flex items-center gap-1.5">
            <span className={`font-black ${s >= 80 ? "text-emerald-600" : s >= 50 ? "text-amber-600" : "text-red-600"}`}>{s}%</span>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(st => (
                <span key={st} className={`text-[9px] ${st <= Math.round(s / 20) ? "text-amber-400" : "text-slate-200"}`}>★</span>
              ))}
            </div>
          </div>
        );
      },
    },
    {
      label: "Recebedor", icon: User,
      render: (c) => c.nome_recebedor || "—",
    },
    {
      label: "Data", icon: Calendar,
      render: (c) => fmtData(c.data_entrega),
    },
    {
      label: "Foto", icon: Camera,
      render: (c) => c.foto_entrega_url ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-slate-300" />,
    },
    {
      label: "Canhoto", icon: FileText,
      render: (c) => c.foto_canhoto_url ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-slate-300" />,
    },
    {
      label: "Assinatura", icon: Signature,
      render: (c) => c.assinatura_url ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-slate-300" />,
    },
    {
      label: "Documento", icon: FileText,
      render: (c) => c.documento_recebedor || "—",
    },
    {
      label: "Conformidade", icon: BarChart3,
      render: (_, i) => {
        const s = scores[i];
        const okItems = Object.entries(s.checks).filter(([, v]) => v).length;
        return `${okItems}/${s.total}`;
      },
    },
  ];

  return (
    <Card className="bg-white border-[#E5E7EB] shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-[#E5E7EB] bg-gradient-to-r from-[#F8FAFC] to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F97316]/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-[#F97316]" />
            </div>
            <div>
              <CardTitle className="text-sm font-extrabold text-[#0F172A]">Comparação de Entregas</CardTitle>
              <p className="text-[10px] text-[#64748B] font-medium">{comprovantes.length} entrega(s) selecionada(s)</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="w-7 h-7 rounded-full" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#E5E7EB]">
              <th className="text-left p-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider bg-[#F8FAFC] min-w-[100px] sticky left-0">Métrica</th>
              {comprovantes.map((c, i) => (
                <th key={c.id} className="p-3 text-center font-bold text-[#111827] min-w-[120px]">
                  <div className="text-[9px] text-[#64748B] font-medium">#{i + 1}</div>
                  <div className="text-xs truncate max-w-[100px]">{c.titulo || "OS"}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-[#E5E7EB]/50 hover:bg-[#F8FAFC]/50 transition-colors">
                <td className="p-3 font-bold text-[#475569] bg-white sticky left-0 border-r border-[#E5E7EB]/50">
                  <div className="flex items-center gap-2">
                    <row.icon className="w-3.5 h-3.5 text-[#F97316]" />
                    {row.label}
                  </div>
                </td>
                {comprovantes.map((c, ci) => (
                  <td key={c.id} className="p-3 text-center text-[#334155]">
                    {row.render(c, ci)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
