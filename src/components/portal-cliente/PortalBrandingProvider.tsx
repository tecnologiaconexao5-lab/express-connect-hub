import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { Building2 } from "lucide-react";

interface BrandingConfig {
  logoUrl?: string;
  nomeEmpresa?: string;
  corPrimaria?: string;
  corSecundaria?: string;
  faviconUrl?: string;
}

interface BrandingContextType {
  branding: BrandingConfig;
  setBranding: (config: BrandingConfig) => void;
  isWhiteLabel: boolean;
}

const defaultBranding: BrandingConfig = {
  nomeEmpresa: "Conexão Express",
  corPrimaria: "#f97316",
  corSecundaria: "#475569",
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  setBranding: () => {},
  isWhiteLabel: false,
});

export function useBranding() {
  return useContext(BrandingContext);
}

interface PortalBrandingProviderProps {
  children: ReactNode;
  initialBranding?: BrandingConfig;
}

export function PortalBrandingProvider({ children, initialBranding }: PortalBrandingProviderProps) {
  const [branding, setBrandingState] = useState<BrandingConfig>(initialBranding || defaultBranding);

  const setBranding = (config: Partial<BrandingConfig>) => {
    setBrandingState(prev => ({ ...prev, ...config }));
  };

  const isWhiteLabel = useMemo(() => {
    return !!branding.logoUrl || !!branding.nomeEmpresa && branding.nomeEmpresa !== "Conexão Express";
  }, [branding]);

  const value = useMemo(() => ({
    branding,
    setBranding,
    isWhiteLabel,
  }), [branding, isWhiteLabel]);

  return (
    <BrandingContext.Provider value={value}>
      <div
        style={{
          "--primary": branding.corPrimaria || "#f97316",
          "--secondary": branding.corSecundaria || "#475569",
        } as React.CSSProperties}
      >
        {children}
      </div>
    </BrandingContext.Provider>
  );
}

export function PortalBrandingBadge() {
  const { branding, isWhiteLabel } = useBranding();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFC] rounded-full border border-[#E5E7EB]">
      <Building2 className="w-3.5 h-3.5 text-[#64748B]" />
      <span className="text-[10px] text-[#64748B]">
        {isWhiteLabel ? (
          <>
            <span style={{ color: branding.corPrimaria }}>{branding.nomeEmpresa}</span>
            <span className="mx-1">•</span>
            <span>Powered by Conexão Express</span>
          </>
        ) : (
          "Powered by Conexão Express"
        )}
      </span>
    </div>
  );
}