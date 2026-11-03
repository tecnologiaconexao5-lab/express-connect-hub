import { useEffect, useState } from "react";
import { FilePlus2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  criarNovaVersaoDocumento,
  type DocumentoMetadata,
  type ResultadoUploadDocumento,
} from "@/services/documentos/documentosMetadataService";
import { DocumentoUploadUniversal } from "./DocumentoUploadUniversal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: DocumentoMetadata | null;
  modo?: "nova" | "atualizar";
  onConcluido?: (resultado: ResultadoUploadDocumento) => void;
}

export function DocumentoNovaVersaoDialog({
  open,
  onOpenChange,
  documento,
  modo = "nova",
  onConcluido,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setNome(documento?.nome || "");
    setDescricao(documento?.descricao || "");
  }, [open, documento?.id, documento?.nome, documento?.descricao]);

  const enviar = async () => {
    if (!documento) return;
    if (!file) {
      toast.error("Selecione o arquivo da nova versão.");
      return;
    }
    try {
      setSalvando(true);
      const resultado = await criarNovaVersaoDocumento(documento, file, {
        nome: nome.trim() || documento.nome || file.name,
        descricao: descricao.trim() || null,
      });
      toast.success(`Versão ${resultado.documento.versao} criada. A versão original foi preservada.`);
      onConcluido?.(resultado);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar nova versão.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" />
            {modo === "atualizar" ? "Atualizar Versão" : "Adicionar Nova Versão"}
          </DialogTitle>
          <DialogDescription>
            {documento?.nome || documento?.tipo || "Documento"} · v{documento?.versao ?? 1}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>O arquivo original e o histórico são preservados. Esta ação cria uma nova versão ativa.</p>
          </div>

          <DocumentoUploadUniversal
            disabled={salvando}
            onFile={setFile}
            label={file ? file.name : "Envie o arquivo da nova versão"}
            hint={file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, JPG, PNG ou WEBP · até 50 MB"}
          />

          <div className="space-y-1.5">
            <Label htmlFor="nova-versao-nome">Nome do documento</Label>
            <Input
              id="nova-versao-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome exibido na Central"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nova-versao-descricao">Descrição / motivo</Label>
            <Textarea
              id="nova-versao-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que mudou nesta versão?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={() => void enviar()} disabled={salvando || !file} className="gap-1.5">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
            {salvando ? "Enviando..." : "Criar nova versão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
