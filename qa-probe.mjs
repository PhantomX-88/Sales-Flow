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
  await send("Page.navigate", { url: TARGET_URL });
  await sleep(8000);

  const probe = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const rows = () => {
      const section = document.getElementById('opportunities-heading')?.closest('section');
      return [...(section?.querySelectorAll('table tbody tr') ?? [])].map((r) => r.textContent);
    };
    const clickFilters = () => {
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Filters');
      if (!button) return false;
      button.click();
      return true;
    };

    if (!clickFilters()) return 'no filters button';
    await sleep(700);

    const trigger = document.querySelector('button[aria-label="Filter by stage"]');
    if (!trigger) return 'filters panel did not render a stage select';

    // open the select with a pointerdown (this is what Radix listens for)
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true }));
    await sleep(700);

    const optionTexts = [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent.trim());
    const option = [...document.querySelectorAll('[role="option"]')].find((o) => o.textContent.trim() === 'Proposal');
    if (!option) return { step: 'options missing', optionTexts };

    const attempts = [];
    const tryStrategy = async (name, run) => {
      run();
      await sleep(900);
      const texts = rows();
      attempts.push({
        name,
        count: texts.length,
        allProposal: texts.length > 0 && texts.every((t) => t.includes('Proposal')),
      });
    };

    await tryStrategy('pointerdown+pointerup+click', () => {
      option.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true }));
      option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, isPrimary: true }));
      option.click();
    });

    let reopened = document.querySelector('[role="option"]');
    if (!reopened) {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true }));
      await sleep(600);
    }

    await tryStrategy('mousedown+mouseup+click', () => {
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
      option.click();
    });

    reopened = document.querySelector('[role="option"]');
    if (!reopened) {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true }));
      await sleep(600);
    }

    await tryStrategy('pointerup only', () => {
      option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, isPrimary: true }));
    });

    reopened = document.querySelector('[role="option"]');
    if (!reopened) {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true }));
      await sleep(600);
    }

    await tryStrategy('focus + Enter', () => {
      option.focus();
      option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    return { optionTexts, attempts, triggerText: trigger.textContent.trim() };
  })()`);

  console.log(JSON.stringify(probe, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error("probe error:", error);
  process.exit(2);
});
