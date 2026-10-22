import { useState } from "react";
import { cn } from "../lib/cn";
import { haptic } from "../lib/haptics";
import { CATEGORY_ICON_CHOICES, CHART_COLORS } from "../store/catalog";
import { useData } from "../store/store";
import type { ID } from "../store/types";
import { nav } from "../store/ui";
import { confirmDelete } from "../store/undo";
import { NamedIcon } from "../ui/icons";
import { Button, Group, Segmented, inputCls } from "../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../ui/Sheet";

export function CategorySheet({ kind: initialKind = "expense", editId, onCreated }: { kind?: "income" | "expense"; editId?: ID; onCreated?: (id: ID) => void }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.categories.find((c) => c.id === editId) : undefined));
  const count = useData((s) => s.categories.length);
  const [kind, setKind] = useState<"income" | "expense">(existing?.kind ?? initialKind);
  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "CircleDashed");
  const [color, setColor] = useState(existing?.color ?? CHART_COLORS[count % CHART_COLORS.length]);

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const st = useData.getState();
    if (existing) st.updateCategory(existing.id, { name: n, icon, color });
    else {
      const id = st.addCategory({ kind, name: n, icon, color });
      onCreated?.(id);
    }
    haptic("success");
    close();
  };

  return (
    <Sheet
      title={existing ? "Категория" : "Новая категория"}
      left={<SheetAction onClick={close}>Отмена</SheetAction>}
      right={<SheetAction strong disabled={!name.trim()} onClick={save}>Готово</SheetAction>}
    >
      <div className="flex flex-col gap-5 pt-1">
        <div className="flex flex-col items-center gap-3 px-4">
          <span className="grid h-16 w-16 place-items-center rounded-full tile">
            <NamedIcon name={icon} size={28} strokeWidth={1.8} />
          </span>
        </div>
        {!existing && (
          <div className="px-4">
            <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Расход" }, { value: "income", label: "Доход" }]} />
          </div>
        )}
        <Group>
          <div className="px-4 py-3.5">
            <input autoFocus={!existing} value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" maxLength={40} enterKeyHint="done" onKeyDown={(e) => e.key === "Enter" && save()} className={cn(inputCls, "text-headline")} />
          </div>
        </Group>
        <Group header="Значок">
          <div className="grid grid-cols-7 gap-1 p-2">
            {CATEGORY_ICON_CHOICES.map((ic) => (
              <button
                key={ic}
                type="button"
                aria-label={ic}
                aria-pressed={icon === ic}
                onClick={() => setIcon(ic)}
                className={cn("grid aspect-square place-items-center rounded-full transition-colors", icon === ic ? "bg-ink text-ink-inverse" : "text-ink active:bg-surface-3")}
              >
                <NamedIcon name={ic} size={19} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </Group>
        <Group header="Цвет на графиках">
          <div className="flex flex-wrap gap-2.5 p-3.5">
            {CHART_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Цвет ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className="h-8 w-8 rounded-full"
                style={{ background: c, boxShadow: color === c ? "0 0 0 2px var(--surface), 0 0 0 4px var(--ink)" : undefined }}
              />
            ))}
          </div>
        </Group>
        {existing && (
          <div className="px-4">
            <Button
              variant="danger"
              block
              onClick={() =>
                confirmDelete({
                  title: `Удалить «${existing.name}»?`,
                  message: "Если по категории есть операции, она будет скрыта из выбора, а история сохранится.",
                  onConfirm: () => {
                    const r = useData.getState().removeCategory(existing.id);
                    nav.toast(r === "archived" ? "Категория скрыта, история сохранена" : "Категория удалена");
                    close();
                  }
                })
              }
            >
              Удалить категорию
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
