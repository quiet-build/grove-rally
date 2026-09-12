import { COURSE, START } from "./track";
import { Heightfield, OrchardTerrain, type HeightMap } from "./terrain";
import type { Checkpoint } from "./progress";

/** Horizontal 4 m/px. z is a bit above common OE 0.05 so the valley actually rolls. */
export const NICE_SCALE = { x: 4, y: 4, z: 0.08 };

export type PlayTrack = { terrain: Heightfield; course: Checkpoint[]; start: { pos: number[]; rot: number[] } };

export function orchardTrack(): PlayTrack {
  return { terrain: new OrchardTerrain(), course: COURSE, start: START };
}

export async function loadNiceTrack(): Promise<PlayTrack | null> {
  const url = "/tr/tracks/nice.png";
  const image = await loadImage(url).catch(() => null);
  if (!image) return null;
  const terrain = new Heightfield({ maps: { height: decodeHeight(image, NICE_SCALE) } });
  const gate = pickGate(terrain);
  const rx = 280;
  const ry = 170;
  const course: Checkpoint[] = [];
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + ((i + 1) * Math.PI * 2) / 12;
    const wobble = 52 * Math.sin(a * 3) + 28 * Math.cos(a * 5);
    const x = gate.cx + Math.cos(a) * (rx + wobble);
    const y = gate.cy + Math.sin(a) * (ry + wobble * 0.55);
    course.push({ pos: [x, y, terrain.getContact({ x, y }).surfacePos.z] });
  }
  const first = course[0];
  return {
    terrain,
    course,
    start: { pos: [first.pos[0], first.pos[1] - 42, 0], rot: [0, 0, Math.PI / 2] },
  };
}

export async function createPlayTrack(): Promise<PlayTrack> {
  return (await loadNiceTrack()) ?? orchardTrack();
}

function decodeHeight(image: HTMLImageElement, scale: HeightMap["scale"]): HeightMap {
  const width = image.width;
  const height = image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("heightmap canvas");
  ctx.translate(0, height);
  ctx.scale(1, -1);
  ctx.drawImage(image, 0, 0);
  const pix = ctx.getImageData(0, 0, width, height).data;
  const data = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) data[i] = pix[p] + pix[p + 1] * 256;
  return { data, width, height, scale };
}

function pickGate(terrain: Heightfield) {
  const map = terrain.source.maps.height;
  let best = { score: Infinity, x: 0, y: 0, cx: 0, cy: 0 };
  for (let iy = 80; iy < map.height - 80; iy += 24) {
    for (let ix = 80; ix < map.width - 80; ix += 24) {
      const cx = ix * map.scale.x;
      const cy = iy * map.scale.y;
      const x = cx;
      const y = cy - 200;
      const contact = terrain.getContact({ x, y });
      const slope = Math.hypot(contact.normal.x, contact.normal.y);
      const score = slope * 25 + Math.abs(contact.surfacePos.z - 80) * 0.02;
      if (score < best.score) best = { score, x, y, cx, cy };
    }
  }
  return best;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(url));
    image.src = url;
  });
}
