/**
 * Script de Auditoria - Comercial > CRM > Agenda
 * Valida se a aba Agenda está funcional
 */

import * as fs from 'fs';
import * as path from 'path';

interface ResultadoAuditoria {
  teste: string;
  status: 'PASSOU' | 'FALHOU' | 'AVISO';
  detalhes: string;
}

const resultados: ResultadoAuditoria[] = [];

function verificarArquivo(caminho: string, descricao: string): boolean {
  const existe = fs.existsSync(caminho);
  resultados.push({
    teste: `Arquivo existe: ${descricao}`,
    status: existe ? 'PASSOU' : 'FALHOU',
    detalhes: existe ? `Encontrado: ${caminho}` : `Não encontrado: ${caminho}`
  });
  return existe;
}

function verificarConteudo(caminho: string, padrao: RegExp, descricao: string): boolean {
  if (!fs.existsSync(caminho)) return false;
  
  const conteudo = fs.readFileSync(caminho, 'utf-8');
  const encontrado = padrao.test(conteudo);
  
  resultados.push({
    teste: `Conteúdo: ${descricao}`,
    status: encontrado ? 'PASSOU' : 'FALHOU',
    detalhes: encontrado ? `Padrão encontrado em ${path.basename(caminho)}` : `Padrão não encontrado em ${path.basename(caminho)}`
  });
  
  return encontrado;
}

function executarAuditoria() {
  console.log('🔍 Iniciando auditoria da Agenda Comercial...\n');
  
  const basePath = path.join(__dirname, '..', 'src', 'components', 'comercial', 'crm');
  
  // 1. Verificar arquivos principais
  console.log('📁 Verificando arquivos...');
  const crmBaseExiste = verificarArquivo(
    path.join(basePath, 'CrmBase.tsx'),
    'CrmBase.tsx'
  );
  
  const agendaExiste = verificarArquivo(
    path.join(basePath, 'AgendaComercial.tsx'),
    'AgendaComercial.tsx'
  );
  
  // 2. Verificar se a aba Agenda está declarada
  if (crmBaseExiste) {
    console.log('\n📋 Verificando aba Agenda...');
    verificarConteudo(
      path.join(basePath, 'CrmBase.tsx'),
      /atividades|Agenda/,
      'Aba Agenda declarada'
    );
    
    verificarConteudo(
      path.join(basePath, 'CrmBase.tsx'),
      /AgendaComercial/,
      'Componente AgendaComercial importado'
    );
    
    verificarConteudo(
      path.join(basePath, 'CrmBase.tsx'),
      /<TabsContent value="atividades"/,
      'TabsContent da Agenda configurado'
    );
  }
  
  // 3. Verificar componente AgendaComercial
  if (agendaExiste) {
    console.log('\n🎨 Verificando componente AgendaComercial...');
    
    verificarConteudo(
      path.join(basePath, 'AgendaComercial.tsx'),
      /AgendaComercial/,
      'Componente exportado'
    );
    
    verificarConteudo(
      path.join(basePath, 'AgendaComercial.tsx'),
      /Agendar Tarefa/,
      'Botão "Agendar Tarefa" presente'
    );
    
    verificarConteudo(
      path.join(basePath, 'AgendaComercial.tsx'),
      /Agenda Semanal/,
      'Seção "Agenda Semanal" presente'
    );
    
    verificarConteudo(
      path.join(basePath, 'AgendaComercial.tsx'),
      /Próximos Follow-ups/,
      'Seção "Próximos Follow-ups" presente'
    );
    
    verificarConteudo(
      path.join(basePath, 'AgendaComercial.tsx'),
      /CalendarDays/,
      'Ícone de calendário presente'
    );
  }
  
  // 4. Verificar se não há import morto
  console.log('\n🔍 Verificando imports...');
  if (crmBaseExiste) {
    verificarConteudo(
      path.join(basePath, 'CrmBase.tsx'),
      /import CrmAtividades/,
      'Import CrmAtividades (AVISO: deve ser removido)'
    );
  }
  
  // Resultado final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTADO DA AUDITORIA');
  console.log('='.repeat(60));
  
  const passou = resultados.filter(r => r.status === 'PASSOU').length;
  const falhou = resultados.filter(r => r.status === 'FALHOU').length;
  const aviso = resultados.filter(r => r.status === 'AVISO').length;
  
  resultados.forEach(r => {
    const icone = r.status === 'PASSOU' ? '✅' : r.status === 'FALHOU' ? '❌' : '⚠️';
    console.log(`${icone} ${r.teste}`);
    if (r.detalhes) console.log(`   ${r.detalhes}`);
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${resultados.length} | ✅ ${passou} | ❌ ${falhou} | ⚠️ ${aviso}`);
  console.log('-'.repeat(60));
  
  if (falhou === 0) {
    console.log('\n🎉 Auditoria concluída com sucesso! Agenda está funcional.');
  } else {
    console.log('\n⚠️ Auditoria encontrou problemas que precisam ser corrigidos.');
  }
}

executarAuditoria();
