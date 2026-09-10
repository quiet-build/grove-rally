/**
 * Race session: Trigger Rally Game.js startTime, Sim(1/150), Progress, recover,
 * and pause/retry wrapping. Original orchard track and toy car.
 */
import sim from "../upstream/sim.js";
import vehicle from "../upstream/vehicle.js";
import { Vector3, Quaternion } from "three";
import { toyCar } from "./car";
import { COURSE, START } from "./track";
import { OrchardTerrain } from "./terrain";
import { ChaseCam } from "./cam";
import { Progress, checkpoints } from "./progress";

export type Status = "ready" | "countdown" | "racing" | "paused" | "finished";
export type View = {
  status: Status;
  checkpoint: number;
  total: number;
  time: number;
  message: string;
};

type Body = {
  pos: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  ori: { set: (x: number, y: number, z: number, w: number) => unknown; normalize: () => void };
  linVel: { x: number; y: number; z: number };
  angVel: { x: number; y: number; z: number };
  reset: () => void;
  updateMatrices: () => void;
};
type Car = {
  body: Body & { sim: { time: number; timeStep: number }; oriMat?: { elements: number[] } };
  controller: { input: { throttle: number; brake: number; handbrake: number; turn: number } };
  disabled: boolean;
  init: () => void;
  recoverTimer: number;
  sim: { time: number; timeStep: number };
};

const START_DELAY = 3;
const { Sim } = sim;
const { Vehicle } = vehicle;

function deepCar() {
  return structuredClone(toyCar);
}

export class RallySession {
  view: View = { status: "ready", checkpoint: 0, total: COURSE.length, time: 0, message: "One toy car. One orchard loop." };
  cam = new ChaseCam();
  terrain = new OrchardTerrain();
  reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  private listeners = new Set<() => void>();
  private sim: { time: number; timeStep: number; tick: (d: number) => void; restart: () => void; addStaticObject: (o: unknown) => void; pubsub: { subscribe: (t: string, fn: () => void) => void } } | null = null;
  private car: Car | null = null;
  private progress: Progress | null = null;
  private beforePause: Status = "racing";
  throttle = 0;
  brake = 0;
  turn = 0;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  snapshot = () => this.view;
  private emit(change: Partial<View>) { this.view = { ...this.view, ...change }; this.listeners.forEach(fn => fn()); }
  get body() { return this.car?.body ?? null; }
  get interp() {
    const body = this.car?.body as Body & { interp?: { pos: { x: number; y: number; z: number }; ori: { x: number; y: number; z: number; w: number } } } | null;
    return body?.interp ?? (body ? { pos: body.pos, ori: body.ori } : null);
  }
  get heading() {
    const vel = this.car?.body.linVel;
    if (vel && vel.x * vel.x + vel.y * vel.y > 0.25) return Math.atan2(vel.x, vel.y);
    const e = (this.car?.body as { oriMat?: { elements: number[] } } | null)?.oriMat?.elements;
    return e ? Math.atan2(e[4], e[5]) : 0;
  }
  get speed() {
    const vel = this.car?.body.linVel;
    return vel ? Math.hypot(vel.x, vel.y) : 0;
  }
  get nextCheckpoint() { return this.progress?.nextCheckpoint(0) ?? COURSE[0]; }
  start() {
    this.build();
    this.emit({ status: "countdown", checkpoint: 0, time: 0, message: "Ready on the dirt." });
  }
  retry() {
    if (this.view.status !== "finished" && this.view.status !== "paused") return;
    this.resetRun();
    this.emit({ status: "countdown", checkpoint: 0, time: 0, message: "Back to the gate." });
  }
  pause() {
    if (this.view.status !== "countdown" && this.view.status !== "racing") return;
    this.beforePause = this.view.status;
    this.emit({ status: "paused", message: "The orchard can wait." });
  }
  resume() {
    if (this.view.status !== "paused") return;
    this.emit({ status: this.beforePause, message: this.beforePause === "countdown" ? "Ready on the dirt." : "Follow the wooden posts." });
  }
  update(delta: number) {
    if (this.view.status !== "countdown" && this.view.status !== "racing") return;
    const car = this.car, race = this.sim, progress = this.progress;
    if (!car || !race || !progress) return;
    car.controller.input.throttle = this.throttle;
    car.controller.input.brake = this.brake;
    car.controller.input.handbrake = 0;
    // Upstream yaw-left is opposite this Z-up map; player right must increase +X from the south gate.
    car.controller.input.turn = -this.turn;
    race.tick(Math.min(delta, 0.05));
    const pos = this.interp?.pos ?? car.body.pos;
    if (this.reduced) this.cam.snap(pos);
    else this.cam.follow(pos, car.body.linVel, delta);
    if (progress.isFinished()) {
      const finish = Math.max(0, (progress.finishTime() ?? race.time) - START_DELAY);
      this.emit({ status: "finished", checkpoint: COURSE.length, time: finish, message: `${finish.toFixed(1)}s around the orchard.` });
      return;
    }
    const waiting = race.time < START_DELAY;
    const raceTime = Math.max(0, race.time - START_DELAY);
    const next: View = {
      status: waiting ? "countdown" : "racing",
      checkpoint: progress.nextCpIndex,
      total: COURSE.length,
      time: raceTime,
      message: waiting ? String(Math.ceil(START_DELAY - race.time)) : "Follow the wooden posts.",
    };
    if (next.status !== this.view.status || next.checkpoint !== this.view.checkpoint || next.message !== this.view.message || next.time.toFixed(1) !== this.view.time.toFixed(1)) {
      this.emit(next);
    }
  }
  private build() {
    const race = new Sim(1 / 150);
    race.addStaticObject(this.terrain);
    const car = new Vehicle(race, deepCar()) as Car;
    this.sim = race;
    this.car = car;
    this.progress = new Progress(checkpoints(COURSE), car);
    race.pubsub.subscribe("step", () => {
      const waiting = race.time < START_DELAY;
      if (!waiting) this.progress?.update();
      car.disabled = waiting || Boolean(this.progress?.isFinished());
    });
    this.resetRun();
  }
  private resetRun() {
    const car = this.car, race = this.sim, progress = this.progress;
    if (!car || !race || !progress) return;
    race.restart();
    car.body.reset();
    const ori = car.body.ori as unknown as Quaternion;
    ori.copy(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), START.rot[2]));
    const ground = this.terrain.getContact({ x: START.pos[0], y: START.pos[1] });
    car.body.pos.set(START.pos[0], START.pos[1], ground.surfacePos.z + 0.85);
    car.body.updateMatrices();
    car.init();
    car.recoverTimer = 0;
    progress.restart();
    this.cam.snap(car.body.pos);
    this.throttle = 0;
    this.brake = 0;
    this.turn = 0;
  }
}
