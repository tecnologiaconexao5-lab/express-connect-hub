// Auditoria read-only: detecta mojibake (UTF-8 duplo) e BOM nos arquivos da missão 02D.1
import { readFileSync, existsSync } from "node:fs";

const arquivos = [
  "src/services/recrutamentoIntegracao.ts",
  "src/services/documentosPrestadorService.ts",
  "src/components/prestadores/PrestadorDetalhe.tsx",
  "src/services/storage/storageRefService.ts",
  "src/services/documentos/documentoStorageService.ts",
  "src/services/portal-prestador/portalPrestadorService.ts",
  "src/services/recrutamento/conversaoCandidatoService.ts",
  "src/modules/recrutamento/services/conversaoCandidatoService.ts",
];

const OUT = { gerado_em: new Date().toISOString(), arquivos: [] };

for (const p of arquivos) {
  if (!existsSync(p)) {
    OUT.arquivos.push({ arquivo: p, existe: false });
    continue;
  }
  const buf = readFileSync(p);
  const temBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const utf8 = buf.toString("utf8");
  // Sequências típicas de mojibake (UTF-8 interpretado como Latin-1 e regravado)
  const padroes = {
    mojibake_c_cedilha: (utf8.match(/Ã§/g) || []).length,
    mojibake_a_til: (utf8.match(/Ã£/g) || []).length,
    mojibake_o_agudo: (utf8.match(/Ã³/g) || []).length,
    mojibake_e_agudo: (utf8.match(/Ã©/g) || []).length,
    mojibake_seta: (utf8.match(/â†’/g) || []).length,
    mojibake_traco: (utf8.match(/â€”/g) || []).length,
    utf8_invalido: (() => {
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(buf);
        return false;
      } catch {
        return true;
      }
    })(),
  };
  const totalMojibake = Object.entries(padroes)
    .filter(([k]) => k !== "utf8_invalido")
    .reduce((s, [, v]) => s + v, 0);
  OUT.arquivos.push({
    arquivo: p,
    existe: true,
    bytes: buf.length,
    tem_bom: temBom,
    utf8_invalido: padroes.utf8_invalido,
    mojibake_total: totalMojibake,
    detalhe: padroes,
    amostra: utf8.split("\n").slice(0, 3).join(" | ").slice(0, 200),
  });
}

console.log(JSON.stringify(OUT, null, 2));
