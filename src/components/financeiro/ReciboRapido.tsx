import React from "react";
import { Receipt, FileText, Download, Printer, Save, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLogo } from "@/hooks/useLogo";

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
    try {
      setLoading(true);
      
      const nomeFavorecido = form.nomeFavorecido?.trim() || "";
      const valor = Number(form.valor) || 0;
      const descricaoServico = form.descricaoServico?.trim() || "";
      
      if (!nomeFavorecido) {
        toast.error("Nome do favorecido é obrigatório");
        return;
      }
      if (!valor || valor <= 0) {
        toast.error("Valor deve ser maior que zero");
        return;
      }
      if (!descricaoServico) {
        toast.error("Descrição do serviço é obrigatória");
        return;
      }

      const recibo: ReciboData = {
        id: generateId(),
        tipoFavorecido: form.tipoFavorecido || "prestador",
        favorecidoId: form.favorecidoId || "",
        nomeFavorecido,
        documentoFavorecido: form.documentoFavorecido || "",
        telefone: form.telefone || "",
        email: form.email || "",
        descricaoServico,
        valor,
        dataEmissao: form.dataEmissao || new Date().toISOString().split("T")[0],
        formaPagamento: form.formaPagamento || "dinheiro",
        observacoes: form.observacoes || "",
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
      const valorNum = Number(form.valor) || 0;
      if (!valorNum || valorNum <= 0) return "zero reais";
      
      const num = Math.floor(valorNum);
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
      return `${valorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} reais`;
    } catch (e) {
      console.error("Erro ao formatar valor por extenso:", e);
      return `${Number(form.valor) || 0} reais`;
    }
  }, [form.valor]);

    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" />
            Novo Recibo Rápido
          </h2>
          <p className="text-sm text-muted-foreground">Emissão ágil e profissional de recibos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600"/>
              Dados do Recibo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Favorecido</Label>
                <Select 
                  value={form.tipoFavorecido} 
                  onValueChange={(v: any) => setForm({...form, tipoFavorecido: v, favouredId: "", nomeFavorecido: "", documentoFavorecido: ""})}
                >
                  <SelectTrigger className="border-slate-200 focus:ring-indigo-200"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prestador">Prestador</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="outro">Outro (Avulso)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Buscar Cadastro</Label>
                {!form.favorecidoId ? (
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Buscar por nome ou documento..." 
                          value={buscaFavorecido}
                          onChange={(e) => setBuscaFavorecido(e.target.value)}
                          className="pl-9 border-slate-200 focus:ring-indigo-200"
                        />
                      </div>
                    </div>
                    {favorecidos.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-card border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {favorecidos.slice(0, 5).map((fav) => (
                          <div 
                            key={`${fav.tipo}-${fav.id}`}
                            className="p-3 hover:bg-indigo-50 cursor-pointer border-b last:border-0 transition-colors"
                            onClick={() => handleSelecionarFavorecido(fav)}
                          >
                            <div className="flex items-center gap-3">
                              {fav.tipo === "cliente" ? <Building2 className="w-4 h-4 text-blue-500" /> : <User className="w-4 h-4 text-green-500" />}
                              <div>
                                <p className="font-medium text-sm">{fav.nome}</p>
                                <p className="text-xs text-muted-foreground font-mono">{fav.documento}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-indigo-900">{form.nomeFavorecido}</p>
                      <p className="text-xs text-indigo-600 font-mono">{formatDocument(form.documentoFavorecido)}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setForm({...form, favouredId: "", nomeFavorecido: "", documentoFavorecido: ""})} className="text-indigo-400 hover:text-indigo-600">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {form.tipoFavorecido === "outro" && !form.favorecidoId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nome do Favorecido <span className="text-red-500">*</span></Label>
                  <Input 
                    value={form.nomeFavorecido}
                    onChange={(e) => setForm({...form, nomeFavorecido: e.target.value})}
                    placeholder="Nome completo"
                    className="border-slate-200 focus:ring-indigo-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">CPF/CNPJ</Label>
                  <Input 
                    value={form.documentoFavorecido}
                    onChange={(e) => setForm({...form, documentoFavorecido: e.target.value})}
                    placeholder="000.000.000-00"
                    className="border-slate-200 focus:ring-indigo-200 font-mono"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Valor (R$) <span className="text-red-500">*</span></Label>
                <Input 
                  type="number"
                  value={form.valor || ""}
                  onChange={(e) => setForm({...form, valor: Number(e.target.value)})}
                  placeholder="0,00"
                  className="border-slate-200 focus:ring-indigo-200 font-bold text-lg font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Data de Emissão</Label>
                <Input 
                  type="date"
                  value={form.dataEmissao}
                  className="border-slate-200 focus:ring-indigo-200"
                  onChange={(e) => setForm({...form, dataEmissao: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Descrição do Serviço <span className="text-red-500">*</span></Label>
              <Textarea 
                value={form.descricaoServico}
                onChange={(e) => setForm({...form, descricaoServico: e.target.value})}
                placeholder="Descreva o serviço prestado..."
                className="resize-none border-slate-200 focus:ring-indigo-200"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Forma de Pagamento</Label>
                <Select 
                  value={form.formaPagamento} 
                  onValueChange={(v) => setForm({...form, formaPagamento: v})}
                >
                  <SelectTrigger className="border-slate-200 focus:ring-indigo-200"><SelectValue /></SelectTrigger>
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
                <Label className="text-sm font-medium">Telefone (opcional)</Label>
                <Input 
                  value={form.telefone}
                  onChange={(e) => setForm({...form, telefone: e.target.value})}
                  placeholder="(11) 99999-9999"
                  className="border-slate-200 focus:ring-indigo-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Observações</Label>
              <Textarea 
                value={form.observacoes}
                onChange={(e) => setForm({...form, observacoes: e.target.value})}
                placeholder="Observações adicionais..."
                className="resize-none border-slate-200 focus:ring-indigo-200"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleSalvar} 
                disabled={loading || !form.nomeFavorecido?.trim() || !form.valor || !form.descricaoServico?.trim()}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Emitir Recibo
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowPreview(!showPreview)}
                className="gap-2 border-slate-200"
              >
                <FileText className="w-4 h-4" />
                Visualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-slate-200">
          <CardHeader className="border-b bg-slate-50/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600"/>
              Preview do Recibo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <div className="w-full max-w-sm bg-white rounded-lg shadow border p-6 font-sans text-slate-800 scale-95 transform origin-top">
               <div className="text-center border-b pb-4 mb-4">
                  {shouldShowLogo('recibosPdf') && config.logoUrl ? (
                    <img src={config.logoUrl} alt="Logo" className="w-[100px] h-auto object-contain mx-auto mb-2" />
                  ) : (
                    <div className="w-[100px] h-[40px]bg-slate-100 flex items-center justify-center mx-auto mb-2 text-xs font-bold text-slate-400">[LOGO AQUI]</div>
                  )}
                  <h3 className="font-bold text-xl uppercase tracking-widest text-slate-700">RECIBO</h3>
                  <p className="text-sm text-slate-500">Nº 202604-0012</p>
               </div>
               <div className="bg-slate-100 p-3 rounded-md mb-6 text-center">
                 <p className="text-sm text-slate-600 font-semibold">Valor</p>
                 <p className="text-2xl font-bold text-slate-800 tracking-tight">R$ <span className="font-mono">---,--</span></p>
               </div>
               <div className="space-y-4 text-sm leading-relaxed mb-12">
                  <p className="text-justify">
                    Recebemos de <strong className="border-b border-dotted border-slate-400 inline-block w-48 align-bottom"></strong>,<br/>
                    inscrito(a) no CPF/CNPJ <strong className="border-b border-dotted border-slate-400 inline-block w-32 align-bottom"></strong>, 
                    a importância supra de <span className="italic text-slate-500 text-xs">(valor por extenso)</span> referente a <strong className="border-b border-dotted border-slate-400 inline-block w-full align-bottom mt-2"></strong>.
                  </p>
                  <p>Por ser verdade, firmo o presente.</p>
               </div>
               <div className="text-center pt-8 border-t border-slate-300">
                  <div className="border-b border-slate-800 w-3/4 mx-auto mb-2"></div>
                  <p className="text-xs font-semibold">{getNomeFantasia()}</p>
                  <p className="text-[10px] text-slate-500">Emissor do Recibo</p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
