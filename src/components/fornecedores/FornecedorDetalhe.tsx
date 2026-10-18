import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Fornecedor, TipoPessoa, StatusFornecedor, UF_OPTIONS } from "./types";
import { buscarCEP } from "@/services/cepService";

interface Props {
  fornecedor?: Fornecedor;
  onBack: () => void;
}

const emptyForm = {
  tipo_pessoa: "PJ" as TipoPessoa,
  razao_social: "",
  nome_fantasia: "",
  cpf_cnpj: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  telefone: "",
  email: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  chave_pix: "",
  tipo_chave_pix: "",
  banco: "",
  agencia: "",
  conta: "",
  observacoes: "",
  status: "ativo" as StatusFornecedor,
};

const formatDoc = (doc: string) => {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return doc;
};

const FornecedorDetalhe = ({ fornecedor: initial, onBack }: Props) => {
  const isNew = !initial;
  const [form, setForm] = useState(initial ? {
    tipo_pessoa: initial.tipo_pessoa,
    razao_social: initial.razao_social,
    nome_fantasia: initial.nome_fantasia ?? "",
    cpf_cnpj: initial.cpf_cnpj.replace(/\D/g, ""),
    inscricao_estadual: initial.inscricao_estadual ?? "",
    inscricao_municipal: initial.inscricao_municipal ?? "",
    telefone: initial.telefone ?? "",
    email: initial.email ?? "",
    cep: initial.cep ?? "",
    logradouro: initial.logradouro ?? "",
    numero: initial.numero ?? "",
    complemento: initial.complemento ?? "",
    bairro: initial.bairro ?? "",
    cidade: initial.cidade ?? "",
    uf: initial.uf ?? "",
    chave_pix: initial.chave_pix ?? "",
    tipo_chave_pix: initial.tipo_chave_pix ?? "",
    banco: initial.banco ?? "",
    agencia: initial.agencia ?? "",
    conta: initial.conta ?? "",
    observacoes: initial.observacoes ?? "",
    status: initial.status,
  } : { ...emptyForm });

  const [isSaving, setIsSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCEPBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cepValue = e.target.value.replace(/\D/g, "");
    if (cepValue.length !== 8) return;
    if (form.logradouro || form.bairro || form.cidade) return;

    setCepLoading(true);
    const resultado = await buscarCEP(cepValue);
    if ("logradouro" in resultado) {
      setForm(prev => ({
        ...prev,
        logradouro: resultado.logradouro || prev.logradouro,
        bairro: resultado.bairro || prev.bairro,
        cidade: resultado.cidade || prev.cidade,
        uf: resultado.estado || prev.uf,
      }));
      toast.success("Endereco preenchido automaticamente.");
    }
    setCepLoading(false);
  };

  const handleSave = async () => {
    if (!form.razao_social.trim()) {
      toast.error("Razao social e obrigatoria");
      return;
    }
    const doc = form.cpf_cnpj.replace(/\D/g, "");
    if (!doc) {
      toast.error("CPF/CNPJ e obrigatorio");
      return;
    }
    if (form.tipo_pessoa === "PF" && doc.length !== 11) {
      toast.error("CPF deve ter 11 digitos");
      return;
    }
    if (form.tipo_pessoa === "PJ" && doc.length !== 14) {
      toast.error("CNPJ deve ter 14 digitos");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        tipo_pessoa: form.tipo_pessoa,
        razao_social: form.razao_social.trim(),
        nome_fantasia: form.nome_fantasia.trim() || null,
        cpf_cnpj: doc,
        inscricao_estadual: form.inscricao_estadual.trim() || null,
        inscricao_municipal: form.inscricao_municipal.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        cep: form.cep.replace(/\D/g, "") || null,
        logradouro: form.logradouro.trim() || null,
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        uf: form.uf || null,
        chave_pix: form.chave_pix.trim() || null,
        tipo_chave_pix: form.tipo_chave_pix || null,
        banco: form.banco.trim() || null,
        agencia: form.agencia.trim() || null,
        conta: form.conta.trim() || null,
        observacoes: form.observacoes.trim() || null,
        status: form.status,
      };

      if (isNew) {
        const { error } = await supabase.from("fornecedores").insert([payload]);
        if (error) {
          if (error.code === "23505") {
            toast.error("Ja existe um fornecedor ativo com este CPF/CNPJ");
          } else {
            throw error;
          }
          return;
        }
        toast.success("Fornecedor criado!");
      } else {
        const { error } = await supabase
          .from("fornecedores")
          .update(payload)
          .eq("id", initial!.id);
        if (error) throw error;
        toast.success("Fornecedor atualizado!");
      }
      onBack();
    } catch (err) {
      console.error("[FornecedorDetalhe] Erro ao salvar:", err);
      toast.error("Erro ao salvar fornecedor");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <h2 className="text-xl font-bold">{isNew ? "Novo Fornecedor" : `Editar: ${initial?.razao_social}`}</h2>
      </div>

      {/* IDENTIFICACAO */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm uppercase">Identificacao</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Tipo Pessoa *</Label>
            <Select value={form.tipo_pessoa} onValueChange={(v) => handleChange("tipo_pessoa", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PJ">Pessoa Juridica</SelectItem>
                <SelectItem value="PF">Pessoa Fisica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Razao Social / Nome *</Label>
            <Input value={form.razao_social} onChange={(e) => handleChange("razao_social", e.target.value)} placeholder="Ex: Distribuidora ABC Ltda" />
          </div>
          <div>
            <Label>Nome Fantasia</Label>
            <Input value={form.nome_fantasia} onChange={(e) => handleChange("nome_fantasia", e.target.value)} placeholder="Ex: ABC Distribuidora" />
          </div>
          <div>
            <Label>{form.tipo_pessoa === "PF" ? "CPF" : "CNPJ"} *</Label>
            <Input
              value={form.cpf_cnpj}
              onChange={(e) => handleChange("cpf_cnpj", e.target.value.replace(/\D/g, ""))}
              placeholder={form.tipo_pessoa === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
              maxLength={form.tipo_pessoa === "PF" ? 11 : 14}
            />
            {form.cpf_cnpj && (
              <p className="text-xs text-muted-foreground mt-1">{formatDoc(form.cpf_cnpj)}</p>
            )}
          </div>
          <div>
            <Label>Inscricao Estadual</Label>
            <Input value={form.inscricao_estadual} onChange={(e) => handleChange("inscricao_estadual", e.target.value)} />
          </div>
          <div>
            <Label>Inscricao Municipal</Label>
            <Input value={form.inscricao_municipal} onChange={(e) => handleChange("inscricao_municipal", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* CONTATO */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm uppercase">Contato</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => handleChange("telefone", e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="contato@empresa.com.br" />
          </div>
        </CardContent>
      </Card>

      {/* ENDERECO */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm uppercase">Endereco</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>CEP</Label>
            <Input
              value={form.cep}
              onChange={(e) => handleChange("cep", e.target.value)}
              onBlur={handleCEPBlur}
              placeholder="00000-000"
              maxLength={8}
            />
            {cepLoading && <p className="text-xs text-muted-foreground">Buscando CEP...</p>}
          </div>
          <div className="md:col-span-2">
            <Label>Logradouro</Label>
            <Input value={form.logradouro} onChange={(e) => handleChange("logradouro", e.target.value)} placeholder="Rua, Avenida, etc" />
          </div>
          <div>
            <Label>Numero</Label>
            <Input value={form.numero} onChange={(e) => handleChange("numero", e.target.value)} />
          </div>
          <div>
            <Label>Complemento</Label>
            <Input value={form.complemento} onChange={(e) => handleChange("complemento", e.target.value)} placeholder="Sala, Andar, etc" />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={form.bairro} onChange={(e) => handleChange("bairro", e.target.value)} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.cidade} onChange={(e) => handleChange("cidade", e.target.value)} />
          </div>
          <div>
            <Label>UF</Label>
            <Select value={form.uf} onValueChange={(v) => handleChange("uf", v)}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                {UF_OPTIONS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* PAGAMENTO */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm uppercase">Pagamento</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Chave PIX</Label>
            <Input value={form.chave_pix} onChange={(e) => handleChange("chave_pix", e.target.value)} placeholder="CNPJ, telefone, email ou aleatoria" />
          </div>
          <div>
            <Label>Tipo Chave PIX</Label>
            <Select value={form.tipo_chave_pix} onValueChange={(v) => handleChange("tipo_chave_pix", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="aleatoria">Aleatoria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div></div>
          <div>
            <Label>Banco</Label>
            <Input value={form.banco} onChange={(e) => handleChange("banco", e.target.value)} placeholder="Ex: Itau, Bradesco" />
          </div>
          <div>
            <Label>Agencia</Label>
            <Input value={form.agencia} onChange={(e) => handleChange("agencia", e.target.value)} />
          </div>
          <div>
            <Label>Conta</Label>
            <Input value={form.conta} onChange={(e) => handleChange("conta", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* CONTROLE */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm uppercase">Controle</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div></div>
          <div className="md:col-span-2">
            <Label>Observacoes</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => handleChange("observacoes", e.target.value)}
              placeholder="Notas sobre o fornecedor..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* FOOTER */}
      <div className="flex justify-end gap-2 border-t pt-4 pb-8">
        <Button variant="outline" onClick={onBack}>Cancelar</Button>
        <Button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 px-8">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isNew ? "Criar Fornecedor" : "Salvar Alteracoes"}
        </Button>
      </div>
    </div>
  );
};

export default FornecedorDetalhe;
