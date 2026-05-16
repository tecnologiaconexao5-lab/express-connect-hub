import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, CheckCircle2 } from "lucide-react";

interface SignaturePadProps {
  value: string | null;
  onChange: (dataUrl: string) => void;
}

export default function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0);
      };
      img.src = value;
    }
  }, []);

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      setIsDrawing(true);
      setHasDrawn(true);
    },
    [getPos]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const pos = getPos(e);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111827";
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    },
    [isDrawing, getPos]
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  }, [onChange]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange("");
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Pencil className="w-4 h-4" />
          Assine com o dedo ou mouse
        </div>
        <div className="flex gap-2">
          {hasDrawn && (
            <motion.button
              type="button"
              onClick={saveSignature}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirmar
            </motion.button>
          )}
          <motion.button
            type="button"
            onClick={clearSignature}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:bg-border transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar
          </motion.button>
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border-2 border-border bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full touch-none cursor-crosshair"
          style={{ height: "200px" }}
        />
        {!hasDrawn && !value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-muted-foreground/40 text-lg font-light select-none">
              Assine aqui
            </span>
          </div>
        )}
      </div>

      {value && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-green-600 flex items-center gap-1"
        >
          <CheckCircle2 className="w-3 h-3" />
          Assinatura registrada
        </motion.p>
      )}
    </div>
  );
}
