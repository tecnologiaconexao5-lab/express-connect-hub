// ============================================================
// LOTE 2 / REFINO — ALERTA GLOBAL DE NOVA OS
//
// `ordens_servico` NÃO está na publicação `supabase_realtime`, então o
// alerta usa POLLING CURTO (padrão 25s). A comparação é feita por ID
// (não por timestamp) para não perder OS criadas no mesmo segundo nem
// sofrer com created_at em fusos diferentes.
//
// Na inicialização, as OS já existentes são marcadas como vistas para
// não disparar toasts em loop; a partir daí, cada OS nova gera um toast
// global "Nova Ordem de Serviço" com ação para abrir a OS.
// ============================================================
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface OpcoesNovaOSAlerta {
  /** Desliga o polling (ex.: usuário sem sessão). */
  habilitado?: boolean;
  /** Intervalo de verificação em ms (padrão 25000). */
  intervaloMs?: number;
  /** Abre a OS (deep-link /operacao?tab=os&os=<id>). */
  onAbrirOS?: (osId: string) => void;
}

interface LinhaOS {
  id?: string;
  numero?: string | null;
  cliente?: string | null;
  created_at?: string | null;
  clientes?: { nome_fantasia?: string | null; razao_social?: string | null } | null;
}

const INTERVALO_PADRAO_MS = 25000;
/** Quantidade de OS conhecidas no boot (sem toast). */
const MAX_CONHECIDAS = 40;
/** Quantidade consultada por ciclo. */
const MAX_POR_CICLO = 20;

export function useNovaOSAlerta({
  habilitado = true,
  intervaloMs = INTERVALO_PADRAO_MS,
  onAbrirOS,
}: OpcoesNovaOSAlerta) {
  const avisadosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!habilitado) return;
    let ativo = true;
    let pronto = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const iniciarConhecidas = async () => {
      try {
        const { data } = await supabase
          .from("ordens_servico")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(MAX_CONHECIDAS);
        for (const linha of (data || []) as LinhaOS[]) {
          if (linha.id) avisadosRef.current.add(String(linha.id));
        }
      } catch {
        // silencioso — o polling continua
      } finally {
        pronto = true;
      }
    };

    const verificar = async () => {
      if (!ativo || !pronto) return;
      try {
        const { data, error } = await supabase
          .from("ordens_servico")
          .select("id, numero, cliente, created_at, clientes(nome_fantasia, razao_social)")
          .order("created_at", { ascending: false })
          .limit(MAX_POR_CICLO);
        if (error || !ativo || !Array.isArray(data)) return;

        for (const linha of data as LinhaOS[]) {
          const id = linha.id ? String(linha.id) : "";
          if (!id || avisadosRef.current.has(id)) continue;
          avisadosRef.current.add(id);

          const cliente =
            linha.clientes?.nome_fantasia ||
            linha.clientes?.razao_social ||
            linha.cliente ||
            "Cliente";
          const numero = linha.numero ? String(linha.numero) : id.slice(0, 8);

          toast.success("🆕 Nova Ordem de Serviço", {
            id: `nova-os:${id}`,
            description: `${numero} · ${cliente}`,
            duration: 60000,
            action: onAbrirOS
              ? { label: "Abrir OS", onClick: () => onAbrirOS(id) }
              : undefined,
            onClick: onAbrirOS ? () => onAbrirOS(id) : undefined,
          });
        }
      } catch {
        // Silencioso: o polling tenta novamente no próximo ciclo.
      }
    };

    void iniciarConhecidas();
    timer = setInterval(() => void verificar(), intervaloMs);

    return () => {
      ativo = false;
      if (timer) clearInterval(timer);
    };
  }, [habilitado, intervaloMs, onAbrirOS]);
}
