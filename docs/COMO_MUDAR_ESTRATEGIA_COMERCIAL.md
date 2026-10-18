# Como Mudar a Estrategia Comercial do Hunter IA

> Nenhuma linha de codigo precisa ser alterada.
> Toda a estrategia e configurada via banco de dados e UI da Central IA.

## Acessando a Configuracao

1. Acesse a **Central IA** no sistema
2. Va ate a aba **Hunter Config**
3. Navegue entre as 8 abas de configuracao:
   - **Geral** — modo de operacao, fontes, horarios
   - **Alvos** — segmentos, estados, palavras-chave, concorrentes
   - **Score** — pesos do scoring, thresholds, probabilidades
   - **Tom Voz** — estilo, formalidade, regras de abordagem
   - **Canais** — quais canais usar e ordem de prioridade
   - **Regras** — anti-duplicidade e follow-up
   - **IA** — provedor, modelo, temperatura, tokens
   - **Limites** — leads/dia, prospeccoes, orcamento

Apos alterar, clique em **"Salvar Estrategia"**. As mudancas sao aplicadas no proximo ciclo.

---

## O que pode ser configurado (sem codigo)

### 1. Segmentos Alvo
**Onde:** Aba "Alvos" > "Segmentos Alvo"
**O que faz:** Define quais segmentos o Hunter vai prospectar. A IA gera empresas apenas destes segmentos.

Exemplo para focar apenas em saude:
```
Farmacias, Laboratorios, Hospitais, Clinicas, Materiais Medicos
```

### 2. Segmentos Proibidos
**Onde:** Aba "Alvos" > "Segmentos Proibidos"
**O que faz:** Bloqueia segmentos inteiros. O Hunter nunca cria leads aqui.

### 3. Concorrentes (Palavras Bloqueadas)
**Onde:** Aba "Alvos" > "Concorrentes"
**O que faz:** Bloqueia empresas que contenham estas palavras no nome ou segmento.

Default:
```
transportadora, operador logistico, empresa de frete, motoboy, logistica, transportes
```

### 4. Palavras-chave de Prospeccao
**Onde:** Aba "Alvos" > "Palavras-chave"
**O que faz:** Passadas no prompt da IA para encontrar empresas relevantes.

### 5. Estados e Regioes
**Onde:** Aba "Alvos" > "Estados"
**O que faz:** Define os estados onde prospectar.

### 6. Score IA — Pesos
**Onde:** Aba "Score" > "Pesos do Score IA"
**O que faz:** Cada criterio de scoring tem um peso numerico. A soma maxima e 100.

| Criterio | Peso Default | O que significa |
|----------|-------------|-----------------|
| segmento_prioritario | 20 | Se o segmento esta na lista de alvos |
| entregas_frequentes | 15 | Empresa faz muitas entregas |
| reclamando_entregas | 12 | Empresa reclama de logistica atual |
| porte_grande | 15 | Empresa de grande porte |
| volume_alto | 10 | Alto volume de entregas |
| necessidade_logistica | 10 | Necessidade logistica identificada |

Para calibrar: se leads quentes demais estao sendo descartados, aumente `segmento_prioritario`. Se leads frios estao sendo aprovados, aumente `score_minimo_auto`.

### 7. Thresholds de Temperatura
**Onde:** Aba "Score" > "Thresholds"
**O que faz:** Define as notas de corte para cada classificacao.

| Classificacao | Default | Cor |
|---------------|---------|-----|
| Em chamas | >= 80 | Vermelho |
| Quente | >= 60 | Laranja |
| Morno | >= 40 | Amarelo |
| Frio | < 40 | Azul |

### 8. Lead Quente
**Onde:** Aba "Score" > "Lead Quente"
**O que faz:** Define o score minimo e criterios extras para disparar alerta de lead quente.

### 9. Tom de Voz
**Onde:** Aba "Tom Voz"
**O que faz:** Muda completamente a personalidade do Hunter nas mensagens.

Opcoes de estilo:
- **Profissional** — linguagem corporativa classica
- **Consultivo** — tom de consultor, oferecendo solucoes (default)
- **Casual** — mais informal e direto

Opcoes de formalidade:
- **Formal** — "Prezado(a), ..."
- **Semiformal** — "Ola, ..." (default)
- **Informal** — "Fala, ..."

### 10. Regras de Abordagem
**Onde:** Aba "Tom Voz" > "Regras de tom"
**O que faz:** Passadas diretamente no prompt da IA como instrucoes de comportamento.

Default:
```
Seja natural e profissional
Nunca pareca spam ou generico
Use linguagem corporativa brasileira
Seja objetiva e mostre valor
Maximo 3 paragrafos por mensagem
```

### 11. Nome da Empresa nos Prompts
**Onde:** Aba "Tom Voz" > "Abordagem" > "Nome da empresa no prompt"
**O que faz:** O Hunter se apresenta com este nome nas mensagens.

### 12. Canais de Abordagem
**Onde:** Aba "Canais"
**O que faz:** Ativa/desativa cada canal e define a ordem de prioridade.

### 13. Anti-Duplicidade
**Onde:** Aba "Regras" > "Anti-Duplicidade"
**O que faz:** Define quais criterios usar para evitar duplicatas.

Criterios disponiveis: empresa, cnpj, email, telefone, dominio

### 14. Follow-up
**Onde:** Aba "Regras" > "Follow-up"
**O que faz:** Define dias, quantidade, recontato e se mensagem e personalizada por IA.

### 15. Provedor IA e Modelo
**Onde:** Aba "IA"
**O que faz:** Permite trocar de provedor/modelo sem codigo.

Para trocar de Groq para Gemini, por exemplo:
1. Va em "IA" > "Provider"
2. Selecione "gemini"
3. Em "Modelo", digite "gemini-1.5-pro"
4. Salve

### 16. Temperatura e Tokens por Operacao
**Onde:** Aba "IA" > "Temperatura" e "Max Tokens"
**O que faz:** Controla criatividade e tamanho das respostas para cada etapa do ciclo.

### 17. Limites Operacionais
**Onde:** Aba "Limites" > "Limites Operacionais"
**O que faz:** Controla leads/dia, prospeccoes/ciclo e tokens/ciclo.

### 18. Orcamento
**Onde:** Aba "Limites" > "Orcamento"
**O que faz:** Define orcamento diario/mensal em USD. Alerta quando % e atingido.

---

## Modos de Operacao

| Modo | Comportamento |
|------|--------------|
| Manual | Hunter nao executa ciclos automaticos. So gera relatorios. |
| Assistido | Gera leads e salva abordagens como **rascunho** (nao envia). |
| Automatico | Ciclo completo: prospecta, cria leads, gera abordagens como **pendente**. |

---

## Exemplos de Mudanca de Estrategia

### Caso 1: Focar apenas em E-commerce no Sudeste
1. Aba "Alvos" > "Segmentos Alvo": deixar apenas "E-commerce"
2. Aba "Alvos" > "Estados": selecionar SP, RJ, MG
3. Aba "Score" > "Pesos": aumentar `segmento_prioritario` para 30
4. Salvar

### Caso 2: Tom mais formal para clientes corporativos
1. Aba "Tom Voz" > "Estilo": "Profissional"
2. Aba "Tom Voz" > "Formalidade": "Formal"
3. Aba "Tom Voz" > "Regras": adicionar "Use tratamento formal (Sr./Sra.)"
4. Salvar

### Caso 3: Reduzir custos de IA
1. Aba "IA" > "Modelo": trocar para "llama-3.1-8b-instant" (mais barato)
2. Aba "Limites" > "Max tokens por ciclo": reduzir para 20000
3. Aba "Limites" > "Prospeccoes por ciclo": reduzir para 5
4. Salvar

### Caso 4: Bloquear um novo concorrente
1. Aba "Alvos" > "Concorrentes": adicionar "transportes rapidos"
2. Salvar

### Caso 5: Aumentar rigor do score
1. Aba "Score" > "Pesos": ajustar pesos para totalizar 100
2. Aba "Score" > "Lead Quente": aumentar score minimo para 85
3. Aba "Alvos" > "Descarte": aumentar score minimo para 30
4. Salvar

---

## Estrutura no Banco de Dados

A configuracao completa fica em `comercial_hunter_config.estrategia` (JSONB).

Nao edite manualmente no banco a menos que saiba o que esta fazendo.
Sempre prefira a UI da Central IA.

---

## Validacao

Apos alterar a estrategia:
1. Va ate a aba **Comercial IA** (dashboard)
2. Verifique o resumo "Estrategia Ativa" — mostra os parametros vigentes
3. Clique em **"Executar Ciclo"** para testar
4. Acompanhe os logs na Central IA > Logs
