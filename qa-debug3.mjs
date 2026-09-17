const TARGET_URL = process.argv[2] ?? "http://localhost:3100";
const DEBUG_URL = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

const state = `({
  menu: Boolean(document.querySelector('[role="menu"]')),
  items: document.querySelectorAll('[role="menuitem"]').length,
  dialogs: document.querySelectorAll('[role="dialog"]').length,
  expanded: document.querySelector('button[aria-label^="Actions for"]')?.getAttribute('aria-expanded'),
})`;

async function main() {
  const pages = await (await fetch(`${DEBUG_URL}/json/list`)).json();
  const page = pages.find((p) => p.type === "page");
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
    }
  });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: TARGET_URL });
  await sleep(9000);

  // Track which DOM events actually fire on the trigger / document
  await evaluate(`(() => {
    window.__events = [];
    const trigger = document.querySelector('button[aria-label^="Actions for"]');
    ['pointerdown','mousedown','pointerup','mouseup','click'].forEach((type) => {
      trigger.addEventListener(type, () => window.__events.push('trigger:' + type));
      document.addEventListener(type, (event) => window.__events.push('doc:' + type + '->' + (event.target.tagName || '').toLowerCase()), true);
    });
    return true;
  })()`);

  const target = await evaluate(`(() => {
    const el = document.querySelector('button[aria-label^="Actions for"]');
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);

  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1 });
  await sleep(500);
  console.log("after press:", JSON.stringify(await evaluate(state)));

  const under = await evaluate(`(() => { const el = document.elementFromPoint(${target.x}, ${target.y}); return el ? el.tagName + '.' + (el.className || '').toString().slice(0,60) : null; })()`);
  console.log("element at point:", under);

  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y, button: "left", clickCount: 1 });
  await sleep(600);
  console.log("after release:", JSON.stringify(await evaluate(state)));

  await sleep(600);
  console.log("settled:", JSON.stringify(await evaluate(state)));
  console.log("events:", await evaluate("window.__events.slice(0, 14).join(' | ')"));

  process.exit(0);
}

main().catch((error) => {
  console.error("debug error:", error);
  process.exit(2);
});
