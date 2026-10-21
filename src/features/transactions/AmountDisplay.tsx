import { motion } from "framer-motion";
import { cn } from "../../lib/cn";
import { currencySymbol, formatInputBuffer } from "../../lib/money";
import { spring } from "../../ui/motion";

function sizeFor(len: number, compact?: boolean): number {
  const base = compact ? 34 : 58;
  if (len <= 6) return base;
  if (len <= 9) return Math.round(base * 0.84);
  if (len <= 12) return Math.round(base * 0.7);
  return Math.round(base * 0.6);
}

/** The big amount being typed. New digits rise into place; a caret shows where input goes. */
export function AmountDisplay({
  buffer,
  currency,
  active = true,
  compact,
  sign,
  onClick,
  label
}: {
  buffer: string;
  currency: string;
  active?: boolean;
  compact?: boolean;
  sign?: "+" | "−";
  onClick?: () => void;
  label?: string;
}) {
  const { int, frac } = formatInputBuffer(buffer);
  const empty = !buffer;
  const text = int + frac;
  const size = sizeFor(text.length, compact);
  const chars = text.split("");

  const content = (
    <div className={cn("flex flex-col items-center", !active && "opacity-45")}>
      {label && <div className="mb-1 text-footnote font-medium text-ink-2">{label}</div>}
      <div
        className="flex items-baseline justify-center whitespace-nowrap font-semibold leading-none tracking-[-0.045em] tnum"
        style={{ fontSize: size, height: size * 1.12 }}
        aria-live="polite"
        aria-label={`Сумма: ${text} ${currencySymbol(currency)}`}
      >
        {sign && !empty && <span className="mr-[0.06em] text-ink-2">{sign}</span>}
        {chars.map((ch, i) => (
          <motion.span
            key={i}
            className={empty ? "text-ink-3" : "text-ink"}
            initial={empty ? false : { y: size * 0.28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={spring.snappy}
          >
            {ch}
          </motion.span>
        ))}
        {active && (
          <span className="ml-[3px] inline-block w-[2.5px] self-center rounded-full bg-accent" style={{ height: size * 0.78, animation: "caret 1.1s steps(1) infinite" }} />
        )}
        <span className="ml-[0.18em] text-[0.56em] font-medium text-ink-2">{currencySymbol(currency)}</span>
      </div>
    </div>
  );

  if (!onClick) return content;
  return (
    <button type="button" onClick={onClick} className="block">
      {content}
    </button>
  );
}
