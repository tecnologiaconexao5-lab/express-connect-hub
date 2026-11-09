// ============================================================
// LOTE 2 — INTELIGÊNCIA OPERACIONAL (TMS)
// Rota com endereço completo/coords, farol de SLA 20/40 min,
// repasse opcional e alerta de nova OS (polling curto).
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { montarTextoLivreEndereco } from "@/services/maps/distanceService";
import { classificarSlaAlocacao } from "@/services/operacao/osAlocacaoPendenteService";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const distanceSrc = readSrc("src/services/maps/distanceService.ts");
const osFormSrc = readSrc("src/components/operacao/OrdemServicoForm.tsx");
const slaSrc = readSrc("src/services/operacao/osAlocacaoPendenteService.ts");
const listaSrc = readSrc("src/components/operacao/OrdensServicoLista.tsx");
const hookSrc = readSrc("src/hooks/useNovaOSAlerta.ts");
const layoutSrc = readSrc("src/components/AppLayout.tsx");

describe("1) Roteirizador — endereço completo ou coordenadas", () => {
  it("1.1 monta a string completa Rua, Número, Bairro, Cidade - UF, CEP", () => {
    expect(
      montarTextoLivreEndereco({
        logradouro: "Av. Paulista",
        numero: "1000",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01310-100",
      }),
    ).toBe("Av. Paulista, 1000, Bela Vista, São Paulo - SP, 01310-100");
  });

  it("1.2 não duplica cidade/bairro já presentes no endereco", () => {
    const texto = montarTextoLivreEndereco({
      endereco: "Rua X, 10, Centro, São Paulo - SP",
      bairro: "Centro",
      cidade: "São Paulo",
      uf: "SP",
    });
    expect(texto).toBe("Rua X, 10, Centro, São Paulo - SP");
  });

  it("1.3 serviço aceita objeto, prioriza lat/lng e geocodifica o texto completo", () => {
    expect(distanceSrc).toContain("export type PontoRota");
    expect(distanceSrc).toContain("montarTextoLivreEndereco");
    expect(distanceSrc).toContain("resolverPonto");
    expect(distanceSrc).toContain("numeroValido(ponto.latitude)");
    expect(distanceSrc).toContain("calcularRotaCoordenadas(origemCoords, destinoCoords)");
  });

  it("1.4 o botão Calcular Rota passa o objeto do endereço (não só a string)", () => {
    expect(osFormSrc).toContain("temEnderecoParaRota");
    expect(osFormSrc).toContain("calcularRotasAlternativas(origem, destino)");
    expect(osFormSrc).toContain("calcularDistancia(origem, destino)");
    expect(osFormSrc).not.toContain("calcularDistancia(origem.endereco, destino.endereco)");
  });
});

describe("2) Farol de SLA de alocação (20 / 40 minutos)", () => {
  const minutosAtras = (min: number) => new Date(Date.now() - min * 60 * 1000).toISOString();

  it("2.1 limites exatos 20 e 40 minutos", () => {
    expect(classificarSlaAlocacao(minutosAtras(20), true)?.nivel).toBe("ok");
    expect(classificarSlaAlocacao(minutosAtras(21), true)?.nivel).toBe("atencao");
    expect(classificarSlaAlocacao(minutosAtras(40), true)?.nivel).toBe("atencao");
    expect(classificarSlaAlocacao(minutosAtras(41), true)?.nivel).toBe("atrasado");
  });

  it("2.2 constantes e cores na lista", () => {
    expect(slaSrc).toContain("MINUTOS_SLA_ALOCACAO_ATENCAO = 20");
    expect(slaSrc).toContain("MINUTOS_SLA_ALOCACAO_ATRASADO = 40");
    expect(listaSrc).toContain("FAROL_SLA_CLASSES");
    expect(listaSrc).toContain("FAROL_SLA_ROW");
    expect(listaSrc).toContain("bg-emerald-600");
    expect(listaSrc).toContain("bg-amber-500");
    expect(listaSrc).toContain("bg-red-600");
  });

  it("2.3 atraso não é mais disparado por os.data (date-only)", () => {
    expect(listaSrc).toContain("const dateStr = os.previsaoTermino;");
    expect(listaSrc).not.toContain("os.previsaoTermino || os.data");
  });
});

describe("3) Modal de alocação — repasse opcional", () => {
  it("3.1 não bloqueia alocação sem repasse e preserva custo existente", () => {
    expect(listaSrc).toContain("Repasse do prestador (R$) — opcional");
    expect(listaSrc).toContain("const custoFinal =");
    expect(listaSrc).toContain("custo_prestador: custoFinal");
    expect(listaSrc).not.toContain("Informe o repasse do prestador (maior que zero).");
  });

  it("3.2 mantém o pré-preenchimento automático pela tabela", () => {
    expect(listaSrc).toContain("calcularRepasseSugerido");
    expect(listaSrc).toContain("preencherRepasseAoSelecionar");
  });
});

describe("4) Alerta de nova OS (polling curto)", () => {
  it("4.1 hook consulta ordens_servico e exibe toast", () => {
    expect(hookSrc).toContain("setInterval");
    expect(hookSrc).toContain('from("ordens_servico")');
    expect(hookSrc).toContain("Nova Ordem de Serviço");
    expect(hookSrc).toContain("avisadosRef");
    expect(hookSrc).toContain("intervaloMs");
  });

  it("4.2 AppLayout monta o alerta e abre a OS pelo deep-link", () => {
    expect(layoutSrc).toContain("useNovaOSAlerta");
    expect(layoutSrc).toContain("/operacao?tab=os&os=");
  });
});
