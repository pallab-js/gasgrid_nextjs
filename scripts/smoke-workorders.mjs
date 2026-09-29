import { chromium } from "playwright-core";
const EXE = "/Users/pallabpc/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const errors = [];

async function login(page, user, pass) {
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
}

const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, colorScheme: "dark" });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e.message)));

await login(page, "admin", "admin123");
await page.click('a[href="/work-orders"]');
await page.waitForURL("**/work-orders", { timeout: 10000 });
await page.waitForSelector("text=Open", { timeout: 10000 });
await page.waitForTimeout(600);
const cards = await page.locator(".rounded-lg.border.border-border").count();

// create
await page.click('button:has-text("New work order")');
await page.waitForSelector("text=New work order", { timeout: 5000 });
await page.fill("#wo-title", "Smoke test: valve exercise CGS-01");
await page.locator("#wo-due").fill("2026-10-15");
await page.locator('[role="dialog"] button:has-text("Create")').click();
await page.waitForTimeout(1200);
const toast = await page.locator("text=Work order created").count();
const created = await page.locator("text=Smoke test: valve exercise CGS-01").count();
await page.screenshot({ path: "/tmp/shot-18-wo.png" });

// move status via dropdown (first card's menu)
await page.locator('button:has(svg.lucide-more-horizontal)').first().click();
await page.waitForSelector('[role="menu"]', { timeout: 5000 });
const menuItems = await page.locator('[role="menuitem"]').count();
await page.locator('[role="menuitem"]', { hasText: "In progress" }).first().click();
await page.waitForTimeout(1200);
const movedToast = await page.locator("text=→ In progress").count();
console.log("cards:", cards, "| create toast:", toast, "| created:", created, "| menu items:", menuItems, "| moved toast:", movedToast);

// viewer cannot create
const p2 = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: "dark" });
p2.on("pageerror", (e) => errors.push(String(e.message)));
await login(p2, "viewer", "view123");
await p2.goto("http://localhost:3000/work-orders", { waitUntil: "networkidle" });
await p2.waitForSelector("text=New work order", { timeout: 10000 });
const viewerBtn = p2.locator('button:has-text("New work order")');
const disabled = await viewerBtn.isDisabled();
const menus = await p2.locator('button:has(svg.lucide-more-horizontal)').count();
console.log("viewer create disabled:", disabled, "| viewer menus:", menus, "(expect 0)");

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length || !disabled || menus !== 0 ? 1 : 0);
