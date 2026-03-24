import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { alertasCriticos, alertasAtencao, alertasInformativos } from "./mockData";

interface AlertItem {
  texto: string;
  detalhe: string;
}

const AlertBlock = ({ title, icon: Icon, items, borderColor, bgColor, iconColor, badgeColor }: {
  title: string; icon: any; items: AlertItem[];
  borderColor: string; bgColor: string; iconColor: string; badgeColor: string;
}) => (
  <Card className={`border-l-4 ${borderColor}`}>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeColor}`}>{items.length}</span>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 pt-0">
      {items.map((a, i) => (
        <div key={i} className={`rounded-lg p-3 ${bgColor}`}>
          <p className="text-sm font-medium">{a.texto}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{a.detalhe}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);

const TabAlertas = () => (
  <div className="space-y-6">
    <AlertBlock
      title="Críticos"
      icon={AlertTriangle}
      items={alertasCriticos}
      borderColor="border-red-500"
      bgColor="bg-red-50"
      iconColor="text-red-500"
      badgeColor="bg-red-100 text-red-700"
    />
    <AlertBlock
      title="Atenção"
      icon={AlertCircle}
      items={alertasAtencao}
      borderColor="border-yellow-500"
      bgColor="bg-yellow-50"
      iconColor="text-yellow-600"
      badgeColor="bg-yellow-100 text-yellow-700"
    />
    <AlertBlock
      title="Informativos"
      icon={Info}
      items={alertasInformativos}
      borderColor="border-blue-500"
      bgColor="bg-blue-50"
      iconColor="text-blue-500"
      badgeColor="bg-blue-100 text-blue-700"
    />
  </div>
);

export default TabAlertas;
