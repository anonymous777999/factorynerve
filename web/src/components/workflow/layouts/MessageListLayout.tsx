"use client";

// import { useMemo } from "react";  // Unused
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OcrPreviewResult } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface MessageListLayoutProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  className?: string;
}

export function MessageListLayout({ data, onCellChange, className }: MessageListLayoutProps) {
  const { headers = [], rows = [] } = data;

  // Detect columns
  const senderIdx = headers.findIndex(h => /sender|from|author|user|name/i.test(h));
  const timestampIdx = headers.findIndex(h => /timestamp|time|date|sent/i.test(h));
  const contentIdx = headers.findIndex(h => /content|message|text|body|msg/i.test(h));
  const statusIdx = headers.findIndex(h => /status|delivery|read|sent/i.test(h));

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header summary */}
      <Card className="border-[var(--border-strong)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Chat Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
            <span>Total messages: {rows.length}</span>
            {headers[senderIdx] && (
              <span>
                Participants: {[...new Set(rows.map(r => stringifyOcrCell(r[senderIdx])).filter(Boolean))].join(", ")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Message list */}
      <div className="space-y-2">
        {rows.map((row, rowIndex) => {
          const sender = senderIdx >= 0 ? stringifyOcrCell(row[senderIdx]) : "";
          const timestamp = timestampIdx >= 0 ? stringifyOcrCell(row[timestampIdx]) : "";
          const content = contentIdx >= 0 ? stringifyOcrCell(row[contentIdx]) : "";
          const status = statusIdx >= 0 ? stringifyOcrCell(row[statusIdx]) : "";
          const confidence = contentIdx >= 0 && row[contentIdx] && typeof row[contentIdx] === "object" 
            ? row[contentIdx].confidence 
            : undefined;

          return (
            <Card
              key={`msg-${rowIndex}`}
              className={cn(
                "border-[var(--border-strong)] transition-colors hover:bg-[var(--card-strong)]/30",
                senderIdx < 0 ? "" : ""
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Sender avatar */}
                  {sender && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                      {sender.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Header row: sender + timestamp */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {sender && (
                        <span className="text-sm font-semibold">{sender}</span>
                      )}
                      {timestamp && (
                        <span className="text-xs text-[var(--muted)]">{timestamp}</span>
                      )}
                      {status && (
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full",
                          status.toLowerCase() === "read" ? "bg-green-500/10 text-green-600" :
                          status.toLowerCase() === "delivered" ? "bg-blue-500/10 text-blue-600" :
                          "bg-gray-500/10 text-gray-600"
                        )}>
                          {status}
                        </span>
                      )}
                    </div>

                    {/* Message content */}
                    <div className="relative">
                      <textarea
                        value={content}
                        onChange={(e) => onCellChange(
                          rowIndex,
                          contentIdx >= 0 ? contentIdx : 0,
                          e.target.value
                        )}
                        rows={2}
                        className={cn(
                          "w-full rounded-lg border bg-[var(--card-strong)] px-3 py-2 text-sm transition-colors resize-none",
                          "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                          confidence ? confidenceBadgeClass(confidence) : ""
                        )}
                      />
                      {confidence !== undefined && (
                        <span className={cn(
                          "absolute right-2 bottom-2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                          confidenceBadgeClass(confidence)
                        )}>
                          {confidenceLabel(confidence)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {rows.length === 0 && (
          <Card className="border-dashed border-[var(--border-strong)]">
            <CardContent className="py-12 text-center text-[var(--muted)]">
              No messages extracted
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
