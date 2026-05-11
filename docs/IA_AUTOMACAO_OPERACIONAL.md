# IA & Automação Central — TMS Conexão Express

## Visão Geral

O módulo de **IA & Automação Inteligente** tem como objetivo padronizar e distribuir a inteligência artificial dentro do TMS de forma setorizada. 
Em vez de ter uma única IA genérica que precisa saber de tudo (o que gera risco de "alucinações" ou quebra de fluxo), a IA atua baseada no **Contexto do Setor**.

## Arquitetura por Setores

A IA foi dividida em "departamentos virtuais":

1. **Comercial**: Especialista em follow-up, qualificação de leads e respostas a objeções.
2. **Operacional**: Focado em torre de controle, cobrança de status e alocação de motoristas.
3. **Recrutamento**: Treinado para analisar perfis, gerar links e enviar instruções iniciais.
4. **Financeiro**: Especialista em cobrança de baixas, envio de segundas vias e respostas a pagamentos.
5. **Monitoramento**: Focado em segurança, alertas de desvio de rota e acionamento de pânico.
6. **Fiscal**: Leitura de XMLs, identificação de NCMs e chaves de acesso.
7. **Cliente**: Portal do cliente, acompanhamento de cargas.
8. **Prestador/Motorista**: Atendimento via WhatsApp focado no motorista.

Cada setor possui seu próprio **Prompt Mestre (Instruções Principais)**, suas restrições (`O que NÃO pode fazer`) e seus gatilhos de escalonamento para humanos.

## Limites da IA (Guardrails)

A IA atua dentro de limites estritos configurados via painel `/ia-central-automacao`.
Ela não pode:
- Alterar valores de faturas (Financeiro)
- Aprovar sinistros sem validação (Operacional/Seguros)
- Apagar registros do banco de dados

Para garantir isso, as tabelas `ia_regras` e `ia_modelos_mensagem` definem até onde ela pode ir.

## Quando o Humano Entra (Escalonamento)

A IA monitora a conversa ou o processo. Se ela detectar:
- Uso de palavras restritas (ex: "Polícia", "Roubo", "Processo judicial", "Procon")
- Incompreensão repetida por parte do usuário final
- Uma requisição fora do escopo do setor (`o_que_nao_pode_fazer`)

Ela imediatamente executa a rotina de **Escalonamento Humano**, registrando uma entrada na tabela `ia_aprovacoes_humanas` e alertando a Torre de Controle ou o SAC, paralisando sua própria interação naquele fluxo específico até que um humano libere.

## Como Treinar a IA

O "treinamento" no TMS Conexão Express é dinâmico (Prompt Engineering no banco de dados):
1. Acesse o menu **Governança e TI → IA & Automação**.
2. Selecione o Setor.
3. Modifique o texto do **Prompt Mestre**.
4. Modifique o que ela pode e não pode fazer.
5. (Futuro) Adicione textos na **Base de Conhecimento** (ex: PDFs de políticas) para RAG (Retrieval-Augmented Generation).

Não é necessário re-deploy do sistema ou fine-tuning de modelos pesados para alterar o comportamento da IA.

## Como Evoluir para Nuvem e N8N

Atualmente, o serviço `iaAutomacaoService.ts` gerencia as regras no Supabase e integra com as IAs (Groq, Gemini, Claude).

**Fluxo Ideal para a Nuvem:**
1. Eventos no sistema ou WhatsApp disparam webhooks para o **N8N**.
2. O N8N lê a tabela `ia_regras` do Supabase baseada no setor do evento.
3. O N8N envia o contexto + regras para a API (Groq/Gemini).
4. O N8N devolve a resposta ao WhatsApp/Email.
5. O N8N grava um registro na tabela `ia_decisoes_logs` no Supabase.

Este fluxo é "Serverless" e permite que a automação rode 24/7 de forma independente da interface React aberta.
