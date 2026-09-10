import { createRoot } from "react-dom/client";
import { App } from "./App";
import styles from "./styles.css?inline";

export type AppProps = { onReady?: (pause: () => void) => void; onError?: (error: unknown) => void; onRoundEnded?: (result: { mode: string; score: number }) => void };

export function mount(container: HTMLElement, options: AppProps = {}) {
  const style = document.createElement("style");
  style.textContent = styles;
  const rootNode = document.createElement(container.getRootNode() instanceof ShadowRoot ? "div" : "main");
  container.replaceChildren(style, rootNode);
  let disposed = false;
  let pause = () => {};
  const focusout = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;
    const previous = event.target;
    queueMicrotask(() => {
      if (disposed || container.contains((container.getRootNode() as Document | ShadowRoot).activeElement)) return;
      if (previous instanceof HTMLElement && (!previous.isConnected || previous.matches(":disabled"))) {
        const shell = rootNode.firstElementChild as HTMLElement | null;
        if (shell) { shell.tabIndex = -1; shell.focus({ preventScroll: true }); }
      } else pause();
    });
  };
  container.addEventListener("focusout", focusout);
  const root = createRoot(rootNode, { onUncaughtError: error => options.onError?.(error) });
  root.render(<App onRoundEnded={result => { if (!disposed) options.onRoundEnded?.(result); }} onError={options.onError} onReady={handler => {
    if (disposed) return;
    pause = handler;
    options.onReady?.(handler);
  }} />);
  return {
    pause: () => pause(),
    dispose() { if (disposed) return; disposed = true; container.removeEventListener("focusout", focusout); root.unmount(); container.replaceChildren(); },
  };
}
