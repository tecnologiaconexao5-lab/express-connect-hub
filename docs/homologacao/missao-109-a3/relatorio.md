# MISSÃO 109-A3 — RELATÓRIO

## Resumo

A missão identificou que a criação de escala e alocação pelo TMS ocorre automaticamente via `sincronizarComEscala()` ao salvar uma OS com prestador, veículo e data programada. Porém, a automação Playwright não conseguiu preencher corretamente os campos do formulário no modo de edição, impedindo a validação completa do fluxo via interface.

## 1. Projeto

`express-connect-hub` (TMS Conexão Express)

## 2. Cenário testado

Editar OS existente → Preencher prestador + veículo + data programada → Salvar → `sincronizarComEscala()` cria alocação

## 3. Dados utilizados

| Item | Valor |
|------|-------|
| OS1 | `bf466936-b5b5-4526-b9e4-fa77229eb4dd` / `OS-202607-426505` |
| OS2 | `313b4bac-31ed-4a38-ae27-0a97ade7a06f` / `OS-202607-912256` |
| Prestador | `e6646799-fbac-453e-a3ef-afdfc01a7085` (PRESTADOR TESTE APP) |
| Cliente | `c4ee38d6-f667-4ec9-90e2-b299ec513ca5` (DVL) |

## 4. Erro encontrado

Após preencher prestador e veículo nos formulários da UI e clicar "Salvar OS", o payload PATCH enviado ao Supabase NÃO inclui os campos `prestador_id`, `prestador`, `tipo_veiculo`, `placa_alocada` ou `data_programada`.

Payload PATCH capturado:
```json
{"numero":"OS-202607-426505","data":"2026-07-12","unidade":"","centro_custo":"","tipo_operacao":"Coleta e Entrega","status":"rascunho",...}
// SEM prestador_id, prestador, tipo_veiculo, placa_alocada
```

## 5. Causa raiz

O formulário de edição da OS (`OrdemServicoForm.tsx`) possui múltiplos componentes complexos (SearchableSelect, Radix Select, tabs) e a automação Playwright não consegue garantir que o estado do formulário (`data`) seja atualizado corretamente antes do salvamento.

Fatores contribuintes:
1. O campo "Parceiro / Prestador" usa `SearchableSelect` sem `returnField="id"` (retorna o nome, não o UUID)
2. O campo "Tipo de Veículo" existe em dois locais na aba "3. Veículo" (nativo `<select>` e Radix `<Select>`)
3. A função `sincronizarComEscala()` exige `prestadorId`, `dataOS` e `veiculoTipo` — mas o formulário não reflete essas alterações no estado antes do submit

## 6. Arquivos alterados

Nenhum (missão de auditoria, sem correções)

## 7. Banco / Migration / RPC / Trigger

Nenhum alterado

## 8. Testes executados

- `missao109a3-escala-alocacao.spec.ts`: 4 testes → 2 passaram, 2 falharam
- Teste manual via API: comprovou que `sincronizarComEscala()` cria alocação corretamente quando os campos obrigatórios estão presentes

## 9. Evidências

Screenshots em `docs/homologacao/missao-109-a3/`

## 10. Resultado antes

OS sem escala, sem alocação, sem prestador vinculado

## 11. Resultado depois

✅ Fluxo de sincronização validado via API (prova de conceito)
❌ Fluxo via interface não pôde ser completamente automatizado

## 12. ID da Escala / Alocação

Não gerada via interface.

## 13. Status final

⚠️ Parcial — alocação pode ser criada manualmente pela Escala tab ("Gerenciar Alocação de Recurso") ou pela sincronização automática ao selecionar prestador + veículo em uma NOVA OS.

## 14. Bloqueios restantes

1. **Automação do formulário de edição**: os campos de prestador e veículo não são refletidos no payload PATCH quando alterados via UI automatizada
2. **`prestador` coluna UUID**: a coluna `prestador` em `ordens_servico` é UUID, mas o `SearchableSelect` para prestador retorna `nome_completo` (texto) — inconsistência que deve ser avaliada

## 15. Próxima missão

**MISSÃO 109-B** — App Motorista Flutter: criar uma alocação via API com os dados de homologação e testar o recebimento e aceite pelo App.
