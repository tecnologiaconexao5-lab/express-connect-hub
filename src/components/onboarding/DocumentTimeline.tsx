import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload, CheckCircle2, XCircle, AlertTriangle,
  Clock, Eye, Ban, FileWarning,
  type LucideIcon,
} from "lucide-react";
import {
  subscribe, getTimeline, type TimelineEvent,
} from "@/services/documentQueue";
import { getDocumentLabel } from "@/services/documentAI";
import { cn } from "@/lib/utils";

const EVENT_ICONS: Record<string, LucideIcon> = {
  document_uploaded: Upload,
  analysis_started: Clock,
  analysis_completed: CheckCircle2,
  analysis_failed: AlertTriangle,
  auto_approved: CheckCircle2,
  auto_rejected: XCircle,
  manual_review: Eye,
  document_blocked: Ban,
  document_expired: FileWarning,
};

const EVENT_COLORS: Record<string, string> = {
  document_uploaded: "bg-blue-100 text-blue-600 border-blue-200",
  analysis_started: "bg-blue-100 text-blue-600 border-blue-200",
  analysis_completed: "bg-green-100 text-green-600 border-green-200",
  analysis_failed: "bg-amber-100 text-amber-600 border-amber-200",
  auto_approved: "bg-green-100 text-green-600 border-green-200",
  auto_rejected: "bg-red-100 text-red-600 border-red-200",
  manual_review: "bg-purple-100 text-purple-600 border-purple-200",
  document_blocked: "bg-red-100 text-red-600 border-red-200",
  document_expired: "bg-red-100 text-red-600 border-red-200",
};

export default function DocumentTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    setEvents(getTimeline());
    const unsub = subscribe(() => {
      setEvents([...getTimeline()]);
    });
    return unsub;
  }, []);

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhuma validação realizada ainda
        </p>
        <p className="text-xs text-muted-foreground/60">
          Os eventos aparecerão aqui conforme os documentos forem analisados
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />

      <div className="space-y-4">
        {events.map((event, i) => {
          const Icon = EVENT_ICONS[event.type] || Upload;
          const colors = EVENT_COLORS[event.type] || "bg-muted text-muted-foreground border-border";

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative pl-10"
            >
              <div className={cn("absolute left-2.5 w-3 h-3 rounded-full border-2 ring-2 ring-background -translate-x-1/2 mt-1.5", colors.split(" ")[0])} />

              <div className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border", colors)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {getDocumentLabel(event.documentType)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.message}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
