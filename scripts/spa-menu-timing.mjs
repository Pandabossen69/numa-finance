import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.NUMA_BASE ?? "http://localhost:3000";
const ART = "/opt/cursor/artifacts";
const email = process.env.NUMA_EMAIL ?? "perf@numa.test";
const password = process.env.NUMA_PASSWORD ?? "PerfTest123!";
mkdirSync(ART, { recursive: true });

const TABS = ["/idag", "/plan", "/analys", "/mer"];

async function login(page) {
  await page.goto(`${BASE}/logga-in`, { waitUntil: "networkidle" });
  if (!page.url().includes("logga-in")) return;
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("logga-in"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
}

/** Measure DOM paint in the same turn as pointerdown (NextStep-style). */
async function measureTap(page, href) {
  return page.evaluate((dest) => {
    const a = document.querySelector(`nav.numa-bottom-nav a[href="${dest}"]`);
    if (!a) return { error: `missing link ${dest}` };
    const t0 = performance.now();
    a.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 0,
        pointerId: 1,
        pointerType: "touch",
      }),
    );
    const t1 = performance.now();
    const panel = document.querySelector(`[data-numa-spa-tab="${dest}"]`);
    const ok =
      !!panel &&
      panel.getAttribute("data-numa-spa-visible") === "1" &&
      !panel.hasAttribute("hidden");
    return {
      dest,
      ms: Math.round((t1 - t0) * 1000) / 1000,
      ok,
      path: location.pathname,
    };
  }, href);
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await login(page);
await page.goto(`${BASE}/idag`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const timings = [];
for (const href of TABS) {
  timings.push({ phase: "warm", ...(await measureTap(page, href)) });
  await page.waitForTimeout(50);
}

const rapid = [
  ["/idag", "/plan"],
  ["/plan", "/analys"],
  ["/analys", "/mer"],
  ["/mer", "/idag"],
  ["/idag", "/analys"],
  ["/analys", "/plan"],
  ["/plan", "/mer"],
  ["/mer", "/idag"],
  ["/idag", "/plan"],
  ["/plan", "/idag"],
  ["/idag", "/mer"],
  ["/mer", "/analys"],
];

for (const [from, to] of rapid) {
  await measureTap(page, from);
  const r = await measureTap(page, to);
  timings.push({ phase: "rapid", from, ...r });
  console.log(`${from} → ${to}: ${r.ms} ms ok=${r.ok}`);
}

const rapidMs = timings.filter((t) => t.phase === "rapid" && t.ok).map((t) => t.ms);
const summary = {
  count: rapidMs.length,
  min: Math.min(...rapidMs),
  max: Math.max(...rapidMs),
  avg: Math.round((rapidMs.reduce((a, b) => a + b, 0) / rapidMs.length) * 1000) / 1000,
  allOk: timings.filter((t) => t.phase === "rapid").every((t) => t.ok),
  timings,
};
writeFileSync(`${ART}/spa_menu_timings.json`, JSON.stringify(summary, null, 2));
await page.screenshot({ path: `${ART}/spa_menu_after_rapid.png` });
console.log("SUMMARY", summary);
await browser.close();
if (!summary.allOk || summary.max > 16) process.exitCode = 1;
