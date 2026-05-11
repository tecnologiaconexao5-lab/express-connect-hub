// PDF Mínimo para Ordem de Serviço
// Pode ser usado com jsPDF ou react-pdf
export interface OSPDFData {
  numero: string;
  cliente: string;
  prestador: string;
  data: string;
  valorCliente: number;
  valorPrestador: number;
  pedagio: number;
  impostos: number;
  margemBruta: number;
  margemLiquida: number;
}

export function gerarPDFOS(data: OSPDFData): string {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OS ${data.numero}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    .info { margin: 10px 0; }
    .info strong { display: inline-block; width: 120px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background-color: #007bff; color: white; }
    .valor { text-align: right; font-weight: bold; }
    .negativo { color: #dc3545; }
    .positivo { color: #28a745; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <h1>📋 Ordem de Serviço</h1>
  <div class="info"><strong>Nº OS:</strong> ${data.numero}</div>
  <div class="info"><strong>Data:</strong> ${data.data}</div>
  <div class="info"><strong>Cliente:</strong> ${data.cliente || "-"}</div>
  <div class="info"><strong>Prestador:</strong> ${data.prestador || "-"}</div>
  
  <table>
    <tr><th>Descrição</th><th class="valor">Valor</th></tr>
    <tr><td>Valor Cliente</td><td class="valor positivo">${fmt(data.valorCliente)}</td></tr>
    <tr><td>Valor Prestador</td><td class="valor negativo">-${fmt(data.valorPrestador)}</td></tr>
    <tr><td>Pedágio</td><td class="valor negativo">-${fmt(data.pedagio)}</td></tr>
    <tr><td>Impostos</td><td class="valor negativo">-${fmt(data.impostos)}</td></tr>
    <tr><td><strong>Margem Bruta</strong></td><td class="valor ${data.margemBruta >= 0 ? "positivo" : "negativo"}"><strong>${fmt(data.margemBruta)}</strong></td></tr>
    <tr><td><strong>Margem Líquida</strong></td><td class="valor ${data.margemLiquida >= 0 ? "positivo" : "negativo"}"><strong>${fmt(data.margemLiquida)}</strong></td></tr>
  </table>
  
  <div class="footer">
    <p>Gerado por TMS Conexão Express em ${new Date().toLocaleString("pt-BR")}</p>
  </div>
</body>
</html>
  `;
  
  // Retornar HTML que pode ser impresso/convertido
  return html;
}

export function imprimirOS(data: OSPDFData): void {
  const html = gerarPDFOS(data);
  const win = window.open("", "PDF", "width=800,height=600");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.print();
  }
}

export function baixarPDFOS(data: OSPDFData): void {
  const html = gerarPDFOS(data);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `OS_${data.numero}.html`;
  link.click();
}