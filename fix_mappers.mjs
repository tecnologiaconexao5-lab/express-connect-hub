import fs from 'fs';
import path from 'path';

const filePath = path.join('src', 'lib', 'dbMappers.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace veiculo_placa with placa_alocada
content = content.replace(/d\.veiculo_placa = s\(form\.veiculoPlaca\);/g, 'd.placa_alocada = s(form.veiculoPlaca);');

// Comment out missing columns mapping
content = content.replace(/if \(has\(form\.responsavel\)\) d\.responsavel = s\(form\.responsavel\);/g, '// if (has(form.responsavel)) d.responsavel = s(form.responsavel); // TODO: Add column');
content = content.replace(/if \(has\(form\.refCliente\)\) d\.ref_cliente = s\(form\.refCliente\);/g, '// if (has(form.refCliente)) d.ref_cliente = s(form.refCliente); // TODO: Add column');
content = content.replace(/if \(has\(form\.pedidoInterno\)\) d\.pedido_interno = s\(form\.pedidoInterno\);/g, '// if (has(form.pedidoInterno)) d.pedido_interno = s(form.pedidoInterno); // TODO: Add column');
content = content.replace(/if \(has\(form\.slaOperacao\)\) d\.sla_operacao = s\(form\.slaOperacao\);/g, '// if (has(form.slaOperacao)) d.sla_operacao = s(form.slaOperacao); // TODO: Add column');
content = content.replace(/if \(has\(form\.pedidoInterno\)\) d\.pedido_interno = form\.pedidoInterno;/g, '// if (has(form.pedidoInterno)) d.pedido_interno = form.pedidoInterno; // TODO: Add column');

fs.writeFileSync(filePath, content);
console.log('Fixed dbMappers.ts');
