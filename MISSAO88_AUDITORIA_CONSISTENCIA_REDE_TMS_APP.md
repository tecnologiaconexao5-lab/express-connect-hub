# MISSÃO 88 — AUDITORIA DE CONSISTÊNCIA DA REDE ENTRE TMS E APP MOTORISTA

**Data:** 2026-07-05
**Status:** ✅ Auditoria concluída. Zero duplicidades encontradas.

---

## Resumo Executivo

A auditoria revelou que **não há duplicidade** entre a implementação da Rede no TMS e no App Motorista. 

**Motivo principal:** Missão 87 **não foi implementada.** Não existe código no repositório que implemente a Rede via `alocacoes_escala.tipo_alocacao = 'rede'`, `listar_oportunidades_rede`, ou `aceitar_oportunidade_rede` no App.

A única implementação existente da Rede é a das **Missões 84-86**, que usa exclusivamente `rede_oportunidades` como tabela oficial.

---

## Mapa das Tabelas da Rede

### Tabela Oficial: `rede_oportunidades`

| Coluna | Tipo | Uso |
|--------|------|-----|
| `id` | UUID PK | Identificador único |
| `os_id` | UUID FK → `ordens_servico` | **UNIQUE** — 1 oportunidade por OS |
| `status` | ENUM | `publicada`, `visualizada`, `interessada`, `aceita`, `expirada`, `cancelada` |
| `prestador_aceite_id` | UUID FK → `prestadores` | Prestador que aceitou |
| `valor_prestador` | NUMERIC(12,2) | Valor do Engine de Precificação |
| `veiculo_necessario` | JSONB | Veículo exigido |
| `regiao` | TEXT | Região da operação |
| `prazo_expiracao` | TIMESTAMPTZ | Expiração automática |

**Criada por:** `supabase/migrations/20260705_m84_rede_enterprise_prestadores.sql` (M84)

### Tabela Auxiliar: `rede_visualizacoes`

| Coluna | Tipo | Uso |
|--------|------|-----|
| `id` | UUID PK | Identificador |
| `oportunidade_id` | UUID FK → `rede_oportunidades` | Oportunidade visualizada |
| `prestador_id` | UUID FK → `prestadores` | Prestador |
| `status` | TEXT | `visualizada` ou `interessada` |
| UNIQUE | (oportunidade_id, prestador_id) | 1 registro por prestador |

### Tabelas que NÃO existem no schema real

| Tabela | Status | Observação |
|--------|--------|------------|
| `alocacoes_escala.tipo_alocacao` = `'rede'` | ❌ **Não existe** | Coluna `tipo_alocacao` não existe em nenhuma tabela |
| `alocacoes_escala.status` = `'disponivel_rede'` | ❌ **Não existe** | CHECK de `alocacoes_escala.status` não inclui este valor |
| `veiculos_prestadores` | ❌ **Não existe** | Schema prevê mas Supabase real não tem |
| `prestador_candidaturas` | ❌ **Não existe** | Schema morto em `app_prestador_schema.sql` |
| `prestador_disponibilidade` | ❌ **Não existe** | Schema morto |
| `prestador_notificacoes` | ❌ **Não existe** | Schema morto |
| `prestador_engajamento` | ❌ **Não existe** | Schema morto |

---

## Mapa das RPCs da Rede

| RPC | Tabelas Acessadas | Uso | Status |
|-----|-------------------|-----|--------|
| `f_buscar_prestadores_compativeis(p_oportunidade_id)` | `rede_oportunidades`, `prestadores`, `veiculos` | Listar compatíveis | ✅ **Única** |
| `f_aceitar_oportunidade_rede(p_oportunidade_id, p_prestador_id)` | `rede_oportunidades`, `prestadores`, `ordens_servico`, `os_historico`, `rede_visualizacoes` | Aceitar oportunidade | ✅ **Única** |

### RPCs que NÃO existem

| Nome | Status |
|------|--------|
| `listar_oportunidades_rede` | ❌ **Não existe** |
| `aceitar_oportunidade_rede` (versão App) | ❌ **Não existe** (há apenas a RPC do banco) |

---

## Respostas às 10 Perguntas da Auditoria

### 1. Qual tabela é a fonte oficial da oportunidade da Rede?
**`rede_oportunidades`** é a ÚNICA fonte oficial. Missões 84-86 estabeleceram esta tabela como o registro central de oportunidades. Não há nenhuma outra tabela concorrente.

### 2. `rede_oportunidades` ainda é usada?
**Sim.** Ativamente. 
- Migration M84 → cria a tabela ✅
- `redePrestadoresService.ts` → 10 métodos a consultam ✅
- `OrdemServicoForm.tsx` → UI publica e monitora ✅
- `scripts/m85_validar_rede.ts` → valida fluxo real ✅
- Supabase Realtime → publicada para subscriptions ✅

### 3. `alocacoes_escala` virou a fonte oficial?
**Não.** A coluna `tipo_alocacao` não existe no schema. O valor `'rede'` não aparece em nenhum arquivo do repositório. `alocacoes_escala` continua sendo usada exclusivamente para a escala operacional tradicional (criada via `sincronizarComEscala` após o aceite da Rede).

### 4. O botão "Enviar para Rede" do TMS grava onde?
**Em `rede_oportunidades`**, via `redePrestadoresService.publicarOportunidade()`.
- O handler `handleEnviarParaRede()` em `OrdemServicoForm.tsx:601` chama `publicarOportunidade()`
- Que faz `INSERT INTO rede_oportunidades (os_id, valor_prestador, ...)`
- Atualiza `ordens_servico.status` para `'pendente'`
- Registra `os_historico` com "OS enviada para Rede de Prestadores"

### 5. O App Motorista lista oportunidades de onde?
**O App Motorista (Flutter PWA) não está implementado neste repositório.** 
- `appPrestadorService.ts` (594 linhas) é código **morto** — zero callers
- `AppPrestador.tsx` (692 linhas) é uma tela administrativa do TMS, **não o app real**
- A função `listarOportunidadesParaPrestador()` no `redePrestadoresService.ts` foi criada especificamente para ser o endpoint que o App consumiria, mas **nunca foi conectada**

### 6. O aceite do App atualiza a mesma OS criada pelo TMS?
**Sim, via RPC `f_aceitar_oportunidade_rede()`.** Esta RPC:
1. Lê `rede_oportunidades` com `SELECT ... FOR UPDATE` (race condition)
2. Valida status da oportunidade e do prestador
3. **Atualiza `ordens_servico`** com `prestador_id` e `status = 'agendada'`
4. Registra em `os_historico`
5. Remove visualizações de outros prestadores

Tudo atômico na mesma transação. A OS é a mesma criada pelo TMS.

### 7. O Portal Cliente acompanha o mesmo status?
**Sim.** O Portal Cliente (`mapStatusCliente()` em `PortalCliente.tsx:117`) lê o status da `ordens_servico` ou `alocacoes_escala`. Como o aceite da Rede atualiza a OS (resposta #6), o Portal automaticamente reflete:
| OS Status | Portal Label |
|-----------|-------------|
| pendente | "Pedido recebido" |
| agendada | "Operação confirmada" |
| em_andamento | "Em distribuição" |
| finalizada | "Entrega concluída" |

### 8. O Financeiro continua sem duplicidade?
**Sim.** Triggers M66/M80 continuam sendo os únicos pontos de propagação financeira:
- `sincronizarComEscala()` → cria/atualiza `alocacoes_escala` → trigger M66
- Trigger M80 também atua diretamente sobre `ordens_servico`
- Ambos com `ON CONFLICT (os_id) DO UPDATE` — sem duplicidade

### 9. Existe alguma RPC duplicada com nome/função parecida?
**Não.** A auditoria encontrou apenas 2 RPCs relacionadas à Rede:
| RPC | Localização |
|-----|-------------|
| `f_buscar_prestadores_compativeis` | Migration M84, linha 158 |
| `f_aceitar_oportunidade_rede` | Migration M84, linha 246 |

Nenhuma RPC com nome similar existe em nenhuma outra migration, service ou schema.

### 10. Existe risco de oportunidade aparecer no TMS e não aparecer no App?
**Não há App implementado para comparar.** O risco real é o oposto:
- **Oportunidade criada no TMS** (`rede_oportunidades`) → visível no Supabase Realtime
- **App Motorista (futuro)** → precisa consumir via Realtime ou REST
- **Se o App não for implementado**, a oportunidade existe no banco mas ninguém a vê

**Risco atual:** A Rede funciona no TMS (publicar, compatíveis, painel) mas **não há consumidor** (App Motorista) para receber as oportunidades.

---

## Fluxo Arquitetural Atual

```
┌─────────────────────────────────────────────────────────────────┐
│                       TMS (este repositório)                     │
│                                                                   │
│  OrdemServicoForm.tsx                                            │
│    ↓ handleEnviarParaRede()                                      │
│    ↓ redePrestadoresService.publicarOportunidade()               │
│    ┌─────────────────────┐                                       │
│    │  rede_oportunidades  │──→ os_historico (timeline)           │
│    │  (fonte oficial)     │──→ ordens_servico (status)           │
│    └──────────┬──────────┘                                       │
│               │                                                   │
│               ├── f_buscar_prestadores_compativeis()              │
│               │     → prestadores + veiculos (LEFT JOIN)         │
│               │     → score matching (6 critérios)               │
│               │                                                  │
│               └── f_aceitar_oportunidade_rede()                  │
│                     → UPDATE ordens_servico (prestador_id)        │
│                     → sincronizarComEscala()                      │
│                     → gerarLinkRastreio()                         │
│                     → Triggers M66/M80 (financeiro)              │
│                                                                   │
│  [App Motorista Flutter] → NÃO IMPLEMENTADO                      │
│  (futuro: Subscribe Realtime + RPC calls)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Duplicidades Encontradas

**Resultado: NENHUMA DUPLICIDADE.**

| Par Concorrente | Situação | Conclusão |
|----------------|----------|-----------|
| `rede_oportunidades` vs `alocacoes_escala.tipo_alocacao='rede'` | `tipo_alocacao` não existe | ✅ Sem conflito |
| RPC `f_aceitar_oportunidade_rede` vs função `aceitar_oportunidade_rede` no App | App não implementado | ✅ Sem conflito |
| `redePrestadoresService.ts` vs `appPrestadorService.ts` | `appPrestadorService` é 100% morto | ✅ Sem conflito |
| `rede_oportunidades` vs `match_operacoes_prestadores` | `match_operacoes_prestadores` é para recrutamento (pipeline de onboarding) | ✅ Sem conflito |
| `f_buscar_prestadores_compativeis` vs outra RPC de matching | Nenhuma outra RPC de matching existe | ✅ Única |

---

## Código Morto Identificado

| Arquivo | Linhas | Função | Motivo |
|---------|:------:|--------|--------|
| `src/services/appPrestadorService.ts` | 594 | Serviço preparatório do App Motorista | Zero callers em `src/`. M61 já identificou como morto. |
| `src/services/appPrestadorService.ts:391` | 45 | `verificarElegibilidadeRede()` | Nunca chamada. Tabelas que consulta (`prestador_disponibilidade`) não existem. |
| `src/pages/AppPrestador.tsx` | 692 | Tela administrativa "App do Prestador" | É uma emulação TMS, não o app real Flutter. Não tem código de Rede. |

---

## Pendências para Missão 89 (App Motorista Real)

| # | Pendência | Descrição |
|---|-----------|-----------|
| 1 | **Criar Edge Function** `api/rede-oportunidades` | Para o App Flutter consumir via REST (já recomendado na M86) |
| 2 | **Subscribe Realtime** no App | `supabase.from('rede_oportunidades').on('INSERT', ...)` |
| 3 | **Chamar RPC** `f_buscar_prestadores_compativeis` | Filtrar oportunidades compatíveis |
| 4 | **Chamar RPC** `f_aceitar_oportunidade_rede` | Aceitar oportunidade (já existe no banco) |
| 5 | **Nunca expor** valor do cliente, margem ou lucro | Regra de segurança |
| 6 | **Testar** `f_aceitar_oportunidade_rede` com `SECURITY DEFINER` | Adicionar se necessário para anon key |
| 7 | **Remover** `appPrestadorService.ts` | Ou reescrever para usar a arquitetura real da Rede |

---

## Conclusão

A arquitetura da Rede Enterprise está **consistente e sem duplicidade**. 

- **Missões 84-86** implementaram a Rede corretamente com tabela própria (`rede_oportunidades`), RPCs dedicadas, service TypeScript e UI no TMS.
- **Não existe Missão 87.** As referências a `tipo_alocacao='rede'`, `disponivel_rede`, `listar_oportunidades_rede` são de uma especificação que não foi codificada.
- **Risco zero** de duplicidade porque a segunda implementação simplesmente não existe.
- **Próximo passo:** Implementar o App Motorista (Flutter) consumindo a infraestrutura já existente da Rede.
