import { ReactNode, useRef } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  cancelTestId?: string;
  confirmTestId?: string;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  cancelTestId,
  confirmTestId,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent
        className="max-w-xs sm:max-w-sm rounded-md bg-card border-card-border text-center gap-3"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <AlertDialogTitle className="text-center">{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-center">
          {description}
        </AlertDialogDescription>
        <div className="flex gap-2 pt-1">
          <Button
            ref={cancelRef}
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            data-testid={cancelTestId}
          >
            {cancelLabel}
          </Button>
          <Button
            className="flex-1"
            onClick={onConfirm}
            data-testid={confirmTestId}
          >
            {confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
