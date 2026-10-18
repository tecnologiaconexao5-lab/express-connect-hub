import { createClient } from "@supabase/supabase-js";

const SUPABASE_PROD_REF = "uwrvzsjtpgaifkktpepn";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function guardarContraProducao(nomeFuncao: string): void {
  const url = process.env.VITE_SUPABASE_URL || SUPABASE_URL;
  if (url.includes(SUPABASE_PROD_REF)) {
    throw new Error(
      `[R6 GUARD] ${nomeFuncao} BLOQUEADA em Produção (${SUPABASE_PROD_REF}). ` +
      `Crie um ambiente QA para executar testes destrutivos.`
    );
  }
}

export interface AlocacaoEscala {
  id: string;
  prestador_id: string;
  data_escala: string;
  status: string;
  aceite_prestador: boolean;
  data_aceite: string | null;
  origem: string | null;
  destino: string | null;
  rota: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
  horario_inicio_real?: string | null;
  finalizada?: boolean;
  data_finalizacao?: string | null;
  horario_fim_real?: string | null;
  observacoes?: string | null;
  comprovante_url?: string | null;
  km_realizados?: number | null;
  tempo_total_minutos?: number | null;
}

export async function buscarAlocacaoPorId(id: string): Promise<AlocacaoEscala | null> {
  const { data, error } = await supabase
    .from("alocacoes_escala")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("[Supabase] Erro ao buscar alocação:", error.message);
    return null;
  }
  return data as AlocacaoEscala;
}

export async function buscarUltimaAlocacaoDoPrestador(
  prestadorId: string
): Promise<AlocacaoEscala | null> {
  const { data, error } = await supabase
    .from("alocacoes_escala")
    .select("*")
    .eq("prestador_id", prestadorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[Supabase] Erro ao buscar última alocação:", error.message);
    return null;
  }
  return data as AlocacaoEscala | null;
}

export function criarTestRunId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `${ts}-${rand}`;
}

export async function buscarAlocacaoPorDestino(destino: string): Promise<AlocacaoEscala | null> {
  const { data, error } = await supabase
    .from("alocacoes_escala")
    .select("*")
    .eq("destino", destino)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[Supabase] Erro ao buscar alocação por destino:", error.message);
    return null;
  }
  return data as AlocacaoEscala | null;
}

export function validarAlocacaoAposCriacao(aloc: AlocacaoEscala, prestadorId: string, origem: string, destino: string): string[] {
  const erros: string[] = [];
  if (aloc.prestador_id !== prestadorId) erros.push(`prestador_id esperado ${prestadorId}, obtido ${aloc.prestador_id}`);
  if (aloc.origem !== origem) erros.push(`origem esperada "${origem}", obtida "${aloc.origem}"`);
  if (aloc.destino !== destino) erros.push(`destino esperado "${destino}", obtido "${aloc.destino}"`);
  if (aloc.status !== "aguardando_aceite") erros.push(`status esperado "aguardando_aceite", obtido "${aloc.status}"`);
  if (aloc.aceite_prestador !== false) erros.push(`aceite_prestador esperado false, obtido ${aloc.aceite_prestador}`);
  const meta = aloc.metadata || {};
  if (meta.origem_tms !== true) erros.push(`metadata.origem_tms esperado true, obtido ${meta.origem_tms}`);
  if (meta.precisa_aceite_app !== true) erros.push(`metadata.precisa_aceite_app esperado true, obtido ${meta.precisa_aceite_app}`);
  return erros;
}

export function validarAlocacaoAposAceite(aloc: AlocacaoEscala): string[] {
  const erros: string[] = [];
  if (aloc.status !== "aceita") erros.push(`status esperado "aceita", obtido "${aloc.status}"`);
  if (aloc.aceite_prestador !== true) erros.push(`aceite_prestador esperado true, obtido ${aloc.aceite_prestador}`);
  if (!aloc.data_aceite) erros.push("data_aceite não foi preenchida");
  if (!aloc.updated_at) erros.push("updated_at nao foi atualizado");
  return erros;
}

export function validarAlocacaoAposInicioRota(aloc: AlocacaoEscala): string[] {
  const erros: string[] = [];
  if (aloc.status !== "em_rota") erros.push(`status esperado "em_rota", obtido "${aloc.status}"`);
  if (!aloc.horario_inicio_real) erros.push("horario_inicio_real nao foi preenchido");
  return erros;
}

export function validarAlocacaoAposFinalizacao(aloc: AlocacaoEscala): string[] {
  const erros: string[] = [];
  if (aloc.status !== "concluida") erros.push(`status esperado "concluida", obtido "${aloc.status}"`);
  if (aloc.finalizada !== true) erros.push("finalizada esperado true");
  if (!aloc.data_finalizacao) erros.push("data_finalizacao nao foi preenchida");
  if (!aloc.horario_fim_real) erros.push("horario_fim_real nao foi preenchido");
  if (!aloc.updated_at) erros.push("updated_at nao foi atualizado");
  return erros;
}

export async function aceitarAlocacaoDireto(id: string): Promise<AlocacaoEscala | null> {
  guardarContraProducao("aceitarAlocacaoDireto");
  const { data, error } = await supabase
    .from("alocacoes_escala")
    .update({
      status: "aceita",
      aceite_prestador: true,
      data_aceite: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[Supabase] Erro ao aceitar alocação direto:", error.message);
    return null;
  }
  return data as AlocacaoEscala;
}

export async function iniciarRotaDireto(id: string): Promise<AlocacaoEscala | null> {
  guardarContraProducao("iniciarRotaDireto");
  const { data, error } = await supabase
    .from("alocacoes_escala")
    .update({
      status: "em_rota",
      horario_inicio_real: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[Supabase] Erro ao iniciar rota direto:", error.message);
    return null;
  }
  return data as AlocacaoEscala;
}

export async function finalizarAlocacaoDireto(
  id: string,
  comprovanteUrl?: string
): Promise<AlocacaoEscala | null> {
  guardarContraProducao("finalizarAlocacaoDireto");
  const { data, error } = await supabase
    .from("alocacoes_escala")
    .update({
      status: "concluida",
      finalizada: true,
      data_finalizacao: new Date().toISOString(),
      horario_fim_real: new Date().toISOString(),
      comprovante_url: comprovanteUrl || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[Supabase] Erro ao finalizar alocação direto:", error.message);
    return null;
  }
  return data as AlocacaoEscala;
}

export interface FinanceiroAlocacaoData {
  alocacao_id: string;
  cliente_nome: string;
  prestador_nome: string;
  valor_cliente: number;
  valor_prestador_base: number;
  valor_prestador_adicionais: number;
  valor_prestador_descontos: number;
  valor_prestador_total: number;
  status: string;
  finalizada: boolean;
  pod_exists: boolean;
  pod_nome_recebedor: string | null;
}

export async function buscarFinanceiroDaAlocacao(
  alocacaoId: string,
  supabaseClient?: ReturnType<typeof createClient>
): Promise<FinanceiroAlocacaoData | null> {
  const client = supabaseClient || supabase;
  try {
    const { data: aloc, error } = await client
      .from("alocacoes_escala")
      .select(`
        *,
        clientes:cliente_id(nome_fantasia, razao_social),
        prestadores:prestador_id(nome_completo)
      `)
      .eq("id", alocacaoId)
      .single();

    if (error || !aloc) {
      console.error("[Supabase] Erro ao buscar alocacao financeiro:", error?.message);
      return null;
    }

    const { data: pod } = await client
      .from("entregas_protocolo")
      .select("nome_recebedor")
      .eq("alocacao_id", alocacaoId)
      .maybeSingle();

    const clienteNome = (aloc as any).clientes?.nome_fantasia || (aloc as any).clientes?.razao_social || "NÃO INFORMADO";
    const prestadorNome = (aloc as any).prestadores?.nome_completo || "NÃO INFORMADO";

    const valorRepasse = Number(aloc.valor_repasse) || 0;
    const valorPedagio = Number(aloc.valor_pedagio) || 0;
    const valorCombustivel = Number(aloc.valor_combustivel) || 0;
    const valorAjudante = Number(aloc.valor_ajudante) || 0;
    const valorAdicional = Number(aloc.valor_adicional) || 0;
    const valorDesconto = Number(aloc.valor_desconto) || 0;
    const adicionais = valorPedagio + valorCombustivel + valorAjudante + valorAdicional;
    const totalPrestador = valorRepasse + adicionais - valorDesconto;

    return {
      alocacao_id: aloc.id,
      cliente_nome: clienteNome,
      prestador_nome: prestadorNome,
      valor_cliente: Number(aloc.valor_frete) || 0,
      valor_prestador_base: valorRepasse,
      valor_prestador_adicionais: adicionais,
      valor_prestador_descontos: valorDesconto,
      valor_prestador_total: totalPrestador,
      status: aloc.status,
      finalizada: !!aloc.finalizada,
      pod_exists: !!pod,
      pod_nome_recebedor: pod?.nome_recebedor || null,
    };
  } catch (e: any) {
    console.error("[Supabase] Erro ao buscar financeiro:", e.message);
    return null;
  }
}

export interface CandidatoRecrutamento {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cidade: string;
  uf: string;
  veiculo: string;
  placa: string | null;
  score: number;
  score_comprometimento: number | null;
  classificacao_comprometimento: string | null;
  risco_desistencia: string | null;
  tempo_medio_resposta_horas: number | null;
  quantidade_cobrancas: number | null;
  confirmou_interesse: boolean | null;
  data_confirmacao_interesse: string | null;
  confirmou_pre_inicio: boolean | null;
  data_confirmacao_pre_inicio: string | null;
  compareceu_primeiro_dia: boolean | null;
  completou_30_dias: boolean | null;
  quantidade_reclamacoes: number | null;
  possui_outra_operacao_fixa: boolean | null;
  disponibilidade_recrutamento: string | null;
  historico_desistencias: string | null;
  etiquetas_automaticas: string[];
  parecer_ia: string | null;
  principais_riscos: string[];
  principais_pontos_positivos: string[];
  proxima_acao_sugerida: string | null;
  questionario_respostas: string | null;
  pipeline_validacoes: string | null;
  stage: string;
  tags: string[];
  observacoes_ia: string | null;
  created_at: string;
}

export async function buscarCandidatoPorNome(nome: string): Promise<CandidatoRecrutamento | null> {
  const { data, error } = await supabase
    .from("recrutamento_candidatos")
    .select("*")
    .eq("nome", nome)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[Supabase] Erro ao buscar candidato:", error.message);
    return null;
  }
  return data as CandidatoRecrutamento | null;
}

export async function deletarCandidatoPorNome(nome: string): Promise<void> {
  guardarContraProducao("deletarCandidatoPorNome");
  const { error } = await supabase
    .from("recrutamento_candidatos")
    .delete()
    .eq("nome", nome);
  if (error) {
    console.warn("[Supabase] Erro ao deletar candidato:", error.message);
  } else {
    console.log("[Supabase] Candidato deletado:", nome);
  }
}

export async function resetarDadosTeste(): Promise<void> {
  guardarContraProducao("resetarDadosTeste");
  console.log("[Supabase] Resetando dados de teste...");
  const { error } = await supabase
    .from("alocacoes_escala")
    .update({
      aceite_prestador: false,
      status: "aguardando_aceite",
      data_aceite: null,
      finalizada: false,
      data_finalizacao: null,
      horario_inicio_real: null,
      horario_fim_real: null,
      km_realizados: null,
    })
    .eq("prestador_id", "e6646799-fbac-453e-a3ef-afdfc01a7085");
  if (error) {
    console.warn("[Supabase] Erro ao resetar dados:", error.message);
  } else {
    console.log("[Supabase] Dados resetados com sucesso");
  }
}
