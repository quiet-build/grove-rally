/**
 * Race session: Trigger Rally Game.js startTime, Sim(1/150), Progress, recover,
 * and pause/retry wrapping. Original orchard track and toy car.
 */
import sim from "../upstream/sim.js";
import vehicle from "../upstream/vehicle.js";
import collision from "../upstream/collision.js";
import { Vector3, Quaternion } from "three";
import { toyCar } from "./car";
import { COURSE, START } from "./track";
import { OrchardTerrain, type Heightfield } from "./terrain";
import { ChaseCam } from "./cam";
import { Progress, checkpoints, type Checkpoint } from "./progress";

export type Status = "ready" | "countdown" | "racing" | "paused" | "finished";
export type View = {
  status: Status;
  checkpoint: number;
  total: number;
  time: number;
  speed: number;
  message: string;
  recovering?: boolean;
  flipped?: boolean;
};

type Body = {
  pos: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  ori: { set: (x: number, y: number, z: number, w: number) => unknown; normalize: () => void };
  linVel: { x: number; y: number; z: number };
  angVel: { x: number; y: number; z: number };
  reset: () => void;
  updateMatrices: () => void;
};
type Wheel = { ridePos: number; spinPos: number; cfg: { pos: number[] } };
type Car = {
  body: Body & { sim: { time: number; timeStep: number }; oriMat?: { elements: number[] } };
  controller: { input: { throttle: number; brake: number; handbrake: number; turn: number }; output: { throttle: number } };
  disabled: boolean;
  init: () => void;
  recoverTimer: number;
  recoverState: unknown;
  sim: { time: number; timeStep: number };
  wheels: Wheel[];
  getWheelTurnPos: (wheel: Wheel) => number;
  engineAngVelSmoothed: number;
  engineIdle: number;
  skidLevel: number;
};

const START_DELAY = 3;
const { Sim } = sim;
const { Vehicle } = vehicle;

function deepCar(config: typeof toyCar) {
  return structuredClone(config);
}

export class RallySession {
  view: View = { status: "ready", checkpoint: 0, total: COURSE.length, time: 0, speed: 0, message: "One toy car. One orchard loop." };
  cam = new ChaseCam();
  constructor(
    readonly terrain: Heightfield = new OrchardTerrain(),
    readonly course: Checkpoint[] = COURSE,
    readonly gate = START,
    readonly carConfig: typeof toyCar = toyCar,
  ) {
    this.view.total = course.length;
  }
  reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  private listeners = new Set<() => void>();
  private sim: { time: number; timeStep: number; tick: (d: number) => void; restart: () => void; addStaticObject: (o: unknown) => void; pubsub: { subscribe: (t: string, fn: () => void) => void } } | null = null;
  private car: Car | null = null;
  private progress: Progress | null = null;
  private beforePause: Status = "racing";
  throttle = 0;
  brake = 0;
  handbrake = 0;
  turn = 0;
  muted = true;
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
    // After setupVehicle tilt, body +Y is roof. Throttle rolls toward +bodyZ (mesh +Z).
    return e ? Math.atan2(e[8], e[9]) : 0;
  }
  get speed() {
    const vel = this.car?.body.linVel;
    return vel ? Math.hypot(vel.x, vel.y) : 0;
  }
  get nextCheckpoint() { return this.progress?.nextCheckpoint(0) ?? this.course[0]; }
  get vehicle() { return this.car; }
  assemble() { if (!this.sim) this.build(); }
  addSceneryCollision(points: Array<Vector3 & { radius: number }>) {
    this.assemble();
    const SphereList = collision.SphereList as new (points: Array<Vector3 & { radius: number }>) => unknown;
    this.sim!.addStaticObject(new SphereList(points));
  }
  start() {
    if (!this.sim) this.build();
    else this.resetRun();
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
  /** Sit back on the last passed post (or the gate). Keeps the clock and Progress. Not Trigger Rally R, which restarts the race. */
  resetToLastPost() {
    if (this.view.status === "ready" || this.view.status === "finished") return;
    const progress = this.progress;
    if (!progress) return;
    const i = progress.nextCpIndex;
    if (i <= 0) {
      this.placeCar(this.gate.pos[0], this.gate.pos[1], this.gate.rot[2]);
      return;
    }
    const last = this.course[i - 1];
    const next = this.course[i] ?? last;
    this.placeCar(last.pos[0], last.pos[1], Math.atan2(next.pos[1] - last.pos[1], next.pos[0] - last.pos[0]));
  }
  update(delta: number) {
    if (this.view.status !== "countdown" && this.view.status !== "racing") return;
    const car = this.car, race = this.sim, progress = this.progress;
    if (!car || !race || !progress) return;
    car.controller.input.throttle = this.throttle;
    car.controller.input.brake = this.brake;
    car.controller.input.handbrake = this.handbrake;
    // Upstream yaw-left is opposite this Z-up map; player right must increase +X from the south gate.
    car.controller.input.turn = -this.turn;
    race.tick(Math.min(delta, 0.05));
    const pos = this.interp?.pos ?? car.body.pos;
    if (this.reduced) this.cam.snap(pos);
    else this.cam.follow(pos, car.body.linVel, delta);
    if (progress.isFinished()) {
      const finish = Math.max(0, (progress.finishTime() ?? race.time) - START_DELAY);
      this.emit({ status: "finished", checkpoint: this.course.length, time: finish, message: `${finish.toFixed(1)}s around the orchard.` });
      return;
    }
    const waiting = race.time < START_DELAY;
    const raceTime = Math.max(0, race.time - START_DELAY);
    const flipped = Boolean(car.body.oriMat && car.body.oriMat.elements[6] <= 0.2);
    const recovering = Boolean(car.recoverState || (car.recoverTimer > 0 && car.recoverTimer >= (this.carConfig.recover?.triggerTime ?? 1) * 0.5));
    const next: View = {
      status: waiting ? "countdown" : "racing",
      checkpoint: progress.nextCpIndex,
      total: this.course.length,
      time: raceTime,
      speed: Math.round(this.speed * 3.6),
      message: waiting
        ? String(Math.ceil(START_DELAY - race.time))
        : recovering
          ? "Recovering… Press R to reset"
          : flipped
            ? "Car flipped! Press R to reset"
            : "Follow the wooden posts.",
      recovering,
      flipped,
    };
    if (
      next.status !== this.view.status ||
      next.checkpoint !== this.view.checkpoint ||
      next.message !== this.view.message ||
      next.time.toFixed(1) !== this.view.time.toFixed(1) ||
      next.recovering !== this.view.recovering ||
      next.flipped !== this.view.flipped
    ) {
      this.emit(next);
    }
  }
  private build() {
    const race = new Sim(1 / 150);
    race.addStaticObject(this.terrain);
    const car = new Vehicle(race, deepCar(this.carConfig)) as Car;
    this.sim = race;
    this.car = car;
    this.progress = new Progress(checkpoints(this.course), car);
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
    progress.restart();
    this.placeCar(this.gate.pos[0], this.gate.pos[1], this.gate.rot[2]);
  }
  private placeCar(x: number, y: number, rotZ: number) {
    const car = this.car;
    if (!car) return;
    car.body.reset();
    // Trigger Rally Game.setupVehicle: tilt (1,1,1,1) so body +Y is roof, then course yaw.
    const ori = car.body.ori as unknown as Quaternion;
    ori.set(1, 1, 1, 1).normalize();
    ori.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rotZ));
    const ground = this.terrain.getContact({ x, y });
    car.body.pos.set(x, y, ground.surfacePos.z + 0.85);
    car.body.updateMatrices();
    car.init();
    car.recoverTimer = 0;
    car.recoverState = null;
    this.cam.snap(car.body.pos);
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = 0;
    this.turn = 0;
    if (this.view.status === "racing" || this.view.status === "countdown") {
      this.emit({ recovering: false, flipped: false, speed: 0, message: "Follow the wooden posts." });
    }
  }
}
