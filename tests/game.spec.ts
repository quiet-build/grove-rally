import { test, expect } from "@playwright/test";

test("375px portrait keeps the active controls in the first viewport", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Touch viewport check");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open the gate" }).click();
  const bounds = await page.getByRole("button", { name: "Steer right" }).boundingBox();
  expect(bounds!.y + bounds!.height + await page.evaluate(() => scrollY)).toBeLessThanOrEqual(812);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});

test("orchard controls, pause and restart work on keyboard and touch", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open the gate" })).toBeVisible();
  await page.getByRole("button", { name: "Open the gate" }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Accelerate" }).tap();
  else await page.keyboard.press("ArrowUp");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A little orchard break." })).toBeVisible();
  await page.getByRole("button", { name: "Resume rally" }).click();
  await page.getByRole("button", { name: "Sound off" }).click();
  await expect(page.getByRole("button", { name: "Sound on" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Restart rally" }).click();
  await expect(page.getByTestId("score")).toHaveText("0.0");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("button", { name: "Resume rally" })).toBeVisible();
  expect(errors).toEqual([]);
});
