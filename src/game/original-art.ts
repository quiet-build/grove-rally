import { Color3, Mesh, MeshBuilder, StandardMaterial, VertexData, type Scene } from '@babylonjs/core';

/** Original geometry, built in metres in the existing car/scenery coordinate frame. */
export function originalArt(scene: Scene) {
  const paint = (name: string, hex: string) => {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = Color3.FromHexString(hex);
    mat.specularColor = new Color3(.12,.15,.16);
    return mat;
  };
  const teal = paint('petrol enamel', '#24636A');
  const cream = paint('ivory enamel', '#E5E0D1');
  const orange = paint('signal orange', '#F09A45');
  const glass = paint('smoked glass', '#152D3C');
  const rubber = paint('graphite rubber', '#1D2529');
  const alloy = paint('wheel alloy', '#91A7A8');
  const bark = paint('pine bark', '#5B5145');
  const pine = [paint('pine shade','#1D4D47'),paint('pine green','#326D59'),paint('pine tips','#57846A')];
  teal.specularColor.set(.65,.68,.66); teal.specularPower=96;
  cream.specularColor.set(.45,.45,.42); cream.specularPower=72;
  glass.specularColor.set(.85,.92,1); glass.specularPower=180;
  rubber.specularColor.set(.025,.025,.025); rubber.specularPower=8;
  alloy.specularColor.set(.8,.84,.88); alloy.specularPower=120;
  bark.specularColor.set(.025,.02,.015);
  pine.forEach(material => material.specularColor.set(.035,.05,.025));
  const surface = (name: string, positions: number[], indices: number[], material: StandardMaterial) => {
    const mesh = new Mesh(name,scene), data = new VertexData();
    data.positions=positions; data.indices=indices; data.normals=[];
    data.uvs=positions.flatMap((_,i)=>i%3===0?[positions[i],positions[i+2]]:[]);
    VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(mesh);
    mesh.material=material; return mesh;
  };
  const bodyShell = () => {
    const positions: number[]=[], indices: number[]=[];
    const stations=[-1.68,-1.55,-1.42,-1.25,-1.15,-1.05,-.88,-.75,-.5,.5,.75,.88,1.05,1.15,1.25,1.42,1.55,1.68];
    for(const z of stations) {
      const end=Math.abs(z)/1.68, width=.78-.10*Math.pow(end,8);
      const dz=Math.min(Math.abs(z-1.15),Math.abs(z+1.15));
      const bottom=dz<.4?.32+Math.sqrt(.16-dz*dz):.27;
      const top=.79-.10*Math.pow(end,5);
      for(const [x,y] of [[-width*.92,bottom],[-width,bottom+.025],[-width,top-.07],[-width*.88,top],
        [width*.88,top],[width,top-.07],[width,bottom+.025],[width*.92,bottom]]) positions.push(x,y,z);
    }
    for(let j=0;j<stations.length-1;j++)for(let i=0;i<8;i++) {
      const a=j*8+i,b=j*8+(i+1)%8,c=a+8,d=b+8; indices.push(a,b,c,b,d,c);
    }
    for(let i=1;i<7;i++){indices.push(0,i+1,i);const b=(stations.length-1)*8;indices.push(b,b+i,b+i+1);}
    return surface('continuous wheel-arch body',positions,indices,teal);
  };
  const wheelArch = (side: number, z: number) => {
    const positions: number[]=[],indices: number[]=[];
    for(let i=0;i<=18;i++)for(const r of [.372,.406]) {
      const a=i*Math.PI/18; positions.push(side*.789,.32+Math.sin(a)*r,z+Math.cos(a)*r);
    }
    for(let i=0;i<18;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    const mesh=surface('wheel arch trim',positions,indices,rubber);rubber.backFaceCulling=false;return mesh;
  };
  const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
    mesh.position.set(x,y,z); mesh.material=material; return mesh;
  };
  const merge = (name: string, parts: Mesh[]) => {
    const mesh = Mesh.MergeMeshes(parts,true,true,undefined,false,true)!;
    mesh.name=name; mesh.renderingGroupId=1; return mesh;
  };
  const cabin = () => {
    const mesh = new Mesh('sloping glass cabin', scene);
    const data = new VertexData();
    data.positions = [-.66,.76,-1.03, .66,.76,-1.03, .66,.76,.67, -.66,.76,.67,
      -.57,1.26,-.72, .57,1.26,-.72, .57,1.26,.25, -.57,1.26,.25];
    data.indices = [0,4,5,0,5,1, 1,5,6,1,6,2, 2,6,7,2,7,3, 3,7,4,3,4,0, 4,7,6,4,6,5];
    // Match the UV attribute supplied by the primitive body parts before merging.
    data.uvs = [0,0, 1,0, 1,1, 0,1, 0,0, 1,0, 1,1, 0,1];
    data.normals=[];VertexData.ComputeNormals(data.positions,data.indices,data.normals);data.applyToMesh(mesh);
    mesh.material=glass;glass.backFaceCulling=false;return mesh;
  };
  const car = () => {
    const parts = [
      bodyShell(),
      cabin(),
      box('ivory roof',1.22,.075,1.06,0,1.29,-.235,cream),
      box('rear bumper',1.6,.13,.17,0,.3,-1.73,rubber),
      box('front bumper',1.6,.13,.17,0,.3,1.73,rubber),
      box('bonnet stripe',.15,.012,.55,0,.79,.85,cream),
      box('roof stripe',.19,.012,1.06,0,1.334,-.235,orange),
      box('rear spoiler',1.62,.055,.22,0,1.06,-1.40,teal),
    ];
    for (const side of [-1,1]) {
      for(const z of [-1.15,1.15]) parts.push(wheelArch(side,z));
      parts.push(box('window pillar',.045,.46,.065,side*.615,1.0,-.28,teal));
      parts.push(box('door handle',.025,.035,.14,side*.785,.71,-.32,rubber));
      parts.push(box('door stripe',.018,.13,.95,side*.785,.50,0,cream));
      parts.push(box('mirror',.19,.10,.22,side*.79,1.0,.35,teal));
      parts.push(box('headlight',.35,.15,.035,side*.52,.62,1.70,cream));
      parts.push(box('spoiler support',.07,.23,.08,side*.53,.88,-1.45,rubber));
    }
    return merge('body',parts);
  };
  const wheel = () => {
    const tire = MeshBuilder.CreateCylinder('tire',{height:.23,diameter:.66,tessellation:32},scene);
    tire.rotation.z=Math.PI/2; tire.material=rubber;
    const hub = MeshBuilder.CreateCylinder('hub',{height:.244,diameter:.39,tessellation:24},scene);
    hub.rotation.z=Math.PI/2; hub.material=alloy;
    const parts=[tire,hub];
    for(const side of [-1,1]) for(let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      const slot=box('rim opening',.008,.10,.07,side*.125,Math.cos(a)*.13,Math.sin(a)*.13,rubber);
      slot.rotation.x=a;parts.push(slot);
    }
    return merge('wheel',parts);
  };
  const tree = () => {
    const trunk=MeshBuilder.CreateCylinder('trunk',{height:2.7,diameter:.55,tessellation:6},scene);
    trunk.position.y=1.35;trunk.material=bark;
    const parts=[trunk];
    for(let layer=0;layer<7;layer++) {
      const y=1.5+layer*.58, radius=1.72*(1-layer/8);
      const positions: number[]=[],indices: number[]=[];
      positions.push(.12*Math.sin(layer*2),y+1.3,0);
      for(let j=0;j<12;j++) {
        const a=j*Math.PI/6+layer*1.7;
        const r=radius*(.72+.28*Math.sin(j*7.1+layer*3.7)**2);
        positions.push(Math.cos(a)*r,y+.18*Math.sin(j*4+layer),Math.sin(a)*r);
      }
      for(let j=0;j<12;j++)indices.push(0,j+1,(j+1)%12+1);
      const crown=surface('irregular pine boughs',positions,indices,pine[layer%3]);
      crown.material!.backFaceCulling=false;parts.push(crown);
    }
    return merge('tree',parts);
  };
  const fence = () => merge('wood',[
    box('rail',1.9,.16,.15,0,.7,0,cream),box('rail',1.9,.16,.15,0,1.1,0,cream),
    box('post',.16,1.35,.18,-.85,.675,0,bark),box('post',.16,1.35,.18,.85,.675,0,bark),
  ]);
  const arch = () => merge('arch',[
    box('gate upright',.38,5,.45,-6,2.5,0,teal),box('gate upright',.38,5,.45,6,2.5,0,teal),
    box('gate beam',12.5,.52,.5,0,4.8,0,cream),
    ...[-1,1].map(side=>box('orange gate band',.43,1.1,.49,side*6,1.6,0,orange)),
  ]);
  const chevron = () => {
    const parts=[box('direction sign',2,1,.16,0,1.8,0,teal),box('sign pole',.13,1.5,.13,0,.75,0,bark)];
    for(const sign of [-1,1]) {
      const stripe=box('arrow',.7,.15,.18,0,1.8+sign*.2,-.015,cream);
      stripe.rotation.z=sign*Math.PI/4;parts.push(stripe);
    }
    return merge('chevron',parts);
  };
  return {car,wheel,tree,fence,arch,chevron};
}
