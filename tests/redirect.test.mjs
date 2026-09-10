import assert from "node:assert/strict";
import { test } from "node:test";
import { onRequest } from "../functions/_middleware.ts";

const canonical = "https://playminiarcade.com/game/grove-rally";
const legacy = "grove-rally.playminiarcade.com";

test("legacy root and nested requests redirect to the fixed canonical game URL", async () => {
  for (const [method, path] of [["GET", "/"], ["HEAD", "/old/path?next=https://evil.example"]]) {
    let passedThrough = false;
    const response = await onRequest({ request: new Request(`https://${legacy}${path}`, { method }), next: async () => { passedThrough = true; return new Response("asset"); } });
    assert.equal(response.status, 301); assert.equal(response.headers.get("location"), canonical); assert.equal(passedThrough, false);
  }
});

test("Pages, preview, local and lookalike hosts pass through unchanged", async () => {
  for (const url of ["https://grove-rally.pages.dev/component.js", "https://preview.grove-rally.pages.dev/component.js", "http://127.0.0.1:8788/component.js", `https://${legacy}.evil.example/`]) {
    const asset = new Response("asset", { status: 200 }); let calls = 0;
    const response = await onRequest({ request: new Request(url), next: async () => { calls += 1; return asset; } });
    assert.equal(response, asset); assert.equal(calls, 1);
  }
});
