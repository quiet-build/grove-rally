import { describe, it, expect } from 'vitest';
import { NullEngine, Scene } from '@babylonjs/core';
import { originalArt } from './original-art';

describe('original rally artwork', () => {
  it('constructs the complete car and scenery without interrupting scene startup', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      for (const factory of Object.values(originalArt(scene))) {
        const mesh = factory();
        expect(mesh.getTotalVertices()).toBeGreaterThan(0);
      }
    } finally { engine.dispose(); }
  });
});
