import { useEffect, useRef, useState } from "react";
import { ALargeSmall, Archive, Calendar, Zap, ClipboardPaste, Coins, Copy, Database, EyeOff, Landmark, RefreshCw, Share, ShieldCheck, Hash, HardDriveDownload, Info, Moon, Palette, RotateCcw, Shapes, Sparkles, Trash2, Type, Upload, Vibrate, WalletCards } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatDate, formatDateTime, pluralN } from "../../lib/dates";
import { refreshRatesIfStale } from "../../lib/rates";
import { haptic } from "../../lib/haptics";
import { CURRENCIES, currencySymbol } from "../../lib/money";
import { useData, exportJSON, parseImport, listBackups, autoBackup, freshData, wipeDevice, type BackupEntry } from "../../store/store";
import { storageStatus, type StorageStatus } from "../../store/storage";
import { isEmbedded, saveBackupFile } from "../../lib/backupFile";
import type { AppData, Settings } from "../../store/types";
import { nav, useUI } from "../../store/ui";
import { undoable } from "../../store/undo";
import { Screen } from "../../nav/Screen";
import { NamedIcon } from "../../ui/icons";
import { Avatar, FormRow, Group, IconChip, Row, Segmented, Toggle, inputCls } from "../../ui/primitives";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { NUMBER_FONTS, type NumberFont } from "../../ui/numFont";
import { SecuritySettings } from "../lock/SecuritySettings";

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
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={Coins} size={30} />Основная валюта</span>}>
            <select
              value={s.baseCurrency}
              onChange={(e) => {
                const next = e.target.value;
                // keep existing rates meaningful only when switching away from RUB is explicit
                update({ baseCurrency: next, rates: {} });
                if (useData.getState().settings.autoRates) {
                  void refreshRatesIfStale(true);
                  nav.toast(`Основная валюта — ${next}. Курсы ЦБ пересчитаются сами.`);
                } else nav.toast(`Основная валюта — ${next}. Задайте курсы для остальных валют.`);
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
            <IconChip icon={Moon} size={30} />
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
          <AccentPicker value={s.accent} onChange={(accent) => update({ accent })} />
          <NumberFontPicker value={s.numberFont} onChange={(numberFont) => update({ numberFont })} />
          <div className="flex items-center gap-3 px-4 py-3">
            <IconChip icon={ALargeSmall} size={30} />
            <span className="text-body">Текст</span>
            <Segmented
              className="ml-auto w-[214px]"
              size="sm"
              value={s.textSize}
              onChange={(textSize) => update({ textSize })}
              options={[
                { value: "m", label: "Обычный" },
                { value: "l", label: "Крупный" },
                { value: "xl", label: "Огромный" }
              ]}
            />
          </div>
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={Sparkles} size={30} />Анимации</span>}>
            <Toggle checked={s.animations} onChange={(v) => update({ animations: v })} label="Анимации" />
          </FormRow>
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={Vibrate} size={30} />Тактильный отклик</span>}>
            <Toggle checked={s.haptics} onChange={(v) => update({ haptics: v })} label="Тактильный отклик" />
          </FormRow>
        </Group>

        <Group header="Запуск" footer={s.launchAction === "expense" ? "При открытии сразу появляется ввод расхода — сумма, категория, готово. Закройте его, чтобы попасть на главную." : "Самый быстрый способ записывать траты — открывать сразу ввод расхода."}>
          <div className="flex items-center gap-3 px-4 py-3">
            <IconChip icon={Zap} size={30} />
            <span className="text-body">Открывать</span>
            <Segmented
              className="ml-auto w-[214px]"
              size="sm"
              value={s.launchAction}
              onChange={(launchAction) => update({ launchAction })}
              options={[
                { value: "home", label: "Главную" },
                { value: "expense", label: "Новый расход" }
              ]}
            />
          </div>
        </Group>

        <Group header="Форматы" footer={`Пример: ${s.numberFormat === "ru" ? "1 234 567,89" : "1,234,567.89"} ${currencySymbol(s.baseCurrency)} · ${s.dateStyle === "short" ? "21 окт" : "21.10.2026"}`}>
          <div className="flex items-center gap-3 px-4 py-3">
            <IconChip icon={Calendar} size={30} />
            <span className="text-body">Дата</span>
            <Segmented className="ml-auto w-[190px]" size="sm" value={s.dateStyle} onChange={(dateStyle) => update({ dateStyle })} options={[{ value: "short", label: "21 окт" }, { value: "numeric", label: "21.10.26" }]} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <IconChip icon={Hash} size={30} />
            <span className="text-body">Числа</span>
            <Segmented className="ml-auto w-[190px]" size="sm" value={s.numberFormat} onChange={(numberFormat) => update({ numberFormat })} options={[{ value: "ru", label: "1 234,5" }, { value: "en", label: "1,234.5" }]} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <IconChip icon={Palette} size={30} />
            <span className="text-body">Копейки</span>
            <Segmented className="ml-auto w-[190px]" size="sm" value={s.kopecks} onChange={(kopecks) => update({ kopecks })} options={[{ value: "auto", label: "Авто" }, { value: "always", label: "Всегда" }, { value: "never", label: "Нет" }]} />
          </div>
        </Group>

        <Group header="Приватность" footer="Скрытые суммы заменяются точками на картах, в капитале и целях. Коснитесь «глаза» на карте, чтобы переключить.">
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={EyeOff} size={30} />Скрыть суммы</span>}>
            <Toggle checked={s.hideAmounts} onChange={(v) => update({ hideAmounts: v })} label="Скрыть суммы" />
          </FormRow>
          <FormRow label="Скрывать при каждом запуске">
            <Toggle checked={s.hideOnLaunch} onChange={(v) => update({ hideOnLaunch: v })} label="Скрывать при запуске" />
          </FormRow>
        </Group>

        <SecuritySettings />

        <Group header="Данные">
          <Row icon={Database} title="Резервные копии и данные" chevron onClick={() => nav.push("data")} />
        </Group>

        <Group footer="Капитал хранит все данные только на этом устройстве. На сервер уходит только запрос курсов валют ЦБ — без ваших данных. Чтобы перенести данные на другое устройство, сохраните копию в Файлы и загрузите её там.">
          <Row icon={Info} title="Версия" value="2.1" />
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
  const [busy, setBusy] = useState(false);
  const list = [...new Set([...used, ...extra])];
  const available = CURRENCIES.filter((c) => c.code !== s.baseCurrency && !list.includes(c.code));

  const refresh = async () => {
    setBusy(true);
    const r = await refreshRatesIfStale(true);
    setBusy(false);
    if (r === "updated") nav.toast("Курсы обновлены", { tone: "positive" });
    else nav.toast("Не удалось загрузить курсы — проверьте интернет", { tone: "warning" });
  };

  return (
    <Screen title="Курсы валют" large>
      <div className="flex flex-col gap-5">
        <Group
          footer={
            s.autoRates
              ? s.ratesDate
                ? `Официальные курсы ЦБ РФ на ${formatDate(s.ratesDate, { year: "auto" })}. Обновляются сами раз в день, когда есть интернет.`
                : "Курсы ЦБ РФ загрузятся, когда появится интернет."
              : "Курсы задаются вручную."
          }
        >
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={Landmark} size={30} />Курсы ЦБ автоматически</span>}>
            <Toggle
              checked={s.autoRates}
              onChange={(v) => {
                update({ autoRates: v });
                if (v) void refreshRatesIfStale(true);
              }}
              label="Курсы ЦБ автоматически"
            />
          </FormRow>
          {s.autoRates && <Row icon={RefreshCw} title={busy ? "Обновляем…" : "Обновить сейчас"} onClick={busy ? undefined : refresh} />}
        </Group>

        <Group footer={`Сколько ${s.baseCurrency} стоит одна единица валюты. Без курса суммы в этой валюте не попадают в общий баланс и аналитику — мы не складываем разные валюты наугад.`}>
          {list.length === 0 && <div className="px-4 py-4 text-callout text-ink-2">Все кошельки в {s.baseCurrency}. Курсы не нужны.</div>}
          {list.map((code) => (
            <FormRow key={`${code}-${s.rates[code] ?? ""}`} label={<span className="tnum">1 {code} =</span>}>
              <input
                inputMode="decimal"
                defaultValue={s.rates[code] ? String(s.rates[code]).replace(".", ",") : ""}
                placeholder="не задан"
                readOnly={s.autoRates && !!s.rates[code]}
                onFocus={() => s.autoRates && s.rates[code] && nav.toast("Чтобы задать курс вручную, выключите курсы ЦБ")}
                onBlur={(e) => {
                  if (s.autoRates && s.rates[code]) return;
                  const v = Number(e.target.value.replace(",", ".").replace(/\s/g, ""));
                  const rates = { ...s.rates };
                  if (v > 0) rates[code] = v;
                  else delete rates[code];
                  update({ rates });
                }}
                className={cn(inputCls, "num text-right")}
              />
              <span className="ml-1.5 text-ink-2">{currencySymbol(s.baseCurrency)}</span>
            </FormRow>
          ))}
        </Group>
        {available.length > 0 && (
          <Group header="Добавить валюту">
            <div className="flex flex-wrap gap-2 p-3">
              {available.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    setExtra((x) => [...x, c.code]);
                    if (s.autoRates) {
                      update({ rates: { ...s.rates } });
                      void refreshRatesIfStale(true);
                    }
                  }}
                  className="h-8 rounded-full tile px-3 text-subhead font-medium active:opacity-60"
                >
                  {c.code} {c.symbol}
                </button>
              ))}
            </div>
          </Group>
        )}
      </div>
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
                <span className="grid h-[30px] w-[30px] place-items-center rounded-full tile">
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
  const lastExternal = useData((s) => s.settings.lastExternalBackup);
  const file = useRef<HTMLInputElement>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const embedded = isEmbedded();

  const refresh = () => {
    listBackups().then(setBackups);
    storageStatus().then(setStatus);
  };
  useEffect(refresh, []);

  const saveToFiles = async () => {
    const r = await saveBackupFile();
    if (r === "shared" || r === "downloaded") {
      haptic("success");
      nav.toast(r === "shared" ? "Копия сохранена" : "Файл резервной копии сохранён", { tone: "positive" });
    } else if (r === "failed") nav.toast("Не получилось сохранить файл — скопируйте копию как текст", { tone: "warning" });
  };

  const confirmReplace = (data: AppData, from: string) =>
    nav.sheet("confirm", {
      title: `Заменить данные ${from}?`,
      message: `Там ${pluralN(data.transactions.length, ["операция", "операции", "операций"])} и ${pluralN(data.wallets.length, ["кошелёк", "кошелька", "кошельков"])}. Текущие данные будут заменены — до этого мы сохраним их резервную копию.`,
      confirmLabel: "Заменить",
      onConfirm: async () => {
        await autoBackup(true);
        undoable("Данные загружены", () => useData.getState().replaceAll(data));
        useUI.getState().popToRoot("more");
        refresh();
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
      onConfirm: async () => {
        await autoBackup(true);
        const settings = useData.getState().settings;
        const wasDemo = useData.getState().meta.demo;
        const fresh = freshData(kind);
        undoable(kind === "empty" ? "Данные очищены" : "Демо-данные загружены", () =>
          useData.getState().replaceAll({ ...fresh, settings: { ...fresh.settings, ...settings, defaultWalletId: fresh.settings.defaultWalletId, name: kind === "demo" ? fresh.settings.name || settings.name : wasDemo ? "" : settings.name } })
        );
        useUI.setState({ homeCardIndex: 0 });
        refresh();
      }
    });

  const usedMb = status?.usage != null ? status.usage / (1024 * 1024) : null;

  return (
    <Screen title="Данные" large>
      <div className="flex flex-col gap-5">
        {!embedded && (
          <Group
            header="Копия вне телефона"
            footer="Если удалить приложение или очистить Safari, данные пропадут вместе с ним. Копия в «Файлах» (iCloud Drive) или у себя в почте — надёжная страховка. Раз в неделю приложение напомнит."
          >
            <Row
              icon={Share}
              iconTone="accent"
              title="Сохранить копию в Файлы"
              subtitle={lastExternal ? `Последняя: ${formatDateTime(lastExternal)}` : "Ещё ни разу"}
              onClick={saveToFiles}
            />
          </Group>
        )}

        <Group footer={`Сейчас: ${pluralN(counts.tx, ["операция", "операции", "операций"])}, ${pluralN(counts.wallets, ["кошелёк", "кошелька", "кошельков"])}.${meta.importedFromV1 ? " Данные перенесены из прошлой версии приложения." : ""} Фото чеков в копию не входят.`}>
          <Row icon={Upload} title="Импорт из файла" subtitle="Из резервной копии Капитала" onClick={() => file.current?.click()} />
          <Row icon={Copy} title="Скопировать как текст" subtitle="Если сохранить файл не получается" onClick={copyText} />
          <Row icon={ClipboardPaste} title="Вставить из текста" subtitle="Восстановить из скопированной копии" onClick={() => nav.sheet("backupText", { onImport: (data: AppData) => confirmReplace(data, "из текста") })} />
        </Group>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

        <Group header="Автокопии" footer="Раз в день приложение сохраняет копию данных на этом устройстве (до трёх последних). Это защита от ошибок — для переноса на другое устройство используйте копию в Файлы.">
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={HardDriveDownload} size={30} />Ежедневная копия</span>}>
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
            onClick={async () => {
              await autoBackup(true);
              refresh();
              nav.toast("Копия сохранена", { tone: "positive" });
            }}
          />
        </Group>

        {status && (status.persisted !== null || usedMb !== null) && (
          <Group
            header="Хранилище"
            footer={status.persisted === false ? "Браузер может очистить данные, если на устройстве кончится место. Установите приложение на экран «Домой» и сохраняйте копию в Файлы." : "Данные хранятся только на этом устройстве."}
          >
            {status.persisted !== null && <Row icon={ShieldCheck} title="Защита от автоочистки" value={status.persisted ? "Включена" : "Нет"} />}
            {usedMb !== null && <Row icon={Database} title="Занято" value={usedMb < 1 ? `${Math.max(1, Math.round(usedMb * 1024))} КБ` : `${usedMb.toFixed(1).replace(".", ",")} МБ`} />}
          </Group>
        )}

        <Group header="Начать заново">
          <Row icon={Sparkles} title="Загрузить демо-данные" onClick={() => start("demo")} />
          <Row icon={Trash2} iconTone="negative" destructive title="Очистить все данные" onClick={() => start("empty")} />
        </Group>

        <Group footer="Полное удаление стирает данные приложения, фото чеков и копии с этого устройства. Отменить это нельзя.">
          <Row
            icon={Trash2}
            iconTone="negative"
            destructive
            title="Стереть всё с устройства"
            onClick={() =>
              nav.sheet("confirm", {
                title: "Стереть всё безвозвратно?",
                message: "Будут удалены данные, настройки, фото чеков и автокопии. Если нужно — сначала сохраните копию в Файлы.",
                confirmLabel: "Стереть всё",
                onConfirm: async () => {
                  await wipeDevice();
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
          className="w-full resize-none panel rounded-md p-3 font-mono text-caption text-ink outline-none"
        />
        {error && <div className="text-footnote text-negative">{error}</div>}
      </div>
    </Sheet>
  );
}

/** Four typefaces for amounts, each tile showing a sample in its own face. */
function NumberFontPicker({ value, onChange }: { value: NumberFont; onChange: (v: NumberFont) => void }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <IconChip icon={Type} size={30} />
        <span className="text-body">Цифры</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Шрифт сумм">
        {NUMBER_FONTS.map((f) => {
          const on = f.id === value;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                if (!on) haptic();
                onChange(f.id);
              }}
              className={cn("flex h-[68px] flex-col items-center justify-center gap-1 rounded-[14px] transition-colors duration-200", on ? "bg-ink text-ink-inverse" : "tile text-ink")}
            >
              <span data-num={f.id} className="num-display inline-block text-[21px] leading-none" style={{ transform: `scale(${f.scale})` }}>
                1 250
              </span>
              <span className={cn("text-[11px] font-medium", on ? "opacity-70" : "text-ink-2")}>{f.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ACCENTS: Array<{ id: Settings["accent"]; label: string; color: string }> = [
  { id: "vermilion", label: "Киноварь", color: "#f4532b" },
  { id: "indigo", label: "Индиго", color: "#5b7cfa" },
  { id: "sakura", label: "Сакура", color: "#f06a8e" },
  { id: "gold", label: "Золото", color: "#d9a441" }
];

/** The app's one accent colour: buttons, highlights, the brand mark. */
function AccentPicker({ value, onChange }: { value: Settings["accent"]; onChange: (v: Settings["accent"]) => void }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <IconChip icon={Palette} size={30} />
        <span className="text-body">Акцент</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Цвет акцента">
        {ACCENTS.map((a) => {
          const on = a.id === value;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                if (!on) haptic();
                onChange(a.id);
              }}
              className="flex flex-col items-center gap-1.5 py-1"
            >
              <span
                className="h-10 w-10 rounded-full transition-[outline-color] duration-200"
                style={{
                  background: `linear-gradient(160deg, color-mix(in srgb, ${a.color} 70%, white), ${a.color} 55%, color-mix(in srgb, ${a.color} 75%, black))`,
                  boxShadow: `0 6px 16px -6px ${a.color}`,
                  outline: `2px solid ${on ? "var(--ink)" : "transparent"}`,
                  outlineOffset: 3
                }}
              />
              <span className={cn("text-[11px] font-medium", on ? "text-ink" : "text-ink-2")}>{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
