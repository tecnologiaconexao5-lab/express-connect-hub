import { useState, useEffect } from 'react';

export interface EmpresaConfig {
  logoUrl: string;
  logoDarkUrl: string;
  corPrimaria: string;
  corSecundaria: string;
  nomeFantasia: string;
  logoUsos: {
    telaLogin: boolean;
    sidebar: boolean;
    relatoriosPdf: boolean;
    contratosPdf: boolean;
    recibosPdf: boolean;
    orcamentosPdf: boolean;
    paginaRastreio: boolean;
    emailsAutomaticos: boolean;
  };
}

const DEFAULT_CONFIG: EmpresaConfig = {
  logoUrl: '',
  logoDarkUrl: '',
  corPrimaria: '#F97316',
  corSecundaria: '#0F1A2E',
  nomeFantasia: 'Conexão Express',
  logoUsos: {
    telaLogin: true,
    sidebar: true,
    relatoriosPdf: true,
    contratosPdf: true,
    recibosPdf: true,
    orcamentosPdf: true,
    paginaRastreio: true,
    emailsAutomaticos: false,
  },
};

const STORAGE_KEY = 'empresa_identidade_visual';

export function useLogo() {
  const [config, setConfig] = useState<EmpresaConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      } catch (e) {
        console.error('Erro ao carregar config de logo:', e);
      }
    }
    setLoading(false);
  }, []);

  const saveConfig = (newConfig: Partial<EmpresaConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const getLogo = async (): Promise<string> => {
    if (config.logoUrl) {
      if (config.logoUrl.startsWith('data:')) {
        return config.logoUrl;
      }
      return config.logoUrl;
    }
    return '';
  };

  const shouldShowLogo = (local: keyof EmpresaConfig['logoUsos']): boolean => {
    return config.logoUsos[local] ?? false;
  };

  const getCorPrimaria = (): string => config.corPrimaria;
  const getCorSecundaria = (): string => config.corSecundaria;
  const getNomeFantasia = (): string => config.nomeFantasia;

  return {
    config,
    loading,
    saveConfig,
    getLogo,
    shouldShowLogo,
    getCorPrimaria,
    getCorSecundaria,
    getNomeFantasia,
  };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}
