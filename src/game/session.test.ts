import { describe, expect, it } from "vitest";
import { Progress, checkpoints } from "./progress";
import { RallySession } from "./session";
import { COURSE, START } from "./track";

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
    const startY = s.body!.pos.y;
    s.throttle = 1;
    for (let i = 0; i < 160; i++) s.update(0.05);
    expect(s.view.status).toBe("racing");
    expect(s.body!.pos.y).toBeGreaterThan(startY + 8);
    expect(s.speed).toBeGreaterThan(2);
    expect(s.body!.pos.z).toBeGreaterThan(1);
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
    expect(s.body!.pos.x).toBeGreaterThan(START.pos[0] + 5);
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
});
