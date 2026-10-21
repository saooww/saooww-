import { haptic } from "../lib/haptics";
import { Sheet, useSheet } from "../ui/Sheet";
import { Button } from "../ui/primitives";

export interface ConfirmProps {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/** Action-sheet style confirmation for anything that can't be taken back lightly. */
export function ConfirmSheet({ title, message, confirmLabel, cancelLabel = "Отмена", destructive = true, onConfirm }: ConfirmProps) {
  const { close } = useSheet();
  return (
    <Sheet ariaLabel={title}>
      <div className="px-6 pb-2 pt-2 text-center">
        <div className="text-title-3 font-semibold text-balance">{title}</div>
        {message && <p className="mx-auto mt-2 max-w-[320px] text-callout text-ink-2 text-balance">{message}</p>}
      </div>
      <div className="flex flex-col gap-2 px-4 pt-5">
        <Button
          variant={destructive ? "danger" : "primary"}
          block
          onClick={() => {
            haptic(destructive ? "warning" : "success");
            close();
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" block onClick={close}>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  );
}
