import { expect, test, type Page } from "@playwright/test";

/** Digits of a money string, with sign: "−1 250 ₽" → -1250 */
function amountOf(text: string): number {
  const negative = /[−-]/.test(text);
  const n = Number(text.replace(/[^\d]/g, ""));
  return negative ? -n : n;
}

// The card reads differently depending on how the demo day is going.
const SAFE_CARD = /^(Можно потратить сегодня|Сегодня сверх нормы|До конца месяца впритык)/;

async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть на примере" }).click();
  await expect(page.getByRole("button", { name: SAFE_CARD })).toBeVisible();
}

/** What is left for today; negative once today's spending is over the norm. */
async function safeToSpend(page: Page): Promise<number> {
  const card = page.getByRole("button", { name: SAFE_CARD });
  // the figure counts up — wait until it settles
  let prev = "";
  for (let i = 0; i < 20; i++) {
    const t = (await card.getAttribute("aria-label")) ?? "";
    if (t === prev && t) break;
    prev = t;
    await page.waitForTimeout(150);
  }
  const value = amountOf(prev.split(":")[1] ?? "");
  return prev.startsWith("Сегодня сверх нормы") ? -value : value;
}

/** «+» in the tab bar, then one of the tiles of «Создать». */
async function createNew(page: Page, what: "Расход" | "Доход" | "Перевод" | "Дело" | "Заметка" | "Цель") {
  await page.getByRole("button", { name: "Создать" }).click();
  await page.getByRole("dialog", { name: "Создать" }).getByRole("button", { name: what, exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Создать" })).toHaveCount(0);
  // the next sheet is up and listening before anything is typed
  if (what === "Расход" || what === "Доход" || what === "Перевод") await expect(page.getByRole("dialog", { name: "Новая операция" })).toBeVisible();
}

/** «Деньги» in the tab bar, then one of its three views. */
async function openMoney(page: Page, view: "Счета" | "Операции" | "Аналитика") {
  await page.getByRole("tab", { name: "Деньги" }).click();
  await page.locator('.app-canvas > [aria-hidden="false"]').getByRole("tab", { name: view }).click();
}

const carousel = (page: Page) => page.locator('[aria-roledescription="карусель"]');

const CBR = /cbr-xml-daily\.ru/;

// No real network: live exchange rates would change the demo totals.
test.beforeEach(async ({ page }) => {
  await page.route(CBR, (route) => route.abort());
});

test("первый запуск: знакомство, счета и сохранение после перезагрузки", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Начать" }).click();
  await page.getByPlaceholder("Имя (необязательно)").fill("Конор");
  await page.getByRole("button", { name: "Дальше" }).click();
  await page.getByLabel("Остаток: Карта").fill("54200");
  await page.getByLabel("Остаток: Наличные").fill("3500");
  await page.getByRole("button", { name: "Готово" }).click();

  await expect(page.getByText("Конор")).toBeVisible();
  await expect(carousel(page)).toContainText("57 700");

  await page.reload();
  await expect(page.getByRole("button", { name: "Начать" })).toHaveCount(0);
  await expect(carousel(page)).toContainText("57 700");
});

test("расход уменьшает «можно потратить сегодня» ровно на свою сумму", async ({ page }) => {
  await startDemo(page);
  const before = await safeToSpend(page);
  await createNew(page, "Расход");
  await page.keyboard.type("1000");
  await page.getByRole("dialog").locator('button[aria-pressed="false"]', { hasText: /^Продукты$/ }).click();
  await page.getByRole("button", { name: "Добавить расход" }).click();
  await expect(page.getByText("Расход добавлен")).toBeVisible();
  await expect.poll(() => safeToSpend(page)).toBe(before - 1000);
});

test("перевод между своими кошельками не меняет общий баланс", async ({ page }) => {
  await startDemo(page);
  await expect(carousel(page)).toContainText("2 480 000");
  await createNew(page, "Перевод");
  await page.keyboard.type("5000");
  await page.getByRole("button", { name: "Перевести" }).click();
  await expect(page.getByText("Перевод выполнен")).toBeVisible();
  await expect(carousel(page)).toContainText("2 480 000");
});

test("чек делится на категории", async ({ page }) => {
  await startDemo(page);
  await createNew(page, "Расход");
  await page.keyboard.type("3450");
  await page.getByRole("dialog").locator('button[aria-pressed="false"]', { hasText: /^Продукты$/ }).click();
  await page.getByRole("button", { name: "Разделить" }).click();
  await page.getByRole("dialog").getByText("Категория", { exact: true }).click();
  await page.getByRole("dialog").last().getByText("Дом и ЖКХ", { exact: true }).click();
  await page.getByLabel("Сумма части 1").fill("450");
  await expect(page.getByRole("dialog", { name: "Новая операция" })).toContainText("Остаток — Продукты");
  await page.getByRole("button", { name: "Готово" }).click();
  await page.getByRole("button", { name: "Добавить расход" }).click();

  await openMoney(page, "Операции");
  const today = page.locator("section").filter({ hasText: "Сегодня" }).first();
  await expect(today).toContainText("3 000");
  await expect(today).toContainText("450");
});

test("код-пароль закрывает приложение после перезапуска", async ({ page }) => {
  await startDemo(page);
  await page.getByRole("tab", { name: "Профиль" }).click();
  await page.getByText("Настройки", { exact: true }).click();
  await page.getByRole("switch", { name: "Код-пароль" }).click();
  await page.keyboard.type("1234");
  await page.waitForTimeout(500);
  await page.keyboard.type("1234");
  await expect(page.getByText("Код-пароль включён")).toBeVisible();

  await page.reload();
  const lock = page.getByRole("dialog", { name: "Приложение заблокировано" });
  await expect(lock).toBeVisible();
  await page.keyboard.type("1111");
  await expect(lock).toContainText("Неверный код");
  await page.waitForTimeout(600); // the dots shake and clear
  await page.keyboard.type("1234");
  await expect(lock).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Главная" })).toBeVisible();
});

test("итоги месяца открываются из аналитики", async ({ page }) => {
  await startDemo(page);
  await openMoney(page, "Аналитика");
  await page.getByRole("button", { name: "Предыдущий период" }).click();
  await page.getByRole("button", { name: /^Итоги:/ }).click();
  const story = page.getByRole("dialog", { name: /^Итоги:/ });
  await expect(story).toBeVisible();
  await expect(story).toContainText("Итоги месяца");
  await page.keyboard.press("Escape");
  await expect(story).toHaveCount(0);
});

test("фото чека сохраняется вместе с операцией", async ({ page }) => {
  await startDemo(page);
  await createNew(page, "Расход");
  await page.keyboard.type("777");
  await page.getByRole("dialog").locator('button[aria-pressed="false"]', { hasText: /^Продукты$/ }).click();
  await page.getByRole("button", { name: "Фото чека" }).click();
  // a tiny red PNG stands in for the camera
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "Открыть фото чека" })).toHaveCount(1);
  await page.getByRole("button", { name: "Назад" }).click();
  await page.getByRole("button", { name: "Добавить расход" }).click();

  await openMoney(page, "Операции");
  await page.getByRole("button", { name: /Продукты/ }).filter({ has: page.getByLabel("Есть фото чека") }).first().click();
  const sheet = page.getByRole("dialog", { name: "Операция" });
  await expect(sheet).toContainText("Фото чека");
  await expect(sheet.locator("img")).toHaveCount(1);
});

test("курсы ЦБ подтягиваются и пересчитывают общий баланс", async ({ page }) => {
  await page.unroute(CBR);
  await page.route(CBR, (route) =>
    route.fulfill({
      json: { Date: "2026-10-23T11:30:00+03:00", Valute: { USD: { CharCode: "USD", Nominal: 1, Value: 100 }, EUR: { CharCode: "EUR", Nominal: 1, Value: 110 } } }
    })
  );
  await startDemo(page);
  // Demo: 2 480 000 ₽ with the dollar at 95; 2 400 $ at 100 adds 12 000 ₽.
  await expect(carousel(page)).toContainText("2 492 000");
  await page.getByRole("tab", { name: "Профиль" }).click();
  await page.getByText("Настройки", { exact: true }).click();
  await page.getByText("Курсы валют", { exact: true }).click();
  await expect(page.getByText(/Официальные курсы ЦБ РФ на/)).toBeVisible();
});

/* ---------------- planner ---------------- */

async function openPlanner(page: Page) {
  await page.getByRole("tab", { name: "Дела" }).click();
  // the first visit explains the method
  await page.getByRole("button", { name: "Начать" }).click();
  await expect(page.getByRole("dialog", { name: "Как вести дела" })).toHaveCount(0);
}

test("дело одной строкой: дата, время и список распознаются и сохраняются", async ({ page }) => {
  await startDemo(page);
  await openPlanner(page);
  await page.getByRole("button", { name: "Новое дело" }).click();
  const sheet = page.getByRole("dialog", { name: "Новое дело" });
  await page.keyboard.type("Позвонить в банк завтра в 10:30 #работа");
  await expect(sheet).toContainText("Завтра");
  await expect(sheet).toContainText("10:30");
  await expect(sheet).toContainText("Работа");
  await expect(sheet).toContainText("«Позвонить в банк»");
  await page.keyboard.press("Enter");
  await expect(sheet).toContainText("Добавлено");
  await sheet.getByRole("button", { name: "Готово" }).click();

  await page.reload();
  await page.getByRole("tab", { name: "Дела" }).click();
  await page.getByRole("tab", { name: "Списки" }).click();
  await page.getByRole("button", { name: /^Скоро/ }).click();
  const row = page.getByRole("button", { name: /Позвонить в банк/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("10:30");
  await expect(row).toContainText("Работа");
});

test("главное дня: отметка двигает прогресс на главной", async ({ page }) => {
  await startDemo(page);
  await expect(page.getByText("Сделано 1 из 5")).toBeVisible();
  await openPlanner(page);
  await page.getByRole("checkbox", { name: "Сделано: Позвонить маме" }).click();
  await expect(page.getByRole("checkbox", { name: "Вернуть: Позвонить маме" })).toBeVisible();
  await page.getByRole("tab", { name: "Главная" }).click();
  await expect(page.getByText("Сделано 2 из 5")).toBeVisible();
});

test("план на день: дело из входящих попадает на сегодня", async ({ page }) => {
  await startDemo(page);
  await openPlanner(page);
  await page.getByRole("button", { name: /Во входящих/ }).click();
  const sheet = page.getByRole("dialog", { name: "План на день" });
  await expect(sheet).toContainText("Входящие");
  await sheet.locator(".panel", { hasText: "Посмотреть курс по Python" }).getByRole("button", { name: "Сегодня" }).click();
  await sheet.getByRole("button", { name: "Дальше" }).click();
  await expect(sheet).toContainText("Главное на сегодня");
  await sheet.getByRole("button", { name: "Готово" }).click();
  await expect(sheet).toContainText("План на день готов");
  await sheet.getByRole("button", { name: "Начать день" }).click();
  await expect(page.getByRole("button", { name: /Посмотреть курс по Python/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Во входящих 1 дело/ })).toBeVisible();
});

test("пункты заметки превращаются в дела", async ({ page }) => {
  await startDemo(page);
  await openPlanner(page);
  await page.getByRole("tab", { name: "Заметки" }).click();
  await page.getByRole("button", { name: /Покупки к выходным/ }).click();
  await page.getByRole("button", { name: "Сделать делами: 3" }).click();
  await page.getByRole("dialog", { name: "Куда добавить дела" }).getByText("Дом", { exact: true }).click();
  await expect(page.getByText("3 дела созданы")).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();
  await page.getByRole("tab", { name: "Списки" }).click();
  await page.getByRole("button", { name: /^Дом/ }).click();
  await expect(page.getByRole("button", { name: /Корм для кота/ })).toBeVisible();
});

test("калькулятор в сумме: 1200 + 350 записывается как 1 550", async ({ page }) => {
  await startDemo(page);
  await createNew(page, "Расход");
  await page.keyboard.type("1200+350");
  const sheet = page.getByRole("dialog", { name: "Новая операция" });
  await expect(sheet).toContainText("1 200 + 350 =");
  await sheet.locator('button[aria-pressed="false"]', { hasText: /^Продукты$/ }).click();
  await expect(sheet.getByRole("button", { name: /Добавить расход/ })).toContainText("1 550");
  await sheet.getByRole("button", { name: /Добавить расход/ }).click();
  await expect(page.getByText("Расход добавлен")).toBeVisible();
  await openMoney(page, "Операции");
  await expect(page.locator("section").filter({ hasText: "Сегодня" }).first()).toContainText("1 550");
});

/* ---------------- speed without losing data ---------------- */

test("изменения подряд и сразу перезапуск: ничего не теряется", async ({ page }) => {
  await startDemo(page);
  await page.getByRole("tab", { name: "Дела" }).click();
  await page.getByRole("button", { name: "Начать" }).click();
  // two changes well within the saving interval, then an immediate reload
  await page.getByRole("checkbox", { name: "Сделано: Позвонить маме" }).click();
  await page.getByRole("checkbox", { name: "Сделано: Записаться к стоматологу" }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Дела" }).click();
  await expect(page.getByRole("checkbox", { name: "Вернуть: Позвонить маме" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Вернуть: Записаться к стоматологу" })).toBeVisible();
});

test("скрытый экран догоняет изменения, сделанные на другой вкладке", async ({ page }) => {
  await startDemo(page);
  // the tab on view is the one layer not hidden from assistive tech
  const onView = page.locator('.app-canvas > [aria-hidden="false"]');
  await openMoney(page, "Операции");
  await expect(onView).toContainText("Всё время");
  await expect(onView).not.toContainText("4 321");
  // the list stays alive but out of sight while a new expense is added on the home tab
  await page.getByRole("tab", { name: "Главная" }).click();
  await createNew(page, "Расход");
  await page.keyboard.type("4321");
  await page.getByRole("dialog").locator('button[aria-pressed="false"]', { hasText: /^Продукты$/ }).click();
  await page.getByRole("button", { name: /Добавить расход/ }).click();
  await expect(page.getByText("Расход добавлен")).toBeVisible();
  await openMoney(page, "Операции");
  await expect(onView).toContainText("4 321");
});

/* ---------------- home layout ---------------- */

test("скрытый блок главной остаётся скрытым после перезапуска", async ({ page }) => {
  await startDemo(page);
  const onView = page.locator('.app-canvas > [aria-hidden="false"]');
  await expect(onView.getByText("Последние операции")).toBeVisible();
  await onView.getByRole("button", { name: "Настроить главную" }).click();
  await page.getByRole("dialog").getByRole("switch", { name: "Последние операции" }).click();
  await page.keyboard.press("Escape");
  await expect(onView.getByText("Последние операции")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: SAFE_CARD })).toBeVisible();
  await expect(onView.getByText("Последние операции")).toHaveCount(0);
});

test("двойное нажатие открывает одно окно, а не два", async ({ page }) => {
  await startDemo(page);
  await page.getByRole("button", { name: "Создать" }).dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

/* ---------------- small phones and large text ---------------- */

test.describe("маленький экран", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("огромный шрифт: подписи в переключателях не обрезаются", async ({ page }) => {
    await startDemo(page);
    const onView = page.locator('.app-canvas > [aria-hidden="false"]');
    // labels that don't fit their button: cut short, spilling out, wrapped, or off the screen
    const cutLabels = () =>
      onView.locator('[role="tablist"] button').evaluateAll((buttons) =>
        buttons
          .filter((b) => {
            const box = b.getBoundingClientRect();
            if (!box.width) return false;
            const range = document.createRange();
            range.selectNodeContents(b);
            const text = range.getBoundingClientRect();
            return text.left < box.left - 0.5 || text.right > box.right + 0.5 || text.height > box.height + 0.5 || box.right > window.innerWidth + 0.5;
          })
          .map((b) => b.textContent)
      );
    await page.getByRole("tab", { name: "Профиль" }).click();
    await onView.getByText("Настройки", { exact: true }).click();
    await onView.getByRole("tab", { name: "Огромный" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-text", "xl");
    await expect.poll(cutLabels).toEqual([]);
    await openMoney(page, "Аналитика");
    await expect.poll(cutLabels).toEqual([]);
    await onView.getByRole("tab", { name: "Тренды" }).click();
    await expect(onView.getByRole("tab", { name: "Накопления" })).toBeVisible();
    await expect.poll(cutLabels).toEqual([]);
  });
});

test("язык: выбор на первом экране переводит приложение и запоминается", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Язык" }).click();
  await page.getByRole("radiogroup", { name: "Язык" }).getByRole("radio", { name: "English" }).click();
  // the app restarts in English, with dollars offered first
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("button", { name: "USD", exact: false }).first()).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "See an example" })).toBeVisible();
  await page.getByRole("button", { name: "See an example" }).click();
  await expect(page.getByRole("tab", { name: "Money" })).toBeVisible();
  // and back to Russian from the settings
  await page.getByRole("tab", { name: "Profile" }).click();
  await page.locator('.app-canvas > [aria-hidden="false"]').getByRole("button", { name: /^Settings|Alex/ }).first().click();
  await page.getByRole("button", { name: /Language/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Русский/ }).click();
  await expect(page.getByRole("tab", { name: "Деньги" })).toBeVisible();
});
