import type { AppProps } from "./mount";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RallySession } from "./game/session";
import { BabylonView } from "./game/babylon-view";
import { createPlayTrack } from "./game/play-track";
import { playCar } from "./game/car";
import { Chime, readBest, saveBest } from "./platform";

function raceClock(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function fullscreenEl() {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function App({ onReady, onError, onRoundEnded }: AppProps) {
  const [session, setSession] = useState<RallySession | null>(null);
  useEffect(() => {
    let live = true;
    createPlayTrack().then(track => {
      if (!live) return;
      setSession(new RallySession(track.terrain, track.course, track.start, playCar));
    }).catch(error => onError?.(error));
    return () => { live = false; };
  }, [onError]);
  if (!session) return <div className="shell"><p className="intro">Loading the valley…</p></div>;
  return <Play session={session} onReady={onReady} onError={onError} onRoundEnded={onRoundEnded} />;
}

function Play({ session, onReady, onError, onRoundEnded }: AppProps & { session: RallySession }) {
  const shell = useRef<HTMLDivElement>(null);
  const [chime] = useState(() => new Chime());
  const view = useSyncExternalStore(session.subscribe, session.snapshot);
  const [best, setBest] = useState(readBest);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const keys = useRef(new Set<string>());
  const active = view.status === "countdown" || view.status === "racing";
  const modal = !active;
  const total = session.course.length;
  const applyKeys = () => {
    session.turn = Number(keys.current.has("arrowright") || keys.current.has("d")) - Number(keys.current.has("arrowleft") || keys.current.has("a"));
    session.throttle = Number(keys.current.has("arrowup") || keys.current.has("w"));
    session.brake = Number(keys.current.has("arrowdown") || keys.current.has("s"));
    session.handbrake = Number(keys.current.has(" ") || keys.current.has("space"));
  };
  const pause = () => { keys.current.clear(); applyKeys(); session.pause(); chime.suspend(); };
  const resume = () => { session.resume(); chime.unlock(); };
  const start = () => { session.start(); chime.unlock(); };
  useEffect(() => {
    if (view.status === "finished") onRoundEnded?.({ mode: "orchard", score: Math.round(view.time) });
  }, [view.status, view.time, onRoundEnded]);
  useEffect(() => {
    session.reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.tabIndex = -1;
    canvas.setAttribute("touch-action", "none");
    host.current!.appendChild(canvas);
    let view3d: BabylonView | undefined;
    try {
      view3d = new BabylonView(canvas, session, () => onReady?.(() => { session.pause(); chime.suspend(); }));
    } catch (error) {
      onError?.(error);
    }
    const blur = () => {
      if (fullscreenEl()) return;
      keys.current.clear(); applyKeys(); session.pause(); chime.suspend();
    };
    const visibility = () => { if (document.hidden) blur(); };
    const onFs = () => {
      setFullscreen(Boolean(fullscreenEl()));
      board.current?.focus({ preventScroll: true });
    };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs as EventListener);
    return () => {
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs as EventListener);
      view3d?.dispose(); canvas.remove(); chime.close();
    };
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
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", " ", "space"].includes(key) && active) {
        e.preventDefault(); keys.current.add(key); applyKeys();
      }
      if (e.repeat) return;
      if (key === "p") { e.preventDefault(); active ? pause() : view.status === "paused" && resume(); }
      if (key === "r" && (active || view.status === "paused")) { e.preventDefault(); session.resetToLastPost(); }
      if (key === "escape") {
        if (fullscreenEl()) return;
        e.preventDefault();
        active ? pause() : view.status === "paused" && resume();
      }
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); applyKeys(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [active, view.status]);
  const status = view.status;
  const toggleFullscreen = () => {
    const el = board.current;
    if (!el) return;
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
    const node = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    if (fullscreenEl()) {
      void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    const go = node.requestFullscreen?.bind(node);
    if (go) void go({ navigationUI: "hide" }).catch(() => void node.requestFullscreen?.());
    else node.webkitRequestFullscreen?.();
    board.current?.focus({ preventScroll: true });
  };
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
      <p className="intro">One little car.<br/>A Grove Valley loop of dirt arches.</p>
      <section className="level-ticket" aria-label="Course progress"><div><span>Checkpoints</span><strong data-testid="level">{Math.min(view.checkpoint + 1, total)} / {total}</strong></div><p>Grove Valley loop</p><p className="challenge">Drive past each post in order. Flip and the car sits itself back up. R returns you to the last post.</p><label htmlFor="progress">{view.checkpoint} of {total} posts passed</label><progress id="progress" max={total} value={view.checkpoint}/></section>
      <div className="scores"><div><span>Time</span><strong data-testid="score">{view.time.toFixed(1)}</strong></div><div><span>Best</span><strong data-testid="best">{best ? best.toFixed(1) : "—"}</strong></div><div><span>Next</span><strong>{view.checkpoint >= total ? "Gate" : `Post ${view.checkpoint + 1}`}</strong></div></div>
      <div className="utilities"><button type="button" className="secondary" disabled={!active} onClick={pause}>Pause</button><button type="button" className="secondary" disabled={view.status === "ready" || view.status === "finished"} onClick={() => session.resetToLastPost()}>Last post</button><button type="button" className="secondary" aria-pressed={!muted} onClick={() => { const next = !muted; setMuted(next); session.muted = next; chime.muted = next; next ? chime.suspend() : chime.unlock(); }}>{muted ? "Sound off" : "Sound on"}</button><button type="button" className="secondary" aria-pressed={fullscreen} onClick={toggleFullscreen}>{fullscreen ? "Exit full" : "Fullscreen"}</button></div>
    </aside><section className="play-area" aria-label="Orchard rally">
      <div className="board-heading"><span>Grove Rally · peach orchard</span><span className="orientation-hint">Rotate ↻ for wide view</span><span>{status === "racing" ? "On course" : status === "countdown" ? "Lights" : "A quiet garden gate"}</span></div>
      <div className="board" ref={board} tabIndex={0} role="region" aria-label="Orchard course" aria-describedby="instructions" onPointerDown={() => board.current?.focus({ preventScroll: true })}>
        <div className="canvas-host" ref={host} aria-hidden="true"/>
        <div className="race-hud" aria-hidden="true">
          <div className="hud-time"><span>TIME</span><strong data-testid="hud-time">{raceClock(view.time)}</strong></div>
          <div className="hud-ckpt"><span>CKPT</span><strong>{Math.min(view.checkpoint + 1, total)} / {total}</strong></div>
          {(status === "countdown" || status === "racing") && <div className="hud-speed">{view.speed} km/h</div>}
          {status === "countdown" && /^\d+$/.test(view.message) && <div className="hud-count">{view.message}</div>}
          {(view.flipped || view.recovering) && (
            <div className="hud-recover-alert" role="alert">
              <span className="hud-recover-title">{view.recovering ? "Vehicle recovering…" : "Car flipped!"}</span>
              <button
                type="button"
                className="hud-recover-btn"
                onClick={event => {
                  event.stopPropagation();
                  session.resetToLastPost();
                  board.current?.focus({ preventScroll: true });
                }}
              >
                Reset to track (R)
              </button>
            </div>
          )}
        </div>
        <div className="board-actions">
          <button type="button" className="full-btn" aria-label="Reset to last post" disabled={!active} onClick={event => { event.stopPropagation(); session.resetToLastPost(); board.current?.focus({ preventScroll: true }); }}>↺ Post (R)</button>
          <button type="button" className="full-btn" aria-pressed={fullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Open fullscreen"} onClick={event => { event.stopPropagation(); toggleFullscreen(); }}>{fullscreen ? "Exit full" : "Fullscreen"}</button>
        </div>
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
      <div className="controls" style={{ gridTemplateColumns: "1fr 1.2fr 1fr", paddingTop: 0 }}>
        <button type="button" className="arrow" aria-label="Brake" disabled={!active} {...hold(v => { session.brake = v; }, 1)}>Brake</button>
        <button type="button" className="arrow reset-btn" aria-label="Reset to last post" disabled={!active} onClick={() => { session.resetToLastPost(); board.current?.focus({ preventScroll: true }); }}>↺ Post</button>
        <button type="button" className="arrow" aria-label="Handbrake" disabled={!active} {...hold(v => { session.handbrake = v; }, 1)}>Handbrake</button>
      </div>
      <p id="instructions" style={{ margin: 0, padding: "8px" }}>Hold accelerate · Space handbrake · R last post · ← → / A D · P pause</p>
    </section></div><footer><span>One car. One orchard. No ads.</span><span>Driving logic from Trigger Rally OE · original garden art.</span></footer>
  </div>;
}
