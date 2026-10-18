# MISSÃO 109-A4 — RELATÓRIO FINAL

## 1. Projeto executado
`express-connect-hub` (TMS Conexão Express)

## 2. Cenário testado
Editar OS existente pela interface → selecionar prestador + veículo Fiorino + placa ABC1T23 + data programada → salvar → sincronizarComEscala() cria alocação automaticamente → verificar persistência e idempotência

## 3. Causa raiz confirmada
O erro 400 no PATCH da OS era causado por TRÊS problemas:
1. **SearchableSelect de prestadores** usava `searchFields={['nome_completo', 'nome_fantasia']}` mas `nome_fantasia` não existe na tabela `prestadores` — causava 400 na busca
2. **Mapper enviava nomes para colunas UUID**: `cliente` e `prestador` são colunas UUID, mas o mapper enviava os nomes textuais ("DVL - DISTRIBUIDORA", "PRESTADOR TESTE APP")
3. **fromOSRow** não lia `placa_alocada` — usava `veiculo_placa` que não existe

## 4. Mapeamento correto dos campos

| Interface | Estado React | Mapper → Banco | Tipo coluna | Status |
|-----------|-------------|----------------|-------------|--------|
| "Parceiro / Prestador" | `prestador` (UUID) | `prestador` | UUID | ✅ UUID enviado |
| (via prestadorId) | `prestadorId` (UUID) | `prestador_id` | UUID FK | ✅ UUID enviado |
| "Placa Alocada" | `veiculoPlaca` (text) | `placa_alocada` | TEXT | ✅ Texto enviado |
| "Tipo de Veículo" | `veiculoTipo` (text) | `tipo_veiculo` | TEXT | ✅ Texto enviado |
| "Data Programada" | `dataProgramada` (date) | `data_programada` | DATE | ✅ Data enviada |
| "Cliente" | `cliente` (UUID) | `cliente` | UUID | ✅ UUID enviado |

## 5. Arquivos alterados

| Arquivo | Correção |
|---------|----------|
| `src/lib/dbMappers.ts` | `cliente` e `prestador` só enviados se forem UUID válido (regex `/^[0-9a-f-]{36}$/`) |
| `src/lib/dbMappers.ts` | `fromOSRow` agora lê `placa_alocada` como fallback para `veiculoPlaca` |
| `src/lib/dbMappers.ts` | `tipo_veiculo` e `placa_alocada` usam truthy check (não enviam "") |
| `src/components/operacao/OrdemServicoForm.tsx` | SearchableSelect prestador: `searchFields` corrigido para `['nome_completo']` |

## 6. Correções aplicadas
- **P0 — nome_fantasia inexistente**: removido do searchFields do SearchableSelect de prestadores
- **P0 — mapper de UUID**: `cliente` e `prestador` só são enviados se forem UUID válido
- **P0 — fromOSRow**: adicionado `placa_alocada` como fonte de `veiculoPlaca`
- **P1 — tipo_veiculo**: removido `s()` wrapper, usa truthy check
- **P1 — placa_alocada**: removido `s()` wrapper, usa truthy check

## 7. Payload antes
```json
{"numero":"OS-202607-426505","data":"2026-07-12","cliente":"DVL - DISTRIBUIDORA","prestador":"PRESTADOR TESTE APP",...}
// SEM prestador_id, tipo_veiculo, placa_alocada, data_programada
// COM cliente="DVL" (nome em coluna UUID) → 400
```

## 8. Payload depois
```json
{"numero":"OS-202607-426505","data":"2026-07-12","prestador_id":"e6646799-...","tipo_veiculo":"fiorino","placa_alocada":"ABC1T23","data_programada":"2026-07-12",...}
// SEM cliente (UUID não enviado quando não é UUID)
// SEM prestador (UUID não enviado quando não é UUID)
```

## 9. Testes executados
- Playwright `missao109a4`: **4/4 passaram** ✅ (OS1, idempotência, OS2, validação final)
- `npx tsc --noEmit`: 0 erros ✅

## 10. Evidências
`docs/homologacao/missao-109-a4/` — 16 arquivos (screenshots, payloads, resultados)

## 11. Resultado da OS 1
✅ OS atualizada, alocação criada automaticamente via `sincronizarComEscala()`

## 12. ID da alocação da OS 1
`4eabccb2-e7d4-4d5e-9d01-ed01ac23d6c1`

## 13. Resultado do teste de idempotência
✅ Salvar novamente manteve exatamente 1 alocação (mesmo ID)

## 14. Resultado da OS 2
✅ OS2 criou sua própria alocação independente (ID diferente)

## 15. ID da alocação da OS 2
`dd945e01-a5c0-4394-a5f3-b06382c536a8`

## 16. Validação de duplicidade
✅ OS1: 1 alocação | OS2: 1 alocação | IDs diferentes | 0 duplicidades

## 17. Status de prontidão para o App
✅ **PRONTO** — 12/12 checks passaram:
- prestador_id correto em ambas
- aceite false em ambas
- data_aceite null em ambas
- status planejada em ambas
- tenant presente em ambas
- IDs diferentes

## 18. Bloqueios restantes
Nenhum bloqueio para o fluxo de criação de OS + alocação automática.

## 19. Próxima missão objetiva
**MISSÃO 109-B** — App Motorista Flutter: recebimento e aceite de uma das alocações criadas exclusivamente pela interface do TMS.
