# Checklist de Venda e Implantação

## Pré-Venda

- [ ] **Apresentação do sistema** (demonstração ao vivo)
- [ ] **Identificar necessidades:**
  - [ ] Quantas OS/mês?
  - [ ] Frota própria ou terceiros?
  - [ ] Precisa de NFSe/CT-e?
  - [ ] Precisa de portal do cliente?
  - [ ] Precisa de integração contábil?
- [ ] **Definir escopo:**
  - [ ] Módulos necessários
  - [ ] Número de usuários
  - [ ] Funcionários digitais (robôs IA)
  - [ ] Conectores externos (Zoho, WhatsApp)
- [ ] **Proposta comercial** enviada
- [ ] **Contrato** assinado

## Implantação Técnica

### Infraestrutura

- [ ] `.env` configurado:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `VITE_MAPBOX_ACCESS_TOKEN` (se usar roteirização)
  - [ ] `VITE_AUTH_DEMO_MODE=false` (produção)
- [ ] Chaves de API externas (se contratado):
  - [ ] `VITE_EVOLUTION_API_KEY` (WhatsApp)
  - [ ] `VITE_ZOHO_EMAIL_API_KEY` (Email)
  - [ ] `VITE_GEMINI_API_KEY` (IA generativa)
- [ ] Supabase migrations aplicadas:
  - [ ] `supabase db push --include-all`

### Configuração do Tenant

- [ ] **Criar tenant** (Admin > Empresas)
- [ ] **Convidar usuários:**
  - [ ] Admin
  - [ ] Operadores
  - [ ] Financeiro
  - [ ] Comercial
- [ ] **Configurar permissões** dos usuários

### Cadastros Iniciais

- [ ] **Unidades** (filiais/CDs)
- [ ] **Locais** (bases operacionais)
- [ ] **Tipos de veículo**
- [ ] **Setores e centros de custo**
- [ ] **Departamentos**
- [ ] **Prestadores** cadastrados
- [ ] **Clientes** cadastrados
- [ ] **Tabela de valores**

### Operação

- [ ] **Criar OS de teste**
- [ ] **Testar escala** de prestadores
- [ ] **Testar emissão CT-e/NFSe** (se aplicável)
- [ ] **Testar roteirização** (se aplicável)
- [ ] **Verificar financeiro** (receber/pagar)
- [ ] **Testar portal do cliente**
- [ ] **Testar app prestador**

### Funcionários Digitais (Robôs IA)

- [ ] **Ativar robôs necessários:**
  - [ ] Robô Comercial
  - [ ] Robô Operacional
  - [ ] Robô Financeiro
  - [ ] Robô Fiscal
  - [ ] Robô Recrutamento
- [ ] **Configurar ferramentas** dos robôs
- [ ] **Configurar conectores** (modo PRODUCAO_ASSISTIDA)
- [ ] **Testar execução real** de pelo menos uma ferramenta

### Treinamento

- [ ] **Treinamento de admin** (1 dia)
- [ ] **Treinamento de operadores** (1 dia)
- [ ] **Treinamento de financeiro** (0,5 dia)
- [ ] **Manual do usuário** entregue
- [ ] **Documentação de processos** definida

### Go-Live

- [ ] **Ambiente de produção** verificado
- [ ] **Backup** realizado
- [ ] **Desligar modo demo:** `VITE_AUTH_DEMO_MODE=false`
- [ ] **Migração de dados** (se aplicável)
- [ ] **Período de acompanhamento** (1 semana)
- [ ] **Suporte** definido (canal/horário)

## Pós-Implantação

- [ ] **Revisão de 30 dias**
- [ ] **Métricas de adoção**:
  - [ ] OS criadas/dia
  - [ ] Usuários ativos
  - [ ] Robôs em operação
- [ ] **Ajustes de permissões** se necessário
- [ ] **Próximos passos** definidos
