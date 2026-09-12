import { test, expect } from '@playwright/test';
import { createPlayTrack } from '../src/game/play-track';
import { RallySession } from '../src/game/session';
import { playCar } from '../src/game/car';

test('original valley and play car complete all twelve posts in the shared simulator', async ({page}, info) => {
 test.skip(info.project.name !== 'desktop', 'Same simulator on both viewports');
 const track = await createPlayTrack();
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
