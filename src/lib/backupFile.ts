import { nowISO } from "./dates";
import { exportJSON, useData } from "../store/store";

/** Inside an embedding frame (e.g. a Claude artifact) file saving and sharing are blocked. */
export function isEmbedded(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

export type SaveResult = "shared" | "downloaded" | "cancelled" | "failed";

function backupFile(text: string): File {
  return new File([text], `kapital-${nowISO().slice(0, 10)}.json`, { type: "application/json" });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Saves a copy of all data outside the app: on iPhone the share sheet offers
 * «Save to Files» (iCloud Drive), AirDrop, Mail; elsewhere the file downloads.
 * `raw` lets the crash screen save what is in storage without the store.
 */
export async function saveBackupFile(raw?: string): Promise<SaveResult> {
  const file = backupFile(raw ?? exportJSON());
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Капитал — резервная копия" });
      if (!raw) useData.getState().updateSettings({ lastExternalBackup: nowISO() });
      return "shared";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    // Sharing refused (e.g. no user gesture) — fall back to a download.
  }
  try {
    download(file);
    if (!raw) useData.getState().updateSettings({ lastExternalBackup: nowISO() });
    return "downloaded";
  } catch {
    return "failed";
  }
}
