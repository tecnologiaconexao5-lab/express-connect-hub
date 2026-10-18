# Próximas Integrações - Checklist

## Visão Geral
Ordenação correta das integrações para o TMS, priorizando o fluxo operacional completo.

---

## 1. n8n + Evolution API + WhatsApp
**Prioridade:** ALTA | **Complexidade:** MÉDIA | **Dependências:** Supabase (OK)

### Checklist
- [ ] Configurar servidor VPS para n8n
- [ ] Instalar n8n na VPS
- [ ] Configurar Evolution API (WhatsApp)
- [ ] Criar workflows n8n para:
  - [ ] Envio de mensagem automática OS criada
  - [ ] Notificação de status alteração
  - [ ] Alerta de pagamento aprovado
  - [ ] Confirmação de entrega ao cliente
  - [ ] Notificação de nova OS ao prestador
- [ ] Configurar Webhook no Supabase
- [ ] Criar tabela `mensagens_log` se não existir
- [ ] Testar fluxos de mensagens
- [ ] Monitorar status no painel n8n

### Arquivos de referência:
- `docs/WEBHOOK_WHATSAPP_N8N_TMS.md`
- `docs/integracoes-n8n.md`

---

## 2. Groq/Gemini para Mensagens Autorizadas
**Prioridade:** ALTA | **Complexidade:** ALTA | **Dependências:** n8n (pendente)

### Checklist
- [ ] Configurar API Groq ou Gemini
- [ ] Criar função no Supabase/Edge Functions:
  - [ ] Geração de mensagem personalizada
  - [ ] Resumo de ocorrência
  - [ ] Análise de documento
- [ ] Integrar com n8n para mensagens automáticas
- [ ] Criar UI de teste no TMS
- [ ] Configurar límites e custos
- [ ] Testar geração de mensagens

---

## 3. App Motorista PWA
**Prioridade:** ALTA | **Complexidade:** ALTA | **Dependências:** Supabase (OK)

### Checklist
- [ ] Desenvolver PWA com:
  - [ ] Login por código/NF-e ou magic link
  - [ ] Lista de operações disponíveis
  - [ ] Aceitar/recusar operação
  - [ ] GPS tracking em tempo real
  - [ ] Câmera para fotos/comprovantes
  - [ ] Upload de documentos
  - [ ] Registro de ocorrências
  - [ ] Envio de comprovante
  - [ ] Push notifications
- [ ] Configurar Service Worker
- [ ] Configurar PWA manifest
- [ ] Testar em produção
- [ ] Publicar na Play Store (opcional)

### Tabelas Supabase necessárias:
- `prestadores` ✓ (existente)
- `ordens_servico` ✓ (existente)
- `veiculos` ✓ (existente)
- `prestadores_ocorrencias` ✓ (criada)
- `rastreamento_motorista` (futuro - criar)

---

## 4. Portal Cliente Lovable
**Prioridade:** ALTA | **Complexidade:** MÉDIA | **Dependências:** Supabase (OK)

### Checklist
- [ ] Configurar projeto Lovable
- [ ] Implementar autenticação:
  - [ ] Login email/senha
  - [ ] Magic link (opcional)
- [ ] Desenvolver telas:
  - [ ] Dashboard cliente
  - [ ] Lista de OS
  - [ ] Detalhe OS com timeline
  - [ ] Aprovação de orçamentos
  - [ ] Download de documentos
  - [ ] NFS-e / CT-e / XML
  - [ ] Boletos / faturas
  - [ ] Rastreamento
  - [ ] Contato/suporte
- [ ] Configurar RLS no Supabase
- [ ] Publicar e testar

### Tabelas Supabase necessárias:
- `clientes` ✓ (existente)
- `ordens_servico` ✓ (existente)
- `os_enderecos` ✓ (existente)
- `os_documentos` ✓ (existente)
- `financeiro_receber` ✓ (existente)

---

## 5. Efí Bank - Boletos / Pix (HOMOLOGAÇÃO)
**Prioridade:** MÉDIA | **Complexidade:** MÉDIA-ALTA (mTLS) | **Dependências:** Supabase Edge Functions

> SEGURANÇA: credenciais e certificado Efí são SERVER-SIDE (Supabase Secrets).
> NUNCA usar prefixo `VITE_` para Client Secret ou certificado — o prefixo `VITE_`
> embute a variável no bundle do frontend. Nenhum valor real em código, docs, git ou logs.

### Secrets (Supabase Secrets — backend, HML) — SOMENTE NOMES
- EFI_ENVIRONMENT        → "homologacao"
- EFI_CLIENT_ID_HML      → Client ID (HML)
- EFI_CLIENT_SECRET_HML  → Client Secret (HML)
- EFI_CERTIFICATE_HML    → certificado do cliente (PEM X.509, base64)
- EFI_PRIVATE_KEY_HML    → chave privada do cliente (PEM PKCS#8, base64)
  (Deno exige `cert` + `key` separados; PKCS#12/.p12 NÃO é aceito direto.
   Converter o .p12 para PEM/PKCS#8 FORA do repositório. NÃO copiar o .p12.)

### Checklist
- [ ] Criar conta Efí Bank (se não tiver)
- [ ] Obter credentials de API (HML) e certificado HML
- [ ] Converter .p12 → cert PEM + key PEM (PKCS#8) e registrar SOMENTE nos Secrets
- [ ] Criar Edge Function `efi-banking` para:
  - [ ] Criar cobranças/boletos (API Cobranças)
  - [ ] Consultar status
  - [ ] Baixar PDF boleto
  - [ ] Cancelar boleto
  - [ ] Pagamento Pix a prestador (API Pix)
- [ ] Integrar com `financeiro_receber` (anexar identificadores; baixar o MESMO recebível)
- [ ] Integrar com `pagamentos_prestadores` (baixar o MESMO pagamento via RPC existente)
- [ ] Adicionar botão "Gerar Boleto" no Portal Cliente

---

## 6. Focus NFe - Fiscal
**Prioridade:** ALTA | **Complexidade:** ALTA | **Dependências:** Supabase (OK)

### Checklist
- [ ] Criar conta Focus NFe (se não tiver)
- [ ] Obter token API
- [ ] Configurar variável:
  - [ ] VITE_FOCUS_TOKEN
  - [ ] VITE_FOCUS_AMBIENTE (homologação/produção)
- [ ] Implementar na tela /fiscal:
  - [ ] Emissão CT-e
  - [ ] Emissão NFS-e
  - [ ] MDF-e
  - [ ] Consulta status
  - [ ] Download XML
- [ ] Configurar callbacks/webhooks
- [ ] Criar tabela `fiscal_events` para logs

### Tabelas Supabase necessárias:
- `ordens_servico` ✓ (existente)
- `os_documentos` ✓ (existente)

---

## 7. Deploy VPS
**Prioridade:** CRÍTICA | **Complexidade:** ALTA | **Dependências:** Todas

### Checklist
- [ ] Escolher provedor VPS (DigitalOcean/Linode/Hetzner)
- [ ] Configurar servidor:
  - [ ] Ubuntu/Debian
  - [ ] Docker + Docker Compose
  - [ ] Nginx como reverse proxy
  - [ ] SSL (Let's Encrypt)
  - [ ] Firewall
- [ ] Configurar Supabase (self-hosted ou cloud):
  - [ ] Se cloud: verificar credenciais
  - [ ] Se self-hosted: configurar Docker
- [ ] Deploy do frontend:
  - [ ] Build produção
  - [ ] Configurar Nginx
  - [ ] Domínio e SSL
- [ ] Deploy n8n:
  - [ ] Docker n8n
  - [ ] Variáveis de ambiente
  - [ ] persistence volumes
- [ ] Configurar domínios:
  - [ ] tms.expressconnect.com.br (principal)
  - [ ] app.expressconnect.com.br (motorista)
  - [ ] cliente.expressconnect.com.br (portal)
- [ ] Monitoramento:
  - [ ] PM2 para Node
  - [ ] Logs centralizados
  - [ ] Uptime monitoring

---

## Ordem de Implementação Recomendada

```
FASE 1: Infraestrutura Base (Semana 1-2)
├── Supabase ✓ (existente)
├── n8n + WhatsApp
└── Deploy VPS (básico)

FASE 2: Operações (Semana 3-4)
├── App Motorista PWA
└── Integração WhatsApp (n8n)

FASE 3: Cliente (Semana 5-6)
└── Portal Cliente Lovable

FASE 4: Financeiro (Semana 7-8)
├── Efí Bank - Boletos
└── Focus NFe - Fiscal

FASE 5: IA (Semana 9+)
└── Groq/Gemini

FASE 6: Produção (Semana 10+)
└── Deploy completo VPS
```

---

## Dependências entre Integrações

```
WhatsApp (n8n)
    │
    ├─▶ App Motorista (precisa notificação push)
    │
    └─▶ Portal Cliente (precisa notificação)

Groq/Gemini
    │
    └─▶ n8n (para mensagens automáticas)

Efí Bank
    │
    └─▶ Portal Cliente (para pagar/view boleto)

Focus NFe
    │
    ├─▶ TMS (já implementado parcialmente)
    └─▶ Portal Cliente (visualizar XML/NFe)
```

---

## Status Atual

| Integração | Status | Notas |
|------------|--------|-------|
| Supabase | ✅ COMPLETO | Backend funcionando |
| TMS Principal | ✅ COMPLETO | 90% das features |
| n8n + WhatsApp | ⏳ PENDENTE | Precisa VPS |
| Groq/Gemini | ⏳ PENDENTE | Precisa n8n |
| App Motorista | ⏳ PENDENTE | PWA a desenvolver |
| Portal Cliente | ⏳ PENDENTE | Lovable a desenvolver |
| Efí Bank | ⏳ PENDENTE | Credenciais pendentes |
| Focus NFe | ⚠️ PARCIAL | UI existe, API pendente |
| Deploy VPS | ⏳ PENDENTE | Precisa configurar |

---

## Contatos e Recursos

- **Supabase:** https://supabase.com
- **n8n:** https://n8n.io
- **Evolution API:** https://github.com/Atlas-OS/Evolution
- **Groq:** https://groq.com
- **Gemini:** https://gemini.google.com
- **Lovable:** https://lovable.dev
- **Efí Bank:** https://sefaz.efi.com.br
- **Focus NFe:** https://focusnfe.com.br
- **DigitalOcean:** https://digitalocean.com

---

*Documento atualizado em: 07/05/2026*