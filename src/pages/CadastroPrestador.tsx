import { useState } from "react";
import { Truck, Send, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const TIPO_VEICULO_OPTIONS = [
  "Fiorino/Van", "VUC", "Truck", "Bitrem", "Carreta", "Rodotrem", "Outro"
];

const TIPO_CARROCERIA_OPTIONS = [
  "Baú Fechado", "Baú Refrigerado", "Sider", "Plataforma", "Graneleiro", "Tanque", "Outro"
];

const REGIAO_OPTIONS = [
  "Grande SP", "ABC Paulista", "Interior SP", "Litoral SP", "Rio de Janeiro", 
  "Belo Horizonte", "Paraná", "Santa Catarina", "Rio Grande do Sul", "Outro"
];

const COMO_CONHECEU_OPTIONS = [
  "Google", "Facebook/Instagram", "WhatsApp", "Indicação de prestador", 
  "Indicação de cliente", "Evento/Feira", "Radio", "Outro"
];

export default function CadastroPrestador() {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  
  const [formData, setFormData] = useState({
    nome_completo: "",
    cpf: "",
    telefone: "",
    whatsapp: "",
    cidade: "",
    regiao: "",
    tipo_veiculo: "",
    tipo_carroceria: "",
    placa: "",
    experiencia_anos: "",
    como_conheceu: "",
    mensagem_livre: ""
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_completo || !formData.telefone) {
      toast.error("Preencha os campos obrigatórios: Nome e Telefone");
      return;
    }

    setEnviando(true);
    
    try {
      const { error } = await supabase.from("candidatos").insert([{
        nome_completo: formData.nome_completo,
        cpf: formData.cpf || null,
        telefone: formData.telefone,
        whatsapp: formData.whatsapp || formData.telefone,
        cidade: formData.cidade || null,
        regiao: formData.regiao || null,
        tipo_veiculo: formData.tipo_veiculo || null,
        tipo_carroceria: formData.tipo_carroceria || null,
        placa: formData.placa || null,
        experiencia_anos: formData.experiencia_anos ? parseInt(formData.experiencia_anos) : null,
        como_conheceu: formData.como_conheceu || null,
        mensagem_livre: formData.mensagem_livre || null,
        canal_captacao: "link_direto",
        status: "interessado"
      }]);

      if (error) throw error;
      
      setEnviado(true);
      toast.success("Cadastro realizado com sucesso!");
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao enviar cadastro. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Cadastro Enviado!</h2>
            <p className="text-muted-foreground mb-4">
              Recebemos seu cadastro com sucesso. Nossa equipe entrará em contato em breve.
            </p>
            <p className="text-sm text-muted-foreground">
              Enquanto isso, prepare seus documentos: CNH, CRLV, ANTT e comprovante de residência.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/5 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-primary">Trabalhe Conosco</h1>
          <p className="text-muted-foreground mt-2">
            Faça parte da nossa rede de parceiros transporters
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cadastro de Candidato</CardTitle>
            <CardDescription>
              Preencha seus dados para fazer parte do nosso banco de talentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nome Completo *</label>
                  <Input 
                    placeholder="Seu nome completo"
                    value={formData.nome_completo}
                    onChange={(e) => handleChange("nome_completo", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">CPF</label>
                  <Input 
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => handleChange("cpf", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Telefone *</label>
                  <Input 
                    placeholder="(11) 99999-9999"
                    value={formData.telefone}
                    onChange={(e) => handleChange("telefone", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">WhatsApp</label>
                  <Input 
                    placeholder="(11) 99999-9999"
                    value={formData.whatsapp}
                    onChange={(e) => handleChange("whatsapp", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Cidade</label>
                  <Input 
                    placeholder="São Paulo"
                    value={formData.cidade}
                    onChange={(e) => handleChange("cidade", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Região de Atuação</label>
                  <Select value={formData.regiao} onValueChange={(v) => handleChange("regiao", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {REGIAO_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tipo de Veículo</label>
                  <Select value={formData.tipo_veiculo} onValueChange={(v) => handleChange("tipo_veiculo", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPO_VEICULO_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tipo de Carroceria</label>
                  <Select value={formData.tipo_carroceria} onValueChange={(v) => handleChange("tipo_carroceria", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TIPO_CARROCERIA_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Placa do Veículo</label>
                  <Input 
                    placeholder="ABC-1234"
                    value={formData.placa}
                    onChange={(e) => handleChange("placa", e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Anos de Experiência</label>
                  <Input 
                    type="number"
                    placeholder="0"
                    value={formData.experiencia_anos}
                    onChange={(e) => handleChange("experiencia_anos", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Como conheceu a Conexão Express?</label>
                  <Select value={formData.como_conheceu} onValueChange={(v) => handleChange("como_conheceu", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {COMO_CONHECEU_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Mensagem (opcional)</label>
                  <Textarea 
                    placeholder="Conte-nos um pouco sobre você..."
                    value={formData.mensagem_livre}
                    onChange={(e) => handleChange("mensagem_livre", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={enviando}>
                {enviando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar Cadastro
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
