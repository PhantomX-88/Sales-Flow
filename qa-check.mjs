/**
 * Temporary QA harness. Drives the dashboard through the Chrome DevTools
 * Protocol with trusted input events (real mouse/keyboard), which is what
 * Radix-based components respond to.
 *   node qa-check.mjs http://localhost:3100
 */
const TARGET_URL = process.argv[2] ?? "http://localhost:3100";
const DEBUG_URL = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let socket;
let nextId = 1;
const pending = new Map();
const consoleErrors = [];

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(`Evaluation failed: ${result.exceptionDetails.text}`);
  return result.result.value;
}

const results = [];
function check(label, passed, detail = "") {
  results.push({ label, passed });
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

const HELPERS = `
window.__qa = {
  text: () => document.body.innerText,
  upper: () => document.body.innerText.toUpperCase(),
  section: () => document.getElementById('opportunities-heading')?.closest('section') ?? null,
  rows: () => [...(window.__qa.section()?.querySelectorAll('table tbody tr') ?? [])].map((r) => r.textContent),
  rowIds: () => window.__qa.rows().map((t) => (t.match(/OPP-\\d+/) || [''])[0]),
  visible: (selector) => [...document.querySelectorAll(selector)].filter((el) => el.getClientRects().length > 0),
  topDialog: () => window.__qa.visible('[role="dialog"]').pop() ?? null,
  waitFor: async (predicate, timeout = 25000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (predicate()) return true; } catch (e) { /* keep polling */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  },
};
'ready';
`;

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
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      consoleErrors.push(message.params.args.map((a) => a.value ?? a.description).join(" "));
    }
    if (message.method === "Runtime.exceptionThrown") {
      consoleErrors.push(message.params.exceptionDetails.text);
    }
  });
  await send("Runtime.enable");
  await send("Page.enable");
}

async function setViewport(width, height, mobile) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
}

/* ---------------------------- input helpers ---------------------------- */

async function locate(selector, index = 0, text = null) {
  const payload = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .filter((el) => el.getClientRects().length > 0);
    ${text === null
      ? `const el = nodes[${index}];`
      : `const el = nodes.find((n) => n.textContent.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));`}
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  })()`);
  return payload;
}

async function click(selector, options = {}) {
  const { index = 0, text = null, delay = 400 } = options;
  const point = await locate(selector, index, text);
  if (!point) return false;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
  await sleep(delay);
  return true;
}

async function clickText(text, selector = "button", delay = 400) {
  return click(selector, { text, delay });
}

async function clickTab(label, delay = 600) {
  return click('[role="tab"]', { text: label, delay });
}

async function typeInto(selector, value) {
  const ok = await click(selector, { delay: 150 });
  if (!ok) return false;
  await evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) { el.select?.(); } })()`,
  );
  await send("Input.insertText", { text: value });
  await sleep(200);
  return true;
}

async function pressEscape() {
  for (const type of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", {
      type,
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
  }
  await sleep(500);
}

async function selectOption(triggerAriaLabel, optionLabel) {
  const opened = await click(`button[aria-label="${triggerAriaLabel}"]`, { delay: 600 });
  if (!opened) return "trigger not found or not visible";
  const available = await evaluate(
    `[...document.querySelectorAll('[role="option"]')].map((o) => o.textContent.trim())`,
  );
  if (!available.length) return "no options rendered";
  const clicked = await click('[role="option"]', { text: optionLabel, delay: 800 });
  return clicked ? true : `option "${optionLabel}" missing from ${JSON.stringify(available)}`;
}

async function reload() {
  await send("Page.navigate", { url: TARGET_URL });
  await sleep(4500);
  await evaluate(HELPERS);
  await evaluate("window.__qa.waitFor(() => window.__qa.rows().length > 0)");
  await sleep(400);
}

/* ------------------------------- passes ------------------------------- */

async function desktopPass() {
  console.log("\n--- Desktop 1440x900 ---");
  await setViewport(1440, 900, false);
  await reload();

  const initialIds = await evaluate("window.__qa.rowIds()");
  check(
    "table renders 10 rows, sorted by value descending",
    initialIds.length === 10 && initialIds[0] === "OPP-020",
    `first=${initialIds[0]}`,
  );

  const kpis = await evaluate("window.__qa.text()");
  check(
    "derived KPIs, chart and forecast render",
    kpis.includes("$1.4M") && kpis.includes("Win rate") && kpis.includes("Forecast confidence"),
  );

  // Search ---------------------------------------------------------------
  await click("header input[type=\"search\"]", { delay: 200 });
  await send("Input.insertText", { text: "Meridian" });
  await sleep(600);
  let ids = await evaluate("window.__qa.rowIds()");
  check("search filters by company", ids.length === 1 && ids[0] === "OPP-001", JSON.stringify(ids));

  await typeInto("header input[type=\"search\"]", "LinkedIn");
  await sleep(600);
  ids = await evaluate("window.__qa.rowIds()");
  check("search matches lead source", ids.length === 2, JSON.stringify(ids));

  await typeInto("header input[type=\"search\"]", "nothing-matches-this");
  await sleep(600);
  check(
    "empty state renders with recovery action",
    (await evaluate("window.__qa.text()")).includes("No opportunities found"),
  );
  await typeInto("header input[type=\"search\"]", "");
  await sleep(500);

  // Filters --------------------------------------------------------------
  await clickText("Filters");
  await sleep(400);
  check(
    "filter panel exposes stage/owner/value/date controls",
    (await evaluate("window.__qa.visible('button[aria-label=\"Filter by stage\"]').length")) === 1,
  );

  const stageResult = await selectOption("Filter by stage", "Proposal");
  const proposalRows = await evaluate("window.__qa.rows()");
  check(
    "stage filter narrows the table",
    proposalRows.length === 5 && proposalRows.every((t) => t.includes("Proposal")),
    `${proposalRows.length} rows · ${stageResult}`,
  );

  const ownerResult = await selectOption("Filter by owner", "Emmanuel A.");
  const combined = await evaluate("window.__qa.rows()");
  check(
    "stage + owner filters combine",
    combined.length === 1 &&
      combined.every((t) => t.includes("Proposal") && t.includes("Emmanuel A.")),
    `${combined.length} rows · ${ownerResult}`,
  );

  const valueResult = await selectOption("Filter by deal value", "$50K – $100K");
  const valueRows = await evaluate("window.__qa.rows()");
  check(
    "value filter intersects with the others (Meridian is $84K)",
    valueRows.length === 1 && valueRows[0].includes("Meridian"),
    `${valueRows.length} rows · ${valueResult}`,
  );

  const noMatch = await selectOption("Filter by deal value", "Under $25K");
  const noMatchRows = await evaluate("window.__qa.rows()");
  check(
    "impossible filter combination shows the empty state",
    noMatchRows.length === 0 &&
      (await evaluate("window.__qa.text()")).includes("No opportunities found"),
    noMatch,
  );

  await clickText("Reset filters");
  await sleep(500);
  check("reset filters restores 10 rows", (await evaluate("window.__qa.rowIds().length")) === 10);

  // Export ---------------------------------------------------------------
  await clickText("Export");
  await sleep(900);
  check(
    "CSV export confirms with a toast",
    (await evaluate("window.__qa.text()")).includes("CSV export started"),
  );

  // Pagination + sorting -------------------------------------------------
  await clickText("2", 'nav[aria-label="Pagination"] button');
  await sleep(400);
  check("pagination advances to page 2", (await evaluate("window.__qa.text()")).includes("Showing 11"));
  await clickText("Previous");
  await sleep(400);

  await clickText("Value", "th button");
  const ascending = await evaluate("window.__qa.rowIds()");
  check("sorting toggles to ascending", ascending[0] === "OPP-013", `first=${ascending[0]}`);
  await clickText("Value", "th button");
  await sleep(300);

  // Create + validation --------------------------------------------------
  await clickText("New opportunity");
  await sleep(600);
  check("create dialog opens", await evaluate("Boolean(window.__qa.topDialog())"));

  await clickText("Create opportunity", '[role="dialog"] button[type="submit"]', 600);
  const validation = await evaluate("window.__qa.upper()");
  check(
    "validation blocks an empty submit",
    validation.includes("COMPANY NAME IS REQUIRED") && validation.includes("DEAL VALUE IS REQUIRED"),
  );

  await typeInto("#opp-company", "QA Verification Ltd");
  await typeInto("#opp-contact", "Test Contact");
  await typeInto("#opp-value", "999000");
  await clickText("Create opportunity", '[role="dialog"] button[type="submit"]', 1000);
  const afterCreate = await evaluate("window.__qa.text()");
  const createdIds = await evaluate("window.__qa.rowIds()");
  check(
    "created opportunity updates the table and metrics",
    afterCreate.includes("Opportunity created successfully") &&
      afterCreate.includes("21 opportunities") &&
      createdIds[0] === "OPP-021",
    `first=${createdIds[0]}`,
  );

  // Edit (from the row action menu) --------------------------------------
  await click('button[aria-label^="Actions for"]');
  await sleep(500);
  const openedMenu = await clickText("Edit opportunity", '[role="menuitem"]', 900);
  const editText = await evaluate("window.__qa.upper()");
  check(
    "row action menu opens a pre-filled edit dialog",
    openedMenu && editText.includes("EDIT OPPORTUNITY") && editText.includes("QA VERIFICATION LTD"),
  );
  await typeInto("#opp-value", "111000");
  await clickText("Save changes", '[role="dialog"] button[type="submit"]', 1000);
  const afterEdit = await evaluate("window.__qa.text()");
  check(
    "saving recalculates the dashboard",
    afterEdit.includes("Opportunity updated") && afterEdit.includes("$111,000"),
  );

  // Kanban ---------------------------------------------------------------
  await clickTab("Board", 1200);
  const board = await evaluate(`(() => ({
    columns: document.querySelectorAll('section[aria-label*="column"]').length,
    cards: document.querySelectorAll('article[draggable="true"]').length,
    hint: document.body.innerText.includes('Drag a card between stages'),
  }))()`);
  check(
    "kanban renders seven columns with draggable cards",
    board.columns === 7 && board.cards === 21 && board.hint,
    JSON.stringify(board),
  );

  const dragDrop = await evaluate(`(async () => {
    const card = document.querySelector('article[draggable="true"]');
    const company = card.querySelector('button')?.innerText.split('\\n')[0];
    const data = new DataTransfer();
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: data }));
    const target = [...document.querySelectorAll('section[aria-label*="column"]')][3];
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: data }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: data }));
    await new Promise((r) => setTimeout(r, 900));
    return { toast: document.body.innerText.includes('Stage changed to'), company };
  })()`);
  check(
    "drag-and-drop between stages moves the deal",
    dragDrop.toast === true,
    JSON.stringify(dragDrop),
  );

  // Detail drawer --------------------------------------------------------
  await clickTab("Table", 800);
  await evaluate("window.__qa.section().querySelector('tbody tr')?.click()");
  await sleep(900);
  const drawer = await evaluate(`(() => {
    const panel = window.__qa.topDialog();
    if (!panel) return { open: false };
    const text = panel.innerText.toUpperCase();
    return {
      open: true,
      details: text.includes('OPPORTUNITY DETAILS'),
      timeline: text.includes('TIMELINE'),
      actions: text.includes('MARK AS WON') && text.includes('ADD ACTIVITY') && text.includes('EDIT'),
      fields: text.includes('LEAD SOURCE') && text.includes('EXPECTED CLOSE') && text.includes('EMAIL'),
    };
  })()`);
  check(
    "detail drawer shows details, timeline and actions",
    drawer.open && drawer.details && drawer.timeline && drawer.actions && drawer.fields,
    JSON.stringify(drawer),
  );

  const stageResult2 = await selectOption("Change pipeline stage", "Proposal");
  const afterStageChange = await evaluate("window.__qa.text()");
  check(
    "drawer stage selector moves the deal",
    afterStageChange.includes("Stage changed to Proposal"),
    String(stageResult2),
  );

  const addActivity = await (async () => {
    const opened = await clickText("Add activity", '[role="dialog"] button', 600);
    if (!opened) return "no add activity button";
    await typeInto("#activity-text", "QA call logged");
    await clickText("Log activity", '[role="dialog"] button', 900);
    return (await evaluate("window.__qa.text()")).includes("Activity logged");
  })();
  check("logging an activity updates the timeline", addActivity === true, String(addActivity));

  await pressEscape();
  await sleep(400);
  check(
    "escape closes the drawer",
    (await evaluate("window.__qa.visible('[role=\"dialog\"]').length")) === 0,
    JSON.stringify(await evaluate("window.__qa.visible('[role=\"dialog\"]').map((d) => d.innerText.slice(0, 30))")),
  );

  // Other views ----------------------------------------------------------
  for (const [nav, expected] of [
    ["Settings", "WORKSPACE SETTINGS"],
    ["Forecast", "FORECAST CONFIDENCE"],
    ["Accounts", "OPEN VALUE"],
    ["Tasks", "REMAINING"],
    ["Activities", "ACTIVITY LOG"],
  ]) {
    await clickText(nav, "button", 900);
    const text = await evaluate("window.__qa.upper()");
    check(`"${nav}" view renders`, text.includes(expected));
  }

  const layoutResult = await clickText("Settings", "button", 800).then(() =>
    selectOption("Default pipeline layout", "Board (Kanban)"),
  );
  await clickText("Overview", "button", 900);
  const columns = await evaluate("document.querySelectorAll('section[aria-label*=\"column\"]').length");
  check("settings change the pipeline layout", columns === 7, `columns=${columns} · ${layoutResult}`);

  await clickText("Settings", "button", 700);
  await selectOption("Default pipeline layout", "Table");
  await clickText("Overview", "button", 800);

  check("no console errors on desktop", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
}

async function tabletPass() {
  console.log("\n--- Tablet / laptop widths ---");
  for (const width of [768, 1024, 1280]) {
    await setViewport(width, 900, false);
    await reload();
    const overflow = await evaluate(
      "({ doc: document.documentElement.scrollWidth, win: window.innerWidth })",
    );
    check(
      `no horizontal overflow at ${width}px`,
      overflow.doc <= overflow.win + 1,
      JSON.stringify(overflow),
    );
  }

  await setViewport(768, 900, false);
  await reload();
  check(
    "tablet uses the drawer nav (sidebar hidden below lg)",
    (await evaluate("window.__qa.visible('aside[aria-label=\"Sidebar\"]').length")) === 0 &&
      (await evaluate("window.__qa.visible('button[aria-label=\"Open navigation menu\"]').length")) === 1,
  );
  check(
    "tablet shows the table, not the mobile card list",
    (await evaluate("window.__qa.visible('[role=\"button\"][aria-label^=\"Open \"]').length")) === 0 &&
      (await evaluate("window.__qa.visible('th button').length")) > 0,
  );

  await setViewport(1280, 900, false);
  await reload();
  check(
    "laptop shows the fixed sidebar",
    (await evaluate("window.__qa.visible('aside[aria-label=\"Sidebar\"]').length")) === 1,
  );
}

async function mobilePass() {
  console.log("\n--- Mobile 390x844 ---");
  await setViewport(390, 844, true);
  await reload();

  const overflow = await evaluate("({ doc: document.documentElement.scrollWidth, win: window.innerWidth })");
  check("no page-level horizontal overflow", overflow.doc <= overflow.win + 1, JSON.stringify(overflow));
  check(
    "desktop sidebar hidden on mobile",
    (await evaluate("window.__qa.visible('aside[aria-label=\"Sidebar\"]').length")) === 0,
  );

  await click('button[aria-label="Open navigation menu"]', { delay: 900 });
  check(
    "hamburger opens the navigation drawer",
    await evaluate(
      "document.body.innerText.toUpperCase().includes('REVENUE OS') && Boolean(window.__qa.topDialog())",
    ),
  );
  await pressEscape();
  check(
    "navigation drawer closes",
    (await evaluate("window.__qa.visible('[role=\"dialog\"]').length")) === 0,
  );

  const cards = await evaluate(
    "document.querySelectorAll('[role=\"button\"][aria-label^=\"Open \"]').length",
  );
  check("table rows become responsive cards", cards === 10, `cards=${cards}`);

  await clickText("Filters");
  await sleep(700);
  const sheet = await evaluate(`(() => {
    const panel = window.__qa.topDialog();
    return panel ? panel.innerText.toUpperCase().includes('FILTER OPPORTUNITIES') : false;
  })()`);
  check("filters collapse into a bottom sheet", sheet);
  await pressEscape();
  await sleep(400);

  await click('[role="button"][aria-label^="Open "]', { delay: 900 });
  const drawer = await evaluate(`(() => {
    const panel = window.__qa.topDialog();
    if (!panel) return { open: false };
    const rect = panel.getBoundingClientRect();
    return {
      open: true,
      fullWidth: rect.width >= window.innerWidth - 2,
      actions: panel.innerText.toUpperCase().includes('MARK AS WON'),
    };
  })()`);
  check(
    "detail drawer is full-screen with actions reachable",
    drawer.open && drawer.fullWidth && drawer.actions,
    JSON.stringify(drawer),
  );
  await pressEscape();

  const finalOverflow = await evaluate("({ doc: document.documentElement.scrollWidth, win: window.innerWidth })");
  check("no overflow after interactions", finalOverflow.doc <= finalOverflow.win + 1, JSON.stringify(finalOverflow));
  check("no console errors on mobile", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
}

async function main() {
  await connect();
  await desktopPass();
  await tabletPass();
  await mobilePass();

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) failed.forEach((r) => console.log(` - ${r.label}`));
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error("QA harness error:", error);
  process.exit(2);
});
