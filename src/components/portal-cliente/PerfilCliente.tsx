import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2, FileText, MapPin, Users, Settings, Bell, UserCheck,
  Save, RefreshCw, CheckCircle, XCircle, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PortalKpiCard, PortalEmptyState } from "@/components/portal-cliente";
import {
  buscarPerfilCompleto,
  atualizarPerfil,
  buscarUsuariosVinculados,
  type PerfilCliente,
  type UsuarioVinculado,
} from "@/services/portalCliente/perfilClienteService";

interface PerfilClienteProps {
  clienteId: string;
  clienteNome?: string;
}

type Secao = "empresa" | "fiscal" | "endereco" | "contatos" | "operacional" | "notificacoes" | "usuarios";

const secoes: { id: Secao; label: string; icon: any }[] = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "fiscal", label: "Dados Fiscais", icon: FileText },
  { id: "endereco", label: "Endereço", icon: MapPin },
  { id: "contatos", label: "Contatos", icon: Users },
  { id: "operacional", label: "Operacionais", icon: Settings },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "usuarios", label: "Usuários", icon: UserCheck },
];

export default function PerfilCliente({ clienteId }: PerfilClienteProps) {
  const { toast } = useToast();
  const [perfil, setPerfil] = useState<PerfilCliente | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioVinculado[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSecao, setEditSecao] = useState<Secao | null>(null);

  const carregarPerfil = async () => {
    setLoading(true);
    const [p, u] = await Promise.all([
      buscarPerfilCompleto(clienteId),
      buscarUsuariosVinculados(clienteId),
    ]);
    setPerfil(p);
    setUsuarios(u);
    setLoading(false);
  };

  useEffect(() => {
    if (clienteId) carregarPerfil();
  }, [clienteId]);

  const handleSalvar = async (secao: Secao, dados: Partial<PerfilCliente>) => {
    setSaving(true);
    const result = await atualizarPerfil(clienteId, dados);
    setSaving(false);
    if (result.sucesso) {
      setEditSecao(null);
      setPerfil(prev => prev ? { ...prev, ...dados } : prev);
      toast({ title: "Perfil atualizado", description: "Alterações salvas com sucesso." });
    } else {
      toast({ title: "Erro ao salvar", description: result.erro || "Tente novamente.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#F97316] animate-spin" />
          <p className="text-sm font-medium text-[#64748B]">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <PortalEmptyState
        type="sem-dados"
        title="Perfil não encontrado"
        description="Não foi possível carregar os dados do seu perfil."
        actionLabel="Tentar novamente"
        onAction={carregarPerfil}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Perfil da Empresa</h2>
          <p className="text-sm font-medium text-slate-500">Gerencie os dados cadastrais e preferências da sua empresa.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-white border-slate-200" onClick={carregarPerfil}>
            <RefreshCw className="w-4 h-4 mr-2" /> Recarregar
          </Button>
        </div>
      </div>

      {/* Navegação rápida entre seções */}
      <div className="flex flex-wrap gap-2">
        {secoes.map(sec => (
          <button
            key={sec.id}
            onClick={() => {
              const el = document.getElementById(`secao-${sec.id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-[#E5E7EB] text-[#64748B] hover:text-[#F97316] hover:border-[#F97316]/30 transition-all"
          >
            <sec.icon className="w-3.5 h-3.5" />
            {sec.label}
          </button>
        ))}
      </div>

      {/* 1. DADOS DA EMPRESA */}
      <SectionCard
        id="secao-empresa"
        title="Dados da Empresa"
        icon={Building2}
        editing={editSecao === "empresa"}
        onEdit={() => setEditSecao(editSecao === "empresa" ? null : "empresa")}
        onSave={(dados) => handleSalvar("empresa", dados)}
        saving={saving}
        fields={[
          { label: "Razão Social", value: perfil.razao_social, readOnly: true, field: "razao_social" },
          { label: "Nome Fantasia", value: perfil.nome_fantasia, readOnly: true, field: "nome_fantasia" },
          { label: "CNPJ", value: perfil.cnpj, readOnly: true, field: "cnpj" },
          { label: "Inscrição Estadual", value: perfil.ie, readOnly: true, field: "ie" },
          { label: "Inscrição Municipal", value: perfil.inscricao_municipal, readOnly: true, field: "inscricao_municipal" },
          { label: "Segmento", value: perfil.segmento, readOnly: true, field: "segmento" },
          { label: "Porte", value: perfil.porte, readOnly: true, field: "porte" },
        ]}
      />

      {/* 2. DADOS FISCAIS */}
      <SectionCard
        id="secao-fiscal"
        title="Dados Fiscais"
        icon={FileText}
        editing={editSecao === "fiscal"}
        onEdit={() => setEditSecao(editSecao === "fiscal" ? null : "fiscal")}
        onSave={(dados) => handleSalvar("fiscal", dados)}
        saving={saving}
        fields={[
          { label: "Regime Tributário", value: perfil.regime_tributario, readOnly: true, field: "regime_tributario" },
          { label: "Optante Simples", value: perfil.optante_simples === true, readOnly: !(editSecao === "fiscal"), field: "optante_simples", type: "switch" },
          { label: "Alíquota ISS", value: perfil.aliquota_iss ? `${perfil.aliquota_iss}%` : "—", readOnly: true, field: "aliquota_iss" },
          { label: "CNAE", value: perfil.cnae, readOnly: true, field: "cnae" },
          { label: "CFOP Padrão", value: perfil.cfop_padrao, readOnly: true, field: "cfop_padrao" },
        ]}
      />

      {/* 3. ENDEREÇO */}
      <SectionCard
        id="secao-endereco"
        title="Endereço"
        icon={MapPin}
        editing={editSecao === "endereco"}
        onEdit={() => setEditSecao(editSecao === "endereco" ? null : "endereco")}
        onSave={(dados) => handleSalvar("endereco", dados)}
        saving={saving}
        fields={[
          { label: "CEP", value: perfil.cep, field: "cep" },
          { label: "Logradouro", value: perfil.logradouro, field: "logradouro" },
          { label: "Número", value: perfil.numero, field: "numero" },
          { label: "Bairro", value: perfil.bairro, field: "bairro" },
          { label: "Complemento", value: perfil.complemento, field: "complemento" },
          { label: "Cidade", value: perfil.cidade, field: "cidade" },
          { label: "UF", value: perfil.uf, field: "uf" },
        ]}
      />

      {/* 4. CONTATOS / RESPONSÁVEIS */}
      <SectionCard
        id="secao-contatos"
        title="Contatos e Responsáveis"
        icon={Users}
        editing={editSecao === "contatos"}
        onEdit={() => setEditSecao(editSecao === "contatos" ? null : "contatos")}
        onSave={(dados) => handleSalvar("contatos", dados)}
        saving={saving}
        fields={[
          { label: "Contato Principal", value: perfil.contato_principal, field: "contato_principal" },
          { label: "Telefone", value: perfil.telefone, field: "telefone" },
          { label: "WhatsApp", value: perfil.whatsapp, field: "whatsapp" },
          { label: "E-mail", value: perfil.email, field: "email" },
          { label: "Site", value: perfil.site, field: "site" },
          { label: "Resp. Operacional", value: perfil.responsavel_operacional, field: "responsavel_operacional" },
          { label: "Resp. Financeiro", value: perfil.responsavel_financeiro, field: "responsavel_financeiro" },
          { label: "Resp. Comercial", value: perfil.responsavel_comercial, field: "responsavel_comercial" },
        ]}
      />

      {/* 5. PREFERÊNCIAS OPERACIONAIS */}
      <SectionCard
        id="secao-operacional"
        title="Preferências Operacionais"
        icon={Settings}
        editing={editSecao === "operacional"}
        onEdit={() => setEditSecao(editSecao === "operacional" ? null : "operacional")}
        onSave={(dados) => handleSalvar("operacional", dados)}
        saving={saving}
        fields={[
          { label: "Tipo de Frete Preferencial", value: perfil.tipo_frete_preferencial || "Rodoviário", field: "tipo_frete_preferencial" },
          { label: "Veículo Preferencial", value: perfil.veiculo_preferencial, field: "veiculo_preferencial" },
          { label: "Horário Entrega Preferencial", value: perfil.horario_entrega_preferencial, field: "horario_entrega_preferencial" },
          { label: "Exige Agendamento", value: perfil.exige_agendamento ? "Sim" : "Não", readOnly: true, field: "exige_agendamento" },
          { label: "Exige SLA", value: perfil.exige_sla ? "Sim" : "Não", readOnly: true, field: "exige_sla" },
        ]}
      />

      {/* 6. PREFERÊNCIAS DE NOTIFICAÇÕES */}
      <SectionCard
        id="secao-notificacoes"
        title="Preferências de Notificações"
        icon={Bell}
        editing={editSecao === "notificacoes"}
        onEdit={() => setEditSecao(editSecao === "notificacoes" ? null : "notificacoes")}
        onSave={(dados) => handleSalvar("notificacoes", dados)}
        saving={saving}
        fields={[
          { label: "Notificar por E-mail", value: perfil.notificar_email === true, field: "notificar_email", type: "switch" },
          { label: "Notificar por WhatsApp", value: perfil.notificar_whatsapp === true, field: "notificar_whatsapp", type: "switch" },
          { label: "Mudança de Status", value: perfil.notificar_mudanca_status === true, field: "notificar_mudanca_status", type: "switch" },
          { label: "Comprovante disponível", value: perfil.notificar_comprovante === true, field: "notificar_comprovante", type: "switch" },
        ]}
      />

      {/* 7. USUÁRIOS VINCULADOS */}
      <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl" id="secao-usuarios">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-base text-[#111827] font-semibold">Usuários Vinculados</CardTitle>
              <p className="text-xs text-[#64748B]">Pessoas com acesso ao Portal do Cliente</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usuarios.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-10 h-10 mx-auto text-[#64748B]/30 mb-2" />
              <p className="text-sm font-bold text-[#111827]">Nenhum usuário vinculado</p>
              <p className="text-xs text-[#64748B] mt-1">Entre em contato com o suporte para gerenciar seus usuários.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {usuarios.map(u => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#F97316] flex items-center justify-center text-white text-sm font-bold">
                      {(u.email || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#111827]">{u.email}</p>
                      <p className="text-[10px] text-[#64748B]">
                        Vinculado desde {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Ativo
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== SUB-COMPONENTE: SectionCard com edição inline =====

interface FieldDef {
  label: string;
  value?: string;
  field: string;
  readOnly?: boolean;
  type?: "text" | "switch";
}

interface SectionCardProps {
  id: string;
  title: string;
  icon: any;
  editing: boolean;
  onEdit: () => void;
  onSave: (dados: Record<string, any>) => void;
  saving: boolean;
  fields: FieldDef[];
}

function SectionCard({ id, title, icon: Icon, editing, onEdit, onSave, saving, fields }: SectionCardProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    const initial: Record<string, any> = {};
    fields.forEach(f => {
      initial[f.field] = f.type === "switch" ? (f.value === true) : (f.value || "");
    });
    setFormData(initial);
  }, [fields]);

  const readOnlyCount = fields.filter(f => f.readOnly).length;
  const editableCount = fields.length - readOnlyCount;

  return (
    <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl" id={id}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#F97316]" />
          </div>
          <div>
            <CardTitle className="text-base text-[#111827] font-semibold">{title}</CardTitle>
            {editableCount === 0 && (
              <p className="text-[10px] text-[#64748B]">Campos somente leitura</p>
            )}
          </div>
        </div>
        {editableCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className={`text-xs font-bold rounded-full ${
              editing
                ? "text-red-500 hover:text-red-600 hover:bg-red-50"
                : "text-[#F97316] hover:text-[#EA580C] hover:bg-[#FFF7ED]"
            }`}
          >
            {editing ? <XCircle className="w-3.5 h-3.5 mr-1" /> : <Pencil className="w-3.5 h-3.5 mr-1" />}
            {editing ? "Cancelar" : "Editar"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {fields.map(f => (
            <div key={f.field} className="space-y-1">
              <Label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                {f.label}
              </Label>
              {f.readOnly || !editing ? (
                <div className="h-9 px-3 flex items-center bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg text-sm text-[#111827] font-medium">
                  {f.type === "switch" ? (
                    <span className={`flex items-center gap-1.5 ${f.value === true ? "text-emerald-600" : "text-[#64748B]"}`}>
                      {f.value === true ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {f.value === true ? "Sim" : "Não"}
                    </span>
                  ) : (
                    f.value || "—"
                  )}
                </div>
              ) : f.type === "switch" ? (
                <div className="h-9 flex items-center">
                  <Switch
                    checked={formData[f.field] === true || formData[f.field] === "true"}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, [f.field]: checked }))}
                  />
                  <span className="ml-2 text-xs text-[#64748B]">
                    {formData[f.field] ? "Ativo" : "Inativo"}
                  </span>
                </div>
              ) : (
                <Input
                  value={formData[f.field] || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, [f.field]: e.target.value }))}
                  className="bg-white border-[#E5E7EB] focus:border-[#F97316]/50 rounded-lg h-9 text-sm"
                  placeholder={f.label}
                />
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[#E5E7EB]">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="bg-white border-[#E5E7EB] text-sm rounded-full"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => onSave(formData)}
              disabled={saving}
              className="bg-[#F97316] hover:bg-[#EA580C] text-white text-sm rounded-full px-6"
            >
              {saving ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="w-3.5 h-3.5 mr-1" /> Salvar</>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
