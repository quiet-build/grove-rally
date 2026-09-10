/**
 * Checkpoint progress from Trigger Rally game.js Progress
 * at 079ac53216b74598b652ce3bf11478beb5c6832b.
 * Copyright (C) 2012-2013 Code Artemis / jareiko. GPL-3.0.
 */
import { Vector2 } from "three";

export type Checkpoint = { pos: [number, number, number] };
export type CheckpointList = { length: number; at(i: number): Checkpoint | undefined };
export type ProgressVehicle = { body: { pos: { x: number; y: number } }; sim: { time: number; timeStep: number } };

const CP_RADIUS = 18;
const CP_RADIUS_SQ = CP_RADIUS * CP_RADIUS;
const cpVec = new Vector2();

export function checkpoints(points: Checkpoint[]): CheckpointList {
  return { length: points.length, at(i) { return i >= 0 && i < points.length ? points[i] : undefined; } };
}

export class Progress {
  nextCpIndex = 0;
  lastCpDistSq: number | null = null;
  cpTimes: number[] = [];
  constructor(readonly list: CheckpointList, readonly vehicle: ProgressVehicle) {}
  restart() {
    this.nextCpIndex = 0;
    this.lastCpDistSq = null;
    this.cpTimes = [];
  }
  nextCheckpoint(i = 0) {
    return this.list.at(this.nextCpIndex + i) ?? null;
  }
  isFinished() {
    return !this.nextCheckpoint(0);
  }
  finishTime() {
    return this.cpTimes[this.list.length - 1] ?? null;
  }
  update() {
    const vehic = this.vehicle;
    const nextCp = this.nextCheckpoint(0);
    if (!nextCp) return;
    cpVec.set(vehic.body.pos.x - nextCp.pos[0], vehic.body.pos.y - nextCp.pos[1]);
    const cpDistSq = cpVec.lengthSq();
    if (cpDistSq < CP_RADIUS_SQ) {
      const cpDist = Math.sqrt(cpDistSq);
      let time = vehic.sim.time;
      if (this.lastCpDistSq !== null) {
        const lastCpDist = Math.sqrt(this.lastCpDistSq);
        const diff = lastCpDist - cpDist;
        if (diff !== 0) {
          const frac = (lastCpDist - CP_RADIUS) / diff;
          time -= vehic.sim.timeStep * frac;
        }
      }
      this.advanceCheckpoint(time);
    }
    this.lastCpDistSq = cpDistSq;
  }
  advanceCheckpoint(time: number) {
    this.nextCpIndex++;
    this.cpTimes.push(time);
  }
}
