import { useMemo, useState } from "react";
import { Pause, Play, Plus, Repeat, SkipForward, Trash2, Zap } from "lucide-react";
import { cn } from "../../lib/cn";
import { addDays, capitalize, formatDate, formatRelative, todayKey } from "../../lib/dates";
import { activeWallets } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { amountToInput, formatMoney, parseAmount } from "../../lib/money";
import { anchorOf, freqLabel, freqShort, monthlyEquivalent } from "../../lib/recurrence";
import { useCategoryMap } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Frequency, ID, Recurring } from "../../store/types";
import { nav } from "../../store/ui";
import { confirmDelete, undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { Money } from "../../ui/Money";
import { Badge, Button, EmptyState, FormRow, Group, IconButton, IconChip, Row, Segmented, Toggle, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";

export function SubscriptionsScreen() {
  const recurring = useData((s) => s.recurring);
  const wallets = useData((s) => s.wallets);
  const cats = useCategoryMap();
  const base = useData((s) => s.settings.baseCurrency);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);

  const groups = useMemo(() => {
    const sorted = [...recurring].sort((a, b) => Number(b.active) - Number(a.active) || (a.nextDate < b.nextDate ? -1 : 1));
    return {
      subs: sorted.filter((r) => r.isSubscription),
      bills: sorted.filter((r) => !r.isSubscription && r.kind === "expense"),
      income: sorted.filter((r) => r.kind === "income"),
      transfers: sorted.filter((r) => r.kind === "transfer")
    };
  }, [recurring]);

  const monthlySubs = groups.subs.filter((r) => r.active).reduce((s, r) => s + monthlyEquivalent(r), 0);
  const monthlyAll = recurring.filter((r) => r.active && r.kind === "expense").reduce((s, r) => s + monthlyEquivalent(r), 0);
  const unused = groups.subs.filter((r) => r.active && (r.usage === "never" || r.usage === "rarely"));
  const unusedYear = unused.reduce((s, r) => s + monthlyEquivalent(r) * 12, 0);

  const row = (r: Recurring) => {
    const w = wallets.find((x) => x.id === r.walletId);
    const c = r.categoryId ? cats.get(r.categoryId) : undefined;
    const flagged = r.isSubscription && r.active && (r.usage === "never" || r.usage === "rarely");
    return (
      <Row
        key={r.id}
        leading={<IconChip name={r.kind === "transfer" ? "ArrowLeftRight" : c?.icon ?? "Repeat"} size={36} />}
        title={
          <span className={cn("flex items-center gap-2", !r.active && "text-ink-3")}>
            <span className="truncate">{r.title}</span>
            {flagged && <Badge tone="warning">{r.usage === "never" ? "не пользуюсь" : "редко"}</Badge>}
          </span>
        }
        subtitle={r.active ? `${capitalize(formatRelative(r.nextDate))} · ${formatDate(r.nextDate)}${w && w.id !== defaultWalletId ? ` · ${w.name}` : ""}` : "На паузе"}
        value={
          <span className="flex flex-col items-end">
            <Money value={r.kind === "income" ? r.amount : r.kind === "expense" ? -r.amount : r.amount} sign={r.kind === "transfer" ? "never" : "always"} tone={r.kind === "income" ? "positive" : "default"} currency={w?.currency ?? base} className="text-ink" />
            <span className="text-caption text-ink-3">{freqShort(r.freq, r.interval)}</span>
          </span>
        }
        onClick={() => nav.sheet("recurring", { editId: r.id })}
      />
    );
  };

  return (
    <Screen title="Подписки и платежи" large actions={<IconButton icon={Plus} label="Добавить" onClick={() => nav.sheet("recurring", { isSubscription: true })} />}>
      {recurring.length === 0 ? (
        <EmptyState icon={Repeat} title="Нет регулярных платежей" text="Добавьте подписки, связь, кредит или зарплату — они будут записываться сами и попадут в прогнозы." action={<Button size="md" icon={Plus} onClick={() => nav.sheet("recurring", { isSubscription: true })}>Добавить</Button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 px-4">
            <div className="panel rounded-md px-3.5 py-3">
              <div className="text-caption font-medium text-ink-2">Подписки в месяц</div>
              <Money value={monthlySubs} currency={base} className="mt-0.5 block text-headline font-semibold" />
              <div className="text-caption text-ink-3">{formatMoney(monthlySubs * 12, { currency: base })} в год</div>
            </div>
            <div className="panel rounded-md px-3.5 py-3">
              <div className="text-caption font-medium text-ink-2">Все регулярные списания</div>
              <Money value={monthlyAll} currency={base} className="mt-0.5 block text-headline font-semibold" />
              <div className="text-caption text-ink-3">в месяц</div>
            </div>
          </div>

          {unused.length > 0 && (
            <div className="mx-4 mt-3 flex items-start gap-3 rounded-lg border border-line-strong px-4 py-3">
              <Zap size={18} className="mt-0.5 shrink-0 text-warning" />
              <p className="text-subhead">
                {unused.length === 1 ? `«${unused[0].title}»` : `${unused.length} подписки`} вы почти не используете. Отмена сэкономит <span className="font-semibold">{formatMoney(unusedYear)}</span> в год.
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-5">
            {groups.subs.length > 0 && <Group header="Подписки">{groups.subs.map(row)}</Group>}
            {groups.bills.length > 0 && <Group header="Регулярные платежи">{groups.bills.map(row)}</Group>}
            {groups.income.length > 0 && <Group header="Регулярные поступления">{groups.income.map(row)}</Group>}
            {groups.transfers.length > 0 && <Group header="Автопереводы">{groups.transfers.map(row)}</Group>}
          </div>
          <p className="mt-4 px-5 text-caption text-ink-3">Операции записываются автоматически в день платежа, когда вы открываете приложение. Пометка «редко» — ваша собственная оценка: банковских данных об использовании у приложения нет.</p>
        </>
      )}
    </Screen>
  );
}

export function RecurringSheet({ editId, isSubscription: sub0 }: { editId?: ID; isSubscription?: boolean }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.recurring.find((r) => r.id === editId) : undefined));
  const wallets = useData((s) => s.wallets);
  const categories = useData((s) => s.categories);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const live = activeWallets(wallets);
  const [kind, setKind] = useState<Recurring["kind"]>(existing?.kind ?? "expense");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [amount, setAmount] = useState(existing ? amountToInput(existing.amount).replace(",", ".") : "");
  const [freq, setFreq] = useState<Frequency>(existing?.freq ?? "month");
  const [interval, setInterval_] = useState(existing?.interval ?? 1);
  const [nextDate, setNextDate] = useState(existing?.nextDate ?? addDays(todayKey(), 1));
  const [walletId, setWalletId] = useState(existing?.walletId ?? defaultWalletId ?? live[0]?.id ?? "");
  const [toWalletId, setToWalletId] = useState(existing?.toWalletId ?? live.find((w) => w.id !== walletId)?.id ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? (sub0 ? "c-subs" : ""));
  const [isSubscription, setIsSubscription] = useState(existing?.isSubscription ?? !!sub0);
  const [usage, setUsage] = useState<NonNullable<Recurring["usage"]>>(existing?.usage ?? "often");
  const [autoPost, setAutoPost] = useState(existing?.autoPost ?? true);
  const value = parseAmount(amount);
  const valid = title.trim().length > 0 && value > 0 && !!walletId && (kind !== "transfer" || (!!toWalletId && toWalletId !== walletId));

  const save = () => {
    if (!valid) return;
    const fields = {
      kind,
      title: title.trim(),
      amount: value,
      freq,
      interval: Math.max(1, interval),
      anchorDay: anchorOf(nextDate),
      nextDate,
      walletId,
      toWalletId: kind === "transfer" ? toWalletId : undefined,
      categoryId: kind === "transfer" ? undefined : categoryId || undefined,
      isSubscription: kind === "expense" && isSubscription,
      usage: kind === "expense" && isSubscription ? usage : undefined,
      autoPost
    };
    const st = useData.getState();
    if (existing) st.updateRecurring(existing.id, fields);
    else st.addRecurring({ ...fields, active: true });
    haptic("success");
    close();
  };

  return (
    <Sheet tall title={existing ? existing.title : isSubscription ? "Новая подписка" : "Регулярный платёж"} left={<SheetAction onClick={close}>Отмена</SheetAction>} right={<SheetAction strong disabled={!valid} onClick={save}>Готово</SheetAction>}>
      <div className="flex flex-col gap-5 pt-1">
        {existing && (
          <div className="grid grid-cols-3 gap-2 px-4">
            <QuickBtn icon={Zap} label="Записать сейчас" disabled={!existing.active} onClick={() => { undoable("Платёж записан", () => useData.getState().postRecurringNow(existing.id)); close(); }} />
            <QuickBtn icon={SkipForward} label="Пропустить раз" disabled={!existing.active} onClick={() => { undoable(`Следующий платёж: ${formatDate(existing.nextDate)} пропущен`, () => useData.getState().skipRecurring(existing.id)); close(); }} />
            <QuickBtn icon={existing.active ? Pause : Play} label={existing.active ? "Пауза" : "Возобновить"} onClick={() => { useData.getState().updateRecurring(existing.id, { active: !existing.active, nextDate: existing.active ? existing.nextDate : existing.nextDate < todayKey() ? todayKey() : existing.nextDate }); haptic(); close(); }} />
          </div>
        )}
        <div className="px-4">
          <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Списание" }, { value: "income", label: "Поступление" }, { value: "transfer", label: "Перевод" }]} />
        </div>
        <Group>
          <FormRow label="Название">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, музыка" maxLength={50} className={cn(inputCls, "text-right")} />
          </FormRow>
          <FormRow label="Сумма">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
          <FormRow label="Следующий раз">
            <input type="date" value={nextDate} onChange={(e) => e.target.value && setNextDate(e.target.value)} className={cn(inputCls, "text-right")} />
          </FormRow>
        </Group>
        <Group header="Периодичность" footer={freqLabel(freq, interval)}>
          <div className="p-3">
            <Segmented value={freq} onChange={setFreq} options={[{ value: "week", label: "Неделя" }, { value: "month", label: "Месяц" }, { value: "year", label: "Год" }, { value: "day", label: "День" }]} />
          </div>
          <FormRow label="Интервал">
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Меньше" onClick={() => setInterval_((v) => Math.max(1, v - 1))} className="grid h-8 w-8 place-items-center rounded-full tile text-headline">−</button>
              <span className="w-6 text-center tnum">{interval}</span>
              <button type="button" aria-label="Больше" onClick={() => setInterval_((v) => Math.min(24, v + 1))} className="grid h-8 w-8 place-items-center rounded-full tile text-headline">+</button>
            </div>
          </FormRow>
        </Group>
        <Group>
          <FormRow label={kind === "transfer" ? "Откуда" : "Кошелёк"}>
            <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
              {live.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </FormRow>
          {kind === "transfer" ? (
            <FormRow label="Куда">
              <select value={toWalletId} onChange={(e) => setToWalletId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
                {live.filter((w) => w.id !== walletId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </FormRow>
          ) : (
            <FormRow label="Категория">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={cn(inputCls, "appearance-none text-right")} dir="rtl">
                <option value="">Не выбрана</option>
                {categories.filter((c) => c.kind === kind && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormRow>
          )}
          <FormRow label="Записывать автоматически">
            <Toggle checked={autoPost} onChange={setAutoPost} label="Записывать автоматически" />
          </FormRow>
        </Group>
        {kind === "expense" && (
          <Group footer={isSubscription ? "Отметьте честно — приложение подскажет, от чего можно отказаться." : undefined}>
            <FormRow label="Это подписка">
              <Toggle checked={isSubscription} onChange={setIsSubscription} label="Это подписка" />
            </FormRow>
            {isSubscription && (
              <div className="px-3 pb-3">
                <div className="px-1 pb-2 text-footnote text-ink-2">Как часто пользуетесь</div>
                <Segmented value={usage} onChange={setUsage} options={[{ value: "often", label: "Часто" }, { value: "rarely", label: "Редко" }, { value: "never", label: "Почти нет" }]} />
              </div>
            )}
          </Group>
        )}
        {existing && (
          <div className="px-4">
            <Button
              variant="danger"
              block
              icon={Trash2}
              onClick={() =>
                confirmDelete({
                  title: `Удалить «${existing.title}»?`,
                  message: "Уже записанные операции останутся в истории.",
                  onConfirm: () => {
                    undoable("Регулярный платёж удалён", () => useData.getState().deleteRecurring(existing.id));
                    close();
                  }
                })
              }
            >
              Удалить
            </Button>
          </div>
        )}
        <p className="px-8 text-footnote text-ink-3">{monthlyEquivalent({ amount: value, freq, interval }) > 0 ? `≈ ${formatMoney(monthlyEquivalent({ amount: value, freq, interval }))} в месяц` : ""}</p>
      </div>
    </Sheet>
  );
}

function QuickBtn({ icon: Icon, label, onClick, disabled }: { icon: typeof Zap; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex flex-col items-center gap-1.5 panel rounded-md py-3 text-caption font-medium active:bg-surface-press disabled:opacity-40">
      <Icon size={18} strokeWidth={2} />
      {label}
    </button>
  );
}

