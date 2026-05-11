import { useState } from "react";
import { LucideIcon, Check, ChevronRight, Building2, Users, Bell, Package, Truck, FileText, Settings, Sparkles, Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface OnboardingStep {
  id: string;
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  completado: boolean;
}

interface PortalOnboardingProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

const stepsDefault: OnboardingStep[] = [
  { id: "bemvindo", titulo: "Bem-vindo!", descricao: "Configure sua empresa", icon: Building2, completado: false },
  { id: "empresa", titulo: "Dados da Empresa", descricao: "Razão social, CNPJ", icon: Building2, completado: false },
  { id: "unidades", titulo: "Unidades", descricao: "Filiais e centros de custo", icon: Building2, completado: false },
  { id: "notificacoes", titulo: "Notificações", descricao: "Canais e preferências", icon: Bell, completado: false },
  { id: "usuarios", titulo: "Usuários", descricao: "Times e permissões", icon: Users, completado: false },
  { id: "primeiro_pedido", titulo: "Primeiro Pedido", descricao: "Crie sua primeira OS", icon: Package, completado: false },
  { id: "tutorial", titulo: "Tutorial", descricao: "Explore o portal", icon: Sparkles, completado: false },
];

export function PortalOnboarding({ onComplete, onSkip }: PortalOnboardingProps) {
  const [step, setStep] = useState(0);
  const [steps, setSteps] = useState<OnboardingStep[]>(stepsDefault);
  const [formData, setFormData] = useState({
    nomeEmpresa: "",
    cnpj: "",
    email: "",
    telefone: "",
  });

  const progresso = Math.round(((steps.filter(s => s.completado).length) / steps.length) * 100);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setSteps(prev => prev.map((s, i) => i === step ? { ...s, completado: true } : s));
      setStep(step + 1);
    } else {
      onComplete?.();
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  return (
    <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#F97316] flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[#111827]">Bem-vindo ao Portal Cliente!</h2>
          <p className="text-[#475569] mt-2">Vamos configurar sua experiência personalizada</p>
        </div>

        <Card className="bg-white border-[#E5E7EB] shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    i < step ? "bg-emerald-500" : i === step ? "bg-[#F97316]" : "bg-slate-200"
                  }`}>
                    {i < step || s.completado ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <s.icon className="w-4 h-4 text-[#64748B]" />
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-8 h-0.5 ${i < step ? "bg-emerald-500" : "bg-slate-200"}`} />
                  )}
                </div>
              ))}
            </div>

            <div className="mb-6">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F97316] transition-all"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <p className="text-sm text-[#64748B] mt-2 text-center">{progresso}% completo</p>
            </div>

            <div className="space-y-4">
              {step === 0 && (
                <div className="text-center py-8">
                  <Building2 className="w-16 h-16 mx-auto text-orange-600 mb-4" />
                  <h3 className="text-xl font-bold text-[#111827] mb-2">Configure sua Empresa</h3>
                  <p className="text-[#475569] mb-6">Personalize o portal com sua marca</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="Nome da empresa"
                      className="bg-white border-[#E5E7EB] text-[#111827]"
                      value={formData.nomeEmpresa}
                      onChange={(e) => setFormData({...formData, nomeEmpresa: e.target.value})}
                    />
                    <Input
                      placeholder="CNPJ"
                      className="bg-white border-[#E5E7EB] text-[#111827]"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                  <h3 className="text-xl font-bold text-[#111827] mb-2">Adicione suas Unidades</h3>
                  <p className="text-[#475569] mb-6">Filiais, CDs ou centros de custo</p>
                  <div className="p-4 bg-[#F8FAFC] rounded-lg border-2 border-dashed border-[#E5E7EB] text-center">
                    <Upload className="w-8 h-8 mx-auto text-[#64748B] mb-2" />
                    <p className="text-sm text-[#64748B]">Arraste ou clique para importar</p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="text-center py-8">
                  <Bell className="w-16 h-16 mx-auto text-amber-600 mb-4" />
                  <h3 className="text-xl font-bold text-[#111827] mb-2">Configure Notificações</h3>
                  <p className="text-[#475569] mb-6">Escolha como quieres recibir alertas</p>
                  <div className="space-y-2 text-left">
                    {["Entregas concluídas", "Ocorrências", "Atrasos", "Comprovantes"].map((n) => (
                      <label key={n} className="flex items-center gap-2 p-2 bg-[#F8FAFC] rounded-lg cursor-pointer">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span className="text-[#111827]">{n}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                  <h3 className="text-xl font-bold text-[#111827] mb-2">Convide sua Equipe</h3>
                  <p className="text-[#475569] mb-6">Adicione usuários com permissões</p>
                  <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white">
                    <Users className="w-4 h-4 mr-2" />
                    Adicionar Usuário
                  </Button>
                </div>
              )}

              {step === 4 && (
                <div className="text-center py-8">
                  <Package className="w-16 h-16 mx-auto text-cyan-600 mb-4" />
                  <h3 className="text-xl font-bold text-[#111827] mb-2">Crie seu Primeiro Pedido</h3>
                  <p className="text-[#475569] mb-6">Você está pronto para começar!</p>
                  <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white">
                    <Package className="w-4 h-4 mr-2" />
                    Criar Primeiro Pedido
                  </Button>
                </div>
              )}

              {step === 5 && (
                <div className="text-center py-8">
                  <Sparkles className="w-16 h-16 mx-auto text-orange-600 mb-4" />
                  <h3 className="text-xl font-bold text-[#111827] mb-2">Pronto!</h3>
                  <p className="text-[#475569] mb-6">Explore o portal e aproveite todos os recursos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["Dashboard", "Pedidos", "Rastreamento", "Financeiro", "Relatórios", "Configurações"].map((item) => (
                      <div key={item} className="p-3 bg-[#F8FAFC] rounded-lg text-center text-sm text-[#111827]">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#E5E7EB]">
              <Button variant="ghost" className="text-[#64748B] hover:text-[#111827]" onClick={handleSkip}>
                <X className="w-4 h-4 mr-2" />
                Pular
              </Button>
              <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white" onClick={handleNext}>
                {step < steps.length - 1 ? "Continuar" : "Finalizar"}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
