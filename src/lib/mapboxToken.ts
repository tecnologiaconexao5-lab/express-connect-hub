// Fonte única do token do Mapbox usado por autocomplete, rotas e mapas.
//
// O valor NÃO fica no repositório. Ele é lido de `VITE_MAPBOX_ACCESS_TOKEN`
// (Vercel → Project → Settings → Environment Variables, para Production,
// Preview e Development). O Vite injeta a variável no bundle no build.
//
// Os nomes legados são aceitos como fallback para não quebrar ambientes
// antigos que ainda usem `VITE_MAPBOX_TOKEN`, `MAPBOX_ACCESS_TOKEN` ou
// `MAPBOX_TOKEN`.
const lerToken = (): string =>
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ||
  import.meta.env.VITE_MAPBOX_TOKEN?.trim() ||
  import.meta.env.MAPBOX_ACCESS_TOKEN?.trim() ||
  import.meta.env.MAPBOX_TOKEN?.trim() ||
  "";

/** Leitura do token em tempo de execução (usada pelos serviços). */
export function getMapboxToken(): string | null {
  return lerToken() || null;
}

/**
 * Conveniência para componentes de mapa. Em produção o valor é estável
 * durante toda a sessão; em testes prefira `getMapboxToken()`.
 */
export const MAPBOX_ACCESS_TOKEN = lerToken();
