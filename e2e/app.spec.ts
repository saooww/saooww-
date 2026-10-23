import { expect, test, type Page } from "@playwright/test";

/** Digits of a money string, with sign: "−1 250 ₽" → -1250 */
function amountOf(text: string): number {
  const negative = /[−-]/.test(text);
  const n = Number(text.replace(/[^\d]/g, ""));
  return negative ? -n : n;
}

async function startDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть на примере" }).click();
  await expect(page.getByText("Можно потратить сегодня")).toBeVisible();
}

async function safeToSpend(page: Page): Promise<number> {
  const card = page.getByRole("button", { name: /^(Можно потратить сегодня|Сегодня сверх нормы|До конца месяца впритык)/ });
  // the figure counts up — wait until it settles
  let prev = "";
  for (let i = 0; i < 20; i++) {
    const t = (await card.getAttribute("aria-label")) ?? "";
    if (t === prev && t) break;
    prev = t;
    await page.waitForTimeout(150);
  }
  return amountOf(prev.split(":")[1] ?? "");
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
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  await page.keyboard.type("1000");
  await page.getByRole("dialog").locator('button[aria-pressed="false"]', { hasText: /^Продукты$/ }).click();
  await page.getByRole("button", { name: "Добавить расход" }).click();
  await expect(page.getByText("Расход добавлен")).toBeVisible();
  await expect.poll(() => safeToSpend(page)).toBe(before - 1000);
});

test("перевод между своими кошельками не меняет общий баланс", async ({ page }) => {
  await startDemo(page);
  await expect(carousel(page)).toContainText("2 480 000");
  await page.getByRole("button", { name: "Перемещение", exact: true }).click();
  await page.keyboard.type("5000");
  await page.getByRole("button", { name: "Перевести" }).click();
  await expect(page.getByText("Перевод выполнен")).toBeVisible();
  await expect(carousel(page)).toContainText("2 480 000");
});

test("чек делится на категории", async ({ page }) => {
  await startDemo(page);
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  await page.keyboard.type("3450");
  await page.getByRole("dialog").locator('button[aria-pressed="false"]', { hasText: /^Продукты$/ }).click();
  await page.getByRole("button", { name: "Разделить" }).click();
  await page.getByRole("dialog").getByText("Категория", { exact: true }).click();
  await page.getByRole("dialog").last().getByText("Дом и ЖКХ", { exact: true }).click();
  await page.getByLabel("Сумма части 1").fill("450");
  await expect(page.getByRole("dialog", { name: "Новая операция" })).toContainText("Остаток — Продукты");
  await page.getByRole("button", { name: "Готово" }).click();
  await page.getByRole("button", { name: "Добавить расход" }).click();

  await page.getByRole("tab", { name: "Операции" }).click();
  const today = page.locator("section").filter({ hasText: "Сегодня" }).first();
  await expect(today).toContainText("3 000");
  await expect(today).toContainText("450");
});

test("код-пароль закрывает приложение после перезапуска", async ({ page }) => {
  await startDemo(page);
  await page.getByRole("tab", { name: "Ещё" }).click();
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
  await page.getByRole("tab", { name: "Аналитика" }).click();
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
  await page.getByRole("button", { name: "Расход", exact: true }).click();
  await page.keyboard.type("777");
  await page.getByRole("dialog").locator('button[aria-pressed="false"]', { hasText: /^Продукты$/ }).click();
  await page.getByRole("button", { name: "Фото чека" }).click();
  // a tiny red PNG stands in for the camera
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "Открыть фото чека" })).toHaveCount(1);
  await page.getByRole("button", { name: "Назад" }).click();
  await page.getByRole("button", { name: "Добавить расход" }).click();

  await page.getByRole("tab", { name: "Операции" }).click();
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
  await page.getByRole("tab", { name: "Ещё" }).click();
  await page.getByText("Настройки", { exact: true }).click();
  await page.getByText("Курсы валют", { exact: true }).click();
  await expect(page.getByText(/Официальные курсы ЦБ РФ на/)).toBeVisible();
});
