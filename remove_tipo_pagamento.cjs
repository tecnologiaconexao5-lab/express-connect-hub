const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// The select query might have it
code = code.replace(', valor_km, tipo_pagamento")', ', valor_km")');
code = code.replace(', valor_km, tipo_pagamento" )', ', valor_km")');

// Also the mapping: `tipo_pagamento: p.tipo_pagamento,`
code = code.replace('tipo_pagamento: p.tipo_pagamento,', 'tipo_pagamento: "pix",');

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
