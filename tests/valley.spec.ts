import { test, expect } from '@playwright/test';
import { Heightfield } from '../src/game/terrain';
import { NICE_SCALE, valleyTrack } from '../src/game/play-track';
import { RallySession } from '../src/game/session';
import { playCar } from '../src/game/car';

test('actual local valley and play car complete all twelve posts in the shared simulator', async ({page}, info) => {
 test.skip(info.project.name !== 'desktop', 'Same simulator on both viewports');
 await page.goto('/');
 const pixels = await page.evaluate(async () => {
  const img = new Image(); img.src = '/tr/tracks/nice.png';
  try { await img.decode(); } catch { return null; }
  const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(0, img.height); ctx.scale(1, -1); ctx.drawImage(img, 0, 0);
  const rgba = ctx.getImageData(0, 0, img.width, img.height).data;
  return {width: img.width, height: img.height, data: Array.from({length: img.width*img.height}, (_,i) => rgba[i*4]+rgba[i*4+1]*256)};
 });
 test.skip(!pixels, 'Licensed local-only heightmap is absent');
 await page.goto('about:blank');
 const track = valleyTrack(new Heightfield({maps:{height:{...pixels!,data:Float32Array.from(pixels!.data),scale:NICE_SCALE}}}));
 const s = new RallySession(track.terrain, track.course, track.start, playCar);
 s.start();
 for(let i=0;i<18000 && s.view.status !== 'finished';i++) {
  const target=s.nextCheckpoint!;
  const body=s.body!;
  let error=Math.atan2(target.pos[0]-body.pos.x,target.pos[1]-body.pos.y)-s.heading;
  error=Math.atan2(Math.sin(error),Math.cos(error));
  s.turn=Math.max(-1,Math.min(1,error*2));
  const targetSpeed=Math.abs(error)>0.6?5:12;
  s.throttle=s.speed<targetSpeed?1:0;
  s.brake=s.speed>targetSpeed+2?0.4:0;
  s.update(.05);
 }
 expect(s.view.checkpoint).toBe(12);
 expect(s.view.status).toBe('finished');
 await info.attach('valley-result', {body:JSON.stringify(s.view,null,2),contentType:'application/json'});
});
