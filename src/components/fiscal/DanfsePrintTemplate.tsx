/* eslint-disable react-refresh/only-export-components */
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";

export interface DanfseEndereco {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface DanfseTomador {
  nome: string;
  cnpj: string;
  email?: string | null;
  telefone?: string | null;
  endereco?: DanfseEndereco | null;
}

export interface DanfseEmitente {
  nome: string;
  cnpj: string;
  inscricaoMunicipal: string;
  endereco: string;
  municipio: string;
  uf: string;
  cep: string;
  regime: string;
}

export interface DanfsePrintDados {
  logoUrl: string;
  numero: string;
  chaveAcesso: string;
  competencia: string;
  emissao: string;
  numeroDps: string;
  serieDps: string;
  situacao: string;
  statusCodigo: string;
  /** Ambiente da emissão: "homologacao"/"producao" ou tpAmb ("1"/"2"). */
  ambiente?: string | null;
  emitente: DanfseEmitente;
  tomador: DanfseTomador;
  servico: {
    descricao: string;
    codigoTributacao: string;
    codigoNbs: string;
    localPrestacao: string;
  };
  tributacao: {
    municipioIncidencia: string;
    issRetido: boolean;
    baseCalculo: number;
    aliquota: number;
    issqn: number;
    pisCofinsCsll: number;
    irrf: number;
    ibsCbs: number;
    totalRetencoes: number;
  };
  valores: {
    servico: number;
    desconto: number;
    liquido: number;
  };
  observacoes: string;
}

const LEI_12741 =
  "Valor aproximado dos tributos incidentes conforme a Lei nº 12.741/2012.";

export const TEXTO_RODAPE_DANFSE =
  "Conexão Express • Financeiro: financeiro@conexaoexpress.com.br • www.conexaoexpress.com.br • Representação gráfica do XML da NFS-e";

function moeda(valor: number): string {
  return (Number.isFinite(valor) ? valor : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function percentual(valor: number): string {
  return (Number.isFinite(valor) ? valor : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + "%";
}

function campo(valor?: string | null): string {
  return valor && String(valor).trim() ? String(valor) : "—";
}

function enderecoLinha(endereco?: DanfseEndereco | null): string {
  if (!endereco) return "—";
  const partes = [
    endereco.logradouro,
    endereco.numero,
    endereco.complemento,
    endereco.bairro,
  ].filter(Boolean);
  return partes.length ? partes.join(", ") : "—";
}

function enderecoMunicipio(endereco?: DanfseEndereco | null): string {
  if (!endereco) return "—";
  return [endereco.municipio, endereco.uf].filter(Boolean).join("/") || "—";
}

const CSS_DANFSE = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #0F172A;
    font-size: 9px;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .danfse-page {
    width: 210mm;
    min-height: 297mm;
    padding: 12mm;
    margin: 0 auto;
    position: relative;
    background: #fff;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .danfse-content { flex: 0 0 auto; }
  .danfse-footer { flex: 0 0 auto; }

  .danfse-watermark {
    position: absolute;
    top: 48%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-24deg);
    font-size: 40px;
    font-weight: 800;
    letter-spacing: 3px;
    color: rgba(220, 38, 38, 0.13);
    white-space: nowrap;
    z-index: 0;
    pointer-events: none;
  }
  .danfse-page > *:not(.danfse-watermark) { position: relative; z-index: 1; }

  .danfse-homolog {
    background: #FEF3C7;
    border: 1px solid #F59E0B;
    color: #92400E;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    text-align: center;
    padding: 3px 8px;
    border-radius: 4px;
    margin-bottom: 5px;
  }

  .danfse-header {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #CBD5E1;
    border-radius: 4px;
    padding: 6px 10px;
  }
  .danfse-logo-wrap { flex: 0 0 auto; display: flex; align-items: center; }
  .danfse-logo {
    width: 260px;
    max-height: 92px;
    height: auto;
    object-fit: contain;
    display: block;
  }
  .danfse-title-block { flex: 1; text-align: center; }
  .danfse-title { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
  .danfse-subtitle { font-size: 9px; font-weight: 600; margin-top: 2px; }
  .danfse-municipio { font-size: 8px; margin-top: 2px; color: #475569; }
  .danfse-qr {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    width: auto;
  }
  .danfse-qr svg { width: 68px; height: 68px; flex: 0 0 auto; }
  .danfse-qr-text {
    font-size: 7.5px;
    line-height: 1.3;
    text-align: right;
    max-width: 135px;
    color: #475569;
  }

  .danfse-divider {
    height: 3px;
    background: #F97316;
    margin: 5px 0;
    border-radius: 1px;
  }

  .danfse-chave {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #CBD5E1;
    border-radius: 4px;
    padding: 6px 10px;
    margin-top: 5px;
  }
  .danfse-chave-label {
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.3px;
    color: #64748B;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .danfse-chave-valor {
    font-family: "Courier New", monospace;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.6px;
    word-break: break-all;
  }

  .danfse-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: 1px solid #CBD5E1;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 5px;
  }
  .danfse-grid-20 {
    display: grid;
    grid-template-columns: repeat(20, 1fr);
    border: 1px solid #CBD5E1;
    border-radius: 4px;
    overflow: hidden;
  }
  .span-14 { grid-column: span 14; }
  .span-11 { grid-column: span 11; }
  .span-10 { grid-column: span 10; }
  .span-6 { grid-column: span 6; }
  .span-5 { grid-column: span 5; }
  .span-4 { grid-column: span 4; }
  .danfse-cell {
    border-right: 1px solid #CBD5E1;
    border-bottom: 1px solid #CBD5E1;
    padding: 4px 6px;
    min-height: 9mm;
  }
  .danfse-grid .danfse-cell:nth-child(3n) { border-right: none; }
  .danfse-grid .danfse-cell:nth-last-child(-n+3) { border-bottom: none; }
  .danfse-grid-20 .danfse-cell { border-right: 1px solid #CBD5E1; }
  .danfse-grid-20 .danfse-cell.span-6,
  .danfse-grid-20 .danfse-cell.span-4,
  .danfse-grid-20 .danfse-cell:last-child { border-right: none; }
  .danfse-grid-20 .danfse-cell:nth-last-child(-n+2) { border-bottom: none; }
  .danfse-cell-label {
    font-size: 8.5px;
    text-transform: uppercase;
    color: #64748B;
    font-weight: 700;
    letter-spacing: 0.25px;
  }
  .danfse-cell-value {
    font-size: 10.5px;
    font-weight: 600;
    color: #0F172A;
    margin-top: 1px;
    word-break: break-word;
  }

  .danfse-section {
    border: 1px solid #CBD5E1;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 5px;
    page-break-inside: avoid;
  }
  .danfse-section-title {
    background: #3B1E6D;
    color: #fff;
    border-left: 4px solid #F97316;
    padding: 3px 8px;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .danfse-servico-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
  .danfse-mini {
    padding: 4px 6px;
    border-right: 1px solid #CBD5E1;
    border-bottom: 1px solid #CBD5E1;
    min-height: 9mm;
  }
  .danfse-servico-grid .danfse-mini:nth-child(3n) { border-right: none; }
  .danfse-servico-grid .danfse-mini { border-bottom: none; }
  .danfse-trib-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
  .danfse-trib-grid .danfse-mini:nth-child(3n) { border-right: none; }
  .danfse-trib-grid .danfse-mini:nth-last-child(-n+3) { border-bottom: none; }
  .danfse-mini-label {
    font-size: 8.5px;
    text-transform: uppercase;
    color: #64748B;
    font-weight: 700;
    letter-spacing: 0.25px;
  }
  .danfse-mini-value {
    font-size: 10.5px;
    font-weight: 600;
    color: #0F172A;
    margin-top: 1px;
  }
  .danfse-descricao { padding: 4px 8px; min-height: 11mm; }
  .danfse-descricao-label {
    font-size: 8.5px;
    text-transform: uppercase;
    color: #64748B;
    font-weight: 700;
    letter-spacing: 0.25px;
  }
  .danfse-descricao-texto { font-size: 10.5px; font-weight: 600; margin-top: 1px; }

  .danfse-valores {
    display: grid;
    grid-template-columns: repeat(3, 1fr) 1.35fr;
  }
  .danfse-valor-box {
    padding: 5px 8px;
    border-right: 1px solid #CBD5E1;
  }
  .danfse-valor-label {
    font-size: 8.5px;
    text-transform: uppercase;
    color: #64748B;
    font-weight: 700;
    letter-spacing: 0.25px;
  }
  .danfse-valor-num {
    font-size: 10.5px;
    font-weight: 600;
    color: #0F172A;
    margin-top: 1px;
  }
  .danfse-liquido {
    margin: 3px;
    padding: 5px 8px;
    background: #FFF7ED;
    border: 1px solid #F97316;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .danfse-liquido span {
    font-size: 8px;
    font-weight: 800;
    color: #9A3412;
    letter-spacing: 0.2px;
    text-transform: uppercase;
  }
  .danfse-liquido strong { font-size: 13px; color: #7C2D12; margin-top: 1px; }

  .danfse-info-body { padding: 4px 8px; font-size: 8.5px; color: #334155; }
  .danfse-info-body p { margin: 0 0 2px; }
  .danfse-footer {
    background: #F97316;
    color: #FFFFFF;
    padding: 6px 12mm;
    font-size: 8px;
    text-align: center;
    font-weight: 500;
    line-height: 1.3;
    margin: 0 -12mm -12mm;
    width: calc(100% + 24mm);
    page-break-inside: avoid;
  }
  @media print {
    html, body { width: 210mm; height: 297mm; }
    .danfse-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0;
      padding: 12mm;
      page-break-after: avoid;
    }
    .danfse-watermark { position: fixed; }
  }
`;

function Celula(
  { rotulo, valor, className }: {
    rotulo: string;
    valor: string;
    className?: string;
  },
) {
  return (
    <div className={"danfse-cell " + (className || "")}>
      <div className="danfse-cell-label">{rotulo}</div>
      <div className="danfse-cell-value">{valor}</div>
    </div>
  );
}

function Mini({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="danfse-mini">
      <div className="danfse-mini-label">{rotulo}</div>
      <div className="danfse-mini-value">{valor}</div>
    </div>
  );
}

export function DanfsePrintTemplate({ dados }: { dados: DanfsePrintDados }) {
  const rascunho = String(dados.statusCodigo || "").toLowerCase() === "rascunho";
  const ambienteTexto = String(dados.ambiente || "").toLowerCase();
  // tpAmb = 2 ou ambiente "homologacao"/"homologação" → aviso sem valor fiscal.
  const homologacao = ambienteTexto === "2" || ambienteTexto.includes("homolog");
  const qrValor = dados.chaveAcesso
    ? `https://www.nfse.gov.br/consultapublica?chave=${encodeURIComponent(dados.chaveAcesso)}`
    : "https://www.nfse.gov.br/consultapublica";

  return (
    <div className="danfse-page">
      {rascunho && <div className="danfse-watermark">RASCUNHO — SEM VALOR FISCAL</div>}

      <div className="danfse-content">
        {homologacao && (
          <div className="danfse-homolog">
            AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
          </div>
        )}

        {/* CABEÇALHO */}
      <div className="danfse-header">
        <div className="danfse-logo-wrap">
          <img className="danfse-logo" src={dados.logoUrl} alt="Logo do emitente" />
        </div>
        <div className="danfse-title-block">
          <div className="danfse-title">DANFSe v2.0</div>
          <div className="danfse-subtitle">Documento Auxiliar da NFS-e</div>
          <div className="danfse-municipio">
            Município: {dados.emitente.municipio} - {dados.emitente.uf}
          </div>
        </div>
        <div className="danfse-qr">
          <div className="danfse-qr-text">
            A autenticidade desta NFS-e pode ser verificada pela leitura deste
            código QR ou pela consulta da chave de acesso no portal nacional da
            NFS-e.
          </div>
          <QRCodeSVG value={qrValor} size={68} level="M" />
        </div>
      </div>

      <div className="danfse-divider" />

      {/* CHAVE */}
      <div className="danfse-chave">
        <span className="danfse-chave-label">CHAVE DE ACESSO DA NFS-e</span>
        <span className="danfse-chave-valor">{dados.chaveAcesso || "—"}</span>
      </div>

      {/* IDENTIFICAÇÃO */}
      <div className="danfse-grid">
        <Celula rotulo="Número da NFS-e" valor={dados.numero} />
        <Celula rotulo="Competência" valor={dados.competencia} />
        <Celula rotulo="Emissão da NFS-e" valor={dados.emissao} />
        <Celula rotulo="Número / Série da DPS" valor={`${dados.numeroDps} / ${dados.serieDps}`} />
        <Celula rotulo="Situação" valor={dados.situacao} />
        <Celula rotulo="Emitente (Prestador)" valor={dados.emitente.nome} />
      </div>

      {/* PRESTADOR */}
      <div className="danfse-section">
        <div className="danfse-section-title">PRESTADOR / FORNECEDOR</div>
        <div className="danfse-grid-20">
          <Celula className="span-14" rotulo="Nome/Nome Empresarial" valor={dados.emitente.nome} />
          <Celula className="span-6" rotulo="CNPJ" valor={dados.emitente.cnpj} />
          <Celula className="span-11" rotulo="Endereço" valor={dados.emitente.endereco} />
          <Celula className="span-5" rotulo="Município/UF" valor={`${dados.emitente.municipio}/${dados.emitente.uf}`} />
          <Celula className="span-4" rotulo="CEP" valor={dados.emitente.cep} />
          <Celula className="span-10" rotulo="Inscrição Municipal" valor={dados.emitente.inscricaoMunicipal} />
          <Celula className="span-10" rotulo="Simples Nacional" valor={dados.emitente.regime} />
        </div>
      </div>

      {/* TOMADOR */}
      <div className="danfse-section">
        <div className="danfse-section-title">TOMADOR / ADQUIRENTE</div>
        <div className="danfse-grid-20">
          <Celula className="span-14" rotulo="Nome/Razão Social" valor={campo(dados.tomador.nome)} />
          <Celula className="span-6" rotulo="CNPJ" valor={campo(dados.tomador.cnpj)} />
          <Celula className="span-11" rotulo="Endereço" valor={enderecoLinha(dados.tomador.endereco)} />
          <Celula className="span-5" rotulo="Município/UF" valor={enderecoMunicipio(dados.tomador.endereco)} />
          <Celula className="span-4" rotulo="CEP" valor={campo(dados.tomador.endereco?.cep)} />
          <Celula className="span-10" rotulo="E-mail" valor={campo(dados.tomador.email)} />
          <Celula className="span-10" rotulo="Telefone" valor={campo(dados.tomador.telefone)} />
        </div>
      </div>

      {/* SERVIÇO */}
      <div className="danfse-section">
        <div className="danfse-section-title">SERVIÇO PRESTADO</div>
        <div className="danfse-servico-grid">
          <Mini rotulo="Cód. Tributação Nacional/Municipal" valor={dados.servico.codigoTributacao} />
          <Mini rotulo="Código NBS" valor={dados.servico.codigoNbs} />
          <Mini rotulo="Local da Prestação" valor={dados.servico.localPrestacao} />
        </div>
        <div className="danfse-descricao">
          <div className="danfse-descricao-label">Descrição do Serviço</div>
          <div className="danfse-descricao-texto">{campo(dados.servico.descricao)}</div>
        </div>
      </div>

      {/* TRIBUTAÇÃO */}
      <div className="danfse-section">
        <div className="danfse-section-title">TRIBUTAÇÃO</div>
        <div className="danfse-trib-grid">
          <Mini rotulo="ISSQN - Tipo de Tributação" valor="Operação Tributável" />
          <Mini rotulo="Município de Incidência" valor={dados.tributacao.municipioIncidencia} />
          <Mini rotulo="Retenção ISSQN" valor={dados.tributacao.issRetido ? "Retido" : "Não Retido"} />
          <Mini rotulo="BC ISSQN" valor={moeda(dados.tributacao.baseCalculo)} />
          <Mini rotulo="Alíquota" valor={percentual(dados.tributacao.aliquota)} />
          <Mini rotulo="ISSQN Apurado" valor={moeda(dados.tributacao.issqn)} />
          <Mini rotulo="PIS/COFINS/CSLL" valor={moeda(dados.tributacao.pisCofinsCsll)} />
          <Mini rotulo="IRRF" valor={moeda(dados.tributacao.irrf)} />
          <Mini rotulo="IBS/CBS Total" valor={moeda(dados.tributacao.ibsCbs)} />
        </div>
      </div>

      {/* VALORES */}
      <div className="danfse-section">
        <div className="danfse-section-title">VALOR TOTAL DA NFS-e</div>
        <div className="danfse-valores">
          <div className="danfse-valor-box">
            <div className="danfse-valor-label">Valor do Serviço</div>
            <div className="danfse-valor-num">{moeda(dados.valores.servico)}</div>
          </div>
          <div className="danfse-valor-box">
            <div className="danfse-valor-label">Descontos</div>
            <div className="danfse-valor-num">{moeda(dados.valores.desconto)}</div>
          </div>
          <div className="danfse-valor-box">
            <div className="danfse-valor-label">Total Retenções</div>
            <div className="danfse-valor-num">{moeda(dados.tributacao.totalRetencoes)}</div>
          </div>
          <div className="danfse-liquido">
            <span>VALOR LÍQUIDO DA NFS-e</span>
            <strong>{moeda(dados.valores.liquido)}</strong>
          </div>
        </div>
      </div>

      {/* INFORMAÇÕES COMPLEMENTARES */}
      <div className="danfse-section">
        <div className="danfse-section-title">INFORMAÇÕES COMPLEMENTARES</div>
        <div className="danfse-info-body">
          <p>{LEI_12741}</p>
          {dados.observacoes ? <p>{dados.observacoes}</p> : null}
        </div>
      </div>

      </div>

      <footer className="danfse-footer">{TEXTO_RODAPE_DANFSE}</footer>
    </div>
  );
}

/** HTML standalone da DANFSe (sem Tailwind, pronto para janela de impressão). */
export function montarHtmlDanfse(dados: DanfsePrintDados): string {
  const corpo = renderToStaticMarkup(<DanfsePrintTemplate dados={dados} />);
  const titulo = String(dados.numero || "").replace(/[<>&"]/g, "");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DANFSe ${titulo}</title>
  <style>${CSS_DANFSE}</style>
</head>
<body>${corpo}</body>
</html>`;
}

/**
 * Abre uma janela limpa via Blob URL, escreve a DANFSe e
 * dispara a impressão (o usuário pode escolher "Salvar como PDF").
 */
export function abrirImpressaoDanfse(dados: DanfsePrintDados): boolean {
  const html = montarHtmlDanfse(dados);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const janela = window.open(url, "_blank", "width=900,height=1200");
  if (!janela) {
    URL.revokeObjectURL(url);
    return false;
  }

  let disparado = false;
  const imprimir = function() {
    if (disparado) return;
    disparado = true;
    try {
      janela.focus();
      janela.print();
    } catch {
      // Mantém a janela aberta; o usuário pode usar Ctrl+P.
    }
  };

  janela.onload = function() { setTimeout(imprimir, 300); };
  setTimeout(imprimir, 1200);
  setTimeout(function() { URL.revokeObjectURL(url); }, 60000);

  return true;
}
