
import { gerarRelatorioBuffer, salvarRelatorioBufferStorage, FiltrosFaturamento } from './src/services/relatorios/relatorioService';

async function testReportStorage() {
  console.log('Starting report storage test...');

  const filtros: FiltrosFaturamento = {
    dataInicial: '2026-01-01',
    dataFinal: '2026-01-31',
  };

  try {
    console.log('Generating report buffer...');
    const resultadoBuffer = await gerarRelatorioBuffer('faturamento', filtros, 'Ambos');
    console.log(`Generated ${resultadoBuffer.totalArquivos} files.`);

    if (resultadoBuffer.totalArquivos === 0) {
      console.warn('No files generated. Cannot proceed with storage test.');
      return;
    }

    console.log('Saving report buffer to Supabase Storage...');
    const arquivosArmazenados = await salvarRelatorioBufferStorage(resultadoBuffer);

    console.log('Validation Results:');
    if (arquivosArmazenados.length === resultadoBuffer.totalArquivos) {
      console.log(`✅ Successfully saved ${arquivosArmazenados.length} files.`);
      arquivosArmazenados.forEach((file) => {
        console.log(`  - Nome: ${file.nome}, Path: ${file.path}, URL: ${file.url}`);
        if (!file.url.startsWith('http')) {
          throw new Error(`URL inválida para ${file.nome}: ${file.url}`);
        }
      });
    } else {
      console.error(`❌ Mismatch: Expected ${resultadoBuffer.totalArquivos} files, but saved ${arquivosArmazenados.length}.`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  console.log('Report storage test finished.');
}

testReportStorage();
