import { useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import { addMonths, todayKey } from "../../lib/dates";
import { activeWallets, goalSaved } from "../../lib/finance";
import { monthlyTotals } from "../../lib/analytics";
import { haptic } from "../../lib/haptics";
import { amountToInput, formatMoney, parseAmount } from "../../lib/money";
import { GOAL_ICON_CHOICES, walletKindInfo } from "../../store/catalog";
import { useBalances, useEnvelopes, useLedger } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID } from "../../store/types";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";
import { NamedIcon } from "../../ui/icons";
import { Keypad, applyKey, type KeypadKey } from "../../ui/Keypad";
import { Money } from "../../ui/Money";
import { Button, Chip, FormRow, Group, Segmented, Toggle, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { AmountDisplay } from "../transactions/AmountDisplay";

const PRESETS = [
  { name: "Финансовая подушка", icon: "LifeBuoy", cushion: true },
  { name: "Отпуск", icon: "Plane", target: 250_000 },
  { name: "Автомобиль", icon: "Car", target: 2_500_000 },
  { name: "Квартира", icon: "House", target: 3_000_000 },
  { name: "Образование", icon: "GraduationCap", target: 200_000 }
];

export function GoalSheet({ editId }: { editId?: ID }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.goals.find((g) => g.id === editId) : undefined));
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const { entries } = useLedger();
  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "Target");
  const [target, setTarget] = useState(existing ? amountToInput(existing.target).replace(",", ".") : "");
  const [hasDeadline, setHasDeadline] = useState(!!existing?.deadline || !existing);
  const [deadline, setDeadline] = useState(existing?.deadline ?? addMonths(todayKey(), 12));
  const [mode, setMode] = useState<"envelope" | "wallet">(existing?.walletId ? "wallet" : "envelope");
  const live = activeWallets(wallets);
  const [walletId, setWalletId] = useState<ID | undefined>(existing?.walletId ?? live.find((w) => w.kind === "savings")?.id ?? live[0]?.id);
  const [primary, setPrimary] = useState(existing?.primary ?? false);

  const avgExpense = useMemo(() => {
    const m = monthlyTotals(entries, todayKey(), 4).slice(0, 3).filter((x) => x.expense > 0);
    return m.length ? m.reduce((s, x) => s + x.expense, 0) / m.length : 0;
  }, [entries]);

  const amount = parseAmount(target);
  const valid = name.trim().length > 0 && amount > 0 && (mode === "envelope" || !!walletId);
  const currency = mode === "wallet" ? wallets.find((w) => w.id === walletId)?.currency ?? base : existing?.currency ?? base;

  const save = () => {
    if (!valid) return;
    const st = useData.getState();
    const fields = {
      name: name.trim(),
      icon,
      target: amount,
      currency,
      deadline: hasDeadline ? deadline : undefined,
      walletId: mode === "wallet" ? walletId : undefined
    };
    if (existing) {
      st.updateGoal(existing.id, fields);
      if (!!existing.primary !== primary) st.setPrimaryGoal(existing.id);
    } else {
      const id = st.addGoal({ ...fields, primary });
      if (primary) st.setPrimaryGoal(id);
    }
    haptic("success");
    nav.toast(existing ? "Цель сохранена" : "Цель создана", { tone: "positive" });
    close();
  };

  return (
    <Sheet tall title={existing ? "Цель" : "Новая цель"} left={<SheetAction onClick={close}>Отмена</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>Готово</SheetAction>}>
      <div className="flex flex-col gap-5 pt-1">
        {!existing && (
          <div className="scroll-x flex gap-2 px-4">
            {PRESETS.map((p) => (
              <Chip
                key={p.name}
                selected={name === p.name}
                onClick={() => {
                  setName(p.name);
                  setIcon(p.icon);
                  if (p.cushion && avgExpense > 0) setTarget(String(Math.ceil((avgExpense * 6) / 100 / 10_000) * 10_000));
                  else if (p.target) setTarget(String(p.target));
                }}
              >
                {p.name}
              </Chip>
            ))}
          </div>
        )}

        <Group>
          <FormRow label="Название">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="На что копим" maxLength={40} className={cn(inputCls, "text-right")} />
          </FormRow>
          <FormRow label="Сумма цели">
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
        </Group>
        {name === "Финансовая подушка" && avgExpense > 0 && (
          <p className="-mt-3 px-8 text-footnote text-ink-3">Рекомендация: 6 месяцев ваших обычных расходов ≈ {formatMoney(Math.round(avgExpense * 6))}.</p>
        )}

        <Group header="Значок">
          <div className="grid grid-cols-6 gap-1 p-2">
            {GOAL_ICON_CHOICES.map((ic) => (
              <button key={ic} type="button" aria-label={ic} aria-pressed={icon === ic} onClick={() => setIcon(ic)} className={cn("grid aspect-square place-items-center rounded-full", icon === ic ? "bg-ink text-ink-inverse" : "active:bg-surface-3")}>
                <NamedIcon name={ic} size={20} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </Group>

        <Group>
          <FormRow label="Срок">
            <Toggle checked={hasDeadline} onChange={setHasDeadline} label="Есть срок" />
          </FormRow>
          {hasDeadline && (
            <FormRow label="Дата">
              <input type="date" value={deadline} min={todayKey()} onChange={(e) => e.target.value && setDeadline(e.target.value)} className={cn(inputCls, "text-right")} />
            </FormRow>
          )}
        </Group>

        <Group header="Где хранятся деньги" footer={mode === "wallet" ? "Прогресс будет равен балансу выбранного кошелька — удобно для накопительного счёта." : "У цели будет свой баланс: вы переносите в неё деньги из любого кошелька."}>
          <div className="p-3">
            <Segmented value={mode} onChange={setMode} options={[{ value: "envelope", label: "Свой баланс" }, { value: "wallet", label: "Кошелёк" }]} />
          </div>
          {mode === "wallet" && (
            <FormRow label="Кошелёк">
              <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
                {live.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </FormRow>
          )}
        </Group>

        <Group>
          <FormRow label="На главном экране">
            <Toggle checked={primary} onChange={setPrimary} label="Показывать на главном экране" />
          </FormRow>
        </Group>
      </div>
    </Sheet>
  );
}

/** Move money into a goal or take it back. */
export function GoalMoneySheet({ goalId, direction: d0 }: { goalId: ID; direction: "deposit" | "withdraw" }) {
  const { close } = useSheet();
  const goal = useData((s) => s.goals.find((g) => g.id === goalId));
  const wallets = useData((s) => s.wallets);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const balances = useBalances();
  const env = useEnvelopes();
  const [direction, setDirection] = useState(d0);
  const [buf, setBuf] = useState("");
  const live = activeWallets(wallets).filter((w) => w.id !== goal?.walletId && (!goal || w.currency === goal.currency));
  const [walletId, setWalletId] = useState<ID | undefined>(live.find((w) => w.id === defaultWalletId)?.id ?? live[0]?.id);
  if (!goal) return null;
  const saved = goalSaved(goal, env, balances);
  const amount = parseAmount(buf);
  const tooMuch = direction === "withdraw" && amount > saved;

  const save = () => {
    if (!amount || !walletId || tooMuch) {
      haptic("warning");
      return;
    }
    undoable(direction === "deposit" ? "Цель пополнена" : "Деньги возвращены в кошелёк", () => useData.getState().moveGoalMoney(goal.id, walletId, amount, direction));
    haptic("success");
    close();
  };

  return (
    <Sheet title={goal.name} left={<SheetAction onClick={close}>Отмена</SheetAction>}>
      <div className="flex flex-col gap-4">
        <div className="px-4">
          <Segmented value={direction} onChange={setDirection} options={[{ value: "deposit", label: "Пополнить" }, { value: "withdraw", label: "Снять" }]} />
        </div>
        <div className="flex flex-col items-center gap-1 py-2">
          <AmountDisplay buffer={buf} currency={goal.currency} />
          <div className={cn("text-footnote", tooMuch ? "text-negative" : "text-ink-3")}>
            {tooMuch ? "Больше, чем накоплено" : <>В цели <Money value={saved} currency={goal.currency} /></>}
          </div>
        </div>
        {live.length === 0 ? (
          <div className="px-6 text-center text-callout text-ink-2">Нужен ещё один кошелёк в {goal.currency}, чтобы переводить деньги в цель.</div>
        ) : (
          <div className="scroll-x flex gap-2 px-4">
            {live.map((w) => (
              <Chip key={w.id} selected={walletId === w.id} onClick={() => setWalletId(w.id)}>
                <NamedIcon name={walletKindInfo(w.kind).icon} size={14} className="mr-1 inline" />
                {w.name}
              </Chip>
            ))}
          </div>
        )}
        <Keypad compact onKey={(k: KeypadKey) => setBuf((b) => applyKey(b, k))} />
        <div className="px-4 pb-2">
          <Button block disabled={!amount || !walletId || tooMuch} onClick={save}>
            {direction === "deposit" ? "Пополнить цель" : "Вернуть в кошелёк"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
