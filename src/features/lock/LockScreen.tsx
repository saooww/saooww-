import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ScanFace } from "lucide-react";
import { haptic } from "../../lib/haptics";
import { freshData, useData, wipeDevice } from "../../store/store";
import { useUI } from "../../store/ui";
import { BrandMark } from "../../ui/Brand";
import { ease } from "../../ui/motion";
import { biometricAvailable, hashPin, verifyBiometric } from "./lock";
import { PinPad } from "./PinPad";

const MAX_TRIES = 5;
const COOLDOWN_S = 30;

export function LockLayer() {
  const locked = useUI((s) => s.locked);
  return <AnimatePresence>{locked && <LockScreen key="lock" />}</AnimatePresence>;
}

function LockScreen() {
  const settings = useData((s) => s.settings);
  const [bio, setBio] = useState(false);
  const [tries, setTries] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const autoTried = useRef(false);

  const unlock = () => {
    haptic("success");
    useUI.setState({ locked: false });
  };

  const tryBiometric = async () => {
    if (!settings.lockCredentialId) return;
    if (await verifyBiometric(settings.lockCredentialId)) unlock();
  };

  useEffect(() => {
    let alive = true;
    if (settings.lockCredentialId) biometricAvailable().then((ok) => alive && setBio(ok));
    return () => {
      alive = false;
    };
  }, [settings.lockCredentialId]);

  // Ask for Face ID once the app is actually on screen (it may lock while in
  // the background). Safari may still want a tap — the button is right there.
  useEffect(() => {
    if (!bio) return;
    const attempt = () => {
      if (autoTried.current || document.visibilityState !== "visible") return;
      autoTried.current = true;
      void tryBiometric();
    };
    attempt();
    document.addEventListener("visibilitychange", attempt);
    return () => document.removeEventListener("visibilitychange", attempt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bio]);

  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [waitUntil]);

  const cooling = waitUntil > now;
  const left = Math.ceil((waitUntil - now) / 1000);

  const check = async (pin: string) => {
    if (!settings.lockPinHash || !settings.lockSalt) return true;
    if ((await hashPin(pin, settings.lockSalt)) === settings.lockPinHash) {
      unlock();
      return true;
    }
    const n = tries + 1;
    setTries(n);
    if (n >= MAX_TRIES) {
      setTries(0);
      setWaitUntil(Date.now() + COOLDOWN_S * 1000);
      setNow(Date.now());
    }
    return false;
  };

  const reset = async () => {
    await wipeDevice();
    const fresh = freshData("empty");
    useData.getState().replaceAll(fresh);
    useUI.setState({ locked: false, onboarding: true, homeCardIndex: 0 });
  };

  return (
    <motion.div
      className="app-canvas fixed inset-0 z-[150] flex flex-col items-center"
      style={{ paddingTop: "calc(var(--safe-top) + 56px)", paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.32, ease: ease.out } }}
      role="dialog"
      aria-modal="true"
      aria-label="Приложение заблокировано"
    >
      <BrandMark size={34} color="var(--accent)" />
      <div className="mt-10">
        <PinPad
          title={cooling ? "Слишком много попыток" : "Введите код"}
          subtitle={cooling ? `Попробуйте через ${left} с` : tries > 0 ? `Неверный код · осталось попыток: ${MAX_TRIES - tries}` : undefined}
          disabled={cooling}
          onComplete={check}
          extra={
            bio ? (
              <button type="button" aria-label="Войти с Face ID" onClick={tryBiometric} className="grid h-[76px] w-[76px] place-items-center rounded-full text-ink active:opacity-60">
                <ScanFace size={32} strokeWidth={1.5} />
              </button>
            ) : null
          }
        />
      </div>
      <div className="mt-auto px-8 text-center">
        {!forgot ? (
          <button type="button" onClick={() => setForgot(true)} className="h-11 text-callout text-ink-2 active:opacity-60">
            Забыли код?
          </button>
        ) : (
          <div className="panel rounded-lg p-4">
            <p className="text-footnote text-ink-2">
              Код хранится только на этом устройстве, восстановить его нельзя. Можно стереть данные приложения и начать заново — а затем загрузить копию, если вы её сохраняли.
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setForgot(false)} className="tile h-11 flex-1 rounded-[14px] text-callout font-semibold text-ink">
                Отмена
              </button>
              <button type="button" onClick={reset} className="h-11 flex-1 rounded-[14px] bg-negative-soft text-callout font-semibold text-negative">
                Стереть данные
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
