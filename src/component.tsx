import { mount } from "./mount";

class GameElement extends HTMLElement {
  private connection = 0;
  private session?: ReturnType<typeof mount>;
  connectedCallback() {
    if (this.session) return;
    const connection = ++this.connection;
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    shadow.replaceChildren(container);
    const fail = (error: unknown) => {
      queueMicrotask(() => {
        if (!this.isConnected || connection !== this.connection) return;
        console.error("Game initialization failed", error);
        this.session?.dispose();
        this.session = undefined;
        this.emit("pma-error", { message: "Unable to start game. Please try again." });
      });
    };
    try {
      this.session = mount(container, {
        onReady: () => this.emit("pma-ready"),
        onError: fail,
        onRoundEnded: result => this.emit("pma-round-ended", result),
      });
    } catch (error) { fail(error); }
  }
  disconnectedCallback() {
    this.session?.dispose();
    this.session = undefined;
    this.shadowRoot?.replaceChildren();
  }
  pause() { this.session?.pause(); }
  private emit(name: string, detail: Record<string, unknown> = {}) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail: { gameId: "grove-rally", ...detail } }));
  }
}
if (!customElements.get("pma-grove-rally")) customElements.define("pma-grove-rally", GameElement);
