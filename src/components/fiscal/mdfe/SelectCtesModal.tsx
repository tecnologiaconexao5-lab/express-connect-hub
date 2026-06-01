import { useState, useEffect } from "react";
import { FileSpreadsheet, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

interface SelectCtesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (cteIds: string[]) => void;
}

export default function SelectCtesModal({ open, onOpenChange, onConfirm }: SelectCtesModalProps) {
  const [ctes, setCtes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(function() {
    if (open) { fetchCtes(); setSelected(new Set()); }
  }, [open]);

  const fetchCtes = async function() {
    setLoading(true);
    const { data } = await supabase
      .from("fiscal_ctes")
      .select("*")
      .eq("status", "rascunho")
      .order("created_at", { ascending: false })
      .limit(30);
    setCtes(data || []);
    setLoading(false);
  };

  const toggle = function(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleConfirm = function() {
    onConfirm([...selected]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Selecionar CT-es para MDF-e
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : ctes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum CT-e rascunho encontrado.</p>
          ) : (
            <div className="space-y-2">
              {ctes.map(function(ct) {
                const pf = ct.metadata?.payload_focus || {};
                const pronto = ct.metadata?.pronto_para_emissao;
                const isSel = selected.has(ct.id);
                return (
                  <div
                    key={ct.id}
                    onClick={function() { toggle(ct.id); }}
                    className={"flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors " + (isSel ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">CT-e #{ct.numero || ct.id?.substring(0, 8)}</span>
                        {pronto ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Pronto</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Pendente</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">{fmtFin(ct.valor || 0)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {pf.tomador?.nome || "Sem tomador"} | {pf.origem?.cidade || "?"}/{pf.origem?.uf || "?"} → {pf.destino?.cidade || "?"}/{pf.destino?.uf || "?"}
                      </p>
                    </div>
                    <div className={"w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ml-3 " + (isSel ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                      {isSel && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={function() { onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            Gerar MDF-e ({selected.size} CT-e{selected.size !== 1 ? "s" : ""})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fmtFin(v: number) { return v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"; }
