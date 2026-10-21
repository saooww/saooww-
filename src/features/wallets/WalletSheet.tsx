import { useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { amountToInput, CURRENCIES, parseAmount } from "../../lib/money";
import { CARD_MATERIALS, materialOf, walletKindInfo, WALLET_KINDS } from "../../store/catalog";
import { useBalances } from "../../store/hooks";
import { useData } from "../../store/store";
import type { CardStyle, ID, WalletKind } from "../../store/types";
import { nav } from "../../store/ui";
import { iconByName, NamedIcon } from "../../ui/icons";
import { FormRow, Group, Toggle, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { WalletCard } from "../../ui/WalletCard";

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
  const [style, setStyle] = useState<CardStyle>(existing?.style ?? (CARD_MATERIALS[count % CARD_MATERIALS.length].id as CardStyle));
  const [ident, setIdent] = useState(existing?.ident ?? "");
  const [balance, setBalance] = useState(existing ? amountToInput(balances[existing.id] ?? 0).replace(",", ".") : "");
  const [include, setInclude] = useState(existing?.includeInTotal ?? true);
  const hasTx = useData((s) => !!editId && s.transactions.some((t) => t.walletId === editId || t.toWalletId === editId));

  const amount = parseAmount(balance);
  const preview = useMemo(() => materialOf(style), [style]);
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    const st = useData.getState();
    const patch = { name: name.trim(), kind, style, ident: ident.trim() || undefined, includeInTotal: include };
    if (existing) {
      st.updateWallet(existing.id, { ...patch, currency: hasTx ? existing.currency : currency });
      if (amount !== (balances[existing.id] ?? 0)) st.setWalletBalance(existing.id, amount);
      nav.toast("Кошелёк сохранён");
    } else {
      st.addWallet({ ...patch, currency, balance: amount });
      nav.toast("Кошелёк создан", { tone: "positive" });
    }
    haptic("success");
    close();
  };

  return (
    <Sheet
      tall
      title={existing ? "Кошелёк" : "Новый кошелёк"}
      left={<SheetAction onClick={close}>Отмена</SheetAction>}
      right={<SheetAction strong disabled={!valid} onClick={save}>Готово</SheetAction>}
    >
      <div className="flex flex-col gap-5 pt-1">
        <div className="px-8">
          <WalletCard
            title={name || "Название"}
            subtitle={walletKindInfo(kind).label}
            icon={iconByName(walletKindInfo(kind).icon)}
            ident={ident || undefined}
            amount={amount}
            currency={currency}
            material={preview}
            badge={currency !== base ? currency : undefined}
          />
        </div>

        <div className="scroll-x flex gap-3 px-5 py-1">
          {CARD_MATERIALS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-label={m.name}
              aria-pressed={style === m.id}
              onClick={() => {
                haptic();
                setStyle(m.id);
              }}
              className="h-9 w-9 shrink-0 rounded-full"
              style={{ background: m.swatch, boxShadow: style === m.id ? "0 0 0 2px var(--surface-2), 0 0 0 4px var(--ink)" : "inset 0 0 0 1px var(--line-strong)" }}
            />
          ))}
        </div>

        <Group>
          <FormRow label="Название">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Карта" maxLength={32} className={cn(inputCls, "text-right")} />
          </FormRow>
          <FormRow label={existing ? "Текущий баланс" : "Начальный баланс"}>
            <input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^\d.,-]/g, ""))} placeholder="0" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
          <FormRow label="Последние цифры">
            <input inputMode="numeric" value={ident} onChange={(e) => setIdent(e.target.value.slice(0, 6))} placeholder="Необязательно" className={cn(inputCls, "text-right tnum")} />
          </FormRow>
        </Group>

        <Group header="Тип">
          <div className="grid grid-cols-3 gap-2 p-2.5">
            {WALLET_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                aria-pressed={kind === k.kind}
                onClick={() => setKind(k.kind)}
                className={cn("flex flex-col items-center gap-1.5 rounded-md px-1 py-2.5 transition-colors", kind === k.kind ? "bg-ink text-ink-inverse" : "bg-surface-3 text-ink")}
              >
                <NamedIcon name={k.icon} size={18} strokeWidth={1.9} />
                <span className="text-caption font-medium">{k.label}</span>
              </button>
            ))}
          </div>
        </Group>

        <Group footer={hasTx ? "Валюту нельзя изменить, пока по кошельку есть операции." : "Для сумм в другой валюте задайте курс в настройках — иначе они не попадут в общий баланс."}>
          <FormRow label="Валюта">
            <select value={currency} disabled={hasTx} onChange={(e) => setCurrency(e.target.value)} className={cn(inputCls, "appearance-none text-right disabled:text-ink-3")} dir="rtl">
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {`\u200e${c.code} · ${c.symbol}\u200e`}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Учитывать в общем балансе">
            <Toggle checked={include} onChange={setInclude} label="Учитывать в общем балансе" />
          </FormRow>
        </Group>
        {existing && amount !== (balances[existing.id] ?? 0) && balance !== "" && (
          <p className="-mt-2 px-8 text-footnote text-ink-3">Разница будет записана как корректировка баланса — история операций не изменится.</p>
        )}
      </div>
    </Sheet>
  );
}
