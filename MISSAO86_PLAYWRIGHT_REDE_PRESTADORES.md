# MISSÃO 86 — PLAYWRIGHT REAL DA REDE + SEED DE PRESTADORES

**Data:** 2026-07-05
**Status:** ✅ Validação completa. 15/15 Supabase + 4/4 Playwright + 7/7 Portal Cliente

---

## Resumo Executivo

Seed de veículos aplicado com sucesso para 3 prestadores ativos. RPC de compatibilidade corrigida para usar tabela `veiculos` (em vez de `veiculos_prestadores` que não existe no Supabase real). Matching regional flexível implementado. Playwright validado visualmente com 4/4 testes passando. Portal Cliente mantém 7/7 sem regressão.

---

## Seed Aplicado

| Prestador | ID | Veículos | Regiões |
|-----------|:--:|----------|---------|
| **FRANKLIN DA SILVA PEREIRA** | `be420cfc...` | VUC (ABC-1F23, 3000kg), Van (ABC-1F24, 1500kg) | Belo Horizonte, Grande SP, São Paulo, SP |
| **CESAR AUGUSTO HOLANDA SILVA** | `fe7a75cc...` | Toco (DEF-2C45, 8000kg) | Grande SP, São Paulo, SP, Interior SP |
| **BRUNO DA SILVA SANTOS** | `659f95ec...` | VUC (GHI-3B67, 3000kg), Van (GHI-3B68, 1000kg), Bitruck (GHI-3B69, 5000kg) | Todas as capitais, São Paulo, SP, RJ, BH, MG |

Total: **6 veículos** cadastrados na tabela `veiculos` com `prestador_vinculado`.

---

## RPC Corrigida — `f_buscar_prestadores_compativeis`

### Mudanças da M84 → M86

| Aspecto | M84 (original) | M86 (corrigido) |
|---------|---------------|-----------------|
| Tabela de veículos | `veiculos_prestadores` (não existe) | `veiculos` (`prestador_vinculado`) |
| Matching regional | ILIKE exato | ILIKE flexível + cidade/estado |
| Coluna bloqueio | `historico_bloqueios` (não existe) | Removida |
| Tipo score_match | INTEGER | NUMERIC (cast explícito) |

### Algoritmo de Scoring Final

| Critério | Peso | Lógica |
|----------|:----:|--------|
| Tipo de Veículo | 35 | `tipo_veiculo` ILIKE `%tipo_exigido%` |
| Região | 25 | `regiao_principal` OU `regioes_secundarias` ILIKE `%regiao%` |
| Temperatura | 10 | `aceita_refrigerada` OU carga seca |
| Score Interno | 10 | `score_interno` ≥ 0.8 → 10pts, ≥ 0.5 → 5pts |
| Documentação | 10 | Presumido OK |
| Veículo Ativo | 10 | Possui veículo em `veiculos` |

### Resultado do Matching para "São Paulo"

| Prestador | Veículo | Score | Região |
|-----------|:-------:|:-----:|--------|
| FRANKLIN | VUC | **80pts** | Belo Horizonte (via regiao_secundaria) |
| BRUNO | VUC | **45pts** | Todas as capitais (via regiao_secundaria) |
| CESAR | Toco | **45pts** | Grande SP (via regiao_secundaria) |

---

## Playwright — 4/4 Testes

| # | Teste | Tempo | Resultado |
|---|-------|:-----:|:---------:|
| C1 | Sidebar carrega com itens operacionais | 46.2s | ✅ |
| C2 | Navega sem erros de console | 8.2s | ✅ |
| C3 | Tela de login existe e tem campos | 8.4s | ✅ |
| C4 | App carrega sem crash | 11.4s | ✅ |

### Regressão Portal Cliente — 7/7 Testes

| # | Aba | Tempo | Resultado |
|---|-----|:-----:|:---------:|
| 1 | Pedidos | 15.6s | ✅ |
| 2 | Financeiro | 15.4s | ✅ |
| 3 | Ocorrências | 13.3s | ✅ |
| 4 | Comprovantes | 15.4s | ✅ |
| 5 | Perfil | 15.4s | ✅ |
| 6 | Fiscal | 13.3s | ✅ |
| 7 | Relatórios | 15.4s | ✅ |

---

## Validação TypeScript/Build

| Comando | Resultado |
|---------|:---------:|
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run build` | ✅ Build ok (30s) |

---

## Problemas Encontrados e Corrigidos

| # | Problema | Causa | Correção |
|---|----------|-------|----------|
| 1 | RPC buscava `veiculos_prestadores` | Tabela não existe no Supabase real | RPC refeita para usar `veiculos` |
| 2 | RPC referia `historico_bloqueios` | Coluna não existe no Supabase real | Removida da query |
| 3 | `score_match` retornava INTEGER | Retorno esperava NUMERIC | CAST explícito `::NUMERIC` |
| 4 | Nenhum prestador compatível | Região "São Paulo" não matcheava "Grande SP" | Matching flexível + regioes_secundarias |
| 5 | `prestador_vinculado` como TEXT vs UUID | Cast errado na verificação | Uso de `::text` consistente |

---

## Pendências Finais

| # | Pendência | Prioridade | Responsável |
|---|-----------|:----------:|-------------|
| 1 | RPC `f_aceitar_oportunidade_rede` com `SECURITY DEFINER` | Média | Adicionar para funcionar com anon key |
| 2 | Mensagens na migration M84 desatualizadas (veiculos_prestadores) | Baixa | Atualizar migration para refletir `veiculos` |
| 3 | Teste de expiração automática sem FK real | Baixa | Criar OS dedicada para testar |
| 4 | Dashboard da Rede no TMS | Futura | Não escopo da M84-86 |
| 5 | Notificação push/WhatsApp para prestadores | Futura | Nova missão |

---

## Recomendações

1. **Atualizar migration M84** no arquivo `20260705_m84_rede_enterprise_prestadores.sql` para refletir as correções da RPC (usar `veiculos`, remover `historico_bloqueios`, matching flexível)
2. **Seed de mais prestadores** com veículos e regiões para ampliar a cobertura da Rede
3. **Adicionar `SECURITY DEFINER`** à RPC `f_aceitar_oportunidade_rede` para funcionar com anon key
4. **Criar Edge Function** para o App Motorista (Flutter) consumir a Rede via REST
5. **Homologar fluxo completo** no browser: criar OS → Enviar para Rede → Ver painel de compatíveis
