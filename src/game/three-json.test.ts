import { describe, expect, it } from "vitest";
import { parseThreeJson, parseThreeScene } from "./three-json";

describe("THREE JSON v3", () => {
  it("triangulates a textured quad with vertex normals", () => {
    const mesh = parseThreeJson(JSON.stringify({
      vertices: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      uvs: [[0, 0, 1, 0, 1, 1, 0, 1]],
      faces: [43, 0, 1, 2, 3, 0, 0, 1, 2, 3, 0, 1, 2, 3],
    }));
    expect(mesh.indices).toEqual([0, 1, 2, 0, 2, 3]);
    expect(mesh.positions.slice(0, 3)).toEqual([0, 0, 0]);
    expect(mesh.uvs.slice(0, 2)).toEqual([0, 0]);
    expect(mesh.normals.slice(0, 3)).toEqual([0, 0, 1]);
  });

  it("stands a Z-up Blender embed up in Y-up after the scene transform", () => {
    const mesh = parseThreeScene(JSON.stringify({
      objects: { Tree: { scale: [1, 1, 1], position: [0, 0, 0] } },
      transform: { rotation: [-Math.PI / 2, 0, 0] },
      embeds: {
        tree: {
          vertices: [0, 0, 0, 0, 0, 8, 1, 0, 0],
          faces: [0, 0, 1, 2],
        },
      },
    }));
    expect(mesh.positions[3]).toBeCloseTo(0);
    expect(mesh.positions[4]).toBeCloseTo(8);
    expect(mesh.positions[5]).toBeCloseTo(0);
  });
});
