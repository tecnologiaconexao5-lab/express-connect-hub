import { useState, useEffect } from "react";
import { FileText, Trash2, ExternalLink, LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { FiscalDocumentoVinculado } from "@/types/fiscal";

interface XmlImportadosListProps {
  refreshKey?: number;
  onVincular?: (doc: FiscalDocumentoVinculado) => void;
}

export default function XmlImportadosList({ refreshKey, onVincular }: XmlImportadosListProps) {
  const [docs, setDocs] = useState<FiscalDocumentoVinculado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocs();
  }, [refreshKey]);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fiscal_documentos_vinculados")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setDocs((data || []) as FiscalDocumentoVinculado[]);
    } catch (err: any) {
      toast.error(`Erro ao buscar XMLs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("fiscal_documentos_vinculados")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("XML removido.");
      fetchDocs();
    } catch (err: any) {
      toast.error(`Erro ao remover: ${err.message}`);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      aguardando_vinculo: { label: "Aguardando vínculo", className: "bg-amber-100 text-amber-700 border-amber-200" },
      vinculado: { label: "Vinculado à OS", className: "bg-green-100 text-green-700 border-green-200" },
    };
    const cfg = map[status] || { label: status, className: "bg-slate-100 text-slate-700" };
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground border border-dashed rounded-lg">
        <FileText className="w-10 h-10 mb-2 opacity-20" />
        <p className="text-sm font-medium">Nenhum XML importado</p>
        <p className="text-xs mt-1 max-w-[300px]">
          Clique em "Importar XML" para adicionar uma NF-e.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="border rounded-lg p-3 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              <span className="font-medium text-sm">
                NF-e {doc.numero || "S/N"}
                {doc.serie ? ` / Série ${doc.serie}` : ""}
              </span>
            </div>
            {statusBadge(doc.status)}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {doc.emitente_nome && (
              <div>
                <span className="text-slate-400">Emitente:</span> {doc.emitente_nome}
              </div>
            )}
            {doc.destinatario_nome && (
              <div>
                <span className="text-slate-400">Destinatário:</span> {doc.destinatario_nome}
              </div>
            )}
            {doc.valor_total != null && (
              <div>
                <span className="text-slate-400">Valor:</span>{" "}
                {doc.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            )}
            {doc.chave_acesso && (
              <div className="col-span-2">
                <span className="text-slate-400">Chave:</span>{" "}
                <span className="font-mono text-[10px]">{doc.chave_acesso}</span>
              </div>
            )}
            {doc.peso_bruto != null && (
              <div>
                <span className="text-slate-400">Peso:</span> {doc.peso_bruto.toLocaleString("pt-BR")} kg
              </div>
            )}
            {doc.volumes != null && (
              <div>
                <span className="text-slate-400">Volumes:</span> {doc.volumes}
              </div>
            )}
            {doc.municipio_origem && doc.uf_origem && (
              <div>
                <span className="text-slate-400">Origem:</span> {doc.municipio_origem}/{doc.uf_origem}
              </div>
            )}
            {doc.municipio_destino && doc.uf_destino && (
              <div>
                <span className="text-slate-400">Destino:</span> {doc.municipio_destino}/{doc.uf_destino}
              </div>
            )}
          </div>

          {doc.produto_predominante && (
            <div className="mt-1 text-xs text-slate-500">
              <span className="text-slate-400">Produto:</span> {doc.produto_predominante}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 pt-2 border-t">
            {doc.status === "aguardando_vinculo" && onVincular && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onVincular(doc)}
                className="h-7 text-xs gap-1"
              >
                <LinkIcon className="w-3 h-3" /> Vincular OS
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(doc.id)}
              className="h-7 text-xs gap-1 text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" /> Remover
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
