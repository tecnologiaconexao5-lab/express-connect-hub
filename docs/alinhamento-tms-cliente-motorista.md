# Alinhamento TMS / Portal Cliente / App Motorista

## Visão Geral

O Express Connect Hub é um TMS (Transportation Management System) completo que integra três pontos de acesso:

1. **TMS Principal** (Express Connect Hub) - Painel administrativo
2. **Portal Cliente** (Lovable/PWA) - Área do cliente
3. **App Motorista** (PWA) - Área do prestador/motorista

Todos os três sistemas compartilham o mesmo banco de dados Supabase como fonte única de verdade.

---

## Arquitetura de Dados

### Tabelas Compartilhadas

| Tabela | Descrição | Acesso TMS | Acesso Cliente | Acesso Motorista |
|--------|-----------|------------|-----------------|------------------|
| `clientes` | Cadastro de clientes | Completo | Próprio perfil | Leitura |
| `prestadores` | Cadastro de prestadores/motoristas | Completo | Leitura | Próprio perfil |
| `veiculos` | Veículos vinculados a prestadores | Completo | Leitura (do próprio) | Próprios veículos |
| `ordens_servico` | Ordens de serviço | Completo | Próprias OS | OS aceita |
| `os_enderecos` | Endereços de coleta/entrega OS | Completo | Próprios | Visualiza |
| `os_documentos` | Documentos da OS (CTe, NF, etc) | Completo | Download | Upload |
| `financeiro_receber` | Contas a receber | Completo | Próprias faturas | - |
| `financeiro_pagar` | Contas a pagar prestadores | Completo | - | Próprios pagamentos |
| `documentos_prestadores` | Documentos do prestador | Completo | - | Upload/follow-up |
| `prestadores_ocorrencias` | Ocorrências do prestador | Completo | - | Registro |
| `mensagens` / logs | Mensagens WhatsApp/Email | Completo | Histórico | Recebimento |

---

## Fluxo de Dados

### TMS → Cliente → Motorista

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   TMS ADMIN     │────▶│ SUPABASE        │────▶│ PORTAL CLIENTE │
│   (Backend)     │     │ (Fonte Única)   │     │   (Frontend)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cria Cliente    │     │ clientes        │     │ Consulta OS     │
│ Cria OS          │     │ ordens_servico │     │ Baixa comprov.  │
│ Gera Financeiro │     │ financeiro_*   │     │ Acompanha status│
│ Emite Fiscal    │     │ documentos      │     │ NFS-e/CT-e/XML  │
│ Dispara WhatsApp│     │ messages_log    │     │ Boletos         │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                    │
                                    ▼
                         ┌─────────────────┐
                         │  APP MOTORISTA  │
                         │   (PWA)         │
                         └─────────────────┘
                                    │
                                    ▼
                         ┌─────────────────┐
                         │ Recebe operação │
                         │ Aceita/Recusa   │
                         │ Envia localiz.  │
                         │ Envia docs      │
                         │ Comprovante     │
                         │ Ocorrências     │
                         │ Confirmaentrega │
                         └─────────────────┘
```

---

## Funcionalidades por Sistema

### TMS Principal (Express Connect Hub)

**Funcionalidades:**
- Cadastro completo de clientes
- Cadastro completo de prestadores
- Gestão de OS (criação, edição, seguimiento)
- Gestão financeira (contas a receber/pagar)
- Emissão fiscal (CT-e, NFS-e, MDF-e)
- Integração WhatsApp (n8n + Evolution API)
- Integração IA (Groq/Gemini)
- Tracking e rastreamento
- Relatórios e dashboards
- Gestão de ocorrências
- Controle de qualidade

**Tabelas utilizadas:**
- `clientes`, `prestadores`, `veiculos`
- `ordens_servico`, `os_enderecos`, `os_documentos`
- `financeiro_receber`, `financeiro_pagar`
- `documentos_prestadores`, `prestadores_ocorrencias`
- `mensagens_log`, `rastreamento_motorista` (futuro)

---

### Portal Cliente (Lovable/PWA)

**Funcionalidades:**
- Login via email/senha ou magic link
- Consulta de OS próprias
- Aprovação de orçamentos
- Download de comprovantes (NF, CTRC, XML)
- Acompanhamento de status em tempo real
- Download de NFS-e, CT-e, XML, boletos
- Visualização de faturas e histórico
- Notificações Push

**Acesso a dados:**
- Apenas clientes autenticados
- Visualiza apenas suas próprias OS
- Visualiza apenas suas faturas
- Download de documentos das suas OS
- Rastreamento de operações ativas

**Segurança:**
- RLS (Row Level Security) no Supabase
- Cada cliente vê apenas seus dados

---

### App Motorista (PWA)

**Funcionalidades:**
- Login via código/NF-e ou magic link
- Recebimento de operações por push
- Aceitar/recusar operações
- Envio de localização em tempo real
- Upload de documentos (CNH, CRLV, comprovantes)
- Registro de ocorrências
- Envio de comprovante de entrega
- Confirmação de entrega
- Visualização de Earnings
- Histórico de operações

**Acesso a dados:**
- Apenas prestadores autenticados
- Visualiza apenas operações aceitas
- Manipula apenas seus próprios documentos
- Registra ocorrências nas suas OS

**Segurança:**
- RLS (Row Level Security) no Supabase
- Cada prestador mexe apenas nos seus dados

---

## Integrações Futuras

### WhatsApp (n8n + Evolution API)
- Envio automático de mensagens
- Notificações de OS
- Alertas de pagamento
- Confirmação de entrega
- Chat com cliente/motorista

### IA (Groq/Gemini)
- Geração automática de mensagens
- Resumo de ocorrências
- Análise de documentos
- Chatbots para cliente/motorista

### Banco (Efí)
- Geração de boletos
- Recibos автоматикос
- Controle de recebimentos

### Focus NFe
- Emissão de CT-e
- Emissão de NFS-e
- MDF-e

### App Motorista PWA
- Push notifications
- GPS em tempo real
- Câmera para fotos/comprovantes
- Assinatura digital

---

## Sincronização

### Tempo Real
- Supabase Realtime para atualizar status
- Reflects instantaneamente em todos os sistemas

### Dados Offline
- App Motorista: suporte a modo offline
- Sincroniza quando online

---

## Conclusão

O Supabase é a **fonte única de verdade** para todos os três sistemas. Qualquer operação precisa ser primeiramente registrada no TMS e refletida nas tabelas compartilhadas para que Cliente e Motorista tenham acesso.

**Próximos passos:**
1. Implementar n8n + WhatsApp
2. Desenvolver App Motorista PWA
3. Implementar Portal Cliente Lovable
4. Integração Efí Bank
5. Integração Focus NFe
6. Deploy em VPS

---

*Documento atualizado em: 07/05/2026*