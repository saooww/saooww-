import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search } from "../../ui/glyphs";
import { useData } from "../../store/store";
import { nav, useUI, type PlannerView } from "../../store/ui";
import { Screen, useRoute } from "../../nav/Screen";
import { IconButton, Segmented } from "../../ui/primitives";
import { NotesView, createNote } from "../notes/Notes";
import { ListsView } from "./ListsView";
import { TodayView } from "./TodayView";
import { WeekView } from "./WeekView";
import { useToday } from "../../store/hooks";

const VIEWS: Array<{ value: PlannerView; label: string }> = [
  { value: "today", label: "Сегодня" },
  { value: "week", label: "Неделя" },
  { value: "lists", label: "Списки" },
  { value: "notes", label: "Заметки" }
];

/** «Дела»: today, the week, lists and notes — everything that is not money. */
export function PlannerScreen() {
  const view = useUI((s) => s.plannerView);
  const setView = useUI((s) => s.setPlannerView);
  const today = useToday();

  const add = () => {
    if (view === "notes") createNote();
    else nav.sheet("quickAdd", view === "today" ? { due: today } : {});
  };

  return (
    <div className="absolute inset-0">
      <IntroOnFirstVisit />
      <Screen title="Дела" large actions={
          <>
            <IconButton icon={Search} label="Поиск" onClick={() => nav.sheet("search")} />
            <IconButton icon={Plus} label={view === "notes" ? "Новая заметка" : "Новое дело"} onClick={add} />
          </>
        }>
        <div className="px-4 pb-5">
          <Segmented value={view} onChange={setView} options={VIEWS} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }} className="pb-16">
            {view === "today" ? <TodayView /> : view === "week" ? <WeekView /> : view === "lists" ? <ListsView /> : <NotesView />}
          </motion.div>
        </AnimatePresence>
      </Screen>
    </div>
  );
}

/**
 * Opens the introduction the first time the tab is shown. Kept apart from
 * the screen: it re-renders whenever the tab is switched, the lists don't.
 */
function IntroOnFirstVisit() {
  const { active } = useRoute();
  const introSeen = useData((s) => s.settings.plannerIntroSeen);
  const asked = useRef(false);

  useEffect(() => {
    if (!active || introSeen || asked.current) return;
    asked.current = true;
    const t = window.setTimeout(() => {
      const ui = useUI.getState();
      if (!ui.locked && !ui.onboarding && ui.tab === "planner") nav.sheet("plannerIntro", {});
    }, 450);
    return () => window.clearTimeout(t);
  }, [active, introSeen]);

  return null;
}
