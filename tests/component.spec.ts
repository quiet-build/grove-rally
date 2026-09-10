import { test, expect } from "@playwright/test";

test("embedded mount leaves the main landmark to the host, standalone retains one", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => (window as any).ready.length)).toBe(1);
  await expect(page.locator("pma-grove-rally").locator("main, [role=main]")).toHaveCount(0);
  await page.goto("http://127.0.0.1:5303/");
  await expect(page.locator("main")).toHaveCount(1);
});
const tag = "pma-grove-rally";
const start = "Open the gate", resume = "Resume rally", restart = "Restart rally";
test("cross-origin component initializes its scene", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect.poll(() => page.evaluate(tag => Boolean(customElements.get(tag)), tag)).toBe(true);
  await expect(page.locator(tag + " canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).ready)).toEqual([{ gameId: tag.slice(4) }]);
  expect(await page.evaluate(() => (window as any).failures)).toEqual([]);
  expect(errors).toEqual([]);
});
test("play, pause, restart and host controls stay independent through reconnects", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const game = page.locator(tag);
  await expect.poll(() => page.evaluate(() => (window as any).ready.length)).toBe(1);
  await game.getByRole("button", { name: start, exact: true }).click();
  await expect(game.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await page.getByLabel("Host text").click();
  await page.getByLabel("Host text").pressSequentially("a d p w s ");
  await expect(game.getByRole("button", { name: resume, exact: true })).toBeVisible();
  await expect(page.getByLabel("Host text")).toHaveValue("a d p w s ");
  await game.getByRole("button", { name: resume, exact: true }).click();
  await game.getByRole("button", { name: "Pause", exact: true }).click();
  await game.getByRole("button", { name: restart, exact: true }).click();
  await expect(game.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await page.evaluate(tag => {
    const el = document.querySelector(tag)!;
    el.remove();
    (window as any).removedGame = el;
  }, tag);
  await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector("#player")!.append((window as any).removedGame));
  await expect.poll(() => page.evaluate(() => (window as any).ready.length)).toBe(2);
  expect(errors).toEqual([]);
});
