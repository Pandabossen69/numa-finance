/**
 * Spec Z2 — hydration pass (Playwright, local seed only).
 *
 *   cd /tmp/pw && node /workspace/artifacts/z2-build/hydration-pass.mjs
 *
 * Env: BASE, OUT, EMAIL, PASSWORD
 * Browser: 390×844, isMobile, sv-SE, Asia/Bangkok, service workers blocked.
 */
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire("/tmp/pw/package.json");
const { chromium } = require("playwright-core");

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "/workspace/artifacts/z2-build/hydration-pass.json";
const EMAIL = process.env.EMAIL || "z2-local@example.com";
const PASSWORD = process.env.PASSWORD || "local-z2-pass";
const HIT = /hydrat|418|did not match|server rendered/i;

const HARD = [
  "/idag",
  "/plan",
  "/analys",
  "/mer",
  "/fota",
  "/transaktioner",
  "/konton",
];

const SOFT = [
  { path: "/idag", label: "Hem", via: "bottom" },
  { path: "/plan", label: "Plan", via: "bottom" },
  { path: "/analys", label: "Analys", via: "bottom" },
  { path: "/mer", label: "Mer", via: "bottom" },
  { path: "/fota", label: "Lägg till", via: "bottom" },
  { path: "/transaktioner", label: "Rörelser", via: "mer" },
  { path: "/konton", label: "Konton", via: "mer" },
  { path: "/idag", label: "Hem", via: "bottom" },
];

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "sv-SE",
  timezoneId: "Asia/Bangkok",
  serviceWorkers: "block",
  deviceScaleFactor: 2,
});

await context.addInitScript(() => {
  const state = {
    framesWithLoading: 0,
    sawLoading: false,
    firstLoadingAt: null,
    clearedAt: null,
    samples: [],
  };
  window.__z2Paint = state;
  function tick(now) {
    const loading = document.querySelector("[data-numa-view-loading]");
    if (loading) {
      state.sawLoading = true;
      state.framesWithLoading += 1;
      if (state.firstLoadingAt == null) state.firstLoadingAt = now;
    } else if (state.sawLoading && state.clearedAt == null) {
      state.clearedAt = now;
    }
    if (location.pathname === "/idag" && state.samples.length < 12) {
      const money = [
        ...document.querySelectorAll(".numa-hero-money, .money, [data-money]"),
      ]
        .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 6);
      state.samples.push({ now, money });
    }
    if (state.clearedAt == null && now < 8000) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
});

const page = await context.newPage();
const logs = [];
page.on("console", (msg) => {
  logs.push({ t: Date.now(), kind: "console", type: msg.type(), text: msg.text() });
});
page.on("pageerror", (err) => {
  logs.push({
    t: Date.now(),
    kind: "pageerror",
    type: "pageerror",
    text: String(err?.stack || err),
  });
});

function hitsSince(mark) {
  return logs.slice(mark).filter((row) => HIT.test(row.text));
}

async function login() {
  await page.goto(`${BASE}/logga-in`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/logga-in"), { timeout: 30000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await page.waitForTimeout(800);
}

async function clickBottom(label) {
  const clicked = await page.evaluate((wanted) => {
    const hit = document.querySelector(
      `nav[aria-label="Huvudnavigering"] a[aria-label="${wanted}"]`,
    );
    if (!hit) return false;
    hit.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`missing bottom nav ${label}`);
}

async function clickMer(label) {
  await clickBottom("Mer");
  await page.waitForTimeout(400);
  const clicked = await page.evaluate((wanted) => {
    const links = [...document.querySelectorAll("a")].filter((anchor) => {
      if (!(anchor.textContent || "").includes(wanted)) return false;
      if (anchor.closest("[hidden], [inert]")) return false;
      const style = getComputedStyle(anchor);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    const hit = links[0];
    if (!hit) return false;
    hit.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`missing visible mer link ${label}`);
}

async function paintSnapshot() {
  return page.evaluate(() => {
    const state = window.__z2Paint;
    return state
      ? {
          framesWithLoading: state.framesWithLoading,
          sawLoading: state.sawLoading,
          firstLoadingAt: state.firstLoadingAt,
          clearedAt: state.clearedAt,
          samples: state.samples,
          loadingNow: Boolean(document.querySelector("[data-numa-view-loading]")),
        }
      : null;
  });
}

await login();
// Fill persist + cookie before measuring, or the mismatch stays hidden.
for (const path of ["/idag", "/analys", "/konton"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1200);
}
const warmed = {
  cookie: await page.evaluate(() => {
    const hit = document.cookie
      .split("; ")
      .find((part) => part.startsWith("numa.lastHome.v1="));
    return hit ? hit.slice("numa.lastHome.v1=".length) : null;
  }),
  path: await page.evaluate(() => location.pathname),
};

const maxPasses = Number(process.env.MAX_PASSES || "3");
const hardPasses = [];
for (let pass = 1; pass <= maxPasses; pass++) {
  const rows = [];
  for (const path of HARD) {
    const mark = logs.length;
    const response = await page.goto(`${BASE}${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(900);
    const html = response ? await response.text().catch(() => "") : "";
    const paint = await paintSnapshot();
    rows.push({
      path,
      status: response?.status() ?? null,
      hits: hitsSince(mark).map((row) => ({
        kind: row.kind,
        type: row.type,
        text: row.text.slice(0, 1800),
      })),
      paint,
      ssrHasLoading: html.includes("data-numa-view-loading"),
      ssrHas12500: /12[\s\u00a0\u202f]?500,50/.test(html),
      ssrHasZero: /(?<!\d)0,00/.test(html),
    });
    console.log(
      "hard",
      path,
      "hits",
      rows[rows.length - 1].hits.length,
      "frames",
      rows[rows.length - 1].paint?.framesWithLoading ?? null,
      "cleared",
      rows[rows.length - 1].paint?.clearedAt ?? null,
    );
  }
  hardPasses.push(rows);
  const passHits = rows.reduce((sum, row) => sum + row.hits.length, 0);
  if (passHits === 0) break;
}

const soft = [];
let softError = null;
try {
  for (const step of SOFT) {
    const mark = logs.length;
    if (step.via === "bottom") await clickBottom(step.label);
    else await clickMer(step.label);
    await page.waitForTimeout(700);
    soft.push({
      path: step.path,
      actual: await page.evaluate(() => location.pathname),
      hits: hitsSince(mark).map((row) => ({
        kind: row.kind,
        type: row.type,
        text: row.text.slice(0, 800),
      })),
    });
    console.log("soft", step.path, soft[soft.length - 1].actual, soft[soft.length - 1].hits.length);
  }
} catch (error) {
  softError = String(error);
  console.error(softError);
}

const hard = hardPasses[hardPasses.length - 1];
const summary = {
  base: BASE,
  locale: "sv-SE",
  timezone: "Asia/Bangkok",
  viewport: "390x844",
  warmed,
  softError,
  hardPasses: hardPasses.map((rows) =>
    rows.map((row) => ({ path: row.path, hits: row.hits.length })),
  ),
  hardHitCount: hard.reduce((sum, row) => sum + row.hits.length, 0),
  softHitCount: soft.reduce((sum, row) => sum + row.hits.length, 0),
  hard,
  soft,
};
fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify(
    {
      out: OUT,
      hardHitCount: summary.hardHitCount,
      softHitCount: summary.softHitCount,
      passes: summary.hardPasses,
      soft: soft.map((row) => [row.path, row.actual, row.hits.length]),
      paint: hard
        .filter((row) => row.path === "/analys" || row.path === "/konton" || row.path === "/idag")
        .map((row) => ({
          path: row.path,
          frames: row.paint?.framesWithLoading ?? null,
          clearedAt: row.paint?.clearedAt ?? null,
          sawLoading: row.paint?.sawLoading ?? null,
          ssrHas12500: row.ssrHas12500,
          ssrHasLoading: row.ssrHasLoading,
          hits: row.hits.length,
        })),
    },
    null,
    2,
  ),
);
await browser.close();
