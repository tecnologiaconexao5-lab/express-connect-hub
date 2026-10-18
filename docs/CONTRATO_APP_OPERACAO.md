# Contrato de Dados — App Motorista ↔ TMS/Supabase

**Missão:** 127-E.1-TMS / 127-E.1-TMS-B  
**Data:** 2026-07-15  
**Status:** ✅ Migration aplicada e comprovada no Supabase TMS (2026-07-15)  
**View:** 85 colunas (vs. 67 anteriores)  
**RPC:** SECURITY DEFINER + auth.uid() validation  
**Migração:** `supabase/migrations/20260715_m127e1_tms_contrato_app_operacao.sql`

---

## Visão Geral

O TMS (via Supabase) expõe os dados da operação para o Aplicativo do Motorista
através de **dois contratos idênticos**:

| Contrato | Tipo | Descrição |
|----------|------|-----------|
| `vw_app_motorista_operacoes` | View SQL | Consulta direta via `supabase.from('vw_app_motorista_operacoes').select('*')` |
| `f_buscar_operacoes_motorista(p_prestador_id, p_status, p_limit, p_offset)` | RPC (JSONB) | Consulta paginada via `supabase.rpc('f_buscar_operacoes_motorista', {...})` |

Ambos retornam **exatamente os mesmos campos** (a RPC SELECT * FROM a view).

---

## Campos do Contrato

### Identificação da Operação

| Campo | Tipo | Nullable | Fonte | Descrição |
|-------|------|----------|-------|-----------|
| `alocacao_id` | UUID | NO | `alocacoes_escala.id` | ID único da alocação |
| `os_id` | UUID | NO | `alocacoes_escala.ordem_servico_id` | ID da OS vinculada |
| `os_numero` | TEXT | NO | `ordens_servico.numero` | Número da OS (ex: OS-202607-938413) |
| `romaneio` | TEXT | YES | `ordens_servico.romaneio` | Número do romaneio/lote (Missão 127-E.1) |
| `cliente_id` | UUID | YES | `alocacoes_escala.cliente_id` | ID do cliente |
| `cliente_nome` | TEXT | YES | `clientes.nome_fantasia` | Nome fantasia do cliente |
| `cliente_razao_social` | TEXT | YES | `clientes.razao_social` | Razão social do cliente |
| `cliente_telefone` | TEXT | YES | `clientes.telefone` | Telefone do cliente |
| `cliente_cidade` | TEXT | YES | `clientes.cidade` | Cidade do cliente |
| `cliente_uf` | TEXT | YES | `clientes.uf` | UF do cliente |
| `status` | TEXT | NO | `alocacoes_escala.status` | Status da alocação (planejada, aceita, em_rota, etc.) |
| `operation_mode` | TEXT | NO | Computado | Modo de operação: `standard_delivery`, `multi_stop_route`, `reverse_logistics` |
| `tipo_operacao` | TEXT | YES | `ordens_servico.tipo_operacao` | Tipo de operação |
| `prioridade` | TEXT | YES | `ordens_servico.prioridade` | Prioridade (normal, alta, urgente) |

### Origem / Destino / Datas

| Campo | Tipo | Nullable | Fonte | Descrição |
|-------|------|----------|-------|-----------|
| `origem` | TEXT | YES | `alocacoes_escala.origem` | Origem da operação |
| `destino` | TEXT | YES | `alocacoes_escala.destino` | Destino da operação |
| `data_escala` | DATE | NO | `alocacoes_escala.data_escala` | Data da escala |
| `horario_previsto` | TIMESTAMPTZ | YES | `rotas.horario_previsto` | Horário previsto (da rota) |
| `horario_inicio_real` | TIMESTAMPTZ | YES | `alocacoes_escala.horario_inicio_real` | Horário real de início |
| `horario_fim_real` | TIMESTAMPTZ | YES | `alocacoes_escala.horario_fim_real` | Horário real de fim |
| `tempo_total_minutos` | INTEGER | YES | `alocacoes_escala.tempo_total_minutos` | Tempo total em minutos |
| `data_aceite` | TIMESTAMPTZ | YES | `alocacoes_escala.data_aceite` | Data/hora do aceite |

### Veículo

| Campo | Tipo | Nullable | Fonte | Descrição |
|-------|------|----------|-------|-----------|
| `veiculo_id` | UUID | YES | `veiculos.id` (JOIN por placa+prestador) | ID do veículo na tabela veiculos |
| `tipo_veiculo` | TEXT | NO | `alocacoes_escala.tipo_veiculo` | Tipo do veículo (VUC, Truck, Van, etc.) |
| `veiculo_placa` | TEXT | YES | `alocacoes_escala.placa` | Placa do veículo |
| `veiculo_origem` | TEXT | YES | Computado | Origem do dado: `prestador_fallback` ou null |

**Prioridade da fonte do veículo:**
1. Veículo explicitamente vinculado à alocação → `veiculo_id` (JOIN)
2. Veículo do prestador (fallback por placa) → `veiculo_id`
3. null (sem veículo cadastrado)

### Carga

| Campo | Tipo | Nullable | Fonte | Descrição |
|-------|------|----------|-------|-----------|
| `tipo_carga` | TEXT | YES | `ordens_servico.tipo_carga` | Tipo de carga |
| `carga_tipo` | TEXT | YES | `ordens_servico.carga_tipo` | Tipo de carga (campo alternativo) |
| `carga_descricao` | TEXT | YES | `ordens_servico.carga_descricao` | Descrição da carga |
| `carga_refrigerada` | BOOLEAN | NO | `ordens_servico.carga_refrigerada` | Se a carga é refrigerada |
| `volumes` | INTEGER | NO | `ordens_servico.volumes` | Quantidade de volumes |
| `peso` | NUMERIC | NO | `ordens_servico.peso` | Peso total (kg) |
| `cubagem` | NUMERIC | NO | `ordens_servico.cubagem` | Cubagem total (m³) |
| `pallets` | INTEGER | NO | `ordens_servico.pallets` | Quantidade de pallets |
| `valor_declarado` | NUMERIC | NO | `ordens_servico.valor_declarado` | Valor declarado da carga |

### Motorista / Prestador

| Campo | Tipo | Nullable | Fonte | Descrição |
|-------|------|----------|-------|-----------|
| `motorista_id` | UUID | NO | `alocacoes_escala.prestador_id` | ID do motorista |
| `prestador_id` | UUID | NO | `alocacoes_escala.prestador_id` | ID do prestador (mesmo valor) |
| `motorista_nome` | TEXT | YES | `prestadores.nome_completo` | Nome completo do motorista |
| `prestador_nome` | TEXT | YES | `prestadores.nome_completo` | Nome completo do prestador |
| `prestador_nome_fantasia` | TEXT | YES | `prestadores.nome_fantasia` | Nome fantasia do prestador |
| `motorista_telefone` | TEXT | YES | `prestadores.telefone` | Telefone do motorista |
| `motorista_whatsapp` | TEXT | YES | `prestadores.whatsapp` | WhatsApp do motorista |

### Financeiro (apenas o que o prestador pode ver)

| Campo | Tipo | Nullable | Fonte | Descrição |
|-------|------|----------|-------|-----------|
| `valor_repasse` | NUMERIC | NO | `alocacoes_escala.valor_repasse` | Valor de repasse ao prestador |
| `valor_frete` | NUMERIC | NO | `alocacoes_escala.valor_frete` | Valor do frete (pode ser exposto) |
| `km_previstos` | NUMERIC | NO | `alocacoes_escala.km_previstos` | KM previstos |
| `km_realizados` | NUMERIC | YES | `alocacoes_escala.km_realizados` | KM realizados |
| `aceite_prestador` | BOOLEAN | YES | `alocacoes_escala.aceite_prestador` | Indica se o prestador aceitou |

### Rota / Multiparadas

| Campo | Tipo | Nullable | Fonte | Descrição |
|-------|------|----------|-------|-----------|
| `rota_id` | UUID | YES | `rotas.id` | ID da rota vinculada |
| `rota_nome` | TEXT | YES | `rotas.nome` | Nome da rota |
| `rota_status` | TEXT | YES | `rotas.status` | Status da rota |
| `rota_distancia_km` | NUMERIC | YES | `rotas.distancia_km` | Distância total da rota |
| `rota_operation_mode` | TEXT | YES | `rotas.operation_mode` | Modo de operação da rota |
| `numero_paradas` | INTEGER | YES | `rotas.numero_paradas` | Número total de paradas |
| `paradas_pendentes` | INTEGER | YES | `rotas.paradas_pendentes` | Paradas pendentes (campo da rota) |
| `paradas_pendentes_count` | INTEGER | YES | `COUNT(rota_paradas WHERE pendente)` | Paradas pendentes (tempo real) |

### Coleta Reversa

| Campo | Tipo | Nullable | Fonte | Descrição |
|-------|------|----------|-------|-----------|
| `possui_reversa` | BOOLEAN | NO | Computado | `true` se `tipo_reversa != 'sem_reversa'` |
| `tipo_reversa` | TEXT | NO | `alocacoes_escala.tipo_reversa` | Tipo: sem_reversa, coleta_reversa, devolucao, troca, retorno_cd |
| `reversa_status` | TEXT | YES | `alocacoes_escala.reversa_status` | Status da execução da reversa |
| `reversa_qtd_volumes` | INTEGER | YES | `alocacoes_escala.reversa_qtd_volumes` | Quantidade prevista de volumes |
| `reversa_qtd_coletada` | INTEGER | YES | `alocacoes_escala.reversa_qtd_coletada` | Quantidade coletada |
| `reversa_unidade_cobranca` | TEXT | YES | `alocacoes_escala.reversa_unidade_cobranca` | Unidade de cobrança |
| `reversa_motivo_divergencia` | TEXT | YES | `alocacoes_escala.reversa_motivo_divergencia` | Motivo de divergência |
| `reversa_responsavel` | TEXT | YES | `alocacoes_escala.reversa_responsavel` | Responsável pela reversa |
| `reversa_telefone` | TEXT | YES | `alocacoes_escala.reversa_telefone` | Telefone do responsável |
| `reversa_data_prevista` | DATE | YES | `alocacoes_escala.reversa_data_prevista` | Data prevista |
| `reversa_observacoes` | TEXT | YES | `alocacoes_escala.reversa_observacoes` | Observações |
| `reversa_endereco_coleta` | TEXT | YES | `alocacoes_escala.reversa_endereco_coleta` | Endereço de coleta |
| `reversa_endereco_devolucao` | TEXT | YES | `alocacoes_escala.reversa_endereco_devolucao` | Endereço de devolução |
| `reversa_valor_prestador` | NUMERIC | YES | `alocacoes_escala.reversa_valor_prestador` | Valor do prestador na reversa |
| `reversa_pod_url` | TEXT | YES | `alocacoes_escala.reversa_pod_url` | URL do POD da reversa |
| `reversa_fotos` | JSONB | YES | `alocacoes_escala.reversa_fotos` | Fotos da reversa |
| `reversa_realizada_em` | TIMESTAMPTZ | YES | `alocacoes_escala.reversa_realizada_em` | Data/hora da realização |
| `reversa_assinatura_url` | TEXT | YES | `alocacoes_escala.reversa_assinatura_url` | URL da assinatura |

### Observações

| Campo | Tipo | Nullable | Fonte | Descrição |
|-------|------|----------|-------|-----------|
| `observacoes` | TEXT | YES | `alocacoes_escala.observacoes` | Observações da alocação |
| `instrucoes_operacionais` | TEXT | YES | `alocacoes_escala.instrucoes_operacionais` | Instruções operacionais |
| `instrucoes_operacionais_os` | TEXT | YES | `ordens_servico.instrucoes_operacionais_os` | Instruções da OS |
| `enderecos` | JSONB | YES | `ordens_servico.enderecos` | Endereços adicionais |
| `metadata` | JSONB | YES | `alocacoes_escala.metadata` | Metadados flexíveis |

### Tracking (tempo real)

| Campo | Tipo | Nullable | Fonte | Descrição |
|-------|------|----------|-------|-----------|
| `latitude` | NUMERIC | YES | `portal_tracking_realtime.latitude` | Latitude atual |
| `longitude` | NUMERIC | YES | `portal_tracking_realtime.longitude` | Longitude atual |
| `velocidade` | NUMERIC | YES | `portal_tracking_realtime.velocidade` | Velocidade atual |
| `ultima_atualizacao` | TIMESTAMPTZ | YES | `portal_tracking_realtime.updated_at` | Última atualização |

---

## Campos Proibidos (NÃO expor ao prestador)

| Campo | Motivo |
|-------|--------|
| `reversa_valor_cliente` | Valor do cliente — financeiro interno |
| `valor_cliente` | Valor do cliente na OS — financeiro interno |
| `custo_prestador` | Custo interno |
| `margem` | Margem da operação |
| `adicionais` (composição) | Detalhamento financeiro interno |
| `descontos` (composição) | Detalhamento financeiro interno |
| `pedagio` | Custo interno |

---

## Exemplos

### Exemplo 1 — Operação simples

```json
{
  "alocacao_id": "1e9b311e-c701-4469-8f8e-ed99b9cd9a73",
  "os_numero": "OS-202607-938413",
  "cliente_nome": "Transportadora ABC Ltda",
  "status": "aguardando_aceite",
  "origem": "Rua das Flores, 100 - SP",
  "destino": "Av. Paulista, 1000 - SP",
  "tipo_veiculo": "VUC",
  "veiculo_placa": "ABC-1234",
  "motorista_nome": "João Silva",
  "prestador_nome": "João Silva ME",
  "tipo_carga": "caixas",
  "volumes": 50,
  "peso": 500.00,
  "cubagem": 10.50,
  "possui_reversa": false,
  "tipo_reversa": "sem_reversa",
  "valor_repasse": 350.00,
  "numero_paradas": 3,
  "paradas_pendentes": 3,
  "operation_mode": "standard_delivery"
}
```

### Exemplo 2 — Operação com reversa

```json
{
  "alocacao_id": "abc-123",
  "os_numero": "OS-202607-999999",
  "possui_reversa": true,
  "tipo_reversa": "coleta_reversa",
  "reversa_endereco_coleta": "Rua das Palmeiras, 200 - SP",
  "reversa_qtd_volumes": 10,
  "reversa_valor_prestador": 80.00,
  "reversa_status": "pendente",
  "valor_repasse": 430.00,
  "operation_mode": "reverse_logistics"
}
```

### Exemplo 3 — Operação multiparadas

```json
{
  "alocacao_id": "def-456",
  "rota_id": "rota-uuid-abc",
  "rota_nome": "Rota Zona Sul",
  "numero_paradas": 8,
  "paradas_pendentes": 5,
  "paradas_pendentes_count": 5,
  "rota_operation_mode": "multi_stop_route",
  "operation_mode": "multi_stop_route"
}
```

---

## RPC — f_buscar_operacoes_motorista

### Assinatura

```sql
f_buscar_operacoes_motorista(
  p_prestador_id UUID,        -- ID do prestador (obrigatório)
  p_status TEXT DEFAULT NULL,  -- Filtro por status (opcional)
  p_limit INTEGER DEFAULT 50,  -- Limite de registros
  p_offset INTEGER DEFAULT 0   -- Offset para paginação
) RETURNS JSONB
```

### Retorno

```json
{
  "sucesso": true,
  "prestador_id": "e6646799-...",
  "operacoes": [ /* array de operações — mesmos campos da view */ ],
  "total": 42
}
```

### Exemplo de chamada (Flutter/Dart)

```dart
final response = await supabase.rpc('f_buscar_operacoes_motorista', params: {
  'p_prestador_id': prestadorId,
  'p_status': null,
  'p_limit': 50,
  'p_offset': 0,
});
final data = response.data;
// data.sucesso, data.operacoes[], data.total
```

### Exemplo de chamada (JS/TS)

```ts
const { data, error } = await supabase.rpc('f_buscar_operacoes_motorista', {
  p_prestador_id: prestadorId,
  p_status: null,
  p_limit: 50,
  p_offset: 0,
});
// data.sucesso, data.operacoes[], data.total
```

---

## Segurança

### View `vw_app_motorista_operacoes`
- A view não tem filtro de prestador embutido.
- O filtro deve ser aplicado no `WHERE` da consulta:
  ```sql
  SELECT * FROM vw_app_motorista_operacoes WHERE prestador_id = '...';
  ```
- RLS das tabelas base se aplicam.

### RPC `f_buscar_operacoes_motorista`
- `SECURITY DEFINER`: executa com privilégios do definidor.
- Valida `auth.uid()`: verifica se o usuário autenticado é o proprietário do prestador (`prestadores.auth_user_id`).
- Filtra estritamente por `p_prestador_id`: motorista vê apenas suas operações.
- Se `prestadores.auth_user_id` for nulo (prestador legado), a validação é ignorada para compatibilidade.

### Regras de isolamento
1. Motorista não vê operação de outro prestador (filtro `prestador_id`)
2. Prestador não vê valor do cliente (`reversa_valor_cliente` removido)
3. Prestador não vê margem da operação
4. Tenant A não vê tenant B (RLS das tabelas base)
5. `anon` não acessa dados privados (RPC requer `authenticated`)

---

## Migração

**Arquivo:** `supabase/migrations/20260715_m127e1_tms_contrato_app_operacao.sql`

### O que a migration faz

1. **ALTER TABLE ordens_servico** — adiciona coluna `romaneio TEXT`
2. **CREATE OR REPLACE VIEW vw_app_motorista_operacoes** — versão completa com:
   - JOIN com `prestadores` (motorista_nome, prestador_nome)
   - JOIN com `veiculos` (veiculo_id)
   - Campo `possui_reversa` (booleano)
   - Campo `horario_previsto` (da rota)
   - Campo `paradas_pendentes_count` (tempo real)
   - Campo `romaneio` (da OS)
   - Restauração de `observacoes` (removido na M116)
3. **CREATE OR REPLACE FUNCTION f_buscar_operacoes_motorista** — reescrita para SELECT * FROM view + auth.uid()

### Grants
- View: `GRANT SELECT TO anon, authenticated`
- RPC: `GRANT EXECUTE TO authenticated`

---

## Histórico

| Data | Versão | Descrição |
|------|--------|-----------|
| 2026-07-13 | M111 | Criação inicial da view + RPC |
| 2026-07-13 | M116 | Remoção reversa_valor_cliente, adição reversa_qtd_coletada, reversa_endereco_* |
| **2026-07-15** | **M127-E.1** | **Contrato oficial: veiculo_id, motorista_nome, prestador_nome, possui_reversa, romaneio, horario_previsto, paradas_pendentes_count, auth.uid()** |
| **2026-07-15** | **M127-E.1-B** | **Aplicada e comprovada. View: 67→85 colunas. RPC: SECURITY DEFINER + auth.uid(). Dados reais OK.** |
