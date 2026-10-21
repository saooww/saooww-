import { useState } from "react";
import { FormRow, Group, inputCls } from "../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../ui/Sheet";

export function RangeSheet({ from: f0, to: t0, onApply }: { from: string; to: string; onApply: (from: string, to: string) => void }) {
  const { close } = useSheet();
  const [from, setFrom] = useState(f0);
  const [to, setTo] = useState(t0);
  const valid = from && to && from <= to;
  return (
    <Sheet
      title="Период"
      left={<SheetAction onClick={close}>Отмена</SheetAction>}
      right={
        <SheetAction
          strong
          disabled={!valid}
          onClick={() => {
            onApply(from, to);
            close();
          }}
        >
          Готово
        </SheetAction>
      }
    >
      <Group footer={!valid ? "Начало периода должно быть раньше конца." : undefined}>
        <FormRow label="С">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} text-right`} />
        </FormRow>
        <FormRow label="По">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} text-right`} />
        </FormRow>
      </Group>
    </Sheet>
  );
}
