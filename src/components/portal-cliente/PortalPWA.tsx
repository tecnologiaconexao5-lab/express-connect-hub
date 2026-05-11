import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PortalPWAProps {
  onInstall?: () => void;
}

export function PortalPWA({ onInstall }: PortalPWAProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const hasInstalled = localStorage.getItem("portal-pwa-installed");

    if (isMobile && !hasInstalled) {
      const handler = (e: Event) => {
        setDeferredPrompt(e);
        setShowBanner(true);
      };

      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      localStorage.setItem("portal-pwa-installed", "true");
      onInstall?.();
    }

    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="bg-white border-[#E5E7EB] rounded-xl p-4 shadow-lg flex items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#F97316] flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#111827]">Instale o Portal Cliente</p>
            <p className="text-xs text-[#64748B]">Acesse rapidamente como um app</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-[#F97316] hover:bg-[#EA580C] text-white"
            onClick={handleInstall}
          >
            <Download className="w-4 h-4 mr-1" />
            Instalar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-[#64748B] hover:text-[#111827]"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    setIsInstalled(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  return { isInstalled, isMobile };
}