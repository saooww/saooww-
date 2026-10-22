import { useRef, useState } from "react";
import { Archive, Calendar, ClipboardPaste, Coins, Copy, Database, Download, EyeOff, Hash, HardDriveDownload, Info, Moon, Palette, RotateCcw, Shapes, Sparkles, Trash2, Upload, Vibrate, WalletCards } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatDateTime, nowISO, pluralN } from "../../lib/dates";
import { haptic } from "../../lib/haptics";
import { CURRENCIES, currencySymbol } from "../../lib/money";
import { useData, exportJSON, parseImport, listBackups, autoBackup, freshData, clearBackups } from "../../store/store";
import { V1_KEY } from "../../store/migrate";
import type { AppData } from "../../store/types";
import { nav, useUI } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { NamedIcon } from "../../ui/icons";
import { Avatar, FormRow, Group, Row, Segmented, Toggle, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";

export function SettingsScreen() {
  const s = useData((st) => st.settings);
  const wallets = useData((st) => st.wallets);
  const update = useData((st) => st.updateSettings);

  return (
    <Screen title="Настройки" large>
      <div className="flex flex-col gap-5">
        <Group>
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar name={s.name || "Я"} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-caption text-ink-2">Как к вам обращаться</div>
              <input value={s.name} onChange={(e) => update({ name: e.target.value })} placeholder="Ваше имя" maxLength={30} className={cn(inputCls, "text-headline font-semibold")} />
            </div>
          </div>
        </Group>

        <Group header="Деньги">
          <FormRow label={<span className="flex items-center gap-3"><Coins size={18} className="text-ink-2" />Основная валюта</span>}>
            <select
              value={s.baseCurrency}
              onChange={(e) => {
                const next = e.target.value;
                // keep existing rates meaningful only when switching away from RUB is explicit
                update({ baseCurrency: next, rates: {} });
                nav.toast(`Основная валюта — ${next}. Задайте курсы для остальных валют.`);
              }}
              className={cn(inputCls, "appearance-none text-right")}
              dir="rtl"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {`\u200e${c.code} · ${c.symbol}\u200e`}
                </option>
              ))}
            </select>
          </FormRow>
          <Row icon={Hash} title="Курсы валют" value={Object.keys(s.rates).length ? `${Object.keys(s.rates).length}` : "не заданы"} chevron onClick={() => nav.push("currencies")} />
          <Row icon={Shapes} title="Категории" chevron onClick={() => nav.push("categories")} />
          <Row icon={WalletCards} title="Кошельки" value={String(wallets.filter((w) => !w.archived).length)} chevron onClick={() => nav.tab("wallets")} />
        </Group>

        <Group header="Оформление">
          <div className="flex items-center gap-3 px-4 py-3">
            <Moon size={18} className="shrink-0 text-ink-2" />
            <span className="text-body">Тема</span>
            <Segmented
              className="ml-auto w-[210px]"
              size="sm"
              value={s.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: "dark", label: "Тёмная" },
                { value: "light", label: "Светлая" },
                { value: "system", label: "Авто" }
              ]}
            />
          </div>
          <FormRow label={<span className="flex items-center gap-3"><Sparkles size={18} className="text-ink-2" />Анимации</span>}>
            <Toggle checked={s.animations} onChange={(v) => update({ animations: v })} label="Анимации" />
          </FormRow>
          <FormRow label={<span className="flex items-center gap-3"><Vibrate size={18} className="text-ink-2" />Тактильный отклик</span>}>
            <Toggle checked={s.haptics} onChange={(v) => update({ haptics: v })} label="Тактильный отклик" />
          </FormRow>
        </Group>

        <Group header="Форматы" footer={`Пример: ${s.numberFormat === "ru" ? "1 234 567,89" : "1,234,567.89"} ${currencySymbol(s.baseCurrency)} · ${s.dateStyle === "short" ? "21 окт" : "21.10.2026"}`}>
          <div className="flex items-center gap-3 px-4 py-3">
            <Calendar size={18} className="shrink-0 text-ink-2" />
            <span className="text-body">Дата</span>
            <Segmented className="ml-auto w-[190px]" size="sm" value={s.dateStyle} onChange={(dateStyle) => update({ dateStyle })} options={[{ value: "short", label: "21 окт" }, { value: "numeric", label: "21.10.26" }]} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Hash size={18} className="shrink-0 text-ink-2" />
            <span className="text-body">Числа</span>
            <Segmented className="ml-auto w-[190px]" size="sm" value={s.numberFormat} onChange={(numberFormat) => update({ numberFormat })} options={[{ value: "ru", label: "1 234,5" }, { value: "en", label: "1,234.5" }]} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Palette size={18} className="shrink-0 text-ink-2" />
            <span className="text-body">Копейки</span>
            <Segmented className="ml-auto w-[190px]" size="sm" value={s.kopecks} onChange={(kopecks) => update({ kopecks })} options={[{ value: "auto", label: "Авто" }, { value: "always", label: "Всегда" }, { value: "never", label: "Нет" }]} />
          </div>
        </Group>

        <Group header="Приватность" footer="Скрытые суммы заменяются точками на картах, в капитале и целях. Коснитесь «глаза» на карте, чтобы переключить.">
          <FormRow label={<span className="flex items-center gap-3"><EyeOff size={18} className="text-ink-2" />Скрыть суммы</span>}>
            <Toggle checked={s.hideAmounts} onChange={(v) => update({ hideAmounts: v })} label="Скрыть суммы" />
          </FormRow>
          <FormRow label="Скрывать при каждом запуске">
            <Toggle checked={s.hideOnLaunch} onChange={(v) => update({ hideOnLaunch: v })} label="Скрывать при запуске" />
          </FormRow>
        </Group>

        <Group header="Данные">
          <Row icon={Database} title="Резервные копии и данные" chevron onClick={() => nav.push("data")} />
        </Group>

        <Group footer="Капитал хранит все данные только на этом устройстве, в памяти браузера. Ничего не отправляется на серверы. Чтобы перенести данные на другое устройство, используйте экспорт и импорт.">
          <Row icon={Info} title="Версия" value="2.0" />
        </Group>
      </div>
    </Screen>
  );
}

export function CurrenciesScreen() {
  const s = useData((st) => st.settings);
  const wallets = useData((st) => st.wallets);
  const update = useData((st) => st.updateSettings);
  const used = new Set([...wallets.map((w) => w.currency), ...Object.keys(s.rates)]);
  used.delete(s.baseCurrency);
  const [extra, setExtra] = useState<string[]>([]);
  const list = [...new Set([...used, ...extra])];
  const available = CURRENCIES.filter((c) => c.code !== s.baseCurrency && !list.includes(c.code));

  return (
    <Screen title="Курсы валют" large>
      <Group footer={`Сколько ${s.baseCurrency} стоит одна единица валюты. Без курса суммы в этой валюте не попадают в общий баланс и аналитику — мы не складываем разные валюты наугад.`}>
        {list.length === 0 && <div className="px-4 py-4 text-callout text-ink-2">Все кошельки в {s.baseCurrency}. Курсы не нужны.</div>}
        {list.map((code) => (
          <FormRow key={code} label={<span className="tnum">1 {code} =</span>}>
            <input
              inputMode="decimal"
              defaultValue={s.rates[code] ? String(s.rates[code]).replace(".", ",") : ""}
              placeholder="не задан"
              onBlur={(e) => {
                const v = Number(e.target.value.replace(",", ".").replace(/\s/g, ""));
                const rates = { ...s.rates };
                if (v > 0) rates[code] = v;
                else delete rates[code];
                update({ rates });
              }}
              className={cn(inputCls, "text-right tnum")}
            />
            <span className="ml-1.5 text-ink-2">{currencySymbol(s.baseCurrency)}</span>
          </FormRow>
        ))}
      </Group>
      {available.length > 0 && (
        <div className="mt-5">
          <Group header="Добавить валюту">
            <div className="flex flex-wrap gap-2 p-3">
              {available.map((c) => (
                <button key={c.code} type="button" onClick={() => setExtra((x) => [...x, c.code])} className="h-8 rounded-full bg-surface-3 px-3 text-subhead font-medium active:opacity-60">
                  {c.code} {c.symbol}
                </button>
              ))}
            </div>
          </Group>
        </div>
      )}
    </Screen>
  );
}

export function CategoriesScreen() {
  const categories = useData((s) => s.categories);
  const transactions = useData((s) => s.transactions);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [showArchived, setShowArchived] = useState(false);
  const counts = new Map<string, number>();
  for (const t of transactions) if (t.categoryId) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
  const list = categories.filter((c) => c.kind === kind && !c.archived);
  const archived = categories.filter((c) => c.kind === kind && c.archived);

  return (
    <Screen title="Категории" large actions={<button type="button" className="h-9 px-1 text-body font-semibold text-accent-ink" onClick={() => nav.sheet("category", { kind })}>Добавить</button>}>
      <div className="px-4 pb-4">
        <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Расходы" }, { value: "income", label: "Доходы" }]} />
      </div>
      <Group>
        {list.map((c) => (
          <Row
            key={c.id}
            leading={
              <span className="relative">
                <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-surface-3">
                  <NamedIcon name={c.icon} size={15} strokeWidth={1.9} />
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface" style={{ background: c.color }} />
              </span>
            }
            title={c.name}
            value={counts.get(c.id) ? pluralN(counts.get(c.id)!, ["операция", "операции", "операций"]) : ""}
            chevron
            onClick={() => nav.sheet("category", { editId: c.id })}
          />
        ))}
      </Group>
      {archived.length > 0 && (
        <div className="mt-5">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="flex items-center gap-2 px-5 pb-2 text-footnote font-medium text-ink-2">
            <Archive size={14} /> Скрытые · {archived.length}
          </button>
          {showArchived && (
            <Group footer="Скрытые категории не предлагаются при вводе, но остаются в истории и аналитике.">
              {archived.map((c) => (
                <Row key={c.id} iconName={c.icon} title={c.name} trailing={<button type="button" className="text-subhead font-semibold text-accent-ink" onClick={() => useData.getState().updateCategory(c.id, { archived: false })}>Вернуть</button>} />
              ))}
            </Group>
          )}
        </div>
      )}
    </Screen>
  );
}

export function DataScreen() {
  const meta = useData((s) => s.meta);
  const counts = useData((s) => ({ tx: s.transactions.length, wallets: s.wallets.length }));
  const autoOn = useData((s) => s.settings.autoBackup);
  const file = useRef<HTMLInputElement>(null);
  const [backups, setBackups] = useState(listBackups());
  // Inside an embedding frame (e.g. a Claude artifact) file downloads are blocked — offer copying instead.
  const embedded = typeof window !== "undefined" && window.top !== window.self;

  const download = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kapital-${nowISO().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    haptic("success");
    nav.toast("Файл резервной копии сохранён", { tone: "positive" });
  };

  const confirmReplace = (data: AppData, from: string) =>
    nav.sheet("confirm", {
      title: `Заменить данные ${from}?`,
      message: `Там ${pluralN(data.transactions.length, ["операция", "операции", "операций"])} и ${pluralN(data.wallets.length, ["кошелёк", "кошелька", "кошельков"])}. Текущие данные будут заменены — до этого мы сохраним их резервную копию.`,
      confirmLabel: "Заменить",
      onConfirm: () => {
        autoBackup(true);
        undoable("Данные загружены", () => useData.getState().replaceAll(data));
        useUI.getState().popToRoot("more");
        setBackups(listBackups());
      }
    });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      confirmReplace(parseImport(await f.text()), "из файла");
    } catch (e) {
      nav.toast(e instanceof Error ? e.message : "Не удалось прочитать файл", { tone: "warning" });
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  // Works everywhere, including where file downloads are blocked: paste the text into a note or a chat with yourself.
  const copyText = () => {
    const text = exportJSON();
    navigator.clipboard
      .writeText(text)
      .then(() => {
        haptic("success");
        nav.toast(`Скопировано — ${Math.max(1, Math.round(text.length / 1024))} КБ текста`, { tone: "positive" });
      })
      .catch(() => nav.sheet("backupText", { text }));
  };

  const start = (kind: "demo" | "empty") =>
    nav.sheet("confirm", {
      title: kind === "empty" ? "Начать с чистого листа?" : "Загрузить демо-данные?",
      message: kind === "empty" ? "Все операции, кошельки, цели и заметки будут удалены. Категории и настройки останутся. Перед этим мы сохраним резервную копию." : "Текущие данные заменятся примером. Перед этим мы сохраним резервную копию.",
      confirmLabel: kind === "empty" ? "Очистить" : "Загрузить",
      onConfirm: () => {
        autoBackup(true);
        const settings = useData.getState().settings;
        const wasDemo = useData.getState().meta.demo;
        const fresh = freshData(kind);
        undoable(kind === "empty" ? "Данные очищены" : "Демо-данные загружены", () =>
          useData.getState().replaceAll({ ...fresh, settings: { ...fresh.settings, ...settings, defaultWalletId: fresh.settings.defaultWalletId, name: kind === "demo" ? fresh.settings.name || settings.name : wasDemo ? "" : settings.name } })
        );
        useUI.setState({ homeCardIndex: 0 });
        setBackups(listBackups());
      }
    });

  return (
    <Screen title="Данные" large>
      <div className="flex flex-col gap-5">
        <Group footer={`Сейчас: ${pluralN(counts.tx, ["операция", "операции", "операций"])}, ${pluralN(counts.wallets, ["кошелёк", "кошелька", "кошельков"])}.${meta.importedFromV1 ? " Данные перенесены из прошлой версии приложения." : ""}`}>
          {!embedded && <Row icon={Download} title="Экспорт в файл" subtitle="JSON со всеми данными" onClick={download} />}
          <Row icon={Upload} title="Импорт из файла" subtitle="Из резервной копии Капитала" onClick={() => file.current?.click()} />
          <Row icon={Copy} title="Скопировать как текст" subtitle="Если сохранить файл не получается" onClick={copyText} />
          <Row icon={ClipboardPaste} title="Вставить из текста" subtitle="Восстановить из скопированной копии" onClick={() => nav.sheet("backupText", { onImport: (data: AppData) => confirmReplace(data, "из текста") })} />
        </Group>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

        <Group header="Автокопии" footer="Раз в день приложение сохраняет копию данных на этом устройстве (до трёх последних). Это защита от ошибок — для переноса на другое устройство используйте экспорт.">
          <FormRow label={<span className="flex items-center gap-3"><HardDriveDownload size={18} className="text-ink-2" />Ежедневная копия</span>}>
            <Toggle checked={autoOn} onChange={(v) => useData.getState().updateSettings({ autoBackup: v })} label="Ежедневная копия" />
          </FormRow>
          {backups.map((b, i) => (
            <Row
              key={`${b.at}-${i}`}
              icon={RotateCcw}
              title={formatDateTime(b.at)}
              subtitle={pluralN(b.data.transactions?.length ?? 0, ["операция", "операции", "операций"])}
              onClick={() =>
                nav.sheet("confirm", {
                  title: "Восстановить эту копию?",
                  message: `Данные вернутся к состоянию на ${formatDateTime(b.at)}.`,
                  confirmLabel: "Восстановить",
                  destructive: false,
                  onConfirm: () => {
                    undoable("Копия восстановлена", () => useData.getState().replaceAll(b.data));
                  }
                })
              }
            />
          ))}
          <Row
            icon={HardDriveDownload}
            title="Сохранить копию сейчас"
            onClick={() => {
              autoBackup(true);
              setBackups(listBackups());
              nav.toast("Копия сохранена", { tone: "positive" });
            }}
          />
        </Group>

        <Group header="Начать заново">
          <Row icon={Sparkles} title="Загрузить демо-данные" onClick={() => start("demo")} />
          <Row icon={Trash2} iconTone="negative" destructive title="Очистить все данные" onClick={() => start("empty")} />
        </Group>

        <Group footer="Полное удаление стирает данные приложения и копии с этого устройства. Отменить это нельзя.">
          <Row
            icon={Trash2}
            iconTone="negative"
            destructive
            title="Стереть всё с устройства"
            onClick={() =>
              nav.sheet("confirm", {
                title: "Стереть всё безвозвратно?",
                message: "Будут удалены данные, настройки и автокопии. Если нужно — сначала сделайте экспорт.",
                confirmLabel: "Стереть всё",
                onConfirm: () => {
                  clearBackups();
                  try {
                    localStorage.removeItem(V1_KEY);
                  } catch {
                    /* ignore */
                  }
                  useData.getState().replaceAll(freshData("empty"));
                  useUI.setState({ homeCardIndex: 0 });
                  useUI.getState().popToRoot("more");
                  nav.toast("Все данные стёрты");
                }
              })
            }
          />
        </Group>
      </div>
    </Screen>
  );
}

/** Shows a backup as selectable text, or takes one pasted back in. */
export function BackupTextSheet({ text, onImport }: { text?: string; onImport?: (data: AppData) => void }) {
  const { close } = useSheet();
  const [value, setValue] = useState(text ?? "");
  const [error, setError] = useState<string | null>(null);
  const reading = !onImport;
  return (
    <Sheet
      title={reading ? "Резервная копия" : "Вставить копию"}
      left={<SheetAction onClick={close}>{reading ? "Готово" : "Отмена"}</SheetAction>}
      right={
        reading ? undefined : (
          <SheetAction
            strong
            disabled={!value.trim()}
            onClick={() => {
              try {
                const data = parseImport(value);
                close();
                onImport!(data);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Текст не похож на резервную копию");
              }
            }}
          >
            Загрузить
          </SheetAction>
        )
      }
    >
      <div className="flex flex-col gap-3 px-4">
        <p className="text-footnote text-ink-2">
          {reading ? "Выделите текст и скопируйте его — например, в заметку или в чат с собой." : "Вставьте сюда текст, который вы раньше скопировали кнопкой «Скопировать как текст»."}
        </p>
        <textarea
          id="backup-text"
          value={value}
          readOnly={reading}
          onFocus={(e) => reading && e.currentTarget.select()}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="{ &quot;app&quot;: &quot;kapital&quot;, … }"
          rows={10}
          className="w-full resize-none rounded-md bg-surface p-3 font-mono text-caption text-ink outline-none"
        />
        {error && <div className="text-footnote text-negative">{error}</div>}
      </div>
    </Sheet>
  );
}
