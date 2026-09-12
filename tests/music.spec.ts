import { test, expect } from '@playwright/test';

test('music loops once and follows sound, pause and resume', async ({page}) => {
  await page.addInitScript(() => {
    const sources: {source: AudioBufferSourceNode; output?: GainNode}[] = [];
    (window as any).musicSources = sources;
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = original.call(this);
      const entry: {source: AudioBufferSourceNode; output?: GainNode} = {source};
      sources.push(entry);
      const connect = source.connect.bind(source);
      source.connect = ((output: AudioNode) => { entry.output = output as GainNode; return connect(output); }) as typeof source.connect;
      return source;
    };
  });
  await page.goto('/');
  await page.getByRole('button', {name:'Open the gate',exact:true}).click();
  await page.getByRole('button', {name:'Sound off',exact:true}).click();
  const state = () => page.evaluate(() => {
    const music = (window as any).musicSources.filter((entry: any) => entry.source.buffer?.duration === 10);
    return {count:music.length, loop:music[0]?.source.loop, gain:music[0]?.output?.gain.value, context:music[0]?.source.context.state};
  });
  await expect.poll(async()=> (await state()).context).toBe('running');
  expect((await state()).loop).toBe(true);
  expect((await state()).count).toBe(1);
  await expect.poll(async()=> (await state()).gain).toBeGreaterThan(.1);
  await page.getByRole('button', {name:'Pause',exact:true}).click();
  await expect.poll(async()=> (await state()).gain).toBe(0);
  await page.getByRole('button', {name:'Resume rally',exact:true}).click();
  await expect.poll(async()=> (await state()).gain).toBeGreaterThan(.1);
  await page.getByRole('button', {name:'Sound on',exact:true}).click();
  await expect.poll(async()=> (await state()).gain).toBeLessThan(.001);
  expect((await state()).count).toBe(1);
});
