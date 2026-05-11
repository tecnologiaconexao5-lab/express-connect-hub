import { LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PortalSectionCardProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  children: React.ReactNode;
  className?: string;
}

export function PortalSectionCard({
  title,
  description,
  action,
  children,
  className = "",
}: PortalSectionCardProps) {
  return (
    <Card className={`bg-white border-[#E5E7EB] shadow-sm rounded-2xl transition-all ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base text-[#111827] font-semibold">{title}</CardTitle>
          {description && (
            <p className="text-xs text-[#64748B]">{description}</p>
          )}
        </div>
        {action && (
          <Button
            variant="ghost"
            size="sm"
            className="text-[#F97316] hover:text-[#EA580C] hover:bg-[#FFF7ED]"
            onClick={action.onClick}
          >
            {action.icon && <action.icon className="w-4 h-4 mr-1" />}
            {action.label}
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}