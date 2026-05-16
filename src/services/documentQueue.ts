import { DocumentType, autoApprove, DocumentAnalysisResult } from "./documentAI";

export type QueueStatus = "pending" | "processing" | "completed" | "failed" | "blocked";

export interface QueueItem {
  id: string;
  documentType: DocumentType;
  imageDataUrl: string;
  status: QueueStatus;
  result: DocumentAnalysisResult | null;
  autoApproved: boolean | null;
  reason: string | null;
  createdAt: string;
  processedAt: string | null;
  retryCount: number;
}

export type QueueEventType =
  | "document_uploaded"
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "auto_approved"
  | "auto_rejected"
  | "manual_review"
  | "document_blocked"
  | "document_expired";

export interface TimelineEvent {
  id: string;
  type: QueueEventType;
  documentType: DocumentType;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

let queue: QueueItem[] = [];
let timeline: TimelineEvent[] = [];
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export function getQueue(): QueueItem[] {
  return [...queue];
}

export function getTimeline(): TimelineEvent[] {
  return [...timeline];
}

function addTimeline(
  type: QueueEventType,
  documentType: DocumentType,
  message: string,
  metadata?: Record<string, unknown>,
) {
  timeline.unshift({
    id: crypto.randomUUID(),
    type,
    documentType,
    message,
    timestamp: new Date().toISOString(),
    metadata,
  });
  notify();
}

export function enqueueDocument(
  imageDataUrl: string,
  documentType: DocumentType,
  result?: DocumentAnalysisResult,
): string {
  const id = crypto.randomUUID();

  const item: QueueItem = {
    id,
    documentType,
    imageDataUrl,
    status: "pending",
    result: null,
    autoApproved: null,
    reason: null,
    createdAt: new Date().toISOString(),
    processedAt: null,
    retryCount: 0,
  };

  queue.push(item);
  addTimeline("document_uploaded", documentType, "Documento enviado para análise");

  if (result) {
    item.result = result;
    item.processedAt = new Date().toISOString();
    processResult(item, result);
  }

  notify();

  return id;
}

function processResult(item: QueueItem, result: DocumentAnalysisResult) {
  const approval = autoApprove(result);

  if (result.validation.isExpired) {
    item.status = "blocked";
    item.autoApproved = false;
    item.reason = "Documento vencido — bloqueio automático";
    addTimeline("document_expired", item.documentType, "Documento vencido — bloqueio automático aplicado", {
      validade: result.extractedData.validade,
    });
  } else if (approval.autoApproved) {
    item.status = "completed";
    item.autoApproved = true;
    item.reason = approval.reason;
    addTimeline("auto_approved", item.documentType, "Documento aprovado automaticamente", {
      confidence: result.validation.confidence,
    });
  } else if (approval.approved && !approval.autoApproved) {
    item.status = "completed";
    item.autoApproved = false;
    item.reason = approval.reason;
    addTimeline("manual_review", item.documentType, "Pré-aprovado, aguardando revisão manual", {
      confidence: result.validation.confidence,
    });
  } else {
    item.status = "failed";
    item.autoApproved = false;
    item.reason = approval.reason;
    addTimeline("auto_rejected", item.documentType, "Documento rejeitado — encaminhado para análise manual", {
      errors: result.validation.errors,
    });
  }
}

export function getDocumentStatus(
  documentType: DocumentType,
): { status: QueueStatus; result: DocumentAnalysisResult | null } | null {
  const items = queue.filter((i) => i.documentType === documentType);
  if (items.length === 0) return null;
  const latest = items[items.length - 1];
  return { status: latest.status, result: latest.result };
}

export function resetQueue() {
  queue = [];
  timeline = [];
  notify();
}
