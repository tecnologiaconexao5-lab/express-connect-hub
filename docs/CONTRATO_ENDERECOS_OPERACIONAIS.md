# Contrato de Endereços Operacionais — OperationalAddress

## Missão 132-A

---

## 1. Modelo do Endereço

O contrato `OperationalAddress` é a representação única e reutilizável de qualquer ponto operacional no sistema TMS. Atende:

- Origem (coleta)
- Destino (entrega)
- Paradas (pontos intermediários)
- Coleta reversa
- Devolução
- Apoio operacional
- Retorno

### Interface TypeScript

```typescript
export interface OperationalAddress {
  /** Identificação */
  id?: string;
  tipo_ponto?: "origem" | "destino" | "coleta" | "entrega" | "parada"
    | "coleta_reversa" | "devolucao" | "retorno" | "apoio";
  nome_local?: string;
  sequencia?: number;
  rota_id?: string;
  parada_id?: string;

  /** Endereço estruturado */
  endereco?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  uf?: string;
  endereco_formatado?: string;
  referencia?: string;

  /** Coordenadas */
  latitude?: number;
  longitude?: number;

  /** Contato */
  contato_nome?: string;
  contato_telefone?: string;
  responsavel?: string;
  recebedor_previsto?: string;

  /** Janela operacional */
  data_prevista?: string;
  janela_inicio?: string;
  janela_fim?: string;
  horario_limite?: string;
  prioridade?: "baixa" | "normal" | "alta" | "critica";

  /** Orientações operacionais */
  instrucoes?: string;
  observacoes?: string;
  procedimento_entrada?: string;
  procedimento_saida?: string;
  portaria?: string;
  doca?: string;
  estacionamento?: string;
  documento_necessario?: string;
  codigo_acesso?: string;
  exigencia_epi?: boolean;
  exige_ajudante?: boolean;
  restricao_veiculo?: string;
  restricao_altura?: string;
  outras_restricoes?: string;
  restricoes?: string;

  /** Status do ponto */
  status_ponto?: "pendente" | "a_caminho" | "chegou" | "concluido" | "falhou";
  agendamento?: boolean;

  /** Dados de entrega (parada) */
  destinatario?: string;
  volumes?: number;
  peso?: number;
  cubagem?: number;
  nota_fiscal?: string;
  pedido?: string;
  tipo_carga?: string;
}
```

---

## 2. Origem de Cada Campo

| Campo | Origem Primária | Origem Secundária | Snapshot |
|-------|----------------|-------------------|----------|
| tipo_ponto | OS (enderecos[].tipo) | Alocação (deduzido) | Alocação |
| nome_local | OS (enderecos[].nomeLocal) | Cliente (enderecos_clientes.nome_local) | Alocação |
| logradouro | OS (enderecos[].logradouro) | Cliente (enderecos_clientes.logradouro) | Alocação |
| numero | OS (enderecos[].numero) | Cliente (enderecos_clientes.numero) | Alocação |
| complemento | OS (enderecos[].complemento) | Cliente (enderecos_clientes.complemento) | Alocação |
| bairro | OS (enderecos[].bairro) | Cliente (enderecos_clientes.bairro) | Alocação |
| cidade | OS (enderecos[].cidade) | Cliente (cidade) | Alocação |
| estado/uf | OS (enderecos[].estado) | Cliente (uf) | Alocação |
| cep | OS (enderecos[].cep) | Cliente (enderecos_clientes.cep) | Alocação |
| referencia | OS (enderecos[].referencia) | EnderecoCompleto input | Alocação |
| latitude | OS (enderecos[].latitude) | Mapbox autocomplete | Alocação |
| longitude | OS (enderecos[].longitude) | Mapbox autocomplete | Alocação |
| contato_nome | OS form (contatoNome) | Cliente (contato_local) | Alocação |
| contato_telefone | OS form (contatoTelefone) | Cliente (telefone_local) | Alocação |
| portaria | OS form (portaria) | Cliente (enderecos_clientes.portaria) | Alocação |
| doca | OS form (doca) | Cliente (enderecos_clientes.doca) | Alocação |
| instrucoes | OS form (instrucoes/referencia) | Cliente (instrucoes) | Alocação |
| janela_inicio | OS form (janelaInicio) | Cliente (janela_inicio) | Alocação |
| janela_fim | OS form (janelaFim) | Cliente (janela_fim) | Alocação |
| procedimento_entrada | OS form | Cliente (procedimento_entrada) | Alocação |
| procedimento_saida | OS form | Cliente (procedimento_saida) | Alocação |
| restricoes | OS form | Cliente (restricoes) | Alocação |
| exigencia_epi | OS form | — | Alocação |
| exige_ajudante | OS form | — | Alocação |

---

## 3. Regras de Snapshot

Cada alocação/escala preserva os dados do momento da sincronização:

1. Quando uma OS é sincronizada com a escala (`sincronizarComEscala()`), os endereços são copiados de `ordens_servico.enderecos[]` para `alocacoes_escala.endereco_origem` e `endereco_destino` como JSONB.
2. Alterações futuras no cadastro do cliente NÃO afetam operações já concluídas.
3. Alterações na OS após a sincronização são propagadas via nova chamada a `sincronizarComEscala()`.
4. A string de endereço textual (`alocacoes_escala.origem`/`destino`) é mantida para compatibilidade com relatórios e views legadas.
5. Campos nulos no JSONB significam que o dado não estava disponível no momento da criação.

---

## 4. Visibilidade

| Campo | Motorista (App) | TMS | Portal Cliente | Interno |
|-------|:---------------:|:---:|:--------------:|:-------:|
| endereco | ✅ | ✅ | ✅ | ✅ |
| logradouro | ✅ | ✅ | ✅ | ✅ |
| numero | ✅ | ✅ | ✅ | ✅ |
| complemento | ✅ | ✅ | ✅ | ✅ |
| bairro | ✅ | ✅ | ✅ | ✅ |
| cidade | ✅ | ✅ | ✅ | ✅ |
| uf | ✅ | ✅ | ✅ | ✅ |
| cep | ✅ | ✅ | ✅ | ✅ |
| referencia | ✅ | ✅ | — | ✅ |
| latitude | ✅ | ✅ | ✅ | ✅ |
| longitude | ✅ | ✅ | ✅ | ✅ |
| contato_nome | ✅ | ✅ | ✅ | ✅ |
| contato_telefone | ✅ | ✅ | ⚠️ | ✅ |
| portaria | ✅ | ✅ | — | ✅ |
| doca | ✅ | ✅ | — | ✅ |
| instrucoes | ✅ | ✅ | — | ✅ |
| janela_inicio | ✅ | ✅ | ✅ | ✅ |
| janela_fim | ✅ | ✅ | ✅ | ✅ |
| procedimento_entrada | ✅ | ✅ | — | ✅ |
| procedimento_saida | ✅ | ✅ | — | ✅ |
| restricoes | ✅ | ✅ | — | ✅ |
| exigencia_epi | ✅ | ✅ | — | ✅ |
| exige_ajudante | ✅ | ✅ | — | ✅ |
| restricao_veiculo | ✅ | ✅ | — | ✅ |
| restricao_altura | ✅ | ✅ | — | ✅ |
| dados_financeiros | ❌ | ✅ | ✅ | ❌ |
| documentos_internos | ❌ | ✅ | ❌ | ❌ |

Legenda: ✅ visível | ❌ não visível | ⚠️ parcial | — não se aplica

---

## 5. Exemplos JSON

### Origem (coleta)
```json
{
  "tipo_ponto": "coleta",
  "nome_local": "Centro de Distribuição Guarulhos",
  "logradouro": "Rua Jamil João Zarif",
  "numero": "684",
  "complemento": "Unidades 20 a 23",
  "bairro": "Jardim Santa Vicência",
  "cidade": "Guarulhos",
  "estado": "SP",
  "cep": "07190-000",
  "referencia": "Próximo ao acesso do Aeroporto de Guarulhos",
  "portaria": "Portaria de cargas",
  "doca": "Confirmar no local",
  "instrucoes": "Apresentar documento na portaria e aguardar orientação da operação.",
  "contato_nome": "Portaria CD Guarulhos",
  "contato_telefone": "(11) 4000-0001",
  "janela_inicio": "06:00",
  "janela_fim": "12:00",
  "exigencia_epi": true,
  "documento_necessario": "Documento com foto e CTE",
  "latitude": -23.4321,
  "longitude": -46.5012
}
```

### Destino (entrega)
```json
{
  "tipo_ponto": "entrega",
  "nome_local": "Cliente Homologação Paulista",
  "logradouro": "Avenida Paulista",
  "numero": "1000",
  "complemento": "Entrada de cargas pela lateral",
  "bairro": "Bela Vista",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01310-100",
  "referencia": "Próximo à estação Trianon-Masp",
  "portaria": "Portaria principal - acesso de cargas pela lateral",
  "doca": "Doca 03 - aguardar liberação",
  "instrucoes": "Confirmar o responsável antes de iniciar o descarregamento.",
  "contato_nome": "Recebimento Homologação",
  "contato_telefone": "(11) 99999-0001",
  "janela_inicio": "08:00",
  "janela_fim": "17:00",
  "procedimento_entrada": "Anunciar na portaria principal. Seguir para doca 03.",
  "procedimento_saida": "Após descarregamento, retirar canhoto na portaria.",
  "exige_ajudante": true,
  "restricao_veiculo": "VUC ou caminhão de pequeno porte",
  "restricao_altura": "3.5m",
  "latitude": -23.5610,
  "longitude": -46.6560
}
```

---

## 6. Compatibilidade

### Dados antigos (OS sem endereço estruturado)
- Se `endereco_origem` ou `endereco_destino` for NULL, o sistema utiliza `origem`/`destino` TEXT como fallback.
- O campo `endereco` da interface é a representação textual completa.
- Nenhuma OS antiga é invalidada.
- Nenhum campo existente é removido.

### Mapeamento de nomes (TS ↔ DB)
| TypeScript | DB JSONB / Coluna |
|-----------|------------------|
| nome_local | nome_local |
| endereco_formatado | endereco_formatado |
| contato_nome | contato_nome |
| contato_telefone | contato_telefone |
| procedimento_entrada | procedimento_entrada |
| procedimento_saida | procedimento_saida |
| exigencia_epi | exigencia_epi |
| exige_ajudante | exige_ajudante |
| restricao_veiculo | restricao_veiculo |
| restricao_altura | restricao_altura |
| documento_necessario | documento_necessario |
| codigo_acesso | codigo_acesso |
| status_ponto | status_ponto |
| data_prevista | data_prevista |

---

## 7. Versionamento

| Versão | Data | Mudanças |
|--------|------|----------|
| 1.0 | 2026-07-21 | Contrato inicial (M132-A). 40+ campos. Suporte a origem, destino, paradas, coleta reversa, devolução. |

---

## 8. Consumo pelo App Motorista

O App Motorista consome o contrato através de:

1. **View `vw_app_motorista_operacoes`** — contém `endereco_origem` (JSONB) e `endereco_destino` (JSONB)
2. **View `vw_app_motorista_paradas`** — contém todos os campos do contrato como colunas individuais
3. **RPC `f_buscar_operacoes_motorista()`** — retorna as operações com os campos da view

O App deve:
- Ler `endereco_origem` e `endereco_destino` como objetos JSON
- Para paradas: ler campos individuais de `vw_app_motorista_paradas`
- Se `endereco_origem` for NULL, usar `origem` (TEXT) como fallback
- Se algum campo operacional (portaria, doca, etc.) for NULL ou vazio, ocultar do motorista

### Estrutura esperada na resposta
```json
{
  "alocacao_id": "uuid",
  "endereco_origem": { /* OperationalAddress */ },
  "endereco_destino": { /* OperationalAddress */ },
  "paradas": [
    {
      "parada_id": "uuid",
      "endereco": "Rua A, 100",
      "numero": "100",
      "bairro": "Centro",
      "portaria": "Portaria 1",
      "doca": "Doca 01",
      "instrucoes": "Instruções...",
      "contato_nome": "João",
      "contato_telefone": "(11) 99999-0000"
    }
  ]
}
```

---

## 9. Consumo Futuro pelo Portal Cliente

Previsto para Missão 132-C (ou posterior):
- Novo pedido pelo portal pré-preenche o contrato com dados cadastrais do cliente
- Detalhes operacionais (portaria, doca, instruções) visíveis ao cliente
- Acompanhamento de entrega mostra endereço completo do destino

---

## 10. Uso por Tipo de Operação

| Tipo | Origem | Destino | Paradas | Coleta Reversa | Devolução |
|------|:------:|:-------:|:-------:|:--------------:|:---------:|
| Operação Direta | ✅ único | ✅ único | ❌ | ❌ | ❌ |
| Escala | ✅ único | ✅ único | ❌ | ✅ | ✅ |
| Multi-paradas | ✅ único | ✅ último | ✅ 1..N | ❌ | ❌ |
| Coleta Reversa | ✅ coleta | ❌ | ❌ | ✅ coleta_reversa | ❌ |
| Devolução | ❌ | ✅ devolução | ❌ | ❌ | ✅ devolucao |

---

## 11. Estruturas no Banco de Dados

### `alocacoes_escala` (JSONB para snapshot)
```sql
endereco_origem JSONB  -- OperationalAddress da origem
endereco_destino JSONB -- OperationalAddress do destino
```

### `rota_paradas` (colunas estruturadas para paradas)
```sql
endereco, numero, bairro, cidade, uf, cep, complemento,
referencia, latitude, longitude,
contato_nome, contato_telefone,
portaria, doca, procedimento_entrada, procedimento_saida,
estacionamento, documento_necessario, codigo_acesso,
exigencia_epi, exige_ajudante,
restricao_veiculo, restricao_altura, outras_restricoes,
janela_inicio, janela_fim, data_prevista
```

### `ordens_servico` (JSONB array para múltiplos endereços)
```sql
enderecos JSONB  -- OperationalAddress[] como array
```

### `enderecos_clientes` (colunas estruturadas para cadastro)
```sql
logradouro, numero, complemento, bairro, cidade, uf, cep,
nome_local, referencia, contato_local, telefone_local,
instrucoes, janela_inicio, janela_fim, restricoes,
latitude, longitude, portaria, doca,
procedimento_entrada, procedimento_saida
```

---

## 12. Arquivos de Referência

| Arquivo | Descrição |
|---------|-----------|
| `src/types/operational-address.ts` | Interface TypeScript + helpers |
| `src/components/operacao/osTypes.ts` | OSEndereco extendido com campos M132-A |
| `src/components/ui/EnderecoCompleto.tsx` | Componente com campos operacionais |
| `src/services/ordemServicoService.ts` | sincronizarComEscala com JSONB |
| `src/types/escala.ts` | AlocacaoEscala com endereco_origem/destino |
| `supabase/migrations/20260721_m132a_contrato_enderecos_operacionais.sql` | Migration SQL |
| `scripts/m132a_seed_homologacao_enderecos.ts` | Dados de homologação |
| `scripts/m132a_test_contrato_enderecos.ts` | Testes do contrato |
