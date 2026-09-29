import { launchBrowser } from "./browser.mjs";
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, colorScheme: "dark" });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e.message)));

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[name="username"]', "viewer");
await page.fill('input[name="password"]', "view123");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
await page.click('a[href="/network"]');
await page.waitForSelector(".react-flow__node", { timeout: 15000 });

// zone filter → Secondary
await page.locator("[data-slot=select-trigger]").first().click();
await page.locator("[role=option]", { hasText: "Secondary" }).first().click();
await page.waitForTimeout(500);
const afterZone = await page.locator(".react-flow__node:visible").count();

// status filter → Has open alarm (keep zone all first)
await page.locator("[data-slot=select-trigger]").first().click();
await page.locator("[role=option]", { hasText: "All zones" }).first().click();
await page.locator("[data-slot=select-trigger]").nth(1).click();
await page.locator("[role=option]", { hasText: "Has open alarm" }).first().click();
await page.waitForTimeout(500);
const afterAlarm = await page.locator(".react-flow__node:visible").count();

// reset status, test search
await page.locator("[data-slot=select-trigger]").nth(1).click();
await page.locator("[role=option]", { hasText: "Any status" }).first().click();
await page.fill('input[placeholder="Search node…"]', "CNG");
await page.waitForTimeout(500);
const afterSearch = await page.locator(".react-flow__node:visible").count();

// viewer: open drawer, ack must be ABSENT
await page.fill('input[placeholder="Search node…"]', "");
await page.waitForTimeout(300);
const cng01 = page.locator(".react-flow__node", { hasText: "CNG-01" }).first();
await cng01.click();
await page.waitForSelector("text=Open alarms", { timeout: 8000 });
const ackCount = await page.locator('button:has-text("Ack")').count();
await page.screenshot({ path: "/tmp/shot-07-filter-drawer.png" });

console.log("zone=secondary visible:", afterZone, "(expect 7)");
console.log("status=alarm visible:", afterAlarm, "(expect >0)");
console.log("search=CNG visible:", afterSearch, "(expect 4)");
console.log("viewer ack buttons:", ackCount, "(expect 0)");
console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
