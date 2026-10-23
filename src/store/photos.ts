import { uid } from "../lib/id";
import { hasIDB, idb, PHOTOS } from "./storage";

/**
 * Receipt photos live in IndexedDB as compressed JPEG blobs; transactions
 * keep only their ids. They are not part of JSON backups.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.72;
const urls = new Map<string, string>();
/** Photos added since launch — possibly in a draft not saved yet; never pruned. */
const sessionPhotos = new Set<string>();

export function photosSupported(): boolean {
  return hasIDB();
}

async function compress(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function savePhoto(file: Blob): Promise<string> {
  const blob = await compress(file);
  const id = uid("p-");
  await idb.set(PHOTOS, id, blob);
  sessionPhotos.add(id);
  return id;
}

export async function photoUrl(id: string): Promise<string | null> {
  const cached = urls.get(id);
  if (cached) return cached;
  try {
    const blob = await idb.get<Blob>(PHOTOS, id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urls.set(id, url);
    return url;
  } catch {
    return null;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
  try {
    await idb.del(PHOTOS, id);
  } catch {
    /* ignore */
  }
}

/** Removes photos no transaction refers to any more (deleted operations, cancelled drafts). */
export async function prunePhotos(referenced: Set<string>): Promise<void> {
  if (!hasIDB()) return;
  try {
    for (const id of await idb.keys(PHOTOS)) if (!referenced.has(id) && !sessionPhotos.has(id)) await deletePhoto(id);
  } catch {
    /* ignore */
  }
}

export async function clearPhotos(): Promise<void> {
  sessionPhotos.clear();
  await prunePhotos(new Set());
}
