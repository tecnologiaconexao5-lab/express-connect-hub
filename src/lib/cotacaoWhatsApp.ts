// ============================================================
// COTAÇÃO EXPRESS — Mensagem de formalização do pedido
// ============================================================
import type { CotacaoPublica } from "@/services/cotacoes/cotacaoPublicaService";

/**
 * Ícones em escapes Unicode explícitos: o arquivo permanece ASCII-safe e o
 * emoji literal nunca é corrompido por encoding/build (evita o "tofu" no
 * WhatsApp).
 */
const ICONE = {
  nome: "\u{1F464}", // 👤
  telefone: "\u{1F4DE}", // 📞
  veiculo: "\u{1F69A}", // 🚚
  valor: "\u{1F4B0}", // 💰
  data: "\u{1F4C5}", // 📅
  horario: "\u{23F0}", // ⏰
  coleta: "\u{1F4CD}", // 📍
  entrega: "\u{1F3C1}", // 🏁
} as const;

/** Remove caracteres de substituição/corrompidos e normaliza espaços. */
const limparTexto = (valor?: string | null): string =>
  String(valor || "")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();

const formatarMoeda = (valor: number | null | undefined): string => {
  const numero = Number(valor || 0);
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatarData = (valor?: string | null): string => {
  const texto = limparTexto(valor);
  if (!texto) return "A confirmar";
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return texto;
};

const formatarHorario = (valor?: string | null): string => {
  const texto = limparTexto(valor);
  if (!texto) return "A confirmar";
  return /^das\s/i.test(texto) ? texto : `Das ${texto}`;
};

export function montarMensagemConfirmacaoCotacao(cotacao: CotacaoPublica): string {
  const paradas = (cotacao.paradas || []).filter((p) => limparTexto(p.endereco));
  const coleta = limparTexto(paradas[0]?.endereco) || "A confirmar";
  const entregas = paradas.slice(1).map((p) => limparTexto(p.endereco)).filter(Boolean);
  const entrega = entregas.length > 0 ? entregas.join(" | ") : "A confirmar";

  const preco = cotacao.metadata?.precificacao;
  const valor = cotacao.valor_aprovado ?? preco?.valor ?? 0;
  const veiculo = limparTexto(preco?.rotulo_veiculo || preco?.tipo_veiculo) || "A confirmar";

  return [
    "Olá, fiz uma cotação no sistema e quero formalizar o meu pedido:",
    "",
    `${ICONE.nome} *Nome:* ${limparTexto(cotacao.nome_cliente) || "A confirmar"}`,
    `${ICONE.telefone} *Telefone:* ${limparTexto(cotacao.telefone) || "A confirmar"}`,
    `${ICONE.veiculo} *Veículo:* ${veiculo}`,
    `${ICONE.valor} *Valor:* R$ ${formatarMoeda(valor)}`,
    `${ICONE.data} *Data:* ${formatarData(cotacao.data_desejada)}`,
    `${ICONE.horario} *Horário:* ${formatarHorario(cotacao.hora_desejada)}`,
    `${ICONE.coleta} *Coleta:* ${coleta}`,
    `${ICONE.entrega} *Entrega:* ${entrega}`,
  ].join("\n");
}

export function linkConfirmacaoWhatsApp(cotacao: CotacaoPublica, telefoneCentral: string): string {
  const numero = String(telefoneCentral || "").replace(/\D/g, "") || "5511913254847";
  return `https://wa.me/${numero}?text=${encodeURIComponent(montarMensagemConfirmacaoCotacao(cotacao))}`;
}
