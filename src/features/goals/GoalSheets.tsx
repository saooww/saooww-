import { useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import { addMonths, todayKey } from "../../lib/dates";
import { activeWallets, goalInfo, goalSaved } from "../../lib/finance";
import { monthlyTotals } from "../../lib/analytics";
import { haptic } from "../../lib/haptics";
import { amountToInput, formatMoney, parseAmount } from "../../lib/money";
import { GOAL_COLORS, GOAL_ICON_CHOICES, walletKindInfo } from "../../store/catalog";
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
import { tr } from "../../i18n/i18n";

const PRESETS = [
  { name: tr("Финансовая подушка"), icon: "LifeBuoy", cushion: true },
  { name: tr("Отпуск"), icon: "Plane", target: 250_000 },
  { name: tr("Автомобиль"), icon: "Car", target: 2_500_000 },
  { name: tr("Квартира"), icon: "House", target: 3_000_000 },
  { name: tr("Образование"), icon: "GraduationCap", target: 200_000 }
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
  const [color, setColor] = useState(existing?.color ?? GOAL_COLORS[0]);
  const allProjects = useData((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => !p.archived), [allProjects]);
  // the goal's task list: an existing one, none, or a new one named after the goal
  const [projectId, setProjectId] = useState<ID | "new" | undefined>(existing ? existing.projectId : undefined);

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
      walletId: mode === "wallet" ? walletId : undefined,
      color,
      projectId: projectId === "new" ? undefined : projectId
    };
    if (projectId === "new") fields.projectId = st.addProject({ name: name.trim(), icon, color });
    if (existing) {
      st.updateGoal(existing.id, fields);
      if (!!existing.primary !== primary) st.setPrimaryGoal(existing.id);
    } else {
      const id = st.addGoal({ ...fields, primary });
      if (primary) st.setPrimaryGoal(id);
    }
    haptic("success");
    nav.toast(existing ? tr("Цель сохранена") : tr("Цель создана"), { tone: "positive" });
    close();
  };

  return (
    <Sheet tall title={existing ? tr("Цель") : tr("Новая цель")} left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>{tr("Готово")}</SheetAction>}>
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
          <FormRow label={tr("Название")}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("На что копим")} maxLength={40} className={cn(inputCls, "text-right")} />
          </FormRow>
          <FormRow label={tr("Сумма цели")}>
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
        </Group>
        {name === tr("Финансовая подушка") && avgExpense > 0 && (
          <p className="-mt-3 px-8 text-footnote text-ink-3">{tr("Рекомендация: 6 месяцев ваших обычных расходов ≈")}{" "}{formatMoney(Math.round(avgExpense * 6))}.</p>
        )}

        <Group header={tr("Оформление")}>
          <div className="flex items-center justify-between gap-2 px-4 py-3" role="radiogroup" aria-label={tr("Цвет цели")}>
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => {
                  haptic();
                  setColor(c);
                }}
                className="h-8 w-8 rounded-full transition-[outline-color] duration-200"
                style={{ background: c, outline: `2px solid ${color === c ? "var(--ink)" : "transparent"}`, outlineOffset: 3 }}
              />
            ))}
          </div>
        </Group>

        <Group header={tr("Дела к цели")} footer={tr("Список дел появится на карточке цели: билеты, отели, маршрут — всё, что нужно сделать, рядом с деньгами.")}>
          <div className="scroll-x flex gap-2 px-4 py-3">
            <Chip selected={!projectId} onClick={() => setProjectId(undefined)}>{tr("Без списка")}</Chip>
            <Chip selected={projectId === "new"} onClick={() => setProjectId("new")}>{tr("+ Новый список")}</Chip>
            {projects.map((p) => (
              <Chip key={p.id} selected={projectId === p.id} onClick={() => setProjectId(p.id)}>
                {p.name}
              </Chip>
            ))}
          </div>
        </Group>

        <Group header={tr("Значок")}>
          <div className="grid grid-cols-6 gap-1 p-2">
            {GOAL_ICON_CHOICES.map((ic) => (
              <button key={ic} type="button" aria-label={ic} aria-pressed={icon === ic} onClick={() => setIcon(ic)} className={cn("grid aspect-square place-items-center rounded-full", icon === ic ? "bg-ink text-ink-inverse" : "active:bg-surface-3")}>
                <NamedIcon name={ic} size={20} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </Group>

        <Group>
          <FormRow label={tr("Срок")}>
            <Toggle checked={hasDeadline} onChange={setHasDeadline} label={tr("Есть срок")} />
          </FormRow>
          {hasDeadline && (
            <FormRow label={tr("Дата")}>
              <input type="date" value={deadline} min={todayKey()} onChange={(e) => e.target.value && setDeadline(e.target.value)} className={cn(inputCls, "text-right")} />
            </FormRow>
          )}
        </Group>

        <Group header={tr("Где хранятся деньги")} footer={mode === "wallet" ? tr("Прогресс будет равен балансу выбранного кошелька — удобно для накопительного счёта.") : tr("У цели будет свой баланс: вы переносите в неё деньги из любого кошелька.")}>
          <div className="p-3">
            <Segmented value={mode} onChange={setMode} options={[{ value: "envelope", label: tr("Свой баланс") }, { value: "wallet", label: tr("Кошелёк") }]} />
          </div>
          {mode === "wallet" && (
            <FormRow label={tr("Кошелёк")}>
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
          <FormRow label={tr("На главном экране")}>
            <Toggle checked={primary} onChange={setPrimary} label={tr("Показывать на главном экране")} />
          </FormRow>
        </Group>
      </div>
    </Sheet>
  );
}

/** Move money into a goal or take it back. */
export function GoalMoneySheet({ goalId, direction: d0, amount: preset }: { goalId: ID; direction: "deposit" | "withdraw"; /** Suggested amount, e.g. from «Спросить Ardessa» */ amount?: number }) {
  const { close } = useSheet();
  const goal = useData((s) => s.goals.find((g) => g.id === goalId));
  const wallets = useData((s) => s.wallets);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const balances = useBalances();
  const env = useEnvelopes();
  const [direction, setDirection] = useState(d0);
  const [buf, setBuf] = useState(preset ? amountToInput(preset) : "");
  const live = activeWallets(wallets).filter((w) => w.id !== goal?.walletId && (!goal || w.currency === goal.currency));
  const [walletId, setWalletId] = useState<ID | undefined>(live.find((w) => w.id === defaultWalletId)?.id ?? live[0]?.id);
  if (!goal) return null;
  const saved = goalSaved(goal, env, balances);
  const amount = parseAmount(buf);
  const tooMuch = direction === "withdraw" && amount > saved;
  const info = goalInfo(goal, saved, todayKey());
  const fmt = (v: number) => formatMoney(v, { currency: goal.currency });
  const quick: Array<{ label: string; amount: number }> =
    direction === "deposit"
      ? [
          ...(info.monthly ? [{ label: tr("В месяц · {0}", fmt(info.monthly)), amount: info.monthly }] : []),
          ...(info.remaining > 0 && info.remaining !== info.monthly ? [{ label: tr("Остаток · {0}", fmt(info.remaining)), amount: info.remaining }] : []),
          ...[100_000, 500_000, 1_000_000].map((v) => ({ label: fmt(v), amount: v }))
        ]
      : saved > 0
        ? [{ label: tr("Всё · {0}", fmt(saved)), amount: saved }, ...(saved >= 200_000 ? [{ label: tr("Половину · {0}", fmt(Math.round(saved / 200) * 100)), amount: Math.round(saved / 200) * 100 }] : [])]
        : [];

  const save = () => {
    if (!amount || !walletId || tooMuch) {
      haptic("warning");
      return;
    }
    undoable(direction === "deposit" ? tr("Цель пополнена") : tr("Деньги возвращены в кошелёк"), () => useData.getState().moveGoalMoney(goal.id, walletId, amount, direction));
    haptic("success");
    close();
  };

  return (
    <Sheet title={goal.name} left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>}>
      <div className="flex flex-col gap-4">
        <div className="px-4">
          <Segmented value={direction} onChange={setDirection} options={[{ value: "deposit", label: tr("Пополнить") }, { value: "withdraw", label: tr("Снять") }]} />
        </div>
        <div className="flex flex-col items-center gap-1 py-2">
          <AmountDisplay buffer={buf} currency={goal.currency} />
          <div className={cn("text-footnote", tooMuch ? "text-negative" : "text-ink-3")}>
            {tooMuch ? tr("Больше, чем накоплено") : <>{tr("В цели")}{" "}<Money value={saved} currency={goal.currency} /></>}
          </div>
        </div>
        {/* ready-made amounts: the monthly instalment, what's left, round sums */}
        <div className="scroll-x flex gap-2 px-4">
          {quick.map((q) => (
            <Chip key={q.label} selected={amount === q.amount} onClick={() => setBuf(amountToInput(q.amount).replace(/\s/g, ""))}>
              {q.label}
            </Chip>
          ))}
        </div>
        {live.length === 0 ? (
          <div className="px-6 text-center text-callout text-ink-2">{tr("Нужен ещё один кошелёк в")}{" "}{goal.currency}{tr(", чтобы переводить деньги в цель.")}</div>
        ) : (
          <div>
            <div className="section-label px-5 pb-2">{direction === "deposit" ? tr("С кошелька") : tr("В кошелёк")}</div>
            <div className="scroll-x flex gap-2 px-4">
            {live.map((w) => (
              <Chip key={w.id} selected={walletId === w.id} onClick={() => setWalletId(w.id)}>
                <NamedIcon name={walletKindInfo(w.kind).icon} size={14} className="mr-1 inline" />
                {w.name}
              </Chip>
            ))}
            </div>
          </div>
        )}
        <Keypad compact onKey={(k: KeypadKey) => setBuf((b) => applyKey(b, k))} />
        <div className="px-4 pb-2">
          <Button block disabled={!amount || !walletId || tooMuch} onClick={save}>
            {direction === "deposit" ? tr("Пополнить цель") : tr("Вернуть в кошелёк")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
