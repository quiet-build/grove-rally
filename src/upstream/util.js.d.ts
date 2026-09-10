declare const util: {
  PULLTOWARD: (val: number, target: number, delta: number) => number;
  catmullRom: (pm1: number, p0: number, p1: number, p2: number, x: number) => number;
  catmullRomDeriv: (pm1: number, p0: number, p1: number, p2: number, x: number) => number;
  TWOPI: number;
};
export default util;
