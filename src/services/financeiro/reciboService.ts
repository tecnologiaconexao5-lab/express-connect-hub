// F0-K — Recibos: persistência real + numeração única + PDF oficial.
// Recibo é EVIDÊNCIA/documento — criar/cancelar NÃO altera DRE, Fluxo de Caixa
// ou qualquer valor financeiro (escrita somente em `recibos`).

import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import { carregarLogoBase64Utils } from "@/utils/pdfGenerator";
import { buscarDadosEmpresaParaFatura } from "@/services/financeiro/faturaService";

export interface ReciboInput {
  favorecido_tipo: string;
  favorecido_nome: string;
  favorecido_documento?: string | null;
  valor: number;
  referencia: string;
  forma_pagamento?: string | null;
  conta_financeira?: string | null;
  os_numero?: string | null;
  observacoes?: string | null;
  data_emissao?: string | null;
}

export interface Recibo {
  id: string;
  numero: string;
  data_emissao: string;
  favorecido_tipo: string;
  favorecido_nome: string;
  favorecido_documento: string | null;
  valor: number;
  valor_extenso: string | null;
  referencia: string;
  forma_pagamento: string | null;
  conta_financeira: string | null;
  os_numero: string | null;
  observacoes: string | null;
  status: string;
  motivo_cancelamento: string | null;
  data_cancelamento: string | null;
  usuario_criador: string | null;
  usuario_cancelou: string | null;
  created_at: string;
}

// ── Numeração (pura/testável): REC-AAAAMM-SSSSS ────────────────────────────────
export function montarNumeroRecibo(ano: number, mes: number, sequencia: number): string {
  return `REC-${ano}${String(mes).padStart(2, "0")}-${String(sequencia).padStart(5, "0")}`;
}

// ── Valor por extenso (reais brasileiros) ─────────────────────────────────────
const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZENA = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const ESPECIAIS = ["onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];

function centenaExtenso(n: number): string {
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c === 0) {
    if (resto === 0) return "";
    return resto < 10 ? UNIDADES[resto] : resto < 20 ? ESPECIAIS[resto - 11] : DEZENA[Math.floor(resto / 10)] + (resto % 10 ? ` e ${UNIDADES[resto % 10]}` : "");
  }
  const restoTexto = resto < 10 ? UNIDADES[resto] : resto < 20 ? ESPECIAIS[resto - 11] : DEZENA[Math.floor(resto / 10)] + (resto % 10 ? ` e ${UNIDADES[resto % 10]}` : "");
  if (resto === 0) return centenas[c];
  return `${centenas[c]} e ${restoTexto}`;
}

/** Converte valor em extenso (ex.: 1234,56 → "um mil duzentos e trinta e quatro reais e cinquenta e seis centavos"). */
export function valorPorExtenso(valor: number): string {
  const total = Math.round(Math.abs(Number(valor) || 0) * 100);
  const reais = Math.floor(total / 100);
  const centavos = total % 100;

  const milhares = Math.floor(reais / 1000);
  const restoReais = reais % 1000;

  const partes: string[] = [];
  if (milhares === 1) partes.push("um mil");
  else if (milhares > 1) partes.push(`${centenaExtenso(milhares)} mil`);
  if (restoReais > 0) partes.push(centenaExtenso(restoReais));

  const reaisTexto = partes.length ? partes.join(" e ") : "zero";

  const reaisPart = reais === 1 ? "real" : "reais";
  const centPart = centavos === 1 ? "centavo" : "centavos";

  if (reais > 0 && centavos > 0) return `${reaisTexto} ${reaisPart} e ${centenaExtenso(centavos)} ${centPart}`;
  if (reais > 0) return `${reaisTexto} ${reaisPart}`;
  if (centavos > 0) return `${centenaExtenso(centavos)} ${centPart}`;
  return "zero reais";
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
async function proximaSequenciaMes(dataEmissao: string): Promise<number> {
  const prefixo = `REC-${dataEmissao.substring(0, 7).replace("-", "")}-`;
  const { count, error } = await supabase
    .from("recibos")
    .select("id", { count: "exact", head: true })
    .like("numero", `${prefixo}%`);
  if (error) throw new Error(`Erro ao calcular numeração: ${error.message}`);
  return (count || 0) + 1;
}

export async function criarRecibo(input: ReciboInput, usuarioCriador?: string | null): Promise<Recibo> {
  const dataEmissao = input.data_emissao || new Date().toISOString().split("T")[0];
  const valor = Math.round((Number(input.valor) || 0) * 100) / 100;
  if (!input.favorecido_nome.trim()) throw new Error("Nome do favorecido é obrigatório");
  if (valor <= 0) throw new Error("Valor deve ser maior que zero");
  if (!input.referencia.trim()) throw new Error("Referência/descrição é obrigatória");

  // Numeração com retry (índice único uq_recibos_numero garante sem duplicidade)
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const sequencia = await proximaSequenciaMes(dataEmissao);
    const numero = montarNumeroRecibo(Number(dataEmissao.substring(0, 4)), Number(dataEmissao.substring(5, 7)), sequencia + tentativa);
    const payload = {
      numero,
      data_emissao: dataEmissao,
      favorecido_tipo: input.favorecido_tipo || "outro",
      favorecido_nome: input.favorecido_nome.trim(),
      favorecido_documento: input.favorecido_documento || null,
      valor,
      valor_extenso: valorPorExtenso(valor),
      referencia: input.referencia.trim(),
      forma_pagamento: input.forma_pagamento || null,
      conta_financeira: input.conta_financeira || null,
      os_numero: input.os_numero || null,
      observacoes: input.observacoes || null,
      status: "emitido",
      usuario_criador: usuarioCriador || null,
    };
    const { data, error } = await supabase.from("recibos").insert([payload]).select().single();
    if (error) {
      if (error.code === "23505" || String(error.message).toLowerCase().includes("unique")) continue;
      throw new Error(`Erro ao gerar recibo: ${error.message}`);
    }
    return data as Recibo;
  }
  throw new Error("Não foi possível gerar número único para o recibo");
}

export interface FiltrosRecibos {
  dataInicial?: string;
  dataFinal?: string;
  status?: string;
  busca?: string;
}

export async function listarRecibos(filtros: FiltrosRecibos = {}): Promise<Recibo[]> {
  let q = supabase.from("recibos").select("*").order("created_at", { ascending: false }).limit(300);
  if (filtros.dataInicial) q = q.gte("data_emissao", filtros.dataInicial);
  if (filtros.dataFinal) q = q.lte("data_emissao", filtros.dataFinal);
  if (filtros.status && filtros.status !== "todos") q = q.eq("status", filtros.status);
  if (filtros.busca) q = q.or(`favorecido_nome.ilike.%${filtros.busca}%,referencia.ilike.%${filtros.busca}%,numero.ilike.%${filtros.busca}%`);
  const { data, error } = await q;
  if (error) throw new Error(`Erro ao listar recibos: ${error.message}`);
  return (data || []) as Recibo[];
}

export async function obterRecibo(id: string): Promise<Recibo | null> {
  const { data, error } = await supabase.from("recibos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Erro ao buscar recibo: ${error.message}`);
  return data as Recibo | null;
}

/** Cancela preservando o registro (soft) — não deleta, não reverte financeiro. */
export async function cancelarRecibo(id: string, motivo: string, usuario?: string | null): Promise<Recibo> {
  if (!motivo.trim()) throw new Error("Informe o motivo do cancelamento");
  const { data, error } = await supabase
    .from("recibos")
    .update({
      status: "cancelado",
      motivo_cancelamento: motivo.trim(),
      data_cancelamento: new Date().toISOString(),
      usuario_cancelou: usuario || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Erro ao cancelar recibo: ${error.message}`);
  return data as Recibo;
}

// ── PDF ──────────────────────────────────────────────────────────────────────
export interface DadosPDFRecibo {
  logoUrl: string | null;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
}

export async function buscarDadosEmpresaParaRecibo(): Promise<DadosPDFRecibo> {
  try {
    const emp = await buscarDadosEmpresaParaFatura();
    const logoUrl = await carregarLogoBase64Utils();
    return {
      logoUrl,
      razaoSocial: emp.razaoSocial || emp.nomeFantasia,
      nomeFantasia: emp.nomeFantasia || emp.razaoSocial,
      cnpj: emp.cnpj,
      endereco: emp.endereco,
      cidade: emp.cidade,
      uf: emp.uf,
    };
  } catch {
    return { logoUrl: null, razaoSocial: "Conexão Express", nomeFantasia: "Conexão Express", cnpj: "", endereco: "", cidade: "", uf: "" };
  }
}

const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataBrasil = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

export async function gerarPDFRecibo(recibo: Recibo, empresa: DadosPDFRecibo, assinatura?: string): Promise<void> {
  const doc = montarPDFRecibo(recibo, empresa, assinatura);
  doc.save(`Recibo_${recibo.numero}.pdf`);
}

/** Abre o PDF do recibo em nova aba (pronto para imprimir). */
export async function abrirPDFRecibo(recibo: Recibo, empresa: DadosPDFRecibo, assinatura?: string): Promise<void> {
  const doc = montarPDFRecibo(recibo, empresa, assinatura);
  const url = doc.output("bloburl");
  window.open(url as unknown as string, "_blank");
}

/** Constrói o documento do recibo (mesmos dados persistidos). */
export function montarPDFRecibo(recibo: Recibo, empresa: DadosPDFRecibo, assinatura?: string): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  // Cabeçalho com logo
  if (empresa.logoUrl) {
    try { doc.addImage(empresa.logoUrl, "PNG", 14, 12, 40, 14); } catch { /* segue sem logo */ }
  }
  doc.setFontSize(20);
  doc.setTextColor(15, 26, 46);
  doc.text("RECIBO", w - 14, 22, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Nº ${recibo.numero}`, w - 14, 28, { align: "right" });

  // Dados da empresa
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(empresa.razaoSocial, 14, 34);
  if (empresa.cnpj) doc.text(`CNPJ: ${empresa.cnpj}`, 14, 39);
  if (empresa.endereco) doc.text(empresa.endereco, 14, 44);
  if (empresa.cidade) doc.text(`${empresa.cidade}${empresa.uf ? " - " + empresa.uf : ""}`, 14, 49);

  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.8);
  doc.line(14, 56, w - 14, 56);

  // Valor em destaque
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 62, w - 28, 22, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("VALOR", 18, 68);
  doc.setFontSize(16);
  doc.setTextColor(15, 26, 46);
  doc.text(fmtMoeda(recibo.valor), w - 18, 68, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(90);
  const extenso = `Valor por extenso: ${recibo.valor_extenso || ""}`;
  doc.splitTextToSize(extenso, w - 36).forEach((linha: string, i: number) => doc.text(linha, 18, 74 + i * 4));

  // Corpo
  let y = 96;
  doc.setFontSize(10);
  doc.setTextColor(60);
  const paragrafos = [
    `Recebemos de ${recibo.favorecido_nome}${recibo.favorecido_documento ? `, inscrito(a) no CPF/CNPJ ${recibo.favorecido_documento}` : ""}, a importância supra, referente a ${recibo.referencia}.`,
  ];
  if (recibo.forma_pagamento) paragrafos.push(`Forma de pagamento: ${recibo.forma_pagamento}.`);
  if (recibo.os_numero) paragrafos.push(`Referente à OS/Romaneio: ${recibo.os_numero}.`);
  if (recibo.conta_financeira) paragrafos.push(`Conta financeira: ${recibo.conta_financeira}.`);
  if (recibo.observacoes) paragrafos.push(`Observações: ${recibo.observacoes}.`);
  paragrafos.push(`Emissão: ${fmtDataBrasil(recibo.data_emissao)}.`);

  for (const p of paragrafos) {
    const linhas = doc.splitTextToSize(p, w - 32);
    doc.text(linhas, 16, y);
    y += linhas.length * 5 + 3;
  }

  // Assinatura
  doc.setDrawColor(90);
  doc.setLineWidth(0.3);
  doc.line(40, 250, 150, 250);
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(assinatura || empresa.nomeFantasia, 95, 256, { align: "center" });
  doc.text("Assinatura e carimbo", 95, 261, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Documento gerado em ${new Date().toLocaleString("pt-BR")} · Nº ${recibo.numero}`, 105, 287, { align: "center" });

  return doc;
}
