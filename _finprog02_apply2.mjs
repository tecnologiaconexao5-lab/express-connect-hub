import fs from "node:fs";
const R = [
  ["src/helpers/dashboardPrestadorHelper.ts", "repasse(s) da escala pendente(s) de processamento", "repasse(s) da programação pendente(s) de processamento"],
  ["src/components/financeiro/PagamentoPrestadores.tsx", 'tipo_lancamento: "Repasse Escala"', 'tipo_lancamento: "Repasse Programação"'],
];
let n=0;
for (const [f,from,to] of R) {
  let c = fs.readFileSync(f,"utf8");
  const k = c.split(from).length-1;
  if(k===0){ console.log("NOT_FOUND", f, from); continue; }
  fs.writeFileSync(f, c.split(from).join(to), "utf8");
  n+=k; console.log(`OK x${k}`, f);
}
console.log("extra replacements:", n);
