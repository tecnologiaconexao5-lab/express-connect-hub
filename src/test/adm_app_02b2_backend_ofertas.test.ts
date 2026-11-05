import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validarPayloadOferta } from "../../supabase/functions/ofertas-publicas/validation";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const MIGRATION = readSrc("supabase/migrations/20261103000002_adm_app_02b2_ofertas_publicas.sql");
const EDGE = readSrc("supabase/functions/ofertas-publicas/index.ts");
const VALIDATION = readSrc("supabase/functions/ofertas-publicas/validation.ts");
const CONFIG = readSrc("supabase/config.toml");

function payloadValido(overrides: Record<string, unknown> = {}) {
  return {
    tipo_oferta: "motorista_veiculo_proprio",
    nome: "Maria da Silva",
    telefone: "(11) 99999-9999",
    email: "maria@exemplo.com",
    cidade: "São Paulo",
    uf: "SP",
    regioes: ["Grande SP", "ABC Paulista"],
    dias_disponiveis: [1, 2, 3, 4, 5],
    horario_inicio: "08:00",
    horario_fim: "18:00",
    modalidades: ["esporadica", "urgente"],
    veiculo_categoria: "proprio",
    veiculo_tipo: "Fiorino",
    carroceria: "Baú fechado",
    veiculo_modelo: "Fiorino 1.4",
    veiculo_placa: "ABC1D23",
    veiculo_ano: 2024,
    caracteristicas: ["Baú", "Rastreador"],
    capacidade_kg: 1500,
    capacidade_m3: 6,
    dimensoes: { comprimento_m: 3.2, largura_m: 1.8, altura_m: 1.9 },
    valor_diaria: 250,
    valor_km: 2.5,
    valor_saida: 80,
    valor_mensal: null,
    valor_negociavel: false,
    condicoes_comerciais: "Pedágio por conta do cliente.",
    restricoes: null,
    observacoes: null,
    lgpd_consent: true,
    lgpd_termo_versao: "2026-11-v1",
    ...overrides,
  };
}

function payloadMotoboy(overrides: Record<string, unknown> = {}) {
  return payloadValido({
    tipo_oferta: "motoboy",
    tipo_moto: "Street",
    possui_bau: true,
    capacidade_bau_litros: 90,
    veiculo_tipo: undefined,
    carroceria: undefined,
    ...overrides,
  });
}

describe("ADM-APP-02B.2 — backend de ofertas públicas", () => {
  it("1. aceita payload válido e normaliza os dados", () => {
    const resultado = validarPayloadOferta(payloadValido());
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.payload.telefone).toBe("11999999999");
      expect(resultado.payload.email).toBe("maria@exemplo.com");
      expect(resultado.payload.regioes).toEqual(["ABC Paulista", "Grande SP"]);
      expect(resultado.payload.dias_disponiveis).toEqual([1, 2, 3, 4, 5]);
      expect(resultado.payload.lgpd_consent).toBe(true);
    }
  });

  it("aceita payload de motoboy com campos condicionais", () => {
    const resultado = validarPayloadOferta(payloadMotoboy());
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.payload.veiculo_tipo).toBe("moto");
      expect(resultado.payload.tipo_moto).toBe("Street");
      expect(resultado.payload.possui_bau).toBe(true);
      expect(resultado.payload.capacidade_bau_litros).toBe(90);
    }
  });

  it("2. rejeita campos obrigatórios ausentes", () => {
    expect(validarPayloadOferta(payloadValido({ tipo_oferta: "" })).ok).toBe(false);
    expect(validarPayloadOferta(payloadValido({ nome: "" })).ok).toBe(false);
    expect(validarPayloadOferta(payloadValido({ telefone: "" })).ok).toBe(false);
    expect(validarPayloadOferta(payloadValido({ cidade: "" })).ok).toBe(false);
    expect(validarPayloadOferta(payloadValido({ regioes: [] })).ok).toBe(false);
    expect(validarPayloadOferta(payloadValido({ dias_disponiveis: [] })).ok).toBe(false);
    expect(validarPayloadOferta(payloadValido({ modalidades: [] })).ok).toBe(false);
    expect(validarPayloadOferta(payloadValido({ lgpd_consent: false })).ok).toBe(false);
  });

  it("3. rejeita telefone inválido", () => {
    expect(validarPayloadOferta(payloadValido({ telefone: "123" })).ok).toBe(false);
    expect(validarPayloadOferta(payloadValido({ telefone: "00999999999" })).ok).toBe(false);
  });

  it("4. rejeita e-mail inválido", () => {
    expect(validarPayloadOferta(payloadValido({ email: "maria@" })).ok).toBe(false);
    expect(validarPayloadOferta(payloadValido({ email: "sem-email" })).ok).toBe(false);
  });

  it("5. exige consentimento LGPD", () => {
    const resultado = validarPayloadOferta(payloadValido({ lgpd_consent: false }));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBe("lgpd_obrigatorio");
  });

  it("6. rejeita campos inesperados/privilegiados", () => {
    for (const campo of ["tenant_id", "status", "protocolo", "id", "liberado_app"]) {
      const resultado = validarPayloadOferta(payloadValido({ [campo]: "x" }));
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.error).toBe("campos_inesperados");
    }
  });

  it("7. limita campos e corpo contra payload abusivo", () => {
    const nomeGigante = "a".repeat(200);
    const resultado = validarPayloadOferta(payloadValido({ nome: nomeGigante }));
    expect(resultado.ok).toBe(false);
    expect(EDGE).toContain("MAX_BODY_BYTES");
    expect(EDGE).toContain("payload_muito_grande");
  });

  it("8. CAPTCHA é verificado no servidor (invalido/expirado/reutilizado via provedor)", () => {
    expect(EDGE).toContain("verificarCaptcha");
    expect(EDGE).toContain("challenges.cloudflare.com");
    expect(EDGE).toContain("hcaptcha.com/siteverify");
    expect(EDGE).toContain("data?.success === true");
    expect(EDGE).toContain("OFERTAS_PUBLICAS_CAPTCHA_SECRET");
    expect(EDGE).toContain("OFERTAS_PUBLICAS_REQUIRE_CAPTCHA");
  });

  it("9. rate limit é persistente e aplicado na RPC", () => {
    expect(MIGRATION).toContain("recrutamento_oferta_rate_limit");
    expect(MIGRATION).toContain("v_rate_count > 5");
    expect(MIGRATION).toContain("RAISE EXCEPTION 'rate_limit'");
    expect(EDGE).toContain("muitas_tentativas");
  });

  it("10. tenant não pode ser definido pelo navegador", () => {
    const resultado = validarPayloadOferta(payloadValido({ tenant_id: "00000000-0000-0000-0000-000000000001" }));
    expect(resultado.ok).toBe(false);
    expect(EDGE).toContain("OFERTAS_PUBLICAS_TENANT_ID");
    expect(EDGE).toContain("p_tenant_id: tenantId");
    expect(MIGRATION).toContain("tenant_invalido");
  });

  it("11/12. anon não tem INSERT/SELECT direto na tabela", () => {
    expect(MIGRATION).toContain("REVOKE ALL ON public.recrutamento_ofertas FROM anon");
    expect(MIGRATION).toContain("GRANT SELECT, UPDATE ON public.recrutamento_ofertas TO authenticated");
    expect(MIGRATION).not.toMatch(/GRANT\s+(SELECT|INSERT|ALL)[^;]*recrutamento_ofertas[^;]*TO\s+anon/i);
    expect(MIGRATION).not.toMatch(/CREATE POLICY[^;]*recrutamento_ofertas[^;]*FOR\s+(SELECT|INSERT)[^;]*TO\s+anon/i);
  });

  it("13. RPC é executável apenas por service_role", () => {
    expect(MIGRATION).toContain("REVOKE ALL ON FUNCTION public.f_registrar_oferta_publica");
    expect(MIGRATION).toContain("FROM PUBLIC, anon, authenticated");
    expect(MIGRATION).toContain("GRANT EXECUTE ON FUNCTION public.f_registrar_oferta_publica");
    expect(MIGRATION).toContain("TO service_role");
    expect(EDGE).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("14. conflito telefone/e-mail entre ofertas distintas é sinalizado", () => {
    expect(MIGRATION).toContain("recrutamento_oferta_identificadores");
    expect(MIGRATION).toContain("v_relacionadas");
    expect(MIGRATION).toContain("v_revisao := coalesce(array_length(v_relacionadas, 1), 0) > 1");
    expect(MIGRATION).toContain("'conflito_identificadores'");
    expect(MIGRATION).toContain("'revisao_humana'");
  });

  it("15. concorrência usa advisory lock e unique parcial (sem SELECT FOR UPDATE em inexistente)", () => {
    expect(MIGRATION).toContain("pg_advisory_xact_lock");
    expect(MIGRATION).toContain("hashtextextended");
    expect(MIGRATION).toContain("uq_ofertas_dedup_ativa");
    const rpcInicio = MIGRATION.indexOf("CREATE OR REPLACE FUNCTION public.f_registrar_oferta_publica");
    const rpcFim = MIGRATION.indexOf("-- 9) PERMISSÕES DA RPC");
    expect(rpcInicio).toBeGreaterThan(-1);
    expect(rpcFim).toBeGreaterThan(rpcInicio);
    expect(MIGRATION.slice(rpcInicio, rpcFim)).not.toContain("FOR UPDATE");
  });

  it("16. reenvio idempotente retorna a mesma oferta/protocolo", () => {
    expect(MIGRATION).toContain("idempotency_key");
    expect(MIGRATION).toContain("uq_ofertas_idempotency");
    expect(MIGRATION).toContain("'deduplicada', TRUE");
    expect(MIGRATION).toContain("v_key");
  });

  it("17. mesmo contato pode ter ofertas diferentes (veículo/condições)", () => {
    expect(MIGRATION).toContain("v_dedup := md5(concat_ws");
    expect(MIGRATION).toContain("v_veiculo_tipo");
    expect(MIGRATION).toContain("v_valor_diaria");
    expect(MIGRATION).toContain("coalesce(array_length(v_relacionadas, 1), 0) > 1");
    expect(MIGRATION).toContain("Não bloqueia");
  });

  it("18. RLS isola ofertas por tenant e usuário TMS", () => {
    expect(MIGRATION).toContain("ENABLE ROW LEVEL SECURITY");
    expect(MIGRATION).toContain("tenant_id = public.current_tenant_id_safe()");
    expect(MIGRATION).toContain("public.tenant_usuarios tu WHERE tu.user_id = auth.uid()");
    expect(MIGRATION).toContain("WITH CHECK");
  });

  it("19. campos internos e transições de status são protegidos", () => {
    expect(MIGRATION).toContain("f_recrutamento_ofertas_before_update");
    expect(MIGRATION).toContain("campos_internos_imutaveis");
    expect(MIGRATION).toContain("transicao_status_invalida");
    expect(MIGRATION).toContain("NEW.tenant_id IS DISTINCT FROM OLD.tenant_id");
    expect(MIGRATION).toContain("NEW.protocolo IS DISTINCT FROM OLD.protocolo");
    expect(MIGRATION).toContain("NEW.lgpd_consent IS DISTINCT FROM OLD.lgpd_consent");
  });

  it("20. logs da Edge não expõem dados pessoais", () => {
    expect(EDGE).toContain("ip_hash_prefix");
    expect(EDGE).not.toContain("console.log(payload");
    expect(EDGE).not.toContain("console.log(body");
    expect(EDGE).not.toContain("console.log(validacao.payload");
    expect(EDGE).not.toContain("console.log(JSON.stringify(payload");
  });

  it("Edge aplica CORS, método, tamanho, tenant server-side e validação", () => {
    expect(EDGE).toContain("OFERTAS_PUBLICAS_ALLOWED_ORIGINS");
    expect(EDGE).toContain("origem_nao_autorizada");
    expect(EDGE).toContain("metodo_nao_permitido");
    expect(EDGE).toContain("MAX_BODY_BYTES");
    expect(EDGE).toContain("validarPayloadOferta");
    expect(EDGE).toContain("OFERTAS_PUBLICAS_IP_SALT");
    expect(EDGE).toContain("sha256Hex");
    expect(EDGE).toContain("p_ip_hash");
    expect(EDGE).toContain("p_user_agent_hash");
  });

  it("validação compartilhada não importa Deno/Supabase e não expõe service_role", () => {
    expect(VALIDATION).not.toContain("Deno");
    expect(VALIDATION).not.toContain("supabase");
    expect(VALIDATION).not.toContain("SERVICE_ROLE");
    expect(VALIDATION).toContain("CAMPOS_PUBLICOS");
    expect(VALIDATION).toContain("lgpd_termo_versao");
  });

  it("migration contém tabelas, vínculo opcional e configuração pública da função", () => {
    expect(MIGRATION).toContain("CREATE TABLE IF NOT EXISTS public.recrutamento_ofertas");
    expect(MIGRATION).toContain("recrutamento_oferta_identificadores");
    expect(MIGRATION).toContain("recrutamento_oferta_eventos");
    expect(MIGRATION).toContain("ALTER TABLE public.recrutamento_candidatos");
    expect(MIGRATION).toContain("oferta_id UUID");
    expect(MIGRATION).toContain("NOTIFY pgrst, 'reload schema'");
    expect(CONFIG).toContain("[functions.ofertas-publicas]");
    expect(CONFIG).toContain("verify_jwt = false");
  });
});
