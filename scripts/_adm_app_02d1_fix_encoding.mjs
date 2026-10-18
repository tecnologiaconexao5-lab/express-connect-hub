// FIX (escrita): restaura o encoding de recrutamentoIntegracao.ts.
// A causa: UTF-8 original foi decodificado como CP1252 e regravado como UTF-8 (mojibake)
// + BOM adicionado. A inversa exata é: utf8_decode -> cp1252_encode.
// Read-only validado antes; este script NÃO altera nenhum outro arquivo.
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";

const ARQUIVO = "src/services/recrutamentoIntegracao.ts";
const BACKUP = "scripts/_adm_app_02d1_recrutamentoIntegracao.corrompido.bak";

// Tabela CP1252 0x80-0x9F (índice = byte)
const CP1252_80_9F = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};
const CP1252_TO_BYTE = new Map();
for (const [byte, cp] of Object.entries(CP1252_80_9F)) CP1252_TO_BYTE.set(cp, Number(byte));

function cp1252Encode(str) {
  const out = [];
  const naoRepresentaveis = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.charCodeAt(i);
    if (cp <= 0x7f || (cp >= 0xa0 && cp <= 0xff)) {
      out.push(cp);
    } else if (CP1252_TO_BYTE.has(cp)) {
      out.push(CP1252_TO_BYTE.get(cp));
    } else if (cp === 0xfeff) {
      // BOM tratado pelo chamador
      naoRepresentaveis.push({ i, cp, ch: str[i] });
    } else {
      naoRepresentaveis.push({ i, cp, ch: str[i] });
      out.push(0x3f); // '?' — sinalizado na validação
    }
  }
  return { buf: Buffer.from(out), naoRepresentaveis };
}

const original = readFileSync(ARQUIVO);
copyFileSync(ARQUIVO, BACKUP);

let texto = original.toString("utf8");
if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);

const { buf, naoRepresentaveis } = cp1252Encode(texto);

// ---- validação estrita ----
const decodificado = buf.toString("utf8");
const checks = {
  utf8_valido: (() => {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
      return true;
    } catch {
      return false;
    }
  })(),
  sem_bom: !(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf),
  sem_mojibake: !/Ã§|Ã£|Ã©|â†’|â€”|ï»¿/.test(decodificado),
  tem_servico: decodificado.includes("Serviço"),
  tem_referenciaEstavelDocumento: decodificado.includes("referenciaEstavelDocumento"),
  tem_recrutamento_candidatos: decodificado.includes('.from("recrutamento_candidatos")'),
  tem_liberado_app_false: /liberado_app:\s*false/.test(decodificado),
  zero_from_candidatos: (decodificado.match(/\.from\(["']candidatos["']\)/g) || []).length === 0,
  chars_nao_representaveis: naoRepresentaveis,
};

const falhas = Object.entries(checks).filter(
  ([k, v]) => k !== "chars_nao_representaveis" && v !== true,
);

console.log(JSON.stringify({ checks, bytes_antes: original.length, bytes_depois: buf.length }, null, 2));

if (falhas.length > 0 || naoRepresentaveis.length > 0) {
  console.error("VALIDACAO FALHOU — nada foi escrito.");
  process.exit(1);
}

writeFileSync(ARQUIVO, buf, { encoding: "binary" });
console.log("OK — encoding restaurado. Backup em " + BACKUP);
