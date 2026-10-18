const fs = require("fs");
const path = require("path");
const p = "C:\\Users\\DIEGO BALBINO\\Desktop\\Pasta Compartilhada\\DOCUMENTOS EMPRESA\\08_TECNOLOGIA_SISTEMAS\\express-connect-hub\\scripts\\audit_production_full.mjs";
let c = fs.readFileSync(p, "utf8");
// Replace the broken query (missing $1) 
c = c.replace(
  "proname = \"",
  "proname = $1\""
);
fs.writeFileSync(p, c, "utf8");
console.log("Fixed: $1 restored");
