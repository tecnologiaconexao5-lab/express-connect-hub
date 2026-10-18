# Missão 108-L7 — Portal WhatsApp Enterprise Evolution API Real

**Status:** ✅ Concluído. 10/10 Playwright.

## O que foi feito

### ETAPA 2 — `portalWhatsAppService.ts` (NOVO)
- `buscarConversas(clienteId)` — consulta `crm_conversas` (canal=whatsapp, cliente_id filtrado), fallback para telefone do cliente em `clientes` se não houver conversa
- `buscarMensagens(conversaId)` — consulta `crm_mensagens` por conversa_id, ordenado cronologicamente
- `buscarTemplates()` — consulta `crm_templates_mensagem` (canal=whatsapp, ativo=true)
- `enviarMensagem()` — envia via `comunicacaoGatewayService.solicitarEnvioControlado()` + insere em `crm_mensagens`
- `verificarStatusConexao()` — testa Evolution API `/instance/connectionState/{instance}`, fallback sem chaves
- `inscreverMensagens()` — Supabase Realtime channel `crm_mensagens` filtrado por `cliente_id`

### ETAPA 3 — `PortalWhatsApp.tsx` reescrito
- **Painel duplo**: conversas à esquerda (scroll, busca, refresh), thread de mensagens à direita
- **Estados**: loading (spinner), vazio (placeholders), erro, fallback sem `clienteId`
- **Badge de conexão**: "Simulação" (homologação) / "Desconectado" / "Conectado"
- **Thread**: balões de mensagem com direção (sent/received), status (enviada/pendente/bloqueado), timestamp
- **Composer**: textarea + botão enviar (Enter rápido), seletor de templates, hint de aprovação
- **Realtime**: atualização automática de mensagens e conversas via Supabase Realtime

### ETAPA 4 — Sidebar do Portal Cliente
- Adicionado `{ id: "whatsapp", icon: MessageSquare, label: "WhatsApp" }` ao `itensSidebar`
- `PortalCliente.tsx` passa `clienteId={clienteData?.id}` ao `PortalWhatsApp`

### ETAPA 7 — Playwright (10/10 ✅)
| Teste | Status |
|-------|--------|
| 01. Aba WhatsApp carrega sem erros de console | ✅ |
| 02. Exibe texto WhatsApp após clicar na aba | ✅ |
| 03. Exibe fallback quando cliente não possui dados | ✅ |
| 04. Input de busca de conversas funciona | ✅ |
| 05. Botão de refresh recarrega conversas | ✅ |
| 06. Clicar em conversa abre thread de mensagens | ✅ |
| 07. Envio de mensagem pelo modal funciona | ✅ |
| 08. Navegação sem erros após interagir com WhatsApp | ✅ |
| 09. Fallback visual quando cliente não possui dados | ✅ |
| 10. Seletor de templates aparece quando disponível | ✅ |

## Validação
- `npx tsc --noEmit` → ✅ 0 erros
- `npm run build` → ✅ 38,14s
- Playwright: **10/10 passaram** (2,0 min)

## Pontuação de Prontidão do Portal Cliente Atualizada

| Dimensão | Antes M108-L7 | Depois M108-L7 |
|----------|:-------------:|:--------------:|
| WhatsApp | 0/10 | **8/10** |
| **Geral** | **6.8/10** | **7.5/10** |

## Pendências pós-L7
- Configurar `VITE_EVOLUTION_API_URL`, `VITE_EVOLUTION_API_KEY`, `VITE_INSTANCE` no `.env` para ativar envio real
- Configurar `VITE_WHATSAPP_PRODUCAO_ENABLED=true` para ativar gateway de produção
- Validar webhook Evolution API para receber mensagens de clientes

## Arquivos criados/modificados
- `src/services/portalCliente/portalWhatsAppService.ts` — NOVO (185 linhas)
- `src/components/portal-cliente/PortalWhatsApp.tsx` — reescrito (320 linhas)
- `src/pages/PortalCliente.tsx` — modificado (sidebar + props)
- `tests/e2e/missao108-l7-portal-whatsapp.spec.ts` — NOVO (10 testes)
- `MISSAO108L7_PORTAL_WHATSAPP_REAL.md` — NOVO (relatório)
