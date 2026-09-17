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

async function point(selectorByText, scope = "button") {
  return evaluate(`(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(scope)})].filter((el) => el.getClientRects().length > 0);
    const el = nodes.find((n) => n.textContent.trim().toLowerCase().includes(${JSON.stringify(
      selectorByText.toLowerCase(),
    )}));
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: el.textContent.trim().slice(0, 30) };
  })()`);
}

async function mouseClick({ x, y }) {
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

  // --- A: inline filter select
  const filtersBtn = await point("Filters");
  console.log("filters button:", JSON.stringify(filtersBtn));
  await mouseClick(filtersBtn);
  await sleep(800);

  const triggerPoint = await evaluate(`(() => {
    const el = document.querySelector('button[aria-label="Filter by stage"]');
    if (!el) return null;
    const rects = el.getClientRects();
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      rects: rects.length,
      state: el.dataset.state,
      atPoint: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.outerHTML.slice(0, 120),
    };
  })()`);
  console.log("stage trigger:", JSON.stringify(triggerPoint));

  await mouseClick(triggerPoint);
  await sleep(500);
  console.log(
    "after click — options:",
    await evaluate("document.querySelectorAll('[role=\"option\"]').length"),
    "state:",
    await evaluate("document.querySelector('button[aria-label=\"Filter by stage\"]')?.dataset.state"),
  );
  await sleep(900);
  console.log(
    "after 1.4s — options:",
    await evaluate("document.querySelectorAll('[role=\"option\"]').length"),
    "state:",
    await evaluate("document.querySelector('button[aria-label=\"Filter by stage\"]')?.dataset.state"),
  );

  // try clicking again (toggle behaviour)
  await mouseClick(triggerPoint);
  await sleep(700);
  console.log(
    "after second click — options:",
    await evaluate("document.querySelectorAll('[role=\"option\"]').length"),
    "state:",
    await evaluate("document.querySelector('button[aria-label=\"Filter by stage\"]')?.dataset.state"),
  );

  // --- B: row actions menu
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await sleep(500);
  const actionsPoint = await evaluate(`(() => {
    const el = document.querySelector('button[aria-label^="Actions for"]');
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), label: el.getAttribute('aria-label') };
  })()`);
  console.log("actions button:", JSON.stringify(actionsPoint));
  await mouseClick(actionsPoint);
  await sleep(800);
  console.log(
    "menuitems after click:",
    await evaluate("[...document.querySelectorAll('[role=\"menuitem\"]')].map((n) => n.textContent.trim()).join('|')"),
  );
  console.log("dialogs open:", await evaluate("document.querySelectorAll('[role=\"dialog\"]').length"));

  const editPoint = await evaluate(`(() => {
    const el = [...document.querySelectorAll('[role="menuitem"]')].find((n) => n.textContent.includes('Edit opportunity'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  console.log("edit item point:", JSON.stringify(editPoint));
  await mouseClick(editPoint);
  await sleep(1200);
  console.log(
    "after edit click — dialogs:",
    await evaluate("document.querySelectorAll('[role=\"dialog\"]').length"),
    "hasEditTitle:",
    await evaluate("document.body.innerText.toUpperCase().includes('EDIT OPPORTUNITY')"),
  );
  console.log(
    "top dialog text:",
    await evaluate(`(window.__t = [...document.querySelectorAll('[role="dialog"]')].pop())?.innerText.slice(0, 160)`),
  );

  process.exit(0);
}

main().catch((error) => {
  console.error("debug error:", error);
  process.exit(2);
});
