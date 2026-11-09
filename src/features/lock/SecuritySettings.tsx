import { useEffect, useState } from "react";
import { KeyRound, LockKeyhole, ScanFace, Timer } from "../../ui/glyphs";
import { haptic } from "../../lib/haptics";
import { useData } from "../../store/store";
import { nav } from "../../store/ui";
import { FormRow, Group, IconChip, Row, SwitchRow, Toggle } from "../../ui/primitives";
import { biometricAvailable, registerBiometric } from "./lock";
import { askPin } from "./PinSheet";
import { tr } from "../../i18n/i18n";

const AFTER_OPTIONS = [
  { value: "0", label: tr("Сразу") },
  { value: "1", label: tr("1 мин") },
  { value: "5", label: tr("5 мин") },
  { value: "15", label: tr("15 мин") }
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
      nav.toast(tr("Код-пароль включён"), { tone: "positive" });
    });

  const disable = () =>
    askPin("verify", () => {
      update({ lockEnabled: false, lockPinHash: undefined, lockSalt: undefined, lockCredentialId: undefined });
      nav.toast(tr("Код-пароль выключен"));
    });

  const toggleBio = async (on: boolean) => {
    if (!on) return update({ lockCredentialId: undefined });
    const id = await registerBiometric();
    if (id) {
      update({ lockCredentialId: id });
      haptic("success");
    } else nav.toast(tr("Face ID не подключился — попробуйте ещё раз"), { tone: "warning" });
  };

  return (
    <Group
      header={tr("Защита")}
      footer={
        s.lockEnabled
          ? tr("Без кода балансы не увидит тот, кто взял ваш разблокированный телефон. Сами данные на устройстве не шифруются.")
          : tr("Код из 4 цифр при входе в приложение. На iPhone можно входить по Face ID.")
      }
    >
      <FormRow label={<span className="flex items-center gap-3"><IconChip icon={LockKeyhole} size={30} />{tr("Код-пароль")}</span>}>
        <Toggle checked={s.lockEnabled} onChange={(v) => (v ? enable() : disable())} label={tr("Код-пароль")} />
      </FormRow>
      {s.lockEnabled && bio && (
        <FormRow label={<span className="flex items-center gap-3"><IconChip icon={ScanFace} size={30} />Face ID</span>}>
          <Toggle checked={!!s.lockCredentialId} onChange={toggleBio} label="Face ID" />
        </FormRow>
      )}
      {s.lockEnabled && (
        <SwitchRow icon={Timer} label={tr("Блокировать")} value={String(s.lockAfter)} onChange={(v) => update({ lockAfter: Number(v) })} options={AFTER_OPTIONS} />
      )}
      {s.lockEnabled && <Row icon={KeyRound} title={tr("Сменить код")} chevron onClick={() => askPin("verify", () => askPin("set", () => nav.toast(tr("Код изменён"), { tone: "positive" })))} />}
    </Group>
  );
}
