import { expect, it } from 'vitest';
import { createPlayTrack } from './play-track';
import { RallySession } from './session';
import { playCar } from './car';

it.each([-1, 1])('settles after releasing turn %i while keeping the accelerator held', async turn => {
  const track = await createPlayTrack();
  const session = new RallySession(track.terrain, track.course, track.start, playCar);
  session.start();
  session.turn = turn;
  for (let i = 0; i < 80; i++) session.update(.05);
  session.throttle = 1;
  for (let i = 0; i < 30; i++) session.update(.05);
  session.turn = 0;
  let previous = session.heading;
  let rotation = 0;
  for (let i = 0; i < 120; i++) {
    session.update(.05);
    const delta = session.heading - previous;
    rotation += Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
    previous = session.heading;
  }
  // Allow the initial slide to settle without continuing a full spin.
  expect(rotation).toBeLessThan(Math.PI / 2);
  expect(session.speed).toBeGreaterThan(10);
});
