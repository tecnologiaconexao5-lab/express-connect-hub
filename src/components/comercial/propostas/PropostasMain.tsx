import { useState } from "react";
import ListaPropostas from "./ListaPropostas";
import EditorProposta from "./EditorProposta";

export default function PropostasMain() {
  const [view, setView] = useState<"lista" | "editor">("lista");
  const [propostaEditando, setPropostaEditando] = useState<any>(null);
  const [modoEdicao, setModoEdicao] = useState<"novo_modelo" | "nova_personalizada" | "editar">("editar");

  const handleNovaProposta = (tipo: "modelo" | "personalizada", originModelo?: any) => {
    setModoEdicao(tipo === "modelo" ? "novo_modelo" : "nova_personalizada");
    setPropostaEditando(originModelo || null);
    setView("editor");
  };

  const handleEditarProposta = (proposta: any) => {
    setModoEdicao("editar");
    setPropostaEditando(proposta);
    setView("editor");
  };

  const handleBackToList = () => {
    setView("lista");
    setPropostaEditando(null);
  };

  return (
    <div className="w-full">
      {view === "lista" ? (
         <ListaPropostas 
            onNovaProposta={handleNovaProposta} 
            onEditar={handleEditarProposta} 
         />
      ) : (
         <EditorProposta 
            proposta={propostaEditando} 
            modo={modoEdicao} 
            onBack={handleBackToList}
         />
      )}
    </div>
  );
}
