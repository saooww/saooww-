import { useUI, type Tab } from "../store/ui";
import { Segmented } from "../ui/primitives";

const OPTIONS: Array<{ value: Tab; label: string }> = [
  { value: "wallets", label: "Счета" },
  { value: "transactions", label: "Операции" },
  { value: "analytics", label: "Аналитика" }
];

/**
 * «Деньги» is one section in the tab bar; accounts, operations and analytics
 * are its three views, each keeping its own scroll and screens.
 */
export function MoneySwitch({ current }: { current: Tab }) {
  return (
    <div className="px-4 pb-4">
      <Segmented value={current} onChange={(t) => useUI.getState().setTab(t)} options={OPTIONS} />
    </div>
  );
}
