import fs from 'fs';
import path from 'path';

const filePath = path.join('src', 'lib', 'dbMappers.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the generic `enderecos` assignment with a standardized mapping
const blockToReplace = `if ((form as any).enderecos) (d as any).enderecos = (form as any).enderecos;`;
const replacementBlock = `if ((form as any).enderecos) {
    (d as any).enderecos = ((form as any).enderecos).map((e: any) => ({
      tipo: e.tipo || "coleta",
      cep: e.cep || "",
      logradouro: e.logradouro || "",
      numero: e.numero || "",
      complemento: e.complemento || "",
      bairro: e.bairro || "",
      cidade: e.cidade || "",
      estado: e.estado || "",
      uf: e.estado || "",
      referencia: e.referencia || e.instrucoes || "",
      nomeLocal: e.nomeLocal || "",
      nome_local: e.nomeLocal || "",
      responsavel: e.responsavel || "",
      telefone: e.telefone || "",
      email: e.email || "",
      enviarWhatsApp: e.enviarWhatsApp || false,
      canal: e.enviarWhatsApp ? "whatsapp" : "email",
      janelaInicio: e.janelaInicio || "",
      janela_inicio: e.janelaInicio || "",
      janelaFim: e.janelaFim || "",
      janela_fim: e.janelaFim || "",
      observacaoPonto: e.observacaoPonto || "",
      observacao: e.observacaoPonto || "",
      latitude: e.latitude || null,
      longitude: e.longitude || null,
      endereco: e.endereco || ""
    }));
  }`;

// This block might appear twice (in toOSInsert and toOSUpdate)
content = content.replace(blockToReplace, replacementBlock);
content = content.replace(blockToReplace, replacementBlock);

fs.writeFileSync(filePath, content);
console.log('Fixed dbMappers.ts addresses mapping');
