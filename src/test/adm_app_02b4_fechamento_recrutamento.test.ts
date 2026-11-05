import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const FORM = readSrc("src/components/cadastro-publico/OfertaPublicaForm.tsx");
const LIB = readSrc("src/lib/ofertaPublica.ts");
const APP = readSrc("src/App.tsx");
const EDGE = readSrc("supabase/functions/ofertas-publicas/index.ts");
const CONFIG = readSrc("supabase/config.toml");
const CAPTCHA = readSrc("src/components/cadastro-publico/OfertaCaptcha.tsx");
const CAPTCHA_CONFIG = readSrc("src/lib/ofertaCaptcha.ts");
const LISTA = readSrc("src/modules/recrutamento/components/ofertas/OfertasPublicas.tsx");
const SERVICE = readSrc("src/modules/recrutamento/services/ofertasPublicasService.ts");

describe("ADM-APP-02B.4 — link publico e contrato de envio", () => {
  it("mantem a rota publica fora do ProtectedRoute", () => {
    expect(APP).toContain('path="/cadastro-prestador"');
    expect(APP).toContain("CadastroPrestador");
  });

  it("envia para a Edge ofertas-publicas com idempotencia e payload do contrato", () => {
    expect(FORM).toContain('supabase.functions.invoke("ofertas-publicas"');
    expect(FORM).toContain("x-idempotency-key");
    expect(FORM).toContain("x-captcha-token");
    expect(FORM).toContain("OfertaCaptcha");
    expect(FORM).toContain("montarPayloadOferta(draft)");
    expect(FORM).toContain("crypto.randomUUID()");
    expect(FORM).not.toContain("service_role");
    expect(FORM).not.toContain("serviceRole");
  });

  it("nao exibe sucesso antes de protocolo real do backend", () => {
    const posProtocolo = FORM.indexOf("const protocoloRecebido");
    const posConcluido = FORM.indexOf("setConcluido(true)");
    expect(posProtocolo).toBeGreaterThan(-1);
    expect(posConcluido).toBeGreaterThan(posProtocolo);
    expect(FORM).toContain("O backend nao retornou um protocolo");
    expect(FORM).toContain('MENSAGEM_OFERTA_REGISTRADA');
    expect(FORM).toContain("PRÉ-CADASTRO CONCLUÍDO");
    expect(FORM).not.toContain("MENSAGEM_ENVIO_PENDENTE");
    expect(FORM).not.toContain("Integra");
  });

  it("mapeia indisponibilidade, captcha, rate limit, validacao e rede sem falso sucesso", () => {
    expect(FORM).toContain("configuracao_indisponivel");
    expect(FORM).toContain("captcha_invalido");
    expect(FORM).toContain("muitas_tentativas");
    expect(FORM).toContain("payload_muito_grande");
    expect(FORM).toContain("status === 400");
    expect(FORM).toContain("if (!status)");
    expect(FORM).toContain("Nenhuma confirmacao foi recebida");
    expect(FORM).toContain("O canal de envio ainda nao esta disponivel");
  });

  it("permite retry idempotente e reseta a chave quando o conteudo muda", () => {
    expect(FORM).toContain("requestIdRef.current = requestId");
    expect(FORM).toContain("requestIdRef.current = null");
    expect(FORM).toContain("setProtocolo(null)");
    expect(FORM).toContain('setErroEnvio(null)');
  });

  it("mantem o contrato LGPD e o endpoint no cliente sem service role", () => {
    expect(LIB).toContain('LGPD_TERMO_VERSAO = "2026-11-v1"');
    expect(LIB).toContain("lgpd_termo_versao: LGPD_TERMO_VERSAO");
    expect(LIB).toContain("export function obterLinkPublicoOfertas");
    expect(FORM).not.toContain("SERVICE_ROLE");
  });

  it("mantem a Edge com CORS, captcha e service role apenas no runtime", () => {
    expect(CONFIG).toContain("[functions.ofertas-publicas]");
    expect(CONFIG).toContain("verify_jwt = false");
    expect(EDGE).toContain("OFERTAS_PUBLICAS_ALLOWED_ORIGINS");
    expect(EDGE).toContain("Authorization, apikey, x-client-info");
    expect(CAPTCHA_CONFIG).toContain("VITE_OFERTAS_CAPTCHA_SITE_KEY");
    expect(CAPTCHA).toContain("hcaptcha");
    expect(CAPTCHA).toContain("turnstile");
    expect(EDGE).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(EDGE).toContain("OFERTAS_PUBLICAS_REQUIRE_CAPTCHA");
    expect(EDGE).toContain("f_registrar_oferta_publica");
    expect(EDGE).not.toContain("serviceKey: serviceKey,");
  });
});

describe("ADM-APP-02B.4 — modulo de recrutamento", () => {
  it("mantem listagem, busca, filtros, detalhe e estado vazio", () => {
    expect(LISTA).toContain("Ofertas recebidas");
    expect(LISTA).toContain("busca");
    expect(LISTA).toContain("Filtros e busca");
    expect(LISTA).toContain("OfertaDetalheSheet");
    expect(LISTA).toContain("Nenhuma oferta recebida ainda");
  });

  it("mantem contato, status e historico no detalhe", () => {
    const detalhe = readSrc("src/modules/recrutamento/components/ofertas/OfertaDetalheSheet.tsx");
    expect(detalhe).toContain("WhatsApp");
    expect(detalhe).toContain("Telefone");
    expect(detalhe).toContain("E-mail");
    expect(detalhe).toContain("Alterar status");
    expect(detalhe).toContain("Histórico cronológico");
    expect(detalhe).toContain("Registrar observação");
  });

  it("nao faz escrita direta e usa RPCs autorizadas", () => {
    expect(SERVICE).not.toContain(".insert(");
    expect(SERVICE).not.toContain(".update(");
    expect(SERVICE).not.toContain(".delete(");
    expect(SERVICE).toContain('rpc("f_atualizar_status_oferta"');
    expect(SERVICE).toContain('rpc("f_converter_oferta_em_candidato"');
  });
});
