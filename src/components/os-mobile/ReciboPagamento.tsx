// ============================================================
// OS MOBILE — Recibo de pagamento profissional
// Prévia em tela + PDF A4 (jsPDF) com CNPJ, endereço, valor por
// extenso, recebedor, forma de pagamento, observações e assinatura.
// ============================================================

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, Printer, X, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  montarPDFRecibo,
  valorPorExtenso,
  type DadosPDFRecibo,
  type Recibo,
} from "@/services/financeiro/reciboService";
import { carregarLogoBase64Utils } from "@/utils/pdfGenerator";
import type { DadosEmpresaFatura } from "@/services/financeiro/faturaService";
import type { OSMobileLista } from "@/services/mobile/osMobileService";

interface Props {
  open: boolean;
  onClose: () => void;
  os: OSMobileLista | null;
  empresa: DadosEmpresaFatura | null;
}

type TipoRecibo = "cliente" | "prestador";

const fmtBRL = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (iso?: string | null) => {
  if (!iso) return "—";
  const data = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString("pt-BR");
};

const fmtDataHora = (iso?: string | null) => {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const formasPagamento = [
  "À vista",
  "PIX",
  "Transferência bancária",
  "Faturado",
  "Dinheiro",
  "Cartão",
];

function montarRecibo(
  os: OSMobileLista,
  tipo: TipoRecibo,
  empresa: DadosEmpresaFatura | null,
  formaPagamento: string,
  observacoes: string,
): Recibo {
  const hoje = new Date().toISOString().split("T")[0];
  const numeroOs = os.numero || os.id;
  const favorecidoNome =
    tipo === "cliente"
      ? empresa?.nomeFantasia || empresa?.razaoSocial || "Conexão Express"
      : os.prestadorNome || "Prestador avulso";
  const valor = tipo === "cliente" ? os.valorCliente : os.custoPrestador;
  const referencia =
    tipo === "cliente"
      ? `Serviços de transporte referente à OS ${numeroOs}`
      : `Repasse de serviço referente à OS ${numeroOs}`;

  return {
    id: "",
    numero: `REC-MOB-${numeroOs}`,
    data_emissao: hoje,
    favorecido_tipo: tipo === "cliente" ? "empresa" : "prestador",
    favorecido_nome: favorecidoNome,
    favorecido_documento: tipo === "cliente" ? empresa?.cnpj || null : null,
    valor: Math.round(valor * 100) / 100,
    valor_extenso: valorPorExtenso(valor),
    referencia,
    forma_pagamento: formaPagamento,
    conta_financeira: empresa?.banco
      ? `${empresa.banco}${empresa.agencia ? ` · Ag. ${empresa.agencia}` : ""}${empresa.conta ? ` · Cc. ${empresa.conta}` : ""}`
      : null,
    os_numero: numeroOs,
    observacoes: [
      os.clienteNome ? `Cliente: ${os.clienteNome}.` : "",
      os.fechamento?.recebedor ? `Recebedor da entrega: ${os.fechamento.recebedor}.` : "",
      os.fechamento?.documento ? `Documento: ${os.fechamento.documento}.` : "",
      os.fechamento?.local ? `Local: ${os.fechamento.local}.` : "",
      os.fechamento?.dataHoraEntrega
        ? `Entrega em ${fmtDataHora(os.fechamento.dataHoraEntrega)}.`
        : "",
      observacoes.trim(),
    ]
      .filter(Boolean)
      .join(" "),
    status: "emitido",
    motivo_cancelamento: null,
    data_cancelamento: null,
    usuario_criador: "os-mobile",
    usuario_cancelou: null,
    created_at: new Date().toISOString(),
  };
}

export default function ReciboPagamento({ open, onClose, os, empresa }: Props) {
  const [tipo, setTipo] = useState<TipoRecibo>("cliente");
  const [formaPagamento, setFormaPagamento] = useState("À vista");
  const [observacoes, setObservacoes] = useState("");
  const [gerando, setGerando] = useState(false);

  const recibo = useMemo(
    () => (os ? montarRecibo(os, tipo, empresa, formaPagamento, observacoes) : null),
    [os, tipo, empresa, formaPagamento, observacoes],
  );

  const montarEmpresaPdf = async (): Promise<DadosPDFRecibo> => {
    const logoUrl = await carregarLogoBase64Utils();
    return {
      logoUrl,
      razaoSocial: empresa?.razaoSocial || empresa?.nomeFantasia || "Conexão Express",
      nomeFantasia: empresa?.nomeFantasia || empresa?.razaoSocial || "Conexão Express",
      cnpj: empresa?.cnpj || "",
      endereco: empresa?.endereco || "",
      cidade: empresa?.cidade || "",
      uf: empresa?.uf || "",
    };
  };

  const baixarPdf = async () => {
    if (!recibo) return;
    setGerando(true);
    try {
      const empresaPdf = await montarEmpresaPdf();
      const doc = montarPDFRecibo(
        recibo,
        empresaPdf,
        os?.prestadorNome || os?.fechamento?.recebedor || empresaPdf.nomeFantasia,
      );
      doc.save(`Recibo_${os?.numero || os?.id || "OS"}.pdf`);
      toast.success("Recibo em PDF gerado");
    } catch (error) {
      toast.error("Não foi possível gerar o recibo", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setGerando(false);
    }
  };

  const abrirImpressao = async () => {
    if (!recibo) return;
    setGerando(true);
    try {
      const empresaPdf = await montarEmpresaPdf();
      const doc = montarPDFRecibo(
        recibo,
        empresaPdf,
        os?.prestadorNome || os?.fechamento?.recebedor || empresaPdf.nomeFantasia,
      );
      const url = doc.output("bloburl");
      window.open(url as unknown as string, "_blank");
    } catch (error) {
      toast.error("Não foi possível abrir o PDF para impressão", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setGerando(false);
    }
  };

  if (!os || !recibo) return null;

  const recebedorEntrega = os.fechamento?.recebedor || os.recebedorNome || "—";
  const documentoEntrega = os.fechamento?.documento || os.recebedorDocumento || "—";
  const localEntrega = os.fechamento?.local || "—";
  const dataEntrega = os.fechamento?.dataHoraEntrega || null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[96vw] max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="sticky top-0 z-10 flex flex-row items-center justify-between gap-3 border-b bg-white px-4 py-3 space-y-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-orange-600" />
            Recibo de Pagamento
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar recibo">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4 bg-slate-100 p-3 sm:p-6">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={tipo === "cliente" ? "default" : "outline"}
              className={tipo === "cliente" ? "bg-orange-600 hover:bg-orange-700" : ""}
              onClick={() => setTipo("cliente")}
            >
              Recibo do Cliente
            </Button>
            <Button
              type="button"
              variant={tipo === "prestador" ? "default" : "outline"}
              className={tipo === "prestador" ? "bg-orange-600 hover:bg-orange-700" : ""}
              onClick={() => setTipo("prestador")}
            >
              Recibo do Prestador
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-black text-orange-400">
                  CE
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-900">
                    {empresa?.nomeFantasia || empresa?.razaoSocial || "Conexão Express"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {empresa?.razaoSocial || empresa?.nomeFantasia || "Conexão Express"}
                  </p>
                  {empresa?.cnpj && (
                    <p className="text-[11px] text-slate-500">CNPJ: {empresa.cnpj}</p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    {[empresa?.endereco, empresa?.cidade, empresa?.uf].filter(Boolean).join(" · ") ||
                      "Endereço não configurado"}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xl font-black tracking-wide text-slate-900">RECIBO</p>
                <p className="text-[11px] font-semibold text-orange-600">Nº {recibo.numero}</p>
                <p className="text-[11px] text-slate-500">Emissão: {fmtData(recibo.data_emissao)}</p>
                <Badge variant="outline" className="mt-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Documento de pagamento
                </Badge>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{fmtBRL(recibo.valor)}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                {recibo.valor_extenso}
              </p>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-700">
              Recebemos de <strong>{tipo === "cliente" ? os.clienteNome || "Cliente" : empresa?.nomeFantasia || empresa?.razaoSocial || "Conexão Express"}</strong>{" "}
              a importância de <strong>{fmtBRL(recibo.valor)}</strong> ({recibo.valor_extenso}),
              referente a <strong>{recibo.referencia}</strong>.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Favorecido / Recebedor do valor</p>
                <p className="text-sm font-semibold text-slate-800">{recibo.favorecido_nome}</p>
                {recibo.favorecido_documento && (
                  <p className="text-[11px] text-slate-500">Doc.: {recibo.favorecido_documento}</p>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Forma de pagamento</p>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
                >
                  {formasPagamento.map((forma) => (
                    <option key={forma} value={forma}>
                      {forma}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Recebedor da entrega</p>
                <p className="text-sm font-semibold text-slate-800">{recebedorEntrega}</p>
                <p className="text-[11px] text-slate-500">Doc.: {documentoEntrega}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Local / Data da entrega</p>
                <p className="text-sm font-semibold text-slate-800">{localEntrega}</p>
                <p className="text-[11px] text-slate-500">{dataEntrega ? fmtDataHora(dataEntrega) : "—"}</p>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">OS / Rota</p>
              <p className="text-sm font-semibold text-slate-800">{os.numero || os.id}</p>
              <p className="text-[11px] text-slate-500">
                {[os.origem, os.destino].filter(Boolean).join(" → ") || "Rota não informada"}
                {os.distanciaKm > 0 ? ` · ${os.distanciaKm.toLocaleString("pt-BR")} km` : ""}
              </p>
            </div>

            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Observações</p>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                placeholder="Observações adicionais do recibo (opcional)"
                className="mt-1 w-full rounded-md border border-slate-200 p-2 text-sm text-slate-700"
              />
            </div>

            <div className="mt-10 flex flex-col items-center">
              <div className="h-px w-64 bg-slate-400" />
              <p className="mt-2 text-xs font-semibold text-slate-700">
                {tipo === "prestador"
                  ? os.prestadorNome || "Prestador / Recebedor"
                  : empresa?.razaoSocial || empresa?.nomeFantasia || "Conexão Express"}
              </p>
              <p className="text-[10px] text-slate-500">Assinatura e carimbo</p>
            </div>

            <p className="mt-6 text-center text-[10px] text-slate-400">
              Documento gerado pelo OS Mobile em {new Date().toLocaleString("pt-BR")} · {recibo.numero}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              onClick={abrirImpressao}
              disabled={gerando}
              className="h-11 bg-slate-900 text-white hover:bg-slate-800"
            >
              <Printer className="mr-2 h-4 w-4" />
              {gerando ? "Preparando..." : "Abrir / Imprimir PDF"}
            </Button>
            <Button
              type="button"
              onClick={baixarPdf}
              disabled={gerando}
              className="h-11 bg-orange-600 text-white hover:bg-orange-700"
            >
              <FileDown className="mr-2 h-4 w-4" />
              {gerando ? "Gerando..." : "Baixar PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
