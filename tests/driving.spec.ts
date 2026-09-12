import { test, expect, type Page } from '@playwright/test';

const readSpeed = async (page: Page) => Number((await page.locator('.hud-speed').textContent())?.split(' ')[0]);

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', {name:'Open the gate',exact:true}).click();
}

test('held W survives countdown, drives and resumes after reset',async({page})=>{
 await start(page);
 await page.keyboard.down('w');
 await expect.poll(()=>readSpeed(page),{timeout:12000}).toBeGreaterThan(10);
 await page.keyboard.press('r');
 await expect.poll(()=>readSpeed(page)).toBeGreaterThan(5);
 await page.keyboard.up('w');
 await page.keyboard.press('p');
 const time=await page.getByTestId('score').textContent();
 await page.waitForTimeout(500);
 await expect(page.getByTestId('score')).toHaveText(time!);
 await page.getByRole('button',{name:'Resume rally',exact:true}).click();
 await page.getByRole('button',{name:'Sound on',exact:true}).click();
 await page.keyboard.press('Space');
 await expect(page.getByRole('button',{name:'Sound on',exact:true})).toBeFocused();
});

test('pointer accelerator held before green drives without pressing again',async({page})=>{
 await start(page);
 const button=page.getByRole('button',{name:'Accelerate',exact:true});
 const box=(await button.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await expect.poll(()=>readSpeed(page),{timeout:12000}).toBeGreaterThan(10);
 // Unrelated key releases must not cancel a held pointer.
 await page.keyboard.press('Shift');
 await expect.poll(()=>readSpeed(page)).toBeGreaterThan(15);
 await page.mouse.up();
});

test('real fullscreen retains driving controls',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Open fullscreen',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
 expect(await page.evaluate(()=>document.fullscreenElement!.contains(document.querySelector('[aria-label="Accelerate"]')))).toBe(true);
 await page.getByRole('button',{name:'Open the gate',exact:true}).click();
 const b=(await page.getByRole('button',{name:'Accelerate',exact:true}).boundingBox())!;
 expect(b.y+b.height).toBeLessThanOrEqual(page.viewportSize()!.height);
 await page.keyboard.down('w');
 await expect.poll(()=>readSpeed(page),{timeout:12000}).toBeGreaterThan(5);
 await page.keyboard.up('w');
 await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
});

test('original artwork starts without any upstream content requests', async ({page}) => {
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 const upstream: string[] = [];
 page.on('request', request => {if(request.url().includes('/tr/')) upstream.push(request.url());});
 await start(page);
 await expect(page.getByTestId('level')).toHaveText('1 / 12');
 await page.keyboard.down('w');
 await expect.poll(()=>readSpeed(page),{timeout:12000}).toBeGreaterThan(10);
 await page.keyboard.up('w');
 expect(errors).toEqual([]);
 expect(upstream).toEqual([]);
});

test('handbrake slows the car and held W still works after using a utility button', async ({page}) => {
 await start(page);
 await page.keyboard.down('w');
 await expect.poll(()=>readSpeed(page),{timeout:12000}).toBeGreaterThan(15);
 await page.keyboard.up('w');
 const speed=Number((await page.locator('.hud-speed').textContent())!.split(' ')[0]);
 await page.keyboard.down('Space');
 await expect.poll(()=>readSpeed(page)).toBeLessThan(speed*.6);
 await page.keyboard.up('Space');
 await page.keyboard.press('r');
 await page.getByRole('button',{name:'Sound on',exact:true}).click();
 await page.keyboard.down('w');
 await expect.poll(()=>readSpeed(page)).toBeGreaterThan(5);
 await page.keyboard.up('w');
});
