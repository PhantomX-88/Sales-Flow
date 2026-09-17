/** Probe: what actually renders at mobile widths, and does the row Actions menu work? */
const TARGET_URL = process.argv[2] ?? "http://localhost:3100";
const DEBUG_URL = "http://127.0.0.1:9223";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;
let nextId = 1;
const pending = new Map();
const errors = [];

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function connect() {
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
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
    if (m.method === "Runtime.exceptionThrown") errors.push("EXC " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
  });
  await send("Runtime.enable");
  await send("Page.enable");
}
async function locate(selector, text = null, index = 0) {
  return evaluate(`(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((el) => el.getClientRects().length > 0);
    ${text === null ? `const el = nodes[${index}];` : `const el = nodes.find((n) => (n.innerText || n.textContent || "").trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));`}
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return r.width && r.height ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null;
  })()`);
}
async function click(selector, text = null, index = 0, delay = 500) {
  const p = await locate(selector, text, index);
  if (!p) return false;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await sleep(delay);
  return true;
}

await connect();
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: TARGET_URL });
await evaluate(`(async () => { const d = Date.now() + 120000; while (Date.now() < d) { if (document.querySelectorAll("table tbody tr").length > 0) return true; await new Promise(r => setTimeout(r, 300)); } return false; })()`);

// ---- Row actions menu (the path the earlier harness never reached) ----
console.log("=== ACTIONS MENU ===");
const opened = await click('table tbody tr button[aria-label*="ction"], table tbody tr button[aria-label*="ore"], table tbody tr button', null, 2, 800);
console.log("clicked row action button:", opened);
console.log("menus open:", await evaluate(`document.querySelectorAll('[role="menu"]').length`));
const items = await evaluate(`[...document.querySelectorAll('[role="menuitem"]')].map((i) => i.innerText.trim())`);
console.log("menu items:", JSON.stringify(items));
if (items.length) {
  await click('[role="menuitem"]', null, 0, 800);
  console.log("after first item, dialog?:", await evaluate(`Boolean(document.querySelector('[role="dialog"]'))`), "errors:", JSON.stringify(errors));
}

// ---- Mobile render ----
for (const width of [768, 414, 390, 375]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
  await sleep(900);
  const info = await evaluate(`(() => {
    const text = document.body.innerText || "";
    const main = document.querySelector("main");
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 2).slice(0, 5).map((el) => el.tagName + "." + (el.className || "").toString().slice(0, 60));
    return {
      chars: text.length,
      head: text.slice(0, 200).replace(/\\n+/g, " | "),
      mainChildren: main ? main.children.length : null,
      mainHeight: main ? Math.round(main.getBoundingClientRect().height) : null,
      pageHeight: Math.round(document.documentElement.scrollHeight),
      overflow,
      wide,
      asideVisible: [...document.querySelectorAll("aside")].map((a) => Math.round(a.getBoundingClientRect().width)),
      headerButtons: [...document.querySelectorAll("header button")].map((b) => b.getAttribute("aria-label") || b.innerText.trim().slice(0, 24)),
      sections: [...document.querySelectorAll("section")].map((s) => Math.round(s.getBoundingClientRect().height)),
    };
  })()`);
  console.log(`\n=== ${width}px ===`);
  console.log(JSON.stringify(info, null, 2));
}
console.log("\nerrors:", JSON.stringify(errors, null, 2));
process.exit(0);
