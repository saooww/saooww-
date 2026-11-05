import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** Section heading inside the planner: sentence case, with an optional count and action. */
export function Heading({ title, aside, action, tone, className }: { title: ReactNode; aside?: ReactNode; action?: { label: string; onClick: () => void }; tone?: "negative"; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 px-5 pb-2.5", className)}>
      <h2 className={cn("text-headline font-semibold", tone === "negative" ? "text-negative" : "text-ink")}>
        {title}
        {aside !== undefined && <span className="num ml-2 text-subhead font-normal text-ink-3">{aside}</span>}
      </h2>
      {action && (
        <button type="button" onClick={action.onClick} className="-my-2 py-2 text-subhead font-semibold text-accent-ink active:opacity-60">
          {action.label}
        </button>
      )}
    </div>
  );
}

/** A dashed placeholder that invites an action. */
export function Invite({ text, action, className }: { text: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-4 flex items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-3.5", className)}>
      <span className="text-subhead text-ink-2">{text}</span>
      {action}
    </div>
  );
}

export function InviteButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-subhead font-semibold text-accent-ink active:opacity-60">
      {children}
    </button>
  );
}
