import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MAPBOX_ACCESS_TOKEN, getMapboxToken } from "@/lib/mapboxToken";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

describe("Mapbox — token via env (sem segredo no repositório)", () => {
  it("1 — fonte única lê VITE_MAPBOX_ACCESS_TOKEN e não tem token hardcoded", () => {
    const fonte = readSrc("src/lib/mapboxToken.ts");
    expect(fonte).toContain("import.meta.env.VITE_MAPBOX_ACCESS_TOKEN");
    expect(fonte).not.toMatch(/["'`]pk\.[A-Za-z0-9_-]{20,}/);
    expect(typeof MAPBOX_ACCESS_TOKEN).toBe("string");
    expect(getMapboxToken()).toBe(MAPBOX_ACCESS_TOKEN || null);
  });

  it("2 — serviços de geocodificação/rotas importam a fonte única", () => {
    for (const arquivo of [
      "src/services/maps/mapboxAutocomplete.ts",
      "src/services/maps/mapboxProvider.ts",
      "src/services/roteirizacaoMapbox.ts",
    ]) {
      const src = readSrc(arquivo);
      expect(src, arquivo).toContain('from "@/lib/mapboxToken"');
      expect(src, arquivo).not.toContain("import.meta.env");
    }
  });

  it("3 — componentes de mapa usam a fonte única (sem localStorage)", () => {
    const mapboxMap = readSrc("src/components/MapboxMap.tsx");
    expect(mapboxMap).toContain("MAPBOX_ACCESS_TOKEN");
    expect(mapboxMap).not.toContain('localStorage.getItem("mapbox_token")');

    const painel = readSrc("src/components/operacional/PainelOperacionalMapa.tsx");
    expect(painel).toContain("MAPBOX_ACCESS_TOKEN");
    expect(painel).not.toContain("import.meta.env");

    const roteirizacao = readSrc("src/components/portal-cliente/PortalRoteirizacao.tsx");
    expect(roteirizacao).toContain("mapboxToken={MAPBOX_ACCESS_TOKEN}");

    const portal = readSrc("src/pages/PortalCliente.tsx");
    expect(portal).toContain("mapboxToken={MAPBOX_ACCESS_TOKEN}");
  });

  it("4 — apenas a fonte única lê env do Mapbox em src/", () => {
    const raiz = path.resolve(process.cwd(), "src");
    const arquivos: string[] = [];
    const visitar = (dir: string) => {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const completo = path.join(dir, item.name);
        if (item.isDirectory()) visitar(completo);
        else if (/\.(ts|tsx)$/.test(item.name)) arquivos.push(completo);
      }
    };
    visitar(raiz);

    const permitido = path.resolve(raiz, "lib", "mapboxToken.ts");
    const ocorrencias = arquivos
      .filter((arquivo) => arquivo !== permitido)
      .filter((arquivo) => !arquivo.endsWith("fix_mapbox_token_env.test.ts"))
      .filter((arquivo) =>
        /import\.meta\.env\.(VITE_)?MAPBOX/.test(fs.readFileSync(arquivo, "utf8")),
      );
    expect(ocorrencias).toEqual([]);
  });
});
