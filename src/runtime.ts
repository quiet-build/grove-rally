import Phaser from "phaser";

// Phaser 3.90 installs global visibility callbacks during synchronous start.
class SessionGame extends Phaser.Game {
  protected override start() {
    const blur = window.onblur, focus = window.onfocus;
    const add = document.addEventListener;
    const owned: Array<() => void> = [];
    document.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
      add.call(document, type, listener, options);
      if (type === "visibilitychange") owned.push(() => document.removeEventListener(type, listener, options));
    } as typeof document.addEventListener;
    try { super.start(); } finally {
      document.addEventListener = add;
      window.onblur = blur; window.onfocus = focus;
      for (const remove of owned) remove();
    }
  }
}

export function createGame(config: Phaser.Types.Core.GameConfig) {
  let game: Phaser.Game | undefined;
  let disposed = false;
  const dispose = (failedBoot = false) => {
    if (disposed || !game) return;
    disposed = true;
    const owned = game;
    if (failedBoot && !owned.scene.isBooted) {
      // A failure before BOOT has no system scene; normal SceneManager.destroy
      // requires one. These games use noAudio, so no engine AudioContext exists.
      owned.events.emit(Phaser.Core.Events.DESTROY);
      owned.events.removeAllListeners();
      owned.renderer?.destroy();
      if (owned.canvas) {
        Phaser.Display.Canvas.CanvasPool.remove(owned.canvas);
        owned.canvas.remove();
      }
      owned.loop.destroy();
      return;
    }
    for (const scene of owned.scene.getScenes(false)) {
      if (scene.sys.isActive() || scene.sys.isPaused()) owned.scene.stop(scene);
    }
    owned.destroy(true);
    // Complete destruction after the active callback even without another RAF.
    const finish = () => queueMicrotask(() => owned.step(performance.now(), 0));
    if (owned.isRunning) finish();
    else owned.events.once(Phaser.Core.Events.READY, finish);
  };
  try {
    new SessionGame({ ...config, autoFocus: false, callbacks: { preBoot(owned) { game = owned; } } });
  } catch (error) {
    dispose(true);
    throw error;
  }
  return dispose;
}
