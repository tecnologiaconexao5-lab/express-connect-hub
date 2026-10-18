# Validacao de Producao — Roteiro de Teste Manual

> **Missao:** 06 | **Data:** 2026-06-26 | **Tempo:** ~30 min

---

## 1. Login e Acesso

- [ ] Acessar URL de producao
- [ ] Tela de login aparece?
- [ ] Fazer login com credenciais validas
- [ ] Dashboard carrega apos login?
- [ ] Fazer logout — volta para login?

---

## 2. Clientes

- [ ] Criar novo cliente (preencher todos os campos)
- [ ] Salvar — aparece na lista?
- [ ] Editar cliente — alteracoes persistem?
- [ ] Buscar cliente por nome — funciona?

---

## 3. Ordem de Servico

- [ ] Criar nova OS (todos os 6 passos)
- [ ] Selecionar cliente, prestador, veiculo
- [ ] Preencher valores
- [ ] Salvar — OS aparece na lista?
- [ ] Editar OS — alteracoes persistem?
- [ ] Status da OS visivel na lista?

---

## 4. Escala

- [ ] Criar escala vinculada a OS
- [ ] Alocar motorista e veiculo
- [ ] Trocar motorista (`trocarMotorista()`)
- [ ] Trocar veiculo (`trocarVeiculo()`)
- [ ] Cancelar escala
- [ ] Verificar se OS foi atualizada

---

## 5. Financeiro

- [ ] Contas a Receber — lista carrega?
- [ ] Fazer baixa parcial — valor restante correto?
- [ ] Fazer baixa total — status muda para "pago"?
- [ ] Estornar baixa (se disponivel)
- [ ] Contas a Pagar — lista carrega?
- [ ] DRE — dados aparecem?

---

## 6. Cancelamento

- [ ] Cancelar OS de teste
- [ ] Verificar se financeiro foi zerado
- [ ] Verificar se escala foi cancelada
- [ ] Historico da OS mostra cancelamento?

---

## 7. Dashboard

- [ ] Dashboard principal carrega?
- [ ] Numeros de OS batem com a lista?
- [ ] Graficos renderizam?
- [ ] Alertas operacionais aparecem?

---

## 8. Responsividade

- [ ] Abrir no notebook (1366x768)
- [ ] Abrir no desktop (1920x1080)
- [ ] Abrir no tablet (iPad)
- [ ] Abrir no celular — sidebar acessivel?
- [ ] Tabelas rolam horizontalmente no mobile?

---

## 9. Logs

- [ ] Abrir F12 → Console
- [ ] Navegar por 3-4 telas diferentes
- [ ] Nenhum erro vermelho no console?
- [ ] Nenhum warning critico?

---

## 10. Performance

- [ ] Primeiro carregamento: <5 segundos?
- [ ] Navegacao entre telas: <2 segundos?
- [ ] Salvar OS: <3 segundos?
- [ ] Dashboard: <4 segundos?

---

## Resultado

- [ ] **0 erros criticos encontrados** → APTO
- [ ] **1-2 erros menores** → Corrigir e re-testar
- [ ] **3+ erros ou erro P0** → NAO APTO — rollback

---

*Documento gerado para Missao 06 — OpenCode Go Pro*
