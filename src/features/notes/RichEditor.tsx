import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { Camera, X } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { MARK_COLORS, TEXT_COLORS, htmlToText, sanitizeHtml, textToHtml } from "../../lib/richText";
import { photoUrl, savePhoto, photosSupported } from "../../store/photos";
import { nav } from "../../store/ui";
import { PhotoViewer } from "../transactions/Photos";
import { tr } from "../../i18n/i18n";

type Cmd = "bold" | "italic" | "underline" | "strikeThrough" | "insertUnorderedList" | "insertOrderedList" | "justifyLeft" | "justifyCenter";
type Panel = null | "color" | "mark";

const exec = (cmd: string, value?: string) => document.execCommand(cmd, false, value);

/** Serialises the editor: photos keep only their id, the rest goes through the sanitizer. */
function serialize(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("figure[data-photo]").forEach((f) => (f.innerHTML = ""));
  return sanitizeHtml(clone.innerHTML);
}

/** Puts the picture into every empty photo block. */
function hydrate(root: HTMLElement, onOpen: (id: string) => void) {
  root.querySelectorAll<HTMLElement>("figure[data-photo]").forEach((f) => {
    if (f.dataset.ready) return;
    f.dataset.ready = "1";
    f.setAttribute("contenteditable", "false");
    const id = f.getAttribute("data-photo")!;
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    img.addEventListener("click", () => onOpen(id));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "rich-fig-x";
    del.setAttribute("aria-label", tr("Убрать фото"));
    del.textContent = "×";
    del.addEventListener("click", () => {
      f.remove();
      root.dispatchEvent(new Event("input", { bubbles: true }));
    });
    f.replaceChildren(img, del);
    void photoUrl(id).then((u) => {
      if (u) img.src = u;
    });
  });
}

/**
 * The text of a note: headings, bold/italic/underline, lists, quote, colour, highlight,
 * alignment and photos placed in the text. Uncontrolled on purpose — the caret never jumps.
 */
export function RichEditor({
  noteId,
  html,
  body,
  placeholder,
  autoFocus,
  onChange
}: {
  noteId: string;
  html?: string;
  body: string;
  placeholder: string;
  autoFocus?: boolean;
  onChange: (html: string, text: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const range = useRef<Range | null>(null);
  const timer = useRef<number | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [block, setBlock] = useState("p");
  const [panel, setPanel] = useState<Panel>(null);
  const [empty, setEmpty] = useState(true);
  const [viewer, setViewer] = useState<{ ids: string[]; i: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(onChange);
  latest.current = onChange;

  const openPhoto = useCallback((id: string) => {
    const ids = [...(root.current?.querySelectorAll("figure[data-photo]") ?? [])].map((f) => f.getAttribute("data-photo")!);
    setViewer({ ids, i: Math.max(0, ids.indexOf(id)) });
  }, []);

  const flush = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const el = root.current;
    if (!el) return;
    const h = serialize(el);
    latest.current(h, htmlToText(h));
  }, []);

  // load once per note
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    el.innerHTML = sanitizeHtml(html ?? textToHtml(body));
    hydrate(el, openPhoto);
    setEmpty(!el.textContent && !el.querySelector("figure"));
    if (autoFocus) el.focus();
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      const el = root.current;
      if (!sel || !el || !sel.rangeCount || !el.contains(sel.anchorNode)) return;
      range.current = sel.getRangeAt(0).cloneRange();
      const st: Record<string, boolean> = {};
      for (const c of ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"] as Cmd[]) st[c] = document.queryCommandState(c);
      setActive(st);
      const b = String(document.queryCommandValue("formatBlock") || "p").toLowerCase();
      setBlock(b === "h2" || b === "h3" || b === "blockquote" ? b : "p");
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const changed = () => {
    const el = root.current;
    if (!el) return;
    setEmpty(!el.textContent && !el.querySelector("figure"));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 300);
  };

  const restore = () => {
    const el = root.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (range.current && sel) {
      sel.removeAllRanges();
      sel.addRange(range.current);
    }
  };

  const run = (cmd: string, value?: string) => {
    restore();
    // colours are spans with a style; bold, italic… stay real tags so they survive the sanitizer
    exec("styleWithCSS", cmd === "foreColor" || cmd === "hiliteColor" || cmd === "justifyCenter" ? "true" : "false");
    exec(cmd, value);
    haptic();
    changed();
  };
  const setBlockTo = (tag: string) => {
    restore();
    exec("formatBlock", block === tag ? "p" : tag);
    haptic();
    changed();
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const id = await savePhoto(f);
        restore();
        exec("insertHTML", `<figure data-photo="${id}" contenteditable="false"></figure><p><br></p>`);
      }
      if (root.current) hydrate(root.current, openPhoto);
      haptic("success");
      changed();
    } catch {
      nav.toast(tr("Не получилось сохранить фото"), { tone: "warning" });
    } finally {
      setBusy(false);
    }
  };

  const Btn = ({ on, label, onClick, children, wide }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode; wide?: boolean }) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      // keep the selection in the text while a tool is pressed
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("grid h-9 shrink-0 place-items-center rounded-[11px] text-[15px] transition-colors", wide ? "min-w-[44px] px-2" : "w-9", on ? "bg-[var(--plan-soft)] text-[var(--plan)]" : "text-ink-2 active:bg-surface-3")}
    >
      {children}
    </button>
  );
  const Sep = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--line)]" />;

  return (
    <div>
      <div className="rich-bar sticky top-0 z-10 -mx-5 mb-1 px-3 py-1.5">
        <div className="scroll-x flex items-center gap-0.5" role="toolbar" aria-label={tr("Оформление текста")}>
          <Btn label={tr("Заголовок")} on={block === "h2"} onClick={() => setBlockTo("h2")} wide><b className="text-[15px]">H1</b></Btn>
          <Btn label={tr("Подзаголовок")} on={block === "h3"} onClick={() => setBlockTo("h3")} wide><b className="text-[14px]">H2</b></Btn>
          <Sep />
          <Btn label={tr("Жирный")} on={active.bold} onClick={() => run("bold")}><b>B</b></Btn>
          <Btn label={tr("Курсив")} on={active.italic} onClick={() => run("italic")}><i className="font-serif">I</i></Btn>
          <Btn label={tr("Подчёркнутый")} on={active.underline} onClick={() => run("underline")}><u>U</u></Btn>
          <Btn label={tr("Зачёркнутый")} on={active.strikeThrough} onClick={() => run("strikeThrough")}><s>S</s></Btn>
          <Sep />
          <Btn label={tr("Список")} on={active.insertUnorderedList} onClick={() => run("insertUnorderedList")}>•≡</Btn>
          <Btn label={tr("Нумерованный список")} on={active.insertOrderedList} onClick={() => run("insertOrderedList")}>1.</Btn>
          <Btn label={tr("Цитата")} on={block === "blockquote"} onClick={() => setBlockTo("blockquote")}>❝</Btn>
          <Sep />
          <Btn label={tr("Цвет текста")} on={panel === "color"} onClick={() => setPanel(panel === "color" ? null : "color")}>
            <span className="grid place-items-center leading-none"><b>A</b><i className="mt-px block h-[3px] w-4 rounded-full bg-[var(--plan)]" /></span>
          </Btn>
          <Btn label={tr("Выделение цветом")} on={panel === "mark"} onClick={() => setPanel(panel === "mark" ? null : "mark")}>
            <span className="rounded-[4px] bg-[color-mix(in_srgb,var(--plan)_40%,transparent)] px-1 font-bold">A</span>
          </Btn>
          <Btn label={tr("По центру")} onClick={() => run("justifyCenter")}>≣</Btn>
          <Sep />
          {photosSupported() && (
            <Btn label={tr("Добавить фото")} onClick={() => { restore(); file.current?.click(); }} wide>
              <Camera size={19} strokeWidth={1.8} className={busy ? "animate-pulse" : ""} />
            </Btn>
          )}
        </div>
        {panel && (
          <div className="mt-1.5 flex items-center gap-2.5 px-1.5 pb-0.5" role="group" aria-label={panel === "color" ? tr("Цвет текста") : tr("Выделение цветом")}>
            {(panel === "color" ? TEXT_COLORS : MARK_COLORS).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  run(panel === "color" ? "foreColor" : "hiliteColor", panel === "mark" ? `${c}66` : c);
                  setPanel(null);
                }}
                className="h-7 w-7 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
                style={{ background: c }}
              />
            ))}
            <button type="button" aria-label={tr("Сбросить")} onPointerDown={(e) => e.preventDefault()} onClick={() => { run(panel === "color" ? "foreColor" : "hiliteColor", panel === "color" ? "#f5f3f0" : "transparent"); setPanel(null); }} className="grid h-7 w-7 place-items-center rounded-full text-ink-3 shadow-[inset_0_0_0_1px_var(--line-strong)]">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        {empty && <div aria-hidden className="pointer-events-none absolute left-0 top-0 text-body leading-[26px] text-ink-4">{placeholder}</div>}
        <div
          ref={root}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          aria-label={tr("Текст заметки")}
          spellCheck
          onInput={changed}
          onBlur={flush}
          onPaste={(e) => {
            // paste as plain text: no foreign fonts or colours
            e.preventDefault();
            exec("insertText", e.clipboardData.getData("text/plain"));
          }}
          className="rich min-h-[240px] pb-24 outline-none"
        />
      </div>

      <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
      {createPortal(<AnimatePresence>{viewer && <PhotoViewer ids={viewer.ids} index={viewer.i} onClose={() => setViewer(null)} />}</AnimatePresence>, document.body)}
    </div>
  );
}
