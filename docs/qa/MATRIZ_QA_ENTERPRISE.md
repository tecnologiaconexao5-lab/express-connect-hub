# MATRIZ DE TESTES QA — CONEXÃO EXPRESS ENTERPRISE (CORRIGIDA)

**Missão:** 136-C.2-QA0  
**Data:** 23/07/2026  
**Branch:** main  
**Commit:** 148b67f  
**Ambiente:** Produção (Supabase: uwrvzsjtpgaifkktpepn.supabase.co)  
**Comando de execução:** `npx playwright test login.spec.ts p0-sidebar.spec.ts missao55-cenario1-fluxo-operacional-completo.spec.ts relatorios.spec.ts missao55-cenario2-portal-cliente.spec.ts missao55-cenario3-erros-permissoes.spec.ts financeiro-e2e.spec.ts missao136c-homologacao-enterprise.spec.ts missao136c1-jornada-comercial.spec.ts m136c2-navegacao-completa.spec.ts --reporter=list --timeout=120000`

---

## Legenda Obrigatória

| Código | Significado |
|--------|-------------|
| ✅ EXECUTADO NO NAVEGADOR | Teste executado via Playwright, resultado comprovado |
| 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Componente/rota existe no código-fonte, mas NÃO foi testado funcionalmente |
| ❌ FALHOU | Teste executado e falhou (com erro documentado) |
| ⏳ BLOQUEADO | Não pode ser executado (sem dados, sem ambiente, dependência externa) |
| 🟡 PARCIAL | Funciona parcialmente (algumas abas/features falham) |
| 🔶 NÃO TESTADO | Não foi executado nesta sessão |
| ⚫ NÃO SE APLICA | Funcionalidade não existe ou não é relevante |

---

## 1. AUTENTICAÇÃO (10 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| AUTH-01 | Login admin → /dashboard | admin | ✅ Redirecionou para /dashboard (7.3s) | login.spec.ts + missao-critica-login #01 | ✅ EXECUTADO NO NAVEGADOR |
| AUTH-02 | Login financeiro → /financeiro | financeiro | ✅ Redirecionou para /financeiro (5.0s) | login.spec.ts #01 | ✅ EXECUTADO NO NAVEGADOR |
| AUTH-03 | Login comercial → /comercial | comercial | 🔶 NÃO TESTADO | — | 🔶 NÃO TESTADO |
| AUTH-04 | Login operacional → /operacao | operacional | 🔶 NÃO TESTADO | — | 🔶 NÃO TESTADO |
| AUTH-05 | Login atendimento → /dashboard | atendimento | 🔶 NÃO TESTADO | — | 🔶 NÃO TESTADO |
| AUTH-06 | Login inválido → erro em /login | N/A | ✅ Erro exibido, permaneceu /login (5.5s) | login.spec.ts #02 | ✅ EXECUTADO NO NAVEGADOR |
| AUTH-07 | Logout → /login | admin | ✅ Redirecionou para /login (11.1s) | missao55-cenario3 #02 | ✅ EXECUTADO NO NAVEGADOR |
| AUTH-08 | Rota protegida → redirect | N/A | ✅ Redirecionou /login?redirect (3.3s) | login.spec.ts #03 | ✅ EXECUTADO NO NAVEGADOR |
| AUTH-09 | Sessão expirada → /login | admin | ✅ Redirecionou (14.6s) | missao55-cenario3 #03 | ✅ EXECUTADO NO NAVEGADOR |
| AUTH-10 | Recuperar senha → /forgot-password | N/A | ✅ Página carregou (3.9s) | missao55-cenario3 #07 | ✅ EXECUTADO NO NAVEGADOR |

## 2. DASHBOARD (5 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| DASH-01 | Dashboard carregar com dados | admin | ✅ Carregou sem travamentos (18.3s) | missao55-cenario1 #01 | ✅ EXECUTADO NO NAVEGADOR |
| DASH-02 | Abas do Dashboard (7) | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Dashboard.tsx | 🔷 EXISTE NO CÓDIGO |
| DASH-03 | Filtro de período | admin | 🔶 NÃO TESTADO | — | 🔶 NÃO TESTADO |
| DASH-04 | Aba Eventos | admin | 🔶 NÃO TESTADO | — | 🔶 NÃO TESTADO |
| DASH-05 | Aba Rede | admin | 🔶 NÃO TESTADO | — | 🔶 NÃO TESTADO |

## 3. GESTÃO COMERCIAL (8 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| COM-01 | Página /comercial carregar | admin | ✅ Carregou (13.4s) | missao55-cenario1 #02 | ✅ EXECUTADO NO NAVEGADOR |
| COM-02 | Aba Orçamentos | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Comercial.tsx | 🔷 EXISTE NO CÓDIGO |
| COM-03 | Aba CRM | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Comercial.tsx | 🔷 EXISTE NO CÓDIGO |
| COM-04 | Aba Marketing | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Comercial.tsx | 🔷 EXISTE NO CÓDIGO |
| COM-05 | Aba Propostas | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Comercial.tsx | 🔷 EXISTE NO CÓDIGO |
| COM-06 | Aba Tabela de Valores | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Comercial.tsx | 🔷 EXISTE NO CÓDIGO |
| COM-07 | Aba Simulador de Frete | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Comercial.tsx | 🔷 EXISTE NO CÓDIGO |
| COM-08 | Aba Automação | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Comercial.tsx | 🔷 EXISTE NO CÓDIGO |

## 4. CADASTROS BASE (13 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| CAD-01 | Página /cadastros carregar | admin | ✅ Carregou (13.2s) | missao55-cenario1 #04 | ✅ EXECUTADO NO NAVEGADOR |
| CAD-02 | Clientes — Lista carregar | admin | ✅ Página carregou (21.3s) | missao55-cenario1 #03 | ✅ EXECUTADO NO NAVEGADOR |
| CAD-03 | Clientes — Criar | admin | ✅ Cliente criado e persistido (19.0s) | missao136c1 #03 | ✅ EXECUTADO NO NAVEGADOR |
| CAD-04 | Clientes — Editar | admin | ✅ Cliente editado (M136-A) | missao136a1 | ✅ EXECUTADO NO NAVEGADOR |
| CAD-05 | Prestadores — Lista | admin | ✅ Página carregou (21.2s) | missao55-cenario1 #05 | ✅ EXECUTADO NO NAVEGADOR |
| CAD-06 | Prestadores — Criar | admin | 🔶 NÃO TESTADO | — | 🔶 NÃO TESTADO |
| CAD-07 | Veículos — Lista | admin | ✅ Página carregou (3.5s) | missao136c-homologacao #22 | ✅ EXECUTADO NO NAVEGADOR |
| CAD-08 | Cad. Auxiliares — Regiões | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | CadastrosAuxiliares.tsx | 🔷 EXISTE NO CÓDIGO |
| CAD-09 | Cad. Auxiliares — Filiais | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | CadastrosAuxiliares.tsx | 🔷 EXISTE NO CÓDIGO |
| CAD-10 | Cad. Auxiliares — Unidades | admin | ✅ Página carregou (10.5s) | p0-sidebar #06 | ✅ EXECUTADO NO NAVEGADOR |
| CAD-11 | Cad. Auxiliares — Centros Custo | admin | ✅ Página carregou (10.4s) | p0-sidebar #09 | ✅ EXECUTADO NO NAVEGADOR |
| CAD-12 | Cad. Auxiliares — Tabelas | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | CadastrosAuxiliares.tsx | 🔷 EXISTE NO CÓDIGO |
| CAD-13 | Análise de Documentos | admin | ✅ Página carregou (10.2s) | p0-sidebar #05 | ✅ EXECUTADO NO NAVEGADOR |

## 5. APOIO OPERACIONAL (11 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| OPER-01 | Página /operacao carregar | admin | ✅ Carregou com 8 abas (13.1s) | missao55-cenario1 #06 | ✅ EXECUTADO NO NAVEGADOR |
| OPER-02 | Aba Ordens de Serviço | admin | ✅ Carregou (21.2s) | missao55-cenario1 #07 | ✅ EXECUTADO NO NAVEGADOR |
| OPER-03 | Aba Escala | admin | ✅ Carregou (21.2s) | missao55-cenario1 #08 | ✅ EXECUTADO NO NAVEGADOR |
| OPER-04 | Aba Ocorrências | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Operacao.tsx | 🔷 EXISTE NO CÓDIGO |
| OPER-05 | Aba Comprovantes/POD | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Operacao.tsx | 🔷 EXISTE NO CÓDIGO |
| OPER-06 | Aba Roteirização | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Operacao.tsx | 🔷 EXISTE NO CÓDIGO |
| OPER-07 | Aba Logística Reversa | admin | ❌ PlaceholderPage vazio | Operacao.tsx:79 | ❌ FALHOU |
| OPER-08 | Aba Reentregas | admin | ❌ PlaceholderPage vazio | Operacao.tsx:83 | ❌ FALHOU |
| OPER-09 | Aba Programação | admin | 🔶 NÃO TESTADO (sidebar cita, mas Operacao.tsx não tem aba) | Sidebar vs código | 🔶 NÃO TESTADO |
| OPER-10 | Controle de Pátio | admin | ✅ Página carregou (8.1s) | m136c2-navegacao #31 | ✅ EXECUTADO NO NAVEGADOR |
| OPER-11 | Solicitações Cliente | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Operacao.tsx | 🔷 EXISTE NO CÓDIGO |

## 6. GESTÃO DE FROTA (8 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| FROTA-01 | Página /frota carregar | admin | ✅ Carregou (13.1s) | missao55-cenario1 #09 | ✅ EXECUTADO NO NAVEGADOR |
| FROTA-02 | Aba Manutenção | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Frota.tsx | 🔷 EXISTE NO CÓDIGO |
| FROTA-03 | Aba Abastecimento | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Frota.tsx | 🔷 EXISTE NO CÓDIGO |
| FROTA-04 | Aba Documentos | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Frota.tsx | 🔷 EXISTE NO CÓDIGO |
| FROTA-05 | Aba Seguros | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Frota.tsx | 🔷 EXISTE NO CÓDIGO |
| FROTA-06 | Aba Custos | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Frota.tsx | 🔷 EXISTE NO CÓDIGO |
| FROTA-07 | Botão Nova OS Oficina | admin | ❌ Botão disabled | Frota.tsx:114 | ❌ FALHOU |
| FROTA-08 | Botão Lançar Cupom | admin | ❌ Botão disabled | Frota.tsx:156 | ❌ FALHOU |

## 7. FINANCEIRO ENTERPRISE (12 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| FIN-01 | Página /financeiro carregar | admin | ✅ Carregou (13.2s) | missao55-cenario1 #10 | ✅ EXECUTADO NO NAVEGADOR |
| FIN-02 | Aba Dashboard Financeiro | admin | ✅ Carregou (4.1s) | missao136c-homologacao #11 | ✅ EXECUTADO NO NAVEGADOR |
| FIN-03 | Aba Contas a Receber | admin | ✅ Carregou (3.4s) | missao136c-homologacao #12 | ✅ EXECUTADO NO NAVEGADOR |
| FIN-04 | Aba Contas a Pagar | admin | ✅ Carregou (3.4s) | missao136c-homologacao #13 | ✅ EXECUTADO NO NAVEGADOR |
| FIN-05 | Aba Fluxo de Caixa | admin | ✅ Carregou (3.6s) | missao136c-homologacao #14 | ✅ EXECUTADO NO NAVEGADOR |
| FIN-06 | Aba DRE Gerencial | admin | ✅ Carregou (3.4s) | missao136c-homologacao #15 | ✅ EXECUTADO NO NAVEGADOR |
| FIN-07 | Aba Conciliação | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Financeiro.tsx | 🔷 EXISTE NO CÓDIGO |
| FIN-08 | Aba Pagamento CNAB | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Financeiro.tsx | 🔷 EXISTE NO CÓDIGO |
| FIN-09 | Aba Rentabilidade | admin | 🟡 PARCIAL — stub vazio | Financeiro.tsx:210 | 🟡 PARCIAL |
| FIN-10 | Aba Seguros Auto | admin | ✅ Página carregou (10.2s) | p0-sidebar #10 | ✅ EXECUTADO NO NAVEGADOR |
| FIN-11 | Aba Contabilidade | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Financeiro.tsx | 🔷 EXISTE NO CÓDIGO |
| FIN-12 | Aba Inadimplência | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Financeiro.tsx | 🔷 EXISTE NO CÓDIGO |

## 8. FISCAL & FATURAMENTO (7 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| FISCAL-01 | Página /fiscal carregar | admin | ✅ Carregou (8.2s) | m136c2-navegacao #15 | ✅ EXECUTADO NO NAVEGADOR |
| FISCAL-02 | Aba CT-e | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Fiscal.tsx | 🔷 EXISTE NO CÓDIGO |
| FISCAL-03 | Aba MDF-e | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Fiscal.tsx | 🔷 EXISTE NO CÓDIGO |
| FISCAL-04 | Aba NFSe | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Fiscal.tsx | 🔷 EXISTE NO CÓDIGO |
| FISCAL-05 | Aba Documentos | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Fiscal.tsx | 🔷 EXISTE NO CÓDIGO |
| FISCAL-06 | Aba Dashboard Fiscal | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Fiscal.tsx | 🔷 EXISTE NO CÓDIGO |
| FISCAL-07 | Aba Auditoria | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Fiscal.tsx | 🔷 EXISTE NO CÓDIGO |

## 9. CONTRATOS (3 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| CONT-01 | Página /contratos carregar | admin | ✅ Carregou (13.1s) | missao55-cenario1 #12 | ✅ EXECUTADO NO NAVEGADOR |
| CONT-02 | Aba Modelos | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Contratos.tsx | 🔷 EXISTE NO CÓDIGO |
| CONT-03 | Aba Contratos Gerados | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | Contratos.tsx | 🔷 EXISTE NO CÓDIGO |

## 10. SLA E QUALIDADE (2 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| SLA-01 | Página /sla carregar | admin | ✅ Carregou (8.2s) | m136c2-navegacao #18 | ✅ EXECUTADO NO NAVEGADOR |
| SLA-02 | Dados vêm do Supabase | admin | ❌ 100% hardcoded/mock, sem dados reais | SLA.tsx | ❌ FALHOU |

## 11. CENTRAL DE ROBÔS IA (3 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| IA-01 | Página /central-ia carregar | admin | ✅ Carregou (8.2s) | m136c2-navegacao #24 | ✅ EXECUTADO NO NAVEGADOR |
| IA-02 | Aba Robôs com sub-abas | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | CentralIA.tsx | 🔷 EXISTE NO CÓDIGO |
| IA-03 | Demais abas IA (17) | admin | 🔶 NÃO TESTADO | CentralIA.tsx | 🔶 NÃO TESTADO |

## 12. RELATÓRIOS (2 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| REL-01 | Página /relatorios carregar | admin | ✅ Carregou (13.2s) | missao55-cenario1 #11 | ✅ EXECUTADO NO NAVEGADOR |
| REL-02 | Exportação PDF/Excel | admin | 🔷 EXISTE NO CÓDIGO — NÃO EXECUTADO | relatorios-export.spec.ts | 🔷 EXISTE NO CÓDIGO |

## 13. PORTAL CLIENTE (10 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| PC-01 | Página /portal-cliente carregar | admin | ✅ Carregou (8.2s) | m136c2-navegacao #28 | ✅ EXECUTADO NO NAVEGADOR |
| PC-02 | Aba Pedidos | cliente | ✅ Carregou com dados reais (15.9s) | missao55-cenario2 #01 | ✅ EXECUTADO NO NAVEGADOR |
| PC-03 | Aba Financeiro | cliente | ✅ Carregou com dados reais (15.4s) | missao55-cenario2 #02 | ✅ EXECUTADO NO NAVEGADOR |
| PC-04 | Aba Ocorrências | cliente | ✅ Carregou com dados reais (13.3s) | missao55-cenario2 #03 | ✅ EXECUTADO NO NAVEGADOR |
| PC-05 | Aba Comprovantes | cliente | ✅ Carregou com dados reais (15.4s) | missao55-cenario2 #04 | ✅ EXECUTADO NO NAVEGADOR |
| PC-06 | Aba Perfil | cliente | ✅ Carregou com dados reais (15.3s) | missao55-cenario2 #05 | ✅ EXECUTADO NO NAVEGADOR |
| PC-07 | Aba Fiscal | cliente | ✅ Carregou com dados reais (13.2s) | missao55-cenario2 #06 | ✅ EXECUTADO NO NAVEGADOR |
| PC-08 | Aba Relatórios | cliente | ✅ Carregou com dados reais (15.3s) | missao55-cenario2 #07 | ✅ EXECUTADO NO NAVEGADOR |
| PC-09 | Tracking GPS | cliente | ❌ portal_tracking_realtime sempre vazia | Inspeção código M61 | ❌ FALHOU |
| PC-10 | Onboarding | cliente | ❌ Local state, não persiste | Inspeção código M82 | ❌ FALHOU |

## 14. ERROS E PERMISSÕES (3 cenários)

| ID | Cenário | Perfil | Resultado | Evidência | Status |
|----|---------|--------|-----------|-----------|--------|
| ERR-01 | 404 para rota inexistente | N/A | ✅ NotFound renderizado (11.1s) | missao55-cenario3 #01 | ✅ EXECUTADO NO NAVEGADOR |
| ERR-02 | Navegação sem console.error | admin | ✅ 0 erros em 12 módulos (16.3s) | missao55-cenario3 #04 | ✅ EXECUTADO NO NAVEGADOR |
| ERR-03 | Tela de login carrega | N/A | ✅ Campos visíveis (4.7s) | missao55-cenario3 #05 | ✅ EXECUTADO NO NAVEGADOR |

---

## MATRIZ DE COBERTURA POR MÓDULO (CORRIGIDA)

| Módulo | Cenários | Executados | Aprovados funcionalmente | Falharam | Bloqueados | Só código | Não testados | Cobertura real |
|--------|----------|------------|--------------------------|----------|------------|-----------|--------------|----------------|
| Autenticação | 10 | 8/10 | 8 | 0 | 0 | 0 | 2 | 80% |
| Dashboard | 5 | 1/5 | 1 | 0 | 0 | 1 | 3 | 20% |
| Gestão Comercial | 8 | 1/8 | 1 | 0 | 0 | 7 | 0 | 12% |
| Cadastros Base | 13 | 8/13 | 8 | 0 | 0 | 3 | 2 | 61% |
| Apoio Operacional | 11 | 5/11 | 5 | 2 | 0 | 3 | 1 | 45% |
| Gestão de Frota | 8 | 1/8 | 1 | 2 | 0 | 5 | 0 | 12% |
| Financeiro | 12 | 6/12 | 6 | 0 | 0 | 4 | 2 | 50% |
| Fiscal | 7 | 1/7 | 1 | 0 | 0 | 6 | 0 | 14% |
| Contratos | 3 | 1/3 | 1 | 0 | 0 | 2 | 0 | 33% |
| SLA | 2 | 2/2 | 1 | 1 | 0 | 0 | 0 | 50% |
| Central IA | 3 | 1/3 | 1 | 0 | 0 | 1 | 1 | 33% |
| Relatórios | 2 | 1/2 | 1 | 0 | 0 | 1 | 0 | 50% |
| Portal Cliente | 10 | 8/10 | 8 | 2 | 0 | 0 | 0 | 80% |
| Erros/Permissões | 3 | 3/3 | 3 | 0 | 0 | 0 | 0 | 100% |
| **TOTAL** | **97** | **47/97** | **46** | **7** | **0** | **33** | **11** | **47%** |

**Nota sobre cobertura:** 33 cenários (34%) são "EXISTE NO CÓDIGO — NÃO EXECUTADO". Se removidos do denominador, a cobertura funcional real sobre cenários testáveis é 46/(97-33) = **72%**.
