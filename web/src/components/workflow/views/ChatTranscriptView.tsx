"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OcrPreviewResult, type OcrCell } from "@/lib/ocr";
import { stringifyOcrCell } from "@/lib/ocr-review";

interface ChatMessage {
  sender: string;
  timestamp: string;
  content: string;
  confidence?: number;
  rawRowIndex: number;
}

function extractChatMessages(data: OcrPreviewResult): ChatMessage[] {
  const { headers = [], rows = [] } = data;
  const messages: ChatMessage[] = [];

  const senderColIndex = headers.findIndex((h) =>
    /sender|from|user|author|name|person/i.test(h)
  );
  const timestampColIndex = headers.findIndex((h) =>
    /timestamp|time|date|when|datetime|created/i.test(h)
  );
  const contentColIndex = headers.findIndex((h) =>
    /content|message|text|body|msg|chat|conversation|comment|note/i.test(h)
  );

  if (senderColIndex >= 0 && timestampColIndex >= 0 && contentColIndex >= 0) {
    rows.forEach((row, rowIndex) => {
      const senderCell = row[senderColIndex];
      const timestampCell = row[timestampColIndex];
      const contentCell = row[contentColIndex];

      if (contentCell) {
        const sender = senderCell ? stringifyOcrCell(senderCell) : "Unknown";
        const timestamp = timestampCell ? stringifyOcrCell(timestampCell) : "";
        const content = stringifyOcrCell(contentCell);
        const confidence = contentCell && typeof contentCell === "object" ? contentCell.confidence : undefined;
        messages.push({ sender, timestamp, content, confidence, rawRowIndex: rowIndex });
      }
    });
  } else if (headers.length >= 2) {
    rows.forEach((row, rowIndex) => {
      const firstCell = row[0];
      const secondCell = row[1];
      if (secondCell) {
        const first = firstCell ? stringifyOcrCell(firstCell) : "Unknown";
        const content = stringifyOcrCell(secondCell);
        const confidence = secondCell && typeof secondCell === "object" ? secondCell.confidence : undefined;

        const timestampMatch = first.match(/^(\d{1,2}[:/]\d{1,2}([:/]\d{1,2})?\s*(AM|PM)?|\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2})/i);
        let sender = first;
        let timestamp = "";
        if (timestampMatch) {
          timestamp = timestampMatch[1];
          sender = first.replace(timestampMatch[0], "").trim() || "Unknown";
        }
        messages.push({ sender, timestamp, content, confidence, rawRowIndex: rowIndex });
      }
    });
  } else if (headers.length === 1 && rows.length > 0) {
    rows.forEach((row, rowIndex) => {
      const cell = row[0];
      if (cell) {
        const content = stringifyOcrCell(cell);
        const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;
        messages.push({ sender: "Unknown", timestamp: "", content, confidence, rawRowIndex: rowIndex });
      }
    });
  }

  return messages;
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    const date = new Date(ts);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  } catch {
    // ignore
  }
  return ts;
}

function getSenderColor(sender: string): string {
  let hash = 0;
  for (let i = 0; i < sender.length; i++) {
    hash = sender.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

interface ChatTranscriptViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  className?: string;
}

export function ChatTranscriptView({
  data,
  onCellChange,
  className,
}: ChatTranscriptViewProps) {
  const messages = useMemo(() => extractChatMessages(data), [data]);

  return (
    <Card className={cn("border-[var(--border-strong)]", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Chat Transcript</CardTitle>
      </CardHeader>
      <CardContent className="p-0 max-h-[600px] overflow-y-auto">
        {messages.length > 0 ? (
          <div className="space-y-4 p-4">
            {messages.map((message, index) => (
              <div
                key={`msg-${index}`}
                className="flex gap-3"
              >
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                  style={{ backgroundColor: getSenderColor(message.sender) }}
                >
                  {message.sender.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-medium text-sm text-[var(--text)]">
                      {message.sender}
                    </span>
                    {message.timestamp && (
                      <span className="text-xs text-[var(--muted)] whitespace-nowrap">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    )}
                    {message.confidence !== undefined && (
                      <span
                        className="px-1.5 py-0.5 text-[9px] font-medium uppercase rounded"
                        style={{
                          backgroundColor:
                            message.confidence >= 0.85
                              ? "rgba(34,197,94,0.2)"
                              : message.confidence >= 0.5
                              ? "rgba(245,158,11,0.2)"
                              : "rgba(239,68,68,0.2)",
                          color:
                            message.confidence >= 0.85
                              ? "#4ade80"
                              : message.confidence >= 0.5
                              ? "#fbbf24"
                              : "#f87171",
                        }}
                      >
                        {message.confidence >= 0.85 ? "High" : message.confidence >= 0.5 ? "Med" : "Low"}
                      </span>
                    )}
                  </div>
                  <div
                    className="rounded-2xl bg-[var(--card-strong)] border border-[var(--border)] p-3 text-sm leading-relaxed text-[var(--text)]"
                  >
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--muted)]">
            No messages detected in this transcript.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
