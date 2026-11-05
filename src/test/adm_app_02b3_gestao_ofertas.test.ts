import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  calcularIndicadores,
  contatosDisponiveis,
  FILTRO_OFERTAS_VAZIO,
  filtrarOfertas,
  fromOfertaRow,
  podeConverter,
  transicoesPermitidas,
  type OfertaFiltro,
  type OfertaPublica,
} from "../modules/recrutamento/services/ofertasPublicasService";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const SERVICE = readSrc("src/modules/recrutamento/services/ofertasPublicasService.ts");
const LISTA = readSrc("src/modules/recrutamento/components/ofertas/OfertasPublicas.tsx");
const DETALHE = readSrc("src/modules/recrutamento/components/ofertas/OfertaDetalheSheet.tsx");
const COMPARACAO = readSrc("src/modules/recrutamento/components/ofertas/OfertaComparacaoDialog.tsx");
const MIGRATION_02B3 = readSrc(
  "supabase/migrations/20261103000003_adm_app_02b3_gestao_ofertas.sql",
);
const MIGRATION_02B2 = readSrc(
  "supabase/migrations/20261103000002_adm_app_02b2_ofertas_publicas.sql",
);

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "oferta-1",
    protocolo: "OF-20261103-ABC12345",
    tenant_id: "tenant-1",
    tipo_oferta: "motorista_veiculo_proprio",
    status: "em_analise",
    revisao_humana: false,
    nome: "Maria da Silva",
    cpf_cnpj: "",
    telefone: "(11) 99999-9999",
    email: "maria@exemplo.com",
    cidade: "São Paulo",
    uf: "SP",
    regioes: ["Grande SP", "ABC Paulista"],
    dias_disponiveis: [1, 2, 3, 4, 5],
    horario_inicio: "08:00",
    horario_fim: "18:00",
    modalidades: ["esporadica", "urgente"],
    tipo_moto: null,
    possui_bau: null,
    capacidade_bau_litros: null,
    veiculo_categoria: "proprio",
    veiculo_tipo: "VUC",
    carroceria: "Baú fechado",
    veiculo_modelo: "VUC 2024",
    veiculo_placa: "ABC1D23",
    veiculo_ano: 2024,
    caracteristicas: ["Rastreador", "Seguro"],
    capacidade_kg: 1500,
    capacidade_m3: 12,
    dimensoes: { comprimento_m: 4.2, largura_m: 2, altura_m: 2.2 },
    valor_diaria: 450,
    valor_km: 3.2,
    valor_saida: 120,
    valor_mensal: null,
    valor_negociavel: false,
    condicoes_comerciais: "Pagamento em 15 dias",
    restricoes: "Não aceita carga perigosa",
    observacoes: "Disponível para testes",
    origem: "link_publico",
    created_at: "2026-11-03T10:00:00.000Z",
    updated_at: "2026-11-03T11:00:00.000Z",
    disponibilidade_interna: {
      dias: [1, 2],
      horario_inicio: "09:00",
      horario_fim: "17:00",
      modalidades: ["esporadica"],
    },
    ...overrides,
  };
}

function oferta(overrides: Record<string, unknown> = {}): OfertaPublica {
  return fromOfertaRow(row(overrides));
}

function filtro(overrides: Partial<OfertaFiltro> = {}): OfertaFiltro {
  return { ...FILTRO_OFERTAS_VAZIO, ...overrides };
}

describe("ADM-APP-02B.3 — contrato e mapeamento", () => {
  it("mapeia todos os campos comerciais/operacionais da oferta", () => {
    const item = oferta();
    expect(item.nome).toBe("Maria da Silva");
    expect(item.protocolo).toBe("OF-20261103-ABC12345");
    expect(item.regioes).toEqual(["Grande SP", "ABC Paulista"]);
    expect(item.diasDisponiveis).toEqual([1, 2, 3, 4, 5]);
    expect(item.modalidades).toEqual(["esporadica", "urgente"]);
    expect(item.capacidadeKg).toBe(1500);
    expect(item.valorDiaria).toBe(450);
    expect(item.dimensoes.comprimento_m).toBe(4.2);
    expect(item.disponibilidadeInterna.dias).toEqual([1, 2]);
  });

  it("calcula os indicadores exigidos", () => {
    const lista = [
      oferta({ id: "1", status: "nova" }),
      oferta({ id: "2", status: "em_analise" }),
      oferta({ id: "3", status: "em_contato" }),
      oferta({ id: "4", status: "convertida" }),
      oferta({ id: "5", status: "descartada" }),
      oferta({ id: "6", status: "arquivada" }),
      oferta({ id: "7", status: "nova", revisao_humana: true }),
    ];
    expect(calcularIndicadores(lista)).toEqual({
      total: 7,
      novas: 2,
      emAnalise: 1,
      emContato: 1,
      convertidas: 1,
      descartadas: 1,
      arquivadas: 1,
      revisaoHumana: 1,
    });
  });
});

describe("ADM-APP-02B.3 — filtros e busca", () => {
  it("busca por nome, telefone (com e sem máscara), e-mail e protocolo", () => {
    const lista = [oferta()];
    expect(filtrarOfertas(lista, filtro({ busca: "maria" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ busca: "11999999999" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ busca: "(11) 99999" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ busca: "maria@exemplo" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ busca: "ABC12345" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ busca: "inexistente" }))).toHaveLength(0);
  });

  it("combina status, tipo, UF, cidade, região, modalidade e dia", () => {
    const lista = [oferta()];
    expect(filtrarOfertas(lista, filtro({ status: "em_analise" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ status: "convertida" }))).toHaveLength(0);
    expect(filtrarOfertas(lista, filtro({ tipoOferta: "motorista_veiculo_proprio" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ tipoOferta: "motoboy" }))).toHaveLength(0);
    expect(filtrarOfertas(lista, filtro({ uf: "SP", cidade: "São Paulo" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ uf: "RJ" }))).toHaveLength(0);
    expect(filtrarOfertas(lista, filtro({ regiao: "grande sp" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ modalidade: "esporadica" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ modalidade: "fixa" }))).toHaveLength(0);
    expect(filtrarOfertas(lista, filtro({ dia: "1" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ dia: "0" }))).toHaveLength(0);
  });

  it("filtra por disponibilidade interna, veículo, capacidade e faixa de valores", () => {
    const lista = [oferta()];
    expect(filtrarOfertas(lista, filtro({ disponibilidade: "com_interna" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ disponibilidade: "sem_interna" }))).toHaveLength(0);
    expect(filtrarOfertas(lista, filtro({ veiculoTipo: "vuc" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ veiculoTipo: "moto" }))).toHaveLength(0);
    expect(filtrarOfertas(lista, filtro({ capacidadeMinKg: "1000" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ capacidadeMinKg: "2000" }))).toHaveLength(0);
    expect(filtrarOfertas(lista, filtro({ valorMin: "400", valorMax: "500" }))).toHaveLength(1);
    expect(filtrarOfertas(lista, filtro({ valorMin: "500" }))).toHaveLength(0);
  });
});

describe("ADM-APP-02B.3 — transições, contato e conversão", () => {
  it("expõe exatamente as transições permitidas pela 02B.2", () => {
    expect(transicoesPermitidas("nova")).toEqual(["em_analise", "em_contato", "descartada", "arquivada"]);
    expect(transicoesPermitidas("em_analise")).toEqual(["em_contato", "descartada", "arquivada"]);
    expect(transicoesPermitidas("em_contato")).toEqual(["descartada", "arquivada"]);
    expect(transicoesPermitidas("convertida")).toEqual(["arquivada"]);
    expect(transicoesPermitidas("duplicada")).toEqual(["arquivada"]);
    expect(transicoesPermitidas("descartada")).toEqual([]);
    expect(transicoesPermitidas("arquivada")).toEqual([]);
  });

  it("bloqueia conversão fora de em_analise/em_contato ou com revisão pendente", () => {
    expect(podeConverter(oferta({ status: "em_analise" }))).toBe(true);
    expect(podeConverter(oferta({ status: "em_contato" }))).toBe(true);
    expect(podeConverter(oferta({ status: "nova" }))).toBe(false);
    expect(podeConverter(oferta({ status: "convertida" }))).toBe(false);
    expect(podeConverter(oferta({ status: "em_analise", revisao_humana: true }))).toBe(false);
  });

  it("detecta contatos disponíveis e ausentes sem inventar dados", () => {
    expect(contatosDisponiveis(oferta())).toEqual({ whatsapp: true, telefone: true, email: true });
    const semTelefone = oferta({ telefone: "", email: "" });
    expect(contatosDisponiveis(semTelefone)).toEqual({ whatsapp: false, telefone: false, email: false });
  });
});

describe("ADM-APP-02B.3 — serviço e arquitetura segura", () => {
  it("lê a tabela real e usa RPCs para toda escrita", () => {
    expect(SERVICE).toContain('from("recrutamento_ofertas")');
    expect(SERVICE).toContain('from("recrutamento_oferta_eventos")');
    expect(SERVICE).toContain('rpc("f_atualizar_status_oferta"');
    expect(SERVICE).toContain('rpc("f_registrar_observacao_oferta"');
    expect(SERVICE).toContain('rpc("f_atualizar_disponibilidade_oferta"');
    expect(SERVICE).toContain('rpc("f_registrar_contato_oferta"');
    expect(SERVICE).toContain('rpc("f_resolver_revisao_oferta"');
    expect(SERVICE).toContain('rpc("f_converter_oferta_em_candidato"');
    expect(SERVICE).not.toContain('.insert(');
    expect(SERVICE).not.toContain('.update(');
    expect(SERVICE).not.toContain('.delete(');
  });

  it("não envia tenant_id pelo cliente e trata backend não implantado sem simular sucesso", () => {
    expect(SERVICE).not.toContain("p_tenant_id");
    expect(SERVICE).not.toContain("tenant_id:");
    expect(SERVICE).toContain("backendIndisponivel");
    expect(SERVICE).toContain("could not find the table");
    expect(LISTA).toContain("Backend de ofertas ainda não implantado");
    expect(LISTA).toContain("Nenhuma oferta é simulada");
  });

  it("lista, detalha, compara, contata, atualiza disponibilidade, status, histórico e converte", () => {
    expect(LISTA).toContain("Ofertas recebidas");
    expect(LISTA).toContain("Comparar (");
    expect(LISTA).toContain("registrarContatoRapido");
    expect(LISTA).toContain("OfertaDetalheSheet");
    expect(LISTA).toContain("OfertaComparacaoDialog");
    expect(DETALHE).toContain("Turnos e disponibilidade");
    expect(DETALHE).toContain("Disponibilidade interna");
    expect(DETALHE).toContain("Histórico cronológico");
    expect(DETALHE).toContain("Converter em candidato");
    expect(DETALHE).toContain("Confirmar conversão");
    expect(DETALHE).toContain("Não cria prestador, usuário de autenticação ou acesso ao APP");
    expect(COMPARACAO).toContain("Comparar ofertas");
    expect(COMPARACAO).toContain("Condições");
  });

  it("mantém estado de carregamento, vazio e falha de backend explícitos", () => {
    expect(LISTA).toContain("carregando ?");
    expect(LISTA).toContain("Nenhuma oferta recebida ainda");
    expect(LISTA).toContain("Nenhuma oferta encontrada");
    expect(LISTA).toContain("Não foi possível carregar as ofertas");
    expect(LISTA).toContain("Tentar novamente");
  });

  it("desabilita contato quando o dado correspondente não existe", () => {
    expect(DETALHE).toContain("disabled={!contatos.whatsapp}");
    expect(DETALHE).toContain("disabled={!contatos.telefone}");
    expect(DETALHE).toContain("disabled={!contatos.email}");
    expect(LISTA).toContain("disabled={!contatos.whatsapp}");
    expect(LISTA).toContain("disabled={!contatos.telefone}");
    expect(LISTA).toContain("disabled={!contatos.email}");
  });
});

describe("ADM-APP-02B.3 — migration de gestão interna", () => {
  it("adiciona disponibilidade interna sem sobrescrever os campos originais", () => {
    expect(MIGRATION_02B3).toContain("ADD COLUMN IF NOT EXISTS disponibilidade_interna JSONB");
    expect(MIGRATION_02B3).toContain("Disponibilidade interna atualizada (oferta original preservada).");
    expect(MIGRATION_02B3).toContain("SET disponibilidade_interna = v_interna");
    expect(MIGRATION_02B3).not.toContain("SET dias_disponiveis =");
    expect(MIGRATION_02B3).not.toContain("SET horario_inicio =");
  });

  it("exige RPC para escrita e revoga UPDATE direto do authenticated", () => {
    expect(MIGRATION_02B3).toContain("REVOKE UPDATE ON public.recrutamento_ofertas FROM authenticated");
    expect(MIGRATION_02B3).toContain("GRANT SELECT ON public.recrutamento_ofertas TO authenticated");
    expect(MIGRATION_02B3).toContain("f_atualizar_status_oferta");
    expect(MIGRATION_02B3).toContain("f_registrar_observacao_oferta");
    expect(MIGRATION_02B3).toContain("f_atualizar_disponibilidade_oferta");
    expect(MIGRATION_02B3).toContain("f_registrar_contato_oferta");
    expect(MIGRATION_02B3).toContain("f_resolver_revisao_oferta");
    expect(MIGRATION_02B3).toContain("f_converter_oferta_em_candidato");
  });

  it("protege tenant e usuário TMS em todas as RPCs", () => {
    expect(MIGRATION_02B3).toContain("f_oferta_usuario_autorizado");
    expect(MIGRATION_02B3).toContain("tu.user_id = auth.uid()");
    expect(MIGRATION_02B3).toContain("tu.tenant_id = p_tenant_id");
    expect(MIGRATION_02B3).toContain("WHERE id = p_oferta_id AND tenant_id = v_tenant");
    expect(MIGRATION_02B3).toContain("FOR UPDATE");
  });

  it("conversão é explícita, idempotente e vinculada por oferta_id", () => {
    expect(MIGRATION_02B3).toContain("WHERE oferta_id = v_oferta.id");
    expect(MIGRATION_02B3).toContain("ja_convertida");
    expect(MIGRATION_02B3).toContain("conversao_inconsistente");
    expect(MIGRATION_02B3).toContain("revisao_humana_pendente");
    expect(MIGRATION_02B3).toContain("candidato_duplicado_existente");
    expect(MIGRATION_02B3).toContain("conversao_candidato_existente");
    expect(MIGRATION_02B3).toContain("regexp_replace(coalesce(c.telefone");
    expect(MIGRATION_02B3).toContain("status_invalido_para_conversao");
    expect(MIGRATION_02B3).toContain("jsonb_build_array('oferta_publica')");
    expect(MIGRATION_02B3).toContain("oferta_id");
    expect(MIGRATION_02B3).toContain("created_at");
    expect(MIGRATION_02B3).toContain("updated_at");
  });

  it("garante compatibilidade das colunas de candidato usadas na conversão", () => {
    expect(MIGRATION_02B3).toContain("ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT public.current_tenant_id_safe()");
    expect(MIGRATION_02B3).toContain("ADD COLUMN IF NOT EXISTS preferencias_operacionais JSONB");
    expect(MIGRATION_02B3).toContain("ADD COLUMN IF NOT EXISTS respostas_situacionais JSONB");
  });

  it("não cria prestador, auth user, liberado_app nem documentos obrigatórios", () => {
    expect(MIGRATION_02B3).not.toContain("INSERT INTO public.prestadores");
    expect(MIGRATION_02B3).not.toContain("auth.users");
    expect(MIGRATION_02B3).not.toContain("liberado_app =");
    expect(MIGRATION_02B3).not.toContain("liberado_app=true");
    expect(MIGRATION_02B3).not.toContain("chave_pix");
    expect(MIGRATION_02B3).not.toContain("dados_bancarios");
    expect(MIGRATION_02B3).toContain("'[]'::jsonb");
  });

  it("mantém a migration 02B.2 estruturalmente única e com rate limit", () => {
    expect((MIGRATION_02B2.match(/CREATE OR REPLACE FUNCTION public\.f_registrar_oferta_publica/g) ?? []).length).toBe(1);
    expect((MIGRATION_02B2.match(/^COMMIT;$/gm) ?? []).length).toBe(1);
    expect(MIGRATION_02B2).toContain("recrutamento_oferta_rate_limit");
    expect(MIGRATION_02B2).toContain("v_rate_count > 5");
    expect(MIGRATION_02B2).toContain("GRANT EXECUTE ON FUNCTION public.f_registrar_oferta_publica");
    expect(MIGRATION_02B2).toContain("TO service_role");
  });
});
