# Configurar Providers do Hunter

## Acessando a Configuracao

1. Central IA > Hunter Config > Aba "Fontes / Providers"

## Opcoes de Configuracao

### Ordem dos Providers
- Define a sequencia em que os providers sao executados
- Padrao: manual, mock, catalogo, social_assistido, web_search, google_maps

### Provider Manual
- Ativo por padrao
- Permite inserir prospects manualmente via UI
- Ideal para: planilhas, listas compradas, indicacoes, visitas de campo
- Modo de uso: va ate o dashboard e clique em "Adicionar Prospect Manual"

### Provider Mock
- Desativado por padrao
- Apenas para homologacao e testes
- Dados simulados — nunca criar leads reais a partir dele
- Ative APENAS em ambiente de teste

### Provider WebSearch (SerpAPI / Google CSE)
- Desativado por padrao
- Requer chave de API configurada no ambiente
- Configure a secret no Supabase:
  ```bash
  supabase secrets set VITE_SERPAPI_KEY=sua_chave
  ```
  ou no .env:
  ```
  VITE_SERPAPI_KEY=sua_chave
  ```
- Custo estimado: ~$0.01 por consulta (10 resultados)

### Provider Google Maps (Places API)
- Desativado por padrao
- Requer Google Places API ativada no projeto GCP
- Configure a secret:
  ```bash
  supabase secrets set VITE_GOOGLE_MAPS_API_KEY=sua_chave
  ```
- Custo: ~$0.032 por consulta (20 resultados)

### Provider Catalogos
- Ativo por padrao
- Nao requer chave de API
- Sugere fontes de catalogos publicos para o usuario consultar manualmente
- Configure as fontes na UI (campo "Fontes de Catalogos")

### Provider Social Assistido
- Ativo por padrao
- Nao faz scraping de redes sociais
- Apenas sugere buscas no LinkedIn, Instagram e Facebook para o usuario fazer manualmente
- Configure as redes ativas na UI

## Como Ativar um Provider

1. Va ate a aba "Fontes / Providers"
2. Ative o provider desejado (Switch)
3. Configure os parametros necessarios
4. Clique em "Salvar Estrategia"
5. Execute um ciclo para testar

## Como Adicionar Prospects Manualmente

1. Va ate a aba "Comercial IA" (dashboard)
2. Clique em "Adicionar Prospect Manual"
3. Preencha: empresa, cidade, estado, segmento, contato
4. Clique em "Adicionar a Fila"
5. Execute um ciclo para processar a fila
