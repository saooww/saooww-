import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { haptic } from "../lib/haptics";
import { Sheet, useSheet } from "../ui/Sheet";
import { IconChip } from "../ui/primitives";

export interface PickerOption {
  value: string;
  label: string;
  sub?: ReactNode;
  iconName?: string;
  trailing?: ReactNode;
}

export interface PickerProps {
  title: string;
  options: PickerOption[];
  value?: string | null;
  onSelect: (value: string) => void;
  footer?: ReactNode;
}

export function PickerSheet({ title, options, value, onSelect, footer }: PickerProps) {
  const { close } = useSheet();
  return (
    <Sheet title={title}>
      <div className="mx-4 overflow-hidden panel rounded-lg [&>*+*]:hairline-t">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              haptic();
              onSelect(o.value);
              close();
            }}
            className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-press"
          >
            {o.iconName && <IconChip name={o.iconName} size={30} />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-body">{o.label}</div>
              {o.sub && <div className="truncate text-footnote text-ink-2">{o.sub}</div>}
            </div>
            {o.trailing}
            {value === o.value && <Check size={18} className="shrink-0 text-accent-ink" strokeWidth={2.4} />}
          </button>
        ))}
      </div>
      {footer && <div className="px-4 pt-3">{footer}</div>}
    </Sheet>
  );
}
