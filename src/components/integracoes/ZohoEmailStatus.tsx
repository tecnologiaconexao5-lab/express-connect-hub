import { Mail, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getZohoStatus } from "@/services/email/zohoEmailService";

const EVENTOS_SUPORTADOS = [
  { evento: "cliente_criado", setor: "Cliente", descricao: "Boas-vindas e acesso ao portal" },
  { evento: "os_criada", setor: "Operacional", descricao: "Confirmação de criação da OS" },
  { evento: "orcamento_enviado", setor: "Comercial", descricao: "Envio de orçamento" },
  { evento: "orcamento_aprovado", setor: "Comercial", descricao: "Confirmação de aprovação" },
  { evento: "entrega_concluida", setor: "Cliente", descricao: "Notificação de entrega" },
  { evento: "comprovante_disponivel", setor: "Cliente", descricao: "Link para download do comprovante" },
  { evento: "boleto_disponivel", setor: "Financeiro", descricao: "Envio de boleto" },
  { evento: "pesquisa_satisfacao", setor: "Cliente", descricao: "Pesquisa após entrega" },
];

export function ZohoEmailStatus() {
  const status = getZohoStatus();

  const isConfigured = status.configured;
  const isN8nConfigured = status.n8nWebhook === "configurado";

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="w-5 h-5 text-orange-500" />
          Zoho Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          {isConfigured ? (
            <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
              <CheckCircle className="w-3 h-3" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <AlertCircle className="w-3 h-3" />
              Não configurado
            </Badge>
          )}
        </div>

        {isConfigured && (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">API URL:</span>
                <span className="font-mono text-xs truncate">{status.apiUrl}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-mono text-xs truncate">{status.fromEmail}</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Webhook n8n</span>
              {isN8nConfigured ? (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <XCircle className="w-3 h-3 mr-1" />
                  Não conectado
                </Badge>
              )}
            </div>
          </>
        )}

        {!isConfigured && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium mb-2">Configuração necessária:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
              <li>VITE_ZOHO_EMAIL_API_URL</li>
              <li>VITE_ZOHO_EMAIL_API_KEY</li>
              <li>VITE_ZOHO_EMAIL_FROM</li>
              <li>VITE_N8N_WEBHOOK_EMAIL_URL (opcional)</li>
            </ul>
          </div>
        )}

        <div className="border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Eventos suportados:</p>
          <div className="flex flex-wrap gap-1">
            {EVENTOS_SUPORTADOS.map((e) => (
              <Badge key={e.evento} variant="outline" className="text-[10px]">
                {e.evento}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ZohoEmailStatus;