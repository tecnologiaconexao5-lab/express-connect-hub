// Abre o relatorio no Bloco de Notas usando child_process (spawn).
const { spawn } = require("node:child_process");
const path = require("node:path");

const arquivo = path.resolve(__dirname, "..", "RELATORIO_UX_ATUALIZADA.txt");
const child = spawn("notepad.exe", [arquivo], { detached: true, stdio: "ignore" });
child.unref();
console.log(`Relatorio aberto no Notepad: ${arquivo}`);
