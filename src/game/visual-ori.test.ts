import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { RallySession } from "./session";
import { COURSE, START } from "./track";
import { playCar } from "./car";
import { chassisToView } from "./chassis-view";

function viewAxes(s: RallySession) {
  const e = (s.body as { oriMat: { elements: number[] } }).oriMat.elements;
  const q = chassisToView(s.body!.ori as unknown as { x: number; y: number; z: number; w: number }, new Quaternion());
  return {
    physicsRoofZ: e[6],
    roof: new Vector3(0, 1, 0).applyQuaternion(q),
    fwd: new Vector3(0, 0, 1).applyQuaternion(q),
  };
}

describe("start orientation", () => {
  it("stands the mesh on its wheels at the gate and after last-post reset", () => {
    const s = new RallySession();
    s.start();
    const gate = viewAxes(s);
    expect(gate.physicsRoofZ).toBeGreaterThan(0.5);
    expect(gate.roof.y).toBeGreaterThan(0.5);
    expect(Math.abs(gate.fwd.y)).toBeLessThan(0.2);

    for (let i = 0; i < 80; i++) s.update(0.05);
    s.body!.pos.set(COURSE[0].pos[0], COURSE[0].pos[1], s.body!.pos.z);
    s.update(0.05);
    s.resetToLastPost();
    const post = viewAxes(s);
    expect(post.physicsRoofZ).toBeGreaterThan(0.5);
    expect(post.roof.y).toBeGreaterThan(0.5);
    expect(Math.abs(post.fwd.y)).toBeLessThan(0.2);
  });
});

it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])('visible nose follows physical forward at yaw %s', yaw => {
  const physics = new Quaternion(1,1,1,1).normalize().premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),yaw));
  const forward = new Vector3(0,0,1).applyQuaternion(physics);
  const expected = new Vector3(forward.x,forward.z,forward.y);
  const shown = new Vector3(0,0,1).applyQuaternion(chassisToView(physics,new Quaternion()));
  expect(shown.dot(expected)).toBeCloseTo(1,6);
});

it('keeps the nose aligned after an actual flip and automatic recovery', () => {
 const s=new RallySession();s.start();
 for(let i=0;i<80;i++)s.update(.05);
 (s.body!.ori as unknown as Quaternion).premultiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI));
 s.body!.updateMatrices();
 for(let i=0;i<220;i++)s.update(.05);
 const before=new Vector3(s.body!.pos.x,s.body!.pos.y,s.body!.pos.z);
 const shown=viewAxes(s).fwd;
 s.throttle=1;
 for(let i=0;i<80;i++)s.update(.05);
 const delta=new Vector3(s.body!.pos.x-before.x,s.body!.pos.z-before.z,s.body!.pos.y-before.y);
 expect(delta.dot(shown)).toBeGreaterThan(2);
});

it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])('play car accelerates along its visible nose at yaw %s', yaw => {
  const s = new RallySession(undefined, undefined, { ...START, rot: [0, 0, yaw] }, playCar);
  s.start();
  for (let i = 0; i < 80; i++) s.update(0.05);
  const before = { ...s.body!.pos };
  const nose = viewAxes(s).fwd;
  s.throttle = 1;
  for (let i = 0; i < 60; i++) s.update(0.05);
  const delta = new Vector3(s.body!.pos.x - before.x, s.body!.pos.z - before.z, s.body!.pos.y - before.y);
  expect(delta.dot(nose)).toBeGreaterThan(2);
});
