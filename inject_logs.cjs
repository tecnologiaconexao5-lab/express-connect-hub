const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// 2. No filtro do campo prestador
code = code.replace(
  '{showPrestadorDropdown && filtroPrestadorModal.length > 0 && (\\n                       <div className="absolute top-full',
  `{showPrestadorDropdown && filtroPrestadorModal.length > 0 && (() => {
                         const filtrados = prestadores.filter(p => (p.nome || '').toLowerCase().includes(filtroPrestadorModal.toLowerCase()) || (p.placa && p.placa.toLowerCase().includes(filtroPrestadorModal.toLowerCase())) || (p.veiculo && p.veiculo.toLowerCase().includes(filtroPrestadorModal.toLowerCase())));
                         console.log('[DEBUG] Filtro Prestador:', filtroPrestadorModal, '| Total Memoria:', prestadores.length, '| Filtrados:', filtrados.length);
                         return (
                       <div className="absolute top-full`
);

// We must find the closing div of the dropdown to invoke the IIFE.
// Actually, it's easier to just insert the console log before the input?
// No, the user wants it inside the filter. Let's just hook the input's onChange!
code = code.replace(
  'setFiltroPrestadorModal(e.target.value);',
  `setFiltroPrestadorModal(e.target.value);
                          const filtrados = prestadores.filter(p => (p.nome || '').toLowerCase().includes(e.target.value.toLowerCase()) || (p.placa && p.placa.toLowerCase().includes(e.target.value.toLowerCase())) || (p.veiculo && p.veiculo.toLowerCase().includes(e.target.value.toLowerCase())));
                          console.log('[DEBUG] Input alterado:', e.target.value, '| Total Memoria:', prestadores.length, '| Filtrados:', filtrados.length);`
);

// 3. Ao selecionar prestador
code = code.replace(
  'setFiltroPrestadorModal(p.nome);',
  `setFiltroPrestadorModal(p.nome);
                                console.log('[DEBUG] Prestador Selecionado - id:', p.id, '| nome:', p.nome, '| veiculo:', p.veiculo, '| placa:', p.placa);`
);

// 4. Na busca da tabela
code = code.replace(
  'const nomeNormalizado = normalizeClienteNome(clienteNome);',
  `const nomeNormalizado = normalizeClienteNome(clienteNome);
      console.log('[DEBUG] Buscando tabela - cliente_id:', clienteId, '| nome_cliente:', clienteNome, '| nome_normalizado:', nomeNormalizado, '| tipo_veiculo:', tipoVeiculo);`
);

code = code.replace(
  '.ilike("tipo_veiculo", tipoVeiculo);',
  `.ilike("tipo_veiculo", tipoVeiculo);
      console.log('[DEBUG] Resultado Supabase tabelas_valores:', specificData, specificError);`
);

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Injected remaining logs');
