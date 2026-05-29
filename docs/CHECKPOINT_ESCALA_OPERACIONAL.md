# CHECKPOINT OFICIAL: ESCALA OPERACIONAL LOGÍSTICA

## 1. O Que Foi Alterado na Escala
A Escala Operacional foi refatorada estruturalmente e visualmente para se tornar uma **Torre Logística de Controle Viva**. Saímos de um sistema focado em layout padrão administrativo para um layout dinâmico focado em *densidade operacional*, *alertas em tempo real*, *escaneabilidade*, e *prevenção financeira*.

## 2. Arquivos Principais Envolvidos
* `src/components/operacao/EscalaLista.tsx`: Arquivo central da UI, concentra a lógica do Controle Diário, Modal de OS, Grade Horizontal e comunicação com Supabase.
* `src/utils/engineFinanceira.ts`: Central de cálculos financeiros purificada, agora responsável por gerir fallback, faixas de espera, e metadados de totais.

## 3. Fluxo Atual da Escala
O fluxo de despacho agora é bidirecional (criação via Grade ou via Tabela):
1. **Planejamento:** Clique no slot/calendário -> Seleção de Cliente/Prestador -> Preenchimento automático do Motor Financeiro.
2. **Pátio:** Atualização de mini-steps (`Chegada Pátio` -> `Carregamento` -> `Rota`).
3. **Despacho:** SLA calculado automaticamente na Grade.
4. **Fechamento:** Ao concluir a OS, a "Trava Anti-Prejuízo" exige resolução financeira se a escala estiver PENDENTE.

## 4. Como Funciona o Controle Diário
Funciona como o "Backoffice Operacional". É uma tabela densa com filtros avançados. Cada linha representa uma alocação do dia. Exibe as tags críticas de tempo, status logístico e as colunas vitais: "Financeiro", "Valor Cliente" e "Repasse". Bloqueia a emissão de relatórios definitivos (fechamento) se a alocação não estiver pronta financeiramente.

## 5. Como Funciona o Calendário
Componente visual de navegação. Clicar em uma célula do calendário em dias vazios permite criar rapidamente a alocação para aquele dia já pre-setado. Mantém a seleção de data injetada corretamente no Modal.

## 6. Como Funciona a Grade Horizontal
Painel de "Chão de Fábrica" para acompanhamento em tempo real. Possui design de "monitoramento", exibindo slots de prestadores na vertical e períodos de tempo na horizontal. 
* Células coloridas por status logístico (azul, amarelo, verde).
* Chips compactos mostram cliente e horário.
* Indicador vermelho de atraso vivo para OS travadas no Pátio.

## 7. Como Funciona a Fila e Pátio
Linha do tempo interna do Modal da OS mostrando "Steps Operacionais". Mostra os horários de batida de ponto do prestador (`Tempo Chegada`, `Início Carregamento`, `Finalização`).

## 8. Como Funciona o Motor Financeiro
Separa de vez o Cliente do Prestador. 
* Puxa primeiro a tabela do cliente para definir faturamento.
* Puxa o `financeiro_real` do prestador (diária, saída, KM). 
* Se não encontrar o financeiro do prestador, recorre as margens antigas (Fallback). 
* Calcula e salva a margem real (R$ e %) sem travar em "20% artificial".

## 9. Regras de Margem, Repasse, KM e Espera
* **Margem:** Calculada subtraindo Faturamento Cliente do Repasse Prestador (exibida R$ e %).
* **Repasse:** Prioriza o `financeiro_real` individual.
* **KM:** Cobra Franquia (da tabela) e aplica valor adicional sobre os quilômetros excedentes.
* **Espera:** Usa lógica de *Teto de Faixa*. Não há soma progressiva. Se esperou 100min, ganha apenas a faixa que cobre os 100min (ex: R$ 40), ignorando os prêmios anteriores (ex: R$ 10 de 60min).

## 10. Badges Financeiros (Controle Diário)
* `OK` (Verde): Tabela e financeira perfeitamente validadas.
* `PENDENTE` (Vermelho): Faltou tabela. Margem imprecisa. Trava a geração de Relatório de Fechamento.
* `FALLBACK` (Laranja): O Prestador não possui tabela cadastrada; sistema recorreu às regras vinculadas do cliente para gerar o repasse.
* `MANUAL` (Roxo): O operador inseriu manualmente o ajuste financeiro do cliente.

## 11. Riscos Conhecidos
* **Fallback Ainda Permitido:** O sistema não bloqueia o PDF para Fallback, apenas avisa na tela do Controle Diário. Pode gerar passivo de repasse se a negociação local foi diferente do cadastrado.
* **Metadata JSON no Médio Prazo:** O status financeiro e totais vivem em um objeto JSON `metadata` no banco. Quando a tabela crescer, filtragens pesadas via SQL JSONB serão lentas; exigirá a criação de novas colunas no schema.

## 12. O Que Está Pronto Para o App do Motorista
* Colunas de controle de Pátio (`tempoChegadaPatio`, `tempoSaidaRua`) perfeitamente prontas.
* Estrutura visual de status mapeada e integrada a cores.
* Relação amarrada `Placa x PrestadorId`.

## 13. O Que Ainda Falta Para o App do Motorista
* API Externa Edge (Functions) para os celulares enviarem as atualizações.
* Assinatura digital / Envio de Canhotos.
* Check-in de localização automática do GPS.

## 14. Checklist de Validação (Localhost)
- [ ] Criar alocação sem tabela e checar se trava o fechamento com status PENDENTE.
- [ ] Criar alocação completa e ver se passa em status OK.
- [ ] Confirmar se o Fallback aparece laranja em Prestadores sem diária definida.
- [ ] Testar filtro por Status no Controle Diário.
- [ ] Conferir o badge de Atraso e SLAs dentro da Grade Horizontal.
- [ ] Conferir os valores de Margem R$ na aba Resumo (fim do fluxo).

## 15. Próximo Módulo Recomendado
* **Prestadores / Recrutamento:** Funil de aquisição de novos agregados, upload e aprovação de documentos (CNH/ANTT), homologação financeira e integração direta à grade da Escala.
