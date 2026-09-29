import { launchBrowser } from "./browser.mjs";
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, colorScheme: "dark" });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e.message)));

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[name="username"]', "operator");
await page.fill('input[name="password"]', "ops123");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });

await page.click('a[href="/map"]');
await page.waitForURL("**/map", { timeout: 10000 });
await page.waitForSelector(".leaflet-container", { timeout: 15000 });
await page.waitForTimeout(1800);
const chips = await page.locator(".gas-map-chip").count();
const polylines = await page.locator(".leaflet-overlay-pane path").count();
await page.screenshot({ path: "/tmp/shot-08-map.png" });

// zoom in (cluster → dots) via zoom control
await page.click(".leaflet-control-zoom a.leaflet-control-zoom-in");
await page.click(".leaflet-control-zoom a.leaflet-control-zoom-in");
await page.waitForTimeout(900);
await page.screenshot({ path: "/tmp/shot-09-map-zoom.png" });

// click a station marker → drawer
await page.locator(".gas-map-chip", { hasText: "CGS-01" }).first().click({ force: true });
await page.waitForSelector("text=Open alarms", { timeout: 10000 });
await page.screenshot({ path: "/tmp/shot-10-map-drawer.png" });

console.log("marker chips:", chips, "| overlay paths:", polylines);
console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
