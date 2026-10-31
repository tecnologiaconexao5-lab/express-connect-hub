// ============================================================
// TALENT INTELLIGENCE — Fase 1 + 2 (base de dados + sync do App)
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const sql = readSrc("supabase/migrations/20261031000001_talent_perfil.sql");

describe("A) Perfil profissional 1:1", () => {
  it("cria prestador_perfil_talento com as colunas e vínculo 1:1", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.prestador_perfil_talento");
    expect(sql).toContain("prestador_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE");
    expect(sql).toContain("UNIQUE (prestador_id)");
    expect(sql).toContain("modalidade_preferencial text[]");
    expect(sql).toContain("distancia_max_coleta_km integer");
    expect(sql).toContain("aceita_viagens boolean");
    expect(sql).toContain("restricoes_operacionais jsonb");
    expect(sql).toContain("tenant_id uuid");
  });

  it("habilita RLS com acesso TMS e do próprio prestador", () => {
    expect(sql).toContain("ALTER TABLE public.prestador_perfil_talento ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("tenant_usuarios WHERE user_id = auth.uid()");
    expect(sql).toContain("p.auth_user_id = auth.uid()");
  });
});

describe("B) Janelas de disponibilidade", () => {
  it("adiciona dia_semana/hora_inicio/hora_fim e índice combinado", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS dia_semana integer");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS hora_inicio time");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS hora_fim time");
    expect(sql).toContain(
      "CREATE INDEX IF NOT EXISTS idx_prestador_disponibilidade_dia",
    );
    expect(sql).toContain("(prestador_id, dia_semana)");
  });

  it("substitui o índice único antigo (permitia só 1 janela por prestador)", () => {
    expect(sql).toContain("DROP INDEX IF EXISTS public.idx_unique_disponibilidade");
  });
});

describe("C) Avaliações situacionais", () => {
  it("cria cenários e avaliações com vínculos e colunas exigidas", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.recrutamento_cenarios");
    expect(sql).toContain("titulo text NOT NULL");
    expect(sql).toContain("descricao_situacao text NOT NULL");
    expect(sql).toContain("competencia_alvo text");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.recrutamento_avaliacoes");
    expect(sql).toContain("prestador_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE");
    expect(sql).toContain("cenario_id uuid NOT NULL REFERENCES public.recrutamento_cenarios(id) ON DELETE CASCADE");
    expect(sql).toContain("resposta_candidato text");
    expect(sql).toContain("pontuacao numeric(5,2)");
    expect(sql).toContain("analise_ia_jsonb jsonb");
  });
});

describe("D) Sincronização com o App", () => {
  it("cria a RPC de perfil e a mantém idempotente por auth_user_id", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.app_s6_salvar_perfil_talento");
    expect(sql).toContain("WHERE auth_user_id = v_auth_uid");
    expect(sql).toContain("ON CONFLICT (prestador_id) DO UPDATE");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.app_s6_salvar_perfil_talento");
  });

  it("alimenta perfil, disponibilidade e avaliações a partir do App", () => {
    expect(sql).toContain("INSERT INTO public.prestador_perfil_talento");
    expect(sql).toContain("INSERT INTO public.prestador_disponibilidade");
    expect(sql).toContain("INSERT INTO public.recrutamento_avaliacoes");
    expect(sql).toContain("ON CONFLICT (prestador_id, cenario_id) DO UPDATE");
  });

  it("atualiza app_s6_criar_prestador sem quebrar a idempotência", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.app_s6_criar_prestador");
    expect(sql).toContain("SELECT id INTO v_existing_id");
    expect(sql).toContain("WHERE auth_user_id = v_auth_uid");
    expect(sql).toContain("PERFORM public.app_s6_salvar_perfil_talento(");
    expect(sql).toContain("RETURN jsonb_build_object('prestador_id', v_new_id)");
  });
});
