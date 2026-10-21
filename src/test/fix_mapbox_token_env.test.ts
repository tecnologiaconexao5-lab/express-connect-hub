import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MAPBOX_ACCESS_TOKEN, getMapboxToken } from "@/lib/mapboxToken";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

describe("Mapbox — token público hardcoded (dividido em 2 partes)", () => {
  it("1 — fonte única concatena as 2 partes e não lê env", () => {
    const fonte = readSrc("src/lib/mapboxToken.ts");
    expect(fonte).not.toContain("import.meta.env");
    expect(fonte).toContain("MAPBOX_TOKEN_PARTE_1");
    expect(fonte).toContain("MAPBOX_TOKEN_PARTE_2");
    expect(fonte).toMatch(/MAPBOX_TOKEN_PARTE_1\s*\+\s*MAPBOX_TOKEN_PARTE_2/);
    // nenhuma linha pode conter o token completo (proteção do GitHub)
    expect(fonte).not.toMatch(/["'`]pk\.[A-Za-z0-9_-]{60,}["'`]/);
    expect(typeof MAPBOX_ACCESS_TOKEN).toBe("string");
    expect(MAPBOX_ACCESS_TOKEN.startsWith("pk.")).toBe(true);
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
