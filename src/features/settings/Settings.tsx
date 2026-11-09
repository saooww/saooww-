import { useEffect, useRef, useState } from "react";
import { ALargeSmall, Archive, Calendar, Zap, ClipboardPaste, Coins, Copy, Database, EyeOff, Landmark, RefreshCw, Share, ShieldCheck, Hash, HardDriveDownload, Info, Moon, Palette, RotateCcw, Shapes, Sparkles, Trash2, Type, Upload, Vibrate, WalletCards } from "../../ui/glyphs";
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
import { Avatar, FormRow, Group, IconChip, Row, Segmented, SwitchRow, Toggle, inputCls } from "../../ui/primitives";
import { FullLogo } from "../../ui/Brand";
import { Sheet, SheetAction, useSheet } from "../../ui/Sheet";
import { NUMBER_FONTS, type NumberFont } from "../../ui/numFont";
import { PALETTES, paletteOf, type PaletteId } from "../../ui/palettes";
import { SecuritySettings } from "../lock/SecuritySettings";
import { tr } from "../../i18n/i18n";

export function SettingsScreen() {
  const s = useData((st) => st.settings);
  const wallets = useData((st) => st.wallets);
  const update = useData((st) => st.updateSettings);

  return (
    <Screen title={tr("Настройки")} large>
      <div className="flex flex-col gap-5">
        <Group>
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar name={s.name || tr("Я")} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-caption text-ink-2">{tr("Как к вам обращаться")}</div>
              <input value={s.name} onChange={(e) => update({ name: e.target.value })} placeholder={tr("Ваше имя")} maxLength={30} className={cn(inputCls, "text-headline font-semibold")} />
            </div>
          </div>
        </Group>

        <Group header={tr("Деньги")}>
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={Coins} size={30} />{tr("Основная валюта")}</span>}>
            <select
              value={s.baseCurrency}
              onChange={(e) => {
                const next = e.target.value;
                // keep existing rates meaningful only when switching away from RUB is explicit
                update({ baseCurrency: next, rates: {} });
                if (useData.getState().settings.autoRates) {
                  void refreshRatesIfStale(true);
                  nav.toast(tr("Основная валюта — {0}. Курсы ЦБ пересчитаются сами.", next));
                } else nav.toast(tr("Основная валюта — {0}. Задайте курсы для остальных валют.", next));
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
          <Row icon={Hash} title={tr("Курсы валют")} value={Object.keys(s.rates).length ? `${Object.keys(s.rates).length}` : tr("не заданы")} chevron onClick={() => nav.push("currencies")} />
          <Row icon={Shapes} title={tr("Категории")} chevron onClick={() => nav.push("categories")} />
          <Row icon={WalletCards} title={tr("Кошельки")} value={String(wallets.filter((w) => !w.archived).length)} chevron onClick={() => nav.tab("wallets")} />
        </Group>

        <Group header={tr("Оформление")}>
          <ThemeGallery value={paletteOf(s.palette).id} onChange={(palette) => update({ palette, accent: palette === "ardessa" ? "ardessa" : "theme" })} />
          {!paletteOf(s.palette).mode && (
            <SwitchRow
              icon={Moon}
              label={tr("Режим")}
              value={s.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: "dark", label: tr("Тёмный") },
                { value: "light", label: tr("Светлый") },
                { value: "system", label: tr("Авто") }
              ]}
            />
          )}
          <AccentPicker value={s.accent} custom={s.customAccent} themeAccent={paletteOf(s.palette).accent} onChange={(accent, customAccent) => update(customAccent ? { accent, customAccent } : { accent })} />
          <NumberFontPicker value={s.numberFont} onChange={(numberFont) => update({ numberFont })} />
          <SwitchRow
            icon={ALargeSmall}
            label={tr("Текст")}
            width="lg"
            value={s.textSize}
            onChange={(textSize) => update({ textSize })}
            options={[
              { value: "m", label: tr("Обычный") },
              { value: "l", label: tr("Крупный") },
              { value: "xl", label: tr("Огромный") }
            ]}
          />
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={Sparkles} size={30} />{tr("Анимации")}</span>}>
            <Toggle checked={s.animations} onChange={(v) => update({ animations: v })} label={tr("Анимации")} />
          </FormRow>
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={Vibrate} size={30} />{tr("Тактильный отклик")}</span>}>
            <Toggle checked={s.haptics} onChange={(v) => update({ haptics: v })} label={tr("Тактильный отклик")} />
          </FormRow>
        </Group>

        <Group header={tr("Запуск")} footer={s.launchAction === "expense" ? tr("При открытии сразу появляется ввод расхода — сумма, категория, готово. Закройте его, чтобы попасть на главную.") : tr("Самый быстрый способ записывать траты — открывать сразу ввод расхода.")}>
          <SwitchRow
            icon={Zap}
            label={tr("Открывать")}
            value={s.launchAction}
            onChange={(launchAction) => update({ launchAction })}
            options={[
              { value: "home", label: tr("Главную") },
              { value: "expense", label: tr("Новый расход") }
            ]}
          />
        </Group>

        <Group header={tr("Форматы")} footer={tr("Пример: {0} {1} · {2}", s.numberFormat === "ru" ? "1 234 567,89" : "1,234,567.89", currencySymbol(s.baseCurrency), s.dateStyle === "short" ? "21 окт" : "21.10.2026")}>
          <SwitchRow icon={Calendar} label={tr("Дата")} width="sm" value={s.dateStyle} onChange={(dateStyle) => update({ dateStyle })} options={[{ value: "short", label: tr("21 окт") }, { value: "numeric", label: "21.10.26" }]} />
          <SwitchRow icon={Hash} label={tr("Числа")} width="sm" value={s.numberFormat} onChange={(numberFormat) => update({ numberFormat })} options={[{ value: "ru", label: "1 234,5" }, { value: "en", label: "1,234.5" }]} />
          <SwitchRow icon={Palette} label={tr("Копейки")} width="sm" value={s.kopecks} onChange={(kopecks) => update({ kopecks })} options={[{ value: "auto", label: tr("Авто") }, { value: "always", label: tr("Всегда") }, { value: "never", label: tr("Нет") }]} />
        </Group>

        <Group header={tr("Приватность")} footer={tr("Скрытые суммы заменяются точками на картах, в капитале и целях. Коснитесь «глаза» на карте, чтобы переключить.")}>
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={EyeOff} size={30} />{tr("Скрыть суммы")}</span>}>
            <Toggle checked={s.hideAmounts} onChange={(v) => update({ hideAmounts: v })} label={tr("Скрыть суммы")} />
          </FormRow>
          <FormRow label={tr("Скрывать при каждом запуске")}>
            <Toggle checked={s.hideOnLaunch} onChange={(v) => update({ hideOnLaunch: v })} label={tr("Скрывать при запуске")} />
          </FormRow>
        </Group>

        <SecuritySettings />

        <Group header={tr("Данные")}>
          <Row icon={Database} title={tr("Резервные копии и данные")} chevron onClick={() => nav.push("data")} />
        </Group>

        <Group footer={tr("Ardessa хранит все данные только на этом устройстве. На сервер уходит только запрос курсов валют ЦБ — без ваших данных. Чтобы перенести данные на другое устройство, сохраните копию в Файлы и загрузите её там.")}>
          <Row icon={Info} title={tr("Версия")} value={__APP_VERSION__} />
        </Group>

        <div className="flex justify-center pb-2 pt-4 opacity-90">
          <FullLogo size={17} />
        </div>
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
    if (r === "updated") nav.toast(tr("Курсы обновлены"), { tone: "positive" });
    else nav.toast(tr("Не удалось загрузить курсы — проверьте интернет"), { tone: "warning" });
  };

  return (
    <Screen title={tr("Курсы валют")} large>
      <div className="flex flex-col gap-5">
        <Group
          footer={
            s.autoRates
              ? s.ratesDate
                ? tr("Официальные курсы ЦБ РФ на {0}. Обновляются сами раз в день, когда есть интернет.", formatDate(s.ratesDate, { year: "auto" }))
                : tr("Курсы ЦБ РФ загрузятся, когда появится интернет.")
              : tr("Курсы задаются вручную.")
          }
        >
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={Landmark} size={30} />{tr("Курсы ЦБ автоматически")}</span>}>
            <Toggle
              checked={s.autoRates}
              onChange={(v) => {
                update({ autoRates: v });
                if (v) void refreshRatesIfStale(true);
              }}
              label={tr("Курсы ЦБ автоматически")}
            />
          </FormRow>
          {s.autoRates && <Row icon={RefreshCw} title={busy ? tr("Обновляем…") : tr("Обновить сейчас")} onClick={busy ? undefined : refresh} />}
        </Group>

        <Group footer={tr("Сколько {0} стоит одна единица валюты. Без курса суммы в этой валюте не попадают в общий баланс и аналитику — мы не складываем разные валюты наугад.", s.baseCurrency)}>
          {list.length === 0 && <div className="px-4 py-4 text-callout text-ink-2">{tr("Все кошельки в")}{" "}{s.baseCurrency}{tr(". Курсы не нужны.")}</div>}
          {list.map((code) => (
            <FormRow key={`${code}-${s.rates[code] ?? ""}`} label={<span className="tnum">1 {code} =</span>}>
              <input
                inputMode="decimal"
                defaultValue={s.rates[code] ? String(s.rates[code]).replace(".", ",") : ""}
                placeholder={tr("не задан")}
                readOnly={s.autoRates && !!s.rates[code]}
                onFocus={() => s.autoRates && s.rates[code] && nav.toast(tr("Чтобы задать курс вручную, выключите курсы ЦБ"))}
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
          <Group header={tr("Добавить валюту")}>
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
    <Screen title={tr("Категории")} large actions={<button type="button" className="h-9 px-1 text-body font-semibold text-accent-ink" onClick={() => nav.sheet("category", { kind })}>{tr("Добавить")}</button>}>
      <div className="px-4 pb-4">
        <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: tr("Расходы") }, { value: "income", label: tr("Доходы") }]} />
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
            <Archive size={14} />{tr("Скрытые ·")}{" "}{archived.length}
          </button>
          {showArchived && (
            <Group footer={tr("Скрытые категории не предлагаются при вводе, но остаются в истории и аналитике.")}>
              {archived.map((c) => (
                <Row key={c.id} iconName={c.icon} title={c.name} trailing={<button type="button" className="text-subhead font-semibold text-accent-ink" onClick={() => useData.getState().updateCategory(c.id, { archived: false })}>{tr("Вернуть")}</button>} />
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
      nav.toast(r === "shared" ? tr("Копия сохранена") : tr("Файл резервной копии сохранён"), { tone: "positive" });
    } else if (r === "failed") nav.toast(tr("Не получилось сохранить файл — скопируйте копию как текст"), { tone: "warning" });
  };

  const confirmReplace = (data: AppData, from: string) =>
    nav.sheet("confirm", {
      title: tr("Заменить данные {0}?", from),
      message: tr("Там {0} и {1}. Текущие данные будут заменены — до этого мы сохраним их резервную копию.", pluralN(data.transactions.length, ["операция", "операции", "операций"]), pluralN(data.wallets.length, ["кошелёк", "кошелька", "кошельков"])),
      confirmLabel: tr("Заменить"),
      onConfirm: async () => {
        await autoBackup(true);
        undoable(tr("Данные загружены"), () => useData.getState().replaceAll(data));
        useUI.getState().popToRoot("more");
        refresh();
      }
    });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      confirmReplace(parseImport(await f.text()), tr("из файла"));
    } catch (e) {
      nav.toast(e instanceof Error ? e.message : tr("Не удалось прочитать файл"), { tone: "warning" });
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
        nav.toast(tr("Скопировано — {0} КБ текста", Math.max(1, Math.round(text.length / 1024))), { tone: "positive" });
      })
      .catch(() => nav.sheet("backupText", { text }));
  };

  const start = (kind: "demo" | "empty") =>
    nav.sheet("confirm", {
      title: kind === "empty" ? tr("Начать с чистого листа?") : tr("Загрузить демо-данные?"),
      message: kind === "empty" ? tr("Все операции, кошельки, цели и заметки будут удалены. Категории и настройки останутся. Перед этим мы сохраним резервную копию.") : tr("Текущие данные заменятся примером. Перед этим мы сохраним резервную копию."),
      confirmLabel: kind === "empty" ? tr("Очистить") : tr("Загрузить"),
      onConfirm: async () => {
        await autoBackup(true);
        const settings = useData.getState().settings;
        const wasDemo = useData.getState().meta.demo;
        const fresh = freshData(kind);
        undoable(kind === "empty" ? tr("Данные очищены") : tr("Демо-данные загружены"), () =>
          useData.getState().replaceAll({ ...fresh, settings: { ...fresh.settings, ...settings, defaultWalletId: fresh.settings.defaultWalletId, name: kind === "demo" ? fresh.settings.name || settings.name : wasDemo ? "" : settings.name } })
        );
        useUI.setState({ homeCardIndex: 0 });
        refresh();
      }
    });

  const usedMb = status?.usage != null ? status.usage / (1024 * 1024) : null;

  return (
    <Screen title={tr("Данные")} large>
      <div className="flex flex-col gap-5">
        {!embedded && (
          <Group
            header={tr("Копия вне телефона")}
            footer={tr("Если удалить приложение или очистить Safari, данные пропадут вместе с ним. Копия в «Файлах» (iCloud Drive) или у себя в почте — надёжная страховка. Раз в неделю приложение напомнит.")}
          >
            <Row
              icon={Share}
              iconTone="accent"
              title={tr("Сохранить копию в Файлы")}
              subtitle={lastExternal ? tr("Последняя: {0}", formatDateTime(lastExternal)) : tr("Ещё ни разу")}
              onClick={saveToFiles}
            />
          </Group>
        )}

        <Group footer={tr("Сейчас: {0}, {1}.{2} Фото чеков в копию не входят.", pluralN(counts.tx, ["операция", "операции", "операций"]), pluralN(counts.wallets, ["кошелёк", "кошелька", "кошельков"]), meta.importedFromV1 ? " Данные перенесены из прошлой версии приложения." : "")}>
          <Row icon={Upload} title={tr("Импорт из файла")} subtitle={tr("Из резервной копии Ardessa или Капитала")} onClick={() => file.current?.click()} />
          <Row icon={Copy} title={tr("Скопировать как текст")} subtitle={tr("Если сохранить файл не получается")} onClick={copyText} />
          <Row icon={ClipboardPaste} title={tr("Вставить из текста")} subtitle={tr("Восстановить из скопированной копии")} onClick={() => nav.sheet("backupText", { onImport: (data: AppData) => confirmReplace(data, tr("из текста")) })} />
        </Group>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

        <Group header={tr("Автокопии")} footer={tr("Раз в день приложение сохраняет копию данных на этом устройстве (до трёх последних). Это защита от ошибок — для переноса на другое устройство используйте копию в Файлы.")}>
          <FormRow label={<span className="flex items-center gap-3"><IconChip icon={HardDriveDownload} size={30} />{tr("Ежедневная копия")}</span>}>
            <Toggle checked={autoOn} onChange={(v) => useData.getState().updateSettings({ autoBackup: v })} label={tr("Ежедневная копия")} />
          </FormRow>
          {backups.map((b, i) => (
            <Row
              key={`${b.at}-${i}`}
              icon={RotateCcw}
              title={formatDateTime(b.at)}
              subtitle={pluralN(b.data.transactions?.length ?? 0, ["операция", "операции", "операций"])}
              onClick={() =>
                nav.sheet("confirm", {
                  title: tr("Восстановить эту копию?"),
                  message: tr("Данные вернутся к состоянию на {0}.", formatDateTime(b.at)),
                  confirmLabel: tr("Восстановить"),
                  destructive: false,
                  onConfirm: () => {
                    undoable(tr("Копия восстановлена"), () => useData.getState().replaceAll(b.data));
                  }
                })
              }
            />
          ))}
          <Row
            icon={HardDriveDownload}
            title={tr("Сохранить копию сейчас")}
            onClick={async () => {
              await autoBackup(true);
              refresh();
              nav.toast(tr("Копия сохранена"), { tone: "positive" });
            }}
          />
        </Group>

        {status && (status.persisted !== null || usedMb !== null) && (
          <Group
            header={tr("Хранилище")}
            footer={status.persisted === false ? tr("Браузер может очистить данные, если на устройстве кончится место. Установите приложение на экран «Домой» и сохраняйте копию в Файлы.") : tr("Данные хранятся только на этом устройстве.")}
          >
            {status.persisted !== null && <Row icon={ShieldCheck} title={tr("Защита от автоочистки")} value={status.persisted ? tr("Включена") : tr("Нет")} />}
            {usedMb !== null && <Row icon={Database} title={tr("Занято")} value={usedMb < 1 ? tr("{0} КБ", Math.max(1, Math.round(usedMb * 1024))) : tr("{0} МБ", usedMb.toFixed(1).replace(".", ","))} />}
          </Group>
        )}

        <Group header={tr("Начать заново")}>
          <Row icon={Sparkles} title={tr("Загрузить демо-данные")} onClick={() => start("demo")} />
          <Row icon={Trash2} iconTone="negative" destructive title={tr("Очистить все данные")} onClick={() => start("empty")} />
        </Group>

        <Group footer={tr("Полное удаление стирает данные приложения, фото чеков и копии с этого устройства. Отменить это нельзя.")}>
          <Row
            icon={Trash2}
            iconTone="negative"
            destructive
            title={tr("Стереть всё с устройства")}
            onClick={() =>
              nav.sheet("confirm", {
                title: tr("Стереть всё безвозвратно?"),
                message: tr("Будут удалены данные, настройки, фото чеков и автокопии. Если нужно — сначала сохраните копию в Файлы."),
                confirmLabel: tr("Стереть всё"),
                onConfirm: async () => {
                  await wipeDevice();
                  useData.getState().replaceAll(freshData("empty"));
                  useUI.setState({ homeCardIndex: 0 });
                  useUI.getState().popToRoot("more");
                  nav.toast(tr("Все данные стёрты"));
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
      title={reading ? tr("Резервная копия") : tr("Вставить копию")}
      left={<SheetAction onClick={close}>{reading ? tr("Готово") : tr("Отмена")}</SheetAction>}
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
                setError(e instanceof Error ? e.message : tr("Текст не похож на резервную копию"));
              }
            }}
          >{tr("Загрузить")}</SheetAction>
        )
      }
    >
      <div className="flex flex-col gap-3 px-4">
        <p className="text-footnote text-ink-2">
          {reading ? tr("Выделите текст и скопируйте его — например, в заметку или в чат с собой.") : tr("Вставьте сюда текст, который вы раньше скопировали кнопкой «Скопировать как текст».")}
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
        <span className="text-body">{tr("Цифры")}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label={tr("Шрифт сумм")}>
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
  { id: "ardessa", label: "Ardessa", color: "#fa0717" },
  { id: "vermilion", label: tr("Киноварь"), color: "#f4532b" },
  { id: "indigo", label: tr("Индиго"), color: "#5b7cfa" },
  { id: "sakura", label: tr("Роза"), color: "#f06a8e" },
  { id: "gold", label: tr("Золото"), color: "#d9a441" }
];

/** Each theme as a tiny screen: its background, a card, the accent and a sphere. */
function ThemeGallery({ value, onChange }: { value: PaletteId; onChange: (v: PaletteId) => void }) {
  return (
    <div className="py-3">
      <div className="flex items-center gap-3 px-4">
        <IconChip icon={Palette} size={30} />
        <span className="text-body">{tr("Тема")}</span>
      </div>
      <div className="scroll-x mt-3 flex gap-3 px-4 pb-1" role="radiogroup" aria-label={tr("Тема оформления")}>
        {PALETTES.map((p) => {
          const on = p.id === value;
          const bg = p.bg ?? "#070708";
          const card = p.surface ?? "#111113";
          const ink = p.mode === "light" ? "#15130f" : "#f5f3f0";
          const accent = p.accent ?? "#fa0717";
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={p.name}
              onClick={() => {
                if (!on) haptic();
                onChange(p.id);
              }}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <span
                className="relative block h-[118px] w-[78px] overflow-hidden rounded-[16px] transition-[outline-color] duration-200"
                style={{ background: bg, outline: `2px solid ${on ? "var(--ink)" : "transparent"}`, outlineOffset: 2, boxShadow: "inset 0 0 0 0.5px var(--line-strong)" }}
              >
                {p.id === "ardessa" && <span className="absolute inset-y-0 right-0 w-1/2" style={{ background: "#f3f1ec" }} />}
                <span className="absolute left-1/2 top-3 h-9 w-9 -translate-x-1/2 overflow-hidden rounded-full" style={{ background: card }}>
                  <span className="absolute inset-x-0 bottom-0 h-[60%]" style={{ background: accent }} />
                </span>
                <span className="absolute inset-x-2 top-[58px] h-[18px] rounded-[6px]" style={{ background: card }} />
                <span className="absolute left-2 top-[82px] h-[5px] w-8 rounded-full" style={{ background: ink, opacity: 0.7 }} />
                <span className="absolute bottom-2 left-1/2 h-[14px] w-[14px] -translate-x-1/2 rounded-[5px]" style={{ background: accent }} />
              </span>
              <span className={cn("text-[11px] font-medium", on ? "text-ink" : "text-ink-2")}>{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The accent: the theme's own, one of the house colours, or any colour at all. */
function AccentPicker({ value, custom, themeAccent, onChange }: { value: Settings["accent"]; custom?: string; themeAccent?: string; onChange: (v: Settings["accent"], custom?: string) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const options: Array<{ id: Settings["accent"]; label: string; color: string }> = [
    ...(themeAccent ? [{ id: "theme" as const, label: tr("Из темы"), color: themeAccent }] : []),
    ...ACCENTS,
    { id: "custom", label: tr("Свой"), color: custom ?? "#8e7ce3" }
  ];
  const current = value === "theme" && !themeAccent ? "ardessa" : value;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <IconChip icon={Sparkles} size={30} />
        <span className="text-body">{tr("Акцент")}</span>
      </div>
      <div className="scroll-x -mx-1 mt-3 flex gap-1 px-1" role="radiogroup" aria-label={tr("Цвет акцента")}>
        {options.map((a) => {
          const on = a.id === current;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                if (a.id === "custom") {
                  picker.current?.click();
                  return;
                }
                if (!on) haptic();
                onChange(a.id);
              }}
              className="flex w-[62px] shrink-0 flex-col items-center gap-1.5 py-1"
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-full transition-[outline-color] duration-200"
                style={{
                  background: a.id === "custom" && !custom ? "conic-gradient(#fa0717, #f0b14e, #3cc896, #5b8cff, #e879b9, #fa0717)" : a.color,
                  outline: `2px solid ${on ? "var(--ink)" : "transparent"}`,
                  outlineOffset: 3
                }}
              >
                {a.id === "custom" && <Palette size={16} className="text-white mix-blend-difference" />}
              </span>
              <span className={cn("text-[11px] font-medium", on ? "text-ink" : "text-ink-2")}>{a.label}</span>
            </button>
          );
        })}
      </div>
      <input
        ref={picker}
        type="color"
        aria-label={tr("Свой цвет акцента")}
        value={custom ?? "#8e7ce3"}
        onChange={(e) => onChange("custom", e.target.value)}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
    </div>
  );
}
