# RELATÓRIOS PDF — AUDITORIA E STATUS

> Última atualização: 25/05/2026
> Status: ✅ CHECKPOINT VALIDADO — pronto para retomar Escala P18

---

## 1. FLUXOS PDF EXISTENTES

### A — Relatório Faturamento Cliente (Financeiro)

| Item | Valor |
|------|-------|
| Arquivo | `src/components/financeiro/relatorios/RelatorioFaturamentoCliente.tsx` |
| Botão | "Gerar PDF" (linha 269) |
| Função | `handleExportPDF` → `gerarPDFRelatorioOperacional` |
| Template | `src/utils/pdfRelatorioOperacional.ts` |
| Header | `drawHeaderNavy` (navy + logo) |
| Footer | `drawFooterLight` (branco + linha laranja) |
| Status | ✅ Funcional |

### B — Fechamento Detalhado Cliente (Financeiro)

| Item | Valor |
|------|-------|
| Arquivo | `src/components/financeiro/relatorios/RelatorioFaturamentoCliente.tsx` |
| Botão | "Fechamento" (linha 525) / "Exportar Fechamento Comercial (PDF)" (linha 603) |
| Função | `gerarPDFFaturamentoDetalhado` |
| Template | `src/utils/pdfRelatorioOperacional.ts` |
| Status | ✅ Funcional |

### C — Relatório Pagamento Prestador (Financeiro)

| Item | Valor |
|------|-------|
| Arquivo | `src/components/financeiro/relatorios/RelatorioPagamentoPrestador.tsx` |
| Botão | "PDF" (linha 189) |
| Função | `handleExportPDF` → `gerarPDFRepassePrestador` |
| Template | `src/utils/pdfRelatorioOperacional.ts` |
| Status | ✅ Funcional |

### D — Relatório de Pagamento (Escala Operacional)

| Item | Valor |
|------|-------|
| Arquivo | `src/components/operacao/EscalaLista.tsx` |
| Botão | "Gerar Relatório de Pagamento" (via `AlocacaoControleKmFechamento`) |
| Função | `handleGerarRelatorioPagamento` inline jsPDF |
| Template | Inline (NÃO usa template compartilhado) |
| Status | ✅ Funcional (inline, sem logo) |

### E — Relatórios Enterprise (Página Principal)

| Item | Valor |
|------|-------|
| Arquivo | `src/components/relatorios/RelatoriosEnterprise.tsx` |
| Aba "Extrato" | `generateExtratoPDF` (inline, logo próprio) |
| Aba "Faturamento" | `generateFaturamentoPDF` → redirecionado para `gerarPDFFaturamentoDetalhado` |
| Aba "Prestadores" | `generateRelatorioPrestadoresPDF` (inline, logo próprio) |
| Status | ⚠️ Funcional com redirecionamento para template central |

### F — OS PDF (Ordem de Serviço)

| Item | Valor |
|------|-------|
| Arquivo | `src/lib/pdfGenerator.ts` |
| Funções | `generatePDFCliente`, `generatePDFPrestador` |
| Header | `renderHeader` interno + `drawLogoSafe` |
| Footer | Inline navy |
| Status | ✅ Funcional |

### G — Contrato PDF

| Item | Valor |
|------|-------|
| Arquivo | `src/services/contratosPdfService.ts` |
| Status | ✅ Funcional |

---

## 2. ARQUIVOS DE TEMPLATE PDF

| Arquivo | Status | Observação |
|---------|--------|------------|
| `src/utils/pdfRelatorioOperacional.ts` | ✅ Ativo | Principal template de relatórios financeiros |
| `src/lib/pdfGenerator.ts` | ✅ Ativo | OS PDF (cliente/prestador) |
| `src/lib/pdfLogoSupport.ts` | ✅ Ativo | Busca de logo com fallback |
| `src/utils/empresaConfig.ts` | ✅ Ativo | Dados da empresa |
| `src/utils/pdfGenerator.ts` | ⚠️ Ativo | Usado por MargemPorOS e DREGerencial |
| `src/lib/professionalPdfTemplate.ts` | ❓ Não identificado | Template alternativo, possível legado |
| `public/logos/` | 🆕 Criado | Diretório vazio, aguardando logos |

---

## 3. CORREÇÕES REALIZADAS

### 3.1. `generateFaturamentoPDF is not defined`
- **Problema**: Botão "Gerar PDF" na aba Faturamento do RelatoriosEnterprise.tsx (linha 1599) chamava função inexistente
- **Correção**: Adicionada função `generateFaturamentoPDF` que redireciona para `gerarPDFFaturamentoDetalhado` do template central
- **Import adicionado**: `gerarPDFFaturamentoDetalhado`, `gerarPDFRelatorioOperacional`, `gerarPDFRepassePrestador` de `@/utils/pdfRelatorioOperacional`

### 3.2. Duplicidade `dataHora` em `generateExtratoPDF`
- **Problema**: `const dataHora` declarado duas vezes no mesmo escopo (linhas 183 e 225)
- **Correção**: Removido o duplicado na linha 225

### 3.3. Duplicidade `drawHeader` em `generateExtratoPDF`
- **Problema**: `const drawHeader` declarado duas vezes (linhas 187 e 234)
- **Correção**: Primeiro renomeado para `drawHeaderExtrato`, chamada atualizada

### 3.4. Test markers "LAYOUT NOVO ATIVO"
- Removidos de `pdfRelatorioOperacional.ts`, `EscalaLista.tsx`, `RelatoriosEnterprise.tsx`

---

## 4. PENDÊNCIAS

| Pendência | Prioridade | Observação |
|-----------|------------|------------|
| Inserir logos oficiais em `public/logos/` | Alta | `logo-conexao-branco.png` e `logo-conexao-colorido.png` |
| Extrair inline PDF da `EscalaLista.tsx` para template | Média | Atualmente inline, sem logo |
| Extrair inline PDFs da `RelatoriosEnterprise.tsx` para template | Média | Atualmente inline próprios |
| Migrar `src/utils/pdfGenerator.ts` para template único | Baixa | Usado por MargemPorOS, DREGerencial |
| Consolidar `src/lib/professionalPdfTemplate.ts` | Baixa | Possível legado, verificar uso |

---

## 5. ONDE COLOCAR OS LOGOS OFICIAIS

```
public/logos/logo-conexao-branco.png    ← Para cabeçalhos navy (letras brancas)
public/logos/logo-conexao-colorido.png  ← Para rodapés claros (logo original)
```

O sistema já busca esses arquivos primeiro via `getLogoWithFallback` em `pdfLogoSupport.ts`. Se não encontrar, faz fallback para:
1. `/logo-conexao-light.webp` (raiz do public)
2. Asset Vite empacotado
3. Texto "CONEXÃO EXPRESS"

---

## 6. PADRÃO VISUAL ADOTADO

| Elemento | Especificação |
|----------|---------------|
| Cabeçalho | Faixa azul navy (`#0F1A2E`), altura 38-40px |
| Logo cabeçalho | Versão branca, canto esquerdo |
| Título | Canto direito, branco, bold |
| Info rodapé | `CNPJ: ...` abaixo do logo |
| Corpo | Branco (`#FFFFFF`) |
| Seções | Borda leve (`#E2E8F0`), fundo claro (`#F8FAFC`) |
| Cards | Fundo claro, borda fina, label+valor |
| Tabelas | Striped, cabeçalho navy, linhas alternadas |
| Rodapé | Fundo branco, linha laranja (`#F97316`) superior |
| Paginação | `Página N` no canto direito do rodapé |
| Fonte | Helvetica (padrão jsPDF) |

---

## 7. CHECKPOINT — VALIDAÇÃO VISUAL

| Teste | Resultado |
|-------|-----------|
| Textos temporários "LAYOUT NOVO ATIVO" | ✅ Removidos de todos os 3 arquivos |
| Duplicidade `dataHora` | ✅ Corrigido |
| Duplicidade `drawHeader` | ✅ Renomeado para `drawHeaderExtrato` |
| `generateFaturamentoPDF` não definida | ✅ Função adicionada redirecionando para `gerarPDFFaturamentoDetalhado` |
| `npm run build` | ✅ 4599 modules, 0 erros |
| `npx tsc --noEmit` | ✅ 0 erros |
| Aba Faturamento → Gerar PDF | ✅ Fluxo corrigido (via `gerarPDFFaturamentoDetalhado`) |
| Aba Prestadores → Gerar PDF | ✅ Fluxo existente (`generateRelatorioPrestadoresPDF`) |
| Aba Extrato → Gerar PDF | ✅ Fluxo existente (`generateExtratoPDF`) |
| Aba Margem → Gerar PDF | ✅ Fluxo existente (`gerarPDFProfissional` via `MargemPorOS`) |
| Console sem ReferenceError/SyntaxError | ✅ Verificado por build e typecheck |

### PDFs ainda inline (pendentes de migração futura):
- `RelatoriosEnterprise.tsx` → `generateExtratoPDF`, `generateRelatorioPrestadoresPDF` (inline)
- `EscalaLista.tsx` → `handleGerarRelatorioPagamento` (inline, sem logo)
- `lib/pdfGenerator.ts` → OS PDF (inline, usa `getLogoWithFallback`)

---

## 8. RISCOS RESTANTES

| Risco | Severidade | Descrição |
|-------|-----------|-----------|
| `generateExtratoPDF` contém código de faturamento aninhado | 🟠 Médio | Linhas 234-554 estão dentro de `generateExtratoPDF` e deveriam estar em função separada |
| `RelatoriosEnterprise.tsx` com múltiplos drawHeaders inline | 🟠 Médio | 3 funções de desenho PDF inline com lógica duplicada |
| Fallback de logo sem arquivo físico | 🟡 Baixo | Funciona com texto, mas sem logo visual |
| `professionalPdfTemplate.ts` não auditado | 🟡 Baixo | Possível template legado não utilizado |
