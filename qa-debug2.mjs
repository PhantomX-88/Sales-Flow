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

async function clickPoint({ x, y }) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

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

  const target = await evaluate(`(() => {
    const el = document.querySelector('button[aria-label^="Actions for"]');
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), label: el.getAttribute('aria-label') };
  })()`);
  console.log("target:", JSON.stringify(target));

  await clickPoint(target);
  await sleep(900);
  console.log("menuitems:", await evaluate("[...document.querySelectorAll('[role=\"menuitem\"]')].map(n => n.textContent.trim()).join(' | ')"));
  console.log("menu present:", await evaluate("Boolean(document.querySelector('[role=\"menu\"]'))"));

  if (await evaluate("Boolean(document.querySelector('[role=\"menu\"]'))")) {
    const edit = await evaluate(`(() => {
      const el = [...document.querySelectorAll('[role="menuitem"]')].find((n) => n.textContent.includes('Edit opportunity'));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    console.log("edit point:", JSON.stringify(edit));
    await clickPoint(edit);
    await sleep(1200);
    console.log("dialogs:", await evaluate("document.querySelectorAll('[role=\"dialog\"]').length"));
    console.log("edit title:", await evaluate("document.body.innerText.toUpperCase().includes('EDIT OPPORTUNITY')"));
    console.log("prefilled:", await evaluate("document.querySelector('#opp-company')?.value"));
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("debug error:", error);
  process.exit(2);
});
