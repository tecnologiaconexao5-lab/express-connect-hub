const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

if (!code.includes('TrendingUp')) {
  console.log('TrendingUp not used');
}

// Ensure TrendingUp is in the import
if (code.includes('TrendingUp') && !code.match(/import\s+{[^}]*TrendingUp[^}]*}\s+from\s+['"]lucide-react['"]/)) {
  code = code.replace(/import { Calendar as CalendarIcon,([^}]*?)} from \"lucide-react\";/, 'import { Calendar as CalendarIcon, TrendingUp,$1} from "lucide-react";');
  fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
  console.log('Added TrendingUp to lucide-react import');
}
