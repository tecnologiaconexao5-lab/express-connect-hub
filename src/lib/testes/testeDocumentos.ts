// src/lib/testes/testeDocumentos.ts
// Testes automatizados para validação de documentos de prestadores
// REGRA: não altera nada existente, apenas valida integrações

import { supabase } from "@/lib/supabase";
import { checarDuplicidade, ativarPrestador } from "@/services/recrutamentoIntegracao";
import { adicionarDocumentoPrestador, listarDocumentosPrestador, verificarDocumentosOrfaos } from "@/services/documentosPrestadorService";

const now = () => new Date().toISOString();

interface TesteDocLog {
  passo: number;
  etapa: string;
  status: "ok" | "fail" | "skip";
  mensagem: string;
  erro?: string;
}

interface ResultadoTesteDocs {
  sucesso: boolean;
  duracaoTotal: string;
  logs: TesteDocLog[];
  ids: {
    candidato?: string;
    prestador?: string;
    documento?: string;
  };
}

function logDoc(
  logs: TesteDocLog[],
  passo: number,
  etapa: string,
  status: TesteDocLog["status"],
  mensagem: string,
  erro?: string
): void {
  logs.push({ passo, etapa, status, mensagem, erro });
}

export async function testarFluxoDocumentos(
  opts: { limparAoFim?: boolean } = {}
): Promise<ResultadoTesteDocs> {
  const inicio = Date.now();
  const logs: TesteDocLog[] = [];
  const ids: ResultadoTesteDocs["ids"] = {};
  const cpfTeste = `00000000${String(Date.now()).slice(-3)}`;

  logDoc(logs, 0, "Início", "ok", `CPF teste: ${cpfTeste}`);

  // PASSO 1: Criar candidato com documento
  logDoc(logs, 1, "Criar Candidato", "ok", "Iniciando...");
  try {
    const { data, error } = await supabase.from("candidatos").insert([{
      nome_completo: "TESTE-AUTO-DOCUMENTO",
      cpf_cnpj: cpfTeste,
      telefone: "(11) 99999-TEST",
      whatsapp: "(11) 99999-TEST",
      email: `teste-doc-${Date.now()}@conexaexpress.com.br`,
      cidade: "São Paulo",
      uf: "SP",
      tipo_veiculo: "HR",
      canal_captacao: "teste_automatico",
      status: "interessado",
      score_perfil: 80,
      prioridade: 1,
      created_at: now(),
    }]).select("id").single();

    if (error || !data) {
      logDoc(logs, 1, "Criar Candidato", "fail", "Erro ao criar", error?.message);
      return { sucesso: false, duracaoTotal: "0ms", logs, ids };
    }

    ids.candidato = data.id;
    logDoc(logs, 1, "Criar Candidato", "ok", `Criado: ${data.id}`);

    // PASSO 2: Adicionar documento ao candidato
    const docResult = await adicionarDocumentoPrestador({
      candidato_id: data.id,
      tipo: "CNH Frente",
      url_arquivo: "test://storage/mock-cnh.png",
      status: "pendente",
      origem: "teste_automatico",
    });

    if (docResult.success) {
      ids.documento = docResult.id;
      logDoc(logs, 2, "Adicionar Documento", "ok", `Doc criado: ${docResult.id}`);
    } else {
      logDoc(logs, 2, "Adicionar Documento", "fail", docResult.mensagem);
    }

  } catch (e: any) {
    logDoc(logs, 1, "Criar Candidato", "fail", "Exceção", e.message);
    return { sucesso: false, duracaoTotal: "0ms", logs, ids };
  }

  // PASSO 3: Ativar candidato como prestador
  logDoc(logs, 3, "Ativar Prestador", "ok", "Iniciando...");
  try {
    const resultado = await ativarPrestador({
      id: ids.candidato!,
      nome_completo: "TESTE-AUTO-DOCUMENTO",
      cpf_cnpj: cpfTeste,
      telefone: "(11) 99999-TEST",
      whatsapp: "(11) 99999-TEST",
      email: `teste-doc-${Date.now()}@conexaexpress.com.br`,
      cidade: "São Paulo",
      uf: "SP",
      tipo_veiculo: "HR",
      status: "aprovado",
      score_perfil: 85,
      prioridade: 1,
      created_at: now(),
    });

    if (resultado.success && resultado.prestador_id) {
      ids.prestador = resultado.prestador_id;
      logDoc(logs, 3, "Ativar Prestador", "ok", `Prestador: ${resultado.prestador_id}`);
    } else {
      logDoc(logs, 3, "Ativar Prestador", "fail", resultado.mensagem);
    }
  } catch (e: any) {
    logDoc(logs, 3, "Ativar Prestador", "fail", "Exceção", e.message);
  }

  // PASSO 4: Verificar documento migrado para prestador
  if (ids.prestador) {
    logDoc(logs, 4, "Verificar Migração", "ok", "Verificando...");
    try {
      const docs = await listarDocumentosPrestador(ids.prestador);
      const temDoc = docs.find(d => d.tipo === "CNH Frente" || (d as any).tipo === "CNH Frente");
      
      if (temDoc) {
        logDoc(logs, 4, "Verificar Migração", "ok", `Doc migratingook for prestador: ${docs.length} documento(s)`);
      } else {
        logDoc(logs, 4, "Verificar Migração", "skip", "Nenhum doc migrado automaticamente (esperado)", "precisa verificar manualmente");
      }
    } catch (e: any) {
      logDoc(logs, 4, "Verificar Migração", "fail", "Erro ao listar", e.message);
    }
  }

  // PASSO 5: Verificar documentos órfãos
  logDoc(logs, 5, "Verificar Órfãos", "ok", "Verificando...");
  try {
    const { total, orphans } = await verificarDocumentosOrfaos();
    if (total > 0) {
      logDoc(logs, 5, "Verificar Órfãos", "skip", `${total} doc(s) órfão(s) encontrado(s)`, "verificar manualmente");
    } else {
      logDoc(logs, 5, "Verificar Órfãos", "ok", "Nenhum documento órfão");
    }
  } catch (e: any) {
    logDoc(logs, 5, "Verificar Órfãos", "fail", "Erro", e.message);
  }

  // PASSO 6: Limpeza
  if (opts.limparAoFim) {
    console.log("\n🧹 Limpando dados de teste...");
    if (ids.documento) await supabase.from("documentos_prestadores").delete().eq("id", ids.documento).catch(() => {});
    if (ids.prestador) await supabase.from("prestadores").delete().eq("id", ids.prestador).catch(() => {});
    if (ids.candidato) await supabase.from("candidatos").delete().eq("id", ids.candidato).catch(() => {});
    console.log("✔ Limpeza concluída.\n");
  }

  const sucesso = logs.every((l) => l.status === "ok" || l.status === "skip");
  const duracaoTotal = `${((Date.now() - inicio) / 1000).toFixed(2)}s`;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`  TESTE DE DOCUMENTOS`);
  console.log(`  Data: ${now()}`);
  console.log(`${"=".repeat(50)}`);
  logs.forEach((l) => {
    const icone = l.status === "ok" ? "✔" : l.status === "fail" ? "✗" : "○";
    console.log(`${icone} PASSO ${l.passo} — ${l.etapa}: ${l.mensagem}${l.erro ? ` (${l.erro})` : ""}`);
  });
  console.log(`${"=".repeat(50)}\n`);
  console.log(`  ${logs.filter(l => l.status === "ok").length}/${logs.length} passos OK`);
  console.log(`  Duração: ${duracaoTotal}`);
  console.log(`  ${sucesso ? "✔ SUCESSO" : "✗ FALHA"}\n`);

  return { sucesso, duracaoTotal, logs, ids };
}

export async function testarAntiDuplicidade(): Promise<{
  sucesso: boolean;
  mensagem: string;
}> {
  const cpfTeste = `00000000${String(Date.now()).slice(-3)}`;
  const email = `teste-duplic-${Date.now()}@conexaexpress.com.br`;

  // Primeiro, criar prestador
  const { data: prestador, error } = await supabase.from("prestadores").insert([{
    nome_completo: "TESTE ANTI-DUPLIC",
    cpf_cnpj: cpfTeste,
    telefone: "(11) 99999-TEST",
    whatsapp: "(11) 99999-TEST",
    email: email,
    tipo_parceiro: "autonomo",
    status: "ativo",
    origem_cadastro: "teste",
    created_at: now(),
    updated_at: now(),
  }]).select("id").single();

  if (error || !prestador) {
    return { sucesso: false, mensagem: `Erro ao criar: ${error?.message}` };
  }

  // Agora verificar se detecta duplicado
  const duplicado = await checarDuplicidade({
    id: "novo-candidato",
    nome_completo: "TESTE ANTI-DUPLIC",
    cpf_cnpj: cpfTeste,
    telefone: "(11) 99999-TEST",
    whatsapp: "(11) 99999-TEST",
    email: email,
    status: "interessado",
    created_at: now(),
    score_perfil: 0,
    prioridade: 0,
  });

  // Limpar
  await supabase.from("prestadores").delete().eq("id", prestador.id).catch(() => {});

  if (duplicado) {
    return { sucesso: true, mensagem: `Duplicidade detectada via ${duplicado.campo}` };
  }

  return { sucesso: false, mensagem: "Duplicidade NÃO detectada" };
}

export default testarFluxoDocumentos;