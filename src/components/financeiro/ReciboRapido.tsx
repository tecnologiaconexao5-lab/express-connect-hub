import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Receipt, FileText, Download, Printer, Save, CheckCircle2, Search, Loader2, AlertCircle, X, User, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLogo } from "@/hooks/useLogo";
import { toast } from "sonner";
import { 
  mockClientes, 
  mockFornecedores, 
  Cliente, 
  Fornecedor, 
  formatCurrency, 
  formatDocument,
  formatDate,
  generateId,
  getErrorMessage
} from "./types";

interface ReciboData {
  id: string;
  tipoFavorecido: "cliente" | "prestador" | "fornecedor" | "outro";
  favorecidoId: string;
  nomeFavorecido: string;
  documentoFavorecido: string;
  telefone?: string;
  email?: string;
  descricaoServico: string;
  valor: number;
  dataEmissao: string;
  formaPagamento: string;
  observacoes?: string;
  status: "rascunho" | "emitido" | "pago";
  numero: string;
}

export default function ReciboRapido() {
  const { config, getNomeFantasia, shouldShowLogo } = useLogo();
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [buscaFavorecido, setBuscaFavorecido] = useState("");
  
  const [form, setForm] = useState({
    tipoFavorecido: "prestador" as const,
    favorecidoId: "",
    nomeFavorecido: "",
    documentoFavorecido: "",
    telefone: "",
    email: "",
    descricaoServico: "",
    valor: 0,
    dataEmissao: new Date().toISOString().split("T")[0],
    formaPagamento: "dinheiro",
    observacoes: ""
  });

  const favorecidos = useMemo(() => {
    try {
      if (!buscaFavorecido.trim()) return [];
      const term = buscaFavorecido.toLowerCase();
      
      const clientes = mockClientes
        .filter(c => c.ativo && (c.nome.toLowerCase().includes(term) || c.documento.includes(term)))
        .map(c => ({ ...c, tipo: "cliente" as const }));
      
      const fornecedores = mockFornecedores
        .filter(f => f.ativo && (f.nome.toLowerCase().includes(term) || f.documento.includes(term)))
        .map(f => ({ ...f, tipo: "fornecedor" as const }));
      
      return [...clientes, ...fornecedores];
    } catch (e) {
      console.error("Erro ao buscar favorecidos:", e);
      return [];
    }
  }, [buscaFavorecido]);

  const handleSelecionarFavorecido = useCallback((fav: any) => {
    try {
      setForm({
        ...form,
        favorecidoId: fav.id,
        nomeFavorecido: fav.nome,
        documentoFavorecido: fav.documento,
        telefone: fav.telefone || "",
        email: fav.email || ""
      });
      setBuscaFavorecido("");
    } catch (e) {
      console.error("Erro ao selecionar favorecido:", e);
      toast.error("Erro ao selecionar favorecido");
    }
  }, [form]);

  const handleSalvar = useCallback(() => {
    setLoading(true);
    try {
      if (!form.nomeFavorecido.trim()) {
        toast.error("Nome do favorecido é obrigatório");
        return;
      }
      if (!form.valor || form.valor <= 0) {
        toast.error("Valor deve ser maior que zero");
        return;
      }
      if (!form.descricaoServico.trim()) {
        toast.error("Descrição do serviço é obrigatória");
        return;
      }

      const recibo: ReciboData = {
        id: generateId(),
        ...form,
        status: "emitido",
        numero: `REC-${Date.now().toString().slice(-6)}`
      };

      toast.success(`Recibo ${recibo.numero} emitido com sucesso!`);
      setShowPreview(true);
      
      setForm({
        tipoFavorecido: "prestador",
        favorecidoId: "",
        nomeFavorecido: "",
        documentoFavorecido: "",
        telefone: "",
        email: "",
        descricaoServico: "",
        valor: 0,
        dataEmissao: new Date().toISOString().split("T")[0],
        formaPagamento: "dinheiro",
        observacoes: ""
      });
    } catch (error) {
      console.error("Erro ao salvar recibo:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [form]);

  const valorPorExtenso = useMemo(() => {
    try {
      const num = Math.floor(form.valor);
      const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
      const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
      const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
      
      if (num === 0) return "zero reais";
      if (num === 1) return "um real";
      if (num < 1000) {
        const cent = Math.floor(num / 100);
        const dez = Math.floor((num % 100) / 10);
        const uni = num % 100;
        let result = "";
        if (cent > 0) result += centenas[cent] + (cent === 1 && uni > 0 ? " e " : " ");
        if (dez > 0 && uni < 20) result += (cent > 0 ? "e " : "") + unidades[uni];
        else if (dez > 0) result += (cent > 0 ? "e " : "") + dezenas[dez] + (uni > 0 ? " e " + unidades[uni] : "");
        else if (uni > 0) result += (cent > 0 ? "e " : "") + unidades[uni];
        return result.trim() + " reais";
      }
      return `${form.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} reais`;
    } catch (e) {
      console.error("Erro ao formatar valor por extenso:", e);
      return `${form.valor} reais`;
    }
  }, [form.valor]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            Novo Recibo Rápido
          </h2>
          <p className="text-sm text-muted-foreground">Emissão ágil e profissional de recibos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-card">
            <CardTitle className="text-base">Dados do Recibo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Favorecido</Label>
                <Select 
                  value={form.tipoFavorecido} 
                  onValueChange={(v: any) => setForm({...form, tipoFavorecido: v, favorecidoId: "", nomeFavorecido: "", documentoFavorecido: ""})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prestador">Prestador</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="outro">Outro (Avulso)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Buscar Cadastro</Label>
                {!form.favorecidoId ? (
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Buscar..." 
                          value={buscaFavorecido}
                          onChange={(e) => setBuscaFavorecido(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    {favorecidos.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {favorecidos.slice(0, 5).map((fav) => (
                          <div 
                            key={`${fav.tipo}-${fav.id}`}
                            className="p-2 hover:bg-muted cursor-pointer border-b last:border-0"
                            onClick={() => handleSelecionarFavorecido(fav)}
                          >
                            <div className="flex items-center gap-2">
                              {fav.tipo === "cliente" ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                              <div>
                                <p className="font-medium text-sm">{fav.nome}</p>
                                <p className="text-xs text-muted-foreground">{fav.documento}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{form.nomeFavorecido}</p>
                      <p className="text-xs text-blue-600">{formatDocument(form.documentoFavorecido)}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setForm({...form, favorecidoId: "", nomeFavorecido: "", documentoFavorecido: ""})}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {form.tipoFavorecido === "outro" && !form.favorecidoId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Favorecido *</Label>
                  <Input 
                    value={form.nomeFavorecido}
                    onChange={(e) => setForm({...form, nomeFavorecido: e.target.value})}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ</Label>
                  <Input 
                    value={form.documentoFavorecido}
                    onChange={(e) => setForm({...form, documentoFavorecido: e.target.value})}
                    placeholder="000.000.000-00"
                    className="font-mono"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input 
                  type="number"
                  value={form.valor || ""}
                  onChange={(e) => setForm({...form, valor: Number(e.target.value)})}
                  placeholder="0,00"
                  className="font-bold text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Emissão</Label>
                <Input 
                  type="date"
                  value={form.dataEmissao}
                  onChange={(e) => setForm({...form, dataEmissao: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição do Serviço *</Label>
              <Textarea 
                value={form.descricaoServico}
                onChange={(e) => setForm({...form, descricaoServico: e.target.value})}
                placeholder="Descreva o serviço prestado..."
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select 
                  value={form.formaPagamento} 
                  onValueChange={(v) => setForm({...form, formaPagamento: v})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="deposito">Depósito</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="credito">Cartão Crédito</SelectItem>
                    <SelectItem value="debito">Cartão Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Telefone (opcional)</Label>
                <Input 
                  value={form.telefone}
                  onChange={(e) => setForm({...form, telefone: e.target.value})}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={form.observacoes}
                onChange={(e) => setForm({...form, observacoes: e.target.value})}
                placeholder="Observações adicionais..."
                className="resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleSalvar} 
                disabled={loading}
                className="gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Emitir Recibo
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowPreview(!showPreview)}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                Visualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="border-b bg-card">
            <CardTitle className="text-base">Preview do Recibo</CardTitle>
          </CardHeader>
          <CardContent className="p-6 bg-white border rounded-lg min-h-[400px]">
            <div className="text-center border-b pb-4 mb-4">
              {shouldShowLogo && config?.logoUrl && (
                <img src={config.logoUrl} alt="Logo" className="h-16 mx-auto mb-2" />
              )}
              <h3 className="text-xl font-bold">{getNomeFantasia()}</h3>
              <p className="text-sm text-muted-foreground">Recibo</p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Número:</span>
                <span className="font-medium">REC-{Date.now().toString().slice(-6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data:</span>
                <span className="font-medium">{formatDate(form.dataEmissao)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recebi de:</span>
                <span className="font-medium">{form.nomeFavorecido || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CNPJ/CPF:</span>
                <span className="font-medium font-mono">{form.documentoFavorecido ? formatDocument(form.documentoFavorecido) : "-"}</span>
              </div>
              
              <div className="border-t pt-4">
                <p className="text-muted-foreground mb-1">Referente a:</p>
                <p className="font-medium">{form.descricaoServico || "-"}</p>
              </div>

              <div className="border-t pt-4">
                <p className="text-muted-foreground mb-1">Forma de Pagamento:</p>
                <p className="font-medium capitalize">{form.formaPagamento}</p>
              </div>

              <div className="border-t pt-4">
                <p className="text-muted-foreground mb-1">Valor:</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(form.valor)}</p>
                <p className="text-xs text-muted-foreground mt-1">{valorPorExtenso}</p>
              </div>

              {form.observacoes && (
                <div className="border-t pt-4">
                  <p className="text-muted-foreground mb-1">Observações:</p>
                  <p className="text-sm">{form.observacoes}</p>
                </div>
              )}

              <div className="border-t pt-8 mt-8 flex justify-around">
                <div className="text-center">
                  <div className="border-t-2 border-black pt-2 w-40">
                    <p className="text-xs">Assinatura</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="border-t-2 border-black pt-2 w-40">
                    <p className="text-xs">Data</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}