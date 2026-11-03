import { useState } from "react";
import { Share2, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  compartilharDocumentoInternamente,
  type DocumentoMetadata,
} from "@/services/documentos/documentosMetadataService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: DocumentoMetadata | null;
}

export function DocumentoCompartilharModal({ open, onOpenChange, documento }: Props) {
  const [destinatario, setDestinatario] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  const compartilhar = async () => {
    if (!documento?.id) return;
    if (!destinatario.trim()) {
      toast.error("Informe o destinatário interno.");
      return;
    }
    try {
      setEnviando(true);
      const link = await compartilharDocumentoInternamente(documento.id, destinatario.trim(), mensagem.trim());
      if (link) {
        try {
          await navigator.clipboard.writeText(link);
          toast.success("Compartilhamento registrado e link seguro copiado.");
        } catch {
          toast.success("Compartilhamento registrado internamente.");
        }
      } else {
        toast.success("Compartilhamento registrado internamente.");
      }
      setDestinatario("");
      setMensagem("");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível compartilhar o documento.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" /> Compartilhar Internamente
          </DialogTitle>
          <DialogDescription>
            {documento?.nome || documento?.tipo || "Documento"} · o link seguro será copiado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="doc-share-destinatario">Destinatário interno *</Label>
            <Input
              id="doc-share-destinatario"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="Nome ou e-mail do colaborador"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-share-mensagem">Mensagem</Label>
            <Textarea
              id="doc-share-mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Contexto do compartilhamento (opcional)"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={() => void compartilhar()} disabled={enviando} className="gap-1.5">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            {enviando ? "Compartilhando..." : "Compartilhar e copiar link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
