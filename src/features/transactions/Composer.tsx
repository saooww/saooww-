import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ArrowRight, CalendarDays, ChevronDown, Hash, LayoutGrid, MessageSquareText, Plus, Repeat, Star } from "lucide-react";
import { cn } from "../../lib/cn";
import { dayOf, formatDate, formatDayHeading, nowISO, timeOf, todayKey, addDays } from "../../lib/dates";
import { activeWallets } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { amountToInput, formatMoney, parseAmount, type Minor } from "../../lib/money";
import { anchorOf, freqLabel, nextAfter } from "../../lib/recurrence";
import { walletKindInfo } from "../../store/catalog";
import { useBalances, useCategoryUsage } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Favorite, Frequency, ID, Transaction } from "../../store/types";
import { nav } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Keypad, applyKey, type KeypadKey } from "../../ui/Keypad";
import { Money } from "../../ui/Money";
import { ease, spring } from "../../ui/motion";
import { Button, Chip, FormRow, Group, IconChip, Segmented, Toggle, inputCls } from "../../ui/primitives";
import { NamedIcon } from "../../ui/icons";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { TagInput } from "../../ui/TagInput";
import { AmountDisplay } from "./AmountDisplay";

type FlowKind = "expense" | "income" | "transfer";
type View = "main" | "from" | "to" | "categories" | "details";

export interface ComposerProps {
  kind?: FlowKind;
  walletId?: ID;
  toWalletId?: ID;
  categoryId?: ID;
  amount?: Minor;
  note?: string;
  editId?: ID;
}

const KIND_OPTIONS = [
  { value: "expense" as const, label: "Расход" },
  { value: "income" as const, label: "Доход" },
  { value: "transfer" as const, label: "Перевод" }
];

const KIND_GLOW: Record<"expense" | "income" | "transfer", string> = {
  expense: "color-mix(in srgb, var(--accent) 26%, transparent)",
  income: "color-mix(in srgb, var(--positive) 24%, transparent)",
  transfer: "color-mix(in srgb, var(--ink) 9%, transparent)"
};

const SAVE_LABEL: Record<FlowKind, string> = { expense: "Добавить расход", income: "Добавить доход", transfer: "Перевести" };

export function ComposerSheet(props: ComposerProps) {
  const { close, depth } = useSheet();
  const wallets = useData((s) => s.wallets);
  const categories = useData((s) => s.categories);
  const favorites = useData((s) => s.favorites);
  const transactions = useData((s) => s.transactions);
  const settings = useData((s) => s.settings);
  const recurringList = useData((s) => s.recurring);
  const balances = useBalances();

  const editing: Transaction | undefined = useMemo(() => (props.editId ? transactions.find((t) => t.id === props.editId) : undefined), [props.editId, transactions]);
  const lockedKind = editing && !["income", "expense", "transfer"].includes(editing.kind) ? editing.kind : null;
  const live = activeWallets(wallets);
  const fallbackWallet = props.walletId ?? (settings.defaultWalletId && live.some((w) => w.id === settings.defaultWalletId) ? settings.defaultWalletId : live[0]?.id);

  const [kind, setKind] = useState<FlowKind>((editing && !lockedKind ? (editing.kind as FlowKind) : props.kind) ?? "expense");
  const [buf, setBuf] = useState(amountToInput(editing?.amount ?? props.amount ?? 0));
  const [toBuf, setToBuf] = useState(amountToInput(editing?.toAmount ?? 0));
  const [field, setField] = useState<"amount" | "to">("amount");
  const [walletId, setWalletId] = useState<ID | undefined>(editing ? editing.walletId : fallbackWallet);
  const [toWalletId, setToWalletId] = useState<ID | undefined>(editing?.toWalletId ?? props.toWalletId ?? live.find((w) => w.id !== (editing?.walletId ?? fallbackWallet))?.id);
  const [categoryId, setCategoryId] = useState<ID | undefined>(editing?.categoryId ?? props.categoryId);
  const [date, setDate] = useState(editing?.date ?? nowISO());
  const [note, setNote] = useState(editing?.note ?? props.note ?? "");
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const [repeat, setRepeat] = useState<"none" | Frequency>("none");
  const [saveFav, setSaveFav] = useState(false);
  const [view, setView] = useState<View>("main");
  const [hint, setHint] = useState<string | null>(null);
  const amountCtl = useAnimationControls();
  const catCtl = useAnimationControls();

  const walletOf = (id?: ID) => wallets.find((w) => w.id === id);
  const from = walletOf(walletId);
  const to = walletOf(toWalletId);
  const currency = from?.currency ?? settings.baseCurrency;
  const cross = kind === "transfer" && !!to && !!from && to.currency !== from.currency;
  const amount = parseAmount(buf);
  const usage = useCategoryUsage(kind === "income" ? "income" : "expense");
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const editingRecurring = editing?.recurringId ? recurringList.find((r) => r.id === editing.recurringId) : undefined;

  // keep category consistent with kind
  useEffect(() => {
    if (kind === "transfer") return;
    const c = categoryId ? catMap.get(categoryId) : undefined;
    if (c && c.kind !== kind) setCategoryId(undefined);
  }, [kind, categoryId, catMap]);

  // transfer needs two different wallets
  useEffect(() => {
    if (kind === "transfer" && (!toWalletId || toWalletId === walletId)) setToWalletId(live.find((w) => w.id !== walletId)?.id);
    if (kind !== "transfer") setField("amount");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, walletId]);

  const press = (k: KeypadKey) => {
    setHint(null);
    if (field === "to") setToBuf((b) => applyKey(b, k));
    else setBuf((b) => applyKey(b, k));
  };

  // physical keyboard
  const pressRef = useRef(press);
  pressRef.current = press;
  const saveRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (view !== "main" || depth !== 0) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (/^[0-9]$/.test(e.key)) pressRef.current(e.key as KeypadKey);
      else if (e.key === "," || e.key === ".") pressRef.current(",");
      else if (e.key === "Backspace") pressRef.current("back");
      else if (e.key === "Enter") saveRef.current();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, depth]);

  const shake = (ctl: typeof amountCtl) => {
    haptic("warning");
    ctl.start({ x: [0, -9, 9, -6, 6, -2, 0], transition: { duration: 0.42 } });
  };

  const save = () => {
    if (!amount) {
      shake(amountCtl);
      setHint("Введите сумму");
      return;
    }
    if (!walletId || !from) {
      nav.toast("Сначала добавьте кошелёк", { tone: "warning" });
      return;
    }
    if (kind !== "transfer" && !lockedKind && !categoryId) {
      shake(catCtl);
      setHint("Выберите категорию");
      return;
    }
    let toAmount: Minor | undefined;
    if (kind === "transfer" && !lockedKind) {
      if (!toWalletId || toWalletId === walletId) {
        setHint("Выберите кошелёк назначения");
        haptic("warning");
        return;
      }
      if (cross) {
        toAmount = parseAmount(toBuf);
        if (!toAmount) {
          setField("to");
          shake(amountCtl);
          setHint("Сколько поступит на второй счёт?");
          return;
        }
      }
    }

    const st = useData.getState();
    const cleanNote = note.trim() || undefined;
    const effectiveKind = (lockedKind ?? kind) as Transaction["kind"];
    const fields: Partial<Transaction> = {
      kind: effectiveKind,
      amount,
      walletId,
      toWalletId: effectiveKind === "transfer" ? toWalletId : undefined,
      toAmount: effectiveKind === "transfer" ? toAmount : undefined,
      categoryId: effectiveKind === "income" || effectiveKind === "expense" ? categoryId : editing?.categoryId,
      date,
      note: cleanNote,
      tags
    };

    const isNew = !editing;
    const label = isNew ? (effectiveKind === "income" ? "Доход добавлен" : effectiveKind === "expense" ? "Расход добавлен" : "Перевод выполнен") : "Изменения сохранены";

    undoable(label, () => {
      let recurringId = editing?.recurringId;
      if (repeat !== "none" && !recurringId && (kind === "income" || kind === "expense" || kind === "transfer")) {
        const day = dayOf(date);
        const anchor = anchorOf(day);
        recurringId = st.addRecurring({
          kind,
          title: cleanNote || (categoryId ? catMap.get(categoryId)?.name : undefined) || "Перевод",
          amount,
          walletId,
          toWalletId: kind === "transfer" ? toWalletId : undefined,
          categoryId: kind === "transfer" ? undefined : categoryId,
          note: cleanNote,
          freq: repeat,
          interval: 1,
          anchorDay: anchor,
          nextDate: nextAfter(day, repeat, 1, anchor),
          autoPost: true,
          isSubscription: categoryId === "c-subs",
          active: true
        });
      }
      if (editing) st.updateTransaction(editing.id, { ...fields, recurringId });
      else st.addTransaction({ ...(fields as Omit<Transaction, "id" | "createdAt">), recurringId });
      if (saveFav && kind !== "transfer") {
        st.addFavorite({ kind, title: cleanNote || catMap.get(categoryId!)?.name || "Избранное", amount, walletId, categoryId, note: cleanNote });
      }
    });
    haptic("success");
    close();
  };
  saveRef.current = save;

  const applyFavorite = (f: Favorite) => {
    haptic();
    if (f.amount) setBuf(amountToInput(f.amount));
    if (f.categoryId) setCategoryId(f.categoryId);
    if (f.walletId && live.some((w) => w.id === f.walletId)) setWalletId(f.walletId);
    if (f.note) setNote(f.note);
    setHint(null);
  };

  const balanceAfter = from ? (balances[from.id] ?? 0) + (kind === "income" && !lockedKind ? amount : -amount) - (editing && editing.walletId === from.id ? effectOf(editing) : 0) : 0;
  const tagSuggestions = useMemo(() => {
    const count = new Map<string, number>();
    for (const t of transactions.slice(0, 500)) for (const tag of t.tags) count.set(tag, (count.get(tag) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [transactions]);

  const kindFavorites = favorites.filter((f) => f.kind === kind);
  const dateLabel = (() => {
    const d = dayOf(date);
    const rel = d === todayKey() || d === addDays(todayKey(), -1) ? formatDayHeading(d) : formatDate(d);
    return `${rel}, ${timeOf(date)}`;
  })();

  const titleFor: Record<View, string | undefined> = {
    main: editing ? "Изменить операцию" : undefined,
    from: kind === "transfer" ? "Откуда" : "Кошелёк",
    to: "Куда",
    categories: "Категория",
    details: "Подробности"
  };

  return (
    <Sheet
      tall
      ariaLabel={editing ? "Изменить операцию" : "Новая операция"}
      title={titleFor[view]}
      left={view === "main" ? <SheetAction onClick={close}>Отмена</SheetAction> : <SheetAction onClick={() => setView("main")}>Назад</SheetAction>}
      right={view === "details" ? <SheetAction strong onClick={() => setView("main")}>Готово</SheetAction> : undefined}
      contentClassName="flex flex-col"
    >
      <AnimatePresence mode="wait" initial={false}>
        {view === "main" && (
          <motion.div
            key="main"
            className="flex min-h-full flex-1 flex-col"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18, ease: ease.out }}
          >
            {!lockedKind && (
              <div className="shrink-0 px-4">
                <Segmented options={KIND_OPTIONS} value={kind} onChange={(v) => setKind(v)} />
              </div>
            )}

            {/* amount */}
            <motion.div animate={amountCtl} className="flex min-h-[148px] flex-1 flex-col items-center justify-center gap-3 px-4 py-3">
              {cross ? (
                <div className="flex w-full flex-col items-center gap-3">
                  <AmountDisplay compact buffer={buf} currency={from!.currency} active={field === "amount"} label="Списать" onClick={() => setField("amount")} glow={field === "amount" ? KIND_GLOW.transfer : undefined} />
                  <AmountDisplay compact buffer={toBuf} currency={to!.currency} active={field === "to"} label="Зачислить" onClick={() => setField("to")} />
                </div>
              ) : (
                <AmountDisplay buffer={buf} currency={currency} sign={kind === "income" ? "+" : undefined} glow={KIND_GLOW[kind]} />
              )}
              <div className="h-5 text-footnote">
                <AnimatePresence mode="wait">
                  {hint ? (
                    <motion.span key="hint" className="font-medium text-negative" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {hint}
                    </motion.span>
                  ) : from && amount > 0 ? (
                    <motion.span key="after" className="text-ink-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {kind === "income" ? "Станет" : "Останется"} <Money value={balanceAfter} currency={from.currency} className="text-ink-2" />
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* wallets */}
            <div className="flex shrink-0 items-center justify-center gap-2 px-4 pb-3">
              <WalletChip wide={kind !== "transfer" || !!lockedKind} name={from?.name ?? "Выберите кошелёк"} icon={from ? walletKindInfo(from.kind).icon : "Wallet"} onClick={() => setView("from")} />
              {kind === "transfer" && !lockedKind && (
                <>
                  <ArrowRight size={16} className="shrink-0 text-ink-3" />
                  <WalletChip name={to?.name ?? "Куда"} icon={to ? walletKindInfo(to.kind).icon : "Wallet"} onClick={() => setView("to")} />
                </>
              )}
            </div>

            {/* favourites */}
            {!editing && kind !== "transfer" && kindFavorites.length > 0 && (
              <div className="scroll-x flex shrink-0 gap-2 px-4 pb-3">
                {kindFavorites.map((f) => (
                  <Chip key={f.id} icon={Star} onClick={() => applyFavorite(f)}>
                    {f.title}
                    {f.amount ? <span className="ml-1 text-ink-2">{formatMoney(f.amount)}</span> : null}
                  </Chip>
                ))}
              </div>
            )}

            {/* categories */}
            {kind !== "transfer" && !lockedKind && (
              <motion.div animate={catCtl} className="scroll-x flex shrink-0 gap-1 px-3 pb-2">
                {usage.slice(0, 10).map((id) => {
                  const c = catMap.get(id)!;
                  return <CategoryItem key={id} name={c.name} icon={c.icon} color={c.color} selected={categoryId === id} onClick={() => { haptic(); setCategoryId(id); setHint(null); }} />;
                })}
                {categoryId && !usage.slice(0, 10).includes(categoryId) && catMap.get(categoryId) && (
                  <CategoryItem name={catMap.get(categoryId)!.name} icon={catMap.get(categoryId)!.icon} color={catMap.get(categoryId)!.color} selected onClick={() => {}} />
                )}
                <CategoryItem name="Все" iconNode={<LayoutGrid size={20} strokeWidth={1.8} />} onClick={() => setView("categories")} />
              </motion.div>
            )}

            {/* details */}
            <div className="scroll-x flex shrink-0 gap-2 px-4 pb-2.5">
              <Chip icon={CalendarDays} onClick={() => setView("details")}>{dateLabel}</Chip>
              <Chip icon={MessageSquareText} onClick={() => setView("details")} selected={!!note}>
                {note ? note : "Комментарий"}
              </Chip>
              <Chip icon={Hash} onClick={() => setView("details")} selected={tags.length > 0}>
                {tags.length ? tags.map((t) => `#${t}`).join(" ") : "Теги"}
              </Chip>
              {!editingRecurring && !lockedKind && (
                <Chip icon={Repeat} onClick={() => setView("details")} selected={repeat !== "none"}>
                  {repeat === "none" ? "Повтор" : freqLabel(repeat)}
                </Chip>
              )}
            </div>

            <div className="shrink-0">
              <Keypad onKey={press} compact />
            </div>

            <div className="shrink-0 px-4 pb-[calc(var(--safe-bottom)+10px)] pt-2.5">
              <Button block onClick={save}>
                {editing ? "Сохранить" : lockedKind ? "Сохранить" : SAVE_LABEL[kind]}
              </Button>
            </div>
          </motion.div>
        )}

        {(view === "from" || view === "to") && (
          <motion.div key={view} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.18, ease: ease.out }} className="pt-1">
            <Group>
              {live
                .filter((w) => view === "from" || w.id !== walletId)
                .map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      haptic();
                      if (view === "from") {
                        setWalletId(w.id);
                        if (w.id === toWalletId) setToWalletId(live.find((x) => x.id !== w.id)?.id);
                      } else setToWalletId(w.id);
                      setView("main");
                    }}
                    className={cn("flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-press")}
                  >
                    <IconChip name={walletKindInfo(w.kind).icon} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body">{w.name}</div>
                      <div className="text-footnote text-ink-2">{walletKindInfo(w.kind).label}</div>
                    </div>
                    <Money value={balances[w.id] ?? 0} currency={w.currency} privacy className="text-callout text-ink-2" />
                    {(view === "from" ? walletId : toWalletId) === w.id && <span className="ml-1 h-2 w-2 rounded-full bg-accent" />}
                  </button>
                ))}
            </Group>
          </motion.div>
        )}

        {view === "categories" && (
          <motion.div key="categories" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.18, ease: ease.out }} className="px-3 pt-1">
            <div className="grid grid-cols-4 gap-y-3">
              {categories
                .filter((c) => c.kind === (kind === "income" ? "income" : "expense") && !c.archived)
                .map((c) => (
                  <CategoryItem
                    key={c.id}
                    wide
                    name={c.name}
                    icon={c.icon}
                    color={c.color}
                    selected={categoryId === c.id}
                    onClick={() => {
                      haptic();
                      setCategoryId(c.id);
                      setHint(null);
                      setView("main");
                    }}
                  />
                ))}
              <CategoryItem
                wide
                name="Новая"
                iconNode={<Plus size={20} strokeWidth={2} />}
                onClick={() =>
                  nav.sheet("category", {
                    kind: kind === "income" ? "income" : "expense",
                    onCreated: (id: ID) => {
                      setCategoryId(id);
                      setView("main");
                    }
                  })
                }
              />
            </div>
          </motion.div>
        )}

        {view === "details" && (
          <motion.div key="details" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.18, ease: ease.out }} className="flex flex-col gap-5 pt-1">
            <Group>
              <FormRow label="Дата и время">
                <input type="datetime-local" value={date} max={`${addDays(todayKey(), 366)}T23:59`} onChange={(e) => e.target.value && setDate(e.target.value.slice(0, 16))} className={cn(inputCls, "text-right")} />
              </FormRow>
              <div className="flex gap-2 px-4 py-2.5">
                <Chip selected={dayOf(date) === todayKey()} onClick={() => setDate(`${todayKey()}T${timeOf(nowISO())}`)}>Сегодня</Chip>
                <Chip selected={dayOf(date) === addDays(todayKey(), -1)} onClick={() => setDate(`${addDays(todayKey(), -1)}T${timeOf(date) || "12:00"}`)}>Вчера</Chip>
              </div>
            </Group>
            <Group>
              <div className="px-4 py-3">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий" maxLength={120} enterKeyHint="done" className={inputCls} />
              </div>
            </Group>
            <Group header="Теги">
              <div className="px-4 py-3">
                <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
              </div>
            </Group>
            {!editingRecurring && !lockedKind && (
              <Group header="Повторять" footer={repeat !== "none" ? "Следующие операции будут записываться автоматически. Управлять ими можно в разделе «Подписки и платежи»." : undefined}>
                <div className="px-3 py-3">
                  <Segmented
                    value={repeat}
                    onChange={(v) => setRepeat(v)}
                    options={[
                      { value: "none", label: "Нет" },
                      { value: "week", label: "Неделя" },
                      { value: "month", label: "Месяц" },
                      { value: "year", label: "Год" }
                    ]}
                  />
                </div>
              </Group>
            )}
            {editingRecurring && (
              <Group footer={`Операция из регулярного платежа «${editingRecurring.title}»`}>
                <FormRow label="Повтор">
                  <span className="text-ink-2">{freqLabel(editingRecurring.freq, editingRecurring.interval)}</span>
                </FormRow>
              </Group>
            )}
            {!editing && kind !== "transfer" && (
              <Group footer="Появится над категориями — одно касание, и всё заполнено.">
                <FormRow label="Добавить в избранное">
                  <Toggle checked={saveFav} onChange={setSaveFav} label="Добавить в избранное" />
                </FormRow>
              </Group>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

function effectOf(tx: Transaction): Minor {
  if (tx.kind === "income") return tx.amount;
  if (tx.kind === "expense" || tx.kind === "transfer") return -tx.amount;
  return tx.flow === "out" ? -tx.amount : tx.amount;
}

function WalletChip({ name, icon, onClick, wide }: { name: string; icon: string; onClick: () => void; wide?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cn("flex h-9 min-w-0 items-center gap-2 rounded-full tile pl-2.5 pr-3 text-subhead font-medium", wide ? "max-w-[78%]" : "max-w-[46%]")}
    >
      <NamedIcon name={icon} size={16} strokeWidth={2} className="shrink-0 text-ink-2" />
      <span className="truncate">{name}</span>
      <ChevronDown size={15} className="shrink-0 text-ink-3" />
    </motion.button>
  );
}

function CategoryItem({
  name,
  icon,
  iconNode,
  color,
  selected,
  onClick,
  wide
}: {
  name: string;
  icon?: string;
  color?: string;
  iconNode?: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cn("flex shrink-0 flex-col items-center gap-1.5 px-0.5", wide ? "w-full" : "w-[70px]")}
    >
      <motion.span
        className={cn("grid h-[48px] w-[48px] place-items-center rounded-[16px]", !color && (selected ? "bg-ink text-ink-inverse" : "tile text-ink"))}
        animate={{ scale: selected ? 1.06 : 1 }}
        transition={spring.snappy}
        style={
          color
            ? selected
              ? {
                  color: "#fff",
                  background: `linear-gradient(180deg, color-mix(in srgb, ${color} 82%, white), ${color})`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 18px -8px ${color}`
                }
              : {
                  color,
                  background: `linear-gradient(180deg, color-mix(in srgb, ${color} 20%, transparent), color-mix(in srgb, ${color} 10%, transparent))`,
                  boxShadow: `inset 0 0 0 0.5px color-mix(in srgb, ${color} 22%, transparent)`
                }
            : undefined
        }
      >
        {iconNode ?? <NamedIcon name={icon} size={21} strokeWidth={selected ? 2 : 1.8} />}
      </motion.span>
      <span className={cn("line-clamp-2 h-[28px] text-center text-[11px] leading-[14px]", selected ? "font-semibold text-ink" : "text-ink-2")}>{name}</span>
    </motion.button>
  );
}
