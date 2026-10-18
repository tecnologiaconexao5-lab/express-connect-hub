# BLOQUEIO DE INTEGRAÇÕES EXTERNAS — F2-A0-QA1

## Critérios para QA

Toda integração externa deve estar:
- Desabilitada por configuração (env var = false, vazia ou ausente)
- Ou apontando para ambiente sandbox/teste
- Ou bloqueada por firewall/network policy
- **Nunca** apontando para produção real

---

## Matriz de integrações

| Integração | Produção ativa | QA precisa bloquear? | Método de bloqueio | Status |
|------------|----------------|---------------------|-------------------|--------|
| **WhatsApp (Evolution API)** | Não (VITE_WHATSAPP_PRODUCAO_ENABLED=false) | ✅ Sim | Manter env var false; não configurar VITE_EVOLUTION_API_KEY | 📝 Já bloqueado |
| **Zoho Mail** | Não (VITE_ZOHO_EMAIL_API_KEY não configurado) | ✅ Sim | Não configurar chaves Zoho | 📝 Já bloqueado |
| **CT-e (Focus NFe)** | Sim (produção emite CT-e) | ✅ Sim | Configurar modo rascunho; não transmitir SEFAZ | ⚠️ Verificar |
| **NFSe** | Sim (produção emite NFSe) | ✅ Sim | Não configurar certificado digital | ⚠️ Verificar |
| **MDF-e** | Sim (produção emite MDF-e) | ✅ Sim | Não preencher dados de veículo/transportadora | ⚠️ Verificar |
| **Groq API** | Não (proxy-ia, sem chave) | ✅ Sim | Manter sem chave | 📝 Já bloqueado |
| **Gemini API** | Não (proxy-ia, sem chave) | ✅ Sim | Manter sem chave | 📝 Já bloqueado |
| **OpenAI API** | Não (proxy-ia, sem chave) | ✅ Sim | Manter sem chave | 📝 Já bloqueado |
| **Mapbox** | Sim (token em .env) | ☑️ Opcional | Usar token de teste ou placeholder | ⚠️ Verificar |
| **Supabase Edge Functions** | Sim (8 functions) | ✅ Sim | Requer deploy separado para QA | ❌ Bloqueado |
| **N8N** | Não (sem URL configurada) | ✅ Sim | Não configurar | 📝 Já bloqueado |
| **Cobrança/Boleto** | Sim (produção gera boletos) | ✅ Sim | Não configurar gateway de pagamento | ⚠️ Verificar |

---

## Configurações obrigatórias para QA

```bash
# No .env.qa:
VITE_WHATSAPP_PRODUCAO_ENABLED=false
VITE_COMUNICACAO_PRODUCAO_ASSISTIDA=false
# NÃO configurar:
# VITE_EVOLUTION_API_KEY=
# VITE_ZOHO_EMAIL_API_KEY=  
# VITE_GROQ_API_KEY=
# VITE_GEMINI_API_KEY=
```

## Integrações com risco de disparo real em QA

| Integração | Risco | Bloqueio |
|------------|-------|----------|
| Edge Function `focus-emissao` | **CRÍTICO** — Pode emitir CT-e real | Não fazer deploy em QA; remover secrets |
| Edge Function `whatsapp-recrutamento-webhook` | **ALTO** — Pode enviar WhatsApp | Não ativar webhook |
| Supabase Auth email | **MÉDIO** — Pode enviar email de reset | Desabilitar templates de email |
| Storage público | **BAIXO** — Dados de teste visíveis | Configurar buckets como privados |

## Verificações pós-provisionamento

```bash
# Confirmar que chaves de produção NÃO estão em QA
grep -r "uwrvzsjtpgaifkktpepn" .env.qa  # Deve retornar vazio

# Confirmar que URLs apontam para QA
grep "VITE_SUPABASE_URL" .env.qa  # Deve conter ref do QA, não uwrvzsjtpgaifkktpepn
```
