import type { RefObject } from "react";

import { Field, HelperText, Label } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { type OcrVerificationRecord } from "@/lib/ocr";

type OcrReviewCompactFormProps = {
  activeRecord: OcrVerificationRecord;
  reviewerNotes: string;
  rejectionReason: string;
  onReviewerNotesChange: (value: string) => void;
  onRejectionReasonChange: (value: string) => void;
  notesRef?: RefObject<HTMLTextAreaElement | null>;
};

export function OcrReviewCompactForm({
  activeRecord,
  reviewerNotes,
  rejectionReason,
  onReviewerNotesChange,
  onRejectionReasonChange,
  notesRef,
}: OcrReviewCompactFormProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Field>
        <Label htmlFor="ocr-reviewer-notes">Reviewer notes</Label>
        <Textarea
          ref={notesRef}
          id="ocr-reviewer-notes"
          value={reviewerNotes}
          onChange={(event) => onReviewerNotesChange(event.target.value)}
          rows={3}
          className="mt-xs"
        />
        <HelperText>
          Notes travel with draft #{activeRecord.id} and support handoff without leaving the keyboard flow.
        </HelperText>
      </Field>
      <Field>
        <Label htmlFor="ocr-rejection-reason">Rejection reason</Label>
        <Textarea
          id="ocr-rejection-reason"
          value={rejectionReason}
          onChange={(event) => onRejectionReasonChange(event.target.value)}
          rows={3}
          className="mt-xs"
        />
        <HelperText>Required before sending a draft back for correction.</HelperText>
      </Field>
    </div>
  );
}
