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


test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  console.log('Checkpoint failure state', await page.evaluate(async () => {
    let frames = 0;
    let running = true;
    const count = () => { frames++; if (running) requestAnimationFrame(count); };
    requestAnimationFrame(count);
    await new Promise(resolve => setTimeout(resolve, 2000));
    running = false;
    return { text: document.body.innerText, visibility: document.visibilityState, frames,
      canvas: [...document.querySelectorAll('canvas')].map(c => [c.width, c.height]) };
  }));
});
