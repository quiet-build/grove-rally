import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const { name } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
createServer((_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;background:#fff;color:#123;font:16px Arial}#player{width:min(100%,900px);margin:auto}button,input{font:inherit;min-height:44px}</style>
<label>Host text<input id="text"></label><button id="host-button" onclick="this.textContent='Host clicked'">Host button</button>
<div id="player"></div><script>
window.ready=[];window.failures=[];
document.addEventListener('pma-ready',e=>window.ready.push(e.detail));
document.addEventListener('pma-error',e=>window.failures.push(e.detail));
</script><script type="module">import 'http://127.0.0.1:5303/component.js';document.querySelector('#player').append(document.createElement('pma-${name}'));</script>`);
}).listen(5304, "127.0.0.1");
