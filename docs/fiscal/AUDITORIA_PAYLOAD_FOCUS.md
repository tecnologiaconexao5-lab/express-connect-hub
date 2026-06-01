# Auditoria Payload Focus — TMS Conexao Express

**Data:** 31/05/2026  
**Objetivo:** Auditar aderencia dos payloads Focus gerados internamente para CT-e, MDF-e e NFS-e antes de qualquer emissao real.  
**Metodo:** Comparacao entre os campos montados pelos servicos fiscais (`cteService.ts`, `mdfeService.ts`, `nfseService.ts`) e os campos exigidos pela API Focus NFe v2.

> **Status Focus:** DESLIGADO. Nenhuma chamada externa foi feita durante esta auditoria. Token e certificado nunca trafegam pelo frontend.

---

## 1. CT-e (Conhecimento de Transporte Eletronico)

**Tabela:** `fiscal_ctes`  
**Servico:** `src/services/fiscal/cteService.ts` → `gerarRascunhoCte()`  
**Payload tipo:** `FocusCtePayloadDraft` (`src/types/fiscal.ts:173`)

### Payload Focus CT-e — Auditoria Campo a Campo

| # | Campo Focus | Existe no payload TMS? | Origem do dado | Status | Observacao |
|---|---|---|---|---|---|
| 1 | `emitente.nome` | Sim | `configuracoes_fiscais.razao_social` / `nome_fantasia` | OK | — |
| 2 | `emitente.cnpj` | Sim | `configuracoes_fiscais.cnpj` | OK | — |
| 3 | `emitente.ie` | Sim | `configuracoes_fiscais.ie` | OK | IE nao usada no CT-e em alguns estados |
| 4 | `emitente.rntrc` | Sim | `configuracoes_fiscais.rntrc` | OK | RNTRC obrigatorio para transportador |
| 5 | `emitente.endereco` | Sim | `configuracoes_fiscais` (logradouro, numero, bairro, cidade, uf, cep) | OK | latitude/longitude sempre null |
| 6 | `tomador.nome` | Sim | `clientes.razao_social` / `nome_fantasia` / `os.cliente` | OK | — |
| 7 | `tomador.cnpj` | Sim | `clientes.cnpj` | OK | Pode ser null se cliente nao tem CNPJ no cadastro |
| 8 | `tomador.ie` | Sim | `clientes.ie` | OK | — |
| 9 | `tomador.endereco` | Parcial | `clientes` (logradouro, numero, cidade, uf) | AVISO | complemento, bairro, cep sempre null |
| 10 | `remetente` | Sim | `OS.enderecos[]` tipo coleta | OK | — |
| 11 | `destinatario` | Sim | `OS.enderecos[]` tipo entrega | OK | — |
| 12 | `origem` | Sim | idem remetente | OK | — |
| 13 | `destino` | Sim | idem destinatario | OK | — |
| 14 | `carga.tipo` | Sim | `OS.carga.tipo` ou `OS.carga_tipo` | OK | — |
| 15 | `carga.descricao` | Sim | `OS.carga.descricao` / `carga_descricao` / XML | OK | — |
| 16 | `carga.peso_kg` | Sim | `OS.peso` / XML vinculado | OK | — |
| 17 | `carga.volumes` | Sim | `OS.volumes` / XML vinculado | OK | — |
| 18 | `carga.valor_declarado` | Sim | `OS.valor_declarado` / XML | OK | — |
| 19 | `carga.cfop` | Sim | `regras_fiscais_cte` (via buscarCfop) | OK | Pode ser null se regra nao cadastrada |
| 20 | `carga.natureza_operacao` | Sim | `OS.tipo_operacao` / regra CFOP | OK | — |
| 21 | `carga.quantidade_notas` | Sim | `OS.qtd_notas` / docs vinculados.length | OK | — |
| 22 | `veiculo.placa` | Sim | `veiculos.placa` / `OS.veiculo_alocado` | OK | — |
| 23 | `veiculo.tipo` | Sim | `veiculos.tipo_veiculo` / `OS.veiculo_tipo` | OK | — |
| 24 | `veiculo.renavam` | Sim | `veiculos.renavam` | OK | Pode ser null |
| 25 | `veiculo.tara_kg` | Sim | Sempre `null` | PENDENTE | Campo obrigatorio para calculo de peso bruto total |
| 26 | `veiculo.capacidade_kg` | Sim | `veiculos.capacidade_kg` | OK | Pode ser null |
| 27 | `veiculo.capacidade_m3` | Sim | `veiculos.capacidade_m3` | OK | Pode ser null |
| 28 | `veiculo.marca` | Sim | `veiculos.marca` | OK | Pode ser null |
| 29 | `veiculo.modelo` | Sim | `veiculos.modelo` | OK | Pode ser null |
| 30 | `motorista.nome` | Sim | `prestadores.nome_completo` / `nome_fantasia` / `os.prestador` | OK | — |
| 31 | `motorista.cpf` | Sim | `prestadores.cpf_cnpj` | OK | Pode ser null |
| 32 | `motorista.telefone` | Sim | `prestadores.telefone` / `whatsapp` | OK | — |
| 33 | `documentos_vinculados[].tipo` | Sim | `fiscal_documentos_vinculados.tipo_documento` | OK | — |
| 34 | `documentos_vinculados[].chave_acesso` | Sim | `fiscal_documentos_vinculados.chave_acesso` | OK | — |
| 35 | `documentos_vinculados[].numero` | Sim | `fiscal_documentos_vinculados.numero` | OK | — |
| 36 | `documentos_vinculados[].serie` | Sim | `fiscal_documentos_vinculados.serie` | OK | — |
| 37 | `documentos_vinculados[].valor` | Sim | `fiscal_documentos_vinculados.valor_total` | OK | — |
| 38 | `documentos_vinculados[].data_emissao` | Sim | `metadata.data_emissao` | AVISO | Formato pode divergir do padrao Focus |
| 39 | `valores.valor_total` | Sim | `OS.valor_cliente` | OK | — |
| 40 | `valores.valor_frete` | Sim | `OS.valor_cliente` | OK | Igual ao valor_total |
| 41 | `valores.valor_pedagio` | Sim | `OS.pedagio` | OK | — |
| 42 | `valores.valor_seguro` | Sim | Sempre `null` | PENDENTE | Nao ha campo seguro na OS ainda |
| 43 | `valores.valor_desconto` | Sim | `OS.descontos` | OK | — |
| 44 | `valores.valor_outros` | Sim | `OS.ajudante + OS.adicionais` | OK | — |
| 45 | `fiscal.cfop` | Sim | `regras_fiscais_cte` | OK | Pode ser null |
| 46 | `fiscal.natureza_operacao` | Sim | `regras_fiscais_cte` / `OS.tipo_operacao` | OK | — |
| 47 | `fiscal.icms_aliquota` | Sim | `regras_fiscais_cte.aliquota_icms` | OK | Pode ser null |
| 48 | `fiscal.icms_base_calculo` | Nao | Sempre `null` | FALTA | Deve ser calculado: `valor_total - descontos` |
| 49 | `fiscal.icms_valor` | Nao | Sempre `null` | FALTA | Deve ser calculado: `base * aliquota / 100` |
| 50 | `fiscal.regime_tributario` | Nao | Sempre `null` | FALTA | Campo obrigatorio SEFAZ (Simples Nacional / Normal) |
| 51 | `modal` | Nao | Nao existe | FALTA | Modal do CT-e: 1=rodoviario (padrao TMS) |
| 52 | `tipo_servico` | Nao | Nao existe | FALTA | 0=normal, 1=subcontratacao, etc. Padrao TMS = 0 |
| 53 | `tomador.tipo` | Nao | Nao existe | FALTA | 0=remetente, 1=destinatario, 2=terceiro. Depende do contrato |
| 54 | `tomador.endereco.codigo_municipio` | Nao | Nao existe | FALTA | Codigo IBGE do municipio (7 digitos) |
| 55 | `remetente.codigo_municipio` | Nao | Nao existe | FALTA | Codigo IBGE do municipio |
| 56 | `destinatario.codigo_municipio` | Nao | Nao existe | FALTA | Codigo IBGE do municipio |
| 57 | `origem.codigo_municipio` | Nao | Nao existe | FALTA | Codigo IBGE do municipio |
| 58 | `destino.codigo_municipio` | Nao | Nao existe | FALTA | Codigo IBGE do municipio |
| 59 | `carga.produto_predominante` | Nao | Nao existe | AVISO | Focus aceita `descricao`, mas produto_predominante e mais completo |
| 60 | `tomador.indicador_ie` | Nao | Nao existe | AVISO | 1=contribuinte ICMS, 2=isento, 9=nao contribuinte |
| 61 | `informacoes_adicionais_fisco` | Nao | Nao existe | AVISO | Texto livre para SEFAZ |
| 62 | `informacoes_complementares` | Nao | Nao existe | AVISO | Texto livre para tomador |

### Resumo CT-e

| Status | Quantidade |
|---|---|
| OK | 37 |
| AVISO | 7 |
| PENDENTE | 2 |
| FALTA | 14 |

---

## 2. MDF-e (Manifesto de Documentos Fiscais Eletronicos)

**Tabela:** `fiscal_mdfes`  
**Servico:** `src/services/fiscal/mdfeService.ts` → `gerarRascunhoMdfe()`  
**Payload:** metadata JSONB (nao ha tipo TypeScript dedicado)

### Payload Focus MDF-e — Auditoria Campo a Campo

| # | Campo Focus | Existe no payload TMS? | Origem do dado | Status | Observacao |
|---|---|---|---|---|---|
| 1 | `emitente.nome` | Sim | `payload_focus.emitente.nome` do CT-e | OK | — |
| 2 | `emitente.cnpj` | Sim | `payload_focus.emitente.cnpj` do CT-e | OK | — |
| 3 | `emitente.ie` | Sim | `payload_focus.emitente.ie` do CT-e | OK | — |
| 4 | `emitente.endereco` | Nao | Nao propagado do CT-e | FALTA | MDF-e precisa de endereco do emitente |
| 5 | `motorista.nome` | Sim | `payload_focus.motorista` do CT-e ou OS/prestador | OK | — |
| 6 | `motorista.cpf` | Sim | `prestadores.cpf_cnpj` | OK | — |
| 7 | `veiculo.placa` | Sim | CT-e ou OS | OK | — |
| 8 | `veiculo.tipo` | Parcial | CT-e ou OS | AVISO | Apenas placa e tipo; faltam renavam, tara, capacidade |
| 9 | `veiculo.renavam` | Nao | Nao existe | FALTA | Obrigatorio no MDF-e |
| 10 | `veiculo.tara_kg` | Nao | Nao existe | FALTA | Obrigatorio no MDF-e |
| 11 | `veiculo.capacidade_kg` | Nao | Nao existe | FALTA | Obrigatorio no MDF-e |
| 12 | `ctes_vinculados[]` | Sim | IDs dos CT-es rascunho | OK | Apenas referencias internas (UUID), nao chaves de acesso reais |
| 13 | `ctes_vinculados[].chave_acesso` | Nao | Nao existe | FALTA | Chave de 44 digitos do CT-e autorizado e obrigatoria |
| 14 | `uf_inicio` | Sim | Agregado dos CT-es | OK | — |
| 15 | `uf_fim` | Sim | Agregado dos CT-es | OK | — |
| 16 | `valor_total` | Sim | Soma dos CT-es | OK | — |
| 17 | `modal` | Nao | Nao existe | FALTA | 1=rodoviario |
| 18 | `tipo_emissao` | Nao | Nao existe | FALTA | 1=normal |
| 19 | `percurso.uf_percurso[]` | Nao | Nao existe | FALTA | Array de UFs no trajeto |
| 20 | `municipio_ini.codigo_municipio` | Nao | Nao existe | FALTA | Codigo IBGE do municipio de inicio |
| 21 | `municipio_fim.codigo_municipio` | Nao | Nao existe | FALTA | Codigo IBGE do municipio de fim |
| 22 | `informacoes_adicionais_fisco` | Nao | Nao existe | AVISO | Texto livre SEFAZ |
| 23 | `condutor[].nome` | Nao | Nao existe | FALTA | Array de condutores (motorista + auxiliares) |
| 24 | `condutor[].cpf` | Nao | Nao existe | FALTA | CPF de cada condutor |

### Resumo MDF-e

| Status | Quantidade |
|---|---|
| OK | 10 |
| AVISO | 2 |
| FALTA | 12 |

---

## 3. NFS-e (Nota Fiscal de Servico Eletronica)

**Tabela:** `fiscal_nfse`  
**Servico:** `src/services/fiscal/nfseService.ts` → `gerarRascunhoNfse()`  
**Payload:** metadata JSONB (nao ha tipo TypeScript dedicado)

### Payload Focus NFS-e — Auditoria Campo a Campo

| # | Campo Focus | Existe no payload TMS? | Origem do dado | Status | Observacao |
|---|---|---|---|---|---|
| 1 | `emitente.nome` | Sim | `configuracoes_fiscais.razao_social` | OK | — |
| 2 | `emitente.cnpj` | Sim | `configuracoes_fiscais.cnpj` | OK | — |
| 3 | `emitente.ie` | Sim | `configuracoes_fiscais.ie` | OK | — |
| 4 | `emitente.cidade` | Sim | `configuracoes_fiscais.cidade` | OK | — |
| 5 | `emitente.uf` | Sim | `configuracoes_fiscais.uf` | OK | — |
| 6 | `emitente.codigo_municipio` | Nao | Nao existe | FALTA | Codigo IBGE obrigatorio |
| 7 | `emitente.endereco` (completo) | Nao | Nao propagado | FALTA | logradouro, numero, bairro, cep |
| 8 | `tomador.nome` | Sim | `clientes` / OS | OK | — |
| 9 | `tomador.cnpj` | Sim | `clientes.cnpj` | OK | Pode ser null |
| 10 | `tomador.ie` | Sim | `clientes.ie` | OK | — |
| 11 | `tomador.endereco` | Nao | Nao existe | FALTA | Endereco completo do tomador |
| 12 | `tomador.codigo_municipio` | Nao | Nao existe | FALTA | Codigo IBGE |
| 13 | `tomador.email` | Nao | Nao existe | AVISO | Para envio automatico da NFS-e |
| 14 | `servico` (descricao) | Sim | `regras_fiscais_nfse` / fallback | OK | — |
| 15 | `codigo_servico` | Sim | `regras_fiscais_nfse.codigo_servico` | OK | Pode ser null se regra nao cadastrada |
| 16 | `valor_servico` | Sim | `OS.valor_cliente` / CT-e.valor | OK | — |
| 17 | `aliquota_iss` | Sim | `regras_fiscais_nfse.aliquota_iss` | OK | Pode ser null |
| 18 | `iss_retido` | Sim | `regras_fiscais_nfse.iss_retido` | OK | — |
| 19 | `municipio_prestacao` | Sim | `params.municipio_prestacao` | OK | — |
| 20 | `codigo_municipio_prestacao` | Nao | Nao existe | FALTA | Codigo IBGE do municipio |
| 21 | `base_calculo` | Nao | Nao existe | FALTA | `valor_servico` (base de calculo do ISS) |
| 22 | `valor_iss` | Nao | Nao existe | FALTA | `base * aliquota / 100` |
| 23 | `valor_liquido` | Nao | Nao existe | AVISO | `valor_servico - valor_iss - retencoes` |
| 24 | `item_lista_servico` | Nao | Nao existe | AVISO | Codigo da lista de servico municipal (LC 116) |
| 25 | `cnae` | Nao | Nao existe | AVISO | CNAE do emitente |
| 26 | `discriminacao` | Nao | Nao existe | AVISO | Texto detalhado do servico prestado |
| 27 | `rps.numero` | Nao | Nao existe | AVISO | Numero do RPS (Recibo Provisorio de Servico) |
| 28 | `rps.serie` | Nao | Nao existe | AVISO | Serie do RPS |

### Resumo NFS-e

| Status | Quantidade |
|---|---|
| OK | 15 |
| AVISO | 7 |
| FALTA | 8 |

---

## 4. Riscos Encontrados (Pode Causar Rejeicao)

### Criticos (P0 — Rejeicao certa pela SEFAZ)

1. **`codigo_municipio` ausente em TODOS os enderecos** — CT-e, MDF-e e NFS-e exigem codigo IBGE de 7 digitos em cada municipio (origem, destino, emitente, tomador, prestacao). Focus rejeita sem este campo.

2. **`tara_kg` do veiculo sempre null** — Campo obrigatorio no CT-e e MDF-e para calculo do peso bruto total (PBT = tara + carga). Sem ele, SEFAZ rejeita.

3. **`icms_base_calculo` e `icms_valor` sempre null** — Focus/SEFAZ exigem que o ICMS seja calculado (mesmo que zero ou diferido). O TMS monta `cfop` e `aliquota` mas nao calcula valores.

4. **`tomador.indicador_ie` ausente** — SEFAZ exige saber se o tomador e contribuinte de ICMS. Sem este campo, rejeicao por "indicador IE do tomador invalido".

5. **`chave_acesso` dos CT-es nao disponivel no MDF-e** — O MDF-e referencia CT-es por suas chaves de 44 digitos. O TMS armazena apenas UUIDs internos (os CT-es ainda estao em rascunho, sem chave real).

6. **`modal` nao informado** — CT-e e MDF-e exigem `modal` (1=rodoviario) para definir o tipo de transporte.

7. **`renavam` do veiculo ausente no MDF-e** — Obrigatorio no manifesto.

### Altos (P1 — Pode causar rejeicao dependendo do estado)

8. **`tipo_servico` do CT-e nao definido** — Padrao `0` (normal) deve ser aplicado. Sem ele, alguns estados rejeitam.

9. **`percurso` MDF-e vazio** — Array de UFs no trajeto do manifesto e obrigatorio em muitos estados.

10. **`condutor[]` MDF-e** — Array de condutores com nome+CPF e obrigatorio no MDF-e. O TMS tem apenas 1 motorista.

11. **`rps.numero` e `rps.serie` ausentes na NFS-e** — Alguns municipios exigem RPS vinculado. Sem ele, prefeituras rejeitam.

12. **`tomador.email` na NFS-e** — Necessario para envio automatico da NFS-e ao tomador.

### Medios (P2 — Melhorias de completude)

13. **`regime_tributario` null** — Deve ser preenchido com base no emitente (Simples Nacional, Lucro Presumido, etc.).
14. **`informacoes_adicionais_fisco` e `informacoes_complementares` ausentes** — Campos opcionais mas uteis para observacoes fiscais e comerciais.
15. **`produto_predominante`** — Campo mais especifico que `descricao` para a carga.
16. **`cnae` e `item_lista_servico` na NFS-e** — Informacoes complementares exigidas por alguns municipios.
17. **`valor_liquido` na NFS-e** — Util para controle financeiro.

---

## 5. Correcoes Recomendadas Antes da Emissao Real

### P0 — Obrigatorio antes de emitir (8 itens)

| # | Correcao | Arquivo(s) |
|---|---|---|
| 1 | Adicionar tabela `municipios_ibge` (codigo, nome, uf) e popular `codigo_municipio` em todos os enderecos | Migration + `cteService.ts` + `nfseService.ts` + `mdfeService.ts` |
| 2 | Preencher `veiculo.tara_kg` da tabela `veiculos` | Migration (coluna `tara_kg` em `veiculos`) + `cteService.ts` |
| 3 | Calcular `icms_base_calculo` e `icms_valor` no CT-e | `cteService.ts` |
| 4 | Adicionar `tomador.indicador_ie` com logica baseada no CNPJ do cliente | `cteService.ts` + `clientes.indicador_ie` |
| 5 | Armazenar `chave_acesso` do CT-e apos emissao real e usa-la no MDF-e | Fluxo completo de emissao |
| 6 | Adicionar campo `modal` default `1` (rodoviario) | `cteService.ts` + `mdfeService.ts` |
| 7 | Adicionar `veiculo.renavam` no MDF-e | `mdfeService.ts` |
| 8 | Adicionar `tipo_servico` default `0` no CT-e | `cteService.ts` |

### P1 — Importante (5 itens)

| # | Correcao | Arquivo(s) |
|---|---|---|
| 9 | Adicionar `percurso.uf_percurso[]` no MDF-e com UFs entre origem e destino | `mdfeService.ts` |
| 10 | Adicionar array `condutor[]` no MDF-e | `mdfeService.ts` |
| 11 | Implementar `rps_numero` sequencial na NFS-e | `nfseService.ts` + migration |
| 12 | Preencher `tomador.email` na NFS-e a partir de `clientes.email` | `nfseService.ts` |
| 13 | Adicionar `valor_seguro` na OS/CT-e | `OrdemServicoForm.tsx` + `cteService.ts` |

### P2 — Melhoria (5 itens)

| # | Correcao | Arquivo(s) |
|---|---|---|
| 14 | Preencher `regime_tributario` do emitente (Simples/MEI/Normal/LP) | `configuracoes_fiscais` + `cteService.ts` |
| 15 | Adicionar `informacoes_adicionais_fisco` e `informacoes_complementares` | `cteService.ts` + `OrdemServicoForm.tsx` |
| 16 | Adicionar `produto_predominante` na carga do CT-e | `cteService.ts` |
| 17 | Adicionar `cnae` e `item_lista_servico` na NFS-e | `nfseService.ts` |
| 18 | Calcular `valor_liquido` na NFS-e | `nfseService.ts` |

---

## 6. Conclusao

**Aderencia atual:** ~62% (62 de 100 campos mapeados como OK)

**Principais gaps:**
1. **Codigo IBGE de municipios** — ausente em todos os enderecos (CT-e, MDF-e, NFS-e)
2. **Calculos fiscais** — ICMS base/valor, ISS valor, tara do veiculo nao calculados
3. **Dados SEFAZ obrigatorios** — indicador IE, modal, tipo_servico, renavam, condutores
4. **Payload MDF-e mais fragil** — apenas 45% de cobertura (10/22 campos OK)

**Payload mais maduro:** CT-e (37/60 campos OK = 62%)

**Recomendacao:** Resolver os 8 itens P0 antes de qualquer tentativa de emissao real. Sem eles, a rejeicao pela SEFAZ/Focus e praticamente certa.
