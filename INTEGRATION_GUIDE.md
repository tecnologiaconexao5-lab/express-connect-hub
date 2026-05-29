# 📋 Guia de Integração — Sistema de Geração de Anúncios Profissionais

## 🎯 Objetivo

Transformar o módulo de recrutamento em um gerador profissional de anúncios operacionais, seguindo o padrão visual e estrutural da Conexão Express.

---

## 📦 Arquivos Criados/Modificados

### ✅ Novos Arquivos

```
src/modules/recrutamento/
├── types/
│   └── operationAnnouncement.ts          [NOVO] Tipos para anúncios e separação público/confidencial
├── utils/
│   ├── buildOperationAnnouncement.ts     [NOVO] Builder profissional de anúncios
│   └── calculateOperationFinances.ts     [NOVO] Cálculos bidirecionais inteligentes
├── hooks/
│   └── useFinanceiroInteligente.ts       [NOVO] Hooks com debounce e sincronização
└── components/
    ├── OperationJobPreview.tsx            [NOVO] Preview em tempo real
    └── OperacaoFormLogistica.tsx          [NOVO] Exemplo de integração no formulário
```

### 🔄 Arquivos Modificados

```
src/modules/recrutamento/types/recrutamento.ts
  • Estendido FinanceiroOperacao com: kmExcedentePrestador, kmExcedenteCliente, percentualPrestadorVsCliente, percentualKmExcedentePrestador
  • Adicionado campo logistica? à interface Operacao
```

---

## 🚀 Como Integrar no Formulário Existente

### Passo 1: Importar Hooks e Componentes

```tsx
import { useFinanceiroInteligente, useLogisticaOperacional } from '@/modules/recrutamento/hooks/useFinanceiroInteligente'
import { OperationJobPreview, OperationJobPreviewCompacto } from '@/modules/recrutamento/components/OperationJobPreview'
import { buildOperationAnnouncement, exportarAnuncioTexto } from '@/modules/recrutamento/utils/buildOperationAnnouncement'
```

### Passo 2: Inicializar Hooks no Formulário

```tsx
function PaginaNovaOperacao() {
  const [operacao, setOperacao] = useState<Operacao>(...)
  
  // Hooks inteligentes com callback
  const financeiro = useFinanceiroInteligente(operacao.financeiro, {
    delayMs: 500,
    onMudanca: (novoFinanceiro) => {
      setOperacao(prev => ({
        ...prev,
        financeiro: novoFinanceiro
      }))
    }
  })
  
  const logistica = useLogisticaOperacional(operacao.logistica || {})
  
  return (
    // ... seu formulário
  )
}
```

### Passo 3: Usar Campos de Entrada com Auto-Sync

```tsx
// Valor Prestador com cálculo automático de %
<Input
  value={financeiro.estado.valorPrestador || ''}
  onChange={(e) => financeiro.setValorPrestador(e.target.value)}
/>

// Percentual Prestador com cálculo automático de valor
<Input
  value={financeiro.estado.percentualPrestadorVsCliente || ''}
  onChange={(e) => financeiro.setPercentualPrestador(e.target.value)}
/>

// KM Excedente Bidirecional
<Input
  value={financeiro.estado.kmExcedentePrestador || ''}
  onChange={(e) => financeiro.setKmExcedentePrestador(e.target.value)}
/>

<Input
  value={financeiro.estado.percentualKmExcedentePrestador || ''}
  onChange={(e) => financeiro.setPercentualKmExcedente(e.target.value)}
/>
```

### Passo 4: Adicionar Aba de Logística

```tsx
<Tabs defaultValue="basico" onValueChange={setAbaAtiva}>
  <TabsList>
    <TabsTrigger value="basico">Informações Básicas</TabsTrigger>
    <TabsTrigger value="logistica">📦 Logística</TabsTrigger>
    <TabsTrigger value="financeiro">💰 Financeiro Avançado</TabsTrigger>
  </TabsList>
  
  <TabsContent value="logistica">
    {/* Campos de LogisticaOperacao */}
    <Input
      placeholder="Type de Veículo Detalhado"
      value={logistica.estado.tipoVeiculoDetalhado || ''}
      onChange={(e) => logistica.atualizarCampo('tipoVeiculoDetalhado', e.target.value)}
    />
    {/* ... outros campos */}
  </TabsContent>
</Tabs>
```

### Passo 5: Adicionar Preview Lateral

```tsx
<div className="grid grid-cols-3 gap-4">
  <div className="col-span-2">
    {/* Seu formulário */}
  </div>
  
  <div className="sticky top-4">
    <OperationJobPreview
      operacao={operacao}
      logistica={logistica.estado}
      mostrarBotoesAcao={true}
      mostrarValidacao={true}
    />
  </div>
</div>
```

---

## 💡 Exemplos de Uso

### Gerar Anúncio Profissional

```tsx
import { buildOperationAnnouncement, exportarAnuncioTexto } from '@/modules/recrutamento/utils/buildOperationAnnouncement'

const operacao: Operacao = { /* ... */ }
const logistica: LogisticaOperacao = { /* ... */ }

// Construir objeto estruturado
const anuncio = buildOperationAnnouncement(operacao, logistica, {
  incluirCTA: true,
  mostrarObservacoes: true,
  temaEmojis: true,
  formatoWhatsApp: true,
})

// Exportar como texto (pronto para copiar/colar)
const textoAnuncio = exportarAnuncioTexto(anuncio)
console.log(textoAnuncio)
```

### Validar Operação Antes de Anunciar

```tsx
import { validarOperacaoParaAnuncio } from '@/modules/recrutamento/utils/buildOperationAnnouncement'

const { valido, erros } = validarOperacaoParaAnuncio(operacao, logistica)

if (!valido) {
  console.warn('Campos faltantes:', erros)
  // Mostrar alertas ao usuário
}
```

### Analisar Saúde Financeira

```tsx
import { analisarFinanceiro } from '@/modules/recrutamento/utils/calculateOperationFinances'

const analise = analisarFinanceiro(operacao.financeiro, operacao.meta.vagasTotais)

console.log(`Margem: ${analise.margemBruta}`)
console.log(`Status: ${analise.status}`) // 'saudavel' | 'alerta' | 'critico'
```

---

## 🔒 Segurança: Campos Confidenciais

### NÃO Aparecem no Anúncio para Prestadores

```typescript
// Campos bloqueados automaticamente:
const CAMPOS_BLOQUEADOS = [
  'valorCliente',
  'margemTransportadora', 
  'percentualImposto',
  'percentualSeguro',
  'valorImposto',
  'valorSeguro',
  'receitaLiquida',
  'custoTotal',
  'lucroUnitario',
  'lucroTotal',
  'margem',
  'percentualKmExcedenteCliente',
]
```

### Função para Filtrar Dados Públicos

```tsx
function obterSomenteDadosPublicos(financeiro: FinanceiroOperacao) {
  return {
    valorPrestador: financeiro.valorPrestador,
    franquiaKm: financeiro.franquiaKm,
    kmExcedentePrestador: financeiro.kmExcedentePrestador,
    percentualKmExcedentePrestador: financeiro.percentualKmExcedentePrestador,
    formaPagamento: financeiro.formaPagamento,
    prazoPagamento: financeiro.prazoPagamento,
  }
}
```

---

## 🔄 Sincronização Bidirecional (Como Funciona)

### Cenário 1: Usuário Digita Valor Prestador

```
1. setValorPrestador("500") ↓
2. Trigger tipo: 'valorPrestador' ↓
3. Se valorCliente existe, calcula: 500 / 700 * 100 = 71.43% ↓
4. Estado atualizado automaticamente ↓
5. Hook onMudanca chamado ↓
6. Preview atualiza
```

### Cenário 2: Usuário Digita Percentual

```
1. setPercentualPrestador("65.5") ↓
2. Trigger tipo: 'percentualPrestador' ↓
3. Se valorCliente existe, calcula: 700 * 65.5 / 100 = R$ 458.50 ↓
4. valorPrestador atualizado automaticamente ↓
5. Hook onMudanca chamado ↓
6. Preview atualiza
```

### Sem Loop Infinito

- Rastreamento de qual campo mudou (tipo)
- Debounce de 300-500ms (configurável)
- Apenas campos dependentes são recalculados
- Validação antes de atualizar

---

## 📊 Estrutura de Dados

### FinanceiroOperacaoExpandido

```typescript
{
  // Valores Prestador (PÚBLICO)
  valorPrestador: 500,                    // Por saída
  franquiaKm: 70,                         // KM inclusos
  kmExcedentePrestador: 1.50,             // R$ por km extra
  percentualPrestadorVsCliente: 71.43,    // % auto-calculado
  
  // KM Excedente Bidirecional
  kmExcedenteCliente: 2.00,               // Limite cliente
  percentualKmExcedentePrestador: 75,     // % auto-calculado
  
  // Pagamento (PÚBLICO)
  formaPagamento: "Quinzenal",
  prazoPagamento: 15,
  
  // Dados Internos (NÃO MOSTRAR)
  valorCliente: 700,
  margemTransportadora: 200,
  percentualImposto: 7,
  percentualSeguro: 2,
  // ... outros
}
```

### LogisticaOperacao

```typescript
{
  quantidadeMediaParadas: 15,
  tipoOperacao: 'fixa',
  textoResumidoOperacional: 'Cestas básicas diárias...',
  programacaoOperacional: [
    {
      saida: '10:00',
      tipoEntrega: 'D+0',
      observacao: 'entregas nas capitais'
    },
    {
      saida: '16:00',
      tipoEntrega: 'D+1',
      observacao: 'entregas no interior'
    }
  ],
  tipoVeiculoDetalhado: 'Van refrigerada 1.500kg',
  volumeM3: 8,
  aceitaTermo: true,
  aceitaRefrigerado: true,
  perfilCarga: 'Cestas básicas',
  temperaturaMinima: 2,
  temperaturaMaxima: 8,
}
```

---

## ✅ Checklist de Integração

- [ ] Importar novos tipos em `recrutamento.ts`
- [ ] Adicionar hooks ao formulário existente
- [ ] Criar aba "Logística" no multi-step
- [ ] Criar aba "Financeiro Avançado"
- [ ] Integrar `OperationJobPreview` como sidebar
- [ ] Testar cálculos bidirecionais
- [ ] Validar campos confidenciais não aparecem
- [ ] Teste de build: `npm run build`
- [ ] Teste de TypeScript: `npx tsc --noEmit`
- [ ] Salvar em Supabase com novo schema

---

## 🗄️ Migrations Supabase Necessárias

### ALTER TABLE recrutamento_operacoes

```sql
-- Novos campos para Logística
ALTER TABLE recrutamento_operacoes ADD COLUMN logistica JSONB DEFAULT '{}';

-- Novos campos financeiros (já em JSONB financeiro, mas documentar)
-- financeiro.kmExcedentePrestador
-- financeiro.kmExcedenteCliente
-- financeiro.percentualPrestadorVsCliente
-- financeiro.percentualKmExcedentePrestador

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_operacoes_logistica ON recrutamento_operacoes USING GIN(logistica);
CREATE INDEX IF NOT EXISTS idx_operacoes_financeiro ON recrutamento_operacoes USING GIN(financeiro);

-- Atualizar RLS se necessário
ALTER POLICY "operacoes_select" ON recrutamento_operacoes USING (auth.uid() IS NOT NULL);
```

---

## 🎨 Preview do Anúncio Gerado

Saída esperada (automática):

```
🚚 *SELEÇÃO DE PRESTADORES — OPERAÇÃO FIXA E RECORRENTE*

Estamos ampliando nossa base de prestadores parceiros para atuação em uma operação já consolidada, com demanda contínua e recorrência ao longo do ano.

━━━━━━━━━━━━━━━━━━━

🚛 *VEÍCULO DA OPERAÇÃO*

✔ Van refrigerada 1.500kg
✔ Baú 8m³
✔ Aceita: Térmico, Refrigerado

━━━━━━━━━━━━━━━━━━━

[... continue sections ...]

📲 Se estiver dentro do perfil, pode chamar para alinharmos início e disponibilidade operacional.

━━━━━━━━━━━━━━━━━━━
```

---

## 🧪 Testes Recomendados

### Teste 1: Cálculo Bidirecional

```typescript
const financeiro = {
  valorCliente: 700,
  valorPrestador: 0,
  kmExcedenteCliente: 2,
  kmExcedentePrestador: 0,
  // ...
}

// Digitar valor prestador
hook.setValorPrestador(500)
// Esperado: percentualPrestadorVsCliente = 71.43%

// Digitar percentual de km
hook.setPercentualKmExcedente(75)
// Esperado: kmExcedentePrestador = 1.50
```

### Teste 2: Validação de Anúncio

```typescript
const { valido, erros } = validarOperacaoParaAnuncio(operacao, logistica)
// Esperado: valido = true, erros = []
```

### Teste 3: Geração de Texto

```typescript
const texto = exportarAnuncioTexto(anuncio)
// Esperado: texto contém todas as seções formatadas com emojis
```

---

## 📞 Suporte e Troubleshooting

### "Valores se atualizam infinitamente"

- ✅ Usar o hook `useFinanceiroInteligente` (tem proteção)
- ❌ NÃO chamar `setValorPrestador` dentro de `useEffect` com dependências

### "Preview não atualiza em tempo real"

- Verificar se `logistica.estado` está sendo passado
- Testar se hooks estão inicializados corretamente
- Aumentar `delayMs` se necessário

### "Campos confidenciais aparecem no anúncio"

- Verificar se está usando `buildOperationAnnouncement`
- Nunca passar `financeiro.valorCliente` para o builder
- Testar validação com `validarOperacaoParaAnuncio`

---

## 📚 Referências Rápidas

```tsx
// Importações essenciais
import { buildOperationAnnouncement, exportarAnuncioTexto, validarOperacaoParaAnuncio } from '@/modules/recrutamento/utils/buildOperationAnnouncement'
import { useFinanceiroInteligente, useLogisticaOperacional } from '@/modules/recrutamento/hooks/useFinanceiroInteligente'
import { OperationJobPreview, OperationJobPreviewCompacto } from '@/modules/recrutamento/components/OperationJobPreview'

// Tipos
import type { LogisticaOperacao, OperationAnnouncementPublic } from '@/modules/recrutamento/types/operationAnnouncement'
```

---

**Data de Criação:** 2026-05-25  
**Versão:** 1.0  
**Status:** ✅ Pronto para Integração
