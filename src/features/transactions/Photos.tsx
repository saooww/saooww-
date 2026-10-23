import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, X } from "lucide-react";
import { haptic } from "../../lib/haptics";
import { photoUrl, photosSupported, savePhoto } from "../../store/photos";
import { nav } from "../../store/ui";
import { ease } from "../../ui/motion";

function usePhotoUrl(id: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    photoUrl(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export function PhotoThumb({ id, size = 64, onOpen, onRemove }: { id: string; size?: number; onOpen?: () => void; onRemove?: () => void }) {
  const url = usePhotoUrl(id);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <button type="button" aria-label="Открыть фото чека" onClick={onOpen} className="tile block h-full w-full overflow-hidden rounded-[14px]">
        {url && <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />}
      </button>
      {onRemove && (
        <button type="button" aria-label="Убрать фото" onClick={onRemove} className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-ink-inverse shadow-pop">
          <X size={13} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

/** A file input styled as a tile: on iPhone it offers the camera or the photo library. */
export function AddPhotoButton({ onAdded, size = 64, label = "Фото" }: { onAdded: (id: string) => void; size?: number; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!photosSupported()) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="tile flex shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] text-ink-2"
        style={{ width: size, height: size }}
        aria-label="Добавить фото чека"
      >
        <Camera size={20} strokeWidth={1.8} />
        <span className="text-[11px] font-medium">{busy ? "…" : label}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            onAdded(await savePhoto(f));
            haptic("success");
          } catch {
            nav.toast("Не получилось сохранить фото", { tone: "warning" });
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

export function PhotoViewer({ ids, index, onClose }: { ids: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const url = usePhotoUrl(ids[i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => Math.min(ids.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids.length, onClose]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[130] flex flex-col bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: ease.out }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.5}
      onDragEnd={(_, info) => Math.abs(info.offset.y) > 100 && onClose()}
      role="dialog"
      aria-label="Фото чека"
    >
      <div className="flex items-center justify-between px-4" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
        <span className="text-footnote text-white/60">{ids.length > 1 ? `${i + 1} из ${ids.length}` : ""}</span>
        <button type="button" aria-label="Закрыть" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white">
          <X size={20} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={() => ids.length > 1 && setI((n) => (n + 1) % ids.length)}>
        <AnimatePresence mode="wait">
          {url && <motion.img key={ids[i]} src={url} alt="Фото чека" className="max-h-full max-w-full rounded-[12px] object-contain" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} draggable={false} />}
        </AnimatePresence>
      </div>
    </motion.div>,
    document.body
  );
}

/** Thumbnails with an add tile; removal only detaches (the photo store is pruned on launch). */
export function PhotoStrip({ ids, onChange }: { ids: string[]; onChange?: (ids: string[]) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="scroll-x flex gap-2.5 px-4 py-3">
        {ids.map((id, k) => (
          <PhotoThumb key={id} id={id} onOpen={() => setOpen(k)} onRemove={onChange ? () => onChange(ids.filter((x) => x !== id)) : undefined} />
        ))}
        {onChange && <AddPhotoButton onAdded={(id) => onChange([...ids, id])} />}
      </div>
      <AnimatePresence>{open !== null && <PhotoViewer ids={ids} index={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </>
  );
}
