import { useState } from "react";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { hashPin, newSalt } from "./lock";
import { PinPad } from "./PinPad";

/**
 * mode "set": enter a new code twice, then `onDone`.
 * mode "verify": enter the current code, then `onDone`.
 */
export function PinSheet({ mode, onDone }: { mode: "set" | "verify"; onDone: () => void }) {
  const { close } = useSheet();
  const [first, setFirst] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);

  const complete = async (pin: string) => {
    if (mode === "verify") {
      const s = useData.getState().settings;
      if (!s.lockSalt || (await hashPin(pin, s.lockSalt)) !== s.lockPinHash) return false;
      close();
      onDone();
      return true;
    }
    if (first === null) {
      setFirst(pin);
      setMismatch(false);
      return true;
    }
    if (pin !== first) {
      setFirst(null);
      setMismatch(true);
      return false;
    }
    const salt = newSalt();
    useData.getState().updateSettings({ lockSalt: salt, lockPinHash: await hashPin(pin, salt) });
    close();
    onDone();
    return true;
  };

  return (
    <Sheet ariaLabel="Код-пароль" left={<SheetAction onClick={close}>Отмена</SheetAction>}>
      <div className="pb-6 pt-2">
        <PinPad
          key={first === null ? "a" : "b"}
          title={mode === "verify" ? "Текущий код" : first === null ? "Придумайте код" : "Повторите код"}
          subtitle={mismatch ? "Коды не совпали — ещё раз" : mode === "set" && first === null ? "4 цифры — для входа в приложение" : undefined}
          onComplete={complete}
        />
      </div>
    </Sheet>
  );
}

export function askPin(mode: "set" | "verify", onDone: () => void) {
  nav.sheet("pin", { mode, onDone });
}
