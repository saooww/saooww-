import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArrowDownLeft, ArrowLeftRight, ChevronDown, LifeBuoy, Plus, ReceiptText, WalletCards } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { addDays, formatDate } from "../../lib/dates";
import { capitalSeries } from "../../lib/analytics";
import { monthlyTotals } from "../../lib/analytics";
import { rateOf } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { formatCompact, formatMoney } from "../../lib/money";
import { materialFor, walletKindInfo } from "../../store/catalog";
import { useAppData, useBalances, useLedger, useNetWorth, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Wallet } from "../../store/types";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { LineChart } from "../../charts/LineChart";
import { useWidth } from "../../charts/util";
import { iconByName } from "../../ui/icons";
import { AnimatedMoney, Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { Button, EmptyState, Group, IconButton, Row } from "../../ui/primitives";
import { MoneyHeader } from "../../nav/MoneySwitch";
import { CARD_RATIO, WalletCard } from "../../ui/WalletCard";
import { tr } from "../../i18n/i18n";

export function WalletsScreen() {
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const hidden = useData((s) => s.settings.hideAmounts);
  const live = wallets.filter((w) => !w.archived);
  const archived = wallets.filter((w) => w.archived);
  const [showArchive, setShowArchive] = useState(false);

  return (
    <Screen title={tr("Деньги")} header={<MoneyHeader current="wallets" actions={<IconButton icon={Plus} label={tr("Новый кошелёк")} onClick={() => nav.sheet("wallet")} />} />}>
      <TotalBlock />

      {live.length === 0 ? (
        <EmptyState icon={WalletCards} title={tr("Нет кошельков")} text={tr("Добавьте карту, наличные или накопительный счёт.")} action={<Button size="md" icon={Plus} onClick={() => nav.sheet("wallet")}>{tr("Добавить кошелёк")}</Button>} />
      ) : (
        <CardPager wallets={live} base={base} hidden={hidden} />
      )}

      <Overview />
      <Cushion />

      {archived.length > 0 && (
        <div className="mt-6">
          <button type="button" onClick={() => setShowArchive((v) => !v)} className="flex w-full items-center gap-2 px-5 py-2 text-subhead font-medium text-ink-2">
            <Archive size={16} />{tr("Архив ·")}{" "}{archived.length}
            <ChevronDown size={16} className={cn("transition-transform", showArchive && "rotate-180")} />
          </button>
          {showArchive && (
            <Group>
              {archived.map((w) => (
                <Row key={w.id} iconName={walletKindInfo(w.kind).icon} title={w.name} subtitle={tr("В архиве")} chevron onClick={() => nav.push("wallet", { id: w.id })} />
              ))}
            </Group>
          )}
        </div>
      )}
    </Screen>
  );
}

/** «Всего на счетах» in large figures and how it moved in 90 days; drag the line to look back. */
function TotalBlock() {
  const nw = useNetWorth();
  const data = useAppData();
  const balances = useBalances();
  const today = useToday();
  const base = data.settings.baseCurrency;
  const [scrub, setScrub] = useState<number | null>(null);
  const series = useMemo(() => capitalSeries(data, balances, addDays(today, -89), today), [data, balances, today]);
  const startOfWindow = series[0]?.value ?? 0;
  const shown = scrub !== null ? series[scrub] : null;
  const delta = (shown?.value ?? nw.total) - startOfWindow;

  return (
    <section className="px-5 pt-3">
      <div className="text-subhead text-ink-2">{shown ? formatDate(shown.day, { year: "auto" }) : tr("Чистый капитал")}</div>
      <div className="mt-0.5 text-[44px] leading-[1.05]">
        {shown ? <Money value={shown.value} currency={base} variant="hero" privacy /> : <AnimatedMoney value={nw.total} currency={base} variant="hero" privacy />}
      </div>
      <div className={cn("mt-1 text-footnote font-medium tnum", delta >= 0 ? "text-positive" : "text-negative")}>
        {delta >= 0 ? "+" : "−"}
        {formatMoney(Math.abs(delta), { currency: base })} <span className="font-normal text-ink-3">{shown ? tr("с начала периода") : tr("за 90 дней")}</span>
      </div>
      <div className="-mx-1 mt-1">
        <LineChart points={series.map((p) => ({ value: p.value }))} height={64} onScrub={setScrub} formatValue={(v) => formatCompact(v)} ariaLabel={tr("Капитал за 90 дней")} padY={10} />
      </div>
      {nw.missing.length > 0 && (
        <button type="button" onClick={() => nav.push("currencies")} className="mt-1 text-footnote text-warning">{tr("Без учёта")}{" "}{nw.missing.join(", ")}{tr(": задайте курс →")}</button>
      )}
    </section>
  );
}

/**
 * The cards one at a time, the next ones peeking out behind: swipe to go
 * through them, tap the card in front to open it. Under the cards, the
 * three things most often done with an account.
 */
function CardPager({ wallets, base, hidden }: { wallets: Wallet[]; base: string; hidden: boolean }) {
  const balances = useBalances();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [i, setI] = useState(0);
  const at = Math.min(i, wallets.length - 1);
  const w = wallets[at];
  const cardH = width / CARD_RATIO;
  const go = (n: number) => {
    const next = Math.max(0, Math.min(wallets.length - 1, n));
    if (next !== at) haptic();
    setI(next);
  };
  const behind = wallets.slice(at + 1, at + 3);

  return (
    <section className="mt-5">
      <div ref={ref} className="relative mx-5" style={{ height: cardH ? cardH + behind.length * 14 : undefined }}>
        {width > 0 &&
          behind
            .map((b, k) => (
              <motion.div
                key={b.id}
                aria-hidden="true"
                className="absolute inset-x-0 rounded-[22px]"
                initial={false}
                animate={{ y: 0, scale: 1 - (k + 1) * 0.06, opacity: 1 - (k + 1) * 0.25 }}
                transition={spring.smooth}
                style={{ top: 0, height: cardH, background: materialFor(b).background, transformOrigin: "50% 0%", zIndex: 2 - k, boxShadow: "0 -1px 0 rgba(255,255,255,0.18) inset" }}
              />
            ))
            .reverse()}
        {width > 0 && (
          <AnimatePresence initial={false} mode="popLayout">
            <motion.button
              key={w.id}
              type="button"
              aria-label={w.name}
              className="absolute inset-x-0 block text-left"
              style={{ top: behind.length * 14, zIndex: 5 }}
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -60, rotate: -4 }}
              transition={spring.smooth}
              drag={wallets.length > 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.35}
              onDragEnd={(_, info) => {
                if (info.offset.x < -50 || info.velocity.x < -400) go(at + 1);
                else if (info.offset.x > 50 || info.velocity.x > 400) go(at - 1);
              }}
              whileTap={{ scale: 0.985 }}
              onClick={(e) => {
                haptic();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                nav.push("wallet", { id: w.id, from: { x: r.x, y: r.y, w: r.width, h: cardH } });
              }}
            >
              <WalletCard
                title={w.name}
                subtitle={walletKindInfo(w.kind).label}
                icon={iconByName(walletKindInfo(w.kind).icon)}
                ident={w.ident}
                amount={balances[w.id] ?? 0}
                currency={w.currency}
                material={materialFor(w)}
                hidden={hidden}
                badge={w.currency !== base ? w.currency : undefined}
              />
            </motion.button>
          </AnimatePresence>
        )}
      </div>

      {wallets.length > 1 && (
        <div className="mt-4 flex justify-center gap-[5px]" aria-hidden="true">
          {wallets.map((x, k) => (
            <motion.span key={x.id} className={cn("h-[5px] rounded-full", k === at ? "bg-[var(--ink)]" : "bg-[var(--ink-3)] opacity-50")} animate={{ width: k === at ? 20 : 5 }} />
          ))}
        </div>
      )}

      <div className="mx-auto mt-5 grid max-w-[320px] grid-cols-3 gap-2">
        {[
          { label: tr("Пополнить"), icon: ArrowDownLeft, run: () => nav.sheet("composer", { kind: "income", walletId: w.id }) },
          { label: tr("Перевод"), icon: ArrowLeftRight, run: () => nav.sheet("composer", { kind: "transfer", walletId: w.id }) },
          { label: tr("Операции"), icon: ReceiptText, run: () => nav.push("wallet", { id: w.id }) }
        ].map((a) => (
          <motion.button
            key={a.label}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              haptic();
              a.run();
            }}
            className="flex flex-col items-center gap-1.5"
          >
            <span className="tile grid h-[54px] w-[54px] place-items-center rounded-full text-ink">
              <a.icon size={21} />
            </span>
            <span className="text-caption font-medium text-ink-2">{a.label}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

/** Every account in one short list, then what sits in goals and debts. */
function Overview() {
  const nw = useNetWorth();
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const balances = useBalances();
  const live = wallets.filter((w) => !w.archived);
  if (live.length < 2) return null;
  return (
    <div className="mt-7 flex flex-col gap-5">
      <Group header={tr("Все счета")}>
        {live.map((w) => (
          <Row
            key={w.id}
            leading={<span className="h-[26px] w-[40px] shrink-0 rounded-[6px]" style={{ background: materialFor(w).background, boxShadow: "0 4px 10px -4px rgba(0,0,0,0.5)" }} />}
            title={w.name}
            subtitle={`${walletKindInfo(w.kind).label}${w.ident ? ` ·· ${w.ident}` : ""}`}
            value={<Money value={balances[w.id] ?? 0} currency={w.currency} privacy className="font-semibold text-ink" />}
            onClick={() => nav.push("wallet", { id: w.id })}
          />
        ))}
      </Group>
      <div className="grid grid-cols-3 gap-2 px-4">
        <Stat label={tr("В целях")} value={nw.goals} currency={base} onClick={() => nav.push("goals")} />
        <Stat label={tr("Вам должны")} value={nw.receivables} currency={base} onClick={() => nav.push("debts")} />
        <Stat label={tr("Вы должны")} value={-nw.liabilities} currency={base} onClick={() => nav.push("debts")} />
      </div>
    </div>
  );
}

function Stat({ label, value, currency, onClick }: { label: string; value: number; currency: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="panel rounded-[18px] px-3 py-3 text-left active:bg-surface-press">
      <div className="truncate text-caption font-medium text-ink-2">{label}</div>
      <Money value={value} currency={currency} privacy className="mt-0.5 block truncate text-subhead font-semibold" />
    </button>
  );
}

function Cushion() {
  const data = useAppData();
  const balances = useBalances();
  const { entries } = useLedger();
  const today = useToday();
  const info = useMemo(() => {
    const months = monthlyTotals(entries, today, 4).slice(0, 3).filter((m) => m.expense > 0);
    if (!months.length) return null;
    const avg = months.reduce((s, m) => s + m.expense, 0) / months.length;
    let reserve = 0;
    for (const w of data.wallets) {
      if (w.archived || !w.includeInTotal || w.kind !== "savings") continue;
      const r = rateOf(w.currency, data.settings);
      if (r !== null) reserve += (balances[w.id] ?? 0) * r;
    }
    return { avg, reserve, months: avg ? reserve / avg : 0 };
  }, [data, balances, entries, today]);
  if (!info) return null;
  const m = Math.round(info.months * 10) / 10;
  const tone = m >= 6 ? "positive" : m >= 3 ? undefined : "warning";
  return (
    <div className="mt-7">
      <Group footer={tr("Накопительные счета против средних расходов за 3 месяца ({0} в месяц). Рекомендуемый запас — 3–6 месяцев.", formatMoney(Math.round(info.avg)))}>
        <Row
          icon={LifeBuoy}
          iconTone={tone}
          title={tr("Финансовая подушка")}
          subtitle={info.reserve > 0 ? tr("Хватит на {0} мес. обычной жизни", String(m).replace(".", ",")) : tr("Отметьте накопительные счета типом «Накопления»")}
          value={<Money value={Math.round(info.reserve)} privacy />}
        />
      </Group>
    </div>
  );
}
