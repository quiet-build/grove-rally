import { Matrix4, Quaternion } from "three";

// World (x,y,z) -> (x,z,y) is a reflection. Mirror local X as well to
// obtain a proper rotation while preserving the car's +Y roof and +Z nose.
const world = new Matrix4().set(1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,1);
const local = new Matrix4().makeScale(-1,1,1);
const rotation = new Matrix4();
const quaternion = new Quaternion();

export function chassisToView(ori: { x: number; y: number; z: number; w: number }, out: Quaternion) {
  quaternion.set(ori.x, ori.y, ori.z, ori.w);
  rotation.makeRotationFromQuaternion(quaternion).premultiply(world).multiply(local);
  return out.setFromRotationMatrix(rotation).normalize();
}
