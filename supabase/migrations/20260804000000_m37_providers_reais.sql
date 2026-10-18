-- M37 — Providers Plugáveis para Prospecção Real
-- Adiciona configuração de providers na estratégia JSONB

-- Atualiza estratégia existente com configuração padrão de providers
UPDATE comercial_hunter_config
SET estrategia = estrategia || '{
  "providers": {
    "ordem": ["manual", "mock", "catalogo", "social_assistido", "web_search", "google_maps"],
    "manual": { "ativo": true },
    "mock": { "ativo": false },
    "web_search": { "ativo": false, "provider": "serpapi", "api_key_secret": "SERPAPI_KEY" },
    "google_maps": { "ativo": false, "api_key_secret": "GOOGLE_MAPS_API_KEY" },
    "catalogos": { "ativo": true, "fontes": [] },
    "social_assistido": { "ativo": true, "redes": ["linkedin", "instagram", "facebook"] }
  }
}'::jsonb
WHERE NOT (estrategia ? 'providers');

-- Adiciona status confianca_baixa ao enum hunter_status_resultado se nao existir
DO $$ BEGIN
  ALTER TYPE hunter_status_resultado ADD VALUE 'confianca_baixa';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
