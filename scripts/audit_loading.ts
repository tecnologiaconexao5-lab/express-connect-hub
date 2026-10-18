import fs from "fs";
import path from "path";

function walk(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!filePath.includes("node_modules") && !filePath.includes(".git") && !filePath.includes("dist")) {
        walk(filePath, fileList);
      }
    } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = walk("./src");

let animateSpinCount = 0;
let loaderCount = 0;
let loader2Count = 0;
let carregandoCount = 0;
let aguardeCount = 0;

const filesWithLoading = new Set<string>();
interface FileStat {
  relPath: string;
  spinMatches: number;
  l2Matches: number;
  lMatches: number;
  cMatches: number;
  aMatches: number;
  snippets: string[];
}
const statsByFile: FileStat[] = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf8");
  const relPath = path.relative(".", file).replace(/\\/g, "/");

  const spinMatches = (content.match(/animate-spin/g) || []).length;
  const l2Matches = (content.match(/\bLoader2\b/g) || []).length;
  const lMatches = (content.match(/\bLoader\b/g) || []).length;
  const cMatches = (content.match(/Carregando/gi) || []).length;
  const aMatches = (content.match(/Aguarde/gi) || []).length;

  if (spinMatches || l2Matches || lMatches || cMatches || aMatches) {
    filesWithLoading.add(relPath);
    animateSpinCount += spinMatches;
    loader2Count += l2Matches;
    loaderCount += lMatches;
    carregandoCount += cMatches;
    aguardeCount += aMatches;
    
    // grab lines with animate-spin or Loader2 or Carregando
    const lines = content.split("\n");
    const snippets: string[] = [];
    lines.forEach((line, idx) => {
      if (/animate-spin|\bLoader2\b|Carregando|Aguarde/i.test(line)) {
        snippets.push(`L${idx + 1}: ${line.trim()}`);
      }
    });

    statsByFile.push({ relPath, spinMatches, l2Matches, lMatches, cMatches, aMatches, snippets });
  }
}

console.log("Total TS/TSX files examined:", allFiles.length);
console.log("Files with loading occurrences:", filesWithLoading.size);
console.log("animate-spin total matches:", animateSpinCount);
console.log("Loader2 total matches:", loader2Count);
console.log("Loader total matches:", loaderCount);
console.log("Carregando matches:", carregandoCount);
console.log("Aguarde matches:", aguardeCount);

fs.writeFileSync("temp_loading_audit.json", JSON.stringify({
  totalExamined: allFiles.length,
  filesWithLoadingCount: filesWithLoading.size,
  animateSpinCount,
  loader2Count,
  loaderCount,
  carregandoCount,
  aguardeCount,
  statsByFile
}, null, 2));
