import type { Checkpoint } from "./progress";

/** Original orchard course. Checkpoints use Trigger Rally Progress radius (18m). */
export const COURSE: Checkpoint[] = [
  { pos: [52, -18, 3] },
  { pos: [96, 18, 3] },
  { pos: [78, 68, 3] },
  { pos: [24, 92, 3] },
  { pos: [-28, 74, 3] },
  { pos: [-58, 24, 3] },
  { pos: [-22, -18, 3] },
  { pos: [24, -28, 3] },
];

export const START = { pos: [52, -46, 3.4], rot: [0, 0, Math.PI / 2] };

export const TREES: [number, number][] = [
  [22, 8], [70, -40], [110, 8], [120, 50], [90, 100], [40, 120],
  [-10, 110], [-70, 90], [-90, 40], [-70, -10], [-10, -50], [40, -55],
  [60, 40], [10, 50], [-40, 40], [50, 10],
];
