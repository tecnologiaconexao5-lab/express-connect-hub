import type { HunterProvider } from "./HunterProvider";
import { mockProvider } from "./MockProvider";
import { manualProvider } from "./ManualProvider";
import { webSearchProvider } from "./WebSearchProvider";
import { googleMapsProvider } from "./GoogleMapsProvider";
import { siteCatalogProvider } from "./SiteCatalogProvider";
import { socialAssistidoProvider } from "./SocialAssistidoProvider";

const PROVIDERS = new Map<string, HunterProvider>([
  [mockProvider.id, mockProvider],
  [manualProvider.id, manualProvider],
  [webSearchProvider.id, webSearchProvider],
  [googleMapsProvider.id, googleMapsProvider],
  [siteCatalogProvider.id, siteCatalogProvider],
  [socialAssistidoProvider.id, socialAssistidoProvider],
]);

export const providerRegistry = {
  getProvider(id: string): HunterProvider | undefined {
    return PROVIDERS.get(id);
  },

  listarProviders(): HunterProvider[] {
    return Array.from(PROVIDERS.values());
  },

  listarAtivos(providerConfig?: Record<string, { ativo: boolean }>): HunterProvider[] {
    const todos = this.listarProviders();
    if (!providerConfig) return todos.filter(p => p.ativo);
    return todos.filter(p => {
      const cfg = providerConfig[p.id];
      if (cfg === undefined) return p.ativo;
      return cfg.ativo !== false;
    });
  },

  listarPorOrdem(ordem: string[], providerConfig?: Record<string, { ativo: boolean }>): HunterProvider[] {
    const ativos = this.listarAtivos(providerConfig);
    const mapa = new Map(ativos.map(p => [p.id, p]));
    const ordenados: HunterProvider[] = [];
    for (const id of ordem) {
      const p = mapa.get(id);
      if (p) { ordenados.push(p); mapa.delete(id); }
    }
    ordenados.push(...mapa.values());
    return ordenados;
  },

  obterManualProvider() { return manualProvider; },
};
