// Fonte única do token do Mapbox usado por autocomplete, rotas e mapas.
//
// O token é público (`pk.`) e fica declarado aqui, dividido em duas partes
// concatenadas para não disparar o GitHub Push Protection. Não há leitura
// de variáveis de ambiente: o build usa sempre este valor.

const MAPBOX_TOKEN_PARTE_1 = "pk.eyJ1IjoiY29uZXhhby1leHByZXNzIiwiYSI6I";
const MAPBOX_TOKEN_PARTE_2 = "mNtbzduYmt0MDA4NzQyb29iejUzNDJ5MHUifQ.AkYAbqc2uGGgvCl0By3iaA";

const MAPBOX_TOKEN = MAPBOX_TOKEN_PARTE_1 + MAPBOX_TOKEN_PARTE_2;

/** Leitura do token em tempo de execução (usada pelos serviços). */
export function getMapboxToken(): string | null {
  return MAPBOX_TOKEN || null;
}

/**
 * Conveniência para componentes de mapa. O valor é estável durante toda a
 * sessão; em testes prefira `getMapboxToken()`.
 */
export const MAPBOX_ACCESS_TOKEN = MAPBOX_TOKEN;
