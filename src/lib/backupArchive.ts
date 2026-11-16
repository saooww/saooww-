import { tr } from "../i18n/i18n";
import { uid } from "./id";
import { DATA_KEYS, type AppData } from "../store/types";
import { photoIdsOf } from "./richText";

interface EncodedPhoto {
  id: string;
  type: string;
  base64: string;
}

export interface BackupArchive {
  data: AppData;
  exportedAt: string;
  photos: Map<string, Blob>;
  missingPhotos: number;
}

export function backupPhotoIds(data: AppData): Set<string> {
  return new Set([
    ...data.transactions.flatMap((tx) => tx.photos ?? []),
    ...data.tasks.flatMap((task) => task.photos ?? []),
    ...data.notes.flatMap((note) => photoIdsOf(note.html))
  ]);
}

export async function encodeBackup(data: AppData, exportedAt: string, readPhoto: (id: string) => Promise<Blob | undefined>): Promise<string> {
  const photos: EncodedPhoto[] = [];
  const missing: string[] = [];
  for (const id of backupPhotoIds(data)) {
    const blob = await readPhoto(id);
    if (!blob) {
      missing.push(id);
      continue;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    photos.push({ id, type: blob.type, base64: btoa(binary) });
  }
  // Lock credentials are device-specific and do not belong in a portable file.
  const settings = { ...data.settings, lockEnabled: false };
  delete settings.lockPinHash;
  delete settings.lockSalt;
  delete settings.lockCredentialId;
  return JSON.stringify({ app: "kapital", version: 3, exportedAt, data: { ...data, settings }, photos, missing });
}

type RecordValue = Record<string, unknown>;
const isObject = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const isPhotoId = (value: unknown): value is string => typeof value === "string" && /^p-[\w-]+$/.test(value);
const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && Number.isFinite(Date.parse(value));
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isPositive = (value: unknown): boolean => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function invalid(): never {
  throw new Error(tr("Резервная копия повреждена или имеет неподдерживаемый формат"));
}

function validateData(value: unknown): AppData {
  if (!isObject(value) || !isObject(value.settings) || !isObject(value.meta)) invalid();
  for (const key of DATA_KEYS) {
    if (key === "settings" || key === "meta") continue;
    const rows = value[key];
    if (!Array.isArray(rows)) invalid();
    const ids = new Set<string>();
    for (const row of rows) {
      if (!isObject(row) || !isId(row.id) || ids.has(row.id)) invalid();
      ids.add(row.id);
    }
  }
  const data = value as unknown as AppData;
  const walletIds = new Set(data.wallets.map((wallet) => wallet.id));
  for (const wallet of data.wallets) {
    if (typeof wallet.name !== "string" || !isId(wallet.currency) || !Number.isSafeInteger(wallet.openingBalance) || !isDate(wallet.createdAt)) invalid();
  }
  for (const tx of data.transactions) {
    if (!["income", "expense", "transfer", "adjustment", "debt", "goal"].includes(tx.kind) ||
        !isPositive(tx.amount) || !isDate(tx.date) || !isDate(tx.createdAt) || !isStrings(tx.tags) ||
        (tx.walletId !== undefined && !walletIds.has(tx.walletId)) ||
        (tx.toWalletId !== undefined && !walletIds.has(tx.toWalletId)) ||
        (tx.toAmount !== undefined && !isPositive(tx.toAmount)) ||
        (tx.kind === "transfer" && (!tx.walletId || !tx.toWalletId || tx.walletId === tx.toWalletId))) invalid();
  }
  for (const row of [...data.transactions, ...data.tasks]) {
    if (row.photos !== undefined && (!Array.isArray(row.photos) || !row.photos.every(isPhotoId))) invalid();
  }
  for (const note of data.notes) {
    if (typeof note.title !== "string" || typeof note.body !== "string" || !isStrings(note.tags) ||
        !Array.isArray(note.links) || (note.html !== undefined && typeof note.html !== "string")) invalid();
  }
  return data;
}

/** Read version 3. Older files continue through the existing JSON importer. */
export function decodeBackup(value: unknown): BackupArchive | null {
  if (!isObject(value) || value.app !== "kapital" || value.version === undefined || value.version === 1 || value.version === 2) return null;
  if (value.version !== 3 || !isDate(value.exportedAt) || !Array.isArray(value.photos) || !Array.isArray(value.missing)) invalid();
  const data = validateData(value.data);
  const references = backupPhotoIds(data);
  const photos = new Map<string, Blob>();
  for (const photo of value.photos) {
    if (!isObject(photo) || !isPhotoId(photo.id) || !references.delete(photo.id) ||
        typeof photo.type !== "string" || (photo.type !== "" && !/^image\/[\w.+-]+$/i.test(photo.type)) ||
        typeof photo.base64 !== "string" || !photo.base64 || photo.base64.length % 4) invalid();
    try {
      const bytes = Uint8Array.from(atob(photo.base64), (char) => char.charCodeAt(0));
      photos.set(photo.id, new Blob([bytes], { type: photo.type }));
    } catch {
      invalid();
    }
  }
  for (const id of value.missing) if (!isPhotoId(id) || !references.delete(id)) invalid();
  if (references.size) invalid();
  return { data, exportedAt: value.exportedAt, photos, missingPhotos: value.missing.length };
}

/** Isolate imported photos from those in the current data and local backups. */
export function remapBackupPhotos(archive: BackupArchive): { data: AppData; photos: Map<string, Blob> } {
  const ids = new Map([...backupPhotoIds(archive.data)].map((id) => [id, uid("p-")]));
  const photos = new Map([...archive.photos].map(([id, blob]) => [ids.get(id)!, blob]));
  const remap = (list?: string[]) => list?.map((id) => ids.get(id) ?? id);
  const data = {
    ...archive.data,
    transactions: archive.data.transactions.map((tx) => ({ ...tx, photos: remap(tx.photos) })),
    tasks: archive.data.tasks.map((task) => ({ ...task, photos: remap(task.photos) })),
    notes: archive.data.notes.map((note) => ({
      ...note,
      html: note.html?.replace(/data-photo="(p-[\w-]+)"/g, (match, id: string) => ids.has(id) ? `data-photo="${ids.get(id)}"` : match)
    }))
  };
  return { data, photos };
}
