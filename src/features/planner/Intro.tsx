import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import { haptic } from "../../lib/haptics";
import { AREA_PRESETS } from "../../lib/tasks";
import { useData } from "../../store/store";
import { Button } from "../../ui/primitives";
import { Sheet, useSheet } from "../../ui/Sheet";
import { createAreas } from "./ListsView";
import { Enso } from "./Enso";

const HABITS = [
  { title: "Записывайте сразу", text: "Вспомнили — запишите одной строкой. «Позвонить маме завтра в 18:00»: дата и время поймутся сами." },
  { title: "Утром — план", text: "Разберите записанное и выберите до трёх главных дел. С них и начинайте." },
  { title: "Вечером — итоги", text: "Отметьте сделанное, перенесите остальное, запишите пару строк в дневник." }
];

/** Shown once, the first time «Дела» is opened: the method in three habits and the first lists. */
export function PlannerIntroSheet() {
  const { close } = useSheet();
  const hasProjects = useData((s) => s.projects.length > 0);
  const [picked, setPicked] = useState<Set<string>>(new Set(["Личное", "Работа", "Дом", "Здоровье"]));
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setDrawn(1), 250);
    return () => window.clearTimeout(t);
  }, []);

  const seen = () => useData.getState().updateSettings({ plannerIntroSeen: true });

  return (
    <Sheet
      tall
      ariaLabel="Как вести дела"
      onClose={seen}
      footer={
        <Button
          block
          onClick={() => {
            if (!hasProjects && picked.size) createAreas([...picked]);
            seen();
            haptic("success");
            close();
          }}
        >
          Начать
        </Button>
      }
    >
      <div className="flex flex-col items-center px-6 pt-1 text-center">
        <Enso value={drawn} complete={drawn === 1} size={108} />
        <h2 className="mt-4 text-title-2 font-semibold text-balance">Голова — для идей, а не для хранения</h2>
        <p className="mt-1.5 max-w-[310px] text-callout text-ink-2">Три привычки, и дела перестанут теряться.</p>
      </div>

      <ol className="mt-6 flex flex-col gap-4 px-6">
        {HABITS.map((h, i) => (
          <motion.li key={h.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }} className="flex gap-3.5">
            <span className="fill-accent mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-footnote font-bold text-[var(--accent-on)]" style={{ transform: "rotate(-4deg)" }}>
              {i + 1}
            </span>
            <span>
              <span className="block text-headline font-semibold">{h.title}</span>
              <span className="mt-0.5 block text-subhead text-ink-2">{h.text}</span>
            </span>
          </motion.li>
        ))}
      </ol>

      {!hasProjects && (
        <div className="mt-7 px-6">
          <div className="text-headline font-semibold">Сферы жизни</div>
          <p className="mt-0.5 text-subhead text-ink-2">Для каждой появится свой список. Потом можно добавить проекты: «Ремонт», «Переезд».</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {AREA_PRESETS.map((a) => {
              const on = picked.has(a.name);
              return (
                <button
                  key={a.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    haptic();
                    setPicked((s) => {
                      const n = new Set(s);
                      if (on) n.delete(a.name);
                      else n.add(a.name);
                      return n;
                    });
                  }}
                  className={cn("inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-subhead font-medium transition-colors", on ? "bg-ink text-ink-inverse" : "tile text-ink-2")}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
  );
}
