import type { AppProps } from "./mount";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Phaser from "phaser";
import { createGame } from "./runtime";
import { RallySession } from "./game/session";
import { RallyScene, WIDTH, HEIGHT } from "./game/scene";
import { COURSE } from "./game/track";
import { Chime, readBest, saveBest } from "./platform";

export function App({ onReady, onError, onRoundEnded }: AppProps) {
  const shell = useRef<HTMLDivElement>(null);
  const [session] = useState(() => new RallySession());
  const [chime] = useState(() => new Chime());
  const view = useSyncExternalStore(session.subscribe, session.snapshot);
  const [best, setBest] = useState(readBest);
  const [muted, setMuted] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const keys = useRef(new Set<string>());
  const active = view.status === "countdown" || view.status === "racing";
  const modal = !active;
  const applyKeys = () => {
    session.turn = Number(keys.current.has("arrowright") || keys.current.has("d")) - Number(keys.current.has("arrowleft") || keys.current.has("a"));
    session.throttle = Number(keys.current.has("arrowup") || keys.current.has("w"));
    session.brake = Number(keys.current.has("arrowdown") || keys.current.has("s"));
  };
  const pause = () => { keys.current.clear(); applyKeys(); session.pause(); chime.suspend(); };
  const resume = () => { session.resume(); chime.unlock(); };
  const start = () => { session.start(); chime.unlock(); };
  useEffect(() => {
    if (view.status === "finished") onRoundEnded?.({ mode: "orchard", score: Math.round(view.time) });
  }, [view.status, view.time, onRoundEnded]);
  useEffect(() => {
    session.reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new RallyScene(session);
    const create = scene.create.bind(scene);
    scene.create = () => {
      try { create(); scene.game.events.once(Phaser.Core.Events.POST_RENDER, () => onReady?.(() => { session.pause(); chime.suspend(); })); }
      catch (error) { disposeGame(); onError?.(error); }
    };
    const disposeGame = createGame({
      type: Phaser.CANVAS, parent: host.current!, width: WIDTH, height: HEIGHT,
      backgroundColor: "#dde6c8", scene, audio: { noAudio: true }, input: { keyboard: false },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    });
    const blur = () => { keys.current.clear(); applyKeys(); session.pause(); chime.suspend(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener("blur", blur); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility); disposeGame(); chime.close(); };
  }, [session, chime]);
  useEffect(() => {
    keys.current.clear(); applyKeys();
    if (modal) {
      if ((view.status !== "paused" && view.status !== "ready") || shell.current?.contains((shell.current.getRootNode() as Document | ShadowRoot).activeElement) || (view.status === "ready" && !(shell.current?.getRootNode() instanceof ShadowRoot)))
        primary.current?.focus({ preventScroll: true });
    } else board.current?.focus({ preventScroll: true });
  }, [view.status, modal]);
  useEffect(() => {
    if (view.status === "finished" && view.time > 0 && (best === 0 || view.time < best)) { setBest(view.time); saveBest(view.time); }
  }, [view.status, view.time, best]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable=true]"))) return;
      const key = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key) && active && e.target === board.current) {
        e.preventDefault(); keys.current.add(key); applyKeys();
      }
      if (e.repeat) return;
      if (key === "p" || key === "escape") { e.preventDefault(); active ? pause() : view.status === "paused" && resume(); }
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); applyKeys(); };
    const root = shell.current!;
    root.addEventListener("keydown", down); root.addEventListener("keyup", up);
    return () => { root.removeEventListener("keydown", down); root.removeEventListener("keyup", up); };
  }, [active, view.status]);
  const status = view.status;
  const hold = (set: (v: number) => void, value: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture(e.pointerId); set(value); },
    onPointerUp: () => set(0),
    onPointerCancel: () => set(0),
    onLostPointerCapture: () => set(0),
  });
  return <div ref={shell} onPointerDownCapture={event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button:not(:disabled)") : null;
    if (button && event.button === 0) { event.preventDefault(); button.focus({ preventScroll: true }); }
  }} className="shell">
    <header><a className="back" href="https://playminiarcade.com">↖ Play Mini Arcade</a><span className="edition">A toy orchard rally</span></header>
    <div className="layout"><aside>
      <h1>Grove<br/> Rally<span aria-hidden="true" className="flower">❀</span></h1>
      <p className="intro">One little car.<br/>A Grove Valley loop of wooden posts.</p>
      <section className="level-ticket" aria-label="Course progress"><div><span>Checkpoints</span><strong data-testid="level">{Math.min(view.checkpoint + 1, COURSE.length)} / {COURSE.length}</strong></div><p>Grove Valley loop</p><p className="challenge">Drive past each post in order. Flip or leave the path and the car sits itself back up.</p><label htmlFor="progress">{view.checkpoint} of {COURSE.length} posts passed</label><progress id="progress" max={COURSE.length} value={view.checkpoint}/></section>
      <div className="scores"><div><span>Time</span><strong data-testid="score">{view.time.toFixed(1)}</strong></div><div><span>Best</span><strong data-testid="best">{best ? best.toFixed(1) : "—"}</strong></div><div><span>Next</span><strong>{view.checkpoint >= COURSE.length ? "Gate" : `Post ${view.checkpoint + 1}`}</strong></div></div>
      <div className="utilities"><button type="button" className="secondary" disabled={!active} onClick={pause}>Pause</button><button type="button" className="secondary" aria-pressed={!muted} onClick={() => { const next = !muted; setMuted(next); chime.muted = next; next ? chime.suspend() : chime.unlock(); }}>{muted ? "Sound off" : "Sound on"}</button></div>
    </aside><section className="play-area" aria-label="Orchard rally">
      <div className="board-heading"><span>Grove Rally · peach orchard</span><span>{status === "racing" ? "On course" : status === "countdown" ? "Lights" : "A quiet garden gate"}</span></div>
      <div className="board" ref={board} tabIndex={0} role="region" aria-label="Orchard course" aria-describedby="instructions" onBlur={() => { keys.current.clear(); applyKeys(); }}>
        <div className="canvas-host" ref={host} aria-hidden="true"/>
        {modal && <div className="overlay"><section className="start-card" aria-labelledby="state-title"><div className="seal" aria-hidden="true">❀</div>
          <p className="eyebrow">{status === "finished" ? "Orchard complete" : "Toy car, dirt path"}</p>
          <h2 id="state-title">{status === "ready" ? "Take the little car around the trees." : status === "paused" ? "A little orchard break." : status === "finished" ? "Back through the gate." : "Ready."}</h2>
          <p>{status === "ready" ? "Steer with the arrows. Hold accelerate to roll. Pass every wooden post in order, then stop the clock." : status === "paused" ? "The car will wait on the dirt." : status === "finished" ? view.message : view.message}</p>
          <button type="button" ref={primary} className="primary" onClick={status === "paused" ? resume : status === "finished" ? () => { session.retry(); chime.unlock(); } : start}>{status === "ready" ? "Open the gate" : status === "paused" ? "Resume rally" : status === "finished" ? "Retry orchard" : "Open the gate"}</button>
          {(status === "paused" || status === "finished") && <button type="button" className="text-button" onClick={start}>Restart rally</button>}
        </section></div>}
      </div>
      <div className="controls">
        <button type="button" className="arrow" aria-label="Steer left" disabled={!active} {...hold(v => { session.turn = -v; }, 1)}>←</button>
        <button type="button" className="launch" aria-label="Accelerate" disabled={!active} {...hold(v => { session.throttle = v; }, 1)}>Accelerate</button>
        <button type="button" className="arrow" aria-label="Steer right" disabled={!active} {...hold(v => { session.turn = v; }, 1)}>→</button>
      </div>
      <div className="controls" style={{ gridTemplateColumns: "1fr 1fr", paddingTop: 0 }}>
        <button type="button" className="arrow" aria-label="Brake" disabled={!active} {...hold(v => { session.brake = v; }, 1)}>Brake</button>
        <p id="instructions" style={{ margin: 0, padding: "12px 8px" }}>Hold accelerate · ← → / A D to steer · P to pause</p>
      </div>
    </section></div><footer><span>One car. One orchard. No ads.</span><span>Driving logic from Trigger Rally OE · original garden art.</span></footer>
  </div>;
}
