import { chromium } from "playwright-core";
const EXE = "/Users/pallabpc/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, colorScheme: "dark" });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e.message)));

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[name="username"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });

// ---- stations register ----
await page.click('a[href="/stations"]');
await page.waitForURL("**/stations", { timeout: 10000 });
await page.waitForSelector("table tbody tr", { timeout: 10000 });
const rows = await page.locator("table tbody tr").count();
const sparks = await page.locator("table tbody tr svg").count();

// filter: kind = CNG
await page.locator('button[role="combobox"]').first().click();
await page.locator('[role="option"]', { hasText: "CNG" }).first().click();
await page.waitForTimeout(400);
const cngRows = await page.locator("table tbody tr").count();
await page.screenshot({ path: "/tmp/shot-11-stations.png" });

// search
await page.fill('input[placeholder="Search code or name…"]', "CGS");
await page.waitForTimeout(300);
await page.locator('button[role="combobox"]').first().click();
await page.locator('[role="option"]', { hasText: "All kinds" }).first().click();
await page.waitForTimeout(300);
const cgsRows = await page.locator("table tbody tr").count();
console.log("register rows:", rows, "| sparklines:", sparks, "| CNG filter:", cngRows, "| search CGS:", cgsRows);

// ---- station detail ----
await page.fill('input[placeholder="Search code or name…"]', "");
await page.waitForTimeout(300);
await page.locator('a[href^="/stations/"]').first().click();
await page.waitForURL(/\/stations\/\d+/, { timeout: 10000 });
await page.waitForSelector("text=24-hour pressure", { timeout: 10000 });
await page.waitForSelector(".recharts-bar-rectangle", { timeout: 10000 });
const gauge = await page.locator("text=Live pressure").count();
const chartPaths = await page.locator(".recharts-surface path").count();
await page.screenshot({ path: "/tmp/shot-12-station.png", fullPage: false });

// tabs: work orders
await page.click('button[role="tab"]:has-text("Work orders")');
await page.waitForTimeout(400);
const woVisible = await page.locator("text=Open work order board").count();
await page.screenshot({ path: "/tmp/shot-13-station-wo.png" });
console.log("detail: gauge:", gauge, "| chart paths:", chartPaths, "| wo tab:", woVisible);

// ---- telemetry explorer ----
await page.click('a[href="/telemetry"]');
await page.waitForURL("**/telemetry", { timeout: 10000 });
await page.waitForSelector(".recharts-wrapper", { timeout: 15000 });
await page.waitForTimeout(800);
const lines24 = await page.locator(".recharts-line-curve").count();
const statRows = await page.locator("tbody tr").count();

// metric switch → flow
await page.click('button:has-text("Flow")');
await page.waitForTimeout(1200);
const linesFlow = await page.locator(".recharts-line-curve").count();

// range switch → 7d
await page.click('button:has-text("7D")');
await page.waitForTimeout(1500);
const axis7d = await page.locator(".recharts-xAxis .recharts-cartesian-axis-tick").count();
await page.screenshot({ path: "/tmp/shot-14-telemetry.png", fullPage: false });

// add third asset via popover
await page.click('button:has-text("Assets (")');
await page.waitForTimeout(300);
const boxes = page.locator('[role="dialog"] input[type="checkbox"], [data-radix-popper-content-wrapper] input[type="checkbox"]');
const n = await boxes.count();
for (let i = 0; i < Math.min(n, 3); i++) {
  const b = boxes.nth(i);
  if (!(await b.isChecked())) await b.click();
  await page.waitForTimeout(150);
}
await page.keyboard.press("Escape");
await page.waitForTimeout(1200);
const lines3 = await page.locator(".recharts-line-curve").count();
await page.screenshot({ path: "/tmp/shot-15-telemetry-multi.png", fullPage: false });
console.log("telemetry: lines(24h p):", lines24, "| stat rows:", statRows, "| lines flow:", linesFlow, "| 7d ticks:", axis7d, "| lines multi:", lines3);

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
