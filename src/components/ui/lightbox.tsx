import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";

export interface LightboxMedia {
  url: string;
  label?: string;
}

interface LightboxProps {
  open: boolean;
  media: LightboxMedia[];
  currentUrl: string | null;
  onUrlChange: (url: string | null) => void;
  onDownload?: (url: string, filename: string) => void;
  getFilename?: (url: string, index: number) => string;
}

/**
 * Lightbox genérico reutilizável — extraído do PortalDrawerPOD (M60/62).
 * Zoom 0.5–5x, rotação 90°, reset 1:1, navegação anterior/próximo e download.
 * Usado pela Central de Comprovantes (TMS) e pelo Portal Cliente.
 */
export function Lightbox({ open, media, currentUrl, onUrlChange, onDownload, getFilename }: LightboxProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotate, setRotate] = useState(0);

  if (!open || !currentUrl) return null;

  const index = media.findIndex((m) => m.url === currentUrl);
  const total = media.length;
  const label = media[index]?.label || "";

  const prev = () => {
    if (total <= 1) return;
    const nextIndex = index > 0 ? index - 1 : total - 1;
    setZoomLevel(1);
    setRotate(0);
    onUrlChange(media[nextIndex].url);
  };

  const next = () => {
    if (total <= 1) return;
    const nextIndex = index < total - 1 ? index + 1 : 0;
    setZoomLevel(1);
    setRotate(0);
    onUrlChange(media[nextIndex].url);
  };

  const download = (url: string) => {
    const filename = getFilename ? getFilename(url, index) : `imagem_${Date.now()}.jpg`;
    if (onDownload) onDownload(url, filename);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center"
        onClick={() => onUrlChange(null)}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-white/80 text-xs font-medium">
                {total > 0 ? index + 1 : "–"} / {total}
              </span>
              <span className="text-white/50 text-[10px]">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  download(currentUrl);
                }}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all"
                title="Baixar"
              >
                <Download className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => onUrlChange(null)}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Image area */}
        <div className="relative flex items-center justify-center w-full h-full px-16">
          {total > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/25 transition-all z-10"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}

          <img
            src={currentUrl}
            alt={label || "Imagem ampliada"}
            className="max-w-[85vw] max-h-[85vh] object-contain transition-transform duration-200 select-none"
            style={{ transform: `scale(${zoomLevel}) rotate(${rotate}deg)` }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />

          {total > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/25 transition-all z-10"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 z-10">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomLevel((z) => Math.max(0.5, z - 0.5));
              }}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-all"
            >
              <Minus className="w-4 h-4 text-white" />
            </button>
            <span className="text-white/70 text-xs font-medium min-w-[60px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomLevel((z) => Math.min(5, z + 0.5));
              }}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-all"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRotate((r) => r + 90);
              }}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-all"
            >
              <RotateCcw className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomLevel(1);
                setRotate(0);
              }}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-all text-[10px] text-white font-bold"
            >
              1:1
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default Lightbox;
