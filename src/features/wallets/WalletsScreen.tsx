import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Archive, ChevronDown, LifeBuoy, Plus, WalletCards } from "lucide-react";
import { cn } from "../../lib/cn";
import { addDays, formatDate } from "../../lib/dates";
import { capitalSeries } from "../../lib/analytics";
import { monthlyTotals } from "../../lib/analytics";
import { rateOf } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { formatCompact, formatMoney } from "../../lib/money";
import { materialOf, walletKindInfo } from "../../store/catalog";
import { useAppData, useBalances, useLedger, useNetWorth, useToday } from "../../store/hooks";
import { useData } from "../../store/store";
import type { Wallet } from "../../store/types";
import { nav, useUI } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { LineChart } from "../../charts/LineChart";
import { useWidth } from "../../charts/util";
import { iconByName } from "../../ui/icons";
import { AnimatedMoney, Money } from "../../ui/Money";
import { spring } from "../../ui/motion";
import { Button, EmptyState, Group, IconButton, Row } from "../../ui/primitives";
import { CARD_RATIO, WalletCard } from "../../ui/WalletCard";

const PEEK = 72;

export function WalletsScreen() {
  const wallets = useData((s) => s.wallets);
  const base = useData((s) => s.settings.baseCurrency);
  const hidden = useData((s) => s.settings.hideAmounts);
  const live = wallets.filter((w) => !w.archived);
  const archived = wallets.filter((w) => w.archived);
  const [showArchive, setShowArchive] = useState(false);

  return (
    <Screen title="Кошельки" large actions={<IconButton icon={Plus} label="Новый кошелёк" onClick={() => nav.sheet("wallet")} />}>
      <NetWorthBlock />

      {live.length === 0 ? (
        <EmptyState icon={WalletCards} title="Нет кошельков" text="Добавьте карту, наличные или накопительный счёт." action={<Button size="md" icon={Plus} onClick={() => nav.sheet("wallet")}>Добавить кошелёк</Button>} />
      ) : (
        <WalletStack wallets={live} base={base} hidden={hidden} />
      )}

      <Cushion />

      {archived.length > 0 && (
        <div className="mt-6">
          <button type="button" onClick={() => setShowArchive((v) => !v)} className="flex w-full items-center gap-2 px-5 py-2 text-subhead font-medium text-ink-2">
            <Archive size={16} />
            Архив · {archived.length}
            <ChevronDown size={16} className={cn("transition-transform", showArchive && "rotate-180")} />
          </button>
          {showArchive && (
            <Group>
              {archived.map((w) => (
                <Row key={w.id} iconName={walletKindInfo(w.kind).icon} title={w.name} subtitle="В архиве" chevron onClick={() => nav.push("wallet", { id: w.id })} />
              ))}
            </Group>
          )}
        </div>
      )}
    </Screen>
  );
}

function NetWorthBlock() {
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
    <section className="px-5">
      <div className="text-footnote font-medium text-ink-2">{shown ? formatDate(shown.day, { year: "auto" }) : "Чистый капитал"}</div>
      <div className="mt-1 text-[34px] font-semibold leading-[40px] tracking-[-0.035em]">
        {shown ? <Money value={shown.value} currency={base} variant="hero" privacy /> : <AnimatedMoney value={nw.total} currency={base} variant="hero" privacy />}
      </div>
      <div className={cn("mt-1 text-footnote font-medium tnum", delta >= 0 ? "text-positive" : "text-negative")}>
        {delta >= 0 ? "+" : "−"}
        {formatMoney(Math.abs(delta), { currency: base })} <span className="font-normal text-ink-3">{shown ? "с начала периода" : "за 90 дней"}</span>
      </div>
      <div className="-mx-1 mt-3">
        <LineChart points={series.map((p) => ({ value: p.value }))} height={92} onScrub={setScrub} formatValue={(v) => formatCompact(v)} ariaLabel="Капитал за 90 дней" padY={14} />
      </div>
      {nw.missing.length > 0 && (
        <button type="button" onClick={() => nav.push("currencies")} className="mt-2 text-footnote text-warning">
          Без учёта {nw.missing.join(", ")}: задайте курс →
        </button>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="На счетах" value={nw.wallets} currency={base} />
        <Stat label="В целях" value={nw.goals} currency={base} onClick={() => nav.push("goals")} />
        <Stat label="Вам должны" value={nw.receivables} currency={base} onClick={() => nav.push("debts")} />
        <Stat label="Вы должны" value={-nw.liabilities} currency={base} onClick={() => nav.push("debts")} />
      </div>
    </section>
  );
}

function Stat({ label, value, currency, onClick }: { label: string; value: number; currency: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="rounded-md bg-surface px-3.5 py-3 text-left active:bg-surface-press disabled:active:bg-surface">
      <div className="text-caption font-medium text-ink-2">{label}</div>
      <Money value={value} currency={currency} privacy className="mt-0.5 block text-callout font-semibold" />
    </button>
  );
}

/** Apple-Wallet-like stack: every card shows its top edge, the last one in full. */
function WalletStack({ wallets, base, hidden }: { wallets: Wallet[]; base: string; hidden: boolean }) {
  const balances = useBalances();
  const [ref, width] = useWidth<HTMLDivElement>();
  const heroWalletId = useUI((s) => s.heroWalletId);
  const cardH = width / CARD_RATIO;
  return (
    <div ref={ref} className="mx-5 mt-7">
      {width > 0 &&
        wallets.map((w, i) => {
          const m = materialOf(w.style);
          return (
            <motion.button
              key={w.id}
              type="button"
              className="relative block w-full text-left"
              style={{ marginTop: i === 0 ? 0 : -(cardH - PEEK), zIndex: i, opacity: heroWalletId === w.id ? 0 : 1 }}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: heroWalletId === w.id ? 0 : 1 }}
              transition={{ ...spring.smooth, delay: i * 0.04 }}
              whileTap={{ scale: 0.985, y: -2 }}
              onClick={(e) => {
                haptic();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                nav.push("wallet", { id: w.id, from: { x: r.x, y: r.y, w: r.width, h: cardH } });
              }}
              aria-label={`${w.name}`}
            >
              <WalletCard
                title={w.name}
                subtitle={walletKindInfo(w.kind).label}
                icon={iconByName(walletKindInfo(w.kind).icon)}
                ident={w.ident}
                amount={balances[w.id] ?? 0}
                currency={w.currency}
                material={m}
                hidden={hidden}
                badge={w.currency !== base ? w.currency : undefined}
              />
            </motion.button>
          );
        })}
    </div>
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
      <Group footer={`Накопительные счета против средних расходов за 3 месяца (${formatMoney(Math.round(info.avg))} в месяц). Рекомендуемый запас — 3–6 месяцев.`}>
        <Row
          icon={LifeBuoy}
          iconTone={tone}
          title="Финансовая подушка"
          subtitle={info.reserve > 0 ? `Хватит на ${String(m).replace(".", ",")} мес. обычной жизни` : "Отметьте накопительные счета типом «Накопления»"}
          value={<Money value={Math.round(info.reserve)} privacy />}
        />
      </Group>
    </div>
  );
}
