import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Image,
  Camera,
  Trash2,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  value: string | null;
  onChange: (url: string) => void;
  onRemove?: () => void;
  label: string;
  accept?: string;
  capture?: "user" | "environment";
  aspectRatio?: "square" | "portrait" | "landscape";
  maxSize?: number;
}

function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

export default function UploadZone({
  value,
  onChange,
  onRemove,
  label,
  accept = "image/*",
  capture,
  aspectRatio = "square",
  maxSize = 5,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.type.startsWith("image/")) {
        setError("Apenas imagens são permitidas");
        return;
      }

      if (file.size > maxSize * 1024 * 1024) {
        setError(`Imagem muito grande (máx ${maxSize}MB)`);
        return;
      }

      setLoading(true);
      try {
        const compressed = await compressImage(file);
        onChange(compressed);
      } catch {
        setError("Erro ao processar imagem");
      } finally {
        setLoading(false);
      }
    },
    [onChange, maxSize]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "portrait"
      ? "aspect-[3/4]"
      : "aspect-[4/3]";

  if (value) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "relative rounded-2xl overflow-hidden bg-muted border-2 border-border group",
          aspectClass
        )}
      >
        <img
          src={value}
          alt={label}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
          >
            <Camera className="w-5 h-5 text-gray-900" />
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("");
              onRemove?.();
            }}
            className="w-10 h-10 rounded-full bg-red-500/90 flex items-center justify-center hover:bg-red-500 transition-colors"
          >
            <Trash2 className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="absolute top-2 right-2">
          <CheckCircle2 className="w-5 h-5 text-green-500 drop-shadow-md" />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          capture={capture}
          onChange={handleInput}
          className="hidden"
        />
      </motion.div>
    );
  }

  return (
    <div>
      <motion.button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative w-full rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 p-6",
          aspectClass,
          dragOver
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          error && "border-destructive bg-destructive/5"
        )}
      >
        {loading ? (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground">
              Comprimindo imagem...
            </span>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Arraste ou clique para enviar
              </p>
              <p className="text-xs text-muted-foreground">
                PNG ou JPG até {maxSize}MB
              </p>
            </div>
            {navigator?.mediaDevices?.getUserMedia && (
              <div className="flex items-center gap-1 text-xs text-primary mt-1">
                <Camera className="w-3 h-3" />
                Usar câmera
              </div>
            )}
          </>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-destructive flex items-center gap-1 absolute bottom-3"
          >
            <X className="w-3 h-3" />
            {error}
          </motion.p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          capture={capture}
          onChange={handleInput}
          className="hidden"
        />
      </motion.button>
    </div>
  );
}
