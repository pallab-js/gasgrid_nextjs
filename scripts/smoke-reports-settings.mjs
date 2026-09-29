import { launchBrowser } from "./browser.mjs";
const browser = await launchBrowser();
const errors = [];

async function login(page, user, pass) {
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
}

const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, colorScheme: "dark" });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e.message)));

await login(page, "admin", "admin123");

/* ── reports ── */
await page.click('a[href="/reports"]');
await page.waitForURL("**/reports", { timeout: 10000 });
await page.waitForSelector("text=Energy balance", { timeout: 10000 });
const kpis = await page.locator("text=Unaccounted gas").count();
await page.locator('button[role="combobox"]').first().click();
await page.locator('[role="option"]', { hasText: "Aug 2026" }).first().click();
await page.waitForTimeout(1500);
const augLoaded = await page.locator("text=generated").count();
await page.locator('button:has-text("CSV")').first().click();
await page.waitForTimeout(400);
const csvToast = await page.locator("text=downloaded").count();
await page.screenshot({ path: "/tmp/shot-21-reports.png", fullPage: false });
console.log("reports: kpi:", kpis, "| period switched:", augLoaded, "| csv toast:", csvToast);

/* ── settings ── */
await page.click('a[href="/settings"]');
await page.waitForURL("**/settings", { timeout: 10000 });
await page.waitForSelector("text=Users & roles", { timeout: 10000 });

// create user
await page.click('button:has-text("New user")');
await page.waitForSelector("text=New user", { timeout: 5000 });
await page.fill("#u-name", "smoke_tmp");
await page.fill("#u-full", "Smoke Tester");
await page.fill("#u-pw", "smoke123");
await page.locator('[role="dialog"] button:has-text("Create")').click();
await page.waitForTimeout(1000);
const userToast = await page.locator("text=User created").count();
const userRow = await page.locator("td", { hasText: "smoke_tmp" }).count();

// thresholds save roundtrip
const hf = page.locator('input[type="number"][step="100"]');
await hf.fill("13600");
await page.click('button:has-text("Save")');
await page.waitForTimeout(900);
const thToast = await page.locator("text=Thresholds saved").count();
await hf.fill("13500");
await page.click('button:has-text("Save")');
await page.waitForTimeout(900);

// inject test alarm
await page.click('button:has-text("Inject")');
await page.waitForTimeout(900);
const injToast = await page.locator("text=Test alarm injected").count();
const auditRows = await page.locator("td", { hasText: "alarm.inject_test" }).count();
await page.screenshot({ path: "/tmp/shot-22-settings.png", fullPage: false });
console.log("settings: user:", userToast, userRow, "| thresholds:", thToast, "| inject:", injToast, "| audit:", auditRows);

/* ── operator denied ── */
const p2 = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: "dark" });
p2.on("pageerror", (e) => errors.push(String(e.message)));
await login(p2, "operator", "ops123");
await p2.goto("http://localhost:3000/settings", { waitUntil: "networkidle" });
const denied = await p2.locator("text=Admin role required").count();
console.log("operator settings denied:", denied);

console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length || !denied || !userToast || !injToast ? 1 : 0);
