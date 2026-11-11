import { expect, test, type Page } from "@playwright/test";

/** One fixed moment, so «today», the greeting and the month are always the same. */
const NOW = new Date("2026-11-11T14:00:00+03:00");

const onView = (page: Page) => page.locator('.app-canvas > [aria-hidden="false"]');

async function demo(page: Page, theme: "dark" | "light" = "dark") {
  await page.clock.install({ time: NOW });
  await page.route(/cbr-xml-daily\.ru/, (route) => route.abort());
  await page.addInitScript((t) => {
    localStorage.setItem("ardessa-lang", "ru");
    (window as unknown as { __visualTheme: string }).__visualTheme = t;
  }, theme);
  await page.goto("/");
  await page.getByRole("button", { name: "Посмотреть на примере" }).click();
  await page.getByRole("button", { name: /^(Можно потратить|Сегодня сверх)/ }).waitFor();
  if (theme === "light") {
    await page.getByRole("tab", { name: "Профиль" }).click();
    await onView(page).getByText("Оформление", { exact: true }).click();
    await onView(page).getByText("Светлый", { exact: true }).first().click();
    await onView(page).getByRole("button", { name: "Назад" }).click();
    await page.getByRole("tab", { name: "Главная" }).click();
  }
  await settle(page);
}

async function settle(page: Page) {
  await page.clock.runFor(2_000);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await expect(page).toHaveScreenshot(`${name}.png`);
}

test("главная", async ({ page }) => {
  await demo(page);
  await shot(page, "01-home");
});

test("главная — светлая тема", async ({ page }) => {
  await demo(page, "light");
  await shot(page, "02-home-light");
});

test("деньги: счета, операции, аналитика", async ({ page }) => {
  await demo(page);
  await page.getByRole("tab", { name: "Деньги" }).click();
  await shot(page, "03-accounts");
  await onView(page).getByRole("tab", { name: "Операции" }).click();
  await shot(page, "04-operations");
  await onView(page).getByRole("tab", { name: "Аналитика" }).click();
  await shot(page, "05-analytics");
});

test("цели и долги", async ({ page }) => {
  await demo(page);
  await page.getByRole("tab", { name: "Профиль" }).click();
  await shot(page, "06-profile");
  await onView(page).getByText("Цели", { exact: true }).first().click();
  await shot(page, "07-goals");
  await onView(page).getByRole("button", { name: /Открыть цель/ }).click();
  await shot(page, "13-goal-detail");
  await onView(page).getByRole("button", { name: "Назад" }).last().click();
  await onView(page).getByRole("button", { name: "Назад" }).last().click();
  await onView(page).getByText("Долги", { exact: true }).first().click();
  await shot(page, "08-debts");
  await onView(page).getByRole("button", { name: /^Андрей/ }).click();
  await shot(page, "09-debt-person");
});

test("создать и прогноз", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "Создать" }).click();
  await shot(page, "10-create");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Прогноз на конец месяца" }).click();
  await shot(page, "11-forecast");
  const sheet = page.getByRole("dialog", { name: "Прогноз на конец месяца" });
  await sheet.getByRole("button", { name: "90 дней" }).click();
  const box = (await sheet.getByRole("img", { name: "Капитал до конца периода" }).boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
  await shot(page, "12-forecast-90-day-picked");
});
