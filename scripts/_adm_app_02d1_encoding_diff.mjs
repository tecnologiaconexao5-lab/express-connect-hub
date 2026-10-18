// Read-only: compara HEAD vs working tree de recrutamentoIntegracao.ts
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const head = execSync("git show HEAD:src/services/recrutamentoIntegracao.ts", {
  maxBuffer: 10 * 1024 * 1024,
});
const wt = readFileSync("src/services/recrutamentoIntegracao.ts");

const info = (buf, rotulo) => ({
  rotulo,
  bytes: buf.length,
  bom: buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf,
  temServico: buf.toString("utf8").includes("Serviço"),
  temMojibake: (buf.toString("utf8").match(/Ã§|â†’/g) || []).length,
});

const s = wt.toString("utf8");
console.log(
  JSON.stringify(
    {
      head: info(head, "HEAD"),
      working_tree: info(wt, "WORKING_TREE"),
      wt_funcional: {
        referenciaEstavelDocumento: s.includes("referenciaEstavelDocumento"),
        recrutamento_candidatos: s.includes('.from("recrutamento_candidatos")'),
        liberado_app_false: /liberado_app:\s*false/.test(s),
        from_candidatos_writes: (s.match(/\.from\(["']candidatos["']\)/g) || []).length,
      },
    },
    null,
    2,
  ),
);
