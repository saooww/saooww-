import { Component, type ErrorInfo, type ReactNode } from "react";
import { nowISO } from "../lib/dates";
import { saveBackupFile } from "../lib/backupFile";
import { kvGet } from "../store/storage";
import { STORAGE_KEY } from "../store/store";

/** What is in storage right now, as a backup file the app can import. */
async function storedBackup(): Promise<string | null> {
  const raw = await kvGet(STORAGE_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw).state;
    return JSON.stringify({ app: "kapital", version: 2, exportedAt: nowISO(), data: state }, null, 2);
  } catch {
    return raw;
  }
}

interface State {
  error: Error | null;
  note: string | null;
}

/**
 * If something breaks while rendering, show a calm recovery screen instead
 * of a blank page — with a way to rescue the data first.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, note: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  private save = async () => {
    const text = await storedBackup();
    if (!text) return this.setState({ note: "Сохранённых данных не найдено." });
    const r = await saveBackupFile(text);
    this.setState({ note: r === "failed" ? "Не получилось сохранить файл — попробуйте скопировать." : r === "cancelled" ? null : "Копия сохранена." });
  };

  private copy = async () => {
    const text = await storedBackup();
    if (!text) return this.setState({ note: "Сохранённых данных не найдено." });
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ note: "Данные скопированы как текст — их можно вставить в «Настройки → Данные»." });
    } catch {
      this.setState({ note: "Не получилось скопировать." });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-canvas fixed inset-0 flex flex-col items-center justify-center px-8 text-center" style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}>
        <div className="text-title-2 font-semibold text-ink">Что-то пошло не так</div>
        <p className="mt-2 max-w-[300px] text-callout text-ink-2">Ваши данные на месте. Перезапустите приложение — а если ошибка повторяется, сначала сохраните копию.</p>
        <div className="mt-7 flex w-full max-w-[300px] flex-col gap-2.5">
          <button type="button" onClick={() => location.reload()} className="fill-accent h-[54px] rounded-[16px] text-headline font-semibold" style={{ color: "var(--accent-on)" }}>
            Перезапустить
          </button>
          <button type="button" onClick={this.save} className="tile h-[50px] rounded-[16px] text-callout font-semibold text-ink">
            Сохранить копию данных
          </button>
          <button type="button" onClick={this.copy} className="h-[44px] text-callout text-ink-2">
            Скопировать как текст
          </button>
        </div>
        {this.state.note && <p className="mt-4 max-w-[300px] text-footnote text-ink-2">{this.state.note}</p>}
        <p className="mt-8 max-w-[320px] break-words font-mono text-caption text-ink-3">{this.state.error.message}</p>
      </div>
    );
  }
}
