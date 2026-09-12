/**
 * Trigger Rally client.js look: 75° chase cam, FogExp2, ambient + sun,
 * dirt/rock/veggie heightfield, car1 mesh. Babylon.js Engine/Scene/FreeCamera/
 * ShaderMaterial/ParticleSystem from current official docs.
 * Physics is Z-up; render space is Babylon Y-up via (x, y, z) → (x, z, y).
 */
import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  FreeCamera,
  HemisphericLight,
  Material,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Quaternion,
  Scene,
  ShaderMaterial,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexData,
} from "@babylonjs/core";
import { parseThreeJson, parseThreeScene } from "./three-json";
import { toyCar } from "./car";
import type { RallySession } from "./session";
import { DriveAudio } from "./drive-audio";
import { chassisToView } from "./chassis-view";
import util from "../upstream/util.js";
import { Quaternion as ThreeQuat } from "three";

const pull = util.PULLTOWARD as (val: number, target: number, delta: number) => number;
/** Trigger Rally chase is [0,1.2,-3] in mesh space (Y up, −Z behind). Pulled back so this mesh is not clipped. */
const CAM_LOCAL = new Vector3(0, 1.78, -5.8);
const FOV = 75 * Math.PI / 180;
const toView = (x: number, y: number, z: number) => new Vector3(x, z, y);
const SUN_DIR = new Vector3(-0.4, 1, 0.35).normalize();

function tileRng(tx: number, ty: number, salt: string) {
  let seed = (Math.imul(tx, 374761393) + Math.imul(ty, 668265263) + salt.length * 12345) | 0;
  return () => {
    seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
    seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
    return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
  };
}

type WheelView = { root: TransformNode; mesh: Mesh };

export class BabylonView {
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private carRoot: TransformNode;
  private wheels: WheelView[] = [];
  private camPos = new Vector3(0, 20, 0);
  private camOff = new Vector3();
  private carYup = new Quaternion();
  private chassisView = new ThreeQuat();
  private sky: Mesh | null = null;
  private dust: ParticleSystem | null = null;
  private cpRing: TransformNode | null = null;
  private cpHint: TransformNode | null = null;
  private shadow: ShadowGenerator;
  private terrainMat: ShaderMaterial | null = null;
  private resize: ResizeObserver;
  private driveAudio = new DriveAudio();
  private brakeMat: StandardMaterial | null = null;

  constructor(canvas: HTMLCanvasElement, private session: RallySession, onReady: () => void) {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.867, 0.933, 1, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.00045;
    this.scene.fogColor = new Color3(0.867, 0.933, 1);
    this.scene.ambientColor = new Color3(0.267, 0.4, 0.502);

    this.camera = new FreeCamera("chase", new Vector3(0, 20, 0), this.scene);
    this.camera.minZ = 0.15;
    this.camera.maxZ = 6000;
    this.camera.fov = FOV;
    this.camera.inputs.clear();

    const hemi = new HemisphericLight("ambient", new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.62;
    hemi.diffuse = new Color3(0.45, 0.55, 0.6);
    const sun = new DirectionalLight("sun", new Vector3(0.4, -1, -0.35), this.scene);
    sun.intensity = 1.3;
    sun.diffuse = new Color3(1, 0.878, 0.733);
    sun.position = SUN_DIR.scale(90);
    this.shadow = new ShadowGenerator(1024, sun);
    this.shadow.filter = ShadowGenerator.FILTER_NONE;
    this.shadow.bias = 0.0008;
    this.shadow.forceBackFacesOnly = true;
    this.shadow.setDarkness(0.4);

    this.carRoot = new TransformNode("car", this.scene);
    this.carRoot.rotationQuaternion = Quaternion.Identity();
    this.buildTerrain();
    this.buildPosts();
    void this.buildCar();
    void this.buildScenery();
    this.buildDust();
    this.buildCheckpoint();
    this.session.assemble();
    this.snapCam();

    this.resize = new ResizeObserver(() => this.engine.resize());
    this.resize.observe(canvas.parentElement ?? canvas);
    this.engine.resize();
    let ready = false;
    this.engine.runRenderLoop(() => {
      const delta = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
      this.session.update(delta);
      this.sync(delta);
      this.scene.render();
      if (!ready) {
        ready = true;
        onReady();
      }
    });
  }

  dispose() {
    this.resize.disconnect();
    this.engine.stopRenderLoop();
    this.driveAudio.dispose();
    this.engine.dispose();
  }

  private snapCam() {
    this.sync(1);
  }

  private sync(delta: number) {
    const body = this.session.body;
    const interp = this.session.interp;
    if (body && interp) {
      this.carRoot.position.copyFrom(toView(interp.pos.x, interp.pos.y, interp.pos.z));
      const ori = interp.ori as { x: number; y: number; z: number; w: number } | undefined;
      if (ori && Number.isFinite(ori.w)) {
        chassisToView(ori, this.chassisView);
        this.carYup.set(this.chassisView.x, this.chassisView.y, this.chassisView.z, this.chassisView.w);
        this.carRoot.rotationQuaternion!.copyFrom(this.carYup);
      } else {
        this.carRoot.rotationQuaternion = Quaternion.FromEulerAngles(0, this.session.heading, 0);
      }
      const vehicle = this.session.vehicle;
      this.wheels.forEach((wheel, i) => {
        const sim = vehicle?.wheels[i];
        if (!sim) return;
        // vehicle.js / RenderCar: ride along local Y in mesh space.
        wheel.root.position.set(
          sim.cfg.pos[0] - toyCar.center[0],
          sim.cfg.pos[1] - toyCar.center[1] + sim.ridePos,
          sim.cfg.pos[2] - toyCar.center[2],
        );
        wheel.root.rotation.y = vehicle.getWheelTurnPos(sim);
        wheel.mesh.rotation.x = sim.spinPos;
      });
      this.carRoot.computeWorldMatrix(true);
      const look = toView(interp.pos.x + body.linVel.x * 0.17, interp.pos.y + body.linVel.y * 0.17, interp.pos.z + body.linVel.z * 0.17);
      Vector3.TransformNormalToRef(CAM_LOCAL, this.carRoot.getWorldMatrix(), this.camOff);
      look.addInPlace(this.camOff);
      const camDelta = this.session.reduced || delta >= 1 ? 1 : delta * 5;
      this.camPos.x = pull(this.camPos.x, look.x, camDelta);
      this.camPos.y = pull(this.camPos.y, look.y, camDelta);
      this.camPos.z = pull(this.camPos.z, look.z, camDelta);
      const ground = this.session.terrain.getContactRayZ(this.camPos.x, this.camPos.z).surfacePos.z + 0.35;
      if (this.camPos.y < ground) this.camPos.y = ground;
      const fromCar = this.camPos.subtract(this.carRoot.position);
      const dist = fromCar.length();
      if (dist < 2.2 && dist > 0.001) this.camPos.copyFrom(this.carRoot.position).addInPlace(fromCar.scale(2.2 / dist));
      this.camera.position.copyFrom(this.camPos);
      this.camera.setTarget(toView(interp.pos.x, interp.pos.y, interp.pos.z + 0.85));
      if (this.sky) this.sky.position.copyFrom(this.camera.position);
      if (this.dust) {
        const speed = Math.hypot(body.linVel.x, body.linVel.y);
        const handbraking = this.session.handbrake > 0.1;
        const skid = vehicle?.skidLevel ?? 0;
        const driftFactor = (handbraking ? 1.8 : 1.0) * (1 + skid * 2.5);
        this.dust.emitRate = speed > 2 ? Math.min(320, (speed - 2) * 55 * driftFactor) : 0;
      }
      if (this.brakeMat) {
        const on = this.session.brake > 0.1 || this.session.handbrake > 0.1;
        this.brakeMat.emissiveColor.set(on ? 1 : 0.16, on ? 0.04 : 0, 0);
      }
      const status = this.session.view.status;
      if (!this.session.muted) void this.driveAudio.unlock();
      this.driveAudio.update({
        muted: this.session.muted,
        paused: status === "paused" || status === "ready" || status === "finished",
        throttle: vehicle?.controller.output.throttle ?? 0,
        engineAngVel: vehicle?.engineAngVelSmoothed ?? 0,
        engineRpm: this.session.carConfig.engine.powerband[0].rpm,
        skidLevel: vehicle?.skidLevel ?? 0,
      });
    }
    this.syncCheckpoint(delta);
    this.bindShadow();
  }

  private bindShadow() {
    const map = this.shadow.getShadowMap();
    if (!this.terrainMat || !map) return;
    this.terrainMat.setTexture("shadowSampler", map);
    this.terrainMat.setMatrix("lightMatrix", this.shadow.getTransformMatrix());
    this.terrainMat.setFloat("hasShadow", 1);
  }

  private buildTerrain() {
    const map = this.session.terrain.source.maps.height;
    const step = Math.max(1, Math.floor(map.width / 256));
    const cols = Math.floor((map.width - 1) / step);
    const rows = Math.floor((map.height - 1) / step);
    const positions: number[] = [];
    const indices: number[] = [];
    const sample = (ix: number, iy: number) => map.data[ix + iy * map.width] * map.scale.z;
    for (let row = 0; row <= rows; row++) {
      const iy = Math.min(map.height - 1, row * step);
      for (let col = 0; col <= cols; col++) {
        const ix = Math.min(map.width - 1, col * step);
        const x = ix * map.scale.x;
        const y = iy * map.scale.y;
        positions.push(x, sample(ix, iy), y);
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const a = row * (cols + 1) + col;
        const b = a + 1;
        const c = a + cols + 1;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
    const mesh = new Mesh("terrain", this.scene);
    const vertex = new VertexData();
    vertex.positions = positions;
    vertex.indices = indices;
    vertex.normals = [];
    VertexData.ComputeNormals(positions, indices, vertex.normals);
    vertex.applyToMesh(mesh);
    mesh.material = this.terrainMaterial();
    mesh.receiveShadows = true;
    mesh.renderingGroupId = 1;
    this.buildSky();
  }

  private terrainMaterial() {
    const wrap = (url: string) => {
      const tex = new Texture(url, this.scene);
      tex.wrapU = Texture.WRAP_ADDRESSMODE;
      tex.wrapV = Texture.WRAP_ADDRESSMODE;
      return tex;
    };
    const pts: number[] = [];
    this.session.course.forEach(cp => pts.push(cp.pos[0], cp.pos[1]));
    while (pts.length < 32) pts.push(0, 0);
    const material = new ShaderMaterial("terrain", this.scene, { vertexSource: TERRAIN_VERT, fragmentSource: TERRAIN_FRAG }, {
      attributes: ["position", "normal"],
      uniforms: ["world", "worldView", "worldViewProjection", "vSunDir", "vFogColor", "fogDensity", "nCpts", "cpts", "gate", "first", "lightMatrix", "hasShadow"],
      samplers: ["tDirt", "tRock", "tDetail", "shadowSampler"],
    });
    material.setTexture("tDirt", wrap("/tr/textures/dirt.jpg"));
    material.setTexture("tRock", wrap("/tr/textures/rock.jpg"));
    material.setTexture("tDetail", wrap("/tr/textures/heightdetail1.jpg"));
    material.setVector3("vSunDir", SUN_DIR);
    material.setColor3("vFogColor", this.scene.fogColor);
    material.setFloat("fogDensity", this.scene.fogDensity);
    material.setInt("nCpts", this.session.course.length);
    material.setArray2("cpts", pts);
    material.setVector2("gate", { x: this.session.gate.pos[0], y: this.session.gate.pos[1] });
    material.setVector2("first", { x: this.session.course[0]?.pos[0] ?? 0, y: this.session.course[0]?.pos[1] ?? 0 });
    material.setFloat("hasShadow", 0);
    material.setMatrix("lightMatrix", this.shadow.getTransformMatrix());
    const shadowMap = this.shadow.getShadowMap();
    if (shadowMap) material.setTexture("shadowSampler", shadowMap);
    material.backFaceCulling = false;
    this.terrainMat = material;
    return material;
  }

  private buildSky() {
    const sky = MeshBuilder.CreateSphere("sky", { diameter: 4000, segments: 16, sideOrientation: Mesh.BACKSIDE }, this.scene);
    const material = new ShaderMaterial("sky", this.scene, { vertexSource: SKY_VERT, fragmentSource: SKY_FRAG }, {
      attributes: ["position"],
      uniforms: ["worldViewProjection"],
    });
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    sky.material = material;
    sky.renderingGroupId = 0;
    sky.applyFog = false;
    sky.alwaysSelectAsActiveMesh = true;
    sky.ignoreCameraMaxZ = true;
    sky.infiniteDistance = true;
    sky.isPickable = false;
    this.sky = sky;
  }

  private buildPosts() {
    void this.dressCourse();
  }

  private async dressCourse() {
    const arch = await this.loadScene("/tr/meshes/arch.r54.js", "/tr/textures/archtex.jpg", "arch");
    const chevron = await this.loadScene("/tr/meshes/chevron.r54.js", "/tr/textures/chevron.jpg", "chevron");
    if (arch) {
      arch.setEnabled(false);
      this.session.course.forEach((cp, i) => {
        const next = this.session.course[(i + 1) % this.session.course.length];
        const yaw = Math.atan2(next.pos[0] - cp.pos[0], next.pos[1] - cp.pos[1]);
        this.placeProp(arch, cp.pos[0], cp.pos[1], yaw, 1.15, `arch${i}`);
      });
    }
    if (chevron) {
      chevron.setEnabled(false);
      this.session.course.forEach((cp, i) => {
        const next = this.session.course[(i + 1) % this.session.course.length];
        const dx = next.pos[0] - cp.pos[0];
        const dy = next.pos[1] - cp.pos[1];
        const len = Math.hypot(dx, dy) || 1;
        const yaw = Math.atan2(dx, dy);
        const sideX = -dy / len * 6;
        const sideY = dx / len * 6;
        for (const t of [0.35, 0.7]) {
          this.placeProp(chevron, cp.pos[0] + dx * t + sideX, cp.pos[1] + dy * t + sideY, yaw, 1.35, `chevron${i}_${t}`);
        }
      });
      const hint = new TransformNode("cpHint", this.scene);
      const sign = chevron.createInstance("cpHintSign");
      sign.parent = hint;
      sign.scaling.setAll(2.2);
      this.cpHint = hint;
    }
  }

  private async buildScenery() {
    const tree = await this.loadScene("/tr/scenery/tree36/tree36.js", "/tr/scenery/tree36/diffuse.png", "tree", 0.5);
    const wood = await this.loadScene("/tr/scenery/wood_el1/wood_el1.js", "/tr/scenery/wood_el1/wood_elements1.jpg", "wood");
    if (tree) {
      tree.setEnabled(false);
      this.scatterTiles(tree, 32, 0.007, 0.78, 1.05, 1.9);
    }
    if (wood) {
      wood.setEnabled(false);
      this.scatterTiles(wood, 32, 0.0022, 0.68, 0.85, 1.4);
    }
  }

  private placeProp(source: Mesh, x: number, y: number, yaw: number, scale: number, name: string, lift = 0) {
    const z = this.session.terrain.getContact({ x, y }).surfacePos.z;
    const inst = source.createInstance(name);
    inst.position.copyFrom(toView(x, y, z + lift));
    inst.scaling.setAll(scale);
    inst.rotation.y = yaw;
    return inst;
  }

  private scatterTiles(source: Mesh, tileSize: number, density: number, minNormalZ: number, minScale: number, maxScale: number) {
    const xs = [this.session.gate.pos[0], ...this.session.course.map(cp => cp.pos[0])];
    const ys = [this.session.gate.pos[1], ...this.session.course.map(cp => cp.pos[1])];
    const pad = 240;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    let n = 0;
    for (let tx = Math.floor(minX / tileSize); tx <= Math.floor(maxX / tileSize); tx++) {
      for (let ty = Math.floor(minY / tileSize); ty <= Math.floor(maxY / tileSize); ty++) {
        const rnd = tileRng(tx, ty, source.name);
        const count = Math.floor(density * tileSize * tileSize);
        for (let i = 0; i < count; i++) {
          const x = (tx + rnd()) * tileSize;
          const y = (ty + rnd()) * tileSize;
          const contact = this.session.terrain.getContact({ x, y });
          if (contact.normal.z < minNormalZ) continue;
          if (this.pathClearance(x, y) < 12) continue;
          const inst = source.createInstance(`${source.name}${n++}`);
          inst.position.copyFrom(toView(x, y, contact.surfacePos.z));
          inst.scaling.setAll(minScale + (maxScale - minScale) * rnd());
          inst.rotation.y = rnd() * Math.PI * 2;
        }
      }
    }
  }

  private pathClearance(x: number, y: number) {
    const loop = this.session.course.map(cp => cp.pos);
    const extra = [this.session.gate.pos, loop[0] ?? this.session.gate.pos];
    let best = Infinity;
    const check = (a: number[], b: number[]) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len));
      const dist = Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
      if (dist < best) best = dist;
    };
    for (let i = 0; i < loop.length; i++) check(loop[i], loop[(i + 1) % loop.length]);
    check(extra[0], extra[1]);
    return best;
  }

  private async loadScene(url: string, textureUrl: string, name: string, alphaTest?: number) {
    const response = await fetch(url).catch(() => null);
    if (!response?.ok) return null;
    const parsed = parseThreeScene(await response.text());
    const mesh = new Mesh(name, this.scene);
    const vertex = new VertexData();
    vertex.positions = parsed.positions;
    vertex.indices = parsed.indices;
    vertex.normals = parsed.normals.length ? parsed.normals : [];
    vertex.uvs = parsed.uvs;
    if (!vertex.normals.length) VertexData.ComputeNormals(parsed.positions, parsed.indices, vertex.normals = []);
    vertex.applyToMesh(mesh);
    const material = new StandardMaterial(`${name}mat`, this.scene);
    const tex = new Texture(textureUrl, this.scene, false, false);
    material.diffuseTexture = tex;
    material.specularColor = new Color3(0.12, 0.12, 0.12);
    material.backFaceCulling = false;
    if (alphaTest !== undefined) {
      tex.hasAlpha = true;
      material.useAlphaFromDiffuseTexture = true;
      material.transparencyMode = Material.MATERIAL_ALPHATEST;
      material.alphaCutOff = alphaTest;
    }
    mesh.material = material;
    mesh.renderingGroupId = 1;
    mesh.receiveShadows = true;
    return mesh;
  }


  private buildCheckpoint() {
    const root = new TransformNode("cp", this.scene);
    const mat = new StandardMaterial("cpring", this.scene);
    mat.disableLighting = true;
    mat.diffuseColor = new Color3(0.18, 0.82, 0.22);
    mat.emissiveColor = new Color3(0.18, 0.82, 0.22);
    mat.specularColor = Color3.Black();
    mat.disableDepthWrite = true;
    mat.alpha = 0.55;
    mat.backFaceCulling = false;
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND;
    for (let i = 0; i < 3; i++) {
      const pivot = new TransformNode(`cpp${i}`, this.scene);
      pivot.parent = root;
      pivot.rotation.z = (Math.PI * 2 / 3) * i;
      const ring = MeshBuilder.CreateCylinder(`cpr${i}`, {
        height: 0.45,
        diameter: 32,
        tessellation: 32,
        cap: Mesh.NO_CAP,
        sideOrientation: Mesh.DOUBLESIDE,
      }, this.scene);
      ring.material = mat;
      ring.parent = pivot;
      ring.rotation.x = 1.1;
      ring.renderingGroupId = 1;
      ring.applyFog = false;
    }
    this.cpRing = root;
    const first = this.session.course[0];
    if (first) root.position.copyFrom(toView(first.pos[0], first.pos[1], first.pos[2] + 2));
  }

  private syncCheckpoint(delta: number) {
    const ring = this.cpRing;
    if (!ring) return;
    const next = this.session.nextCheckpoint;
    if (!next) {
      ring.setEnabled(false);
      this.cpHint?.setEnabled(false);
      return;
    }
    ring.setEnabled(true);
    ring.rotation.y += delta * 3;
    const target = toView(next.pos[0], next.pos[1], next.pos[2] + 2);
    const snap = this.session.view.checkpoint === 0 && this.session.view.time < 0.05 ? 1 : Math.min(1, delta * 2);
    ring.position.x = pull(ring.position.x, target.x, snap);
    ring.position.y = pull(ring.position.y, target.y, snap);
    ring.position.z = pull(ring.position.z, target.z, snap);
    const hint = this.cpHint;
    if (hint) {
      hint.setEnabled(true);
      hint.position.copyFrom(ring.position);
      hint.position.y += 3.2;
      const i = this.session.view.checkpoint;
      const after = this.session.course[(i + 1) % this.session.course.length];
      if (after) hint.rotation.y = Math.atan2(after.pos[0] - next.pos[0], after.pos[1] - next.pos[1]);
    }
  }

  private buildDust() {
    const emitter = MeshBuilder.CreateBox("dustEmit", { size: 0.02 }, this.scene);
    emitter.parent = this.carRoot;
    emitter.position.set(0, 0.05, -1.2);
    emitter.isVisible = false;
    const dust = new ParticleSystem("dust", 500, this.scene);
    dust.particleTexture = new Texture("/tr/textures/dust.png", this.scene);
    dust.emitter = emitter;
    dust.isLocal = true;
    dust.minEmitBox = new Vector3(-0.7, 0, -0.35);
    dust.maxEmitBox = new Vector3(0.7, 0.2, 0.25);
    dust.color1 = new Color4(0.66, 0.55, 0.38, 0.5);
    dust.color2 = new Color4(0.48, 0.4, 0.28, 0.28);
    dust.colorDead = new Color4(0.35, 0.3, 0.22, 0);
    dust.minSize = 0.7;
    dust.maxSize = 2.2;
    dust.minLifeTime = 0.35;
    dust.maxLifeTime = 1.05;
    dust.emitRate = 0;
    dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    dust.gravity = new Vector3(0, -1.4, 0);
    dust.direction1 = new Vector3(-0.5, 0.25, -1.3);
    dust.direction2 = new Vector3(0.5, 0.7, -0.3);
    dust.minEmitPower = 0.4;
    dust.maxEmitPower = 1.6;
    dust.updateSpeed = 0.012;
    dust.renderingGroupId = 1;
    dust.start();
    this.dust = dust;
  }

  private async buildCar() {
    const bodyMesh = await this.loadMesh("/tr/meshes/car1-body.json", "/tr/meshes/car1-diff.jpg", "body");
    const wheelMesh = await this.loadMesh("/tr/meshes/car1-wheel.json", "/tr/meshes/car1-diff.jpg", "wheel");
    const body = bodyMesh ?? MeshBuilder.CreateBox("body", { width: 1.7, height: 1.1, depth: 3.4 }, this.scene);
    this.solidCar(body);
    this.shadow.addShadowCaster(body);
    body.parent = this.carRoot;
    body.position.set(-toyCar.center[0], -toyCar.center[1], -toyCar.center[2]);
    // Mirror the body only. Flipping atlas U remaps the rear glass onto the wheel island.
    body.scaling.x = -1;
    toyCar.wheels.forEach((cfg, i) => {
      const root = new TransformNode(`wheel${i}`, this.scene);
      root.parent = this.carRoot;
      root.position.set(cfg.pos[0] - toyCar.center[0], cfg.pos[1] - toyCar.center[1], cfg.pos[2] - toyCar.center[2]);
      const mesh = wheelMesh ? wheelMesh.clone(`wheelmesh${i}`)! : MeshBuilder.CreateCylinder(`w${i}`, { height: 0.22, diameter: cfg.radius * 2 }, this.scene);
      this.solidCar(mesh);
      this.shadow.addShadowCaster(mesh);
      mesh.parent = root;
      if (!wheelMesh) mesh.rotation.z = Math.PI / 2;
      this.wheels.push({ root, mesh });
    });
    if (wheelMesh) {
      wheelMesh.setEnabled(false);
      wheelMesh.isVisible = false;
    }
    this.brakeMat = new StandardMaterial("brake", this.scene);
    this.brakeMat.diffuseColor = new Color3(0.12, 0.01, 0.01);
    this.brakeMat.emissiveColor = new Color3(0.16, 0, 0);
    this.brakeMat.specularColor = new Color3(0, 0, 0);
    for (const x of [-0.42, 0.42]) {
      const lamp = MeshBuilder.CreateBox(`brake${x}`, { width: 0.16, height: 0.04, depth: 0.08 }, this.scene);
      lamp.parent = this.carRoot;
      lamp.position.set(x, 0.42, -1.55);
      lamp.material = this.brakeMat;
      lamp.renderingGroupId = 1;
      lamp.isPickable = false;
    }
  }

  private async loadMesh(url: string, textureUrl: string, name: string) {
    const response = await fetch(url).catch(() => null);
    if (!response?.ok) return null;
    const parsed = parseThreeJson(await response.text());
    const mesh = new Mesh(name, this.scene);
    const vertex = new VertexData();
    vertex.positions = parsed.positions;
    vertex.indices = parsed.indices;
    vertex.normals = parsed.normals.length ? parsed.normals : [];
    vertex.uvs = parsed.uvs;
    if (!vertex.normals.length) VertexData.ComputeNormals(parsed.positions, parsed.indices, vertex.normals = []);
    vertex.applyToMesh(mesh);
    const material = new StandardMaterial(`${name}mat`, this.scene);
    material.diffuseTexture = new Texture(textureUrl, this.scene, false, false);
    material.specularColor = new Color3(0.2, 0.2, 0.2);
    material.backFaceCulling = false;
    mesh.material = material;
    mesh.refreshBoundingInfo();
    return mesh;
  }

  private solidCar(mesh: Mesh) {
    mesh.renderingGroupId = 1;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.refreshBoundingInfo();
    if (mesh.material) (mesh.material as StandardMaterial).backFaceCulling = false;
  }
}

const TERRAIN_VERT = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 world;
uniform mat4 worldView;
uniform mat4 worldViewProjection;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewPos;
void main() {
  vec4 worldPos = world * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal = normalize((world * vec4(normal, 0.0)).xyz);
  vViewPos = (worldView * vec4(position, 1.0)).xyz;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

const TERRAIN_FRAG = `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewPos;
uniform sampler2D tDirt;
uniform sampler2D tRock;
uniform sampler2D tDetail;
uniform vec3 vSunDir;
uniform vec3 vFogColor;
uniform float fogDensity;
uniform vec2 cpts[16];
uniform int nCpts;
uniform vec2 gate;
uniform vec2 first;
uniform mat4 lightMatrix;
uniform sampler2D shadowSampler;
uniform float hasShadow;
float distSeg(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  return length(p - (a + ab * t));
}
float pathDist(vec2 p) {
  float best = distSeg(p, gate, first);
  for (int i = 0; i < 16; i++) {
    if (i >= nCpts) break;
    int j = i + 1 < nCpts ? i + 1 : 0;
    best = min(best, distSeg(p, cpts[i], cpts[j]));
  }
  return best;
}
void main() {
  vec3 n = normalize(vNormal);
  vec2 xz = vWorldPos.xz;
  vec3 dirt = texture2D(tDirt, xz / 4.0).rgb;
  vec3 rock = texture2D(tRock, xz / 32.0).rgb;
  float detail = texture2D(tDetail, xz / 14.0).g;
  float vegMix = clamp(n.y * 0.65 + 0.35, 0.0, 1.0);
  vec3 veggie = mix(vec3(0.16, 0.22, 0.07), vec3(0.45, 0.52, 0.22), vegMix);
  veggie *= 0.9 + detail * 0.25;
  dirt *= 0.82 + detail * 0.32;
  float rockMix = 1.0 - smoothstep(0.78, 0.96, n.y + (detail - 0.5) * 0.15);
  float trackMix = 1.0 - smoothstep(4.5, 9.5, pathDist(xz));
  vec3 color = mix(mix(veggie, rock, rockMix), dirt, trackMix);
  color *= max(0.32, dot(n, vSunDir));
  if (hasShadow > 0.5) {
    vec4 lp = lightMatrix * vec4(vWorldPos, 1.0);
    vec3 clip = lp.xyz / max(lp.w, 0.0001);
    vec2 suv = clip.xy * 0.5 + 0.5;
    if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0 && clip.z > 0.0 && clip.z < 1.0) {
      float closest = texture2D(shadowSampler, suv).r;
      if (closest < clip.z - 0.003) color *= 0.42;
    }
  }
  float fog = 1.0 - exp(-length(vViewPos) * fogDensity);
  gl_FragColor = vec4(mix(color, vFogColor, clamp(fog, 0.0, 1.0)), 1.0);
}
`;

const SKY_VERT = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

const SKY_FRAG = `
precision highp float;
varying vec3 vDir;
void main() {
  float h = normalize(vDir).y;
  vec3 zenith = vec3(0.52, 0.70, 0.90);
  vec3 horizon = vec3(0.86, 0.91, 0.97);
  gl_FragColor = vec4(mix(horizon, zenith, smoothstep(-0.08, 0.55, h)), 1.0);
}
`;
