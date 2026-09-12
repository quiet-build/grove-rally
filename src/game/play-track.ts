import { Heightfield } from "./terrain";
import type { Checkpoint } from "./progress";

export type PlayTrack = { terrain: Heightfield; course: Checkpoint[]; start: { pos: number[]; rot: number[] } };

/** Original valley samples. The existing heightfield sampler and course generator are unchanged. */
export function originalValley(): Heightfield {
  const width = 512;
  const data = new Float32Array(width * width);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const dx = (x - 256) * 4, dy = (y - 256) * 4;
    const rim = Math.max(0, Math.hypot(dx, dy) - 500);
    data[x + y * width] = 80 + 5 * Math.sin(dx / 130) * Math.sin(dy / 155)
      + 2 * Math.sin((dx + dy) / 85) + rim * rim / 4200;
  }
  return new Heightfield({ maps: { height: {data,width,height:width,scale:{x:4,y:4,z:1}} } });
}

export function valleyTrack(terrain: Heightfield): PlayTrack {
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
  return valleyTrack(originalValley());
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
