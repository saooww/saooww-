import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, usePresence } from "framer-motion";
import { Archive, ArchiveRestore, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Pencil, SlidersHorizontal, Star, Trash2, type LucideIcon } from "lucide-react";
import { addDays, dayOf, formatDate, formatDayHeading, startOfMonth } from "../../lib/dates";
import { balanceSeries } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { formatCompact } from "../../lib/money";
import { materialOf, walletKindInfo } from "../../store/catalog";
import { useAppData, useBalances, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { ID, Transaction } from "../../store/types";
import { nav, useUI } from "../../store/ui";
import { confirmDelete, undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { LineChart } from "../../charts/LineChart";
import { iconByName } from "../../ui/icons";
import { Money } from "../../ui/Money";
import { ease, spring } from "../../ui/motion";
import { EmptyState, FormRow, Group, Row, SectionHeader, Segmented, Toggle } from "../../ui/primitives";
import { WalletCard } from "../../ui/WalletCard";
import { TxRow, usePresentCtx } from "../transactions/TxRow";

interface Origin {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function WalletDetail({ id, from }: { id: ID; from?: Origin }) {
  const wallet = useData((s) => s.wallets.find((w) => w.id === id));
  const base = useData((s) => s.settings.baseCurrency);
  const hidden = useData((s) => s.settings.hideAmounts);
  const defaultWalletId = useData((s) => s.settings.defaultWalletId);
  const transactions = useData((s) => s.transactions);
  const balances = useBalances();
  const data = useAppData();
  const today = useToday();
  const ctx = usePresentCtx();
  const setHero = useUI((s) => s.setHeroWallet);
  const [range, setRange] = useState<"30" | "90" | "365">("90");
  const [scrub, setScrub] = useState<number | null>(null);

  /* --- card continuity: the card flies from where it was tapped --- */
  const cardRef = useRef<HTMLDivElement>(null);
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const ts = useMotionValue(1);
  const fade = useMotionValue(from ? 0 : 1);
  const [isPresent, safeToRemove] = usePresence();

  useLayoutEffect(() => {
    if (!from || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    tx.set(from.x - r.x);
    ty.set(from.y - r.y);
    ts.set(from.w / r.width);
    setHero(id);
    animate(tx, 0, spring.card);
    animate(ty, 0, spring.card);
    animate(ts, 1, spring.card);
    animate(fade, 1, { duration: 0.32, delay: 0.08, ease: ease.out });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isPresent) return;
    const el = cardRef.current;
    if (!from || !el) {
      safeToRemove?.();
      return;
    }
    const r = el.getBoundingClientRect();
    const t = { duration: 0.38, ease: ease.nav };
    animate(fade, 0, { duration: 0.2, ease: ease.out });
    animate(ts, from.w / (r.width / ts.get()), t);
    animate(tx, tx.get() + (from.x - r.x), t);
    animate(ty, ty.get() + (from.y - r.y), t).then(() => {
      setHero(null);
      safeToRemove?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  useEffect(() => () => setHero(null), [setHero]);

  const days = Number(range);
  const series = useMemo(() => (wallet ? balanceSeries(data, balances, new Set([wallet.id]), addDays(today, -(days - 1)), today) : []), [data, balances, wallet, today, days]);

  const list = useMemo(() => transactions.filter((t) => t.walletId === id || t.toWalletId === id).sort((a, b) => (a.date < b.date ? 1 : -1)), [transactions, id]);
  const monthStats = useMemo(() => {
    const from = startOfMonth(today);
    let inflow = 0;
    let outflow = 0;
    for (const t of list) {
      if (dayOf(t.date) < from) break;
      if (t.kind === "transfer") {
        if (t.toWalletId === id) inflow += t.toAmount ?? t.amount;
        if (t.walletId === id) outflow += t.amount;
      } else if (t.kind === "income" || ((t.kind === "debt" || t.kind === "goal" || t.kind === "adjustment") && t.flow === "in")) inflow += t.amount;
      else outflow += t.amount;
    }
    return { inflow, outflow };
  }, [list, today, id]);

  const groups = useMemo(() => {
    const out: Array<{ day: string; items: Transaction[] }> = [];
    for (const t of list.slice(0, 30)) {
      const d = dayOf(t.date);
      const last = out[out.length - 1];
      if (last && last.day === d) last.items.push(t);
      else out.push({ day: d, items: [t] });
    }
    return out;
  }, [list]);

  if (!wallet) {
    return (
      <Screen title="Кошелёк">
        <EmptyState icon={Trash2} title="Кошелёк удалён" />
      </Screen>
    );
  }

  const kind = walletKindInfo(wallet.kind);
  const balance = balances[wallet.id] ?? 0;
  const shown = scrub !== null ? series[scrub] : null;
  const isDefault = defaultWalletId === wallet.id;

  const open = (k: "income" | "expense" | "transfer") => nav.sheet("composer", { kind: k, walletId: wallet.id });

  return (
    <>
      <motion.div className="app-canvas absolute inset-0" style={{ opacity: fade }} />
      <Screen title={wallet.name} bare chromeOpacity={fade}>
        <div className="px-5 pt-2">
          <motion.div ref={cardRef} style={{ x: tx, y: ty, scale: ts, transformOrigin: "0 0" }}>
            <WalletCard
              title={wallet.name}
              subtitle={kind.label}
              icon={iconByName(kind.icon)}
              ident={wallet.ident}
              amount={balance}
              currency={wallet.currency}
              material={materialOf(wallet.style)}
              hidden={hidden}
              badge={wallet.currency !== base ? wallet.currency : undefined}
              onToggleHidden={() => useData.getState().updateSettings({ hideAmounts: !hidden })}
            />
          </motion.div>
        </div>

        <motion.div style={{ opacity: fade }}>
          {!wallet.archived && (
            <div className="mt-5 grid grid-cols-3 gap-2.5 px-5">
              <MiniAction icon={ArrowDownLeft} label="Доход" onClick={() => open("income")} />
              <MiniAction icon={ArrowUpRight} label="Расход" onClick={() => open("expense")} />
              <MiniAction icon={ArrowLeftRight} label="Перевод" onClick={() => open("transfer")} />
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-2 px-5">
            <div className="panel rounded-md px-3.5 py-3">
              <div className="text-caption font-medium text-ink-2">Поступления в этом месяце</div>
              <Money value={monthStats.inflow} sign="always" tone="positive" currency={wallet.currency} className="mt-0.5 block text-callout font-semibold" />
            </div>
            <div className="panel rounded-md px-3.5 py-3">
              <div className="text-caption font-medium text-ink-2">Списания в этом месяце</div>
              <Money value={-monthStats.outflow} currency={wallet.currency} className="mt-0.5 block text-callout font-semibold" />
            </div>
          </div>

          <section className="mt-6 px-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-footnote font-medium text-ink-2">{shown ? formatDate(shown.day, { year: "auto" }) : "История баланса"}</div>
                <Money value={shown ? shown.value : series[series.length - 1]?.value ?? 0} currency={base} privacy className="text-title-3 font-semibold" />
              </div>
              <Segmented
                size="sm"
                className="w-[150px]"
                value={range}
                onChange={setRange}
                options={[
                  { value: "30", label: "30Д" },
                  { value: "90", label: "90Д" },
                  { value: "365", label: "Год" }
                ]}
              />
            </div>
            {wallet.currency !== base && <div className="mt-1 text-caption text-ink-3">в {base} по текущему курсу</div>}
            <div className="mt-3">
              <LineChart points={series.map((p) => ({ value: p.value }))} height={120} onScrub={setScrub} formatValue={(v) => formatCompact(v)} animKey={range} ariaLabel="История баланса" />
            </div>
          </section>

          <section className="mt-7">
            <SectionHeader
              title="Операции"
              action={
                list.length > 0
                  ? {
                      label: `Все · ${list.length}`,
                      onClick: () => {
                        useUI.getState().setTxFilter({ walletId: wallet.id }, true);
                        nav.tab("transactions");
                      }
                    }
                  : undefined
              }
            />
            {groups.length === 0 ? (
              <div className="mx-5 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-subhead text-ink-2">По этому кошельку пока нет операций</div>
            ) : (
              groups.map((g) => (
                <div key={g.day} className="mb-3">
                  <div className="label-caps px-5 pb-2.5">{formatDayHeading(g.day)}</div>
                  <Group>
                    {g.items.map((t) => (
                      <TxRow key={t.id} tx={t} ctx={ctx} walletId={wallet.id} onOpen={(x) => nav.sheet("tx", { id: x.id })} />
                    ))}
                  </Group>
                </div>
              ))
            )}
          </section>

          <div className="mt-6 flex flex-col gap-4">
            <Group>
              <Row icon={Pencil} title="Изменить" chevron onClick={() => nav.sheet("wallet", { editId: wallet.id })} />
              <Row
                icon={SlidersHorizontal}
                title="Скорректировать баланс"
                chevron
                onClick={() => nav.sheet("wallet", { editId: wallet.id })}
              />
            </Group>
            <Group footer="Основной кошелёк подставляется в новые операции по умолчанию.">
              <FormRow label={<span className="flex items-center gap-3"><Star size={18} className="text-ink-2" />Основной кошелёк</span>}>
                <Toggle checked={isDefault} onChange={(v) => useData.getState().updateSettings({ defaultWalletId: v ? wallet.id : undefined })} label="Основной кошелёк" />
              </FormRow>
              <FormRow label="Учитывать в общем балансе">
                <Toggle checked={wallet.includeInTotal} onChange={(v) => useData.getState().updateWallet(wallet.id, { includeInTotal: v })} label="Учитывать в общем балансе" />
              </FormRow>
            </Group>
            <Group>
              <Row
                icon={wallet.archived ? ArchiveRestore : Archive}
                title={wallet.archived ? "Вернуть из архива" : "Перенести в архив"}
                onClick={() => {
                  haptic();
                  const archived = !wallet.archived;
                  undoable(archived ? "Кошелёк в архиве" : "Кошелёк восстановлен", () => useData.getState().updateWallet(wallet.id, { archived }));
                  if (archived) nav.pop();
                }}
              />
              <Row
                icon={Trash2}
                iconTone="negative"
                title="Удалить кошелёк"
                destructive
                onClick={() =>
                  confirmDelete({
                    title: `Удалить «${wallet.name}»?`,
                    message: "Доходы и расходы этого кошелька будут удалены. Переводы в другие кошельки сохранятся как корректировки, чтобы их балансы не изменились. Если нужна история — перенесите кошелёк в архив.",
                    onConfirm: () => {
                      nav.pop();
                      setTimeout(() => undoable("Кошелёк удалён", () => useData.getState().deleteWallet(wallet.id)), 420);
                    }
                  })
                }
              />
            </Group>
          </div>
        </motion.div>
      </Screen>
    </>
  );
}

function MiniAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      transition={spring.press}
      onClick={onClick}
      className="flex h-11 items-center justify-center gap-2 panel rounded-md text-subhead font-medium active:bg-surface-press"
    >
      <Icon size={17} strokeWidth={2.1} />
      {label}
    </motion.button>
  );
}
