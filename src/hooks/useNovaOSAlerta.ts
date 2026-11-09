// ============================================================
// LOTE 2 — ALERTA DE NOVA OS (Dashboard / Operação / CCO)
//
// `ordens_servico` NÃO está na publicação `supabase_realtime`, então o
// alerta usa POLLING CURTO (padrão 25s) — sem exigir migration. Na
// inicialização, as OS já existentes são marcadas como vistas para não
// disparar toast em loop; a partir daí, cada INSERT novo gera um toast.
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

export function useNovaOSAlerta({
  habilitado = true,
  intervaloMs = INTERVALO_PADRAO_MS,
  onAbrirOS,
}: OpcoesNovaOSAlerta) {
  const cursorRef = useRef<string | null>(null);
  const avisadosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!habilitado) return;
    let ativo = true;
    let pronto = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const iniciarCursor = async () => {
      try {
        const { data } = await supabase
          .from("ordens_servico")
          .select("id, created_at")
          .order("created_at", { ascending: false })
          .limit(20);
        const linhas = Array.isArray(data) ? (data as LinhaOS[]) : [];
        for (const linha of linhas) {
          if (linha.id) avisadosRef.current.add(String(linha.id));
        }
        const maisRecente = linhas[0]?.created_at;
        cursorRef.current = maisRecente ? String(maisRecente) : new Date().toISOString();
      } catch {
        cursorRef.current = new Date().toISOString();
      } finally {
        pronto = true;
      }
    };

    const verificar = async () => {
      if (!ativo || !pronto || !cursorRef.current) return;
      try {
        const { data, error } = await supabase
          .from("ordens_servico")
          .select("id, numero, cliente, created_at, clientes(nome_fantasia, razao_social)")
          .gte("created_at", cursorRef.current)
          .order("created_at", { ascending: true })
          .limit(20);
        if (error || !ativo || !Array.isArray(data) || data.length === 0) return;

        let ultimoCursor = cursorRef.current;
        for (const linha of data as LinhaOS[]) {
          const criado = linha.created_at ? String(linha.created_at) : "";
          if (criado && criado > ultimoCursor) ultimoCursor = criado;

          const id = linha.id ? String(linha.id) : "";
          if (!id || avisadosRef.current.has(id)) continue;
          avisadosRef.current.add(id);

          const cliente =
            linha.clientes?.nome_fantasia ||
            linha.clientes?.razao_social ||
            linha.cliente ||
            "Cliente";
          const numero = linha.numero ? String(linha.numero) : id.slice(0, 8);

          toast("🆕 Nova OS recebida", {
            id: `nova-os:${id}`,
            description: `${numero} · ${cliente}`,
            duration: 45000,
            action: onAbrirOS
              ? { label: "Abrir OS", onClick: () => onAbrirOS(id) }
              : undefined,
            onClick: onAbrirOS ? () => onAbrirOS(id) : undefined,
          });
        }
        cursorRef.current = ultimoCursor;
      } catch {
        // Silencioso: o polling tenta novamente no próximo ciclo.
      }
    };

    void iniciarCursor();
    timer = setInterval(() => void verificar(), intervaloMs);

    return () => {
      ativo = false;
      if (timer) clearInterval(timer);
    };
  }, [habilitado, intervaloMs, onAbrirOS]);
}
