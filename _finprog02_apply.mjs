import fs from "node:fs";

const R = [
  // [file, from, to]
  ["src/lib/sidebarData.ts", 'title: "Escala"', 'title: "Programação Operacional"'],
  ["src/pages/Operacao.tsx", "Escala Operacional", "Programação Operacional"],
  ["src/pages/PortalCliente.tsx", 'label: "Escala"', 'label: "Programação Operacional"'],
  ["src/components/dashboard/DashboardTopbar.tsx", "Nova Alocação (Ir para Escala)", "Nova Alocação (Ir para Programação Operacional)"],
  ["src/components/dashboard/TabOperacional.tsx", "/>Escalas</p>", "/>Programação Operacional</p>"],

  ["src/components/operacao/EscalaLista.tsx", '"Escala gerada automaticamente com IA!"', '"Programação gerada automaticamente com IA!"'],
  ["src/components/operacao/EscalaLista.tsx", "Escala de Operação", "Programação Operacional"],
  ["src/components/operacao/EscalaLista.tsx", "Gerar Escala", "Gerar Programação"],
  ["src/components/operacao/EscalaLista.tsx", "Indicadores da Escala", "Indicadores da Programação"],
  ["src/components/operacao/EscalaLista.tsx", "Gráficos da Escala", "Gráficos da Programação"],
  ["src/components/operacao/EscalaLista.tsx", "Registros da escala integrado ao pátio.", "Registros da programação integrado ao pátio."],

  ["src/components/operacao/escala/PrestadorFilters.tsx", "Filtrar Escala por Prestador", "Filtrar Programação por Prestador"],
  ["src/components/operacao/escala/PrestadorFilters.tsx", 'placeholder="Prestador na escala..."', 'placeholder="Prestador na programação..."'],
  ["src/components/operacao/escala/PrestadorFilters.tsx", "Filtrar Escala por Cliente", "Filtrar Programação por Cliente"],
  ["src/components/operacao/escala/PrestadorFilters.tsx", 'placeholder="Cliente na escala..."', 'placeholder="Cliente na programação..."'],
  ["src/components/operacao/escala/AlocacaoCancelamentoModal.tsx", "removida da escala, relatórios e financeiro.", "removida da programação, relatórios e financeiro."],

  ["src/components/operacao/OrdensServicoLista.tsx", 'label: "Sem Escala"', 'label: "Sem Programação"'],
  ["src/components/operacao/OrdensServicoLista.tsx", "{vinculosCount.escalas} escala(s) vinculada(s)", "{vinculosCount.escalas} programação(ões) vinculada(s)"],
  ["src/components/operacao/KmEvidenciasPanel.tsx", 'label="Data da escala"', 'label="Data da programação"'],
  ["src/components/operacao/statusGlobal.ts", "OS criada, em análise de precificação/escala", "OS criada, em análise de precificação/programação"],
  ["src/components/operacao/statusGlobal.ts", "Prestador alocado na escala", "Prestador alocado na programação"],

  ["src/components/operacao/OrdemServicoForm.tsx", 'label: "Escala", detail: escalaLabel', 'label: "Programação", detail: escalaLabel'],
  ["src/components/operacao/OrdemServicoForm.tsx", '`Escala ${acaoLabel} para OS ${data.numero}`', '`Programação ${acaoLabel} para OS ${data.numero}`'],
  ["src/components/operacao/OrdemServicoForm.tsx", '`Escala não atualizada: ${resultadoEscala.erro}`', '`Programação não atualizada: ${resultadoEscala.erro}`'],
  ["src/components/operacao/OrdemServicoForm.tsx", '`Erro ao sincronizar escala: ${e.message}`', '`Erro ao sincronizar programação: ${e.message}`'],
  ["src/components/operacao/OrdemServicoForm.tsx", 'label="Escala"', 'label="Programação"'],

  ["src/pages/IntegracoesTMS.tsx", "toast.success('Escala removida')", "toast.success('Programação removida')"],
  ["src/pages/IntegracoesTMS.tsx", "/> Escala Operacional</CardTitle>", "/> Programação Operacional</CardTitle>"],
  ["src/pages/IntegracoesTMS.tsx", "<p>Nenhuma escala cadastrada.</p>", "<p>Nenhuma programação cadastrada.</p>"],

  ["src/components/portal-cliente/PortalEscalaOperacional.tsx", ">Escala Operacional</h2>", ">Programação Operacional</h2>"],
  ["src/components/portal-cliente/PortalEscalaOperacional.tsx", "ver a escala operacional.", "ver a programação operacional."],
  ["src/components/portal-cliente/PortalEscalaOperacional.tsx", "Nenhum registro de escala para o período", "Nenhum registro de programação para o período"],

  ["src/components/torre-controle/DetalhesOperacaoSheet.tsx", '{ value: "alocacao", label: "Escala", icon: Truck }', '{ value: "alocacao", label: "Programação", icon: Truck }'],
  ["src/components/torre-controle/DetalhesOperacaoSheet.tsx", 'label="Status Escala"', 'label="Status Programação"'],
  ["src/components/torre-controle/DetalhesOperacaoSheet.tsx", ">Data Escala</p>", ">Data Programação</p>"],

  ["src/components/financeiro/PagamentoPrestadores.tsx", '<SelectItem value="escala">Escala</SelectItem>', '<SelectItem value="escala">Programação</SelectItem>'],
  ["src/components/financeiro/PagamentoPrestadores.tsx", "Repasses da Escala</TabsTrigger>", "Repasses da Programação</TabsTrigger>"],
  ["src/components/financeiro/PagamentoPrestadores.tsx", "? 'Escala' : p.origem_lancamento", "? 'Programação' : p.origem_lancamento"],
  ["src/components/financeiro/PagamentoPrestadores.tsx", ">Repasses da Escala Operacional</CardTitle>", ">Repasses da Programação Operacional</CardTitle>"],
  ["src/components/financeiro/PagamentoPrestadores.tsx", "Dados preparados da escala — ainda não processados como pagamento", "Dados preparados da programação — ainda não processados como pagamento"],
  ["src/components/financeiro/PagamentoPrestadores.tsx", "Origem: Escala Operacional", "Origem: Programação Operacional"],
  ["src/components/financeiro/PagamentoPrestadores.tsx", "Carregando dados da Escala...", "Carregando dados da Programação..."],
  ["src/components/financeiro/PagamentoPrestadores.tsx", "Nenhum repasse pendente da Escala Operacional", "Nenhum repasse pendente da Programação Operacional"],
  ["src/components/financeiro/PagamentoPrestadores.tsx", "Total em repasses da Escala:", "Total em repasses da Programação:"],
  ["src/components/financeiro/PagamentoPrestadores.tsx", "? 'Escala' : op.tipoOrigem === 'ordem_servico'", "? 'Programação' : op.tipoOrigem === 'ordem_servico'"],

  ["src/components/financeiro/ContasReceberEnterprise.tsx", ">Escala</Badge>", ">Programação</Badge>"],
  ["src/components/financeiro/ContasReceberEnterprise.tsx", "Faturamento Potencial da Escala</CardTitle>", "Faturamento Potencial da Programação</CardTitle>"],
  ["src/components/financeiro/ContasReceberEnterprise.tsx", "Dados preparados da escala — ainda não lançados como recebível", "Dados preparados da programação — ainda não lançados como recebível"],
  ["src/components/financeiro/ContasReceberEnterprise.tsx", "Origem: Escala Operacional", "Origem: Programação Operacional"],
  ["src/components/financeiro/ContasReceberEnterprise.tsx", "a partir da Escala/OS foi descontinuada", "a partir da Programação/OS foi descontinuada"],
  ["src/components/financeiro/ContasReceberEnterprise.tsx", "Carregando dados da Escala...", "Carregando dados da Programação..."],
  ["src/components/financeiro/ContasReceberEnterprise.tsx", "Nenhum faturamento pendente da Escala Operacional", "Nenhum faturamento pendente da Programação Operacional"],

  ["src/components/financeiro/ConferenciaFinanceira.tsx", "(mesma fonte da Escala).", "(mesma fonte da Programação Operacional)."],
  ["src/components/financeiro/ConferenciaFinanceira.tsx", "(OS/Escala).", "(OS/Programação)."],
  ["src/components/financeiro/ConferenciaFinanceira.tsx", "mesma fonte da Escala/TMS", "mesma fonte da Programação Operacional/TMS"],
  ["src/components/financeiro/ConferenciaFinanceira.tsx", "Serviço lançado com sucesso na Escala (fonte única).", "Serviço lançado com sucesso na Programação Operacional (fonte única)."],
  ["src/components/financeiro/ConferenciaFinanceira.tsx", "mesma fonte da Escala — sem base paralela", "mesma fonte da Programação Operacional — sem base paralela"],
  ["src/components/financeiro/ConferenciaFinanceira.tsx", "(mesma lógica da Escala)", "(mesma lógica da Programação Operacional)"],
  ["src/components/financeiro/ConferenciaFinanceira.tsx", "a cobrança ao cliente segue a regra da Escala", "a cobrança ao cliente segue a regra da Programação Operacional"],
  ["src/components/financeiro/ConferenciaFinanceira.tsx", "conforme a regra já homologada da Escala", "conforme a regra já homologada da Programação Operacional"],
  ["src/components/financeiro/ConferenciaFinanceira.tsx", "(mesma fonte da Escala) e, quando há cliente", "(mesma fonte da Programação Operacional) e, quando há cliente"],
  ["src/components/financeiro/ConferenciaFinanceira.tsx", "(mesmo fluxo da Escala).", "(mesmo fluxo da Programação Operacional)."],

  ["src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx", "'Removido da shortlist operacional (Escala)'", "'Removido da shortlist operacional (Programação Operacional)'"],
  ["src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx", "'Enviado para shortlist operacional (Escala)'", "'Enviado para shortlist operacional (Programação Operacional)'"],
  ["src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx", "'Removido da Escala' : 'Enviado para Escala'", "'Removido da Programação' : 'Enviado para Programação'"],
  ["src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx", "'Erro ao enviar para Escala'", "'Erro ao enviar para Programação'"],
  ["src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx", "'Mostrando reservas' : 'Reservas Escala'", "'Mostrando reservas' : 'Reservas Programação'"],
  ["src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx", "Remover da Escala</>", "Remover da Programação</>"],
  ["src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx", "Enviar para Escala</>", "Enviar para Programação</>"],
  ["src/modules/recrutamento/components/enterprise-kanban/PrestadoresAptos.tsx", "                    Enviado para Escala", "                    Enviado para Programação"],
  ["src/modules/recrutamento/index.tsx", "prontos para alocação na Escala/Torre", "prontos para alocação na Programação Operacional/Torre"],
  ["src/hooks/usePrestadoresAptosRecrutamento.ts", "return 'Enviado p/ Escala'", "return 'Enviado p/ Programação'"],

  ["src/components/comprovantes/EntregasComprovantes.tsx", "alocações/escala vinculadas", "alocações/programação vinculadas"],
  ["src/utils/pdfRelatorioOperacional.ts", "dados reais da escala operacional", "dados reais da programação operacional"],
  ["src/lib/pdf/consolidatedReports.ts", "dados reais da escala operacional", "dados reais da programação operacional"],
  ["src/pages/Configuracoes.tsx", "Operador - Operação + OS + Escala", "Operador - Operação + OS + Programação Operacional"],
  ["src/helpers/clienteReferencias.ts", 'label: "Escala/Alocações"', 'label: "Programação Operacional/Alocações"'],
  ["src/services/ordemServicoService.ts", 'mensagem: "OS atualizada a partir da Escala"', 'mensagem: "OS atualizada a partir da Programação Operacional"'],

  ["src/services/financeiro/extratoPrestadorService.ts", "`Escala ${esc.os_numero}` : 'Escala do período'", "`Programação ${esc.os_numero}` : 'Programação do período'"],
  ["src/services/financeiro/extratoPrestadorService.ts", "? 'Escala'\n        : tipoFiltro === 'manual'", "? 'Programação'\n        : tipoFiltro === 'manual'"],
  ["src/services/financeiro/receberService.ts", "serviços da escala.", "serviços da programação."],
  ["src/services/financeiro/receberService.ts", "Erro ao buscar escala faturamento", "Erro ao buscar programação faturamento"],
];

const report = [];
const cache = new Map();
let totalRepl = 0;
let problems = 0;

for (const [file, from, to] of R) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(file, "utf8"));
  let content = cache.get(file);
  const count = content.split(from).length - 1;
  if (count === 0) {
    report.push(`NOT_FOUND | ${file} | ${JSON.stringify(from)}`);
    problems++;
    continue;
  }
  content = content.split(from).join(to);
  cache.set(file, content);
  totalRepl += count;
  report.push(`OK x${count} | ${file} | ${JSON.stringify(from)}`);
}

for (const [file, content] of cache) fs.writeFileSync(file, content, "utf8");

console.log(report.join("\n"));
console.log(`\nFiles touched: ${cache.size} | replacements: ${totalRepl} | NOT_FOUND: ${problems}`);
