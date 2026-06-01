import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Loader2 } from "lucide-react";

interface SelectOsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (osId: string) => void;
  title?: string;
}

export default function SelectOsModal({ open, onOpenChange, onConfirm, title }: SelectOsModalProps) {
  const [osList, setOsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchOs();
      setSelectedId(null);
    }
  }, [open]);

  const fetchOs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, status, cliente, valor_cliente")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setOsList(data || []);
    } catch (err: any) {
      toast.error("Erro ao buscar OS: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedId) return;
    onConfirm(selectedId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title || "Selecionar Ordem de Serviço"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <ScrollArea className="h-[300px] border rounded-md p-2">
            <div className="space-y-2">
              {osList.map((os) => (
                <div
                  key={os.id}
                  onClick={() => setSelectedId(os.id)}
                  className={`p-3 border rounded-md cursor-pointer flex items-center justify-between transition-colors ${
                    selectedId === os.id ? "bg-blue-50 border-blue-500" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className={`w-5 h-5 ${selectedId === os.id ? "text-blue-500" : "text-slate-400"}`} />
                    <div>
                      <div className="font-medium">{os.numero}</div>
                      <div className="text-xs text-slate-500">{os.cliente || "Sem cliente"}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-700">
                      {(os.valor_cliente || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </div>
                    <div className="text-xs text-slate-500 capitalize">{os.status}</div>
                  </div>
                </div>
              ))}
              {osList.length === 0 && (
                <div className="text-center text-slate-500 py-8">
                  Nenhuma OS encontrada.
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId || loading}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
