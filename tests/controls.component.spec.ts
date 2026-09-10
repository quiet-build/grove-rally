import { test, expect } from "@playwright/test";
test.use({ browserName: "webkit", launchOptions: {} });
test("controls keep playing before and after resume", async ({ page }) => {
  await page.goto("/");
  const game = page.locator("pma-grove-rally");
  await game.getByRole("button", { name: "Open the gate", exact: true }).click();
  for (let round = 0; round < 2; round++) {
    await game.getByRole("button", { name: "Steer left", exact: true }).click();
    await expect(game.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
    await page.getByLabel("Host text").click();
    await expect(game.getByRole("button", { name: "Resume rally", exact: true })).toBeVisible();
    await game.getByRole("button", { name: "Resume rally", exact: true }).click();
  }
});
