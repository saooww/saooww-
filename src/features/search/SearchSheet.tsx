import { useMemo, useState } from "react";
import { CalendarCheck, HandCoins, ListTodo, NotebookPen, Repeat, Search, Shapes, Target, X } from "lucide-react";
import { dayOf, formatDate } from "../../lib/dates";
import { useData } from "../../store/store";
import { nav, useUI } from "../../store/ui";
import { walletKindInfo } from "../../store/catalog";
import { IconChip } from "../../ui/primitives";
import { Sheet, useSheet } from "../../ui/Sheet";
import { TxRow, usePresentCtx } from "../transactions/TxRow";
import type { LucideIcon } from "lucide-react";

interface Hit {
  key: string;
  icon?: LucideIcon;
  iconName?: string;
  title: string;
  sub?: string;
  open: () => void;
}

/** One search box for everything: operations, wallets, goals, debts, notes, tasks, plans, subscriptions, categories. */
export function SearchSheet() {
  const { close } = useSheet();
  const [q, setQ] = useState("");
  const s = useData();
  const ctx = usePresentCtx();
  const query = q.trim().toLowerCase();

  const res = useMemo(() => {
    if (query.length < 2) return null;
    const has = (...parts: Array<string | undefined>) => parts.some((p) => p && p.toLowerCase().includes(query));
    const digits = query.replace(/[^\d]/g, "");
    const cat = new Map(s.categories.map((c) => [c.id, c.name]));
    const go = (fn: () => void) => () => {
      close();
      setTimeout(fn, 60);
    };
    const tx = s.transactions
      .filter((t) => has(t.note, t.categoryId ? cat.get(t.categoryId) : undefined, ...t.tags) || (digits.length >= 3 && String(Math.round(t.amount / 100)).includes(digits)))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 12);
    const groups: Array<{ title: string; hits: Hit[] }> = [
      { title: "Кошельки", hits: s.wallets.filter((w) => has(w.name, w.ident)).map((w) => ({ key: w.id, iconName: walletKindInfo(w.kind).icon, title: w.name, sub: w.archived ? "В архиве" : walletKindInfo(w.kind).label, open: go(() => nav.push("wallet", { id: w.id }, "wallets")) })) },
      { title: "Цели", hits: s.goals.filter((g) => has(g.name)).map((g) => ({ key: g.id, icon: Target, title: g.name, sub: g.deadline ? `до ${formatDate(g.deadline)}` : undefined, open: go(() => nav.push("goal", { id: g.id }, "more")) })) },
      { title: "Долги", hits: s.debts.filter((d) => has(d.counterparty, d.note)).map((d) => ({ key: d.id, icon: HandCoins, title: d.counterparty, sub: d.direction === "owed_to_me" ? "Вам должны" : "Вы должны", open: go(() => nav.push("debt", { id: d.id }, "more")) })) },
      { title: "Заметки", hits: s.notes.filter((n) => has(n.title, n.body, ...n.tags)).map((n) => ({ key: n.id, icon: NotebookPen, title: n.title || "Без названия", sub: n.body.slice(0, 60), open: go(() => nav.push("note", { id: n.id }, "more")) })) },
      { title: "Задачи", hits: s.tasks.filter((t) => has(t.title, t.note)).map((t) => ({ key: t.id, icon: ListTodo, title: t.title, sub: t.done ? "Выполнено" : t.due ? formatDate(t.due) : undefined, open: go(() => nav.sheet("task", { editId: t.id })) })) },
      { title: "Планы", hits: s.plans.filter((p) => has(p.title, p.note)).map((p) => ({ key: p.id, icon: CalendarCheck, title: p.title, sub: formatDate(p.date), open: go(() => nav.sheet("planActions", { id: p.id })) })) },
      { title: "Подписки и платежи", hits: s.recurring.filter((r) => has(r.title)).map((r) => ({ key: r.id, icon: Repeat, title: r.title, sub: `следующий — ${formatDate(r.nextDate)}`, open: go(() => nav.sheet("recurring", { editId: r.id })) })) },
      {
        title: "Категории",
        hits: s.categories
          .filter((c) => has(c.name))
          .map((c) => ({
            key: c.id,
            iconName: c.icon,
            title: c.name,
            sub: "Показать операции",
            open: go(() => {
              useUI.getState().setTxFilter({ categoryId: c.id }, true);
              nav.tab("transactions");
            })
          }))
      }
    ].filter((g) => g.hits.length);
    return { tx, groups, total: tx.length + groups.reduce((n, g) => n + g.hits.length, 0) };
  }, [query, s, close]);

  return (
    <Sheet tall ariaLabel="Поиск">
      <div className="px-4 pb-3">
        <label className="flex h-11 items-center gap-2 rounded-md bg-surface-3 px-3">
          <Search size={18} className="text-ink-3" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Операции, цели, заметки, люди…" enterKeyHint="search" className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-ink-3" />
          {q && (
            <button type="button" aria-label="Очистить" onClick={() => setQ("")} className="grid h-6 w-6 place-items-center rounded-full bg-ink-4 text-ink-inverse">
              <X size={13} strokeWidth={3} />
            </button>
          )}
        </label>
      </div>
      {!res ? (
        <div className="px-6 pt-10 text-center">
          <IconChip icon={Shapes} size={52} />
          <p className="mx-auto mt-3 max-w-[260px] text-callout text-ink-2">Ищите по названию, комментарию, тегу, имени или сумме</p>
        </div>
      ) : res.total === 0 ? (
        <div className="px-6 pt-10 text-center text-callout text-ink-2">По запросу «{q}» ничего нет</div>
      ) : (
        <div className="flex flex-col gap-5">
          {res.groups.map((g) => (
            <section key={g.title}>
              <h3 className="px-5 pb-1.5 text-footnote font-semibold text-ink-2">{g.title}</h3>
              <div className="mx-4 overflow-hidden rounded-lg bg-surface [&>*+*]:hairline-t">
                {g.hits.slice(0, 6).map((h) => (
                  <button key={h.key} type="button" onClick={h.open} className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-press">
                    <IconChip icon={h.icon} name={h.iconName} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body">{h.title}</div>
                      {h.sub && <div className="truncate text-footnote text-ink-2">{h.sub}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {res.tx.length > 0 && (
            <section>
              <h3 className="px-5 pb-1.5 text-footnote font-semibold text-ink-2">Операции</h3>
              <div className="mx-4 overflow-hidden rounded-lg bg-surface [&>*+*]:hairline-t">
                {res.tx.map((t) => (
                  <div key={t.id}>
                    <div className="px-4 pt-2 text-caption text-ink-3">{formatDate(dayOf(t.date))}</div>
                    <TxRow tx={t} ctx={ctx} dense onOpen={(x) => nav.sheet("tx", { id: x.id })} />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  useUI.getState().setTxFilter({ query: q }, true);
                  close();
                  nav.tab("transactions");
                }}
                className="mt-2 w-full py-2 text-center text-subhead font-semibold text-accent-ink"
              >
                Все операции по запросу
              </button>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

