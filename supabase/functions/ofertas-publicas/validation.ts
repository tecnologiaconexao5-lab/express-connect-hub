// Validação pura do payload público de ofertas.
// Este módulo é compartilhado pela Edge Function e pelos testes locais (Vitest).
// Não importa runtime de Edge, Supabase ou qualquer dependência externa.

export const TIPOS_OFERTA = [
  "motoboy",
  "motorista_veiculo_proprio",
  "disponibilidade_veiculo",
] as const;

export const MODALIDADES = ["esporadica", "urgente", "fixa", "recorrente"] as const;

export const CATEGORIAS_VEICULO = ["proprio", "agregado", "terceiro"] as const;

export const TIPOS_VEICULO = [
  "Moto",
  "Veículo de Passeio",
  "Fiorino",
  "Kangoo",
  "Kombi",
  "Van",
  "HR",
  "VUC",
  "3/4",
  "Toco",
  "Truck",
  "Bitruck",
  "Carreta",
  "Bitrem",
  "Outro",
] as const;

export const TIPOS_MOTO = ["Street", "Trail", "Custom", "Scooter", "Outra"] as const;

export const CARROCERIAS = [
  "Baú fechado",
  "Sider",
  "Graneleiro",
  "Grade baixa",
  "Prancha",
  "Tanque",
  "Refrigerado",
  "Porta-container",
  "Outra",
] as const;

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

export const LGPD_TERMO_VERSAO = "2026-11-v1";

const CAMPOS_PUBLICOS = new Set([
  "tipo_oferta",
  "nome",
  "telefone",
  "email",
  "cidade",
  "uf",
  "regioes",
  "dias_disponiveis",
  "horario_inicio",
  "horario_fim",
  "modalidades",
  "tipo_moto",
  "possui_bau",
  "capacidade_bau_litros",
  "veiculo_categoria",
  "veiculo_tipo",
  "carroceria",
  "veiculo_modelo",
  "veiculo_placa",
  "veiculo_ano",
  "caracteristicas",
  "capacidade_kg",
  "capacidade_m3",
  "dimensoes",
  "valor_diaria",
  "valor_km",
  "valor_saida",
  "valor_mensal",
  "valor_negociavel",
  "condicoes_comerciais",
  "restricoes",
  "observacoes",
  "lgpd_consent",
  "lgpd_termo_versao",
]);

export interface OfertaPublicaNormalizada {
  tipo_oferta: (typeof TIPOS_OFERTA)[number];
  nome: string;
  telefone: string;
  email: string | null;
  cidade: string;
  uf: string;
  regioes: string[];
  dias_disponiveis: number[];
  horario_inicio: string;
  horario_fim: string;
  modalidades: (typeof MODALIDADES)[number][];
  tipo_moto: string | null;
  possui_bau: boolean | null;
  capacidade_bau_litros: number | null;
  veiculo_categoria: string;
  veiculo_tipo: string;
  carroceria: string | null;
  veiculo_modelo: string | null;
  veiculo_placa: string | null;
  veiculo_ano: number | null;
  caracteristicas: string[];
  capacidade_kg: number | null;
  capacidade_m3: number | null;
  dimensoes: Record<string, number | null>;
  valor_diaria: number | null;
  valor_km: number | null;
  valor_saida: number | null;
  valor_mensal: number | null;
  valor_negociavel: boolean;
  condicoes_comerciais: string | null;
  restricoes: string | null;
  observacoes: string | null;
  lgpd_consent: true;
  lgpd_termo_versao: string;
}

export type ResultadoValidacao =
  | { ok: true; payload: OfertaPublicaNormalizada }
  | { ok: false; error: string };

export function normalizarTelefone(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "");
}

export function normalizarEmail(valor: unknown): string {
  return String(valor ?? "").trim().toLowerCase();
}

export function limparTexto(valor: unknown): string {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function erro(error: string): ResultadoValidacao {
  return { ok: false, error };
}

function objectValue(valor: unknown): Record<string, unknown> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  return valor as Record<string, unknown>;
}

function arrayTexto(valor: unknown, min: number, max: number): string[] | null {
  if (!Array.isArray(valor) || valor.length < min || valor.length > max) return null;
  const itens = valor
    .map((item) => limparTexto(item))
    .filter(Boolean);
  if (itens.length !== valor.length) return null;
  const unicos = Array.from(new Set(itens));
  return unicos.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function arrayDias(valor: unknown): number[] | null {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > 7) return null;
  const dias: number[] = [];
  for (const item of valor) {
    const numero = typeof item === "number" ? item : Number(item);
    if (!Number.isInteger(numero) || numero < 0 || numero > 6) return null;
    dias.push(numero);
  }
  return Array.from(new Set(dias)).sort((a, b) => a - b);
}

function numero(
  valor: unknown,
  min: number,
  max: number,
): { ok: true; value: number | null } | { ok: false } {
  if (valor === null || valor === undefined || valor === "") return { ok: true, value: null };
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n) || n < min || n > max) return { ok: false };
  return { ok: true, value: n };
}

function booleano(valor: unknown): boolean | null {
  if (typeof valor === "boolean") return valor;
  return null;
}

function horarioValido(valor: unknown): string | null {
  const texto = String(valor ?? "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(texto)) return null;
  return texto;
}

function placaValida(valor: unknown): string | null {
  const texto = String(valor ?? "").trim().toUpperCase();
  if (!texto) return null;
  if (!/^[A-Z0-9]{7}$/.test(texto)) return null;
  return texto;
}

export function validarPayloadOferta(input: unknown): ResultadoValidacao {
  const body = objectValue(input);
  if (!body) return erro("payload_invalido");

  const camposInesperados = Object.keys(body).filter((key) => !CAMPOS_PUBLICOS.has(key));
  if (camposInesperados.length > 0) return erro("campos_inesperados");

  const tipo = String(body.tipo_oferta ?? "").trim();
  if (!(TIPOS_OFERTA as readonly string[]).includes(tipo)) return erro("tipo_oferta_invalido");

  const nome = limparTexto(body.nome);
  if (nome.length < 3 || nome.length > 160) return erro("nome_invalido");

  const telefone = normalizarTelefone(body.telefone);
  if (telefone.length !== 10 && telefone.length !== 11) return erro("telefone_invalido");
  const ddd = Number(telefone.slice(0, 2));
  if (ddd < 11 || ddd > 99) return erro("telefone_invalido");

  const email = normalizarEmail(body.email);
  if (email.length > 254) return erro("email_invalido");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro("email_invalido");

  const cidade = limparTexto(body.cidade);
  if (cidade.length < 2 || cidade.length > 120) return erro("cidade_invalida");

  const uf = String(body.uf ?? "").trim().toUpperCase();
  if (!(UFS as readonly string[]).includes(uf)) return erro("uf_invalida");

  const regioes = arrayTexto(body.regioes, 1, 20);
  if (!regioes || regioes.some((r) => r.length > 80)) return erro("regioes_invalidas");

  const dias = arrayDias(body.dias_disponiveis);
  if (!dias) return erro("dias_invalidos");

  const horarioInicio = horarioValido(body.horario_inicio);
  const horarioFim = horarioValido(body.horario_fim);
  if (!horarioInicio || !horarioFim || horarioFim <= horarioInicio) {
    return erro("horario_invalido");
  }

  const modalidadesRaw = arrayTexto(body.modalidades, 1, 4);
  if (
    !modalidadesRaw ||
    !modalidadesRaw.every((m) => (MODALIDADES as readonly string[]).includes(m))
  ) {
    return erro("modalidades_invalidas");
  }
  const modalidades = modalidadesRaw as OfertaPublicaNormalizada["modalidades"];

  const veiculoCategoria = String(body.veiculo_categoria ?? "").trim().toLowerCase();
  if (!(CATEGORIAS_VEICULO as readonly string[]).includes(veiculoCategoria)) {
    return erro("veiculo_categoria_invalida");
  }

  const ehMotoboy = tipo === "motoboy";
  let tipoMoto: string | null = null;
  let veiculoTipo: string;
  let carroceria: string | null = null;
  let possuiBau: boolean | null = null;

  if (ehMotoboy) {
    tipoMoto = String(body.tipo_moto ?? "").trim();
    if (!(TIPOS_MOTO as readonly string[]).includes(tipoMoto)) return erro("tipo_moto_invalido");
    veiculoTipo = "moto";
    possuiBau = booleano(body.possui_bau) ?? false;
  } else {
    const tipoInformado = String(body.veiculo_tipo ?? "").trim();
    if (!(TIPOS_VEICULO as readonly string[]).includes(tipoInformado)) {
      return erro("veiculo_tipo_invalido");
    }
    const carroceriaInformada = String(body.carroceria ?? "").trim();
    if (!(CARROCERIAS as readonly string[]).includes(carroceriaInformada)) {
      return erro("carroceria_invalida");
    }
    veiculoTipo = tipoInformado;
    carroceria = carroceriaInformada;
  }

  const veiculoModelo = limparTexto(body.veiculo_modelo) || null;
  if (veiculoModelo && veiculoModelo.length > 80) return erro("veiculo_modelo_invalido");

  const placaBruta = String(body.veiculo_placa ?? "").trim();
  const veiculoPlaca = placaBruta ? placaValida(placaBruta) : null;
  if (placaBruta && !veiculoPlaca) return erro("veiculo_placa_invalida");

  const ano = numero(body.veiculo_ano, 1980, 2100);
  if (!ano.ok) return erro("veiculo_ano_invalido");

  const caracteristicas = arrayTexto(body.caracteristicas ?? [], 0, 20);
  if (!caracteristicas || caracteristicas.some((c) => c.length > 80)) {
    return erro("caracteristicas_invalidas");
  }

  const capacidadeKg = numero(body.capacidade_kg, 0, 1000000);
  const capacidadeM3 = numero(body.capacidade_m3, 0, 1000000);
  const capacidadeBau = numero(body.capacidade_bau_litros, 0, 100000);
  if (!capacidadeKg.ok || !capacidadeM3.ok || !capacidadeBau.ok) {
    return erro("capacidade_invalida");
  }

  const dimensoesRaw = objectValue(body.dimensoes ?? {}) ?? {};
  const chavesDimensoes = new Set(["comprimento_m", "largura_m", "altura_m"]);
  if (Object.keys(dimensoesRaw).some((k) => !chavesDimensoes.has(k))) {
    return erro("dimensoes_invalidas");
  }
  const dimensoes: Record<string, number | null> = {};
  for (const chave of chavesDimensoes) {
    const valor = numero(dimensoesRaw[chave], 0, 1000);
    if (!valor.ok) return erro("dimensoes_invalidas");
    dimensoes[chave] = valor.value;
  }

  const valorDiaria = numero(body.valor_diaria, 0, 1_000_000_000);
  const valorKm = numero(body.valor_km, 0, 1_000_000_000);
  const valorSaida = numero(body.valor_saida, 0, 1_000_000_000);
  const valorMensal = numero(body.valor_mensal, 0, 1_000_000_000);
  if (!valorDiaria.ok || !valorKm.ok || !valorSaida.ok || !valorMensal.ok) {
    return erro("valores_invalidos");
  }

  const valorNegociavel = booleano(body.valor_negociavel) ?? false;
  const condicoes = limparTexto(body.condicoes_comerciais) || null;
  const restricoes = limparTexto(body.restricoes) || null;
  const observacoes = limparTexto(body.observacoes) || null;
  if ([condicoes, restricoes, observacoes].some((t) => t && t.length > 2000)) {
    return erro("texto_invalido");
  }

  if (!valorNegociavel) {
    const temValor =
      valorDiaria.value !== null ||
      valorKm.value !== null ||
      valorSaida.value !== null ||
      valorMensal.value !== null;
    if (!temValor && !condicoes) return erro("valor_ou_condicao_obrigatorio");
  }

  const lgpdConsent = booleano(body.lgpd_consent);
  if (lgpdConsent !== true) return erro("lgpd_obrigatorio");

  const lgpdTermo = limparTexto(body.lgpd_termo_versao);
  if (!lgpdTermo || lgpdTermo.length > 50) return erro("lgpd_termo_invalido");

  return {
    ok: true,
    payload: {
      tipo_oferta: tipo as OfertaPublicaNormalizada["tipo_oferta"],
      nome,
      telefone,
      email: email || null,
      cidade,
      uf,
      regioes,
      dias_disponiveis: dias,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      modalidades,
      tipo_moto: tipoMoto,
      possui_bau: ehMotoboy ? possuiBau : null,
      capacidade_bau_litros: ehMotoboy ? capacidadeBau.value : null,
      veiculo_categoria: veiculoCategoria,
      veiculo_tipo: veiculoTipo,
      carroceria,
      veiculo_modelo: veiculoModelo,
      veiculo_placa: veiculoPlaca,
      veiculo_ano: ano.value,
      caracteristicas,
      capacidade_kg: capacidadeKg.value,
      capacidade_m3: capacidadeM3.value,
      dimensoes,
      valor_diaria: valorDiaria.value,
      valor_km: valorKm.value,
      valor_saida: valorSaida.value,
      valor_mensal: valorMensal.value,
      valor_negociavel: valorNegociavel,
      condicoes_comerciais: condicoes,
      restricoes,
      observacoes,
      lgpd_consent: true,
      lgpd_termo_versao: lgpdTermo,
    },
  };
}
