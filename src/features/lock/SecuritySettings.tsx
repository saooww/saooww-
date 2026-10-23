import { useEffect, useState } from "react";
import { KeyRound, LockKeyhole, ScanFace, Timer } from "lucide-react";
import { haptic } from "../../lib/haptics";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { FormRow, Group, IconChip, Row, Segmented, Toggle } from "../../ui/primitives";
import { biometricAvailable, registerBiometric } from "./lock";
import { askPin } from "./PinSheet";

const AFTER_OPTIONS = [
  { value: "0", label: "Сразу" },
  { value: "1", label: "1 мин" },
  { value: "5", label: "5 мин" },
  { value: "15", label: "15 мин" }
];

export function SecuritySettings() {
  const s = useData((st) => st.settings);
  const update = useData((st) => st.updateSettings);
  const [bio, setBio] = useState(false);

  useEffect(() => {
    biometricAvailable().then(setBio);
  }, []);

  const enable = () =>
    askPin("set", () => {
      update({ lockEnabled: true });
      haptic("success");
      nav.toast("Код-пароль включён", { tone: "positive" });
    });

  const disable = () =>
    askPin("verify", () => {
      update({ lockEnabled: false, lockPinHash: undefined, lockSalt: undefined, lockCredentialId: undefined });
      nav.toast("Код-пароль выключен");
    });

  const toggleBio = async (on: boolean) => {
    if (!on) return update({ lockCredentialId: undefined });
    const id = await registerBiometric();
    if (id) {
      update({ lockCredentialId: id });
      haptic("success");
    } else nav.toast("Face ID не подключился — попробуйте ещё раз", { tone: "warning" });
  };

  return (
    <Group
      header="Защита"
      footer={
        s.lockEnabled
          ? "Без кода балансы не увидит тот, кто взял ваш разблокированный телефон. Сами данные на устройстве не шифруются."
          : "Код из 4 цифр при входе в приложение. На iPhone можно входить по Face ID."
      }
    >
      <FormRow label={<span className="flex items-center gap-3"><IconChip icon={LockKeyhole} size={30} />Код-пароль</span>}>
        <Toggle checked={s.lockEnabled} onChange={(v) => (v ? enable() : disable())} label="Код-пароль" />
      </FormRow>
      {s.lockEnabled && bio && (
        <FormRow label={<span className="flex items-center gap-3"><IconChip icon={ScanFace} size={30} />Face ID</span>}>
          <Toggle checked={!!s.lockCredentialId} onChange={toggleBio} label="Face ID" />
        </FormRow>
      )}
      {s.lockEnabled && (
        <div className="flex items-center gap-3 px-4 py-3">
          <IconChip icon={Timer} size={30} />
          <span className="text-body">Блокировать</span>
          <Segmented className="ml-auto w-[214px]" size="sm" value={String(s.lockAfter)} onChange={(v) => update({ lockAfter: Number(v) })} options={AFTER_OPTIONS} />
        </div>
      )}
      {s.lockEnabled && <Row icon={KeyRound} title="Сменить код" chevron onClick={() => askPin("verify", () => askPin("set", () => nav.toast("Код изменён", { tone: "positive" })))} />}
    </Group>
  );
}
