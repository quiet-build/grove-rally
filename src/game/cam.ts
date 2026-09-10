/**
 * Chase look-ahead from Trigger Rally client.js CamControl.chaseCam
 * at 079ac53216b74598b652ce3bf11478beb5c6832b: target = pos + linVel * 0.17,
 * PULLTOWARD with delta * 5. Adapted to a 2D follow camera.
 */
import util from "../upstream/util.js";

const pull = util.PULLTOWARD as (val: number, target: number, delta: number) => number;

export class ChaseCam {
  x = 0;
  y = 0;
  follow(pos: { x: number; y: number }, linVel: { x: number; y: number }, delta: number) {
    const targetX = pos.x + linVel.x * 0.17;
    const targetY = pos.y + linVel.y * 0.17;
    const camDelta = delta * 5;
    this.x = pull(this.x, targetX, camDelta);
    this.y = pull(this.y, targetY, camDelta);
  }
  snap(pos: { x: number; y: number }) {
    this.x = pos.x;
    this.y = pos.y;
  }
}
