import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { RallySession } from "./session";
import { COURSE } from "./track";
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
