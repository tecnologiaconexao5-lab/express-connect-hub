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
  "Conexão Express — Rua Antonio Macedo, 45 - Parque São Jorge - São Paulo/SP — Representação gráfica do XML da NFS-e";

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
  const mun = [endereco.municipio, endereco.uf].filter(Boolean).join("/");
  return mun || "—";
}

const CSS_DANFSE = `
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111827;
    font-size: 8.5px;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .danfse-page {
    width: 190mm;
    min-height: 277mm;
    margin: 0 auto;
    position: relative;
    background: #fff;
  }
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
  .danfse-header {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1.4px solid #111827;
    padding: 8px 10px;
  }
  .danfse-logo-wrap { width: 48mm; display: flex; align-items: center; }
  .danfse-logo { height: 16mm; max-width: 46mm; object-fit: contain; }
  .danfse-title-block { flex: 1; text-align: center; }
  .danfse-title { font-size: 19px; font-weight: 800; letter-spacing: 0.5px; }
  .danfse-subtitle { font-size: 9px; font-weight: 600; margin-top: 2px; }
  .danfse-municipio { font-size: 8px; margin-top: 2px; }
  .danfse-qr { width: 37mm; display: flex; flex-direction: column; align-items: center; }
  .danfse-qr svg { width: 24mm; height: 24mm; }
  .danfse-qr-text { font-size: 5.8px; line-height: 1.2; text-align: center; margin-top: 2px; }
  .danfse-chave {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1.4px solid #111827;
    border-top: none;
    padding: 4px 8px;
  }
  .danfse-chave-label { font-size: 7px; font-weight: 800; letter-spacing: 0.3px; white-space: nowrap; }
  .danfse-chave-valor {
    font-family: "Courier New", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    word-break: break-all;
  }
  .danfse-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-left: 1.4px solid #111827;
    border-right: 1.4px solid #111827;
    border-top: 1.4px solid #111827;
  }
  .danfse-cell {
    border-bottom: 1px solid #111827;
    border-right: 1px solid #111827;
    padding: 3px 6px;
    min-height: 11mm;
  }
  .danfse-cell:nth-child(3n) { border-right: none; }
  .danfse-cell-label {
    font-size: 6.4px;
    text-transform: uppercase;
    color: #4b5563;
    font-weight: 700;
    letter-spacing: 0.25px;
  }
  .danfse-cell-value { font-size: 8.6px; font-weight: 600; margin-top: 1px; word-break: break-word; }
  .danfse-section { border: 1.4px solid #111827; border-top: none; page-break-inside: avoid; }
  .danfse-section-title {
    background: #f1f5f9;
    padding: 3px 8px;
    font-size: 7.6px;
    font-weight: 800;
    letter-spacing: 0.3px;
    border-bottom: 1px solid #111827;
  }
  .danfse-section-body { padding: 4px 8px; }
  .danfse-line { margin: 1.5px 0; font-size: 8.2px; }
  .danfse-line b { font-weight: 700; }
  .danfse-split { display: grid; grid-template-columns: 1fr 62mm; gap: 8px; }
  .danfse-regime {
    border-left: 1px solid #cbd5e1;
    padding-left: 8px;
    font-size: 8px;
  }
  .danfse-servico-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-bottom: 1px solid #111827;
  }
  .danfse-mini {
    padding: 3px 8px;
    border-right: 1px solid #111827;
  }
  .danfse-mini:last-child { border-right: none; }
  .danfse-mini-label {
    font-size: 6.4px;
    text-transform: uppercase;
    color: #4b5563;
    font-weight: 700;
    letter-spacing: 0.25px;
  }
  .danfse-mini-value { font-size: 8.6px; font-weight: 600; margin-top: 1px; }
  .danfse-descricao { padding: 4px 8px; min-height: 14mm; }
  .danfse-descricao-label {
    font-size: 6.4px;
    text-transform: uppercase;
    color: #4b5563;
    font-weight: 700;
    letter-spacing: 0.25px;
  }
  .danfse-descricao-texto { font-size: 8.4px; margin-top: 2px; }
  .danfse-trib-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: none;
  }
  .danfse-trib-grid .danfse-mini { border-bottom: 1px solid #111827; }
  .danfse-trib-grid .danfse-mini:nth-child(3n) { border-right: none; }
  .danfse-valores {
    display: grid;
    grid-template-columns: repeat(3, 1fr) 1.3fr;
  }
  .danfse-valor-box {
    padding: 4px 8px;
    border-right: 1px solid #111827;
  }
  .danfse-valor-box:last-child { border-right: none; }
  .danfse-valor-label {
    font-size: 6.4px;
    text-transform: uppercase;
    color: #4b5563;
    font-weight: 700;
    letter-spacing: 0.25px;
  }
  .danfse-valor-num { font-size: 9.4px; font-weight: 700; margin-top: 1px; }
  .danfse-liquido {
    padding: 4px 8px;
    background: #ecfdf5;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .danfse-liquido span {
    font-size: 6.6px;
    font-weight: 800;
    color: #065f46;
    letter-spacing: 0.2px;
  }
  .danfse-liquido strong { font-size: 11px; color: #065f46; margin-top: 1px; }
  .danfse-info-body { padding: 4px 8px; font-size: 7.6px; }
  .danfse-info-body p { margin: 0 0 2px; }
  .danfse-footer {
    margin-top: 4px;
    border-top: 1px solid #111827;
    padding-top: 3px;
    text-align: center;
    font-size: 6.8px;
    color: #4b5563;
  }
  @media print {
    html, body { width: 210mm; height: 297mm; }
    .danfse-page { width: auto; min-height: 0; margin: 0; page-break-after: avoid; }
    .danfse-watermark { position: fixed; }
  }
`;

function Celula({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="danfse-cell">
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
  const qrValor = dados.chaveAcesso
    ? `https://www.nfse.gov.br/consultapublica?chave=${encodeURIComponent(dados.chaveAcesso)}`
    : "https://www.nfse.gov.br/consultapublica";

  return (
    <div className="danfse-page">
      {rascunho && <div className="danfse-watermark">RASCUNHO — SEM VALOR FISCAL</div>}

      {/* CABEÇALHO */}
      <div className="danfse-header">
        <div className="danfse-logo-wrap">
          <img className="danfse-logo" src={dados.logoUrl} alt="Conexão Express" />
        </div>
        <div className="danfse-title-block">
          <div className="danfse-title">DANFSe v2.0</div>
          <div className="danfse-subtitle">Documento Auxiliar da NFS-e</div>
          <div className="danfse-municipio">
            Município: {dados.emitente.municipio} - {dados.emitente.uf}
          </div>
        </div>
        <div className="danfse-qr">
          <QRCodeSVG value={qrValor} size={92} level="M" />
          <div className="danfse-qr-text">
            A autenticidade desta NFS-e pode ser verificada pela leitura deste
            código QR ou pela consulta da chave de acesso no portal nacional da
            NFS-e.
          </div>
        </div>
      </div>

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
        <div className="danfse-section-body">
          <div className="danfse-split">
            <div>
              <div className="danfse-line">
                <b>Nome/Nome Empresarial:</b> {dados.emitente.nome}
              </div>
              <div className="danfse-line">
                <b>CNPJ:</b> {dados.emitente.cnpj}
                {"  "}
                <b>Inscrição Municipal:</b> {dados.emitente.inscricaoMunicipal}
              </div>
              <div className="danfse-line">
                <b>Endereço:</b> {dados.emitente.endereco}
              </div>
              <div className="danfse-line">
                <b>Município/UF:</b> {dados.emitente.municipio}/{dados.emitente.uf}
                {"  "}
                <b>CEP:</b> {dados.emitente.cep}
              </div>
            </div>
            <div className="danfse-regime">
              <b>Simples Nacional:</b>
              <br />
              {dados.emitente.regime}
            </div>
          </div>
        </div>
      </div>

      {/* TOMADOR */}
      <div className="danfse-section">
        <div className="danfse-section-title">TOMADOR / ADQUIRENTE</div>
        <div className="danfse-section-body">
          <div className="danfse-split">
            <div>
              <div className="danfse-line">
                <b>Nome/Razão Social:</b> {campo(dados.tomador.nome)}
              </div>
              <div className="danfse-line">
                <b>CNPJ:</b> {campo(dados.tomador.cnpj)}
              </div>
              <div className="danfse-line">
                <b>Endereço:</b> {enderecoLinha(dados.tomador.endereco)}
              </div>
            </div>
            <div className="danfse-regime">
              <div className="danfse-line">
                <b>Município/UF:</b> {enderecoMunicipio(dados.tomador.endereco)}
              </div>
              <div className="danfse-line">
                <b>CEP:</b> {campo(dados.tomador.endereco?.cep)}
              </div>
              <div className="danfse-line">
                <b>E-mail:</b> {campo(dados.tomador.email)}
              </div>
              <div className="danfse-line">
                <b>Telefone:</b> {campo(dados.tomador.telefone)}
              </div>
            </div>
          </div>
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
 * Abre uma janela limpa (about:blank), escreve a DANFSe e dispara a impressão
 * (o usuário pode escolher "Salvar como PDF"). Deve ser chamado no clique
 * para não ser bloqueado como pop-up.
 */
export function abrirImpressaoDanfse(dados: DanfsePrintDados): boolean {
  const janela = window.open("", "_blank", "width=900,height=1200");
  if (!janela) return false;

  const html = montarHtmlDanfse(dados);
  janela.document.open();
  janela.document.write(html);
  janela.document.close();

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

  return true;
}
