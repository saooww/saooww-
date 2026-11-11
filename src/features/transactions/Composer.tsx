import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, CalendarDays, Camera, ChevronDown, Hash, LayoutGrid, MessageSquareText, Plus, Repeat, Split, Star, X, type LucideIcon } from "../../ui/glyphs";
import { applyCalcKey, evaluate, formatExpression, hasOperator, type CalcKey } from "../../lib/calc";
import { cn } from "../../lib/cn";
import { dayOf, formatDate, formatDayHeading, nowISO, timeOf, todayKey, addDays } from "../../lib/dates";
import { activeWallets } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { amountToInput, formatMoney, parseAmount, type Minor } from "../../lib/money";
import { anchorOf, freqLabel, nextAfter } from "../../lib/recurrence";
import { uid } from "../../lib/id";
import { walletKindInfo } from "../../store/catalog";
import { useBalances, useCategoryUsage } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Category, Favorite, Frequency, ID, Transaction } from "../../store/types";
import { photosSupported } from "../../store/photos";
import { PhotoStrip } from "./Photos";
import { nav, useUI } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Keypad } from "../../ui/Keypad";
import { Money } from "../../ui/Money";
import { ease, spring } from "../../ui/motion";
import { Button, Chip, FormRow, Group, IconButton, IconChip, Row, Segmented, Toggle, inputCls } from "../../ui/primitives";
import { NamedIcon } from "../../ui/icons";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { TagInput } from "../../ui/TagInput";
import { AmountDisplay } from "./AmountDisplay";
import { tr } from "../../i18n/i18n";

type FlowKind = "expense" | "income" | "transfer";
type View = "main" | "from" | "to" | "categories" | "details" | "split";

/** One extra category of a split receipt; whatever is left stays in the main category. */
interface Part {
  key: string;
  categoryId?: ID;
  buf: string;
}

export interface ComposerProps {
  kind?: FlowKind;
  walletId?: ID;
  toWalletId?: ID;
  categoryId?: ID;
  amount?: Minor;
  note?: string;
  editId?: ID;
}

const KIND_ORDER: FlowKind[] = ["expense", "income", "transfer"];

/** Each kind has its own colour: the switch, the light behind the amount and the button follow it. */
const KIND_META: Record<FlowKind, { label: string; icon: LucideIcon; fill: string; on: string; tint: string; shadow?: string }> = {
  expense: { label: tr("Расход"), icon: ArrowUpRight, fill: "fill-accent", on: "text-[var(--accent-on)]", tint: "text-accent-ink", shadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 24px -10px color-mix(in srgb, var(--accent) 70%, transparent)" },
  income: { label: tr("Доход"), icon: ArrowDownLeft, fill: "fill-positive", on: "text-[var(--positive-on)]", tint: "text-positive", shadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 24px -10px color-mix(in srgb, var(--positive) 70%, transparent)" },
  transfer: { label: tr("Перевод"), icon: ArrowLeftRight, fill: "fill-transfer", on: "text-white", tint: "text-[var(--transfer)]", shadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 24px -10px color-mix(in srgb, var(--transfer) 70%, transparent)" }
};


const SAVE_LABEL: Record<FlowKind, string> = { expense: tr("Добавить расход"), income: tr("Добавить доход"), transfer: tr("Перевести") };

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
  const [photos, setPhotos] = useState<string[]>(editing?.photos ?? []);
  const [parts, setParts] = useState<Part[]>([]);
  const [view, setView] = useState<View>("main");
  const [hint, setHint] = useState<string | null>(null);
  const amountCtl = useAnimationControls();
  const catCtl = useAnimationControls();

  const walletOf = (id?: ID) => wallets.find((w) => w.id === id);
  const from = walletOf(walletId);
  const to = walletOf(toWalletId);
  const currency = from?.currency ?? settings.baseCurrency;
  const cross = kind === "transfer" && !!to && !!from && to.currency !== from.currency;
  const amount = Math.max(0, evaluate(buf) ?? 0);
  const negative = (evaluate(buf) ?? 0) < 0;
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

  const press = (k: CalcKey) => {
    setHint(null);
    if (field === "to") setToBuf((b) => applyCalcKey(b, k));
    else setBuf((b) => applyCalcKey(b, k));
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
      if (useUI.getState().locked) return; // digits belong to the lock screen
      if (/^[0-9]$/.test(e.key)) pressRef.current(e.key as CalcKey);
      else if (e.key === "," || e.key === ".") pressRef.current(",");
      else if (e.key === "Backspace") pressRef.current("back");
      else if (e.key === "+" || e.key === "-") pressRef.current(e.key);
      else if (e.key === "*" || e.key === "x" || e.key === tr("х")) pressRef.current("×");
      else if (e.key === "=") pressRef.current("=");
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
      setHint(negative ? tr("Получилось меньше нуля") : tr("Введите сумму"));
      return;
    }
    if (!walletId || !from) {
      nav.toast(tr("Сначала добавьте кошелёк"), { tone: "warning" });
      return;
    }
    const splitParts = kind === "expense" && !editing ? parts.filter((p) => parseAmount(p.buf) > 0) : [];
    const remainder = amount - splitParts.reduce((s, p) => s + parseAmount(p.buf), 0);
    if (splitParts.length) {
      if (splitParts.some((p) => !p.categoryId)) {
        setView("split");
        nav.toast(tr("Выберите категорию для каждой части чека"), { tone: "warning" });
        return;
      }
      if (remainder < 0) {
        setView("split");
        nav.toast(tr("Части чека больше его суммы"), { tone: "warning" });
        return;
      }
    }
    if (kind !== "transfer" && !lockedKind && !categoryId && !(splitParts.length && remainder === 0)) {
      shake(catCtl);
      setHint(tr("Выберите категорию"));
      return;
    }
    let toAmount: Minor | undefined;
    if (kind === "transfer" && !lockedKind) {
      if (!toWalletId || toWalletId === walletId) {
        setHint(tr("Выберите кошелёк назначения"));
        haptic("warning");
        return;
      }
      if (cross) {
        toAmount = Math.max(0, evaluate(toBuf) ?? 0);
        if (!toAmount) {
          setField("to");
          shake(amountCtl);
          setHint(tr("Сколько поступит на второй счёт?"));
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
      tags,
      photos: photos.length ? photos : undefined
    };

    const isNew = !editing;
    const label = isNew ? (effectiveKind === "income" ? tr("Доход добавлен") : effectiveKind === "expense" ? tr("Расход добавлен") : tr("Перевод выполнен")) : tr("Изменения сохранены");

    undoable(label, () => {
      let recurringId = editing?.recurringId;
      if (repeat !== "none" && !recurringId && !splitParts.length && (kind === "income" || kind === "expense" || kind === "transfer")) {
        const day = dayOf(date);
        const anchor = anchorOf(day);
        recurringId = st.addRecurring({
          kind,
          title: cleanNote || (categoryId ? catMap.get(categoryId)?.name : undefined) || tr("Перевод"),
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
      else if (splitParts.length) {
        // One receipt → several ordinary expenses that know they belong together.
        const splitId = uid("s-");
        const base = fields as Omit<Transaction, "id" | "createdAt">;
        if (remainder > 0) st.addTransaction({ ...base, amount: remainder, categoryId, splitId });
        for (const p of splitParts) st.addTransaction({ ...base, amount: parseAmount(p.buf), categoryId: p.categoryId, splitId });
      } else st.addTransaction({ ...(fields as Omit<Transaction, "id" | "createdAt">), recurringId });
      if (saveFav && kind !== "transfer") {
        st.addFavorite({ kind, title: cleanNote || catMap.get(categoryId!)?.name || tr("Избранное"), amount, walletId, categoryId, note: cleanNote });
      }
    });
    haptic("success");
    close();
    // On the home screen the amount flies into the card.
    if (isNew && (effectiveKind === "income" || effectiveKind === "expense") && useUI.getState().tab === "home") {
      nav.fly({ amount, currency, kind: effectiveKind, walletId });
    }
  };
  saveRef.current = save;

  const applyFavorite = (f: Favorite) => {
    haptic();
    if (f.amount) setBuf(amountToInput(f.amount));
    setField("amount");
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
  const quickCats = useMemo(() => {
    const ids = usage.slice(0, 8);
    if (categoryId && !ids.includes(categoryId) && catMap.get(categoryId)?.kind === kind) ids.unshift(categoryId);
    return ids.map((id) => catMap.get(id)).filter((c): c is Category => !!c);
  }, [usage, categoryId, catMap, kind]);
  /** A comment typed before suggests the category it had then. */
  const suggested = useMemo(() => {
    const q = note.trim().toLowerCase();
    if (q.length < 2 || kind === "transfer") return undefined;
    const past = transactions.find((t) => t.kind === kind && t.categoryId && t.note?.trim().toLowerCase() === q);
    const c = past?.categoryId ? catMap.get(past.categoryId) : undefined;
    return c && c.id !== categoryId && !c.archived ? c : undefined;
  }, [note, kind, transactions, catMap, categoryId]);
  /** While an expression is typed, the big figure shows its result. */
  const shown = (b: string) => (hasOperator(b) ? amountToInput(Math.max(0, evaluate(b) ?? 0)) : b);
  const lastOp = (b: string) => (/[+\-×]$/.test(b) ? b[b.length - 1] : undefined);
  const dateLabel = (() => {
    const d = dayOf(date);
    const rel = d === todayKey() || d === addDays(todayKey(), -1) ? formatDayHeading(d) : formatDate(d);
    return { day: rel, time: timeOf(date) };
  })();

  const titleFor: Record<View, string | undefined> = {
    main: editing ? tr("Изменить операцию") : undefined,
    from: kind === "transfer" ? tr("Откуда") : tr("Кошелёк"),
    to: tr("Куда"),
    categories: tr("Категория"),
    details: tr("Подробности"),
    split: tr("Разделить чек")
  };

  return (
    <Sheet
      tall
      ariaLabel={editing ? tr("Изменить операцию") : tr("Новая операция")}
      title={view === "main" ? undefined : titleFor[view]}
      left={view === "main" ? undefined : <SheetAction onClick={() => setView("main")}>{tr("Назад")}</SheetAction>}
      right={view === "details" ? <SheetAction strong onClick={() => setView("main")}>{tr("Готово")}</SheetAction> : undefined}
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
            <div className="flex shrink-0 items-center gap-2 px-3">
              <IconButton icon={X} label={tr("Закрыть")} variant="plain" size={38} iconSize={20} onClick={close} />
              {lockedKind ? (
                <div className="flex-1 text-center text-headline font-semibold">{tr("Изменить операцию")}</div>
              ) : (
                <KindSwitch value={kind} onChange={setKind} />
              )}
              <span className="w-[38px] shrink-0 max-[389px]:hidden" />
            </div>

            {/* amount */}
            <motion.div animate={amountCtl} className="flex min-h-[112px] flex-1 flex-col items-center justify-center px-4 py-2">
              {cross ? (
                <div className="flex w-full flex-col items-center gap-3">
                  <AmountDisplay compact buffer={shown(buf)} currency={from!.currency} active={field === "amount"} label={tr("Списать")} onClick={() => setField("amount")} />
                  <AmountDisplay compact buffer={shown(toBuf)} currency={to!.currency} active={field === "to"} label={tr("Зачислить")} onClick={() => setField("to")} />
                </div>
              ) : (
                <>
                  <div className="h-5 text-callout text-ink-3 num">
                    <AnimatePresence>
                      {hasOperator(buf) && (
                        <motion.span key="expr" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                          {formatExpression(buf)} =
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <AmountDisplay buffer={shown(buf)} currency={currency} sign={kind === "income" ? "+" : undefined} />
                </>
              )}
              <div className="mt-1 h-5 text-footnote">
                <AnimatePresence mode="wait">
                  {hint ? (
                    <motion.span key="hint" className="font-medium text-negative" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {hint}
                    </motion.span>
                  ) : from && amount > 0 ? (
                    <motion.span key="after" className="text-ink-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {kind === "income" ? tr("Станет") : tr("Останется")} <Money value={balanceAfter} currency={from.currency} className="text-ink-2" />{" "}{tr("на «")}{from.name}»
                    </motion.span>
                  ) : note ? (
                    <motion.span key="note" className="text-ink-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      «{note}»
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* where the money goes: from → to */}
            <div className="flex shrink-0 items-center gap-1.5 px-4">
              {kind === "income" && !lockedKind ? (
                <>
                  <CategoryTile ctl={catCtl} caption={tr("Откуда")} category={categoryId ? catMap.get(categoryId) : undefined} onClick={() => setView("categories")} />
                  <FlowArrow kind={kind} />
                  <WalletTile caption={tr("Куда")} name={from?.name} icon={from ? walletKindInfo(from.kind).icon : "Wallet"} onClick={() => setView("from")} />
                </>
              ) : (
                <>
                  <WalletTile caption={tr("Откуда")} name={from?.name} icon={from ? walletKindInfo(from.kind).icon : "Wallet"} onClick={() => setView("from")} />
                  {!lockedKind && <FlowArrow kind={kind} />}
                  {kind === "transfer" && !lockedKind ? (
                    <WalletTile caption={tr("Куда")} name={to?.name} icon={to ? walletKindInfo(to.kind).icon : "Wallet"} onClick={() => setView("to")} />
                  ) : !lockedKind ? (
                    <CategoryTile ctl={catCtl} caption={tr("Куда")} category={categoryId ? catMap.get(categoryId) : undefined} onClick={() => setView("categories")} />
                  ) : null}
                </>
              )}
            </div>

            {/* one row of quick picks: templates (until you type), then the usual categories */}
            {kind !== "transfer" && !lockedKind && (
              <div className="scroll-x mt-3 flex shrink-0 gap-1.5 px-4">
                <AnimatePresence initial={false}>
                  {!editing &&
                    !buf &&
                    kindFavorites.map((f) => (
                      <motion.span key={f.id} layout initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2 }} className="shrink-0 overflow-hidden">
                        <QuickChip icon={<Star size={14} className="fill-current text-accent-ink" />} onClick={() => applyFavorite(f)}>
                          {f.title}
                          {f.amount ? <span className="num ml-1 text-ink-3">{formatMoney(f.amount, { kopecks: "never" })}</span> : null}
                        </QuickChip>
                      </motion.span>
                    ))}
                </AnimatePresence>
                {quickCats.map((c) => (
                  <QuickChip
                    key={c.id}
                    selected={categoryId === c.id}
                    icon={<NamedIcon name={c.icon} size={15} strokeWidth={2} style={{ color: categoryId === c.id ? undefined : c.color }} />}
                    onClick={() => {
                      haptic();
                      setCategoryId(c.id);
                      setHint(null);
                    }}
                  >
                    {c.name}
                  </QuickChip>
                ))}
                <QuickChip icon={<LayoutGrid size={15} strokeWidth={2} />} onClick={() => setView("categories")}>{tr("Все")}</QuickChip>
              </div>
            )}

            {/* details, in one quiet line */}
            <div className="mt-3 flex shrink-0 items-center gap-1.5 px-4 pb-2">
              <button type="button" onClick={() => setView("details")} className="tile flex h-9 min-w-0 items-center gap-1.5 rounded-full px-3 text-subhead font-medium text-ink-2">
                <CalendarDays size={15} strokeWidth={2} className="shrink-0" />
                <span className="truncate">
                  {dateLabel.day}
                  <span className="max-[389px]:hidden">, {dateLabel.time}</span>
                </span>
              </button>
              <div className="ml-auto flex shrink-0 gap-1.5">
                <ToolButton icon={MessageSquareText} label={note ? tr("Комментарий: {0}", note) : tr("Комментарий")} active={!!note} onClick={() => setView("details")} />
                <ToolButton icon={Hash} label={tags.length ? tr("Теги: {0}", tags.join(", ")) : tr("Теги")} active={tags.length > 0} onClick={() => setView("details")} />
                {!editingRecurring && !lockedKind && !parts.length && <ToolButton icon={Repeat} label={repeat === "none" ? tr("Повтор") : freqLabel(repeat)} active={repeat !== "none"} onClick={() => setView("details")} />}
                {kind === "expense" && !editing && (
                  <ToolButton
                    icon={Split}
                    label={tr("Разделить")}
                    active={parts.some((p) => parseAmount(p.buf) > 0)}
                    onClick={() => {
                      if (!parts.length) setParts([{ key: uid(), buf: "" }]);
                      setView("split");
                    }}
                  />
                )}
                {photosSupported() && <ToolButton icon={Camera} label={tr("Фото чека")} active={photos.length > 0} count={photos.length} onClick={() => setView("details")} />}
              </div>
            </div>

            <div className="shrink-0 pt-1">
              <Keypad<CalcKey> onKey={press} compact ops activeOp={lastOp(field === "to" ? toBuf : buf)} />
            </div>

            <div className="shrink-0 px-4 pb-[calc(var(--safe-bottom)+10px)] pt-2.5">
              <motion.button
                type="button"
                onClick={save}
                whileTap={{ scale: 0.97 }}
                transition={spring.press}
                className={cn("flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] text-headline font-semibold transition-colors duration-300", KIND_META[lockedKind ? "transfer" : kind].fill, KIND_META[lockedKind ? "transfer" : kind].on)}
                style={{ boxShadow: KIND_META[lockedKind ? "transfer" : kind].shadow }}
              >
                {editing || lockedKind ? tr("Сохранить") : SAVE_LABEL[kind]}
                {amount > 0 && !cross && <span className="num font-medium opacity-75">· {formatMoney(amount, { currency })}</span>}
              </motion.button>
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
                name={tr("Новая")}
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
              <FormRow label={tr("Дата и время")}>
                <input type="datetime-local" value={date} max={`${addDays(todayKey(), 366)}T23:59`} onChange={(e) => e.target.value && setDate(e.target.value.slice(0, 16))} className={cn(inputCls, "text-right")} />
              </FormRow>
              <div className="flex gap-2 px-4 py-2.5">
                <Chip selected={dayOf(date) === todayKey()} onClick={() => setDate(`${todayKey()}T${timeOf(nowISO())}`)}>{tr("Сегодня")}</Chip>
                <Chip selected={dayOf(date) === addDays(todayKey(), -1)} onClick={() => setDate(`${addDays(todayKey(), -1)}T${timeOf(date) || "12:00"}`)}>{tr("Вчера")}</Chip>
              </div>
            </Group>
            <Group>
              <div className="px-4 py-3">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Комментарий")} maxLength={120} enterKeyHint="done" className={inputCls} />
              </div>
              {suggested && (
                <button
                  type="button"
                  onClick={() => {
                    haptic();
                    setCategoryId(suggested.id);
                    setHint(null);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-press"
                >
                  <IconChip name={suggested.icon} color={suggested.color} size={28} />
                  <span className="min-w-0 flex-1 text-subhead text-ink-2">{tr("Как в прошлый раз:")}{" "}<span className="font-semibold text-ink">{suggested.name}</span>
                  </span>
                  <span className="text-subhead font-semibold text-accent-ink">{tr("Выбрать")}</span>
                </button>
              )}
            </Group>
            <Group header={tr("Теги")}>
              <div className="px-4 py-3">
                <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
              </div>
            </Group>
            {photosSupported() && (
              <Group header={tr("Фото чека")} footer={tr("Хранятся только на этом устройстве и не входят в резервную копию.")}>
                <PhotoStrip ids={photos} onChange={setPhotos} />
              </Group>
            )}
            {!editingRecurring && !lockedKind && (
              <Group header={tr("Повторять")} footer={repeat !== "none" ? tr("Следующие операции будут записываться автоматически. Управлять ими можно в разделе «Подписки и платежи».") : undefined}>
                <div className="px-3 py-3">
                  <Segmented
                    value={repeat}
                    onChange={(v) => setRepeat(v)}
                    options={[
                      { value: "none", label: tr("Нет") },
                      { value: "week", label: tr("Неделя") },
                      { value: "month", label: tr("Месяц") },
                      { value: "year", label: tr("Год") }
                    ]}
                  />
                </div>
              </Group>
            )}
            {editingRecurring && (
              <Group footer={tr("Операция из регулярного платежа «{0}»", editingRecurring.title)}>
                <FormRow label={tr("Повтор")}>
                  <span className="text-ink-2">{freqLabel(editingRecurring.freq, editingRecurring.interval)}</span>
                </FormRow>
              </Group>
            )}
            {!editing && kind !== "transfer" && (
              <Group footer={tr("Появится над категориями — одно касание, и всё заполнено.")}>
                <FormRow label={tr("Добавить в избранное")}>
                  <Toggle checked={saveFav} onChange={setSaveFav} label={tr("Добавить в избранное")} />
                </FormRow>
              </Group>
            )}
          </motion.div>
        )}
        {view === "split" && (
          <motion.div key="split" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.18, ease: ease.out }} className="flex flex-col gap-4 pt-1">
            <SplitEditor
              total={amount}
              currency={currency}
              parts={parts}
              onChange={setParts}
              mainCategory={categoryId ? catMap.get(categoryId) : undefined}
              categories={categories.filter((c) => c.kind === "expense" && !c.archived)}
            />
            <div className="px-4 pb-2">
              <Button block onClick={() => setView("main")}>{tr("Готово")}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

/** Extra categories of one receipt; the rest stays in the main category. */
function SplitEditor({
  total,
  currency,
  parts,
  onChange,
  mainCategory,
  categories
}: {
  total: Minor;
  currency: string;
  parts: Part[];
  onChange: (p: Part[]) => void;
  mainCategory?: Category;
  categories: Category[];
}) {
  const used = parts.reduce((s, p) => s + parseAmount(p.buf), 0);
  const remainder = total - used;
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const set = (k: number, patch: Partial<Part>) => onChange(parts.map((p, i) => (i === k ? { ...p, ...patch } : p)));

  return (
    <>
      <p className="px-5 text-callout text-ink-2">{tr("Чек на")}{" "}<Money value={total} currency={currency} className="font-semibold text-ink" />{tr(". Укажите, сколько ушло на другие категории, — остаток останется в")}{" "}{mainCategory ? `«${mainCategory.name}»` : tr("основной категории")}.
      </p>
      <Group>
        {parts.map((p, k) => {
          const c = p.categoryId ? catMap.get(p.categoryId) : undefined;
          return (
            <div key={p.key} className="flex items-center gap-2 py-2 pl-3 pr-2">
              <button
                type="button"
                onClick={() =>
                  nav.sheet("picker", {
                    title: tr("Категория части"),
                    value: p.categoryId,
                    options: categories.map((x) => ({ value: x.id, label: x.name, iconName: x.icon })),
                    onSelect: (id: string) => set(k, { categoryId: id })
                  })
                }
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[12px] py-1 text-left active:opacity-60"
              >
                <IconChip name={c?.icon ?? "CircleDashed"} color={c?.color} size={36} />
                <span className={cn("truncate text-body", c ? "text-ink" : "text-ink-3")}>{c?.name ?? tr("Категория")}</span>
                <ChevronDown size={15} className="shrink-0 text-ink-3" />
              </button>
              <div className="w-24 shrink-0">
                <input
                  inputMode="decimal"
                  value={p.buf}
                  placeholder="0"
                  aria-label={tr("Сумма части {0}", k + 1)}
                  onChange={(e) => set(k, { buf: e.target.value.replace(/[^\d.,]/g, "") })}
                  className={cn(inputCls, "num text-right text-headline")}
                />
              </div>
              <button type="button" aria-label={tr("Убрать часть")} onClick={() => onChange(parts.filter((_, i) => i !== k))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 active:bg-surface-press">
                <X size={17} />
              </button>
            </div>
          );
        })}
        <Row icon={Plus} title={tr("Добавить часть")} onClick={() => onChange([...parts, { key: uid(), buf: "" }])} />
      </Group>
      <Group>
        <Row
          leading={<IconChip name={mainCategory?.icon ?? "CircleDashed"} color={mainCategory?.color} size={36} />}
          title={mainCategory ? tr("Остаток — {0}", mainCategory.name) : tr("Остаток")}
          subtitle={!mainCategory && remainder > 0 ? tr("Выберите основную категорию на главном экране") : undefined}
          value={<Money value={remainder} currency={currency} tone={remainder < 0 ? "negative" : "default"} className="font-medium" />}
        />
      </Group>
    </>
  );
}

function effectOf(tx: Transaction): Minor {
  if (tx.kind === "income") return tx.amount;
  if (tx.kind === "expense" || tx.kind === "transfer") return -tx.amount;
  return tx.flow === "out" ? -tx.amount : tx.amount;
}

/** Расход · Доход · Перевод — the pill slides and takes the colour of the kind. */
function KindSwitch({ value, onChange }: { value: FlowKind; onChange: (k: FlowKind) => void }) {
  return (
    <div role="tablist" aria-label={tr("Тип операции")} className="relative flex min-w-0 flex-1 rounded-full p-1" style={{ background: "color-mix(in srgb, var(--ink) 6%, transparent)", boxShadow: "inset 0 0 0 0.5px var(--line)" }}>
      <motion.span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-y-1 left-1 rounded-full", KIND_META[value].fill)}
        style={{ width: "calc((100% - 8px) / 3)", boxShadow: KIND_META[value].shadow }}
        initial={false}
        animate={{ x: `${KIND_ORDER.indexOf(value) * 100}%` }}
        transition={spring.snappy}
      />
      {KIND_ORDER.map((k) => {
        const m = KIND_META[k];
        const on = k === value;
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => {
              if (on) return;
              haptic();
              onChange(k);
            }}
            className="relative flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-full text-[min(calc(14px*var(--text-scale)),15px)] font-semibold"
          >
            <m.icon size={15} strokeWidth={2.4} className={cn("relative shrink-0 transition-colors duration-200 max-[389px]:hidden", on ? m.on : m.tint)} />
            <span className={cn("relative truncate transition-colors duration-200", on ? m.on : "text-ink-2")}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FlowArrow({ kind }: { kind: FlowKind }) {
  return (
    <motion.span key={kind} className="grid h-7 w-7 shrink-0 place-items-center rounded-full tile" initial={{ x: -4, opacity: 0.4 }} animate={{ x: 0, opacity: 1 }} transition={spring.snappy}>
      <ArrowRight size={14} strokeWidth={2.4} className={kind === "expense" ? "text-accent-ink" : kind === "income" ? "text-positive" : "text-ink-2"} />
    </motion.span>
  );
}

function WalletTile({ caption, name, icon, onClick }: { caption: string; name?: string; icon: string; onClick: () => void }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.97 }} transition={spring.press} onClick={onClick} aria-label={`${caption}: ${name ?? tr("выберите кошелёк")}`} className="panel flex h-[60px] min-w-0 flex-1 items-center gap-2.5 rounded-[18px] px-2.5 text-left">
      <IconChip name={icon} size={34} />
      <span className="min-w-0 flex-1">
        <span className="block text-caption text-ink-3">{caption}</span>
        <span className={cn("block truncate text-subhead font-semibold", name ? "text-ink" : "text-ink-3")}>{name ?? tr("Кошелёк")}</span>
      </span>
    </motion.button>
  );
}

function CategoryTile({ caption, category, onClick, ctl }: { caption: string; category?: Category; onClick: () => void; ctl: ReturnType<typeof useAnimationControls> }) {
  return (
    <motion.button
      type="button"
      animate={ctl}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      aria-label={`${caption}: ${category?.name ?? tr("выберите категорию")}`}
      className={cn("flex h-[60px] min-w-0 flex-1 items-center gap-2.5 rounded-[18px] px-2.5 text-left", category ? "panel" : "border border-dashed border-line-strong")}
    >
      {category ? <IconChip name={category.icon} color={category.color} size={34} /> : <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[12px] border border-dashed border-ink-4 text-ink-3"><LayoutGrid size={16} /></span>}
      <span className="min-w-0 flex-1">
        <span className="block text-caption text-ink-3">{caption}</span>
        <span className={cn("block truncate text-subhead font-semibold", category ? "text-ink" : "text-ink-3")}>{category?.name ?? tr("Категория")}</span>
      </span>
    </motion.button>
  );
}

function QuickChip({ children, icon, selected, onClick }: { children: React.ReactNode; icon?: React.ReactNode; selected?: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      transition={spring.press}
      aria-pressed={selected}
      onClick={onClick}
      className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-subhead font-medium transition-colors duration-200", selected ? "bg-ink text-ink-inverse" : "tile text-ink")}
    >
      {icon}
      {children}
    </motion.button>
  );
}

function ToolButton({ icon: Icon, label, active, onClick, count }: { icon: LucideIcon; label: string; active?: boolean; onClick: () => void; count?: number }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      transition={spring.press}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("relative grid h-9 w-9 place-items-center rounded-full transition-colors duration-200", active ? "bg-accent-soft text-accent-ink" : "tile text-ink-2")}
    >
      <Icon size={16} strokeWidth={2} />
      {active && <span className="absolute right-[5px] top-[5px] h-[6px] w-[6px] rounded-full bg-accent" />}
      {!!count && count > 1 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-[var(--accent-on)]">{count}</span>}
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
        className={cn("grid h-[48px] w-[48px] place-items-center rounded-[16px]", !(color && selected) && (selected ? "bg-ink text-ink-inverse" : "tile"), !color && !selected && "text-ink")}
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
              : { color: `color-mix(in srgb, ${color} var(--icon-mix), black)` }
            : undefined
        }
      >
        {iconNode ?? <NamedIcon name={icon} size={21} strokeWidth={selected ? 2 : 1.8} />}
      </motion.span>
      <span className={cn("line-clamp-2 h-[28px] text-center text-[11px] leading-[14px]", selected ? "font-semibold text-ink" : "text-ink-2")}>{name}</span>
    </motion.button>
  );
}
