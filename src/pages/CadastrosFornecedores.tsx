import { useState } from "react";
import { Building2 } from "lucide-react";
import FornecedoresLista from "@/components/fornecedores/FornecedoresLista";
import FornecedorDetalhe from "@/components/fornecedores/FornecedorDetalhe";
import { Fornecedor } from "@/components/fornecedores/types";

const CadastrosFornecedores = () => {
  const [view, setView] = useState<"lista" | "detalhe" | "novo">("lista");
  const [selected, setSelected] = useState<Fornecedor | undefined>();

  if (view === "detalhe" || view === "novo") {
    return (
      <div className="animate-fade-in">
        <FornecedorDetalhe
          fornecedor={view === "detalhe" ? selected : undefined}
          onBack={() => { setView("lista"); setSelected(undefined); }}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in w-full max-w-none px-6 space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cadastros › Fornecedores</h1>
          <p className="text-sm text-muted-foreground">Gestao de fornecedores e parceiros comerciais.</p>
        </div>
      </div>
      <FornecedoresLista
        onSelect={(f) => { setSelected(f); setView("detalhe"); }}
        onNew={() => setView("novo")}
      />
    </div>
  );
};

export default CadastrosFornecedores;
