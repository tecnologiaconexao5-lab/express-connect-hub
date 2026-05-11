// PDF Mínimo para Orçamento
export interface OrcamentoPDFData {
  numero: string;
  cliente: string;
  cnpj?: string;
  data: string;
  validade: string;
  valorTotal: number;
  descricao?: string;
}

export function gerarPDFOrcamento(data: OrcamentoPDFData): string {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Orçamento ${data.numero}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px; }
    .info { margin: 10px 0; }
    .info strong { display: inline-block; width: 120px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background-color: #28a745; color: white; }
    .valor { text-align: right; font-weight: bold; }
    .total { font-size: 18px; background-color: #f8f9fa; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <h1>📄 Orçamento</h1>
  <div class="info"><strong>Nº Orçamento:</strong> ${data.numero}</div>
  <div class="info"><strong>Cliente:</strong> ${data.cliente || "-"}</div>
  <div class="info"><strong>CNPJ:</strong> ${data.cnpj || "-"}</div>
  <div class="info"><strong>Data Emissão:</strong> ${data.data}</div>
  <div class="info"><strong>Validade:</strong> ${data.validade}</div>
  ${data.descricao ? `<div class="info"><strong>Descrição:</strong> ${data.descricao}</div>` : ""}
  
  <table>
    <tr><th>Item</th><th class="valor">Valor</th></tr>
    <tr><td>Valor Total do Orçamento</td><td class="valor total">${fmt(data.valorTotal)}</td></tr>
  </table>
  
  <div class="footer">
    <p>Gerado por TMS Conexão Express em ${new Date().toLocaleString("pt-BR")}</p>
  </div>
</body>
</html>
  `;
  
  return html;
}

export function imprimirOrcamento(data: OrcamentoPDFData): void {
  const html = gerarPDFOrcamento(data);
  const win = window.open("", "PDF", "width=800,height=600");
  if (win) {
    win.document.write(html);
    win.document.close();
    win.print();
  }
}

export function baixarPDFOrcamento(data: OrcamentoPDFData): void {
  const html = gerarPDFOrcamento(data);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Orcamento_${data.numero}.html`;
  link.click();
}