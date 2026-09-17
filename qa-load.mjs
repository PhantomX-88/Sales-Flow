/**
 * Load diagnostic. Verifies the app boots in a real browser: no console errors,
 * no hydration mismatch, content actually rendered and interactive.
 *   node qa-load.mjs http://localhost:3100
 */
const TARGET_URL = process.argv[2] ?? "http://localhost:3100";
const DEBUG_URL = "http://127.0.0.1:9223";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let socket;
let nextId = 1;
const pending = new Map();
const consoleMessages = [];
const exceptions = [];

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`Evaluation failed: ${result.exceptionDetails.text}`);
  return result.result.value;
}

async function connect() {
  const pages = await (await fetch(`${DEBUG_URL}/json/list`)).json();
  const page = pages.find((entry) => entry.type === "page");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
      return;
    }
    if (message.method === "Runtime.consoleAPICalled") {
      const text = message.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      consoleMessages.push({ level: message.params.type, text });
    }
    if (message.method === "Runtime.exceptionThrown") {
      const d = message.params.exceptionDetails;
      exceptions.push(`${d.text} ${d.exception?.description ?? ""}`.trim());
    }
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
      consoleMessages.push({ level: "network", text: message.params.entry.text });
    }
  });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Log.enable");
}

const started = Date.now();
await connect();
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: TARGET_URL });

// Wait for the dashboard to fully hydrate and paint its data-driven content.
const ready = await evaluate(`(async () => {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const rows = document.querySelectorAll("table tbody tr").length;
    const charts = document.querySelectorAll(".recharts-surface").length;
    if (document.readyState === "complete" && rows > 0 && charts > 0) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
})()`);

const snapshot = await evaluate(`(() => {
  const text = document.body.innerText || "";
  const buttons = [...document.querySelectorAll("button")];
  const svgs = [...document.querySelectorAll("svg")];
  const emptyCharts = [...document.querySelectorAll(".recharts-surface")].map((s) => s.getAttribute("width") + "x" + s.getAttribute("height"));
  const unstyled = document.querySelectorAll('[class*="bg-slate-"],[data-radix-collection-item]').length;
  return {
    readyState: document.readyState,
    textLength: text.length,
    textHead: text.slice(0, 300),
    buttons: buttons.length,
    svgs: svgs.length,
    recharts: emptyCharts,
    hasCss: getComputedStyle(document.body).backgroundColor,
    sidebarWidth: document.querySelector("aside")?.getBoundingClientRect().width ?? null,
    scrollOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    styled: unstyled,
    rows: document.querySelectorAll("table tbody tr").length,
    fonts: getComputedStyle(document.body).fontFamily,
    fullText: text,
  };
})()`);

const hydration = await evaluate(`(() => {
  const nodes = document.querySelectorAll("nextjs-portal");
  return { portals: nodes.length, text: [...nodes].map((n) => n.innerText).join(" | ").slice(0, 800) };
})()`);

console.log(`elapsed: ${Date.now() - started}ms`);
console.log("ready:", ready);
console.log("snapshot:", JSON.stringify(snapshot, null, 2));
console.log("nextjs-portal (dev overlay):", JSON.stringify(hydration, null, 2));
console.log("console:", JSON.stringify(consoleMessages.slice(0, 30), null, 2));
console.log("exceptions:", JSON.stringify(exceptions.slice(0, 20), null, 2));

await sleep(500);
await send("Page.captureScreenshot", { format: "png" }).then(async (r) => {
  const { writeFileSync } = await import("node:fs");
  writeFileSync("load-check.png", Buffer.from(r.data, "base64"));
  console.log("screenshot -> load-check.png");
});
process.exit(0);
