import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { Progress, checkpoints } from "./progress";
import { RallySession } from "./session";
import { COURSE, START } from "./track";
import { playCar, toyCar } from "./car";

function roofUp(session: RallySession) {
  return (session.body as { oriMat: { elements: number[] } }).oriMat.elements[6];
}

describe("orchard rally", () => {
  it("only advances the next checkpoint and interpolates time like Trigger Rally Progress", () => {
    const vehicle = { body: { pos: { x: COURSE[3].pos[0], y: COURSE[3].pos[1] } }, sim: { time: 10, timeStep: 1 / 150 } };
    const skipped = new Progress(checkpoints(COURSE), vehicle);
    skipped.update();
    expect(skipped.nextCpIndex).toBe(0);
    const runner = new Progress(checkpoints(COURSE), { body: { pos: { x: COURSE[0].pos[0], y: COURSE[0].pos[1] } }, sim: { time: 5, timeStep: 1 / 150 } });
    runner.update();
    expect(runner.nextCpIndex).toBe(1);
    expect(runner.cpTimes[0]).toBe(5);
    runner.vehicle.body.pos.x = COURSE[2].pos[0];
    runner.vehicle.body.pos.y = COURSE[2].pos[1];
    runner.update();
    expect(runner.nextCpIndex).toBe(1);
  });

  it("runs the reused vehicle sim on the orchard heightfield after the three-second lights", () => {
    const s = new RallySession();
    s.start();
    expect(Math.abs(s.heading)).toBeLessThan(0.5);
    const startY = s.body!.pos.y;
    s.throttle = 1;
    for (let i = 0; i < 160; i++) s.update(0.05);
    expect(s.view.status).toBe("racing");
    expect(s.body!.pos.y).toBeGreaterThan(startY + 8);
    expect(s.speed).toBeGreaterThan(2);
    expect(s.body!.pos.z).toBeGreaterThan(1);
    expect(Math.abs(s.heading)).toBeLessThan(0.6);
  });

  it("freezes time and the car while paused, then retry restores the gate", () => {
    const s = new RallySession();
    s.start();
    s.throttle = 1;
    for (let i = 0; i < 80; i++) s.update(0.05);
    const time = s.view.time;
    const y = s.body!.pos.y;
    const checkpoint = s.view.checkpoint;
    s.pause();
    s.update(1);
    expect(s.view.status).toBe("paused");
    expect(s.view.time).toBe(time);
    expect(s.body!.pos.y).toBe(y);
    expect(s.view.checkpoint).toBe(checkpoint);
    s.retry();
    expect(s.view.status).toBe("countdown");
    expect(s.view.checkpoint).toBe(0);
    expect(s.body!.pos.y).toBeCloseTo(START.pos[1], 0);
    s.update(1);
    expect(s.view.time).toBe(0);
  });

  it("turns toward +X when holding right after the lights", () => {
    const s = new RallySession();
    s.start();
    s.throttle = 1;
    s.turn = 1;
    for (let i = 0; i < 200; i++) s.update(0.05);
    expect(s.body!.pos.x).toBeGreaterThan(START.pos[0] + 4);
  });

  it("can finish the Grove Valley loop by steering toward the next post", () => {
    const s = new RallySession();
    s.start();
    s.throttle = 1;
    for (let i = 0; i < 2400; i++) {
      const next = s.nextCheckpoint;
      const body = s.body;
      if (next && body && s.view.status !== "countdown") {
        const desired = Math.atan2(next.pos[0] - body.pos.x, next.pos[1] - body.pos.y);
        let err = desired - s.heading;
        while (err > Math.PI) err -= Math.PI * 2;
        while (err < -Math.PI) err += Math.PI * 2;
        s.turn = Math.max(-1, Math.min(1, err * 2));
      }
      s.update(0.05);
      if (s.view.status === "finished") break;
    }
    expect(s.view.status).toBe("finished");
    expect(s.view.time).toBeGreaterThan(15);
    expect(s.view.time).toBeLessThan(180);
  });

  it("brakes to a stop with ArrowDown, then reverse rolls back from the gate heading", () => {
    const s = new RallySession();
    s.start();
    s.throttle = 1;
    for (let i = 0; i < 160; i++) s.update(0.05);
    const moving = s.speed;
    expect(moving).toBeGreaterThan(2);
    const y = s.body!.pos.y;
    s.throttle = 0;
    s.brake = 1;
    for (let i = 0; i < 80; i++) s.update(0.05);
    expect(s.speed).toBeLessThan(moving * 0.5);
    for (let i = 0; i < 160; i++) s.update(0.05);
    expect(s.body!.pos.y).toBeLessThan(y);
  });

  it("sits on its wheels like Trigger Rally setupVehicle, then stands back up after a flip", () => {
    const s = new RallySession();
    s.start();
    expect(roofUp(s)).toBeGreaterThan(0.5);
    for (let i = 0; i < 80; i++) s.update(0.05);
    const ori = s.body!.ori as unknown as Quaternion;
    ori.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI));
    s.body!.updateMatrices();
    expect(roofUp(s)).toBeLessThan(0.1);
    s.update(0.05);
    expect(s.view.flipped).toBe(true);
    s.throttle = 0;
    for (let i = 0; i < 220; i++) s.update(0.05);
    expect(roofUp(s)).toBeGreaterThan(0.5);
    expect(s.view.flipped).toBe(false);
    const x = s.body!.pos.x;
    const y = s.body!.pos.y;
    s.throttle = 1;
    for (let i = 0; i < 100; i++) s.update(0.05);
    // vehicle.js recover() faces from atan2(Zx, Xx), not the start yaw — it just has to drive again.
    expect(Math.hypot(s.body!.pos.x - x, s.body!.pos.y - y)).toBeGreaterThan(3);
    expect(roofUp(s)).toBeGreaterThan(0.5);
    expect(s.view.status).toBe("racing");
  });

  it("locks the rear wheels with handbrake harder than coasting", () => {
    const coast = new RallySession();
    const lock = new RallySession();
    coast.start();
    lock.start();
    coast.throttle = 1;
    lock.throttle = 1;
    for (let i = 0; i < 160; i++) {
      coast.update(0.05);
      lock.update(0.05);
    }
    expect(lock.speed).toBeGreaterThan(2);
    coast.throttle = 0;
    lock.throttle = 0;
    lock.handbrake = 1;
    for (let i = 0; i < 40; i++) {
      coast.update(0.05);
      lock.update(0.05);
    }
    expect(lock.speed).toBeLessThan(coast.speed * 0.7);
  });

  it("puts the car back at the last post without clearing the clock or the posts", () => {
    const s = new RallySession();
    s.start();
    for (let i = 0; i < 80; i++) s.update(0.05);
    s.body!.pos.set(COURSE[0].pos[0], COURSE[0].pos[1], s.body!.pos.z);
    s.update(0.05);
    expect(s.view.checkpoint).toBeGreaterThanOrEqual(1);
    s.body!.pos.set(COURSE[0].pos[0] + 20, COURSE[0].pos[1] + 20, s.body!.pos.z);
    const time = s.view.time;
    const checkpoint = s.view.checkpoint;
    s.resetToLastPost();
    expect(s.body!.pos.x).toBeCloseTo(COURSE[0].pos[0], 0);
    expect(s.body!.pos.y).toBeCloseTo(COURSE[0].pos[1], 0);
    expect(s.view.checkpoint).toBe(checkpoint);
    expect(s.view.time).toBe(time);
    expect(s.speed).toBe(0);
  });

  it("keeps toyCar as the default and only uses playCar when passed in", () => {
    expect(playCar.engine.powerscale).toBeGreaterThan(toyCar.engine.powerscale);
    const toy = new RallySession();
    const play = new RallySession(undefined, undefined, undefined, playCar);
    toy.start();
    play.start();
    toy.throttle = 1;
    play.throttle = 1;
    for (let i = 0; i < 160; i++) {
      toy.update(0.05);
      play.update(0.05);
    }
    expect(play.speed).toBeGreaterThan(toy.speed);
    expect(play.body!.pos.y).toBeGreaterThan(toy.body!.pos.y);
  });
});
