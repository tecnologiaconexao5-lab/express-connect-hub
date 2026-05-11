# Integrações do Módulo Financeiro

## Fontes de Dados Financeiros

### 1. Ordem de Serviço (OS)
**Tabela:** `ordens_servico`
**Campos Financeiros:**
- `valor_cliente` - Valor cobrado do cliente
- `custo_prestador` - Custo do prestador
- `pedagio` - Valor do pedágio
- `adicionais` - Valores adicionais
- `descontos` - Descontos aplicados

### 2. Composição Financeira OS
**Tabela:** `composicao_financeira_os`
**Campos:**
- `valor_cliente` - Recebimento do cliente
- `valor_prestador` - Pagamento ao prestador
- `imposto_valor` - Impostos sobre a operação
- `seguro_valor` - Valor do seguro
- `pedagio_valor` - Pedágio separado
- `outros_custos` - Custos adicionais
- `margem_bruta` - Margem antes de impostos
- `margem_liquida` - Margem final
- `percentual_margem_liquida` - % de margem

### 3. Prestadores
**Tabela:** `prestadores`
**Campos:** (campos básicos sem dependência de colunas opcionais)
- `nome_completo` - Nome
- `cpf_cnpj` - CPF/CNPJ
- `telefone` - Contato
- Campos bancários (banco, agencia, conta, chave_pix) - verificar se existem

### 4. Clientes
**Tabela:** `clientes`
- `nome_fantasia` - Nome de exibição
- `razao_social` - Razão social
- `cnpj` - CNPJ
- `status` - Ativo/Inativo

### 5. Pagamentos
**Tabela:** `pagamentos_prestadores`
- `prestador_id` - Vinculação ao prestador
- `os_id` - Vinculação à OS
- `valor` - Valor do pagamento
- `data` - Data do pagamento
- `status` - Status (pendente, pago)

### 6. Recebimentos
**Tabela:** `contas_receber` (ou similar)
- `cliente_id` - Vinculação ao cliente
- `os_id` - Vinculação à OS
- `valor` - Valor a receber
- `data_vencimento` - Data de vencimento
- `status` - Status (pendente, pago)

---

## Integrações por Setor

### 1. Clientes → Financeiro
- Faturamento por cliente
- Total a receber por cliente
- Histórico de pagamentos
- Margem por cliente

### 2. Prestadores → Financeiro
- Pagamentos a prestadores
- Dados bancários (se disponíveis)
- Total a pagar por prestador
- Margem por prestador

### 3. OS → Financeiro
- Composição financeira por OS
- Margem por OS
- Custos separados (pedágio, adicionais, etc.)

### 4. Escala → Financeiro
- Alocações com valores
- Dados para rateio de custos

### 5. App Motorista → Financeiro
- Baixas de OS
- Comprovantes
- Evidências de entrega

---

## Relatórios Disponíveis

1. **MargemPorOS.tsx** - Margem por OS
2. **RelatorioMargemReal.tsx** - Margem real detalhada
3. **RelatorioFaturamentoCliente.tsx** - Faturamento por cliente
4. **RelatorioPagamentoPrestador.tsx** - Pagamentos a prestadores
5. **DREGerencial.tsx** - DRE Gerencial
6. **FluxoCaixaEnterprise.tsx** - Fluxo de caixa

---

## Integrações Futuras

### 1. Boleto - Efí
```typescript
// Estrutura para integração
interface ConfiguracaoEfí {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

// Funções a implementar
- gerarBoleto(data: BoletoData): Promise<BoletoRetorno>
- consultarBoleto(id: string): Promise<BoletoStatus>
- baixarBoleto(id: string): Promise<void>
```

### 2. Nota Fiscal - Focus NFe
```typescript
interface ConfiguracaoFocus {
  token: string;
  ambiente: 'producao' | 'homologacao';
}

// Funções a implementar
- emitirNFe(data: NFeData): Promise<NFeRetorno>
- consultarNFe(id: string): Promise<NFeStatus>
- cancelarNFe(id: string, motivo: string): Promise<void>
```

### 3. CNAB - Pagamentos
```typescript
interface ConfiguracaoCNAB {
  banco: string;
  agencia: string;
  conta: string;
  tipo: '240' | '400';
}

// Funções a implementar
- gerarRemessa(pagamentos: Pagamento[]): Promise<string>
- processarRetorno(arquivo: string): Promise<RetornoProcessado>
```

### 4. Conciliação Bancária
```typescript
interface TransacaoBancaria {
  data: string;
  valor: number;
  descricao: string;
  tipo: 'credito' | 'debito';
}

interface TransacaoSistema {
  os_id: string;
  valor: number;
  tipo: 'receita' | 'despesa';
}

// Funções a implementar
- importarExtrato(file: File): Promise<TransacaoBancaria[]>
- conciliar(transacoes: TransacaoBancaria[], sistema: TransacaoSistema[]): Promise<ConciliacaoResultado>
```

---

## Validações de Consistência

### Checklist de Integrity:
- [ ] Margem = Receita - Custos
- [ ] Total Recibos = Soma de baixas
- [ ] Total Pagamentos = Soma de pagamentos prestadores
- [ ] Saldo = Entradas - Saídas
- [ ] OS sem duplicidade em relatórios
- [ ] Campos opcionais tratados com fallback