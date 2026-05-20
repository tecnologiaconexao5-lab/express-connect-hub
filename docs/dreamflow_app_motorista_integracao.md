# Integração DreamFlow – App Motorista

## Visão Geral
Este documento descreve como o **DreamFlow** (aplicativo visual do motorista) consome dados do **TMS** através do **Supabase**. O TMS funciona como backend administrativo, fonte de dados e ponte de integração.

---

## 1️⃣ Tabelas/Views necessárias
| View | Descrição | Principais campos |
|------|-----------|-------------------|
| `vw_motorista_dashboard` | Resumo do status do motorista (dados da escala, veículo, prioridade, etc.) | `motorista_id`, `motorista_nome`, `escala_id`, `status`, `inicio_previsto`, `fim_previsto`, `placa`, `modelo`, `prioridade`, `observacoes` |
| `vw_motorista_viagens` | Lista de viagens (escala) futuras e em andamento | `escala_id`, `data_operacao`, `inicio_previsto`, `fim_previsto`, `status`, `prioridade`, `rota_id`, `rota_nome`, `placa`, `modelo` |
| `vw_motorista_financeiro` | Visão financeira do motorista (pagamentos, status, vencimento) | `financeiro_id`, `valor`, `status`, `vencimento`, `escala_id`, `operacao_status` |
| `vw_motorista_documentos` | Documentos vinculados ao motorista | `id`, `tipo`, `url`, `data_expiracao` |
| `vw_motorista_checklist` | Histórico de check‑ins realizados | `id`, `tipo`, `latitude`, `longitude`, `observacao`, `created_at`, `escala_id` |

**Segurança** – Cada view filtra os registros usando `auth.uid()` (ID do motorista autenticado). Apenas o motorista logado vê seus próprios dados.

---

## 2️⃣ RPCs (Stored Procedures) disponíveis
| RPC | Parâmetros | Função principal |
|-----|------------|-------------------|
| `aceitar_viagem` | `token_acesso TEXT`, `escala_id UUID` | Valida o token, identifica o motorista e marca a escala como `aceito`. |
| `recusar_viagem` | `token_acesso TEXT`, `escala_id UUID`, `motivo TEXT` | Valida o token e marca a escala como `recusado`, salvando o motivo nas observações. |
| `atualizar_status_viagem` | `token_acesso TEXT`, `escala_id UUID`, `status TEXT` | Atualiza o campo `status` da escala para o valor informado. |
| `registrar_checkin_motorista` | `token_acesso TEXT`, `escala_id UUID`, `tipo TEXT`, `latitude NUMERIC`, `longitude NUMERIC`, `observacao TEXT` (opcional) | Insere um registro em `motorista_checkins`. |
| `registrar_localizacao_motorista` | `token_acesso TEXT`, `escala_id UUID`, `latitude NUMERIC`, `longitude NUMERIC`, `velocidade NUMERIC` (opcional) | Insere em `operacao_localizacao` e atualiza a escala para `em_rota` (alimenta o painel realtime). |
| `reportar_ocorrencia_motorista` | `token_acesso TEXT`, `escala_id UUID`, `tipo TEXT`, `descricao TEXT`, `latitude NUMERIC`, `longitude NUMERIC` | Cria ticket em `escalonamentos_humanos`, registra a ocorrência e marca a escala como `ocorrencia`. |

**Todas as RPCs**:
1. Verificam o token na tabela `motorista_app_sessoes` (campo `token`, `ativo`).
2. Extraem `motorista_id` (prestador_id).
3. Executam as atualizações necessárias nas tabelas de negócio.
4. São definidas como `SECURITY DEFINER` para que a validação de token seja a única verificação de segurança.

---

## 3️⃣ Exemplos de Payload (Supabase JS/TS)
```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, ANON_KEY);
const token = "<token_acesso_obtido_no_login>";

// 1️⃣ Aceitar viagem
await supabase.rpc('aceitar_viagem', {
  token_acesso: token,
  escala_id: "c4a3f9e2-1234-5678-90ab-cdef12345678"
});

// 2️⃣ Registrar localização
await supabase.rpc('registrar_localizacao_motorista', {
  token_acesso: token,
  escala_id: "c4a3f9e2-1234-5678-90ab-cdef12345678",
  latitude: -23.5505,
  longitude: -46.6333,
  velocidade: 45
});

// 3️⃣ Ler dashboard
const { data, error } = await supabase.from('vw_motorista_dashboard').select('*');
```

---

## 4️⃣ Fluxo completo de integração
```mermaid
flowchart LR
    subgraph DreamFlow[App Motorista (DreamFlow)]
        D1[Login → gera token_acesso] --> D2[Consome Views]
        D2 --> D3[Chama RPCs (ex.: aceitar_viagem)]
    end
    subgraph Supabase[Supabase]
        S1[Tables & Views]
        S2[RPC Functions]
        S3[Realtime Channel (operacao_localizacao)]
    end
    subgraph TMS[Backend TMS]
        T1[Painel Operacional (React)]
        T2[Torre Operacional]
    end
    D1 --> S1
    D2 --> S1
    D3 --> S2
    S2 --> S1
    S2 --> S3
    S3 --> T1
    S3 --> T2
```
**Passos**:
1. Motorista faz login no DreamFlow → `motorista_app_sessoes` recebe um token ativo.
2. DreamFlow lê as *views* para exibir dashboard, viagens e documentos.
3. Ao aceitar/recusar ou atualizar status, DreamFlow chama a RPC correspondente.
4. A RPC atualiza `escala_operacional`, grava check‑ins ou localizações e, se necessário, cria um ticket em `escalonamentos_humanos`.
5. As alterações disparadas em **Supabase Realtime** são consumidas pelos componentes `PainelOperacionalMapa` e `AbaTorreControle` no TMS, mantendo o painel sempre atualizado.

---

## 5️⃣ Como testar
1. **Aplicar migrations**
   ```bash
   supabase db push   # ou executar o script SQL diretamente no console
   ```
2. **Criar sessão de motorista** manualmente (para teste rápido):
   ```sql
   INSERT INTO motorista_app_sessoes (token, motorista_id, ativo, criado_em)
   VALUES ('test-token-123', '<motorista_uuid>', TRUE, now());
   ```
3. **Chamar uma RPC** via Supabase JS (exemplo acima) e verificar:
   - `escala_operacional` foi atualizada
   - registro inserido em `motorista_checkins` ou `operacao_localizacao`
   - ticket criado em `escalonamentos_humanos` (quando for ocorrência)
4. **Abrir o TMS** (`npm run dev`) e observar o painel operacional: o novo marker ou status deve aparecer em tempo‑real.
5. **Verificar views** diretamente no console SQL:
   ```sql
   SELECT * FROM vw_motorista_dashboard;
   ```
   Os resultados devem conter apenas os registros do `motorista_id` da sessão.

---

## 6️⃣ Considerações de Segurança
- **RLS** (Row Level Security) já aplicada nas views usando `auth.uid()`. Certifique‑se que a política `select` está habilitada para a role utilizada pelo DreamFlow.
- As RPCs são `SECURITY DEFINER`; elas só permitem a execução se o `token_acesso` existir e estiver ativo.
- Tokens devem ter tempo de vida adequado e ser revogados ao logout (setando `ativo = FALSE`).

---

## 📦 Artefatos gerados
- `supabase/migrations/20260517000012_dreamflow_views.sql` – criação das 5 views.
- `supabase/migrations/20260517000013_dreamflow_rpcs.sql` – 6 funções RPC.
- `docs/dreamflow_app_motorista_integracao.md` – documentação (este arquivo).

---

## ✅ Resultado de Build
```bash
npm run build
# → Completed with Exit Code 0
```
Nenhuma página do TMS quebrou; o build esteve estável.

---

### Como configurar no DreamFlow
1. **Instalar o SDK Supabase** no projeto DreamFlow (`npm i @supabase/supabase-js`).
2. **Configurar URL e ANON_KEY** (do seu projeto Supabase).  
3. **Implementar login** que grava na tabela `motorista_app_sessoes` e retorna o `token_acesso`.  
4. **Usar as funções acima** conforme os exemplos de payload.
5. **Consumir as views** como tabelas normais (`supabase.from('vw_motorista_*').select('*')`).
6. **Escutar o canal realtime** (`supabase.channel('realtime_mapa')`) para atualizar o mapa no painel do TMS.

---

*Este documento deve ser versionado junto ao repositório para que toda a equipe de desenvolvimento tenha referência ao integrar o DreamFlow.*
