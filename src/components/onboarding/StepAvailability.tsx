import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Package, Route, Warehouse, Map } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "./onboardingStore";

const REGIOES_OPCOES = [
  "Grande SP",
  "ABC Paulista",
  "Interior SP",
  "Litoral SP",
  "Rio de Janeiro",
  "Belo Horizonte",
  "Paraná",
  "Santa Catarina",
  "Rio Grande do Sul",
  "Centro-Oeste",
  "Nordeste",
  "Norte",
];

const TIPOS_CARGA = [
  "Carga Seca",
  "Carga Refrigerada",
  "Carga Perigosa",
  "Carga Viva",
  "Mudanças",
  "Alimentos",
  "Eletrônicos",
  "Outro",
];

const TIPOS_VIAGEM = [
  "Municipal",
  "Intermunicipal",
  "Estadual",
  "Interestadual",
];

export default function StepAvailability() {
  const {
    regioes, horariosInicio, horariosFim, tipoCarga, tipoViagem,
    fazColeta, fazEntrega, distanciaMaxima,
    updateField, toggleRegiao, toggleTipoViagem,
  } = useOnboardingStore();

  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Map className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Disponibilidade</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Defina sua área e horários de atuação
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Regiões de Atuação</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {REGIOES_OPCOES.map((regiao) => {
              const selected = regioes.includes(regiao);
              return (
                <motion.button
                  key={regiao}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleRegiao(regiao)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
                    selected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {regiao}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Horários Disponíveis</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="horarioInicio" className="text-xs">Início</Label>
              <Input
                id="horarioInicio"
                type="time"
                value={horariosInicio}
                onChange={(e) => updateField("horariosInicio", e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div>
              <Label htmlFor="horarioFim" className="text-xs">Fim</Label>
              <Input
                id="horarioFim"
                type="time"
                value={horariosFim}
                onChange={(e) => updateField("horariosFim", e.target.value)}
                className="h-12 text-base"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Tipo de Carga</Label>
          </div>
          <Select
            value={tipoCarga}
            onValueChange={(v) => updateField("tipoCarga", v)}
          >
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Selecione o tipo de carga" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_CARGA.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Tipo de Viagem</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIPOS_VIAGEM.map((tipo) => {
              const selected = tipoViagem.includes(tipo);
              return (
                <motion.button
                  key={tipo}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleTipoViagem(tipo)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
                    selected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {tipo}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">Serviços</Label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
              <div>
                <p className="text-sm font-medium">Faz Coleta</p>
                <p className="text-xs text-muted-foreground">Retirar carga no cliente</p>
              </div>
              <Switch
                checked={fazColeta}
                onCheckedChange={(v) => updateField("fazColeta", v)}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
              <div>
                <p className="text-sm font-medium">Faz Entrega</p>
                <p className="text-xs text-muted-foreground">Entregar no destino final</p>
              </div>
              <Switch
                checked={fazEntrega}
                onCheckedChange={(v) => updateField("fazEntrega", v)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="distancia">Distância Máxima (km)</Label>
          <Input
            id="distancia"
            type="number"
            placeholder="500"
            value={distanciaMaxima}
            onChange={(e) => updateField("distanciaMaxima", e.target.value)}
            className="h-12 text-base"
          />
        </div>
      </div>
    </motion.div>
  );
}
