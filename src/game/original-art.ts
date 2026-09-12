import { Color3, Mesh, MeshBuilder, StandardMaterial, VertexData, type Scene } from '@babylonjs/core';

/** Original geometry, built in metres in the existing car/scenery coordinate frame. */
export function originalArt(scene: Scene) {
  const paint = (name: string, hex: string) => {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = Color3.FromHexString(hex);
    mat.specularColor = new Color3(.12,.15,.16);
    return mat;
  };
  const teal = paint('petrol enamel', '#187F88');
  const cream = paint('ivory enamel', '#F3E8CB');
  const orange = paint('signal orange', '#F09A45');
  const glass = paint('smoked glass', '#152D3C');
  const rubber = paint('graphite rubber', '#1D2529');
  const alloy = paint('wheel alloy', '#91A7A8');
  const bark = paint('pine bark', '#5B5145');
  const pine = [paint('pine shade','#1D4D47'),paint('pine green','#326D59'),paint('pine tips','#57846A')];
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
      box('lower body',1.50,.44,3.36,0,.47,0,teal),
      box('hood',1.54,.16,1.04,0,.76,1.05,teal),
      cabin(),
      box('ivory roof',1.22,.075,1.06,0,1.29,-.235,cream),
      box('rear bumper',1.6,.13,.17,0,.3,-1.73,rubber),
      box('front bumper',1.6,.13,.17,0,.3,1.73,rubber),
      box('hood stripe',.19,.012,1.05,0,.847,1.05,cream),
      box('roof stripe',.19,.012,1.06,0,1.334,-.235,orange),
      box('rear spoiler',1.74,.075,.30,0,1.02,-1.45,cream),
    ];
    for (const side of [-1,1]) {
      parts.push(box('door stripe',.018,.13,1.8,side*.758,.53,-.05,cream));
      parts.push(box('mirror',.19,.10,.22,side*.79,1.0,.35,teal));
      parts.push(box('headlight',.35,.15,.035,side*.52,.62,1.70,cream));
      parts.push(box('spoiler support',.07,.23,.08,side*.53,.88,-1.45,rubber));
    }
    return merge('body',parts);
  };
  const wheel = () => {
    const tire = MeshBuilder.CreateCylinder('tire',{height:.23,diameter:.66,tessellation:16},scene);
    tire.rotation.z=Math.PI/2; tire.material=rubber;
    const hub = MeshBuilder.CreateCylinder('hub',{height:.244,diameter:.39,tessellation:8},scene);
    hub.rotation.z=Math.PI/2; hub.material=alloy;
    return merge('wheel',[tire,hub]);
  };
  const tree = () => {
    const trunk=MeshBuilder.CreateCylinder('trunk',{height:2.7,diameter:.55,tessellation:6},scene);
    trunk.position.y=1.35;trunk.material=bark;
    const parts=[trunk];
    for(let i=0;i<3;i++) {
      const crown=MeshBuilder.CreateCylinder('pine crown',{height:3.2-i*.35,diameterTop:0,diameterBottom:3.7-i*.85,tessellation:7},scene);
      crown.position.y=2.8+i*1.35;crown.rotation.y=i*.4;crown.material=pine[i];parts.push(crown);
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
