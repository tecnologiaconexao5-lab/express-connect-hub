# Tracking Cliente — Express Connect Hub / TMS

> **Missao:** 09 | **Data:** 2026-06-26

---

## 1. O Que Foi Implementado

### Tracking Publico (`/rastrear/:codigo`)
- Substituido mock (`setTimeout` com dados hardcoded) por **consultas reais ao Supabase**
- Busca por numero da OS OU ID da alocacao
- Exibe: status real, origem, destino, transportador, placa, data prevista
- Barra de progresso visual com 4 etapas (Registrado → Em Andamento → Em Transito → Entregue)
- Timeline de eventos carregada de `historico_alocacoes_escala` e `auditoria_operacional`
- Fallback honesto: "Atualizado pela operacao" quando nao ha GPS

---

## 2. O Que o Cliente Ve

| Informacao | Visivel? | Origem |
|-----------|----------|--------|
| Numero da OS | Sim | `ordens_servico.numero` |
| Status atual | Sim | Mapeado para linguagem clara |
| Origem / Destino | Sim | `ordens_servico` ou `alocacoes_escala` |
| Data prevista | Sim | `data_programada` |
| Transportador | Sim | Nome do prestador |
| Placa do veiculo | Sim | `veiculo_placa` |
| Timeline de eventos | Sim | Historico + auditoria |
| Barra de progresso | Sim | 4 etapas visuais |

---

## 3. O Que o Cliente NAO Ve (Protegido)

| Informacao | Protegido? |
|-----------|-----------|
| Margem / Lucro | Sim — nao exposto |
| Custos internos | Sim — nao exposto |
| Dados financeiros | Sim — nao exposto |
| Dados de outros clientes | Sim — filtrado por OS ID |
| Auditoria confidencial | Sim — apenas eventos publicos |

---

## 4. Como Funciona o Fallback

- Sem app motorista (PWA): status atualizado pela equipe operacional
- Timeline mostra "Atualizado pela equipe de operacao" nos eventos manuais
- Sem promessa de GPS em tempo real — honestidade com o cliente
- Mapa desabilitado (nao ha dados de GPS para mostrar)

---

## 5. Proximos Passos (Futuro)

1. Integrar PWA do motorista → eventos com GPS em tempo real
2. Adicionar foto do POD na timeline
3. Adicionar link "Falar com a operacao" (WhatsApp)
4. Enviar notificacao por e-mail quando status muda

---

*Documento gerado para Missao 09 — OpenCode Go Pro*
