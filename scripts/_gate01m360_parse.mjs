import fs from "node:fs";
const txt = fs.readFileSync("STATUS_CHECKLIST_CONEXAO_EXPRESS.txt", "utf8");
const lines = txt.split(/\r?\n/);
const out = { ts: new Date().toISOString(), regua: [], niveis: [], gaps: [], concluidos: 0, pendentes: 0 };

// tabela comparativa
for (const l of lines) {
  const m = l.match(/^\s*(NIVEL \d|E2E|M360)\s+(.+?)\s*\.{2,}\s*(.+?)\s*\.{2,}\s*(.+)$/);
  if (m) out.regua.push({ nivel: m[1].trim(), nome: m[2].trim(), antes: m[3].trim(), depois: m[4].trim() });
}
// cabecalhos de nivel + status
for (const l of lines) {
  const m = l.match(/^(NIVEL \d+ — [^\.]+?)\s*\.{2,}\s*(.+?)\s*$/);
  if (m) out.niveis.push({ titulo: m[1].trim(), status: m[2].trim() });
}
// itens marcados
for (const l of lines) {
  if (/~\[X\]/.test(l)) out.concluidos++;
  if (/^\s*\[ \]/.test(l)) out.pendentes++;
  if (/^\s*\[!\]/.test(l)) out.gaps.push(l.trim());
}
console.log("=== REGUA (tabela) ===");
for (const r of out.regua) console.log(`  ${r.nivel.padEnd(8)} ${r.nome.padEnd(34)} Antes=${r.antes.padEnd(15)} Depois=${r.depois}`);
console.log("\n=== CABECALHOS DE NIVEL ===");
for (const n of out.niveis) console.log(`  ${n.titulo} => ${n.status}`);
console.log("\n=== ITENS: concluidos=" + out.concluidos + " pendentes=" + out.pendentes + " gaps=" + out.gaps.length + " ===");
for (const g of out.gaps) console.log("  " + g);
fs.writeFileSync("scripts/_gate01m360_parse.json", JSON.stringify(out, null, 2));
console.log("\nEVIDENCIA: scripts/_gate01m360_parse.json");
