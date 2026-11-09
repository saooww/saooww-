import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, ChevronDown, Sparkles } from "../../ui/glyphs";
import { cn } from "../../lib/cn";
import { addDays } from "../../lib/dates";
import { freeCash } from "../../lib/analytics";
import { answerSave, answerTop, answerUpcoming, answerWhy, intentOf, type Answer, type Intent } from "../../lib/assistant";
import { goalInfo, goalSaved } from "../../lib/finance";
import { haptic } from "../../lib/haptics";
import { useAppData, useBalances, useCategoryMap, useEnvelopes, useLedger, useToday } from "../../store/hooks";
import { nav } from "../../store/ui";
import { Screen } from "../../nav/Screen";
import { NamedIcon } from "../../ui/icons";
import { Button } from "../../ui/primitives";
import { useEvents } from "../plans/Plans";
import { QUESTIONS } from "../home/HomeHero";
import { tr } from "../../i18n/i18n";

const ORDER: Intent[] = ["top", "why", "save", "upcoming"];

interface Turn {
  id: number;
  question: string;
  answer: Answer | null;
}

/**
 * «Спросить Ardessa»: a short conversation about your money. The answers are
 * worked out from your records on this device — no guessing, no server —
 * and each one can show how it was counted.
 */
export function AssistantScreen({ ask }: { ask?: number }) {
  const data = useAppData();
  const { entries } = useLedger();
  const balances = useBalances();
  const env = useEnvelopes();
  const categories = useCategoryMap();
  const today = useToday();
  const base = data.settings.baseCurrency;
  const events = useEvents(today, addDays(today, 14));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const seq = useRef(0);
  const end = useRef<HTMLDivElement>(null);

  const goal = useMemo(() => {
    const live = data.goals.filter((g) => !g.archived && goalInfo(g, goalSaved(g, env, balances), today).progress < 1 && g.currency === base);
    const g = live.find((x) => x.primary) ?? live[0];
    return g ? { id: g.id, name: g.name } : null;
  }, [data.goals, env, balances, today, base]);

  const answer = (intent: Intent): Answer => {
    if (intent === "top") return answerTop(entries, categories, today, base);
    if (intent === "why") return answerWhy(entries, categories, today, base);
    if (intent === "save") return answerSave(freeCash(data, balances, entries, today), goal, base);
    return answerUpcoming(
      events.filter((e) => !e.done && e.date >= today).map((e) => ({ date: e.date, title: e.title, amount: e.currency === base ? e.amount : undefined, direction: e.direction, kind: e.kind })),
      base
    );
  };

  const askQ = (question: string, intent: Intent | null) => {
    haptic();
    setTurns((t) => [...t, { id: ++seq.current, question, answer: intent ? answer(intent) : null }]);
  };

  // opened from a chip on the home screen: that question first
  useEffect(() => {
    if (ask !== undefined && ORDER[ask]) askQ(QUESTIONS[ask], ORDER[ask]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  return (
    <Screen title={tr("Спросить Ardessa")} large>
      <p className="-mt-3 px-5 pb-4 text-footnote text-ink-2">{tr("Ответы — только из ваших записей на этом устройстве, с расчётом. Без догадок.")}</p>

      {turns.length === 0 && (
        <div className="mx-4 flex flex-col gap-2">
          {QUESTIONS.map((q, i) => (
            <button key={q} type="button" onClick={() => askQ(q, ORDER[i])} className="panel flex items-center gap-3 rounded-[16px] px-4 py-3.5 text-left active:opacity-80">
              <Sparkles size={16} className="text-accent-ink" />
              <span className="text-body">{q}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 px-4">
        {turns.map((t) => (
          <div key={t.id} className="flex flex-col gap-2">
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="fill-accent ml-auto max-w-[85%] rounded-[18px] rounded-br-[5px] px-3.5 py-2.5 text-callout text-[var(--accent-on)]">
              {t.question}
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              {t.answer ? <AnswerCard a={t.answer} /> : <NotUnderstood onPick={(i) => askQ(QUESTIONS[i], ORDER[i])} />}
            </motion.div>
          </div>
        ))}
        <div ref={end} />
      </div>

      {turns.length > 0 && (
        <div className="scroll-x mt-4 flex gap-1.5 px-4">
          {QUESTIONS.map((q, i) => (
            <button key={q} type="button" onClick={() => askQ(q, ORDER[i])} className="tile shrink-0 rounded-full px-3 py-1.5 text-footnote">
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        className="panel mx-4 mt-4 flex h-12 items-center gap-2 rounded-[18px] pl-4 pr-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          askQ(text.trim(), intentOf(text));
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("Спросите о своих деньгах")} aria-label={tr("Вопрос")} enterKeyHint="send" className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3" />
        <button type="submit" aria-label={tr("Спросить")} disabled={!text.trim()} className="fill-accent grid h-9 w-9 place-items-center rounded-full text-[var(--accent-on)] disabled:opacity-30">
          <ArrowUp size={18} />
        </button>
      </form>
    </Screen>
  );
}

function AnswerCard({ a }: { a: Answer }) {
  const [how, setHow] = useState(false);
  return (
    <div className="panel max-w-[94%] rounded-[20px] rounded-bl-[6px] p-4">
      <p className="text-callout leading-snug text-ink">{a.text}</p>
      {a.rows.length > 0 && (
        <div className="mt-3 flex flex-col gap-2.5">
          {a.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="tile grid h-9 w-9 shrink-0 place-items-center rounded-[11px]" style={r.color ? { color: r.color } : undefined}>
                <NamedIcon name={r.icon} size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-subhead text-ink">{r.title}</span>
                {r.sub && <span className="block truncate text-caption text-ink-3">{r.sub}</span>}
              </span>
              <span className={cn("num shrink-0 text-subhead font-semibold", r.tone === "negative" ? "text-accent-ink" : r.tone === "positive" ? "text-positive" : "text-ink")}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
      {a.action && (
        <Button size="sm" className="mt-3" onClick={() => nav.sheet("goalMoney", { goalId: a.action!.goalId, direction: "deposit", amount: a.action!.amount })}>
          {tr("Отложить в «{0}»", a.action.goalName)}
        </Button>
      )}
      <button type="button" onClick={() => setHow((v) => !v)} className="mt-3 flex items-center gap-1 text-caption font-medium text-ink-3" aria-expanded={how}>
        <ChevronDown size={13} className={cn("transition-transform", how && "rotate-180")} />
        {tr("Как посчитано")}
      </button>
      <AnimatePresence initial={false}>
        {how && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-1.5 text-caption leading-snug text-ink-2">
            {a.how}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotUnderstood({ onPick }: { onPick: (i: number) => void }) {
  return (
    <div className="panel max-w-[94%] rounded-[20px] rounded-bl-[6px] p-4">
      <p className="text-callout text-ink">{tr("Пока я отвечаю на такие вопросы — выберите один:")}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUESTIONS.map((q, i) => (
          <button key={q} type="button" onClick={() => onPick(i)} className="tile rounded-full px-3 py-1.5 text-footnote">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
