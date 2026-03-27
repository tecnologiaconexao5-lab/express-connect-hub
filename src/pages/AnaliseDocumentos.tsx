import { useState } from "react";
import { FileCheck } from "lucide-react";
import { AnaliseLote } from "@/components/documentos/AnaliseLote";
import { StatusDocumental } from "@/components/documentos/StatusDocumental";

const AnaliseDocumentos = () => {
  const [activeTab, setActiveTab] = useState<"lote" | "status">("lote");

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Análise de Documentos IA</h1>
          <p className="text-sm text-muted-foreground">
            Análise inteligente de documentos usando Claude Vision
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("lote")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "lote"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Análise em Lote
        </button>
        <button
          onClick={() => setActiveTab("status")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "status"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Status Documental
        </button>
      </div>

      {activeTab === "lote" ? <AnaliseLote /> : <StatusDocumental />}
    </div>
  );
};

export default AnaliseDocumentos;
