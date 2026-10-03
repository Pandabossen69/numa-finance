/**
 * Three Sätt av + Nollställ rounds against a local server.
 * Prints button outcome. DB dump is done separately.
 *
 *   cd /tmp/pw && node /workspace/artifacts/z2-build/savings-rounds.mjs
 */
import { createRequire } from "node:module";

const require = createRequire("/tmp/pw/package.json");
const { chromium } = require("playwright-core");

const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.EMAIL || "z2-local@example.com";
const PASSWORD = process.env.PASSWORD || "local-z2-pass";

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
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 200)));

async function clickText(text) {
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate((wanted) => {
      const hit = [...document.querySelectorAll("button")].find((button) => {
        if ((button.textContent || "").trim() !== wanted) return false;
        if (button.disabled) return false;
        if (button.closest("[hidden], [inert]")) return false;
        return true;
      });
      if (!hit) return false;
      hit.click();
      return true;
    }, text);
    if (ok) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`could not click ${text}`);
}

function waitPlanPost() {
  return page.waitForResponse(
    (res) => res.url().includes("/plan") && res.request().method() === "POST",
    { timeout: 15000 },
  );
}

async function waitIdle(label) {
  for (let i = 0; i < 40; i++) {
    const pending = await page.evaluate(() =>
      [...document.querySelectorAll("button")].some((button) =>
        /Sparar/.test(button.textContent || ""),
      ),
    );
    if (!pending) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} still saving`);
}

await page.goto(`${BASE}/logga-in`, { waitUntil: "domcontentloaded" });
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await Promise.all([
  page.waitForURL((url) => !url.pathname.startsWith("/logga-in"), { timeout: 30000 }),
  page.locator('button[type="submit"]').click(),
]);
await page.goto(`${BASE}/plan`, { waitUntil: "domcontentloaded" });
await page.locator('input[aria-label^="Sätt av"]').waitFor({ timeout: 20000 });
await page.waitForTimeout(600);

const hasNoll = await page.evaluate(() =>
  [...document.querySelectorAll("button")].some(
    (button) => (button.textContent || "").trim() === "Nollställ",
  ),
);
if (hasNoll) {
  const posted = waitPlanPost();
  await clickText("Nollställ");
  console.log("clear post", (await posted).status());
  await waitIdle("clear");
  console.log("cleared existing");
}

for (let n = 1; n <= 3; n++) {
  const amount = String(300 + n);
  await page.evaluate((value) => {
    const input = document.querySelector('input[aria-label^="Sätt av"]');
    const proto = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    );
    proto.set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, amount);
  const posted = waitPlanPost();
  await clickText("Sätt av från Över");
  console.log("round", n, "post", (await posted).status());
  await waitIdle(`round ${n} sätt av`);
  const stuck = await page.evaluate(() => {
    const noll = [...document.querySelectorAll("button")].some(
      (button) => (button.textContent || "").trim() === "Nollställ",
    );
    return noll ? null : document.querySelector("[role=alert]")?.textContent || "no nollställ";
  });
  if (stuck) throw new Error(`round ${n} ${stuck}`);
  const cleared = waitPlanPost();
  await clickText("Nollställ");
  console.log("round", n, "clear", (await cleared).status());
  await waitIdle(`round ${n} nollställ`);
  console.log("round", n, "ok");
}

console.log("pageerrors", pageErrors.length);
await browser.close();
