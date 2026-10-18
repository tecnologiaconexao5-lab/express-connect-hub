-- FASE P2C — Atualiza credenciais do conector Zoho Mail para OAuth2 oficial
-- Remove referências a API Key (VITE_ZOHO_EMAIL_API_KEY)
-- Adiciona referências a OAuth2 (VITE_ZOHO_CLIENT_ID, VITE_ZOHO_CLIENT_SECRET, etc.)

UPDATE ia_conectores
SET
  credenciais = jsonb_build_object(
    'env_var_client_id', 'VITE_ZOHO_CLIENT_ID',
    'env_var_client_secret', 'VITE_ZOHO_CLIENT_SECRET',
    'env_var_refresh_token', 'VITE_ZOHO_REFRESH_TOKEN',
    'env_var_account_id', 'VITE_ZOHO_ACCOUNT_ID',
    'env_var_data_center', 'VITE_ZOHO_DATA_CENTER',
    'env_var_from', 'VITE_ZOHO_EMAIL_FROM'
  ),
  config_default = jsonb_set(
    COALESCE(config_default, '{}'::jsonb),
    '{oauth2}',
    '{"auth_url": "https://accounts.zoho.com/oauth/v2/token", "scope": "ZohoMail.messages.CREATE,ZohoMail.accounts.READ"}'::jsonb
  )
WHERE codigo_unico = 'CON_ZOHO_EMAIL';
