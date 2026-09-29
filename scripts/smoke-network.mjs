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

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="username"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });

await page.click('a[href="/network"]');
await page.waitForURL("**/network", { timeout: 10000 });
await page.waitForSelector(".react-flow__node", { timeout: 15000 });
const nodeCount = await page.locator(".react-flow__node").count();
await page.waitForTimeout(800);
await page.screenshot({ path: "/tmp/shot-04-graph.png" });

// open drawer on a station node (CGS-01 badge inside node)
const station = page.locator(".react-flow__node", { hasText: "CGS-01" }).first();
await station.click();
await page.waitForSelector("text=Open alarms", { timeout: 10000 });
await page.waitForTimeout(4200); // one drawer poll cycle
await page.screenshot({ path: "/tmp/shot-05-drawer.png" });

const hasAck = (await page.locator('button:has-text("Ack")').count()) > 0;
const drawerText = await page.locator("[role=dialog]").first().innerText();

// filter: zone = secondary
await page.selectOption("[data-slot=select-trigger] >> nth=0", "secondary").catch(() => {});
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
const visibleAfterFilter = await page.locator(".react-flow__node:visible").count();
await page.screenshot({ path: "/tmp/shot-06-filter.png" });

console.log("nodes rendered:", nodeCount);
console.log("drawer has Ack:", hasAck);
console.log("drawer snippet:", drawerText.split("\n").slice(0, 12).join(" | "));
console.log("visible after zone=secondary filter:", visibleAfterFilter);
console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
