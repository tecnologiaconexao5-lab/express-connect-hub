import { useState, useEffect } from "react";
import { FileText, Trash2, LinkIcon, Loader2, MapPin, Pencil, FilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { parseEnderecoParaFormulario } from "@/services/fiscal/romaneioCalvoService";
import { gerarRascunhoCteAvulso, type GerarCteAvulsoInput } from "@/services/fiscal/cteService";
import type { FiscalDocumentoVinculado, EnderecoRealEntrega } from "@/types/fiscal";

interface XmlImportadosListProps {
  refreshKey?: number;
  onVincular?: (doc: FiscalDocumentoVinculado) => void;
}

const emptyEndereco: EnderecoRealEntrega = {
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  municipio: "",
  uf: "",
  cep: "",
  codigo_ibge: "",
};

export default function XmlImportadosList({ refreshKey, onVincular }: XmlImportadosListProps) {
  const [docs, setDocs] = useState<FiscalDocumentoVinculado[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDoc, setEditingDoc] = useState<FiscalDocumentoVinculado | null>(null);
  const [formEndereco, setFormEndereco] = useState<EnderecoRealEntrega>({ ...emptyEndereco });
  const [savingEndereco, setSavingEndereco] = useState(false);
  const [gerarCteDoc, setGerarCteDoc] = useState<FiscalDocumentoVinculado | null>(null);
  const [valorFrete, setValorFrete] = useState("");
  const [gerandoCte, setGerandoCte] = useState(false);

  useEffect(() => {
    fetchDocs();
  }, [refreshKey]);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("fiscal_documentos_vinculados")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setDocs((data || []) as FiscalDocumentoVinculado[]);
    } catch (err: any) {
      toast.error(`Erro ao buscar XMLs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("fiscal_documentos_vinculados")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("XML removido.");
      fetchDocs();
    } catch (err: any) {
      toast.error(`Erro ao remover: ${err.message}`);
    }
  };

  const handleOpenEditarEndereco = (doc: FiscalDocumentoVinculado) => {
    const meta = doc.metadata || {};
    // REGRA CALVO: nunca usar endereco fiscal do XML como endereco real automatico
    const atual = meta.endereco_real_entrega || {};
    const fonte = meta.fonte_endereco_entrega || "xml";
    const confirmado = meta.pendente_conferencia_endereco === false && atual.municipio;

    // Verificar se os campos individuais parecem validos
    const logrOk = atual.logradouro && atual.logradouro.length >= 5 && !/^[A-Z]{2}$/.test(atual.logradouro.trim());
    const muniOk = atual.municipio && atual.municipio.length >= 3 && atual.municipio.toUpperCase() !== "SP";
    const ufOk = atual.uf && /^[A-Z]{2}$/.test(atual.uf);

    // So preencher campos se endereco veio do romaneio ou foi confirmado manualmente
    if ((fonte === "romaneio" || fonte === "manual" || fonte === "romaneio_manual") && logrOk && muniOk && ufOk) {
      setFormEndereco({
        logradouro: atual.logradouro || "",
        numero: atual.numero || "",
        complemento: atual.complemento || "",
        bairro: atual.bairro || "",
        municipio: atual.municipio || "",
        uf: atual.uf || "SP",
        cep: atual.cep || "",
        codigo_ibge: atual.codigo_ibge || "",
      });
    } else {
      // Deixar campos vazios — operador preenche manualmente
      // Se houver dados parciais do romaneio, tentar parse
      const textoDisponivel = [
        atual.logradouro || "",
        atual.numero ? `, ${atual.numero}` : "",
        atual.bairro ? `, ${atual.bairro}` : "",
        atual.municipio ? `, ${atual.municipio}` : "",
        atual.uf ? `/${atual.uf}` : "",
        atual.cep ? ` CEP ${atual.cep}` : "",
      ].filter(Boolean).join(" ");

      if (textoDisponivel && textoDisponivel.length > 10 && (fonte === "romaneio" || fonte === "manual" || fonte === "romaneio_manual")) {
        const parsed = parseEnderecoParaFormulario(textoDisponivel);
        if (parsed.logradouro && parsed.municipio) {
          setFormEndereco({
            logradouro: parsed.logradouro,
            numero: parsed.numero,
            complemento: "",
            bairro: parsed.bairro,
            municipio: parsed.municipio,
            uf: parsed.uf || "SP",
            cep: parsed.cep,
            codigo_ibge: atual.codigo_ibge || "",
          });
        } else {
          setFormEndereco({ ...emptyEndereco, uf: "SP" });
        }
      } else {
        setFormEndereco({ ...emptyEndereco, uf: "SP" });
      }
    }

    setEditingDoc(doc);
  };

  const handleSalvarEndereco = async () => {
    if (!editingDoc) return;

    // Validacao completa
    if (!formEndereco.municipio || formEndereco.municipio.length < 3) {
      toast.error("Municipio deve ter pelo menos 3 letras."); return;
    }
    if (formEndereco.municipio.toUpperCase() === "SP") {
      toast.error("Municipio nao pode ser 'SP'. Informe o municipio correto."); return;
    }
    if (!formEndereco.uf || !/^[A-Z]{2}$/.test(formEndereco.uf)) {
      toast.error("UF deve ter exatamente 2 letras (ex: SP)."); return;
    }
    if (!formEndereco.logradouro || formEndereco.logradouro.length < 5) {
      toast.error("Logradouro deve ter pelo menos 5 caracteres."); return;
    }
    if (!formEndereco.numero) {
      toast.error("Numero e obrigatorio (use S/N se nao houver)."); return;
    }
    if (!formEndereco.cep || formEndereco.cep.replace(/\D/g, "").length < 8) {
      toast.error("CEP deve ter 8 digitos."); return;
    }
    if (!formEndereco.bairro) {
      toast.error("Bairro e obrigatorio."); return;
    }

    setSavingEndereco(true);
    try {
      const metaAtual = editingDoc.metadata || {};
      const enderecoFiscal = metaAtual.endereco_fiscal_xml || {};

      const temDivergencia = (
        (enderecoFiscal.logradouro && enderecoFiscal.logradouro !== formEndereco.logradouro) ||
        (enderecoFiscal.municipio && enderecoFiscal.municipio !== formEndereco.municipio) ||
        (enderecoFiscal.numero && enderecoFiscal.numero !== formEndereco.numero)
      );

      const novoMetadata = {
        ...metaAtual,
        endereco_real_entrega: {
          logradouro: formEndereco.logradouro || null,
          numero: formEndereco.numero || null,
          complemento: formEndereco.complemento || null,
          bairro: formEndereco.bairro || null,
          municipio: formEndereco.municipio || null,
          uf: (formEndereco.uf || "").toUpperCase() || null,
          cep: formEndereco.cep || null,
          codigo_ibge: formEndereco.codigo_ibge || null,
        },
        fonte_endereco_entrega: "manual",
        divergencia_endereco_xml_romaneio: temDivergencia,
        pendente_conferencia_endereco: false,
      };

      const { error } = await supabase
        .from("fiscal_documentos_vinculados")
        .update({ metadata: novoMetadata })
        .eq("id", editingDoc.id);

      if (error) throw error;

      toast.success("Endereco real de entrega salvo.");
      setEditingDoc(null);
      fetchDocs();
    } catch (err: any) {
      toast.error("Erro ao salvar endereco: " + err.message);
    } finally {
      setSavingEndereco(false);
    }
  };

  const handleGerarCteAvulso = async () => {
    if (!gerarCteDoc) return;
    const valor = parseFloat(valorFrete.replace(",", "."));
    if (!valor || valor <= 0) {
      toast.error("Informe um valor de frete valido (maior que zero).");
      return;
    }
    const meta = gerarCteDoc.metadata || {};
    const enderecoOk = meta.pendente_conferencia_endereco === false && meta.endereco_real_entrega?.municipio;
    if (!enderecoOk) {
      toast.error("Confira o endereco real de entrega antes de gerar o CT-e.");
      return;
    }
    setGerandoCte(true);
    try {
      const res = await gerarRascunhoCteAvulso({ documentoId: gerarCteDoc.id, valorFrete: valor });
      if (!res.success) {
        toast.error(res.error || "Erro ao gerar CT-e.");
        return;
      }
      toast.success(`CT-e rascunho gerado! NF-e ${gerarCteDoc.numero || "S/N"} | Valor R$ ${valor.toFixed(2)}`);
      if (res.pendencias && res.pendencias.length > 0) {
        toast.warning(`${res.pendencias.length} pendencia(s): ${res.pendencias.map((p: any) => p.mensagem).join("; ")}`);
      }
      setGerarCteDoc(null);
      setValorFrete("");
      fetchDocs();
    } catch (err: any) {
      toast.error("Erro ao gerar CT-e: " + err.message);
    } finally {
      setGerandoCte(false);
    }
  };

  const enderecoRealInfo = (doc: FiscalDocumentoVinculado) => {
    const meta = doc.metadata || {};
    const real = meta.endereco_real_entrega as EnderecoRealEntrega | undefined;
    const fonte = meta.fonte_endereco_entrega || "xml";
    const pendente = meta.pendente_conferencia_endereco !== false;

    // Regra Calvo: so mostrar como "Entrega real" se veio do romaneio ou foi manual
    const origemValida = fonte === "romaneio" || fonte === "manual" || fonte === "romaneio_manual";

    if (real?.municipio && real?.uf && origemValida && !pendente) {
      // Priorizar string completa ja salva no metadata
      const completo = meta.endereco_completo || real.enderecoCompleto || real.endereco_completo;
      if (completo && completo.trim().length > 10) {
        return { texto: completo.trim(), badge: null };
      }
      // Fallback: montar string a partir dos campos individuais
      const partes = [
        real.logradouro,
        real.numero ? `, ${real.numero}` : "",
      ];
      if (real.bairro) partes.push(` - ${real.bairro}`);
      if (real.municipio) partes.push(` - ${real.municipio}/${real.uf}`);
      if (real.cep) partes.push(` - CEP ${real.cep}`);
      const texto = partes.join("");
      return { texto, badge: null };
    }

    if (pendente) {
      return {
        texto: "Endereco real nao conferido",
        badge: <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px]"><MapPin className="w-3 h-3 mr-0.5" />Aguardando conferencia</Badge>,
      };
    }

    return { texto: "Endereco real nao informado", badge: null };
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      aguardando_vinculo: { label: "Aguardando vinculo", className: "bg-amber-100 text-amber-700 border-amber-200" },
      vinculado: { label: "Vinculado a OS", className: "bg-green-100 text-green-700 border-green-200" },
    };
    const cfg = map[status] || { label: status, className: "bg-slate-100 text-slate-700" };
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground border border-dashed rounded-lg">
        <FileText className="w-10 h-10 mb-2 opacity-20" />
        <p className="text-sm font-medium">Nenhum XML importado</p>
        <p className="text-xs mt-1 max-w-[300px]">
          Clique em "Importar XML" para adicionar uma NF-e.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {docs.map((doc) => {
          const meta = doc.metadata || {};
          const real = meta.endereco_real_entrega as EnderecoRealEntrega | undefined;
          const info = enderecoRealInfo(doc);
          const pendente = meta.pendente_conferencia_endereco !== false;
          return (
            <div
              key={doc.id}
              className="border rounded-lg p-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-500" />
                  <span className="font-medium text-sm">
                    NF-e {doc.numero || "S/N"}
                    {doc.serie ? ` / Serie ${doc.serie}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {info.badge}
                  {statusBadge(doc.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {doc.emitente_nome && (
                  <div>
                    <span className="text-slate-400">Emitente:</span> {doc.emitente_nome}
                  </div>
                )}
                {doc.destinatario_nome && (
                  <div>
                    <span className="text-slate-400">Destinatario:</span> {doc.destinatario_nome}
                  </div>
                )}
                {doc.valor_total != null && (
                  <div>
                    <span className="text-slate-400">Valor:</span>{" "}
                    {doc.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                )}
                {doc.chave_acesso && (
                  <div className="col-span-2">
                    <span className="text-slate-400">Chave:</span>{" "}
                    <span className="font-mono text-[10px]">{doc.chave_acesso}</span>
                  </div>
                )}
                {doc.peso_bruto != null && (
                  <div>
                    <span className="text-slate-400">Peso:</span> {doc.peso_bruto.toLocaleString("pt-BR")} kg
                  </div>
                )}
                {doc.volumes != null && (
                  <div>
                    <span className="text-slate-400">Volumes:</span> {doc.volumes}
                  </div>
                )}
                {doc.municipio_origem && doc.uf_origem && (
                  <div>
                    <span className="text-slate-400">Origem:</span> {doc.municipio_origem}/{doc.uf_origem}
                  </div>
                )}
                {doc.municipio_destino && doc.uf_destino && (
                  <div>
                    <span className="text-slate-400">Destino (XML):</span> {doc.municipio_destino}/{doc.uf_destino}
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-slate-400">Entrega real:</span>{" "}
                  <span className={pendente ? "text-red-500 font-medium" : (info.badge ? "text-red-500" : "text-green-700")}>
                    {info.texto}
                  </span>
                </div>
              </div>

              {doc.produto_predominante && (
                <div className="mt-1 text-xs text-slate-500">
                  <span className="text-slate-400">Produto:</span> {doc.produto_predominante}
                </div>
              )}

              <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                {doc.status === "aguardando_vinculo" && onVincular && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onVincular(doc)}
                    className="h-7 text-xs gap-1"
                  >
                    <LinkIcon className="w-3 h-3" /> Vincular OS
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditarEndereco(doc)}
                  className="h-7 text-xs gap-1"
                >
                  <Pencil className="w-3 h-3" /> Editar Endereco Real
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setGerarCteDoc(doc); setValorFrete(""); }}
                  className="h-7 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                >
                  <FilePlus className="w-3 h-3" /> Gerar CT-e Rascunho
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.id)}
                  className="h-7 text-xs gap-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3" /> Remover
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Edicao Endereco Real de Entrega */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => { if (!open) setEditingDoc(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Endereco Real de Entrega
            </DialogTitle>
          </DialogHeader>

          {editingDoc && (() => {
            const metaFiscal = editingDoc.metadata?.endereco_fiscal_xml || {};
            return (
              <div className="space-y-4 py-2">
                <div className="p-3 bg-slate-50 border rounded-lg">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Endereco Fiscal (XML da NF-e)</p>
                  <p className="text-sm text-slate-700">
                    {[
                      metaFiscal.logradouro,
                      metaFiscal.numero ? `, ${metaFiscal.numero}` : "",
                      metaFiscal.complemento ? ` ${metaFiscal.complemento}` : "",
                      metaFiscal.bairro ? `, ${metaFiscal.bairro}` : "",
                      metaFiscal.municipio ? `, ${metaFiscal.municipio}` : "",
                      metaFiscal.uf ? `/${metaFiscal.uf}` : "",
                      metaFiscal.cep ? ` CEP ${metaFiscal.cep}` : "",
                    ].join("") || "Endereco fiscal nao identificado no XML"}
                  </p>
                </div>

                <div className="border-t pt-2">
                  <p className="text-xs font-semibold text-blue-700 mb-3">Endereco Real de Entrega (manual)</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label className="text-xs">Logradouro</Label>
                      <Input
                        value={formEndereco.logradouro || ""}
                        onChange={(e) => setFormEndereco((p) => ({ ...p, logradouro: e.target.value }))}
                        placeholder="Rua, Avenida..."
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Numero</Label>
                        <Input
                          value={formEndereco.numero || ""}
                          onChange={(e) => setFormEndereco((p) => ({ ...p, numero: e.target.value }))}
                          placeholder="Numero"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Complemento</Label>
                        <Input
                          value={formEndereco.complemento || ""}
                          onChange={(e) => setFormEndereco((p) => ({ ...p, complemento: e.target.value }))}
                          placeholder="Apto, Bloco..."
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Bairro</Label>
                      <Input
                        value={formEndereco.bairro || ""}
                        onChange={(e) => setFormEndereco((p) => ({ ...p, bairro: e.target.value }))}
                        placeholder="Bairro"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-7 gap-3">
                      <div className="col-span-4">
                        <Label className="text-xs">Municipio *</Label>
                        <Input
                          value={formEndereco.municipio || ""}
                          onChange={(e) => setFormEndereco((p) => ({ ...p, municipio: e.target.value }))}
                          placeholder="Municipio"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-1">
                        <Label className="text-xs">UF *</Label>
                        <Input
                          value={formEndereco.uf || ""}
                          onChange={(e) => setFormEndereco((p) => ({ ...p, uf: e.target.value.toUpperCase() }))}
                          placeholder="UF"
                          maxLength={2}
                          className="h-8 text-sm uppercase"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">CEP</Label>
                        <Input
                          value={formEndereco.cep || ""}
                          onChange={(e) => setFormEndereco((p) => ({ ...p, cep: e.target.value }))}
                          placeholder="00000-000"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Codigo IBGE (opcional)</Label>
                      <Input
                        value={formEndereco.codigo_ibge || ""}
                        onChange={(e) => setFormEndereco((p) => ({ ...p, codigo_ibge: e.target.value }))}
                        placeholder="Codigo IBGE do municipio"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  Este endereco sera usado como destino da prestacao e na observacao do CT-e.
                  O endereco fiscal do XML permanecera preservado.
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDoc(null)}>Cancelar</Button>
            <Button onClick={handleSalvarEndereco} disabled={savingEndereco}>
              {savingEndereco ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
              Salvar Endereco Real
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Gerar CT-e Rascunho Avulso */}
      <Dialog open={!!gerarCteDoc} onOpenChange={(open) => { if (!open) { setGerarCteDoc(null); setValorFrete(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus className="w-5 h-5 text-green-600" />
              Gerar CT-e Rascunho — 1 XML
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {gerarCteDoc && (
              <>
                <div className="p-3 bg-slate-50 border rounded-lg text-sm space-y-1">
                  <p><strong>NF-e:</strong> {gerarCteDoc.numero || "S/N"} (Serie {gerarCteDoc.serie || "?"})</p>
                  <p><strong>Chave:</strong> {(gerarCteDoc.chave_acesso || "").slice(0, 20)}...</p>
                  <p><strong>Emitente:</strong> {gerarCteDoc.emitente_nome || "?"}</p>
                  <p><strong>Valor NF-e:</strong> R$ {gerarCteDoc.valor_total?.toFixed(2) || "0.00"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Valor do Frete (CT-e) *</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-slate-500">R$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={valorFrete}
                      onChange={(e) => setValorFrete(e.target.value)}
                      placeholder="Ex: 150.00"
                      className="h-9 text-base"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Informe o valor do frete deste CT-e. Nao e o valor da NF-e.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGerarCteDoc(null); setValorFrete(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleGerarCteAvulso}
              disabled={gerandoCte || !valorFrete.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {gerandoCte ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FilePlus className="w-4 h-4 mr-2" />}
              Gerar 1 CT-e Rascunho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
