import { expect, test, type Page } from "@playwright/test";

/**
 * The whole first month of a new user, start to finish, then a restart:
 * every number on the way is worked out by hand from the inputs.
 *   start:     card 54 200 + cash 3 500                    = 57 700
 *   income     +100 000 to the card                        = 157 700
 *   expense    −1 000 from the card                        = 156 700
 *   transfer   5 000 card → cash (total unchanged)         = 156 700
 *   goal       10 000 set aside from the card              = 146 700 on the accounts
 *   debt       3 000 lent from the card                    = 143 700
 *   repayment  1 000 of it returned to the card            = 144 700, 2 000 still owed
 */

const onView = (page: Page) => page.locator('.app-canvas > [aria-hidden="false"]');
const carousel = (page: Page) => page.locator('[aria-roledescription="карусель"]');

async function create(page: Page, what: string) {
  await page.getByRole("button", { name: "Создать" }).click();
  await page.getByRole("dialog", { name: "Создать" }).getByRole("button", { name: what, exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Создать" })).toHaveCount(0);
}

async function keypad(page: Page, digits: string) {
  const pad = page.getByRole("group", { name: "Клавиатура суммы" }).last();
  for (const d of digits) await pad.getByRole("button", { name: d, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route(/cbr-xml-daily\.ru/, (route) => route.abort());
});

test("путь пользователя: счёт → доход → расход → перевод → цель → долг → частичный возврат → аналитика → прогноз → перезапуск", async ({ page }) => {
  test.setTimeout(120_000);
  // account
  await page.goto("/");
  await page.getByRole("button", { name: "Начать" }).click();
  await page.getByPlaceholder("Имя (необязательно)").fill("Тест");
  await page.getByRole("button", { name: "Дальше" }).click();
  await page.getByLabel("Остаток: Карта").fill("54200");
  await page.getByLabel("Остаток: Наличные").fill("3500");
  await page.getByRole("button", { name: "Готово" }).click();
  await expect(carousel(page)).toContainText("57 700");

  // income
  await create(page, "Доход");
  await page.keyboard.type("100000");
  await page.getByRole("dialog").locator('button[aria-pressed="false"]', { hasText: /^Зарплата$/ }).click();
  await page.getByRole("button", { name: /Добавить доход/ }).click();
  await expect(page.getByText("Доход добавлен")).toBeVisible();
  await expect(carousel(page)).toContainText("157 700");

  // expense
  await create(page, "Расход");
  await page.keyboard.type("1000");
  await page.getByRole("dialog").locator('button[aria-pressed="false"]', { hasText: /^Продукты$/ }).click();
  await page.getByRole("button", { name: /Добавить расход/ }).click();
  await expect(page.getByText("Расход добавлен")).toBeVisible();
  await expect(carousel(page)).toContainText("156 700");

  // transfer: the total does not move
  await create(page, "Перевод");
  await page.keyboard.type("5000");
  await page.getByRole("button", { name: "Перевести" }).click();
  await expect(page.getByText("Перевод выполнен")).toBeVisible();
  await expect(carousel(page)).toContainText("156 700");

  // goal, and money set aside for it
  await create(page, "Цель");
  const goalSheet = page.getByRole("dialog", { name: "Новая цель" });
  await goalSheet.getByPlaceholder("На что копим").fill("Отпуск");
  await goalSheet.getByPlaceholder("0").fill("200000");
  await goalSheet.getByRole("button", { name: "Готово" }).click();
  await expect(goalSheet).toHaveCount(0);
  await page.getByRole("tab", { name: "Профиль" }).click();
  await onView(page).getByText("Цели", { exact: true }).first().click();
  await onView(page).getByRole("button", { name: "Пополнить" }).first().click();
  await keypad(page, "10000");
  await page.getByRole("button", { name: "Пополнить цель" }).click();
  await expect(page.getByText("Цель пополнена")).toBeVisible();
  await expect(onView(page)).toContainText("10 000");
  await onView(page).getByRole("button", { name: "Назад" }).click();

  // debt: lent from the card
  await onView(page).getByText("Долги", { exact: true }).first().click();
  await onView(page).getByRole("button", { name: "Дал в долг" }).click();
  const debtSheet = page.getByRole("dialog", { name: "Новый долг" });
  await debtSheet.getByPlaceholder("Имя").fill("Андрей");
  await debtSheet.getByPlaceholder("0").fill("3000");
  await debtSheet.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByText("Долг записан")).toBeVisible();

  // partial repayment
  await onView(page).getByRole("button", { name: /^Андрей/ }).click();
  await onView(page).getByRole("button", { name: "Вернул часть" }).click();
  const pay = page.getByRole("dialog", { name: "Возврат долга" });
  await pay.getByRole("textbox").first().fill("1000");
  await pay.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByText("Платёж записан")).toBeVisible();
  await expect(onView(page)).toContainText("2 000");
  await expect(onView(page)).toContainText("вернули 1 000");

  // analytics: only the real expense counts — not the transfer, the goal or the loan
  await page.getByRole("tab", { name: "Деньги" }).click();
  await onView(page).getByRole("tab", { name: "Аналитика" }).click();
  await expect(onView(page).getByRole("img", { name: "Распределение по категориям" }).locator("..")).toContainText("1 000");
  await expect(onView(page)).toContainText("100 тыс");

  // forecast starts from what is on the accounts
  await page.getByRole("tab", { name: "Главная" }).click();
  await expect(carousel(page)).toContainText("144 700");
  await page.getByRole("button", { name: "Прогноз на конец месяца" }).click();
  const forecast = page.getByRole("dialog", { name: "Прогноз на конец месяца" });
  await expect(forecast.getByText("Сейчас на счетах").locator("..")).toContainText("144 700");
  await page.keyboard.press("Escape");

  // restart: everything is still there
  await page.reload();
  await expect(carousel(page)).toContainText("144 700");
  await page.getByRole("tab", { name: "Профиль" }).click();
  await onView(page).getByText("Долги", { exact: true }).first().click();
  await expect(onView(page).getByRole("button", { name: /^Андрей/ })).toContainText("2 000");
  await onView(page).getByRole("button", { name: "Назад" }).click();
  await onView(page).getByText("Цели", { exact: true }).first().click();
  await expect(onView(page)).toContainText("10 000");
});
