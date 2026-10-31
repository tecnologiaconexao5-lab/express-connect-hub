// ============================================================
// FASE 5 — BANCO DE TALENTOS INTEGRADO
// Junção oficial: prestadores + prestador_perfil_talento +
// prestador_disponibilidade (+ veículos, documentos e candidato).
// ============================================================
import { supabase } from "@/lib/supabase";
import {
  carregarPrestadoresBase,
  chaveVeiculoMatch,
  type PrestadorMatchInput,
} from "@/services/operacao/matchPrestadoresService";
import type {
  FiltrosAvancados,
  NivelScore,
  StatusDocumental,
  TalentoLogistico,
} from "@/stores/talentBankStore";

const normalizar = (valor?: string | null): string =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const clamp = (valor: number): number => Math.max(0, Math.min(100, Math.round(valor)));

const calcularNivel = (score: number): NivelScore => {
  if (score >= 86) return "diamante";
  if (score >= 66) return "ouro";
  if (score >= 41) return "prata";
  return "bronze";
};

const STATUS_DOC_OK = new Set(["aprovado", "valido", "ok", "concluido", "vigente", "ativo"]);

const DOCS_OBRIGATORIOS = ["cnh", "crlv", "comprovante de residencia", "foto"];

function docRegular(doc: { status?: string | null; data_vencimento?: string | null; validade?: string | null }): boolean {
  if (!STATUS_DOC_OK.has(normalizar(doc.status))) return false;
  const validade = String(doc.data_vencimento || doc.validade || "").trim();
  if (!validade) return true;
  const d = new Date(validade);
  return Number.isNaN(d.getTime()) ? true : d.getTime() >= Date.now();
}

function statusDocumentalDe(p: PrestadorMatchInput): StatusDocumental {
  const docs = p.documentos || [];
  if (docs.length === 0) return "pendente";
  const exigidos = DOCS_OBRIGATORIOS.map((chave) =>
    docs.find((d) => normalizar(d.tipo).includes(chave)),
  );
  if (exigidos.every((d) => d && docRegular(d))) return "completo";
  if (docs.some((d) => !docRegular(d))) return "expirado";
  return "parcial";
}

function anosDesde(data?: string | null): number {
  if (!data) return 0;
  const inicio = new Date(data);
  if (Number.isNaN(inicio.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 365)));
}

function scorePrestador(p: PrestadorMatchInput): number {
  const bruto = Number(p.scoreInterno || 0);
  if (bruto <= 0) return 50;
  return clamp(bruto <= 5 ? bruto * 20 : bruto);
}

function mapearTalento(
  p: PrestadorMatchInput,
  stageCandidato?: string | null,
): TalentoLogistico {
  const veiculos = p.veiculos || [];
  const principal =
    veiculos.find((v) => v.principal) ||
    [...veiculos].sort((a, b) => Number(b.capacidade_kg || 0) - Number(a.capacidade_kg || 0))[0];
  const capacidadeKg = Math.max(0, ...veiculos.map((v) => Number(v.capacidade_kg || 0)));
  const capacidadeM3 = Math.max(0, ...veiculos.map((v) => Number(v.capacidade_m3 || 0)));
  const score = scorePrestador(p);
  const statusDoc = statusDocumentalDe(p);
  const modalidades = (p.perfil?.modalidade_preferencial || []).map((m) => normalizar(m));
  const temperaturas = new Set<string>();
  for (const v of veiculos) {
    const tipo = normalizar(v.tipo_carga);
    if (tipo.includes("refriger")) temperaturas.add("refrigerado");
    else if (tipo.includes("congel")) temperaturas.add("congelado");
    else if (tipo.includes("misto")) temperaturas.add("misto");
    else temperaturas.add("seco");
  }
  if (p.aceitaRefrigerado) temperaturas.add("refrigerado");

  const janelas = (p.disponibilidade || [])
    .filter((j) => j.dia_semana !== null && j.dia_semana !== undefined)
    .map((j) => ({
      diaSemana: Number(j.dia_semana),
      horaInicio: String(j.hora_inicio || "").slice(0, 5),
      horaFim: String(j.hora_fim || "").slice(0, 5),
      disponivel: j.disponivel !== false,
    }));

  const primeiraJanela = janelas.find((j) => j.disponivel);
  const regiao = p.regiaoPrincipal || [p.cidade, p.uf].filter(Boolean).join(" - ");
  const perfis: string[] = [];
  if (capacidadeKg > 0 && capacidadeKg <= 1500) perfis.push("leve");
  if (capacidadeKg > 5000) perfis.push("pesado");
  if (p.cidade) perfis.push("urbano");
  if (modalidades.includes("rota_fixa")) perfis.push("rota_fixa");
  if (p.aceitaRefrigerado) perfis.push("refrigerado");

  const homologadoPorStage = [
    "aprovado",
    "em_homologacao",
    "homologado_disponivel",
    "homologado_indisponivel",
  ].includes(normalizar(stageCandidato));
  const homologado = homologadoPorStage || normalizar(p.status) === "aprovado";

  const tags: TalentoLogistico["tagsAutomaticas"] = [];
  if (score >= 80) tags.push("alta_prioridade");
  if (statusDoc !== "completo") tags.push("documentacao_pendente");
  if (temperaturas.has("refrigerado")) tags.push("refrigerado");
  if (janelas.some((j) => j.disponivel)) tags.push("urbano");

  return {
    id: p.id,
    nome: p.nome,
    foto:
      p.foto ||
      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p.nome)}&backgroundColor=f97316`,
    telefone: p.telefone || p.whatsapp || "",
    email: p.email || "",
    cpf: "",
    dataCadastro: p.dataCadastro || new Date().toISOString().slice(0, 10),
    score,
    nivel: calcularNivel(score),
    statusDocumental: statusDoc,
    disponivel: janelas.some((j) => j.disponivel) || normalizar(p.status) === "ativo",
    experienciaAnos: anosDesde(p.dataCadastro),
    perfisOperacionais: perfis as TalentoLogistico["perfisOperacionais"],
    tagsAutomaticas: tags,
    tagsPersonalizadas: [],
    cidade: p.cidade || "",
    bairro: p.bairro || "",
    regiao: p.regiaoPrincipal || "",
    estado: p.uf || "",
    veiculo: {
      tipo: principal?.tipo_veiculo || principal?.tipo || "",
      modelo: principal?.modelo || principal?.marca || "",
      placa: principal?.placa || "",
      ano: Number(principal?.ano || 0),
      capacidade: capacidadeKg > 0 ? `${capacidadeKg} kg` : "Não informada",
      carroceria: principal?.tipo_carga || "",
    },
    regioesAtuacao: [
      ...(p.regiaoPrincipal ? [p.regiaoPrincipal] : []),
      ...(p.regioesSecundarias || []),
    ].filter(Boolean),
    horarios: {
      inicio: primeiraJanela?.horaInicio || "",
      fim: primeiraJanela?.horaFim || "",
    },
    fazColeta: true,
    fazEntrega: true,
    distanciaMaxima: Number(p.perfil?.distancia_max_coleta_km || 0),
    cargaPreferida: temperaturas.has("refrigerado")
      ? ["Carga Refrigerada", "Carga Seca"]
      : ["Carga Seca"],
    totalViagens: Number(p.qtdOperacoes || 0),
    totalAceitas: Math.round(
      Number(p.qtdOperacoes || 0) * (Number(p.indiceAceite || 0) / 100),
    ),
    taxaAceite: clamp(Number(p.indiceAceite || 0)),
    receitaTotal: 0,
    receitaMediaMes: 0,
    diasSemOperar: 0,
    ultimaOperacao: null,
    documentos: (p.documentos || []).map((d) => ({
      tipo: String(d.tipo || "Documento"),
      status: docRegular(d) ? ("aprovado" as const) : ("pendente" as const),
      vencimento: String(d.data_vencimento || d.validade || ""),
    })),
    favorito: false,
    shortlistId: null,
    scoreCompatibilidade: score,
    statusPrestador: p.status || undefined,
    homologado,
    modalidades,
    restricoesOperacionais: p.perfil?.restricoes_operacionais || {},
    disponibilidadeJanelas: janelas,
    capacidadeKg,
    capacidadeM3,
    temperaturas: [...temperaturas],
  };
}

export async function buscarTalentosBanco(): Promise<TalentoLogistico[]> {
  const prestadores = await carregarPrestadoresBase(300);
  if (prestadores.length === 0) return [];

  const ids = prestadores.map((p) => p.id);
  const { data: candidatos } = await supabase
    .from("recrutamento_candidatos")
    .select("prestador_id, stage")
    .in("prestador_id", ids);
  const stagePorPrestador = new Map<string, string>();
  for (const c of (candidatos as Array<{ prestador_id?: string | null; stage?: string | null }>) || []) {
    if (c.prestador_id) stagePorPrestador.set(String(c.prestador_id), String(c.stage || ""));
  }

  return prestadores.map((p) => mapearTalento(p, stagePorPrestador.get(p.id)));
}

function combinaHorario(
  janelas: NonNullable<TalentoLogistico["disponibilidadeJanelas"]>,
  inicio: string,
  fim: string,
): boolean {
  if (!inicio || !fim) return true;
  return janelas.some(
    (j) =>
      j.disponivel &&
      j.horaInicio &&
      j.horaFim &&
      j.horaInicio < fim &&
      j.horaFim > inicio,
  );
}

/** Aplica todos os filtros combinados avançados da Fase 5. */
export function aplicarFiltrosTalentos(
  talentos: TalentoLogistico[],
  filtros: FiltrosAvancados,
): TalentoLogistico[] {
  const q = normalizar(filtros.busca);
  const temperaturas = filtros.temperaturas.map((t) => normalizar(t));
  const modalidades = filtros.modalidades.map((m) => normalizar(m));

  return talentos
    .filter((t) => {
      if (q) {
        const alvo = normalizar(
          `${t.nome} ${t.cpf} ${t.veiculo.placa} ${t.telefone} ${t.cidade} ${t.regiao}`,
        );
        if (!alvo.includes(q)) return false;
      }
      if (filtros.regioes.length && !filtros.regioes.some((r) => t.regioesAtuacao.includes(r))) {
        return false;
      }
      if (filtros.cidades.length && !filtros.cidades.includes(t.cidade)) return false;
      if (filtros.tiposVeiculo.length) {
        const alvo = chaveVeiculoMatch(t.veiculo.tipo);
        if (!filtros.tiposVeiculo.some((tipo) => chaveVeiculoMatch(tipo) === alvo)) return false;
      }
      if (
        filtros.perfisOperacionais.length &&
        !filtros.perfisOperacionais.some((p) => t.perfisOperacionais.includes(p))
      ) {
        return false;
      }
      if (
        filtros.cargasPreferidas.length &&
        !filtros.cargasPreferidas.some((c) => t.cargaPreferida.includes(c))
      ) {
        return false;
      }
      if (filtros.statusDocumental.length && !filtros.statusDocumental.includes(t.statusDocumental)) {
        return false;
      }
      if (t.score < filtros.scoreMin || t.score > filtros.scoreMax) return false;
      if (filtros.disponivel !== null && t.disponivel !== filtros.disponivel) return false;

      if (filtros.capacidadeMinKg > 0 && Number(t.capacidadeKg || 0) < filtros.capacidadeMinKg) {
        return false;
      }
      if (filtros.capacidadeMinM3 > 0 && Number(t.capacidadeM3 || 0) < filtros.capacidadeMinM3) {
        return false;
      }
      if (
        temperaturas.length &&
        !temperaturas.some((temp) => (t.temperaturas || []).some((v) => normalizar(v) === temp))
      ) {
        return false;
      }
      if (filtros.diasSemana.length) {
        const temDia = (t.disponibilidadeJanelas || []).some(
          (j) => j.disponivel && filtros.diasSemana.includes(j.diaSemana),
        );
        if (!temDia) return false;
      }
      if (
        !combinaHorario(
          t.disponibilidadeJanelas || [],
          filtros.janelaInicio,
          filtros.janelaFim,
        )
      ) {
        return false;
      }
      if (
        modalidades.length &&
        !modalidades.some((m) => (t.modalidades || []).some((v) => normalizar(v) === m))
      ) {
        return false;
      }
      if (filtros.statusTalento.length) {
        const atende = filtros.statusTalento.some((status) =>
          status === "homologado" ? t.homologado === true : normalizar(t.statusPrestador) === "ativo",
        );
        if (!atende) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dir = filtros.ordem === "desc" ? -1 : 1;
      if (filtros.ordenarPor === "score") return (a.score - b.score) * dir;
      if (filtros.ordenarPor === "experiencia") return (a.experienciaAnos - b.experienciaAnos) * dir;
      if (filtros.ordenarPor === "taxaAceite") return (a.taxaAceite - b.taxaAceite) * dir;
      if (filtros.ordenarPor === "receita") return (a.receitaMediaMes - b.receitaMediaMes) * dir;
      if (filtros.ordenarPor === "compatibilidade") {
        return (a.scoreCompatibilidade - b.scoreCompatibilidade) * dir;
      }
      return (new Date(a.dataCadastro).getTime() - new Date(b.dataCadastro).getTime()) * dir;
    });
}
