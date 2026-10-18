# CHECKLIST DE HOMOLOGAÇÃO — TMS-027 FASE 3

**Data:** 2026-08-01
**Marcador de homologação:** `HML-APP-20260801`
**Status global:** EM EXECUÇÃO — ETAPAS A e B CONCLUÍDAS (RLS desbloqueado)

## Identificação dos dados de homologação

| Item | Valor | Observação |
|------|-------|-----------|
| Cliente HML | `3d2d079d-708b-4d4d-9c0b-1ed9b894e37e` — HOMOLOGAÇÃO APP | CNPJ 00.000.000/0000-00, ativo |
| Prestador HML | `e6646799-fbac-453e-a3ef-afdfc01a7085` — PRESTADOR TESTE APP | Auth `a5e51631-5ed8-430d-9041-4b185c03d821` |
| Login App prestador | `teste@conexao.com` | Senha `Homologar129c2!` (m129c2) |
| Veículo HML | VUC / placa ABC-1234 | Usado em alocações antigas do prestador |
| Admin TMS | `tamiris.castilho@conexaoexpress.com.br` | Senha via env/credenciais conhecidas |
| App Flutter | `C:\src\conexao_prestador` v1.0.1+1286 | Supabase `uwrvzsjtpgaifkktpepn` (produção) |
| Emulador | emulator-5554 (Pixel_API_33, Android 13) | adb em `C:\Users\DIEGO BALBINO\Android_SDK` |
| TMS dev | http://localhost:8800 | Servidor já ativo (PID 19448) |

## Restrições da Fase 3

- [!] NÃO alterar Supabase Produção (sem SQL/migration/seed/RPC/trigger/RLS) — **AUTORIZADO (2026-08-02): aplicada apenas a policy INSERT `os_insert_tms` em `ordens_servico`** (autorizado pelo usuário; bloqueava criação de OS por usuários TMS)
- [x] NÃO criar dados direto no banco
- [x] OS criada pela **interface normal do TMS** com marcador `HML-APP-20260801`
- [x] NÃO alterar App Flutter sem causa comprovada
- [x] NÃO gerar APK definitivo
- [x] Sem mocks — apenas dados reais

## Achados desta execução

| ID | Gravidade | Achado | Status |
|----|-----------|--------|--------|
| BUG-1 | P0 | RLS `ordens_servico` sem policy INSERT para TMS — `new row violates row-level security policy` bloqueava criação de OS via interface | **Corrigido**: policy `os_insert_tms` aplicada (autorizada) |
| BUG-2 | P1 | `sincronizarComEscala` enviava `previsao_inicio` (datetime-local `2026-08-01T08:00`) para coluna `horario_saida` (`time`) — erro 22007 | **Corrigido** em `ordemServicoService.ts` (`extrairHora`) |
| BUG-3 | P2 | `fromOSRow` (dbMappers.ts:1321) não mapeia `enderecos` — editar OS existente perde endereços (validação "Adicione pelo menos um endereço") | Pendente (documentado) |
| BUG-4 | P2 | Form OS não grava `prestador` (UUID) — apenas `prestador_id`; SearchableSelect usa `valueField="nome_completo"` | Documentado (sem impacto p/ alocação) |

## Etapas

### A. Pré-condições (verificação)
- [x] A1. Servidor TMS dev ativo em http://localhost:8800 (HTTP 200)
- [x] A2. adb encontrado (`C:\Users\DIEGO BALBINO\Android_SDK\platform-tools\adb.exe`)
- [x] A3. Emulador `emulator-5554` conectado (device) — AVD Pixel_API_33
- [x] A4. Cliente HML existe e ativo (verificado via pg RO)
- [x] A5. Prestador HML existe e ativo (verificado via pg RO)
- [x] A6. OS HML-APP-001 pré-existente + alocação em `aguardando_aceite`
- [x] A7. Correção do erro de runtime `mapCounters is not defined` validada (tsc/build/vitest)
- [x] A8. Login TMS com admin via Playwright funciona
- [x] A9. Torre Controle carrega com dados reais e sem erros JS

### B. Criação da OS de homologação (via interface TMS)
- [x] B1. Abrir `/operacao?tab=os` e clicar "Nova OS"
- [x] B2. Preencher Cliente HML (`HOMOLOGAÇÃO APP`)
- [x] B3. Preencher Prestador HML (`PRESTADOR TESTE APP`)
- [x] B4. Preencher veículo (VUC / ABC-1234)
- [x] B5. Preencher endereços (coleta + entrega) com dados reais
- [x] B6. Inserir marcador `HML-APP-20260801` em observação/descrição
- [x] B7. Salvar a OS
- [x] B8. Confirmar OS criada no Supabase (via consulta RO) com marcador
- [x] B9. Confirmar alocação sincronizada em `alocacoes_escala` (status aguardando_aceite)

**Resultado B (12/12 OK):** OS `OS-202608-981024` (id `eebc9d93-0c74-4315-abb4-f2d73ab20a95`), status `pendente`, marcador em `instrucoes_operacionais_os`, prestador HML via `prestador_id`, placa ABC-1234, data programada 2026-08-01. Alocação `01fc1dce-a7b2-4b4d-a78a-06a267d02afd` — status `aguardando_aceite`, `tipo_veiculo=VUC`, `horario_saida=08:00`, metadata `precisa_aceite_app: true`.

> Nota: outras OS de rascunho/teste criadas durante o diagnóstico (OS-202608-390664, OS-202608-241511, OS-202608-822744) foram criadas via interface; a **oficial da homologação é a OS-202608-981024**.

### C. Validação no App do motorista
- [ ] C1. OS/alocação visível no App (emulador ou Cloudflare)
- [!] C2. Login do prestador HML no App — **BLOQUEADO**: senha de `teste@conexao.com` desconhecida. `Homologar129c2!` rejeitada (Invalid login credentials — 2026-08-01). Bloqueio P0 já documentado (m133d8, AUDITORIA_MASTER). Requer reset via Supabase Studio (Send recovery email) ou service_role key.
- [ ] C3. Aceite da rota pelo motorista (persistido em `aceite_prestador`/`data_aceite`)
- [ ] C4. Status da alocação avança no Supabase após aceite

> **Prova de execução C (2026-08-01):** App `com.example.conexao_prestador` aberto no emulador-5554, tela de login exibida, credenciais `teste@conexao.com` / `Homologar129c2!` inseridas via adb → login falhou (`[AuthNotifier] signIn auth error: Invalid login credentials`). Verificado via DB: auth user `a5e51631-5ed8-430d-9041-4b185c03d821` (email `teste@conexao.com`) existe e está vinculado ao prestador HML — problema é apenas a senha.

### D. Execução da entrega (evidências reais)
- [ ] D1. GPS em movimento registrado (latitude/longitude válidas)
- [ ] D2. Fotos/evidências enviadas (entrega, canhoto, assinatura)
- [ ] D3. POD registrado (nome/documento recebedor, data/hora, GPS)
- [ ] D4. Finalização da alocação (status concluída + horários reais)
- [ ] D5. OS atualizada de forma consistente no Supabase

### E. Torre de Controle — atualização em tempo real
- [ ] E1. Torre reflete mudanças da alocação (filtros/marcadores)
- [ ] E2. Abertura do Sheet/modal da alocação exibe dados reais
- [ ] E3. Sem erros JS no console durante o fluxo
- [ ] E4. Contadores GPS do Mapa corretos (fix TMS-027)

### F. Consistência de dados e fechamento
- [ ] F1. Sem duplicidade financeira (financeiro_receber/pagar por os_id)
- [ ] F2. Registros de auditoria/timeline presentes
- [ ] F3. Relatório `RELATORIO_HOMOLOGACAO_TMS_027_FASE_3.md` gerado
- [ ] F4. Checklist concluído com status por etapa

## Legenda
- `[x]` concluído / `[ ]` pendente / `[!]` bloqueado (motivo anotado)
