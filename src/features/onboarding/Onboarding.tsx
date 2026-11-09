import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Check, ChevronLeft, CircleCheckBig, CreditCard, Globe, PiggyBank, ShieldCheck, Target, WalletCards, type LucideIcon } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { nowISO } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { uid } from "../../lib/id";
import { CURRENCIES, currencySymbol, parseAmount } from "../../lib/money";
import { completeOnboarding } from "../../store/boot";
import { createDemoData, createEmptyData, defaultSettings } from "../../store/seed";
import type { CardStyle, Wallet, WalletKind } from "../../store/types";
import { FullLogo } from "../../ui/Brand";
import { ease } from "../../ui/motion";
import { Button, IconButton, inputCls } from "../../ui/primitives";
import { LANGS, getLang, langInfo, switchLanguage, tr } from "../../i18n/i18n";

type Step = 0 | 1 | 2;

interface Preset {
  kind: WalletKind;
  name: string;
  icon: LucideIcon;
  style: CardStyle;
  on: boolean;
  amount: string;
}

const PRESETS: Preset[] = [
  { kind: "card", name: tr("Карта"), icon: CreditCard, style: "ardessa", on: true, amount: "" },
  { kind: "cash", name: tr("Наличные"), icon: Banknote, style: "graphite", on: true, amount: "" },
  { kind: "savings", name: tr("Накопления"), icon: PiggyBank, style: "titanium", on: false, amount: "" }
];

const FEATURES: Array<{ icon: LucideIcon; text: string }> = [
  { icon: WalletCards, text: tr("Все карты, наличные и накопления в одном месте") },
  { icon: Target, text: tr("Бюджеты, цели и планы — и сколько можно потратить сегодня") },
  { icon: CircleCheckBig, text: tr("Дела, списки и заметки: план на день, чтобы ничего не забыть") },
  { icon: ShieldCheck, text: tr("Данные только на вашем устройстве, вход по коду или Face ID") }
];

/** The language's own currency first, then the common ones. */
const START_CURRENCIES = [...new Set([langInfo().currency, "USD", "EUR", "RUB", "CNY", "GBP", "TRY", "KZT"])]
  .slice(0, 6)
  .map((code) => CURRENCIES.find((c) => c.code === code)!);

/** First launch: language and a short welcome, name and currency, starting balances. */
export function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(langInfo().currency);
  const [langOpen, setLangOpen] = useState(false);
  const [wallets, setWallets] = useState(PRESETS);

  const go = (s: Step) => {
    haptic();
    setDir(s > step ? 1 : -1);
    setStep(s);
  };

  const finish = () => {
    const chosen = wallets.filter((w) => w.on);
    const now = nowISO();
    const base = createEmptyData();
    const list: Wallet[] = (chosen.length ? chosen : [wallets[0]]).map((w) => ({
      id: uid("w-"),
      name: w.name,
      kind: w.kind,
      currency,
      style: w.style,
      openingBalance: parseAmount(w.amount),
      includeInTotal: true,
      createdAt: now
    }));
    haptic("success");
    completeOnboarding({
      ...base,
      wallets: list,
      settings: { ...defaultSettings(), name: name.trim(), baseCurrency: currency, numberFormat: langInfo().numbers, rates: currency === "RUB" ? defaultSettings().rates : {}, defaultWalletId: list[0].id },
      meta: { demo: false, createdAt: now }
    });
  };

  const demo = () => {
    haptic("success");
    completeOnboarding(createDemoData());
  };

  return (
    <div className="app-canvas fixed inset-0 z-[110] flex flex-col" style={{ paddingTop: "calc(var(--safe-top) + 12px)", paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
      <div className="flex h-11 items-center justify-between px-4">
        <div className="flex flex-1">{step > 0 && <IconButton icon={ChevronLeft} label={tr("Назад")} iconSize={22} onClick={() => go((step - 1) as Step)} />}</div>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className={cn("h-[5px] rounded-full", i === step ? "bg-ink" : "bg-ink-4")} animate={{ width: i === step ? 20 : 5 }} />
          ))}
        </div>
        <div className="flex flex-1 justify-end">
          {step === 0 && (
            <button
              type="button"
              aria-label={tr("Язык")}
              aria-expanded={langOpen}
              onClick={() => {
                haptic();
                setLangOpen((v) => !v);
              }}
              className="tile flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-footnote font-semibold text-ink"
            >
              <Globe size={16} />
              {langInfo().name}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {langOpen && (
          <motion.div
            role="radiogroup"
            aria-label={tr("Язык")}
            className="panel absolute inset-x-4 z-10 grid grid-cols-2 gap-1 rounded-[20px] p-2"
            style={{ top: "calc(var(--safe-top) + 64px)" }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: ease.out }}
          >
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={l.id === getLang()}
                lang={l.id}
                onClick={() => {
                  haptic();
                  if (l.id === getLang()) setLangOpen(false);
                  else switchLanguage(l.id);
                }}
                className={cn("flex h-12 items-center justify-between rounded-[14px] px-3.5 text-left text-callout", l.id === getLang() ? "bg-ink text-ink-inverse" : "text-ink active:bg-surface-press")}
              >
                {l.name}
                {l.id === getLang() && <Check size={16} strokeWidth={2.6} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={step}
            custom={dir}
            className="scroll-y absolute inset-0 px-6"
            initial={{ x: dir * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -60, opacity: 0 }}
            transition={{ duration: 0.36, ease: ease.out }}
          >
            {step === 0 && (
              <div className="flex min-h-full flex-col justify-center pb-6">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: ease.out }}>
                  <FullLogo layout="row" size={27} />
                </motion.div>
                <p className="mt-7 text-body text-ink-2">{tr("Деньги и дела — спокойно и под контролем.")}</p>
                <div className="mt-10 flex flex-col gap-5">
                  {FEATURES.map((f, i) => (
                    <motion.div key={f.text} className="flex items-start gap-3.5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08, duration: 0.5, ease: ease.out }}>
                      <span className="tile grid h-10 w-10 shrink-0 place-items-center rounded-[13px] text-accent-ink">
                        <f.icon size={19} strokeWidth={1.9} />
                      </span>
                      <span className="pt-2 text-callout text-ink">{f.text}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="pt-6">
                <h1 className="text-title-1 font-display text-ink">{tr("Знакомство")}</h1>
                <p className="mt-2 text-callout text-ink-2">{tr("Как к вам обращаться и в какой валюте считать.")}</p>
                <label className="panel mt-7 flex h-14 items-center rounded-[16px] px-4">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Имя (необязательно)")} maxLength={30} enterKeyHint="next" className={cn(inputCls, "text-headline")} />
                </label>
                <div className="section-label mt-8 px-1">{tr("Основная валюта")}</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {START_CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      aria-pressed={currency === c.code}
                      onClick={() => {
                        haptic();
                        setCurrency(c.code);
                      }}
                      className={cn("flex h-[64px] flex-col items-center justify-center rounded-[16px] transition-colors", currency === c.code ? "bg-ink text-ink-inverse" : "tile text-ink")}
                    >
                      <span className="text-title-3 font-semibold">{c.symbol}</span>
                      <span className={cn("text-caption", currency === c.code ? "opacity-70" : "text-ink-2")}>{c.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="pt-6">
                <h1 className="text-title-1 font-display text-ink">{tr("Ваши счета")}</h1>
                <p className="mt-2 text-callout text-ink-2">{tr("Отметьте, что у вас есть, и сколько там сейчас. Поправить можно в любой момент.")}</p>
                <div className="mt-7 flex flex-col gap-2.5">
                  {wallets.map((w, i) => (
                    <div key={w.kind} className={cn("panel flex items-center gap-3 rounded-[18px] px-3.5 py-3 transition-opacity", !w.on && "opacity-60")}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={w.on}
                        aria-label={w.name}
                        onClick={() => {
                          haptic();
                          setWallets((list) => list.map((x, j) => (j === i ? { ...x, on: !x.on } : x)));
                        }}
                        className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors", w.on ? "fill-accent" : "")}
                        style={w.on ? { color: "var(--accent-on)" } : { boxShadow: "inset 0 0 0 1.5px var(--ink-3)" }}
                      >
                        {w.on && <Check size={16} strokeWidth={3} />}
                      </button>
                      <span className="tile grid h-10 w-10 shrink-0 place-items-center rounded-[13px] text-ink">
                        <w.icon size={18} strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-body text-ink">{w.name}</span>
                      <label className="flex w-[118px] items-baseline justify-end gap-1">
                        <input
                          inputMode="decimal"
                          value={w.amount}
                          disabled={!w.on}
                          placeholder="0"
                          aria-label={tr("Остаток: {0}", w.name)}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d.,]/g, "");
                            setWallets((list) => list.map((x, j) => (j === i ? { ...x, amount: v } : x)));
                          }}
                          className={cn(inputCls, "num text-right text-headline")}
                        />
                        <span className="text-callout text-ink-2">{currencySymbol(currency)}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-2 px-6 pt-3">
        {step === 0 && (
          <>
            <Button block onClick={() => go(1)}>{tr("Начать")}</Button>
            <Button block variant="ghost" onClick={demo}>{tr("Посмотреть на примере")}</Button>
          </>
        )}
        {step === 1 && (
          <Button block onClick={() => go(2)}>{tr("Дальше")}</Button>
        )}
        {step === 2 && (
          <Button block onClick={finish} disabled={!wallets.some((w) => w.on)}>{tr("Готово")}</Button>
        )}
      </div>
    </div>
  );
}
