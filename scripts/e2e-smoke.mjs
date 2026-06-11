/**
 * End-to-end smoke test: loads the built extension into a real Chrome,
 * activates MotionLens on a test page, selects an element, records a hover
 * transition, and verifies the capture and the resulting MotionGraph.
 *
 * Run: npm run build && node scripts/e2e-smoke.mjs
 */

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

import { buildMotionGraph, diffCapture } from "../packages/analysis/dist/index.js";

const EXTENSION_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../extension/build/chrome-mv3-prod",
);

const TEST_PAGE = `<!doctype html>
<html><head><style>
  body { margin: 0; display: grid; place-items: center; height: 100vh; background: #111; }
  .card {
    width: 240px; height: 140px; border-radius: 12px; background: #6d28d9;
    opacity: 0.6; transform: translateY(0);
    transition: transform 300ms ease-out, opacity 300ms ease-out;
  }
  .card:hover { opacity: 1; transform: translateY(-16px); }
</style></head>
<body><div class="card"></div></body></html>`;

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((_request, response) => {
      response.setHeader("Content-Type", "text/html");
      response.end(TEST_PAGE);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const checks = [];
function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const server = await serve();
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
  ],
});

try {
  const swTarget = await browser.waitForTarget((target) => target.type() === "service_worker", {
    timeout: 15_000,
  });
  const sw = await swTarget.worker();
  check("background service worker started", Boolean(sw));

  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await new Promise((resolve) => setTimeout(resolve, 800)); // content scripts settle

  const tabId = await sw.evaluate(async () => {
    // No "tabs" permission, so we can't match by URL — the test page is the
    // active tab in the only window.
    const tabs = await chrome.tabs.query({ active: true });
    return tabs[tabs.length - 1]?.id ?? null;
  });
  check("test tab found by background", tabId !== null, `tabId=${tabId}`);

  // PING the content script to confirm DOM access.
  const pong = await sw.evaluate(
    (id) =>
      chrome.tabs
        .sendMessage(id, { type: "motionlens/ping" })
        .catch((e) => ({ ok: false, error: String(e) })),
    tabId,
  );
  check(
    "content script answers PING with DOM info",
    pong?.ok === true,
    `elements=${pong?.dom?.elementCount}`,
  );

  // Activate (drive the same state transition the popup would).
  await sw.evaluate(async (id) => {
    await chrome.storage.session.set({ [`tab-state:${id}`]: { active: true, recording: false } });
    await chrome.tabs.sendMessage(id, {
      type: "motionlens/state-changed",
      tabId: id,
      state: { active: true, recording: false },
    });
  }, tabId);

  // Click the card to select it through the picker.
  const card = await page.$(".card");
  const box = await card.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await new Promise((resolve) => setTimeout(resolve, 300));

  const selection = await sw.evaluate(async (id) => {
    const key = `tab-selection:${id}`;
    const result = await chrome.storage.session.get(key);
    return result[key] ?? [];
  }, tabId);
  check(
    "click-to-select stored a selection",
    selection.length === 1 && selection[0].classes.includes("card"),
    selection[0]?.selector,
  );

  // Selection click must not have reached the page (read-only guarantee).
  // Move the mouse away so the card is un-hovered before recording.
  await page.mouse.move(5, 5);
  await new Promise((resolve) => setTimeout(resolve, 500));

  const startResponse = await sw.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: "motionlens/start-recording", tabId: id }),
    tabId,
  );
  check("recording started", startResponse?.ok === true, startResponse?.error);

  // Trigger the hover animation while recording.
  await new Promise((resolve) => setTimeout(resolve, 200));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await new Promise((resolve) => setTimeout(resolve, 700)); // let the 300ms transition finish

  const stopResponse = await sw.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: "motionlens/stop-recording", tabId: id }),
    tabId,
  );
  const capture = stopResponse?.capture;
  check("recording stopped with a capture", Boolean(capture), `frames=${capture?.frames?.length}`);

  if (capture) {
    const changes = diffCapture(capture);
    const properties = new Set(changes.map((change) => change.property));
    check(
      "capture recorded the opacity + transform animation",
      properties.has("opacity") && properties.has("transform"),
      [...properties].join(", "),
    );

    const opacity = changes.find((change) => change.property === "opacity");
    check(
      "opacity went 0.6 → 1 with a plausible duration",
      opacity?.from === "0.6" &&
        opacity?.to === "1" &&
        opacity.durationMs > 100 &&
        opacity.durationMs < 600,
      `${opacity?.from} → ${opacity?.to} in ${opacity?.durationMs}ms`,
    );

    const graph = buildMotionGraph(capture);
    check("trigger classified as hover", graph.trigger === "hover", graph.trigger);
    check(
      "motion types include fade + translate",
      graph.nodes.some((node) => node.motionTypes.includes("fade")) &&
        graph.nodes.some((node) => node.motionTypes.includes("translate")),
      graph.nodes.map((node) => node.motionTypes.join("/")).join(", "),
    );
    const easing = graph.nodes[0]?.changes.find((c) => c.property === "opacity")?.easing;
    check("easing detected (expected ease-out family)", Boolean(easing), easing);
  }
} finally {
  await browser.close();
  server.close();
}

const failed = checks.filter((entry) => !entry.passed);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
