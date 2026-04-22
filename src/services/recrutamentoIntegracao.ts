// src/services/recrutamentoIntegracao.ts
// Serviço centralizado de integração Recrutamento → Prestadores
// Regras: anti-duplicidade, mapeamento completo, vínculo de documentos
import { supabase } from "@/lib/supabase";
import { vincularDocumentoCandidatoAPrestador } from "./documentosPrestadorService";

export interface CandidatoRecrutamento {
  id: string;
  nome_completo: string;
  cpf_cnpj?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  cidade?: string;
  uf?: string;
  regiao?: string;
  tipo_veiculo?: string;
  tipo_carroceria?: string;
  placa?: string;
  experiencia_anos?: number;
  como_conheceu?: string;
  mensagem_livre?: string;
  canal_captacao?: string;
  status: string;
  score_perfil: number;
  prioridade: number;
  ultima_interacao?: string;
  created_at: string;
  prestador_id?: string;
  candidato_documentos?: Array<{
    id?: string;
    tipo: string;
    url_arquivo?: string;
    validade?: string;
  }>;
}

export interface ResultadoAtivacao {
  success: boolean;
  tipo: "criado" | "atualizado" | "ja_existente" | "erro";
  prestador_id: string;
  mensagem: string;
  campos_atualizados?: string[];
}

export interface BuscaDuplicidade {
  campo: "cpf_cnpj" | "email" | "telefone";
  prestador: any;
}

function normalizarDoc(doc: string): string {
  return (doc || "").replace(/\D/g, "");
}

function checarDuplicidadeCpf(cpf: string): Promise<any | null> {
  const cpfLimpo = normalizarDoc(cpf);
  if (cpfLimpo.length < 11) return Promise.resolve(null);
  return supabase
    .from("prestadores")
    .select("*")
    .eq("cpf_cnpj", cpfLimpo)
    .limit(1)
    .maybeSingle()
    .then(r => r?.cpf_cnpj === cpfLimpo ? r : null);
}

function checarDuplicidadeEmail(email: string): Promise<any | null> {
  if (!email || !email.includes("@")) return Promise.resolve(null);
  return supabase
    .from("prestadores")
    .select("*")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
}

function checarDuplicidadeTelefone(telefone: string): Promise<any | null> {
  const telLimpo = normalizarDoc(telefone);
  if (telLimpo.length < 10) return Promise.resolve(null);
  return supabase
    .from("prestadores")
    .select("*")
    .ilike("telefone", `%${telLimpo}%`)
    .limit(1)
    .maybeSingle();
}

export async function checarDuplicidade(
  candidato: CandidatoRecrutamento
): Promise<BuscaDuplicidade | null> {
  const verificacoes = [
    { campo: "cpf_cnpj" as const, fn: () => checarDuplicidadeCpf(candidato.cpf_cnpj || "") },
    { campo: "email" as const, fn: () => checarDuplicidadeEmail(candidato.email || "") },
    { campo: "telefone" as const, fn: () => checarDuplicidadeTelefone(candidato.telefone || candidato.whatsapp || "") },
  ];

  for (const v of verificacoes) {
    const existente = await v.fn();
    if (existente) {
      console.log(`[Recrutamento→Prestador] Duplicidade via ${v.campo}: ${existente.id}`);
      return { campo: v.campo, prestador: existente };
    }
  }
  return null;
}

export async function ativarPrestador(
  candidato: CandidatoRecrutamento,
  opts: { modo?: "aprovar" | "simular" } = {}
): Promise<ResultadoAtivacao> {
  if (opts.modo === "simular") {
    return {
      success: true,
      tipo: "criado",
      prestador_id: "sim-000",
      mensagem: "Simulação: fluxo aprovado sem criar registro",
    };
  }

  const duplicado = await checarDuplicidade(candidato);

  if (duplicado) {
    const existente = duplicado.prestador;
    console.log(`[Recrutamento→Prestador] Atualizando existente ${existente.id} via ${duplicado.campo}`);

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    const camposAtualizados: string[] = [];

    if (candidato.nome_completo && !existente.nome_completo) {
      updates.nome_completo = candidato.nome_completo;
      camposAtualizados.push("nome_completo");
    }
    if (candidato.whatsapp && !existente.whatsapp) {
      updates.whatsapp = candidato.whatsapp;
      camposAtualizados.push("whatsapp");
    }
    if (candidato.telefone && !existente.telefone) {
      updates.telefone = candidato.telefone;
      camposAtualizados.push("telefone");
    }
    if (candidato.email && !existente.email) {
      updates.email = candidato.email;
      camposAtualizados.push("email");
    }
    if (candidato.tipo_veiculo && !existente.tipo_parceiro) {
      updates.tipo_parceiro = "autonomo";
      camposAtualizados.push("tipo_parceiro");
    }
    if (candidato.cidade) updates.cidade = candidato.cidade;
    if (candidato.uf) updates.uf = candidato.uf;
    updates.observacoes_torre = [
      existente.observacoes_torre || "",
      `[${new Date().toLocaleDateString("pt-BR")}] Atualizado via Recrutamento — ${duplicado.campo}: ${candidato.cpf_cnpj || candidato.email || candidato.telefone}`,
    ].filter(Boolean).join("\n");

    const { error: updError } = await supabase
      .from("prestadores")
      .update(updates)
      .eq("id", existente.id);

    if (updError) {
      console.error("[Recrutamento→Prestador] Erro ao atualizar:", updError);
      return { success: false, tipo: "erro", prestador_id: existente.id, mensagem: updError.message };
    }

    if (candidato.candidato_documentos?.length) {
      for (const doc of candidato.candidato_documentos) {
        if (!doc.url_arquivo) continue;
        await supabase.from("documentos_prestadores").insert([{
          prestador_id: existente.id,
          candidato_id: candidato.id,
          tipo: doc.tipo || "outro",
          arquivo: doc.url_arquivo,
          validade: doc.validade || null,
          status: "valido",
          origem: "recrutamento_migrado",
          created_at: new Date().toISOString(),
        }]).then(({ error: docError }) => {
          if (docError) console.warn("[Recrutamento→Prestador] Erro ao vincular doc:", docError);
          else console.log(`[Recrutamento→Prestador] Doc vinculado: ${doc.tipo}`);
        });
      }
    }

    await supabase.from("candidatos").update({
      status: "ativo",
      prestador_id: existente.id,
      updated_at: new Date().toISOString(),
    }).eq("id", candidato.id);

    await supabase.from("reservas_banco").update({ status: "ativo" }).eq("candidato_id", candidato.id);

    await vincularDocumentoCandidatoAPrestador(candidato.id, existente.id).then((res) => {
      if (res.migrados > 0) {
        console.log(`[Recrutamento→Prestador] ${res.migrados} documento(s) existente(s) migrado(s)`);
      }
    });

    return {
      success: true,
      tipo: "atualizado",
      prestador_id: existente.id,
      mensagem: `Prestador existente atualizado (match por ${duplicado.campo})`,
      campos_atualizados: camposAtualizados,
    };
  }

  console.log(`[Recrutamento→Prestador] Criando novo prestador para ${candidato.nome_completo}`);

  const novoPrestador: Record<string, any> = {
    nome_completo: candidato.nome_completo,
    cpf_cnpj: normalizarDoc(candidato.cpf_cnpj || ""),
    telefone: candidato.telefone || candidato.whatsapp || "",
    whatsapp: candidato.whatsapp || candidato.telefone || "",
    email: candidato.email || "",
    cidade: candidato.cidade || "",
    uf: candidato.uf || "",
    regiao_principal: candidato.regiao || "",
    tipo_parceiro: "autonomo",
    status: "ativo",
    origem_cadastro: "recrutamento",
    data_cadastro: new Date().toLocaleDateString("pt-BR"),
    data_aprovacao: new Date().toISOString(),
    observacoes_torre: `[${new Date().toLocaleDateString("pt-BR")}] Criado via Recrutamento Inteligente. Canal: ${candidato.canal_captacao || "não informado"}.`,
    veiculos: candidato.placa ? [{
      placa: candidato.placa,
      tipo: candidato.tipo_veiculo || "outro",
    }] : [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: prestador, error: insertError } = await supabase
    .from("prestadores")
    .insert([novoPrestador])
    .select("id")
    .single();

  if (insertError) {
    console.error("[Recrutamento→Prestador] Erro ao criar:", insertError);
    return { success: false, tipo: "erro", prestador_id: "", mensagem: insertError.message };
  }

  console.log(`[Recrutamento→Prestador] Criado: ${prestador.id}`);

  if (candidato.candidato_documentos?.length) {
    for (const doc of candidato.candidato_documentos) {
      if (!doc.url_arquivo) continue;
      await supabase.from("documentos_prestadores").insert([{
        prestador_id: prestador.id,
        tipo: doc.tipo || "outro",
        arquivo: doc.url_arquivo,
        validade: doc.validade || null,
        status: "valido",
        created_at: new Date().toISOString(),
      }]).then(({ error: docError }) => {
        if (docError) console.warn("[Recrutamento→Prestador] Erro ao vincular doc:", docError);
        else console.log(`[Recrutamento→Prestador] Doc vinculado: ${doc.tipo}`);
      });
    }
  }

  await supabase.from("candidatos").update({
    status: "ativo",
    prestador_id: prestador.id,
    updated_at: new Date().toISOString(),
  }).eq("id", candidato.id);

  await supabase.from("reservas_banco").update({ status: "ativo" }).eq("candidato_id", candidato.id);

  await supabase.from("homologacoes").insert([{
    candidato_id: candidato.id,
    data_homologacao: new Date().toLocaleDateString("pt-BR"),
    status: "aprovado",
    obs: "Aprovado via Recrutamento Inteligente — criação automática em prestadores",
    created_at: new Date().toISOString(),
  }]).then(({ error: hError }) => {
    if (hError) console.warn("[Recrutamento→Prestador] Erro homologação:", hError);
  });

  await vincularDocumentoCandidatoAPrestador(candidato.id, prestador.id).then((res) => {
    if (res.migrados > 0) {
      console.log(`[Recrutamento→Prestador] ${res.migrados} documento(s) existente(s) migrado(s)`);
    }
  });

  return {
    success: true,
    tipo: "criado",
    prestador_id: prestador.id,
    mensagem: "Prestador criado com sucesso via Recrutamento Inteligente",
  };
}

export async function atualizarEtapaCandidato(
  candidatoId: string,
  novaEtapa: string
): Promise<void> {
  await supabase.from("candidatos").update({
    status: novaEtapa,
    updated_at: new Date().toISOString(),
  }).eq("id", candidatoId);
}