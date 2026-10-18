# RELATÓRIO — MISSÃO UX-001.1 · Correções Visuais e de Sobreposição

**Data:** 2026-08-03
**Escopo:** Refinamentos visuais pós-homologação das telas Enterprise (Ordem de Serviço + Orçamento)
**Natureza:** 100% UX/UI — nenhuma regra de negócio, backend, Supabase, API, serviço, cálculo ou fluxo foi alterado.

---

## 1. Causa raiz do dropdown recortado (P0)

O campo **Cliente** usa o componente compartilhado `SearchableSelect`, que renderiza a lista de
resultados em um elemento **`position: absolute`** dentro de um wrapper `relative` — **sem Portal**.

O dropdown ficava recortado porque um ancestral direto — o componente de seção compartilhado
`FormSectionCard` (`src/components/ui/premium-document.tsx`) — aplicava **`overflow-hidden`** no
`Card`:

```tsx
<Card className="cn("overflow-hidden rounded-2xl border ...")">
```

Esse `overflow-hidden` (necessário apenas para arredondar o topo do cabeçalho da seção) **recortava**
qualquer conteúdo absoluto que ultrapassasse a borda inferior do card — exatamente o caso da lista de
resultados do campo Cliente, que precisava descer sobre o card seguinte ("Contexto Comercial").

**Verificações realizadas antes da correção:**
- Card base (`ui/card.tsx`): `rounded-lg border bg-card ... shadow-sm` — **sem** overflow. ✅ não é o causador
- `FormSectionCard`: `overflow-hidden rounded-2xl ...` — **é o causador** ❌
- `TabsContent` (`ui/tabs.tsx`): sem overflow/transform. ✅
- `SearchableSelect`: dropdown `absolute z-50` dentro de `relative` — sem Portal, mas com o overflow corrigido o posicionamento absoluto é suficiente. ✅
- Ancestrais com `transform/filter/isolation/position/z-index`: nenhum interfere no dropdown do Cliente. ✅

---

## 2. Solução aplicada (Portal, overflow e z-index)

Seguindo a ordem de segurança da missão, optou-se pela **opção 3 — correção do contexto de
overflow apenas no container necessário**:

1. **`FormSectionCard`**: removido `overflow-hidden` do `Card`. O recorte agora ocorre **somente no
   cabeçalho** (`CardHeader` com `overflow-hidden rounded-t-2xl`), preservando os cantos arredondados
   do topo sem recortar o conteúdo do corpo.
2. **`z-index`**: o dropdown já usava `z-50` (mantido) — suficiente agora que o recorte de overflow
   foi eliminado. Não foi usado z-index arbitrário.
3. **Portal não foi necessário**: o `SearchableSelect` mantém a lógica (query, debounce, seleção,
   callbacks, click-outside) integralmente; a correção da causa raiz (overflow) fez o dropdown abrir
   corretamente sobre as seções abaixo. Nenhum autocomplete do sistema precisou de Portal para este caso.

**Resultado verificado (22/22 checks em 2 resoluções):**
- abre completamente sobre as seções abaixo; ✅
- alinhado ao campo; ✅
- respeita a largura do input (`w-full`); ✅
- altura máxima com scroll interno (`max-h-64 overflow-y-auto`); ✅
- não desloca o card seguinte; ✅
- não fica atrás da sidebar nem do rodapé fixo (conteúdo centralizado, z-50); ✅
- fecha ao selecionar e ao clicar fora; ✅
- funciona por teclado (↓/↑ + Enter seleciona, Escape fecha); ✅
- funciona em 1366×768 e 1920×1080. ✅

---

## 3. Ajustes feitos no `FormSectionCard` e no destaque das seções (P1)

Priorizou-se o componente compartilhado (Design System), sem estilos duplicados por tela:

- **`FormSectionCard`** (`premium-document.tsx`) — retângulo corporativo mais claro:
  - remoção do `overflow-hidden` (fix P0);
  - borda `border-slate-200/90` (antes `/80`);
  - cabeçalho `bg-slate-50` sólido (antes `bg-slate-50/50`) + `border-b border-slate-200/70`;
  - cantos superiores mantidos com `rounded-t-2xl overflow-hidden` no cabeçalho.
- **`PanelSection`** (painel lateral, `enterprise.tsx`): não precisou de ajuste — já possui separação
  por seção com barra de acento, fundo levemente diferenciado e `border-b`. As seções principais
  citadas na missão ("Dados do Documento", "Contexto Comercial", etc.) são `FormSectionCard`.
- **"Itinerário da OS"** (`OrdemServicoForm.tsx`): o cabeçalho da seção passou a ser uma barra
  contida (`rounded-xl border bg-white px-4 py-2.5 shadow-sm`), mantendo `sticky top-0` e o botão
  "Adicionar Parada" — apenas visual.
- **Dropdown do Cliente** (`SearchableSelect.tsx`): itens com altura confortável (`py-2.5`), nome em
  destaque (`font-semibold`), **CNPJ secundário** em hierarquia menor (prop opcional `secondaryField`,
  valor já presente no registro — sem novas chamadas ao backend), hover/ativo visível, item selecionado
  destacado, estado vazio e estado carregando, texto truncado somente quando necessário, margem `mt-1.5`
  em relação ao campo e scroll interno `max-h-64`.

---

## 4. Arquivos alterados

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `src/components/ui/premium-document.tsx` | Modificado | `FormSectionCard`: remove `overflow-hidden` do Card (fix P0) e reforça o retângulo (borda, cabeçalho) |
| `src/components/ui/SearchableSelect.tsx` | Modificado | Dropdown premium (itens, hover, selecionado, vazio, carregando), `secondaryField` opcional, navegação por teclado. Lógica de busca/debounce/seleção/callbacks **intacta** |
| `src/components/comercial/OrcamentoForm.tsx` | Modificado | Campo Cliente: `secondaryField="cnpj"` (visual) |
| `src/components/operacao/OrdemServicoForm.tsx` | Modificado | Campo Cliente: `secondaryField="cnpj"`; cabeçalho "Itinerário da OS" como barra contida |
| `tests/e2e/missao_ux001_1_cliente_dropdown.spec.ts` | Criado | Teste Playwright do dropdown (2 resoluções, interceptação de `/rest/v1/clientes` p/ determinismo) |
| `test-results/ux001_1/*.png` | Criado | Screenshots (6 arquivos) |

---

## 5. Componentes reutilizados

- `SearchableSelect` (compartilhado) — aprimorado, sem quebra de interface (props novas são opcionais)
- `FormSectionCard` / `Card` / `CardHeader` / `CardContent` — reutilizados
- `Field`, `Input`, `Label`, `Button`, `Badge` — sem alteração
- Ícones `lucide-react`

## 6. Nenhuma função alterada

Todos os handlers, queries, mutações, validações, cálculos, payloads, conversão Orçamento→OS e
chamadas ao Supabase permanecem idênticos. A única adição no `SearchableSelect` é **visual/UX**
(navegação por teclado + `secondaryField`), sem tocar na consulta, no debounce nem nos callbacks
`onChange(value, record)`.

---

## 7. Resultados

| Validação | Comando | Resultado |
|-----------|---------|-----------|
| Build | `npm run build` | ✅ **30.59s**, 0 erros |
| Testes unitários | `npx vitest run` | ✅ **31/31 passed** |
| TypeScript | `npx tsc --noEmit` | ✅ **0 erros novos** nos arquivos da missão (`SearchableSelect.tsx`, `premium-document.tsx`); erros restantes são **pré-existentes** (baseline do working tree, já registrados na UX-001) |
| Validação de comportamento (harness + interceptação Playwright) | script temporário | ✅ **22/22 checks** em **1366×768** e **1920×1080** |
| Teste Playwright permanente | `tests/e2e/missao_ux001_1_cliente_dropdown.spec.ts` | Criado; execução completa requer credenciais reais (`PLAYWRIGHT_TAMIRIS_PASSWORD`) |

## 8. Screenshots

`test-results/ux001_1/`:
- `1366x768-dropdown-aberto.png` · `1366x768-cliente-selecionado.png` · `1366x768-visao-geral-cards.png`
- `1920x1080-dropdown-aberto.png` · `1920x1080-cliente-selecionado.png` · `1920x1080-visao-geral-cards.png`

*(Os screenshots foram capturados via harness temporário com dados mock + interceptação de rede do
Supabase, pois as senhas reais dos usuários corporativos não estão disponíveis neste ambiente. O
harness foi removido após a captura.)*

---

## 9. Confirmação

> **Nenhuma regra de negócio, backend, Supabase, SQL, migration, RPC, view, RLS, API, serviço,
> hook de consulta, cálculo, validação comercial, conversão Orçamento → OS, permissão, payload ou
> tipo de banco foi alterado.** As mudanças são exclusivamente de apresentação (overflow, estilos,
> destaque de seções e espaçamento do dropdown).
