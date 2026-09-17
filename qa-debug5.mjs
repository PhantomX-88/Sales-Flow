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

const dialogs = `[...document.querySelectorAll('[role="dialog"]')].map((d) => d.innerText.slice(0, 40).replace(/\\n/g, ' '))`;

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

  await evaluate("document.querySelector('#opportunities-heading').closest('section').querySelector('tbody tr').click()");
  await sleep(1000);
  console.log("after row click:", await evaluate(dialogs));

  const addActivity = await evaluate(`(() => {
    const el = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.includes('Add activity'));
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  await clickPoint(addActivity);
  await sleep(600);
  console.log("after add activity:", await evaluate(dialogs));

  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(900);
  console.log("after escape:", await evaluate(dialogs));
  console.log("focused:", await evaluate("document.activeElement?.tagName + '|' + (document.activeElement?.textContent || '').slice(0, 30)"));

  // try clicking the close button instead
  const closePoint = await evaluate(`(() => {
    const el = document.querySelector('[role="dialog"] button[aria-label="Close panel"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  console.log("close button point:", JSON.stringify(closePoint));
  if (closePoint) {
    await clickPoint(closePoint);
    await sleep(800);
    console.log("after close click:", await evaluate(dialogs));
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("debug error:", error);
  process.exit(2);
});
