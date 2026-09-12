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

  it('lights the outside of the pine crown', () => {
    const engine = new NullEngine();
    try {
      const tree = originalArt(new Scene(engine)).tree();
      const positions = tree.getVerticesData('position')!;
      const normals = tree.getVerticesData('normal')!;
      const crownNormals = [];
      for (let i = 0; i < positions.length; i += 3) {
        if (positions[i + 1] > 2.7) crownNormals.push(normals[i + 1]);
      }
      expect(crownNormals.reduce((sum, y) => sum + y, 0) / crownNormals.length).toBeGreaterThan(0);
    } finally { engine.dispose(); }
  });
});
