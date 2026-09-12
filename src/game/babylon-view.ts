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
  DynamicTexture,
  Engine,
  FreeCamera,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Quaternion,
  RawTexture,
  Scene,
  ShaderMaterial,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  VertexData,
} from "@babylonjs/core";
import { originalArt } from "./original-art";
import { toyCar } from "./car";
import type { RallySession } from "./session";
import { DriveAudio } from "./drive-audio";
import { chassisToView } from "./chassis-view";
import util from "../upstream/util.js";
import { Vector3 as PhysicsVector, Quaternion as ThreeQuat } from "three";

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
  private dust: ParticleSystem | null = null;
  private checkpointSigns: DynamicTexture[] = [];
  private displayedCheckpoint = -1;
  private shadow: ShadowGenerator;
  private terrainMat: ShaderMaterial | null = null;
  private resize: ResizeObserver;
  private driveAudio = new DriveAudio();
  private stopAudio: () => void;
  private art: ReturnType<typeof originalArt>;
  private brakeMat: StandardMaterial | null = null;

  constructor(canvas: HTMLCanvasElement, private session: RallySession, onReady: () => void) {
    this.stopAudio = session.subscribe(() => {
      if (["paused", "ready", "finished"].includes(session.view.status)) this.driveAudio.silence();
    });
    this.engine = new Engine(canvas, true);
    this.engine.renderEvenInBackground = false;
    this.scene = new Scene(this.engine);
    this.art = originalArt(this.scene);
    this.scene.clearColor = new Color4(0.867, 0.933, 1, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.00045;
    this.scene.fogColor = new Color3(0.88, 0.86, 0.75);
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
    this.stopAudio();
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
          -(sim.cfg.pos[0] - toyCar.center[0]),
          sim.cfg.pos[1] - toyCar.center[1] + sim.ridePos,
          sim.cfg.pos[2] - toyCar.center[2],
        );
        wheel.root.rotation.y = -vehicle.getWheelTurnPos(sim);
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
    this.syncCheckpoint();
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
    const minX = Math.min(0, Math.floor((Math.min(...this.session.course.map(cp => cp.pos[0]), this.session.gate.pos[0]) - 128) / map.scale.x));
    const minY = Math.min(0, Math.floor((Math.min(...this.session.course.map(cp => cp.pos[1]), this.session.gate.pos[1]) - 128) / map.scale.y));
    const cols = Math.ceil((map.width - 1 - minX) / step);
    const rows = Math.ceil((map.height - 1 - minY) / step);
    const positions: number[] = [];
    const indices: number[] = [];
    const sample = (ix: number, iy: number) => map.data[((ix % map.width + map.width) % map.width) + ((iy % map.height + map.height) % map.height) * map.width] * map.scale.z;
    for (let row = 0; row <= rows; row++) {
      const iy = minY + row * step;
      for (let col = 0; col <= cols; col++) {
        const ix = minX + col * step;
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
    this.buildMountains();
  }

  private terrainMaterial() {
    const wrap = (name: string, color: number[], contrast: number) => {
      const size = 128;
      const pixels = new Uint8Array(size * size * 3);
      for (let i = 0; i < size * size; i++) {
        let hash = Math.imul(i ^ (i >>> 8), 0x45d9f3b);
        hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
        const grain = ((hash >>> 0) / 4294967296 - .5) * contrast;
        for (let c = 0; c < 3; c++) pixels[i * 3 + c] = Math.max(0, Math.min(255, color[c] + grain));
      }
      const texture = RawTexture.CreateRGBTexture(pixels, size, size, this.scene, true);
      texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
      material.setTexture(name, texture);
    };
    const pts: number[] = [];
    this.session.course.forEach(cp => pts.push(cp.pos[0], cp.pos[1]));
    while (pts.length < 32) pts.push(0, 0);
    const material = new ShaderMaterial("terrain", this.scene, { vertexSource: TERRAIN_VERT, fragmentSource: TERRAIN_FRAG }, {
      attributes: ["position", "normal"],
      uniforms: ["world", "worldView", "worldViewProjection", "vSunDir", "vFogColor", "fogDensity", "nCpts", "cpts", "gate", "first", "lightMatrix", "hasShadow"],
      samplers: ["tDirt", "tRock", "tDetail", "shadowSampler"],
    });
    wrap("tDirt", [192,158,115], 28);
    wrap("tRock", [118,142,145], 18);
    wrap("tDetail", [128,128,128], 24);
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

  private buildMountains() {
    const cx = this.session.course.reduce((sum, cp) => sum + cp.pos[0], 0) / this.session.course.length;
    const cy = this.session.course.reduce((sum, cp) => sum + cp.pos[1], 0) / this.session.course.length;
    const stone = new StandardMaterial("distant blue slate", this.scene);
    stone.diffuseColor = Color3.FromHexString("#647F83"); stone.specularColor = Color3.Black();
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI * 2 / 16;
      const radius = 820 + Math.sin(i * 4.1) * 100;
      const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
      const height = 170 + (Math.sin(i * 2.7) + 1) * 85;
      const base = this.session.terrain.getContact({x,y}).surfacePos.z - 12;
      const positions: number[]=[],indices: number[]=[],colors: number[]=[];
      for(let level=0;level<4;level++)for(let j=0;j<12;j++) {
        const a=j*Math.PI/6, taper=[1,.78,.5,.22][level];
        const ridge=1+.22*Math.sin(j*7.3+i*2.1);
        positions.push(x+Math.cos(a)*250*taper*ridge+level*18*Math.sin(i),
          base+height*(level/3)*(1+.23*Math.sin(j*1.1+i)),
          y+Math.sin(a)*160*taper*ridge);
        const pale=level===3?1:.78+level*.06;
        colors.push(pale,pale+.025,pale+.03,1);
      }
      for(let level=0;level<3;level++)for(let j=0;j<12;j++) {
        const a=level*12+j,b=level*12+(j+1)%12;indices.push(a,b,a+12,b,b+12,a+12);
      }
      for(let j=1;j<11;j++) indices.push(36,36+j,36+j+1);
      const peak=new Mesh(`weathered ridge ${i}`,this.scene), data=new VertexData();
      data.positions=positions;data.indices=indices;data.colors=colors;data.normals=[];
      VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(peak);
      peak.material=stone;stone.backFaceCulling=false;peak.renderingGroupId=1;
    }
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
  }

  private buildPosts() {
    void this.dressCourse();
  }

  private dressCourse() {
    const arch = this.art.arch();
    const chevron = this.art.chevron();
    if (this.scene.isDisposed) return;
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

    }
  }

  private buildScenery() {
    const tree = this.art.tree();
    const wood = this.art.fence();
    if (this.scene.isDisposed) return;
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
        const tileContacts: Array<PhysicsVector & { radius: number }> = [];
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
          // Simple trunk/rail proxies feed the existing Trigger Rally contact solver.
          const points = [-0.6, 0, 0.6].map(offset => {
            const xOffset = source.name === "wood" ? offset * inst.scaling.x * Math.cos(inst.rotation.y) : 0;
            const yOffset = source.name === "wood" ? offset * inst.scaling.x * Math.sin(inst.rotation.y) : 0;
            return Object.assign(new PhysicsVector(x + xOffset, y + yOffset, contact.surfacePos.z + (0.5 + (source.name === "tree" ? offset + 0.6 : 0)) * inst.scaling.y), { radius: (source.name === "tree" ? 0.45 : 0.35) * inst.scaling.x });
          });
          tileContacts.push(...points);
        }
        if (tileContacts.length) this.session.addSceneryCollision(tileContacts);
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

  private buildCheckpoint() {
    this.session.course.forEach((cp, i) => {
      const sign = MeshBuilder.CreatePlane(`checkpoint ${i + 1} sign`, {width: 8, height: 1.8}, this.scene);
      sign.position.copyFrom(toView(cp.pos[0], cp.pos[1], cp.pos[2] + 6.7));
      sign.billboardMode = Mesh.BILLBOARDMODE_Y;
      sign.renderingGroupId = 1;
      const texture = new DynamicTexture(`checkpoint ${i + 1}`, {width: 512, height: 128}, this.scene, false);
      const material = new StandardMaterial(`checkpoint ${i + 1} label`, this.scene);
      material.diffuseTexture = texture;
      material.disableLighting = true;
      material.emissiveColor = Color3.White();
      material.backFaceCulling = false;
      sign.material = material;
      this.checkpointSigns.push(texture);
    });
    this.syncCheckpoint();
  }

  private syncCheckpoint() {
    const current = this.session.view.checkpoint;
    if (current === this.displayedCheckpoint) return;
    this.displayedCheckpoint = current;
    this.checkpointSigns.forEach((texture, i) => {
      const state = i < current ? 'DONE' : i === current ? 'NEXT' : 'CHECKPOINT';
      const background = i < current ? '#347253' : i === current ? '#a65d18' : '#243e43';
      texture.drawText(`${String(i + 1).padStart(2, '0')}  ${state}`, null, 84, 'bold 52px sans-serif', '#ffffff', background, true);
    });
  }

  private buildDust() {
    const emitter = MeshBuilder.CreateBox("dustEmit", { size: 0.02 }, this.scene);
    emitter.parent = this.carRoot;
    emitter.position.set(0, 0.05, -1.2);
    emitter.isVisible = false;
    const dust = new ParticleSystem("dust", 500, this.scene);
    const dustTexture = new DynamicTexture("soft dust", 64, this.scene, false);
    const context = dustTexture.getContext();
    const gradient = context.createRadialGradient(32,32,0,32,32,32);
    gradient.addColorStop(0,"rgba(255,255,255,.55)"); gradient.addColorStop(1,"rgba(255,255,255,0)");
    context.fillStyle=gradient;context.fillRect(0,0,64,64);dustTexture.update();
    dust.particleTexture = dustTexture;
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

  private buildCar() {
    const bodyMesh = this.art.car();
    const wheelMesh = this.art.wheel();
    if (this.scene.isDisposed) return;
    const body = bodyMesh;
    this.solidCar(body);
    this.shadow.addShadowCaster(body);
    body.parent = this.carRoot;
    body.position.set(-toyCar.center[0], -toyCar.center[1], -toyCar.center[2]);
    // Local X reflection matches the existing physics-to-view conversion.
    body.scaling.x = -1;
    const badge = MeshBuilder.CreatePlane("Grove Rally badge", { width: 1.25, height: 0.3 }, this.scene);
    badge.parent = this.carRoot;
    badge.position.set(0, 0.27, -1.695);
    badge.rotation.x = 0;
    const badgeTexture = new DynamicTexture("Grove Rally", { width: 512, height: 128 }, this.scene, true);
    badgeTexture.drawText("Grove Rally", null, 88, "bold 68px sans-serif", "#f5f4da", "#101914", true);
    const badgeMaterial = new StandardMaterial("rally badge", this.scene);
    badgeMaterial.diffuseTexture = badgeTexture;
    badgeMaterial.emissiveColor = Color3.White();
    badgeMaterial.disableLighting = true;
    badge.material = badgeMaterial;
    badge.renderingGroupId = 1;
    toyCar.wheels.forEach((cfg, i) => {
      const root = new TransformNode(`wheel${i}`, this.scene);
      root.parent = this.carRoot;
      root.position.set(-(cfg.pos[0] - toyCar.center[0]), cfg.pos[1] - toyCar.center[1], cfg.pos[2] - toyCar.center[2]);
      const mesh = wheelMesh.clone(`wheelmesh${i}`)!;
      this.solidCar(mesh);
      this.shadow.addShadowCaster(mesh);
      mesh.parent = root;

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
  float coarse = texture2D(tDetail, xz / 53.0).r;
  float grit = texture2D(tDetail, xz / 1.5).r;
  float gx = texture2D(tDetail, xz / 1.5 + vec2(.0078,0.0)).r - grit;
  float gz = texture2D(tDetail, xz / 1.5 + vec2(0.0,.0078)).r - grit;
  vec3 rock = texture2D(tRock, xz / 32.0).rgb;
  float detail = texture2D(tDetail, xz / 14.0).g;
  float vegMix = clamp(n.y * 0.65 + 0.35, 0.0, 1.0);
  vec3 veggie = mix(vec3(0.19, 0.34, 0.27), vec3(0.49, 0.61, 0.39), vegMix);
  veggie *= 0.72 + coarse * 0.55 + detail * .12;
  dirt *= 0.67 + coarse * .30 + detail * .28 + grit * .12;
  float rockMix = 1.0 - smoothstep(0.78, 0.96, n.y + (detail - 0.5) * 0.15);
  float roadDistance = pathDist(xz);
  float trackMix = 1.0 - smoothstep(4.5, 9.5, roadDistance + (coarse-.5)*2.0);
  dirt *= 1.0 - .10 * (1.0 - smoothstep(.18, .6, abs(roadDistance - 1.7)));
  vec3 color = mix(mix(veggie, rock, rockMix), dirt, trackMix);
  vec3 groundNormal = normalize(n + vec3(gx, 0.0, gz) * trackMix * 1.5);
  color *= .32 + .68 * max(0.0, dot(groundNormal, vSunDir));
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
  vec3 zenith = vec3(0.29, 0.56, 0.66);
  vec3 horizon = vec3(0.93, 0.85, 0.68);
  gl_FragColor = vec4(mix(horizon, zenith, smoothstep(-0.08, 0.55, h)), 1.0);
}
`;
