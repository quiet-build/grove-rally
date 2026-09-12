import { test, expect } from '@playwright/test';

test('numbered checkpoint guidance advances and clears on restart', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name:'Open the gate',exact:true}).click();
  await expect(page.locator('.hud-navigation')).toContainText('Checkpoint 1');
  await page.keyboard.down('w');
  await expect(page.getByTestId('level')).toHaveText('2 / 12', {timeout:20000});
  await page.keyboard.up('w');
  await expect(page.getByRole('status')).toContainText('Checkpoint 1 complete');
  await expect(page.locator('.hud-navigation')).toContainText('Checkpoint 2');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Restart rally',exact:true}).click();
  await expect(page.getByTestId('level')).toHaveText('1 / 12');
  await expect(page.locator('.hud-navigation')).toContainText('Checkpoint 1');
  await expect(page.getByRole('status')).toHaveCount(0);
});
