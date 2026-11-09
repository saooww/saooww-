import { useMemo, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { amountToInput, CURRENCIES, parseAmount } from "../../lib/money";
import { CARD_MATERIALS, materialFor, materialOf, walletKindInfo, WALLET_KINDS } from "../../store/catalog";
import { useBalances } from "../../store/hooks";
import { useData } from "../../store/store";
import type { CardPattern, CardStyle, ID, WalletKind } from "../../store/types";
import { nav } from "../../store/ui";
import { iconByName, NamedIcon } from "../../ui/icons";
import { FormRow, Group, Segmented, Toggle, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { WalletCard } from "../../ui/WalletCard";
import { Plus } from "../../ui/glyphs";
import { tr } from "../../i18n/i18n";

/** Create or edit a wallet. Editing never rewrites history: a changed balance becomes a correction entry. */
export function WalletSheet({ editId }: { editId?: ID }) {
  const { close } = useSheet();
  const existing = useData((s) => (editId ? s.wallets.find((w) => w.id === editId) : undefined));
  const base = useData((s) => s.settings.baseCurrency);
  const count = useData((s) => s.wallets.length);
  const balances = useBalances();
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<WalletKind>(existing?.kind ?? "card");
  const [currency, setCurrency] = useState(existing?.currency ?? base);
  const [style, setStyle] = useState<CardStyle>(existing ? materialOf(existing.style).id : CARD_MATERIALS[count % CARD_MATERIALS.length].id);
  const [customColor, setCustomColor] = useState<string | undefined>(existing?.customColor);
  const [pattern, setPattern] = useState<CardPattern>(existing?.pattern ?? "sail");
  const colorInput = useRef<HTMLInputElement>(null);
  const [ident, setIdent] = useState(existing?.ident ?? "");
  const [balance, setBalance] = useState(existing ? amountToInput(balances[existing.id] ?? 0).replace(",", ".") : "");
  const [include, setInclude] = useState(existing?.includeInTotal ?? true);
  const hasTx = useData((s) => !!editId && s.transactions.some((t) => t.walletId === editId || t.toWalletId === editId));

  const amount = parseAmount(balance);
  const preview = useMemo(() => materialFor({ style, customColor, pattern }), [style, customColor, pattern]);
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    const st = useData.getState();
    const patch = { name: name.trim(), kind, style, customColor, pattern: pattern === "sail" ? undefined : pattern, ident: ident.trim() || undefined, includeInTotal: include };
    if (existing) {
      st.updateWallet(existing.id, { ...patch, currency: hasTx ? existing.currency : currency });
      if (amount !== (balances[existing.id] ?? 0)) st.setWalletBalance(existing.id, amount);
      nav.toast(tr("Кошелёк сохранён"));
    } else {
      st.addWallet({ ...patch, currency, balance: amount });
      nav.toast(tr("Кошелёк создан"), { tone: "positive" });
    }
    haptic("success");
    close();
  };

  return (
    <Sheet
      tall
      title={existing ? tr("Кошелёк") : tr("Новый кошелёк")}
      left={<SheetAction onClick={close}>{tr("Отмена")}</SheetAction>}
      right={<SheetAction strong disabled={!valid} onClick={save}>{tr("Готово")}</SheetAction>}
    >
      <div className="flex flex-col gap-5 pt-1">
        <div className="px-8">
          <WalletCard
            title={name || tr("Название")}
            subtitle={walletKindInfo(kind).label}
            icon={iconByName(walletKindInfo(kind).icon)}
            ident={ident || undefined}
            amount={amount}
            currency={currency}
            material={preview}
            badge={currency !== base ? currency : undefined}
          />
        </div>

        <div className="grid grid-cols-7 gap-3 px-5 py-1">
          {CARD_MATERIALS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-label={m.name}
              aria-pressed={style === m.id}
              onClick={() => {
                haptic();
                setStyle(m.id);
                setCustomColor(undefined);
              }}
              className="aspect-square w-full rounded-full transition-[outline-color] duration-200"
              style={{
                background: m.background,
                boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.2)",
                outline: `2px solid ${style === m.id && !customColor ? "var(--ink)" : "transparent"}`,
                outlineOffset: 3
              }}
            />
          ))}
          {/* any colour at all */}
          <button
            type="button"
            aria-label={tr("Свой цвет")}
            aria-pressed={!!customColor}
            onClick={() => colorInput.current?.click()}
            className="relative grid aspect-square w-full place-items-center rounded-full transition-[outline-color] duration-200"
            style={{
              background: customColor ?? "conic-gradient(#fa0717, #f0b14e, #3cc896, #5b8cff, #e879b9, #fa0717)",
              outline: `2px solid ${customColor ? "var(--ink)" : "transparent"}`,
              outlineOffset: 3
            }}
          >
            <Plus size={16} className="text-white mix-blend-difference" />
          </button>
          <input ref={colorInput} type="color" aria-label={tr("Выбрать цвет карты")} value={customColor ?? "#3a6ea5"} onChange={(e) => setCustomColor(e.target.value)} className="pointer-events-none absolute h-0 w-0 opacity-0" />
        </div>

        <div className="px-4">
          <Segmented
            size="sm"
            value={pattern}
            onChange={(v) => setPattern(v)}
            options={[
              { value: "sail", label: tr("Парус") },
              { value: "waves", label: tr("Волны") },
              { value: "dots", label: tr("Точки") },
              { value: "none", label: tr("Без узора") }
            ]}
          />
        </div>

        <Group>
          <FormRow label={tr("Название")}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Например, Карта")} maxLength={32} className={cn(inputCls, "text-right")} />
          </FormRow>
          <FormRow label={existing ? tr("Текущий баланс") : tr("Начальный баланс")}>
            <input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^\d.,-]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
          <FormRow label={tr("Последние цифры")}>
            <input inputMode="numeric" value={ident} onChange={(e) => setIdent(e.target.value.slice(0, 6))} placeholder={tr("Необязательно")} className={cn(inputCls, "text-right tnum")} />
          </FormRow>
        </Group>

        <Group header={tr("Тип")}>
          <div className="grid grid-cols-3 gap-2 p-2.5">
            {WALLET_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                aria-pressed={kind === k.kind}
                onClick={() => setKind(k.kind)}
                className={cn("flex flex-col items-center gap-1.5 rounded-md px-1 py-2.5 transition-colors", kind === k.kind ? "bg-ink text-ink-inverse" : "tile text-ink")}
              >
                <NamedIcon name={k.icon} size={18} strokeWidth={1.9} />
                <span className="text-caption font-medium">{k.label}</span>
              </button>
            ))}
          </div>
        </Group>

        <Group footer={hasTx ? tr("Валюту нельзя изменить, пока по кошельку есть операции.") : tr("Для сумм в другой валюте задайте курс в настройках — иначе они не попадут в общий баланс.")}>
          <FormRow label={tr("Валюта")}>
            <select value={currency} disabled={hasTx} onChange={(e) => setCurrency(e.target.value)} className={cn(inputCls, "appearance-none text-right disabled:text-ink-3")} dir="rtl">
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {`\u200e${c.code} · ${c.symbol}\u200e`}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label={tr("Учитывать в общем балансе")}>
            <Toggle checked={include} onChange={setInclude} label={tr("Учитывать в общем балансе")} />
          </FormRow>
        </Group>
        {existing && amount !== (balances[existing.id] ?? 0) && balance !== "" && (
          <p className="-mt-2 px-8 text-footnote text-ink-3">{tr("Разница будет записана как корректировка баланса — история операций не изменится.")}</p>
        )}
      </div>
    </Sheet>
  );
}
