/** Logs every network request + status for one page load, to identify 404s. */
const TARGET_URL = process.argv[2] ?? "http://localhost:3200";
const DEBUG_URL = "http://127.0.0.1:9223";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;
let nextId = 1;
const pending = new Map();
const requests = new Map();
const failures = [];

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result.value;
}

const pages = await (await fetch(`${DEBUG_URL}/json/list`)).json();
const page = pages.find((e) => e.type === "page");
socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  socket.addEventListener("open", res, { once: true });
  socket.addEventListener("error", rej, { once: true });
});
socket.addEventListener("message", (event) => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    return;
  }
  if (m.method === "Network.requestWillBeSent") requests.set(m.params.requestId, m.params.request.url);
  if (m.method === "Network.responseReceived") {
    const url = requests.get(m.params.requestId) ?? m.params.response.url;
    if (m.params.response.status >= 400) failures.push(`${m.params.response.status} ${url}`);
    if (m.params.type === "Script" && m.params.response.status >= 400) failures.push(`CHUNK MISSING: ${url}`);
  }
  if (m.method === "Network.loadingFailed") failures.push(`FAILED ${requests.get(m.params.requestId)} :: ${m.params.errorText}`);
});
await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("Page.navigate", { url: `${TARGET_URL}/` });
await evaluate(`(async () => { const d = Date.now() + 30000; while (Date.now() < d) { if (document.readyState === "complete") return true; await new Promise(r => setTimeout(r, 200)); } return false; })()`);
await sleep(2500);
console.log("total requests:", requests.size);
console.log("failures:", JSON.stringify(failures, null, 2));
process.exit(0);
