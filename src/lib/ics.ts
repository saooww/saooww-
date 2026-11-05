import type { Task } from "../store/types";
import { addDays, type DayKey } from "./dates";

/**
 * A task as a calendar event with a reminder. The phone's Calendar then
 * reminds about it even when the app is closed — a web app on iPhone can't
 * schedule notifications on its own.
 */

const RRULE: Record<Exclude<Task["repeat"], "none">, string> = {
  day: "FREQ=DAILY",
  weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  week: "FREQ=WEEKLY",
  month: "FREQ=MONTHLY",
  year: "FREQ=YEARLY"
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = (d: DayKey) => d.replace(/-/g, "");

/** Lines longer than 75 octets are folded, as the format requires. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function utcStamp(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function taskToICS(task: Task, opts: { listName?: string; remindBefore?: number } = {}): string {
  if (!task.due) throw new Error("A task needs a date to become an event");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kapital//Planner//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT"];
  lines.push(`UID:${task.id}@kapital.app`, `DTSTAMP:${utcStamp()}`);
  if (task.time) {
    const [h, m] = task.time.split(":").map(Number);
    const endMin = h * 60 + m + 30;
    const endDay = endMin >= 24 * 60 ? addDays(task.due, 1) : task.due;
    const em = endMin % (24 * 60);
    // Floating local time: the event stays at the same clock time wherever the phone is.
    lines.push(`DTSTART:${compact(task.due)}T${task.time.replace(":", "")}00`);
    lines.push(`DTEND:${compact(endDay)}T${String(Math.floor(em / 60)).padStart(2, "0")}${String(em % 60).padStart(2, "0")}00`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compact(task.due)}`, `DTEND;VALUE=DATE:${compact(addDays(task.due, 1))}`);
  }
  if (task.repeat !== "none") lines.push(`RRULE:${RRULE[task.repeat]}`);
  lines.push(`SUMMARY:${esc(task.title)}`);
  const details = [
    task.note,
    task.subtasks?.length ? task.subtasks.map((s) => `${s.done ? "✓" : "○"} ${s.title}`).join("\n") : undefined,
    opts.listName ? `Список: ${opts.listName}` : undefined
  ].filter(Boolean);
  if (details.length) lines.push(`DESCRIPTION:${esc(details.join("\n\n"))}`);
  lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(task.title)}`);
  // Timed: shortly before. All-day: at 9:00 on the day.
  lines.push(task.time ? `TRIGGER:-PT${opts.remindBefore ?? 15}M` : "TRIGGER:PT9H");
  lines.push("END:VALARM", "END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

const isApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Hands the event to the system. On iPhone Safari shows it with
 * «Add to Calendar»; elsewhere the .ics file downloads.
 */
export function openInCalendar(task: Task, listName?: string): boolean {
  try {
    const file = new File([taskToICS(task, { listName })], `${task.title.slice(0, 40).replace(/[\\/:*?"<>|]/g, "") || "task"}.ics`, { type: "text/calendar" });
    const url = URL.createObjectURL(file);
    if (isApple()) {
      window.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    return false;
  }
}
