import Phaser from "phaser";
import { RallySession } from "./session";
import { COURSE, TREES } from "./track";
import { SIZE, SCALE } from "./terrain";

export const WIDTH = 480, HEIGHT = 580;
const PX = 3.1;

export class RallyScene extends Phaser.Scene {
  private art!: Phaser.GameObjects.Graphics;
  constructor(private session: RallySession) { super("grove"); }
  create() { this.art = this.add.graphics(); }
  update(_time: number, delta: number) {
    this.session.update(Math.min(delta / 1000, 0.05));
    this.draw();
  }
  private draw() {
    const g = this.art, s = this.session, cam = s.cam;
    const sx = (x: number) => WIDTH / 2 + (x - cam.x) * PX;
    const sy = (y: number) => HEIGHT / 2 - (y - cam.y) * PX;
    g.clear();
    g.fillStyle(0xdde6c8);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(0xc9d6b0, 0.55);
    for (let y = 0; y < SIZE; y += 4) {
      for (let x = 0; x < SIZE; x += 4) {
        const wx = x * SCALE.x, wy = y * SCALE.y;
        g.fillCircle(sx(wx), sy(wy), 18);
      }
    }
    g.lineStyle(22, 0xc4a574, 0.95);
    g.beginPath();
    COURSE.forEach((cp, i) => {
      if (i === 0) g.moveTo(sx(cp.pos[0]), sy(cp.pos[1]));
      else g.lineTo(sx(cp.pos[0]), sy(cp.pos[1]));
    });
    g.lineTo(sx(COURSE[0].pos[0]), sy(COURSE[0].pos[1]));
    g.strokePath();
    g.lineStyle(10, 0xead7a8, 0.95);
    g.strokePath();
    for (const [x, y] of TREES) {
      g.fillStyle(0x7ea36a);
      g.fillCircle(sx(x), sy(y), 16);
      g.fillStyle(0x5f8a52);
      g.fillCircle(sx(x) - 4, sy(y) - 3, 9);
      g.fillStyle(0x8b5a3a);
      g.fillRect(sx(x) - 2, sy(y) + 8, 4, 7);
    }
    COURSE.forEach((cp, i) => {
      const next = s.nextCheckpoint?.pos[0] === cp.pos[0] && s.nextCheckpoint?.pos[1] === cp.pos[1];
      g.fillStyle(next ? 0x87c4b4 : 0xe8d9b0);
      g.fillRoundedRect(sx(cp.pos[0]) - 5, sy(cp.pos[1]) - 18, 10, 22, 3);
      g.fillStyle(next ? 0x2f6f62 : 0x8a6a3a);
      g.fillCircle(sx(cp.pos[0]), sy(cp.pos[1]) - 20, 7);
      if (next) {
        g.lineStyle(2, 0x2f6f62, 0.55);
        g.strokeCircle(sx(cp.pos[0]), sy(cp.pos[1]), 22);
      }
    });
    const body = s.body;
    const interp = s.interp;
    if (!body || !interp) return;
    const pos = interp.pos;
    const angle = s.heading;
    const x = sx(pos.x), y = sy(pos.y);
    const roll = s.reduced ? 0 : 0;
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(-angle);
    g.fillStyle(0x5c5348, 0.28);
    g.fillEllipse(0, 10, 28, 12);
    g.fillStyle(0x3d3a38);
    g.fillRoundedRect(-11, -16, 7, 11, 3);
    g.fillRoundedRect(4, -16, 7, 11, 3);
    g.fillRoundedRect(-11, 6, 7, 11, 3);
    g.fillRoundedRect(4, 6, 7, 11, 3);
    g.fillStyle(0xf4efe4);
    g.fillRoundedRect(-12, -18, 24, 36, 8);
    g.fillStyle(0xe07a62);
    g.fillRoundedRect(-12, -18, 24, 8, 6);
    g.fillStyle(0x9ed9c8);
    g.fillRoundedRect(-8, -8 + roll, 16, 16, 5);
    g.fillStyle(0x244867, 0.35);
    g.fillEllipse(-3, -4 + roll, 6, 5);
    g.restore();
  }
}
