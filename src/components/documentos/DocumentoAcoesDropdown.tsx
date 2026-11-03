import { useState } from "react";
import {
  MoreVertical,
  Eye,
  Download,
  Share2,
  Sparkles,
  History,
  FilePlus2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  baixarDocumentoMetadata,
  registrarEventoDocumento,
  urlAssinadaDocumentoMetadata,
  type DocumentoMetadata,
} from "@/services/documentos/documentosMetadataService";

interface Props {
  documento: DocumentoMetadata;
  onNovaVersao?: (doc: DocumentoMetadata) => void;
  onAtualizarVersao?: (doc: DocumentoMetadata) => void;
  onAnalisarIA?: (doc: DocumentoMetadata) => void;
  onCompartilhar?: (doc: DocumentoMetadata) => void;
  onHistorico?: (doc: DocumentoMetadata) => void;
  align?: "start" | "end";
}

export function DocumentoAcoesDropdown({
  documento,
  onNovaVersao,
  onAtualizarVersao,
  onAnalisarIA,
  onCompartilhar,
  onHistorico,
  align = "end",
}: Props) {
  const [carregando, setCarregando] = useState<string | null>(null);

  const visualizar = async () => {
    try {
      setCarregando("visualizar");
      const url = await urlAssinadaDocumentoMetadata(documento.url, documento.entidade_id);
      if (!url) {
        toast.error("Não foi possível gerar o link seguro deste documento.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      void registrarEventoDocumento(documento.id, {
        tipo: "visualizacao",
        descricao: "Documento visualizado.",
      });
    } catch {
      toast.error("Erro ao visualizar o documento.");
    } finally {
      setCarregando(null);
    }
  };

  const baixar = async () => {
    try {
      setCarregando("baixar");
      await baixarDocumentoMetadata(documento);
      void registrarEventoDocumento(documento.id, {
        tipo: "download",
        descricao: "Documento baixado.",
      });
    } catch {
      toast.error("Erro ao baixar o documento.");
    } finally {
      setCarregando(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Ações do documento">
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuLabel className="truncate">{documento.nome || documento.tipo || "Documento"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onClick={() => onNovaVersao?.(documento)}>
          <FilePlus2 className="h-4 w-4" /> Adicionar nova versão
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" disabled={carregando === "visualizar"} onClick={() => void visualizar()}>
          <Eye className="h-4 w-4" /> Visualizar
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" disabled={carregando === "baixar"} onClick={() => void baixar()}>
          <Download className="h-4 w-4" /> Baixar
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => onCompartilhar?.(documento)}>
          <Share2 className="h-4 w-4" /> Compartilhar Internamente
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => onAnalisarIA?.(documento)}>
          <Sparkles className="h-4 w-4" /> Analisar com IA
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => onHistorico?.(documento)}>
          <History className="h-4 w-4" /> Consultar Histórico
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => onAtualizarVersao?.(documento)}>
          <RefreshCw className="h-4 w-4" /> Atualizar Versão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
