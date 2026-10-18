# Guia Operacional da Empresa Digital

Bem-vindo ao **Conexão Express TMS Enterprise**. Este guia descreve como a plataforma opera, seus módulos principais e o ecossistema de funcionários digitais.

---

## 1. Visão Geral da Plataforma

A Conexão Express TMS é um sistema de gestão de transportes com:
- **Portal Administrativo** (TMS Web) — para gestão interna
- **Portal do Cliente** — para clientes acompanharem entregas e financeiro
- **App Prestador** — para prestadores e motoristas
- **Central de Robôs IA** — funcionários digitais autônomos

## 2. Módulos Principais

### Torre de Controle
Monitoramento em tempo real de todas as operações: OS em andamento, entregas, ocorrências.

### Gestão Comercial
- Cadastro de clientes
- Tabela de valores (frete por rota/tipo)
- Orçamentos e propostas

### Apoio Operacional
- Ordens de Serviço (OS)
- Escala de motoristas/prestadores
- Ocorrências e não conformidades
- Comprovantes de entrega (POD)
- Roteirização
- Programação de entregas
- Devoluções e reentregas

### Gestão de Frota
- Veículos e cavalos
- Monitoramento de combustíveis
- Manutenção preventiva/corretiva
- Abastecimento
- Documentos e multas
- Custos operacionais

### Financeiro Enterprise
- Contas a Receber (clientes)
- Contas a Pagar (prestadores/fornecedores)
- Fluxo de caixa
- DRE gerencial
- Plano de contas
- Conciliação bancária
- Pagamento em lote (CNAB)
- Centro de resultado
- Provisões
- Seguros auto

### Fiscal & Faturamento
- Emissão de CT-e
- Emissão de MDF-e
- Lotes de faturamento
- Integração contábil (XML)

## 3. Funcionários Digitais (Robôs IA)

A plataforma conta com 8 robôs operacionais:

| Robô | Setor | Função |
|------|-------|--------|
| Robô Comercial (P0) | Comercial | Consultar leads, registrar follow-up |
| Robô Operacional (P0) | Operação | Consultar OS, criar escala |
| Robô Financeiro (P0) | Financeiro | Consultar financeiro, saldo |
| Robô Fiscal (P0) | Fiscal | Validar XML, conferir CT-e/NFSe |
| Robô Recrutamento (P0) | RH | Analisar candidatos, registrar avaliação |
| Gerente Comercial (P1) | Comercial | Supervisionar leads, metas |
| Gerente Operações (P1) | Operação | Supervisionar OS, escala |
| Diretor de Tecnologia (P1) | Estratégico | Decisões, auditoria, alertas |

## 4. Ciclo de Vida de uma OS

1. **Entrada:** pedido do cliente → portal ou comercial
2. **Planejamento:** roteirização → programação → escala
3. **Execução:** coleta → transporte → entrega → POD
4. **Financeiro:** faturamento → recebimento → comissão
5. **Fechamento:** conferência fiscal → contabilidade

## 5. Ambiente Multi-tenant

O sistema suporta múltiplas empresas (tenants). Cada tenant tem seus próprios:
- Usuários e permissões
- Clientes e prestadores
- Configurações fiscais e financeiras
- Dados operacionais

## 6. Autenticação e Sessão

- Login via Supabase Auth (email/senha ou Google)
- Sessão expira após período de inatividade
- Sessão expirada redireciona para `/login?redirect=...`
- Modo demo: `VITE_AUTH_DEMO_MODE=true` (8 usuários pré-cadastrados)

## 7. Conectores Externos

| Conector | Função | Status |
|----------|--------|--------|
| Zoho Mail | Envio de email | Homologação |
| Evolution API | WhatsApp | Homologação |
| Groq/OpenAI/Gemini | IA e LLM | Homologação |
| SEFAZ | CT-e/MDF-e | Produção |
| Prefeituras | NFSe | Produção |
| Mapbox | Roteirização | Produção |
