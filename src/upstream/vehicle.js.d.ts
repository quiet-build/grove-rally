declare const vehicle: {
  Vehicle: new (sim: unknown, config: unknown) => {
    body: {
      pos: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
      ori: { x: number; y: number; z: number; w: number; set: (x: number, y: number, z: number, w: number) => { normalize: () => void }; normalize: () => void };
      linVel: { x: number; y: number; z: number };
      angVel: { x: number; y: number; z: number };
      oriMat: { elements: number[] };
      interp?: { pos: { x: number; y: number; z: number }; ori: { x: number; y: number; z: number; w: number } };
      reset: () => void;
      updateMatrices: () => void;
      sim: { time: number; timeStep: number };
    };
    controller: { input: { throttle: number; brake: number; handbrake: number; turn: number }; output: unknown };
    disabled: boolean;
    init: () => void;
    recoverTimer: number;
    sim: { time: number; timeStep: number };
  };
  AutomaticController: unknown;
};
export default vehicle;
