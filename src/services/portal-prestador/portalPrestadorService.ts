import { supabase } from "@/lib/supabase";
import { calculateScore, type ScoreResult } from "@/services/scoreEngine";
import { resolverUrlDocumento } from "@/services/documentos/documentoStorageService";

export interface Notificacao {
  id: string;
  tipo: "operacao" | "documento" | "financeiro" | "treinamento" | "sistema";
  titulo: string;
  mensagem: string;
  lida: boolean;
  data: string;
}

export interface Operacao {
  id: string;
  origem: string;
  destino: string;
  carga: string;
  peso: string;
  valor: number;
  distancia: string;
  status: "pendente" | "aceita" | "recusada" | "em_andamento" | "concluida" | "cancelada";
  dataCriacao: string;
  dataColeta?: string;
  dataEntrega?: string;
  cliente: string;
  tipoCarga: string;
}

export interface DocumentoPrestador {
  id: string;
  tipo: string;
  nome: string;
  status: "aprovado" | "pendente" | "rejeitado" | "expirado";
  dataEnvio: string;
  dataVencimento?: string;
  observacao?: string;
  url?: string;
}

export interface Treinamento {
  id: string;
  titulo: string;
  tipo: "video" | "prova" | "certificado";
  status: "completo" | "em_andamento" | "pendente";
  progresso: number;
  duracao: string;
  imagem: string;
  concluidoEm?: string;
}

export interface Transacao {
  id: string;
  tipo: "recebido" | "repassado" | "taxa" | "bonus";
  descricao: string;
  valor: number;
  data: string;
  operacaoId?: string;
  comprovanteUrl?: string;
}

export interface DadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  pix: string;
}

export interface PrestadorPerfil {
  nome: string;
  foto: string;
  email: string;
  telefone: string;
  cpf: string;
  dataCadastro: string;
  dadosBancarios: DadosBancarios;
  veiculos: { id: string; modelo: string; placa: string; tipo: string; ano: string }[];
  regioes: string[];
  horariosInicio: string;
  horariosFim: string;
  fazColeta: boolean;
  fazEntrega: boolean;
}

export interface DashboardData {
  score: ScoreResult;
  ganhosMes: number;
  ganhosSemana: number;
  ranking: number;
  totalPrestadores: number;
  operacoesPendentes: number;
  operacoesAtivas: number;
  disponivel: boolean;
  perfil: PrestadorPerfil;
  notificacoes: Notificacao[];
}

export interface PrestadorAuth {
  prestadorId: string;
  nomeCompleto: string;
}

export async function obterPrestadorPorAuth(): Promise<PrestadorAuth | null> {
  const { data, error } = await supabase.rpc("f_obter_prestador_por_auth");
  if (error || !data || data.length === 0) {
    console.warn("[PortalPrestador] Nenhum prestador vinculado ao auth:", error);
    return null;
  }
  return { prestadorId: data[0].prestador_id, nomeCompleto: data[0].nome_completo };
}

export async function buscarPerfilPrestador(prestadorId: string): Promise<PrestadorPerfil | null> {
  const { data, error } = await supabase
    .from("prestadores")
    .select("id, nome_completo, email, telefone, cpf_cnpj, foto, data_cadastro, banco, agencia, conta, chave_pix, regiao_principal, regioes_secundarias, horariosInicio:disponibilidade_padrao, faz_coleta:aceita_urbana, faz_entrega:aceita_viagem, veiculos, score_interno, status_operacional")
    .eq("id", prestadorId)
    .single();

  if (error || !data) return null;

  const veiculosArr = data.veiculos
    ? (Array.isArray(data.veiculos) ? data.veiculos : [{ id: "v1", modelo: String(data.veiculos?.modelo || "N/I"), placa: String(data.veiculos?.placa || ""), tipo: String(data.veiculos?.tipo || ""), ano: String(data.veiculos?.ano || "") }])
    : [];

  return {
    nome: data.nome_completo || "Prestador",
    foto: data.foto || "",
    email: data.email || "",
    telefone: data.telefone || "",
    cpf: data.cpf_cnpj || "",
    dataCadastro: data.data_cadastro || "",
    dadosBancarios: {
      banco: data.banco || "",
      agencia: data.agencia || "",
      conta: data.conta || "",
      pix: data.chave_pix || "",
    },
    veiculos: veiculosArr,
    regioes: [
      ...(data.regiao_principal ? [data.regiao_principal] : []),
      ...(data.regioes_secundarias || []),
    ],
    horariosInicio: "",
    horariosFim: "",
    fazColeta: !!data.faz_coleta,
    fazEntrega: !!data.faz_entrega,
  };
}

function extrairValorFixo(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string") return parseFloat(valor) || 0;
  if (valor && typeof valor === "object") {
    const v = (valor as Record<string, unknown>)?.valor;
    if (v !== undefined) return extrairValorFixo(v);
  }
  return 0;
}

function mapearAlocacaoParaOperacao(item: Record<string, unknown>): Operacao {
  const veiculo = typeof item.veiculo === "object" && item.veiculo ? (item.veiculo as Record<string, unknown>) : {};
  return {
    id: String(item.id || ""),
    origem: String(item.origem || item.endereco_origem || ""),
    destino: String(item.destino || item.endereco_destino || ""),
    carga: String(item.tipo_carga || item.carga || "Carga Geral"),
    peso: String(item.peso || ""),
    valor: extrairValorFixo(item.valor_repasse || item.valor_frete || item.valor_total || 0),
    distancia: String(item.km_previstos || item.distancia || ""),
    status: mapearStatusApp(String(item.status || "pendente")),
    dataCriacao: String(item.created_at || item.data_escala || ""),
    dataColeta: item.horario_inicio_real ? String(item.horario_inicio_real) : undefined,
    dataEntrega: item.horario_fim_real ? String(item.horario_fim_real) : undefined,
    cliente: String(item.cliente_nome || item.cliente || ""),
    tipoCarga: String(item.tipo_carga || "Carga Seca"),
  };
}

function mapearStatusApp(status: string): Operacao["status"] {
  const mapa: Record<string, Operacao["status"]> = {
    planejada: "pendente",
    aguardando_aceite: "pendente",
    aceita: "aceita",
    aceito: "aceita",
    recusada: "recusada",
    recusado: "recusada",
    em_rota: "em_andamento",
    em_andamento: "em_andamento",
    concluida: "concluida",
    concluido: "concluida",
    finalizada: "concluida",
    entregue: "concluida",
    cancelada: "cancelada",
    cancelado: "cancelada",
  };
  return mapa[status] || "pendente";
}

export async function buscarOperacoes(prestadorId: string): Promise<Operacao[]> {
  const { data, error } = await supabase
    .from("alocacoes_escala")
    .select("id, origem, destino, tipo_veiculo, placa, km_previstos, km_realizados, valor_repasse, valor_total, status, created_at, data_escala, horario_inicio_real, horario_fim_real, cliente_id, observacoes")
    .eq("prestador_id", prestadorId)
    .in("status", ["planejada", "aguardando_aceite", "aceita", "recusada", "em_rota", "concluida", "cancelada"])
    .order("data_escala", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data.map((item) => mapearAlocacaoParaOperacao(item as unknown as Record<string, unknown>));
}

export async function buscarDocumentos(prestadorId: string): Promise<DocumentoPrestador[]> {
  const { data, error } = await supabase
    .from("documentos_prestadores")
    .select("id, tipo, url, dados, validade, status, created_at")
    .eq("prestador_id", prestadorId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const docs = data.map((doc) => ({
    id: doc.id,
    tipo: doc.tipo,
    nome: doc.tipo,
    status: (doc.status as DocumentoPrestador["status"]) || "pendente",
    dataEnvio: doc.created_at?.split("T")[0] || "",
    dataVencimento: doc.validade || undefined,
    observacao: undefined,
    url: doc.url || undefined,
  }));

  return Promise.all(
    docs.map(async (doc) => ({
      ...doc,
      url: (await resolverUrlDocumento(doc.url, { prestadorId })) ?? undefined,
    }))
  );
}

export async function buscarTransacoes(prestadorId: string): Promise<Transacao[]> {
  const { data, error } = await supabase
    .from("pagamentos_prestadores")
    .select("id, valor_liquido, valor_servicos, status, created_at, os_numero, data_pagamento")
    .eq("prestador_id", prestadorId)
    .in("status_pagamento", ["pago", "aprovado", "pendente"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    tipo: (p.status === "pago" ? "recebido" : "recebido") as "recebido",
    descricao: p.os_numero ? `OS ${p.os_numero}` : "Pagamento de serviços",
    valor: extrairValorFixo(p.valor_liquido || p.valor_servicos || 0),
    data: p.data_pagamento || p.created_at,
    operacaoId: undefined,
  }));
}

export async function buscarNotificacoes(prestadorId: string): Promise<Notificacao[]> {
  const { data, error } = await supabase
    .from("eventos_oficiais")
    .select("id, event_type, entity_id, payload, created_at")
    .eq("entity_type", "prestador")
    .eq("entity_id", prestadorId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.map((ev) => {
    const tipoMap: Record<string, Notificacao["tipo"]> = {
      alocacao_aceita: "operacao",
      alocacao_recusada: "operacao",
      alocacao_disponivel: "operacao",
      documento_aprovado: "documento",
      documento_rejeitado: "documento",
      documento_expirado: "documento",
      pagamento_liberado: "financeiro",
      pagamento_confirmado: "financeiro",
      treinamento_atribuido: "treinamento",
      treinamento_concluido: "treinamento",
      sistema_alerta: "sistema",
    };
    const payload = ev.payload as Record<string, unknown> | undefined;
    return {
      id: ev.id,
      tipo: tipoMap[ev.event_type] || "sistema",
      titulo: String(payload?.titulo || ev.event_type),
      mensagem: String(payload?.mensagem || payload?.descricao || ""),
      lida: false,
      data: ev.created_at,
    };
  });
}

export async function buscarRanking(): Promise<{ ranking: number; total: number }> {
  const { data: prestadores, error } = await supabase
    .from("prestadores")
    .select("id, score_interno")
    .eq("status", "ativo");

  if (error || !prestadores) return { ranking: 1, total: 1 };

  const ranked = prestadores
    .filter((p) => p.score_interno != null)
    .sort((a, b) => (b.score_interno || 0) - (a.score_interno || 0));

  return { ranking: ranked.length, total: ranked.length };
}

export async function buscarGanhos(prestadorId: string): Promise<{ mes: number; semana: number }> {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const inicioSemana = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("pagamentos_prestadores")
    .select("valor_liquido, data_pagamento, created_at")
    .eq("prestador_id", prestadorId)
    .in("status_pagamento", ["pago", "aprovado"]);

  if (error || !data) return { mes: 0, semana: 0 };

  let mes = 0;
  let semana = 0;
  for (const p of data) {
    const ref = p.data_pagamento || p.created_at;
    const v = extrairValorFixo(p.valor_liquido);
    if (ref >= inicioMes) mes += v;
    if (ref >= inicioSemana) semana += v;
  }
  return { mes, semana };
}

export async function buscarDashboardCompleto(prestadorId: string): Promise<DashboardData | null> {
  const [perfil, operacoes, ganhos, ranking, notificacoes] = await Promise.all([
    buscarPerfilPrestador(prestadorId),
    buscarOperacoes(prestadorId),
    buscarGanhos(prestadorId),
    buscarRanking(),
    buscarNotificacoes(prestadorId),
  ]);

  if (!perfil) return null;

  const score = calculateScore({
    nome: perfil.nome,
    cpf: perfil.cpf,
    selfieUrl: perfil.foto || null,
    cnhUrl: null,
    tipoVeiculo: perfil.veiculos[0]?.tipo || "",
    modelo: perfil.veiculos[0]?.modelo || "",
    placa: perfil.veiculos[0]?.placa || "",
    ano: perfil.veiculos[0]?.ano || "",
    capacidade: "",
    fotosVeiculo: [],
    crlvUrl: null,
    comprovanteUrl: null,
    anttUrl: null,
    moppUrl: null,
    seguroUrl: null,
    chavePix: perfil.dadosBancarios.pix,
    banco: perfil.dadosBancarios.banco,
    regioes: perfil.regioes,
    horariosInicio: perfil.horariosInicio,
    horariosFim: perfil.horariosFim,
    tipoCarga: "Carga Seca",
    tipoViagem: perfil.regioes.length > 1 ? ["Estadual"] : ["Municipal"],
    fazColeta: perfil.fazColeta,
    fazEntrega: perfil.fazEntrega,
    distanciaMaxima: "500",
    documentValidations: {},
    stepsCompleted: [true, true, true, true, true],
    isComplete: true,
  });

  const pendentes = operacoes.filter((o) => o.status === "pendente").length;
  const ativas = operacoes.filter((o) => o.status === "aceita" || o.status === "em_andamento").length;

  return {
    score,
    ganhosMes: ganhos.mes,
    ganhosSemana: ganhos.semana,
    ranking: ranking.ranking,
    totalPrestadores: ranking.total,
    operacoesPendentes: pendentes,
    operacoesAtivas: ativas,
    disponivel: true,
    perfil,
    notificacoes,
  };
}

export async function aceitarOperacao(alocacaoId: string, prestadorId: string): Promise<boolean> {
  const { error } = await supabase
    .from("alocacoes_escala")
    .update({
      status: "aceita",
      aceite_prestador: true,
      data_aceite: new Date().toISOString(),
    })
    .eq("id", alocacaoId)
    .eq("prestador_id", prestadorId);

  if (error) {
    console.error("[PortalPrestador] Erro ao aceitar operação:", error);
    return false;
  }
  return true;
}

export async function recusarOperacao(alocacaoId: string, prestadorId: string, motivo?: string): Promise<boolean> {
  const { error } = await supabase
    .from("alocacoes_escala")
    .update({
      status: "recusada",
      aceite_prestador: false,
      motivo_recusa: motivo || "Recusado pelo prestador",
    })
    .eq("id", alocacaoId)
    .eq("prestador_id", prestadorId);

  if (error) {
    console.error("[PortalPrestador] Erro ao recusar operação:", error);
    return false;
  }
  return true;
}

export async function iniciarOperacao(alocacaoId: string, prestadorId: string, kmInicial?: number): Promise<boolean> {
  const updates: Record<string, unknown> = {
    status: "em_rota",
    horario_inicio_real: new Date().toISOString(),
  };
  if (kmInicial) updates.km_previstos = kmInicial;

  const { error } = await supabase
    .from("alocacoes_escala")
    .update(updates)
    .eq("id", alocacaoId)
    .eq("prestador_id", prestadorId);

  if (error) {
    console.error("[PortalPrestador] Erro ao iniciar operação:", error);
    return false;
  }
  return true;
}

export async function concluirOperacao(alocacaoId: string, prestadorId: string, kmFinal?: number): Promise<boolean> {
  const updates: Record<string, unknown> = {
    status: "concluida",
    finalizada: true,
    horario_fim_real: new Date().toISOString(),
  };
  if (kmFinal) updates.km_realizados = kmFinal;

  const { error } = await supabase
    .from("alocacoes_escala")
    .update(updates)
    .eq("id", alocacaoId)
    .eq("prestador_id", prestadorId);

  if (error) {
    console.error("[PortalPrestador] Erro ao concluir operação:", error);
    return false;
  }
  return true;
}
