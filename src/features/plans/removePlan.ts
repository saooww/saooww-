import { useData } from "../../store/store";
import type { Plan } from "../../store/types";
import { nav } from "../../store/ui";
import { confirmDelete, undoable } from "../../store/undo";
import { tr } from "../../i18n/i18n";

/**
 * Removing an expected income. A one-off is deleted after a confirmation;
 * a monthly one asks whether to skip only this month or to stop the repeat.
 * Money already received stays as ordinary income either way.
 */
export function askRemovePlan(plan: Plan, after?: () => void) {
  const done = (series: boolean) => {
    undoable(series || plan.repeat !== "month" ? tr("Ожидаемый доход удалён") : tr("Этот месяц пропущен"), () => useData.getState().removePlan(plan.id, series));
    after?.();
  };
  if (plan.repeat === "month") {
    nav.sheet("picker", {
      title: tr("Удалить «{0}»", plan.title),
      options: [
        { value: "one", label: tr("Только этот месяц"), sub: tr("Следующие месяцы останутся") },
        { value: "all", label: tr("Этот и все следующие"), sub: tr("Повтор каждый месяц отключится") }
      ],
      onSelect: (v: string) => done(v === "all")
    });
    return;
  }
  confirmDelete({
    title: tr("Удалить «{0}»?", plan.title),
    message: tr("То, что уже пришло, останется обычным доходом."),
    onConfirm: () => done(false)
  });
}
