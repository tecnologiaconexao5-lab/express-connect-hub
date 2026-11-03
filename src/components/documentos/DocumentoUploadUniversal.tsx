import { useRef, useState } from "react";
import { Camera, UploadCloud, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
  accept?: string;
  label?: string;
  hint?: string;
}

/**
 * Dropzone universal. No mobile, oferece câmera nativa (capture=environment)
 * e gerenciador de arquivos. O arquivo é entregue ao chamador (File) e vai
 * direto ao Supabase Storage, sem persistência local intermediária.
 */
export function DocumentoUploadUniversal({
  onFile,
  disabled = false,
  accept = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*",
  label = "Arraste o arquivo aqui ou escolha uma opção",
  hint = "PDF, JPG, PNG ou WEBP · até 50 MB",
}: Props) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const escolher = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => { if (!disabled) arquivoRef.current?.click(); }}
      onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) arquivoRef.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) escolher(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
        dragging ? "border-primary bg-primary/10" : "border-border/60 bg-muted/10 hover:border-primary/50 hover:bg-primary/5",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UploadCloud className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); arquivoRef.current?.click(); }}
        >
          <FileText className="h-4 w-4" /> Escolher arquivo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}
        >
          <Camera className="h-4 w-4" /> Tirar foto
        </Button>
      </div>

      <input
        ref={arquivoRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => { escolher(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => { escolher(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
