/**
 * Original orchard heightfield using Trigger Rally TerrainTile.getContactRayZ
 * sampling (catmullRom + derivatives) from terrain.js at
 * 079ac53216b74598b652ce3bf11478beb5c6832b. Height samples are original.
 */
import { Vector3 } from "three";
import util from "../upstream/util.js";

const wrap = (x: number, lim: number) => x - Math.floor(x / lim) * lim;
const catmullRom = util.catmullRom as (a: number, b: number, c: number, d: number, x: number) => number;
const catmullRomDeriv = util.catmullRomDeriv as (a: number, b: number, c: number, d: number, x: number) => number;

export const SIZE = 64;
export const SCALE = { x: 4, y: 4, z: 6 };

export function makeHeights() {
  const data = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const nx = x / SIZE;
      const ny = y / SIZE;
      data[y * SIZE + x] =
        0.42 +
        0.08 * Math.sin(nx * Math.PI * 3.2) * Math.cos(ny * Math.PI * 2.6) +
        0.04 * Math.sin(nx * 18) * Math.sin(ny * 14);
    }
  }
  return data;
}

export class OrchardTerrain {
  readonly source = { maps: { height: { data: makeHeights(), width: SIZE, height: SIZE, scale: SCALE } } };
  getContact(pt: { x: number; y: number }) {
    return this.getContactRayZ(pt.x, pt.y);
  }
  getContactRayZ(x: number, y: number) {
    const mapHeight = this.source.maps.height;
    const tX = x / mapHeight.scale.x;
    const tY = y / mapHeight.scale.y;
    const floorx = Math.floor(tX);
    const floory = Math.floor(tY);
    const fracx = tX - floorx;
    const fracy = tY - floory;
    const cx = mapHeight.width;
    const cy = mapHeight.height;
    const hmap = mapHeight.data;
    const h: number[] = [];
    let i = 0;
    for (let sy = -1; sy <= 2; sy++) {
      for (let sx = -1; sx <= 2; sx++) {
        h[i++] = hmap[wrap(floorx + sx, cx) + wrap(floory + sy, cy) * cx];
      }
    }
    const height =
      catmullRom(
        catmullRom(h[0], h[1], h[2], h[3], fracx),
        catmullRom(h[4], h[5], h[6], h[7], fracx),
        catmullRom(h[8], h[9], h[10], h[11], fracx),
        catmullRom(h[12], h[13], h[14], h[15], fracx),
        fracy,
      ) * mapHeight.scale.z;
    const derivX =
      catmullRomDeriv(
        catmullRom(h[0], h[4], h[8], h[12], fracy),
        catmullRom(h[1], h[5], h[9], h[13], fracy),
        catmullRom(h[2], h[6], h[10], h[14], fracy),
        catmullRom(h[3], h[7], h[11], h[15], fracy),
        fracx,
      ) * (mapHeight.scale.z / mapHeight.scale.x);
    const derivY =
      catmullRomDeriv(
        catmullRom(h[0], h[1], h[2], h[3], fracx),
        catmullRom(h[4], h[5], h[6], h[7], fracx),
        catmullRom(h[8], h[9], h[10], h[11], fracx),
        catmullRom(h[12], h[13], h[14], h[15], fracx),
        fracy,
      ) * (mapHeight.scale.z / mapHeight.scale.y);
    const normal = new Vector3(-derivX, -derivY, 1).normalize();
    return { normal, surfacePos: new Vector3(x, y, height) };
  }
}
