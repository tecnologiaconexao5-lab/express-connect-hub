import { useState, useEffect } from 'react';
import { carregarConfiguracaoSistema, salvarConfiguracaoSistema } from '@/services/configuracoesService';

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
    const load = async () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      let initialConfig = DEFAULT_CONFIG;

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          initialConfig = { ...initialConfig, ...parsed };
        } catch (e) {
          console.error('Erro ao carregar config de logo do localStorage:', e);
        }
      }

      try {
        const remote = await carregarConfiguracaoSistema('identidade_visual');
        if (remote && typeof remote === 'object') {
          initialConfig = { ...initialConfig, ...remote };
        }
      } catch (error) {
        console.warn('Não foi possível carregar identidade visual do Supabase, usando localStorage.', error);
      }

      setConfig(initialConfig);
      setLoading(false);
    };

    load();
  }, []);

  const saveConfig = async (newConfig: Partial<EmpresaConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    try {
      await salvarConfiguracaoSistema('identidade_visual', updated);
    } catch (error) {
      console.warn('Não foi possível salvar identidade visual no Supabase:', error);
    }
  };

  const getLogo = async (): Promise<string> => {
    if (config.logoUrl) {
      if (config.logoUrl.startsWith('data:')) {
        return config.logoUrl;
      }
      return config.logoUrl;
    }
    // Fallback para o logo oficial da Conexão Express
    try {
      const response = await fetch('/logo-oficial-conexao.png');
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn("Logo oficial não encontrado:", e);
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
