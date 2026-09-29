import { launchBrowser } from "./browser.mjs";
const browser = await launchBrowser();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, colorScheme: "dark" });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e.message)));

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[name="username"]', "admin");
await page.fill('input[name="password"]', "admin123");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });

await page.click('a[href="/consumers"]');
await page.waitForURL("**/consumers", { timeout: 10000 });
await page.waitForSelector("table tbody tr", { timeout: 10000 });
const pageRows = await page.locator("table tbody tr").count();
const pageLabel = await page.locator("text=page 1 of").textContent();

// category filter = CNG
await page.locator('button[role="combobox"]').first().click();
await page.locator('[role="option"]', { hasText: "CNG" }).first().click();
await page.waitForTimeout(400);
const cngRows = await page.locator("table tbody tr").count();

// search meter code after reset category
await page.locator('button[role="combobox"]').first().click();
await page.locator('[role="option"]', { hasText: "Any category" }).first().click();
await page.fill('input[placeholder="Search name, code or meter…"]', "CON-0001");
await page.waitForTimeout(400);
const searchRows = await page.locator("table tbody tr").count();
await page.screenshot({ path: "/tmp/shot-19-consumers.png" });
console.log("page rows:", pageRows, "|", pageLabel, "| CNG:", cngRows, "| search:", searchRows);

// detail
await page.fill('input[placeholder="Search name, code or meter…"]', "");
await page.waitForTimeout(300);
await page.locator('a[href^="/consumers/"]').first().click();
await page.waitForURL(/\/consumers\/\d+/, { timeout: 10000 });
await page.waitForSelector("text=Monthly consumption", { timeout: 10000 });
await page.waitForSelector(".recharts-bar-rectangle", { timeout: 10000 });
const bars = await page.locator(".recharts-bar-rectangle").count();
const invoiceRows = await page.locator("text=Invoices").count();
await page.screenshot({ path: "/tmp/shot-20-consumer-detail.png", fullPage: true });
console.log("detail bars:", bars, "| invoices section:", invoiceRows);

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
