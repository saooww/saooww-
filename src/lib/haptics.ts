/**
 * Light haptic ticks. Uses the Vibration API where it exists and, on iOS
 * Safari (which has none), the system switch control, which produces a
 * native tick when toggled from a user gesture.
 */
let enabled = true;
let label: HTMLLabelElement | null = null;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

function iosSwitch(): HTMLLabelElement | null {
  if (label) return label;
  if (typeof document === "undefined") return null;
  const l = document.createElement("label");
  l.setAttribute("aria-hidden", "true");
  l.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  l.appendChild(input);
  document.body.appendChild(l);
  label = l;
  return l;
}

export function haptic(kind: "light" | "medium" | "success" | "warning" = "light") {
  if (!enabled) return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(kind === "light" ? 6 : kind === "medium" ? 12 : kind === "success" ? [8, 50, 8] : [14, 60, 14]);
      return;
    }
    iosSwitch()?.click();
  } catch {
    /* haptics are a nicety */
  }
}
