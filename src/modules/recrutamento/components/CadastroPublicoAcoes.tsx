import { ChevronDown, Copy, ExternalLink, MessageCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mensagemConviteOfertas, obterLinkPublicoOfertas } from "@/lib/ofertaPublica";

export function CadastroPublicoAcoes() {
  const link = obterLinkPublicoOfertas();
  const mensagem = mensagemConviteOfertas(link);

  const abrirCadastro = () => {
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link do cadastro público copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link manualmente.");
    }
  };

  const compartilharWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(mensagem)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 bg-orange-500 px-2.5 text-white hover:bg-orange-600"
          aria-label="Cadastro Público de Prestadores"
          title="Cadastro Público de Prestadores"
        >
          <UserPlus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden lg:inline">Cadastro Público de Prestadores</span>
          <span className="lg:hidden">Cadastro Público</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Divulgação do cadastro</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={abrirCadastro}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Abrir cadastro público
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copiarLink()}>
          <Copy className="mr-2 h-4 w-4" />
          Copiar link
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={compartilharWhatsApp}>
          <MessageCircle className="mr-2 h-4 w-4" />
          Compartilhar no WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
