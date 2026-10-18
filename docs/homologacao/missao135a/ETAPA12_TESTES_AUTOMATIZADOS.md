# ETAPA 12 — Testes Automatizados

## Status Atual

### Playwright (E2E)
| Métrica | Valor |
|---------|:-----:|
| Total spec files | 83 |
| Workers | 1 (fullyParallel: false) |
| Timeout | 120s |
| Retries | 0 (CI: 1) |
| Última execução | ❌ 4 testes falharam |
| Evidências de falha | `test-results/.last-run.json` |

**Última execução**: `test-results/.last-run.json` registra 4 testes falhando (IDs anônimos — sem nome legível). Necessário re-executar para identificar quais.

### Vitest (Unitários)
| Métrica | Valor |
|---------|:-----:|
| Comando | `vitest run` (via `npm test`) |
| Test files | 0 (nenhum `.test.ts` ou `.spec.ts` no src) |
| Resultado | ✅ Passa vazio (0 testes, 0 erros) |

### Scripts Supabase
| Métrica | Valor |
|---------|:-----:|
| Scripts de teste | 63+ |
| Scripts de verificação | 51 |
| Scripts SQL | 3 |
| Último teste conhecido | M133-D.2 (finalizado) |

### Cobertura por Fluxo Operacional

| Fluxo | Testes Playwright | Scripts Supabase | Cobertura |
|-------|:-:|:-:|:---------:|
| Fluxo direto (OS) | 2 (missao55-c1, homologacao-critica) | vários | ⚠️ Parcial |
| Fluxo com escala | 5+ (flutter-prestador-real, escala) | m85, m90, m127e1 | ✅ Boa |
| Multiparadas | 0 específicos | — | ❌ Nenhum |
| Coleta reversa | 0 específicos | m108f | ❌ Nenhum |
| Devolução | 0 específicos | — | ❌ Nenhum |
| Tracking | 2 (missao108-l8) | m106 | ⚠️ Parcial |
| Financeiro | 2 (financeiro-e2e) | m81, m104a, m66 | ✅ Boa |
| Portal Cliente | ~15 spec files | vários | ✅ Boa |
| Torre Controle | 1 (m97_noc_dashboard) | — | ⚠️ Mínima |
| Central IA | 20 spec files | f30-f40 | ✅ Excelente |

### Lacunas de Cobertura
1. **Multiparadas**: zero testes E2E ou scripts dedicados
2. **Coleta reversa**: sem teste E2E (apenas script m108f)
3. **Devolução**: sem teste E2E ou script dedicado
4. **Tracking**: mapa ao vivo sem cobertura E2E
5. **Fluxo direto OS**: cobertura mínima (apenas cenário geral)
6. **Testes unitários**: zero — sem framework de testes unitários implementado
7. **Testes de componentes**: zero — sem RTL ou Storybook

### Pendências Pós-Missão
1. Re-executar Playwright para identificar os 4 testes falhando
2. Criar testes E2E para multiparadas, coleta reversa, devolução
3. Implementar testes unitários (vitest) para serviços críticos
4. Implementar testes de componentes (RTL) para componentes core
