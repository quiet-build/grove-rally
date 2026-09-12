/** THREE.js JSONLoader formatVersion 3 (r54-era), as used by Trigger Rally car meshes. */

export type ThreeMesh = { positions: number[]; indices: number[]; normals: number[]; uvs: number[] };

const bit = (type: number, n: number) => (type & (1 << n)) !== 0;

export function parseThreeJson(text: string): ThreeMesh {
  const data = JSON.parse(text.replace(/,\s*([}\]])/g, "$1")) as {
    vertices: number[];
    faces: number[];
    normals?: number[];
    uvs?: number[][];
  };
  const verts = data.vertices;
  const norms = data.normals ?? [];
  const uv0 = data.uvs?.[0] ?? [];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const faces = data.faces;
  let offset = 0;
  const push = (vi: number, uvi: number, ni: number) => {
    const index = positions.length / 3;
    positions.push(verts[vi * 3], verts[vi * 3 + 1], verts[vi * 3 + 2]);
    if (norms.length) normals.push(norms[ni * 3] ?? 0, norms[ni * 3 + 1] ?? 0, norms[ni * 3 + 2] ?? 1);
    uvs.push(uv0[uvi * 2] ?? 0, uv0[uvi * 2 + 1] ?? 0);
    return index;
  };
  while (offset < faces.length) {
    const type = faces[offset++];
    const quad = bit(type, 0);
    const count = quad ? 4 : 3;
    const vi: number[] = [];
    for (let i = 0; i < count; i++) vi.push(faces[offset++]);
    if (bit(type, 1)) offset++;
    if (bit(type, 2)) offset++;
    const uvi: number[] = [];
    if (bit(type, 3)) for (let i = 0; i < count; i++) uvi.push(faces[offset++]);
    if (bit(type, 4)) offset++;
    const ni: number[] = [];
    if (bit(type, 5)) for (let i = 0; i < count; i++) ni.push(faces[offset++]);
    if (bit(type, 6)) offset++;
    if (bit(type, 7)) offset += count;
    const a = push(vi[0], uvi[0] ?? 0, ni[0] ?? 0);
    const b = push(vi[1], uvi[1] ?? 0, ni[1] ?? 0);
    const c = push(vi[2], uvi[2] ?? 0, ni[2] ?? 0);
    indices.push(a, b, c);
    if (quad) {
      const d = push(vi[3], uvi[3] ?? 0, ni[3] ?? 0);
      indices.push(a, c, d);
    }
  }
  return { positions, indices, normals, uvs };
}

type SceneFile = {
  embeds?: Record<string, { vertices: number[]; faces: number[]; normals?: number[]; uvs?: number[][] }>;
  objects?: Record<string, { scale?: number[]; position?: number[] }>;
  transform?: { rotation?: number[] };
};

export function parseThreeScene(text: string): ThreeMesh {
  const data = JSON.parse(text.replace(/,\s*([}\]])/g, "$1")) as SceneFile;
  const embed = data.embeds && Object.values(data.embeds)[0];
  if (!embed) throw new Error("THREE scene embed");
  const mesh = parseThreeJson(JSON.stringify(embed));
  const object = data.objects && Object.values(data.objects)[0];
  const pos = object?.position ?? [0, 0, 0];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    mesh.positions[i] += pos[0];
    mesh.positions[i + 1] += pos[1];
    mesh.positions[i + 2] += pos[2];
  }
  const rotation = data.transform?.rotation ?? [0, 0, 0];
  rotateEuler(mesh.positions, mesh.normals, rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
  // Embeds are Trigger Rally Z-up unless the Blender scene transform already rotated them to Y-up.
  if (Math.abs((rotation[0] || 0) + Math.PI / 2) > 0.2) rotateEuler(mesh.positions, mesh.normals, -Math.PI / 2, 0, 0);
  return mesh;
}

function rotateEuler(positions: number[], normals: number[], rx: number, ry: number, rz: number) {
  rotateAxis(positions, normals, rx, 0);
  rotateAxis(positions, normals, ry, 1);
  rotateAxis(positions, normals, rz, 2);
}

function rotateAxis(positions: number[], normals: number[], angle: number, axis: 0 | 1 | 2) {
  if (!angle) return;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const apply = (arr: number[]) => {
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], y = arr[i + 1], z = arr[i + 2];
      if (axis === 0) {
        arr[i + 1] = y * c - z * s;
        arr[i + 2] = y * s + z * c;
      } else if (axis === 1) {
        arr[i] = x * c + z * s;
        arr[i + 2] = -x * s + z * c;
      } else {
        arr[i] = x * c - y * s;
        arr[i + 1] = x * s + y * c;
      }
    }
  };
  apply(positions);
  apply(normals);
}
