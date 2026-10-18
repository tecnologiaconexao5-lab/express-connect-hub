-- FASE P2 — ETAPA 5: LLM Router por Robô
-- Configura modelo_principal, modelo_secundario e fallback por robô
-- Armazenado no JSONB config.llm já existente em automacoes_robos
-- Nenhum schema novo — apenas seed data

-- Atualiza config.llm dos 8 robôs padrão por setor
UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{llm}',
  '{
    "modelo_principal": "gemini-gemini-1.5-pro",
    "modelo_secundario": "groq-llama3-8b-8192",
    "fallback": "openrouter-openrouter/auto"
  }'::jsonb
)
WHERE setor = 'Comercial';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{llm}',
  '{
    "modelo_principal": "groq-llama3-8b-8192",
    "modelo_secundario": "gemini-gemini-1.5-pro",
    "fallback": "openrouter-openrouter/auto"
  }'::jsonb
)
WHERE setor = 'Operacional';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{llm}',
  '{
    "modelo_principal": "groq-mixtral-8x7b-32768",
    "modelo_secundario": "gemini-gemini-1.5-pro",
    "fallback": "openrouter-openrouter/auto"
  }'::jsonb
)
WHERE setor = 'Recrutamento';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{llm}',
  '{
    "modelo_principal": "gemini-gemini-1.5-pro",
    "modelo_secundario": "groq-llama3-8b-8192",
    "fallback": "openrouter-openrouter/auto"
  }'::jsonb
)
WHERE setor = 'Financeiro';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{llm}',
  '{
    "modelo_principal": "groq-llama3-8b-8192",
    "modelo_secundario": "gemini-gemini-1.5-pro",
    "fallback": "openrouter-openrouter/auto"
  }'::jsonb
)
WHERE setor = 'Fiscal';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{llm}',
  '{
    "modelo_principal": "gemini-gemini-1.5-pro",
    "modelo_secundario": "groq-llama3-8b-8192",
    "fallback": "openrouter-openrouter/auto"
  }'::jsonb
)
WHERE setor = 'Monitoramento';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{llm}',
  '{
    "modelo_principal": "gemini-gemini-1.5-pro",
    "modelo_secundario": "groq-llama3-8b-8192",
    "fallback": "openrouter-openrouter/auto"
  }'::jsonb
)
WHERE setor = 'Cliente';

UPDATE automacoes_robos
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{llm}',
  '{
    "modelo_principal": "groq-llama3-8b-8192",
    "modelo_secundario": "gemini-gemini-1.5-pro",
    "fallback": "openrouter-openrouter/auto"
  }'::jsonb
)
WHERE setor IN ('Prestador', 'Prestador/Motorista');
