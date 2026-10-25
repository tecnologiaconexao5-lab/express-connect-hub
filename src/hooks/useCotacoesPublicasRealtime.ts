// ============================================================
// MISSÃO COTACAO-EXPRESS — alertas em tempo real na Torre de Controle
//
// Assina a tabela `cotacoes_publicas` (Realtime habilitado na
// migration 20261024000000_cotacoes_publicas.sql) e exibe 2 avisos
// fixos no layout interno (AppLayout):
//
//   INSERT                       → "🚨 Nova Cotação Web (Pré-cadastro)!"
//   UPDATE status 'Pronto p/ OS' → "✅ Detalhes preenchidos pelo cliente!"
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

          toast.warning("🚨 Nova Cotação Web (Pré-cadastro)!", {
            id: chave,
            description: `${nome} · ${paradas} endereço(s)${data ? ` · coleta em ${data}` : ""}`,
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
          if (String(atualizado.status) !== "Pronto para OS") return;

          const id = atualizado.id ? String(atualizado.id) : "";
          if (!id) return;
          const chave = `pronto:${id}`;
          if (avisados.current.has(chave)) return;
          avisados.current.add(chave);

          const nome = atualizado.nome_cliente ? String(atualizado.nome_cliente) : "Cliente";
          const orcamentoId = atualizado.orcamento_id ? String(atualizado.orcamento_id) : null;

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
