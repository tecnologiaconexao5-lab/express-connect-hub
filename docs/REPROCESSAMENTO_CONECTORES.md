# Reprocessamento de Conectores

## Quando usar

O reprocessamento é útil quando:
- Uma chamada ao Zoho Mail falhou por erro de rede temporário
- A Evolution API (WhatsApp) estava offline momentaneamente
- O token OAuth2 expirou e foi renovado
- O servidor do conector voltou após uma queda

## Como funciona

### Fluxo

```
Usuário clica em "Reprocessar"
         │
         ▼
Busca execução original (payload, ação, parâmetros)
         │
         ▼
Verifica se já não foi concluída (evita duplicidade)
         │
         ▼
Chama o provider novamente com os mesmos parâmetros
         │
    ┌────┴────┐
    ▼         ▼
 Sucesso    Falha
    │         │
    ▼         ▼
Atualiza   Mantém
status p/  status p/
CONCLUIDA  FALHOU
    │         │
    ▼         ▼
Log:      Log:
sucesso   erro
```

### O que NÃO faz

- ❌ Não envia mensagem duplicada se a original já foi enviada
- ❌ Não altera payload original
- ❌ Não expõe credenciais ou tokens
- ❌ Não permite reprocessar execuções já concluídas

### Segurança

- O reprocessamento usa os mesmos parâmetros da execução original
- A tentativa é incrementada (`tentativa + 1`)
- O resultado é registrado em `ia_execucoes_conectores`
- Um log de auditoria é criado via `centralIaService`
- O provider verifica o modo (homologação/assistido/produção) antes de executar

### Limitações

- Se o conector estiver em modo `homologacao`, o reprocessamento também será simulado
- Se as credenciais estiverem expiradas, o reprocessamento falhará novamente
- Máximo de tentativas: não há limite artificial, mas o operador deve avaliar se faz sentido tentar novamente

## Interface

No **Monitor de Conectores > Logs de Execução**:
1. Encontre a linha com status "Falhou"
2. Clique no botão **Reprocessar**
3. Aguarde o resultado (aparece toast de sucesso ou erro)
4. A tabela é atualizada automaticamente

## Fallback Manual

Se o reprocessamento automático falhar:
1. **Zoho Mail:** Copie o conteúdo do email do log e envie manualmente pelo webmail Zoho
2. **WhatsApp:** Copie a mensagem e o número de telefone do log e envie manualmente pelo WhatsApp Web
3. Verifique se as credenciais no `.env` estão corretas
4. Teste a conexão do conector na aba Conectores da Central IA

## Logs

Todas as tentativas de reprocessamento são registradas:
- `ia_execucoes_conectores`: status atualizado, resultado, erro
- `centralIaService`: log com ação `conector_reprocessado`
- Console do navegador: prefixo `[ZohoMailProvider]` ou `[WhatsAppProvider]`
