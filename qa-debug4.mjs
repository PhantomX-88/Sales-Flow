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

  const report = await evaluate(`(() => {
    const all = [...document.querySelectorAll('button[aria-label^="Actions for"]')];
    const visible = all.filter((el) => el.getClientRects().length > 0);
    const problems = [];
    if (!all.length) problems.push('no actions buttons in DOM');
    if (!visible.length) problems.push('no visible actions buttons');
    const el = visible[0] ?? null;
    if (!el) {
      return { problems, total: all.length, visible: visible.length, bodyStart: document.body.innerText.slice(0, 200) };
    }
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const rect = el.getBoundingClientRect();
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);
    const at = document.elementFromPoint(cx, cy);
    const wrapper = el.closest('div.overflow-x-auto');
    return {
      total: all.length,
      visible: visible.length,
      label: el.getAttribute('aria-label'),
      rect: { top: Math.round(rect.top), left: Math.round(rect.left), w: Math.round(rect.width), h: Math.round(rect.height) },
      center: { cx, cy },
      atCenter: at ? at.tagName + '|' + (at.className || '').toString().slice(0, 60) : null,
      scrollY: Math.round(window.scrollY),
      wrapperTop: wrapper ? Math.round(wrapper.getBoundingClientRect().top) : null,
      wrapperOverflowY: wrapper ? getComputedStyle(wrapper).overflowY : null,
    };
  })()`);
  console.log(JSON.stringify(report, null, 2));

  process.exit(0);
}

main().catch((error) => {
  console.error("debug error:", error);
  process.exit(2);
});
