import { useState, useEffect } from "react";
import { Building2, Save, CheckCircle2, AlertTriangle, Loader2, Plus, Pencil, Star, Power, PowerOff, Shield, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";
import {
  buscarEmitenteAtivo,
  salvarEmitenteFiscal,
  atualizarEmitenteFiscal,
  listarConfiguracoesFiscais,
  definirComoPadrao,
  toggleAtivoEmitente,
  type SalvarConfiguracaoFiscalInput,
} from "@/services/fiscal/configuracoesFiscaisService";
import type { ConfiguracaoFiscal } from "@/types/fiscal";

const emptyForm: SalvarConfiguracaoFiscalInput = {
  razao_social: "", nome_fantasia: "", cnpj: "", ie: "", rntrc: "",
  cep: "", logradouro: "", numero: "", complemento: "", bairro: "",
  cidade: "", uf: "", telefone: "", email: "",
  ambiente_fiscal: "homologacao", ativo: true, apelido: null,
  padrao: false, limite_plano: 3,
  focus_empresa_id: null, focus_token_configurado: false, certificado_configurado: false,
};

export default function EmitenteFiscalConfig() {
  const [emitentes, setEmitentes] = useState<ConfiguracaoFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SalvarConfiguracaoFiscalInput>({ ...emptyForm });
  const [uploading, setUploading] = useState(false);

  useEffect(function() { carregar(); }, []);

  const carregar = async function() {
    setLoading(true);
    const data = await listarConfiguracoesFiscais();
    setEmitentes(data);
    setLoading(false);
  };

  const handleUploadCertificado = async function(emitenteId: string, file: File) {
    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      toast.error("Apenas arquivos .pfx ou .p12 sao aceitos.");
      return;
    }
    setUploading(true);
    try {
      const filePath = `${emitenteId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("certificados-fiscais")
        .upload(filePath, file, { upsert: true, contentType: "application/x-pkcs12" });

      if (uploadError) throw uploadError;

      const { error: certError } = await supabase.from("certificados_fiscais").insert([{
        emitente_id: emitenteId,
        nome_arquivo: file.name,
        storage_path: filePath,
        tipo: "A1",
        validade: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "enviado",
      }]);

      if (certError) throw certError;

      await atualizarEmitenteFiscal(emitenteId, {
        certificado_configurado: true,
        certificado_nome: file.name,
        certificado_status: "enviado",
        certificado_validade: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      } as any);

      toast.success("Certificado enviado com sucesso!");
      carregar();
    } catch (e: any) {
      toast.error("Erro ao enviar certificado: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const openNovo = function() {
    setEditId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEditar = function(emit: ConfiguracaoFiscal) {
    setEditId(emit.id);
    setForm({
      razao_social: emit.razao_social || "", nome_fantasia: emit.nome_fantasia || "",
      cnpj: emit.cnpj || "", ie: emit.ie || "", rntrc: emit.rntrc || "",
      cep: emit.cep || "", logradouro: emit.logradouro || "",
      numero: emit.numero || "", complemento: emit.complemento || "",
      bairro: emit.bairro || "",       cidade: emit.cidade || "", uf: emit.uf || "",
      codigo_ibge: emit.codigo_ibge || undefined,
      telefone: emit.telefone || "", email: emit.email || "",
      ambiente_fiscal: emit.ambiente_fiscal || "homologacao",
      ativo: emit.ativo ?? true,
      apelido: emit.apelido || null,
      padrao: emit.padrao ?? false,
      limite_plano: emit.limite_plano ?? 3,
      focus_empresa_id: emit.focus_empresa_id || null,
      focus_token_configurado: emit.focus_token_configurado ?? false,
      certificado_configurado: emit.certificado_configurado ?? false,
    });
    setModalOpen(true);
  };

  const handleSave = async function() {
    if (!form.razao_social || !form.cnpj) {
      toast.error("Razao Social e CNPJ sao obrigatorios.");
      return;
    }
    setSaving(true);
    if (editId) {
      const { success, error } = await atualizarEmitenteFiscal(editId, form);
      if (success) toast.success("Emitente atualizado!");
      else toast.error("Erro: " + (error || ""));
    } else {
      const { success, error } = await salvarEmitenteFiscal(form);
      if (success) toast.success("Emitente cadastrado!");
      else toast.error("Erro: " + (error || ""));
    }
    setSaving(false);
    setModalOpen(false);
    carregar();
  };

  const handleDefinirPadrao = async function(id: string) {
    const { success, error } = await definirComoPadrao(id);
    if (success) { toast.success("Emitente definido como padrao."); carregar(); }
    else toast.error("Erro: " + (error || ""));
  };

  const handleToggleAtivo = async function(emit: ConfiguracaoFiscal) {
    const novo = !emit.ativo;
    const { success, error } = await toggleAtivoEmitente(emit.id, novo);
    if (success) { toast.success(novo ? "Emitente ativado." : "Emitente desativado."); carregar(); }
    else toast.error("Erro: " + (error || ""));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <ProgressiveBlocksLoader size="normal" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Emitentes Fiscais</CardTitle>
                <CardDescription>Cadastre ate 3 emitentes para uso nos documentos fiscais</CardDescription>
              </div>
            </div>
            <Button onClick={openNovo} disabled={emitentes.filter(function(e) { return e.ativo; }).length >= 3} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Emitente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {emitentes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>Nenhum emitente cadastrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emitentes.map(function(emit) {
                return (
                  <div key={emit.id} className={"p-4 border rounded-lg " + (emit.padrao ? "border-primary bg-primary/5" : "border-border")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Building2 className={"w-5 h-5 flex-shrink-0 " + (emit.padrao ? "text-primary" : "text-muted-foreground")} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{emit.apelido || emit.nome_fantasia || emit.razao_social}</span>
                            {emit.padrao && <Badge className="bg-primary/10 text-primary border-primary/20 text-xs"><Star className="w-3 h-3 mr-1" />Padrao</Badge>}
                            <Badge variant="outline" className={emit.ambiente_fiscal === "producao" ? "bg-red-50 text-red-700 border-red-200 text-xs" : "bg-amber-50 text-amber-700 border-amber-200 text-xs"}>
                              {emit.ambiente_fiscal === "producao" ? "Producao" : "Homologacao"}
                            </Badge>
                            {!emit.focus_token_configurado && <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">Focus pendente</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{emit.cnpj} — {emit.cidade}/{emit.uf}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!emit.padrao && emit.ativo && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Definir como padrao" onClick={function() { handleDefinirPadrao(emit.id); }}>
                            <Star className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={emit.ativo ? "Desativar" : "Ativar"} onClick={function() { handleToggleAtivo(emit); }}>
                          {emit.ativo ? <PowerOff className="w-4 h-4 text-muted-foreground" /> : <Power className="w-4 h-4 text-green-500" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={function() { openEditar(emit); }}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex items-center gap-3">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-slate-600">Certificado A1:</span>
                      {emit.certificado_configurado ? (
                        <>
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">{emit.certificado_status || "enviado"}</Badge>
                          <span className="text-xs text-slate-500">{emit.certificado_nome}</span>
                          {emit.certificado_validade && <span className="text-xs text-slate-400">Val: {emit.certificado_validade}</span>}
                        </>
                      ) : (
                        <>
                          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-[10px]">pendente</Badge>
                          <label className="cursor-pointer">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={uploading} asChild>
                              <span>{uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Enviar .pfx</span>
                            </Button>
                            <input type="file" accept=".pfx,.p12" className="hidden" onChange={function(e) {
                              const file = e.target.files?.[0];
                              if (file) handleUploadCertificado(emit.id, file);
                            }} />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Emitente" : "Novo Emitente"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <div>
              <Label>Apelido</Label>
              <Input value={form.apelido || ""} onChange={function(e) { setForm(function(p) { return { ...p, apelido: e.target.value || null }; }); }} placeholder="Matriz / Filial SP" />
            </div>
            <div>
              <Label>Razao Social *</Label>
              <Input value={form.razao_social} onChange={function(e) { setForm(function(p) { return { ...p, razao_social: e.target.value }; }); }} />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia} onChange={function(e) { setForm(function(p) { return { ...p, nome_fantasia: e.target.value }; }); }} />
            </div>
            <div>
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={function(e) { setForm(function(p) { return { ...p, cnpj: e.target.value }; }); }} />
            </div>
            <div><Label>IE</Label><Input value={form.ie} onChange={function(e) { setForm(function(p) { return { ...p, ie: e.target.value }; }); }} /></div>
            <div><Label>RNTRC</Label><Input value={form.rntrc} onChange={function(e) { setForm(function(p) { return { ...p, rntrc: e.target.value }; }); }} /></div>
            <div><Label>CEP</Label><Input value={form.cep} onChange={function(e) { setForm(function(p) { return { ...p, cep: e.target.value }; }); }} /></div>
            <div><Label>Logradouro</Label><Input value={form.logradouro} onChange={function(e) { setForm(function(p) { return { ...p, logradouro: e.target.value }; }); }} /></div>
            <div><Label>Numero</Label><Input value={form.numero} onChange={function(e) { setForm(function(p) { return { ...p, numero: e.target.value }; }); }} /></div>
            <div><Label>Complemento</Label><Input value={form.complemento} onChange={function(e) { setForm(function(p) { return { ...p, complemento: e.target.value }; }); }} /></div>
            <div><Label>Bairro</Label><Input value={form.bairro} onChange={function(e) { setForm(function(p) { return { ...p, bairro: e.target.value }; }); }} /></div>
            <div><Label>Cidade</Label><Input value={form.cidade} onChange={function(e) { setForm(function(p) { return { ...p, cidade: e.target.value }; }); }} /></div>
            <div><Label>UF</Label><Input value={form.uf} onChange={function(e) { setForm(function(p) { return { ...p, uf: e.target.value }; }); }} maxLength={2} className="uppercase" /></div>
            <div><Label>Codigo IBGE</Label><Input value={form.codigo_ibge || ""} onChange={function(e) { setForm(function(p) { return { ...p, codigo_ibge: e.target.value || undefined }; }); }} placeholder="Codigo IBGE 7 digitos" /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={function(e) { setForm(function(p) { return { ...p, telefone: e.target.value }; }); }} /></div>
            <div><Label>E-mail</Label><Input value={form.email} onChange={function(e) { setForm(function(p) { return { ...p, email: e.target.value }; }); }} /></div>
            <div>
              <Label>Ambiente Fiscal</Label>
              <Select value={form.ambiente_fiscal} onValueChange={function(v) { setForm(function(p) { return { ...p, ambiente_fiscal: v }; }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologacao</SelectItem>
                  <SelectItem value="producao">Producao</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo} onCheckedChange={function(v) { setForm(function(p) { return { ...p, ativo: v }; }); }} />
                <Label>Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.padrao ?? false} onCheckedChange={function(v) { setForm(function(p) { return { ...p, padrao: v }; }); }} />
                <Label>Padrao</Label>
              </div>
            </div>
          </div>

          {editId && (
            <div className="border-t pt-4 mt-2">
              <Label className="text-sm font-semibold flex items-center gap-2 mb-2">Integracao Focus NFe</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Focus Empresa ID</Label>
                  <Input value={form.focus_empresa_id || ""} onChange={function(e) { setForm(function(p) { return { ...p, focus_empresa_id: e.target.value || null }; }); }} placeholder="ID da empresa na Focus" />
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.focus_token_configurado ?? false} onCheckedChange={function(v) { setForm(function(p) { return { ...p, focus_token_configurado: v }; }); }} />
                    <Label>Token configurado</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.certificado_configurado ?? false} onCheckedChange={function(v) { setForm(function(p) { return { ...p, certificado_configurado: v }; }); }} />
                    <Label>Certificado enviado</Label>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 mt-2 text-xs text-blue-700">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                O token Focus deve ser configurado em Supabase Secrets/Vault, nunca no frontend. Esta flag apenas indica que o token ja foi configurado no ambiente seguro.
              </div>

              {(() => {
                const checks: { label: string; ok: boolean }[] = [
                  { label: "CNPJ preenchido", ok: !!(form.cnpj && form.cnpj.replace(/\D/g,"").length >= 11) },
                  { label: "IE preenchida", ok: !!form.ie },
                  { label: "Endereco completo", ok: !!(form.cep && form.logradouro && form.cidade && form.uf) },
                  { label: "Codigo IBGE preenchido", ok: !!(form.codigo_ibge) },
                  { label: "Certificado enviado", ok: !!(form.certificado_configurado) },
                  { label: "Token configurado", ok: !!(form.focus_token_configurado) },
                  { label: "Ambiente definido", ok: !!(form.ambiente_fiscal) },
                ];
                const pronto = checks.every(function(c) { return c.ok; });
                return (
                  <div className="mt-3 p-3 bg-white rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold">Prontidao Focus</span>
                      <Badge className={pronto ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]" : "bg-amber-100 text-amber-700 border-amber-200 text-[10px]"}>
                        {pronto ? "Pronto para homologacao" : "Pendente"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {checks.map(function(c, i) { return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {c.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertTriangle className="w-3 h-3 text-amber-400" />}
                          <span className={c.ok ? "text-slate-600" : "text-amber-600"}>{c.label}</span>
                        </div>
                      ); })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="border-t pt-4 mt-2">
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2"><Shield className="w-4 h-4 text-primary" /> Certificado Digital A1</Label>
            {editId ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Arquivo:</Label>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={uploading} asChild>
                      <span>{uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Enviar .pfx/.p12</span>
                    </Button>
                    <input type="file" accept=".pfx,.p12" className="hidden" onChange={function(e) {
                      const file = e.target.files?.[0];
                      if (file) handleUploadCertificado(editId!, file);
                    }} />
                  </label>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  A senha do certificado nao e armazenada no sistema. Sera configurada futuramente em ambiente seguro (Vault) ou diretamente na Focus.
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Salve o emitente primeiro para habilitar o upload do certificado.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={function() { setModalOpen(false); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editId ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
