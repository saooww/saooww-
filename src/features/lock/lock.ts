import { isEmbedded } from "../../lib/backupFile";

/**
 * App lock. A 4-digit code is the key; Face ID / Touch ID (a WebAuthn
 * credential of the phone's own authenticator) is a shortcut to it.
 *
 * This is a privacy curtain — it keeps balances away from someone holding
 * your unlocked phone. The data itself is not encrypted on the device.
 */

export const PIN_LENGTH = 4;

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function random(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function newSalt(): string {
  return toHex(random(16).buffer);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

/* ------------------------------------------------------------------ */
/*  Face ID / Touch ID                                                 */
/* ------------------------------------------------------------------ */

export async function biometricAvailable(): Promise<boolean> {
  if (isEmbedded()) return false;
  try {
    return typeof PublicKeyCredential !== "undefined" && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Creates a credential on this phone; resolves to its id (or null if declined). */
export async function registerBiometric(): Promise<string | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: random(32),
        rp: { name: "Капитал" },
        user: { id: random(16), name: "kapital", displayName: "Капитал" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        attestation: "none",
        timeout: 60_000
      }
    })) as PublicKeyCredential | null;
    return cred ? b64url(cred.rawId) : null;
  } catch {
    return null;
  }
}

/** Asks for Face ID / Touch ID (or the phone's passcode). True only if the person was verified. */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: "public-key", id: fromB64url(credentialId), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60_000
      }
    })) as PublicKeyCredential | null;
    if (!assertion) return false;
    // Authenticator data, byte 32: flags. Bit 2 — user verified.
    const auth = new Uint8Array((assertion.response as AuthenticatorAssertionResponse).authenticatorData);
    return (auth[32] & 0x04) !== 0;
  } catch {
    return false;
  }
}
