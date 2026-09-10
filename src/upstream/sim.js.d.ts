declare const sim: {
  Sim: new (timeStep: number) => {
    time: number;
    timeStep: number;
    alpha: number;
    tick(delta: number): void;
    restart(): void;
    addObject(obj: unknown): void;
    addStaticObject(obj: unknown): void;
    pubsub: { subscribe: (topic: string, fn: () => void) => void };
  };
  RigidBody: unknown;
};
export default sim;
