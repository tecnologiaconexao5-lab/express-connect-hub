# Onboarding de Cliente no TMS

Guia para configurar um novo cliente no sistema Conexão Express TMS Enterprise.

---

## Passo 1: Cadastro do Cliente

1. Acesse **Gestão Comercial > Clientes**
2. Clique em **Novo Cliente**
3. Preencha:
   - Razão Social / Nome Fantasia
   - CNPJ/CPF
   - Endereço completo
   - Contatos (telefone, email)
4. Salve

## Passo 2: Tabela de Valores

1. Acesse **Gestão Comercial > Tabela de Valores**
2. Selecione o cliente
3. Defina valores por:
   - Origem → Destino
   - Tipo de veículo/carga
   - KM rodado
   - Peso ou volume

## Passo 3: Configuração Financeira

1. Acesse **Financeiro > Contas a Receber**
2. Configure:
   - Condições de pagamento
   - Dias de faturamento
   - Regras de multa/juros

## Passo 4: Acesso ao Portal do Cliente

O cliente pode acessar:
- **URL:** `https://app.conexaoexpress.com.br/portal-cliente`
- **Funcionalidades:**
  - Consultar OS em andamento
  - Histórico de entregas
  - Comprovantes (POD)
  - Financeiro (boleto, extrato)

### Criar Usuário do Cliente

1. Vá em **Admin > Empresas**
2. Selecione o tenant do cliente
3. Aba **Usuários**
4. Clique em **Convidar Usuário**
5. Defina papel como `cliente`
6. Compartilhe o link de convite com o cliente

## Passo 5: Contrato

1. Acesse **Contratos Automáticos**
2. Use o construtor de modelos para criar contrato personalizado
3. Gere o contrato e envie para assinatura

## Passo 6: Teste Operacional

1. Crie uma OS de teste no **Apoio Operacional > Ordens de Serviço**
2. Atribua à escala
3. Acompanhe no **Torre de Controle**
4. Confira o financeiro gerado

## Fluxo de Convite

```
Admin cria convite → Link gerado → Enviado ao cliente
                                          ↓
                              Cliente acessa link
                                          ↓
                    Já tem conta? ── Sim → Login
                        │
                       Não
                        ↓
                  Cadastro (SignUp)
                        ↓
                  Vínculo automático
                        ↓
                  Acesso liberado
```
