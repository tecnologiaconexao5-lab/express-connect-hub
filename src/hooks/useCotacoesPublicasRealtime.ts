// ============================================================
// MISSÃO COTACAO-EXPRESS — alertas em tempo real na Torre de Controle
//
// Assina a tabela `cotacoes_publicas` (Realtime habilitado na
// migration 20261024000000_cotacoes_publicas.sql) e exibe avisos
// fixos no layout interno (AppLayout):
//
//   INSERT                            → "🚨 Nova Cotação Web (Pré-cadastro)!"
//   UPDATE status 'Aguardando Detalhes' com valor_aprovado
//                                     → "💰 Cotação aprovada pelo cliente!"
//   UPDATE status 'Pronto p/ OS'      → "✅ Detalhes preenchidos pelo cliente!"
//
// Cada toast traz um botão de ação que já leva o comercial ao lugar
// certo (/comercial?tab=orcamentos...). Dedup por evento para o
// refetch/reatribuição de canal não duplicar avisos.
// ============================================================
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type PayloadCotacao = Record<string, unknown>;

export interface OpcoesAlertasCotacao {
  /**
   * Abre a cotação no comercial.
   * `orcamentoId` vem preenchido quando já existe orçamento vinculado.
   */
  onAbrirCotacao: (cotacaoId: string, orcamentoId: string | null) => void;
  /** Assinatura desligada (ex.: usuário sem sessão). */
  habilitado?: boolean;
}

const contarParadas = (valor: unknown): number =>
  Array.isArray(valor) ? valor.length : 0;

/** Extrai o valor calculado (Fase 1 V2) do metadata da linha. */
const precoDaLinha = (linha: PayloadCotacao): number | null => {
  const metadata = linha.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const precificacao = (metadata as Record<string, unknown>).precificacao;
  if (!precificacao || typeof precificacao !== "object") return null;
  const valor = (precificacao as Record<string, unknown>).valor;
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
};

const formatarBrl = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export function useCotacoesPublicasRealtime({
  onAbrirCotacao,
  habilitado = true,
}: OpcoesAlertasCotacao) {
  const avisados = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!habilitado) return;

    const canal = supabase
      .channel("cotacoes-publicas-alertas")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cotacoes_publicas" },
        (payload) => {
          const nova = (payload.new || {}) as PayloadCotacao;
          const id = nova.id ? String(nova.id) : "";
          if (!id) return;
          const chave = `nova:${id}`;
          if (avisados.current.has(chave)) return;
          avisados.current.add(chave);

          const nome = nova.nome_cliente ? String(nova.nome_cliente) : "Cliente";
          const paradas = contarParadas(nova.paradas);
          const data = nova.data_desejada ? String(nova.data_desejada) : "";
          const preco = precoDaLinha(nova);
          const statusNovo = String(nova.status || "");
          const valorTxt = preco !== null ? ` · ${formatarBrl(preco)}` : "";
          const rotuloStatus =
            statusNovo === "Pendente de Aprovação pelo Cliente"
              ? `· proposta de ${formatarBrl(preco ?? 0)} enviada ao cliente`
              : `· ${paradas} endereço(s)${data ? ` · coleta em ${data}` : ""}${valorTxt}`;

          toast.warning("🚨 Nova Cotação Web (Pré-cadastro)!", {
            id: chave,
            description: `${nome} ${rotuloStatus}`,
            duration: 60000,
            action: {
              label: "Abrir",
              onClick: () => onAbrirCotacao(id, nova.orcamento_id ? String(nova.orcamento_id) : null),
            },
            onClick: () => onAbrirCotacao(id, nova.orcamento_id ? String(nova.orcamento_id) : null),
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cotacoes_publicas" },
        (payload) => {
          const atualizado = (payload.new || {}) as PayloadCotacao;
          const id = atualizado.id ? String(atualizado.id) : "";
          if (!id) return;
          const statusAtual = String(atualizado.status || "");
          const orcamentoId = atualizado.orcamento_id ? String(atualizado.orcamento_id) : null;

          // Cliente aprovou o valor na tela da Fase 1
          if (
            statusAtual === "Aguardando Detalhes" &&
            atualizado.valor_aprovado !== null &&
            atualizado.valor_aprovado !== undefined
          ) {
            const chaveAprovada = `aprovada:${id}`;
            if (avisados.current.has(chaveAprovada)) return;
            avisados.current.add(chaveAprovada);

            const nome = atualizado.nome_cliente ? String(atualizado.nome_cliente) : "Cliente";
            toast.success("💰 Cotação aprovada pelo cliente!", {
              id: chaveAprovada,
              description: `${nome} · ${formatarBrl(Number(atualizado.valor_aprovado))} · liberada para a Fase 2`,
              duration: 60000,
              action: {
                label: orcamentoId ? "Ver Orçamento" : "Abrir",
                onClick: () => onAbrirCotacao(id, orcamentoId),
              },
              onClick: () => onAbrirCotacao(id, orcamentoId),
            });
            return;
          }

          if (statusAtual !== "Pronto para OS") return;

          const chave = `pronto:${id}`;
          if (avisados.current.has(chave)) return;
          avisados.current.add(chave);

          const nome = atualizado.nome_cliente ? String(atualizado.nome_cliente) : "Cliente";

          toast.success("✅ Detalhes preenchidos pelo cliente!", {
            id: chave,
            description: `${nome} · endereços completos, prontos para gerar a OS`,
            duration: 60000,
            action: {
              label: orcamentoId ? "Ver Orçamento" : "Abrir",
              onClick: () => onAbrirCotacao(id, orcamentoId),
            },
            onClick: () => onAbrirCotacao(id, orcamentoId),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [habilitado, onAbrirCotacao]);
}
