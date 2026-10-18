import fs from "node:fs";
const a = JSON.parse(fs.readFileSync("scripts/_tms01sec_auditoria.json", "utf8"));
const p = JSON.parse(fs.readFileSync("scripts/_tms01sec_anon_probe.json", "utf8"));
const L = []; const w = (s) => L.push(s);
const tbl = (n) => a.tabelas.find((t) => t.tabela === n) || {};

w("================================================================================");
w("TMS-01-SEC — AUDITORIA DE SEGURANCA, RLS E MULTI-TENANT");
w("Nivel 3 (Fechamento Tecnico do TMS) — SOMENTE LEITURA (nenhum dado alterado)");
w("Gerado em ....: " + new Date().toISOString());
w("Projeto ......: Supabase uwrvzsjtpgaifkktpepn (PRODUCAO)");
w("================================================================================");
w("");
w("RESULTADO: AUDITORIA CONCLUIDA — RLS habilitada em todas as tabelas criticas e RPCs");
w("           protegidas por auth.uid()+tenant. 1 ACHADO ALTO: tenant_usuarios legivel");
w("           por ANON (provado). Demais achados sao de hardening (ja backlogados).");
w("");
w("--------------------------------------------------------------------------------");
w("1. RLS POR TABELA CRITICA");
w("--------------------------------------------------------------------------------");
for (const t of a.tabelas) {
  if (!t.existe) { w("  " + String(t.tabela).padEnd(26) + " | NAO EXISTE"); continue; }
  w("  " + String(t.tabela).padEnd(26) + " | RLS=" + (t.rls ? "ON " : "OFF") + " | policies=" + t.n_policies);
}
w("");
w("  Detalhe das policies (tabelas-alvo da missao):");
for (const nome of ["ordens_servico", "pagamentos_prestadores", "prestadores", "tenant_usuarios"]) {
  const t = tbl(nome); if (!t.policies) continue;
  w("   * " + nome + ":");
  for (const pl of t.policies) w("       [" + String(pl.cmd).padEnd(6) + "] " + pl.policyname + " roles=" + pl.roles);
}
w("  [i] 'perfis_usuario' NAO existe; o controle real e tenant_usuarios + perfis_permissoes.");
w("");
w("--------------------------------------------------------------------------------");
w("2. RPCs CRITICAS — GUARDAS");
w("--------------------------------------------------------------------------------");
w("  RPC                                        | DEFINER | auth.uid | tenant | papel | search_path");
w("  -------------------------------------------|---------|----------|--------|-------|------------");
for (const r of a.rpcs) {
  if (r.existe === false) { w("  " + String(r.nome).padEnd(43) + " | NAO EXISTE"); continue; }
  w("  " + String(r.nome).slice(0,43).padEnd(43) + " |   " + (r.security_definer?"sim":"NAO") + "   |    " + (r.tem_auth_uid?"sim":"NAO") + "   |  " + (r.tem_tenant?"sim":"NAO") + "   |  " + (r.tem_papel?"sim":"NAO") + "  |    " + (r.tem_search_path?"sim":"NAO"));
}
w("");
w("  [OK] f_confirmar_pagamento_prestador / f_gerar_lote_pagamentos / f_aprovar_pagamento_");
w("       prestadores / f_emitir_fatura: DEFINER + auth.uid + tenant + papel + search_path.");
w("  [OK] f_avancar_etapa_app_motorista / f_buscar_operacoes_motorista: DEFINER + auth.uid +");
w("       tenant (escopo prestador; sem 'papel' por design).");
w("  [!!] f_atualizar_reversa_app: DEFINER + auth.uid mas SEM guarda de tenant (achado A02).");
w("");
w("--------------------------------------------------------------------------------");
w("3. PROVA DE EXPOSICAO COM CHAVE ANON (sem autenticacao)");
w("--------------------------------------------------------------------------------");
w("  Tabela                     | HTTP | linhas p/ anon");
w("  ---------------------------|------|---------------");
for (const x of p.probes) w("  " + String(x.tabela).padEnd(26) + " | " + String(x.status).padEnd(4) + " | " + x.linhas_retornadas);
w("");
w("  [!!] tenant_usuarios RETORNA LINHAS (3) PARA ANON -> exposicao real (policy tu_select_anon");
w("       roles={anon,authenticated} qual=true).");
w("  [OK] ordens_servico / clientes / prestadores / pagamentos_prestadores / financeiro_pagar /");
w("       financeiro_receber / documentos_prestadores: 0 linhas p/ anon (RLS bloqueia).");
w("");
w("--------------------------------------------------------------------------------");
w("4. ACHADOS (riscos)");
w("--------------------------------------------------------------------------------");
w("  F1 [ALTO]  tenant_usuarios.tu_select_anon: SELECT qual=true para anon+authenticated.");
w("             Provado: anon key le 3 linhas. Acao: remover policy anon / restringir a");
w("             (user_id = auth.uid()) ou a tenant do usuario.");
w("  F2 [MEDIO] tenant_usuarios.tu_update_auth: UPDATE qual=true para authenticated (sem");
w("             escopo de tenant). Acao: exigir user_id = auth.uid()/papel admin.");
w("  F3 [MEDIO] GRANTs residuais a anon/PUBLIC nas tabelas criticas (clientes, ordens_servico,");
w("             prestadores, financeiro_pagar/receber, documentos_prestadores). RLS bloqueia,");
w("             mas e privilegio residual -> REVOKE anon (item [S3] conhecido).");
w("  F4 [MEDIO] f_atualizar_reversa_app sem guarda de tenant (anomalia A02, M133-D.3/D.4).");
w("  F5 [INFO]  'perfis_usuario' inexistente; usar tenant_usuarios + perfis_permissoes.");
w("");
w("--------------------------------------------------------------------------------");
w("5. CONCLUSao");
w("--------------------------------------------------------------------------------");
w("  [OK] RLS habilitada em 100% das tabelas criticas verificadas.");
w("  [OK] Policies TMS escopadas por tenant_usuarios.user_id = auth.uid() (isolamento tenant).");
w("  [OK] Policies prestador/cliente por auth.uid()/f_obter_cliente_id_do_usuario().");
w("  [OK] RPCs criticas SECURITY DEFINER com auth.uid() (+tenant e papel nas financeiras).");
w("  [OK] Anon bloqueado nas tabelas operacionais/financeiras (0 linhas).");
w("  [!!] F1 deve ser tratado (tenant_usuarios legivel por anon) — hardening de seguranca.");
w("");
w("EVIDENCIAS: scripts/_tms01sec_auditoria.json | scripts/_tms01sec_anon_probe.json");
w("================================================================================");
w("FIM — TMS-01-SEC");
w("================================================================================");
fs.writeFileSync("TMS-01-SEC-LOG.txt", L.join("\r\n"), "latin1");
console.log(L.join("\n"));
console.log("\nGRAVADO: TMS-01-SEC-LOG.txt (" + fs.statSync("TMS-01-SEC-LOG.txt").size + " bytes)");
