import fs from 'fs';
import path from 'path';

const filePath = path.join('src', 'components', 'ui', 'EnderecoCompleto.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Fix handleCepBlur to not overwrite with empty strings
content = content.replace(
  /const updated = \{ \.\.\.safeValue \};\s*updated\.cep = data\.cep \|\| cepInput;\s*updated\.logradouro = data\.logradouro \|\| "";\s*updated\.complemento = data\.complemento \|\| "";\s*updated\.bairro = data\.bairro \|\| "";\s*updated\.cidade = data\.localidade \|\| "";\s*updated\.estado = data\.uf \|\| "";/,
  `const updated = { ...safeValue };
        updated.cep = data.cep || cepInput;
        if (data.logradouro) updated.logradouro = data.logradouro;
        if (data.complemento) updated.complemento = data.complemento;
        if (data.bairro) updated.bairro = data.bairro;
        if (data.localidade) updated.cidade = data.localidade;
        if (data.uf) updated.estado = data.uf;
        
        if (!data.logradouro || !data.bairro) {
           toast.info("CEP geral ou incompleto. Preencha os campos ausentes.");
        }`
);

// Fix handleSelectSuggestion to not overwrite with empty strings
content = content.replace(
  /const updated: EnderecoType = \{\s*\.\.\.safeValue,\s*logradouro: dados\.logradouro,\s*numero: dados\.numero,\s*bairro: dados\.bairro,\s*cidade: dados\.cidade,\s*estado: dados\.estado,\s*cep: dados\.cep,/,
  `const updated: EnderecoType = {
      ...safeValue,
      logradouro: dados.logradouro || safeValue.logradouro,
      numero: dados.numero || safeValue.numero,
      bairro: dados.bairro || safeValue.bairro,
      cidade: dados.cidade || safeValue.cidade,
      estado: dados.estado || safeValue.estado,
      cep: dados.cep || safeValue.cep,`
);

fs.writeFileSync(filePath, content);
console.log('Fixed EnderecoCompleto.tsx');
