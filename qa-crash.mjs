/**
 * Crash hunt. Walks every view and interactive control, and reports the exact
 * step that throws (console error, uncaught exception, or Next error overlay).
 *   node qa-crash.mjs http://localhost:3100
 */
const TARGET_URL = process.argv[2] ?? "http://localhost:3100";
const DEBUG_URL = "http://127.0.0.1:9223";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let socket;
let nextId = 1;
let step = "boot";
const pending = new Map();
const findings = [];
const consoleLog = [];

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

function record(kind, text) {
  const entry = { step, kind, text: String(text).slice(0, 300) };
  findings.push(entry);
  console.log(`  !! ${kind} during [${step}]: ${entry.text}`);
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
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
      consoleLog.push({ step, level: message.params.type, text: text.slice(0, 200) });
      if (message.params.type === "error" && !text.includes("React DevTools")) record("console.error", text);
    }
    if (message.method === "Runtime.exceptionThrown") {
      const d = message.params.exceptionDetails;
      record("exception", `${d.exception?.description ?? d.text}`);
    }
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
      const text = message.params.entry.text;
      if (!text.includes("com.chrome.devtools")) record("network/log", text);
    }
  });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Log.enable");
}

/* ------------------------------ helpers ------------------------------- */

async function locate(selector, text = null, index = 0) {
  return evaluate(`(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((el) => el.getClientRects().length > 0);
    ${text === null
      ? `const el = nodes[${index}];`
      : `const el = nodes.find((n) => (n.innerText || n.textContent || "").trim().toLowerCase().includes(${JSON.stringify(
          text.toLowerCase(),
        )}));`}
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
}

async function click(selector, options = {}) {
  const { text = null, index = 0, delay = 500 } = options;
  const point = await locate(selector, text, index);
  if (!point) {
    console.log(`  (skip: no visible ${selector}${text ? ` matching "${text}"` : ""})`);
    return false;
  }
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await sleep(delay);
  return true;
}

async function type(selector, value) {
  const ok = await click(selector, { delay: 150 });
  if (!ok) return false;
  await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el && el.select?.(); })()`);
  await send("Input.insertText", { text: value });
  await sleep(250);
  return true;
}

async function escape() {
  for (const t of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", { type: t, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  }
  await sleep(400);
}

const OVERLAY = `(() => {
  const portals = [...document.querySelectorAll("nextjs-portal")];
  const text = portals.map((p) => p.innerText).join(" ").trim();
  return text.slice(0, 400);
})()`;

async function step_run(label, fn) {
  step = label;
  const before = findings.length;
  try {
    await fn();
  } catch (error) {
    record("harness", error.message);
  }
  await sleep(250);
  const overlay = await evaluate(OVERLAY);
  if (overlay && /error|unhandled|failed/i.test(overlay)) record("next-overlay", overlay);
  const textLength = await evaluate("(document.body.innerText || '').length");
  const ok = findings.length === before;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? ` (${textLength} chars)` : ""}`);
  return ok;
}

/* -------------------------------- run --------------------------------- */

await connect();
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `window.__qaErrors = [];
    window.addEventListener("error", (e) => window.__qaErrors.push(String(e.message)));
    window.addEventListener("unhandledrejection", (e) => window.__qaErrors.push("rejection: " + String(e.reason)));
    window.__qaStep = () => window.__qaErrors;`,
});
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
step = "initial load";
await send("Page.navigate", { url: TARGET_URL });
await evaluate(`(async () => {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (document.readyState === "complete" && document.querySelectorAll("table tbody tr").length > 0
        && document.querySelectorAll(".recharts-surface").length > 1) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
})()`);
console.log(`loaded in ${(await evaluate("performance.now()")).toFixed(0)}ms since navigation start`);
console.log(`window errors on load: ${JSON.stringify(await evaluate("window.__qaErrors"))}`);

// Views ---------------------------------------------------------------
for (const view of ["Overview", "Pipeline", "Accounts", "Activities", "Forecast", "Tasks", "Settings"]) {
  await step_run(`nav → ${view}`, async () => {
    await click("nav button, aside button, aside a", { text: view, delay: 900 });
  });
}

await step_run("nav → back to Overview", async () => {
  await click("nav button, aside button, aside a", { text: "Overview", delay: 900 });
});

// Topbar --------------------------------------------------------------
await step_run("topbar: notifications menu", async () => {
  await click('header button[aria-label*="otification"]', { delay: 700 });
  await escape();
});
await step_run("topbar: user menu", async () => {
  await click('header button[aria-label*="ccount"], header button[aria-label*="ser"]', { delay: 700 });
  await escape();
});
await step_run("topbar: theme? / export", async () => {
  await click("header button", { text: "Export", delay: 900 });
});
await step_run("topbar: quick create (New opportunity)", async () => {
  await click("header button", { text: "New opportunity", delay: 900 });
  await escape();
});

// Filters -------------------------------------------------------------
await step_run("open filter panel", async () => {
  await click("button", { text: "Filters", delay: 700 });
});
for (const [label, option] of [
  ["Filter by stage", "Proposal"],
  ["Filter by owner", "Tolu K."],
  ["Filter by deal value", "$50K – $100K"],
  ["Filter by date", "Last 30 days"],
]) {
  await step_run(`filter: ${label} = ${option}`, async () => {
    const opened = await click(`button[aria-label="${label}"]`, { delay: 700 });
    if (!opened) return;
    await click('[role="option"]', { text: option, delay: 800 });
  });
}
await step_run("reset filters", async () => {
  await click("button", { text: "Reset filters", delay: 800 });
});

// Table interactions --------------------------------------------------
await step_run("sort by every column", async () => {
  for (const column of ["Opportunity", "Value", "Probability", "Age", "Expected close", "Last activity", "Stage", "Owner", "Account"]) {
    await click("th button", { text: column, delay: 400 });
    await click("th button", { text: column, delay: 300 });
  }
});
await step_run("pagination: next / last / first", async () => {
  await click('nav[aria-label="Pagination"] button', { text: "Next", delay: 500 });
  await click('nav[aria-label="Pagination"] button', { text: "Next", delay: 500 });
  await click('nav[aria-label="Pagination"] button', { text: "Previous", delay: 400 });
  await click('nav[aria-label="Pagination"] button', { text: "2", delay: 400 });
});
await step_run("page size select", async () => {
  const opened = await click('button[aria-label*="er page"], button[aria-label*="ows per"]', { delay: 600 });
  if (!opened) {
    const alternative = await click("select", { delay: 400 });
    if (alternative) await evaluate(`(() => { const s = document.querySelector("select"); if (s) { s.value = s.options[s.options.length-1].value; s.dispatchEvent(new Event("change", { bubbles: true })); } })()`);
    return;
  }
  await click('[role="option"]', { index: 2, delay: 700 });
});

// Board view + drag ---------------------------------------------------
await step_run("switch to Board view", async () => {
  await click('[role="tab"]', { text: "Board", delay: 900 });
});
await step_run("kanban: drag first card into another column", async () => {
  const handles = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('[draggable="true"]')].filter((el) => el.getClientRects().length);
    const columns = [...document.querySelectorAll('[data-stage], [data-column]')].filter((el) => el.getClientRects().length);
    return { cards: cards.length, columns: columns.length, stageAttrs: columns.slice(0, 3).map((c) => c.getAttribute('data-stage') || c.getAttribute('data-column')) };
  })()`);
  console.log(`    cards=${handles.cards} columns=${handles.columns} ${JSON.stringify(handles.stageAttrs)}`);
  if (handles.cards === 0) return;
  await evaluate(`(() => {
    const card = [...document.querySelectorAll('[draggable="true"]')].find((el) => el.getClientRects().length);
    const columns = [...document.querySelectorAll('[data-stage], [data-column]')];
    const target = columns[3] || columns[columns.length - 1];
    if (!card || !target) return;
    const dt = new DataTransfer();
    const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    fire(card, 'dragstart');
    fire(target, 'dragenter');
    fire(target, 'dragover');
    fire(target, 'drop');
    fire(card, 'dragend');
  })()`);
});
await step_run("kanban: click card opens detail", async () => {
  await click('[draggable="true"], [data-opportunity-card]', { delay: 900 });
  await escape();
});
await step_run("back to Table view", async () => {
  await click('[role="tab"]', { text: "Table", delay: 800 });
});

// Drawer --------------------------------------------------------------
await step_run("open opportunity drawer", async () => {
  await click("table tbody tr", { delay: 900 });
});
await step_run("drawer: tabs / sections", async () => {
  await click('[role="tab"]', { delay: 500 });
  await click('[role="tab"]', { index: 1, delay: 500 });
});
await step_run("drawer: change stage", async () => {
  const opened = await click('button[aria-label*="stage"], button[aria-label*="Stage"]', { delay: 700 });
  if (opened) await click('[role="option"]', { index: 1, delay: 800 });
});
await step_run("drawer: add activity", async () => {
  const opened = await click("button", { text: "Add activity", delay: 700 });
  if (!opened) return;
  await send("Input.insertText", { text: "QA check note" });
  await click('[role="dialog"] button[type="submit"], [role="dialog"] button', {
    text: "Save",
    delay: 800,
  });
});
await step_run("drawer: edit form", async () => {
  const opened = await click("button", { text: "Edit", delay: 800 });
  if (!opened) return;
  await type("#opp-value", "123456");
  await click('[role="dialog"] button[type="submit"]', { delay: 900 });
});
await step_run("drawer: mark as won", async () => {
  await click("button", { text: "Won", delay: 900 });
});
await step_run("drawer: delete opportunity", async () => {
  const opened = await click("button", { text: "Delete", delay: 700 });
  if (!opened) return;
  await click('[role="dialog"] button', { text: "Delete", delay: 900 });
});
await step_run("close drawer with Escape", async () => {
  await escape();
});

// Create flow ---------------------------------------------------------
await step_run("create opportunity: empty submit", async () => {
  await click("button", { text: "+ New opportunity", delay: 800 }) ||
    (await click("button", { text: "New opportunity", delay: 800 }));
  await click('[role="dialog"] button[type="submit"]', { delay: 700 });
});
await step_run("create opportunity: fill + submit", async () => {
  await type("#opp-company", "Crash Hunt Co");
  await type("#opp-contact", "Ada Test");
  await type("#opp-email", "ada@example.com");
  await type("#opp-value", "250000");
  await click('[role="dialog"] button[type="submit"]', { delay: 1000 });
});
await step_run("toast dismiss", async () => {
  await click('button[aria-label="Dismiss notification"]', { delay: 600 });
});

// Export --------------------------------------------------------------
await step_run("export CSV", async () => {
  await click("button", { text: "Export", delay: 900 });
});

// Secondary views deep dive -------------------------------------------
for (const view of ["Accounts", "Activities", "Tasks", "Settings", "Forecast", "Pipeline"]) {
  await step_run(`${view}: open + interact`, async () => {
    await click("nav button, aside button, aside a", { text: view, delay: 900 });
    const rows = await evaluate(`document.querySelectorAll("table tbody tr").length`);
    if (rows > 0) await click("table tbody tr", { delay: 700 });
    await click("button[role='tab'], [role='tab']", { delay: 500 });
    await click("button", { text: "Export", delay: 600 });
    await escape();
  });
}

// Mobile pass ---------------------------------------------------------
await step_run("mobile 390px: menu + nav", async () => {
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(600);
  await click('header button[aria-label*="enu"], button[aria-label*="enu"]', { delay: 800 });
  await click("button, a", { text: "Pipeline", delay: 800 });
  await escape();
});
await step_run("mobile 390px: filters sheet", async () => {
  await click("button", { text: "Filters", delay: 700 });
  await escape();
});
await step_run("mobile 390px: open drawer full-screen", async () => {
  await click("button, a", { text: "Overview", delay: 700 });
  await click('[role="tab"]', { text: "Table", delay: 600 });
  await click("table tbody tr, [data-opportunity-card]", { delay: 800 });
  await escape();
});
await step_run("mobile 390px: horizontal overflow", async () => {
  const overflow = await evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth");
  if (overflow > 1) record("layout", `page overflows horizontally by ${overflow}px at 390px`);
});

console.log("\n================ SUMMARY ================");
console.log(`console messages: ${consoleLog.length}`);
const unique = [...new Map(findings.map((f) => [`${f.kind}|${f.text}`, f])).values()];
if (unique.length === 0) console.log("No crashes or errors detected.");
unique.forEach((f) => console.log(`- [${f.kind}] step="${f.step}" :: ${f.text}`));

const pageErrors = await evaluate("JSON.stringify(window.__qaErrors || [])");
console.log(`window errors: ${pageErrors}`);
process.exit(unique.length ? 1 : 0);
