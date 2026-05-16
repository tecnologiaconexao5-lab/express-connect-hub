import { useState } from "react";
import { motion } from "framer-motion";
import { Truck, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UploadZone from "./UploadZone";
import { useOnboardingStore } from "./onboardingStore";

const TIPOS_VEICULO = [
  "Fiorino/Van",
  "VUC",
  "Truck",
  "Bitrem",
  "Carreta",
  "Rodotrem",
  "Outro",
];

const CAPACIDADES = [
  "Até 500 kg",
  "500 kg - 1 ton",
  "1 - 3 ton",
  "3 - 5 ton",
  "5 - 10 ton",
  "10 - 20 ton",
  "20+ ton",
];

export default function StepVehicle() {
  const {
    tipoVeiculo, modelo, placa, ano, capacidade, fotosVeiculo,
    updateField, addVehiclePhoto, removeVehiclePhoto,
  } = useOnboardingStore();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let error = "";
    switch (field) {
      case "tipoVeiculo":
        if (!tipoVeiculo) error = "Selecione o tipo de veículo";
        break;
      case "modelo":
        if (!modelo.trim()) error = "Modelo é obrigatório";
        break;
      case "placa":
        if (!placa.trim()) error = "Placa é obrigatória";
        break;
      case "ano":
        if (!ano) error = "Ano é obrigatório";
        break;
      case "capacidade":
        if (!capacidade) error = "Selecione a capacidade";
        break;
    }
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const formatPlaca = (v: string) => {
    return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Truck className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Veículo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Informações do seu veículo
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo de Veículo</Label>
          <Select
            value={tipoVeiculo}
            onValueChange={(v) => {
              updateField("tipoVeiculo", v);
              setTouched((prev) => ({ ...prev, tipoVeiculo: true }));
              setErrors((prev) => ({ ...prev, tipoVeiculo: "" }));
            }}
          >
            <SelectTrigger
              className={`h-12 text-base ${
                touched.tipoVeiculo && errors.tipoVeiculo ? "border-destructive ring-destructive/30" : ""
              }`}
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_VEICULO.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {touched.tipoVeiculo && errors.tipoVeiculo && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
              {errors.tipoVeiculo}
            </motion.p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="modelo">Modelo</Label>
          <Input
            id="modelo"
            placeholder="Ex: Sprinter 416"
            value={modelo}
            onChange={(e) => updateField("modelo", e.target.value)}
            onBlur={() => handleBlur("modelo")}
            className={`h-12 text-base ${
              touched.modelo && errors.modelo ? "border-destructive ring-destructive/30" : ""
            }`}
          />
          {touched.modelo && errors.modelo && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
              {errors.modelo}
            </motion.p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="placa">Placa</Label>
            <Input
              id="placa"
              placeholder="ABC1D23"
              value={placa}
              onChange={(e) => updateField("placa", formatPlaca(e.target.value))}
              onBlur={() => handleBlur("placa")}
              className={`h-12 text-base uppercase ${
                touched.placa && errors.placa ? "border-destructive ring-destructive/30" : ""
              }`}
            />
            {touched.placa && errors.placa && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
                {errors.placa}
              </motion.p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ano">Ano</Label>
            <Input
              id="ano"
              type="number"
              placeholder="2024"
              min="1990"
              max="2030"
              value={ano}
              onChange={(e) => updateField("ano", e.target.value)}
              onBlur={() => handleBlur("ano")}
              className={`h-12 text-base ${
                touched.ano && errors.ano ? "border-destructive ring-destructive/30" : ""
              }`}
            />
            {touched.ano && errors.ano && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
                {errors.ano}
              </motion.p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Capacidade de Carga</Label>
          <Select
            value={capacidade}
            onValueChange={(v) => {
              updateField("capacidade", v);
              setTouched((prev) => ({ ...prev, capacidade: true }));
              setErrors((prev) => ({ ...prev, capacidade: "" }));
            }}
          >
            <SelectTrigger
              className={`h-12 text-base ${
                touched.capacidade && errors.capacidade ? "border-destructive ring-destructive/30" : ""
              }`}
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {CAPACIDADES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {touched.capacidade && errors.capacidade && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-destructive">
              {errors.capacidade}
            </motion.p>
          )}
        </div>

        <div>
          <Label className="mb-2 block">Fotos do Veículo</Label>
          <div className="grid grid-cols-2 gap-3">
            {fotosVeiculo.map((foto, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-xl overflow-hidden aspect-square bg-muted border border-border group"
              >
                <img src={foto} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeVehiclePhoto(i)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </motion.div>
            ))}
            {fotosVeiculo.length < 6 && (
              <UploadZone
                value={null}
                onChange={(url) => addVehiclePhoto(url)}
                label={`Foto ${fotosVeiculo.length + 1}`}
                capture="environment"
                aspectRatio="square"
              />
            )}
          </div>
          {fotosVeiculo.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Adicione ao menos 1 foto do veículo
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
