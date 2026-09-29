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

const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, colorScheme: "dark" });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e.message)));

await login(page, "admin", "admin123");
await page.click('a[href="/alarms"]');
await page.waitForURL("**/alarms", { timeout: 10000 });
await page.waitForSelector("table tbody tr", { timeout: 10000 });
const openRows = await page.locator("table tbody tr").count();
const kpis = await page.locator("text=Critical open").count();

// severity filter = critical
await page.locator('button[role="combobox"]').first().click();
await page.locator('[role="option"]', { hasText: "critical" }).first().click();
await page.waitForTimeout(400);
const critRows = await page.locator("table tbody tr").count();

// resolve flow: open dialog, add note, resolve first row
await page.locator('button[role="combobox"]').first().click();
await page.locator('[role="option"]', { hasText: "Any severity" }).first().click();
await page.waitForTimeout(300);
const before = await page.locator("table tbody tr").count();
await page.locator('table tbody button:has-text("Resolve")').first().click();
await page.waitForSelector("text=Resolve alarm", { timeout: 5000 });
await page.fill("textarea", "smoke test: pressure normalised");
await page.locator('[role="dialog"] button:has-text("Resolve")').click();
await page.waitForTimeout(1200);
const after = await page.locator("table tbody tr").count();
const toastOk = await page.locator("text=Alarm resolved").count();
await page.screenshot({ path: "/tmp/shot-16-alarms.png" });

// resolved tab shows it with note
await page.click('button[role="tab"]:has-text("Resolved")');
await page.waitForTimeout(500);
const noteShown = await page.locator("text=smoke test: pressure normalised").count();
console.log("open rows:", openRows, "| kpi:", kpis, "| critical filter:", critRows, "| resolve:", before, "->", after, "| toast:", toastOk, "| note on resolved tab:", noteShown);

// viewer: no enabled actions
const page2 = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: "dark" });
page2.on("pageerror", (e) => errors.push(String(e.message)));
await login(page2, "viewer", "view123");
await page2.goto("http://localhost:3000/alarms", { waitUntil: "networkidle" });
await page2.waitForSelector("table tbody tr", { timeout: 10000 });
const btns = page2.locator('table tbody button');
const n = await btns.count();
let disabled = 0;
for (let i = 0; i < Math.min(n, 8); i++) if (await btns.nth(i).isDisabled()) disabled++;
console.log("viewer buttons:", n, "disabled:", disabled, "(expect all disabled)");
await page2.screenshot({ path: "/tmp/shot-17-alarms-viewer.png" });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length || disabled < Math.min(n, 8) ? 1 : 0);
