import { useState } from "react";
import { X } from "lucide-react";

/** Free-form tags: type and press Enter (or a comma); tap a suggestion to add it. */
export function TagInput({ value, onChange, suggestions = [], placeholder = "Добавить тег" }: { value: string[]; onChange: (tags: string[]) => void; suggestions?: string[]; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/^#/, "").toLowerCase();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
  };
  const rest = suggestions.filter((s) => !value.includes(s)).slice(0, 8);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-3 pl-3 pr-1.5 text-subhead">
            #{t}
            <button type="button" aria-label={`Убрать тег ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="grid h-6 w-6 place-items-center rounded-full text-ink-2 active:bg-surface-press">
              <X size={13} strokeWidth={2.4} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",") || v.endsWith(" ")) {
              add(v.slice(0, -1));
              setDraft("");
            } else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft) {
              add(draft);
              setDraft("");
            }
          }}
          placeholder={placeholder}
          enterKeyHint="done"
          className="h-8 min-w-[120px] flex-1 bg-transparent text-body outline-none placeholder:text-ink-3"
        />
      </div>
      {rest.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rest.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="h-7 rounded-full border border-line-strong px-2.5 text-footnote text-ink-2 active:bg-surface-3">
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
