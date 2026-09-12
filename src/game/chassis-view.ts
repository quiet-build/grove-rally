import { Quaternion, Vector3 } from "three";

/** Physics is Z-up; Babylon is Y-up via (x,y,z)→(x,z,y). That map is not a
 *  rotation, so swapping quat Y/Z lays the car on its side. Rx(-90°) * ori * Ry(π)
 *  sends mesh +Y (roof) to Babylon +Y and mesh +Z (forward) to Babylon +Z. */
const RX = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const RY = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
const tmp = new Quaternion();

export function chassisToView(ori: { x: number; y: number; z: number; w: number }, out: Quaternion) {
  tmp.set(ori.x, ori.y, ori.z, ori.w);
  return out.copy(RX).multiply(tmp).multiply(RY);
}
