// ============================================================
// COTAÇÃO EXPRESS — Mensagem de formalização do pedido
// ============================================================
import type { CotacaoPublica } from "@/services/cotacoes/cotacaoPublicaService";

const formatarMoeda = (valor: number | null | undefined): string => {
  const numero = Number(valor || 0);
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatarData = (valor?: string | null): string => {
  const texto = String(valor || "").trim();
  if (!texto) return "A confirmar";
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return texto;
};

const formatarHorario = (valor?: string | null): string => {
  const texto = String(valor || "").trim();
  if (!texto) return "A confirmar";
  return /^das\s/i.test(texto) ? texto : `Das ${texto}`;
};

export function montarMensagemConfirmacaoCotacao(cotacao: CotacaoPublica): string {
  const paradas = (cotacao.paradas || []).filter((p) => p.endereco?.trim());
  const coleta = paradas[0]?.endereco?.trim() || "A confirmar";
  const entregas = paradas.slice(1).map((p) => p.endereco.trim()).filter(Boolean);
  const entrega = entregas.length > 0 ? entregas.join(" | ") : "A confirmar";

  const preco = cotacao.metadata?.precificacao;
  const valor = cotacao.valor_aprovado ?? preco?.valor ?? 0;
  const veiculo = preco?.rotulo_veiculo || preco?.tipo_veiculo || "A confirmar";

  return [
    "Olá, fiz uma cotação no sistema e quero formalizar o meu pedido:",
    `*Nome:* ${cotacao.nome_cliente || "A confirmar"}`,
    `*Telefone:* ${cotacao.telefone || "A confirmar"}`,
    `*Veículo:* ${veiculo}`,
    `*Valor:* R$ ${formatarMoeda(valor)}`,
    `*Data:* ${formatarData(cotacao.data_desejada)}`,
    `*Horário:* ${formatarHorario(cotacao.hora_desejada)}`,
    `*Coleta:* ${coleta}`,
    `*Entrega:* ${entrega}`,
  ].join("\n");
}

export function linkConfirmacaoWhatsApp(cotacao: CotacaoPublica, telefoneCentral: string): string {
  const numero = String(telefoneCentral || "").replace(/\D/g, "") || "5511999999999";
  return `https://wa.me/${numero}?text=${encodeURIComponent(montarMensagemConfirmacaoCotacao(cotacao))}`;
}
