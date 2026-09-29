import { chromium } from "playwright-core";

const EXE =
  "/Users/pallabpc/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const BASE = "http://localhost:3000";

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({
  viewport: { width: 1560, height: 1000 },
  colorScheme: "dark",
});

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

// 1. login page
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/shot-01-login.png" });

// 2. sign in as admin
await page.fill('input[name="username"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
await page.waitForSelector("text=Gas intake", { timeout: 15000 });
await page.waitForTimeout(4000); // let charts + first poll render
await page.screenshot({ path: "/tmp/shot-02-dashboard.png", fullPage: true });

// 3. navigate a couple of routes via sidebar
for (const [label, path] of [
  ["Alarms", "/alarms"],
  ["Network graph", "/network"],
]) {
  await page.click(`a[href="${path}"]`);
  await page.waitForURL(`**${path}`, { timeout: 10000 });
  await page.waitForTimeout(600);
  console.log("visited:", label, path);
}
await page.screenshot({ path: "/tmp/shot-03-network.png" });

// 4. live status pill content
const live = await page.locator("header").first().innerText();

console.log("URL now:", page.url());
console.log("header text:", live.replace(/\n/g, " | "));
console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
