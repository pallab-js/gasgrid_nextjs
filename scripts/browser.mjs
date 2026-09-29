import fs from "node:fs";
import { chromium } from "playwright-core";

/** Default local cache (macOS headless shell from `npx playwright-core install`). */
const LOCAL_SHELL =
  "/Users/pallabpc/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";

/**
 * Launch headless Chromium for smoke tests.
 * Resolution order: SMOKE_EXE env → local cache (if present) → Playwright registry
 * (i.e. a browser installed by `npx playwright-core install chromium` on CI).
 */
export async function launchBrowser() {
  const opts = { headless: true };
  if (process.env.SMOKE_EXE) {
    opts.executablePath = process.env.SMOKE_EXE;
  } else if (fs.existsSync(LOCAL_SHELL)) {
    opts.executablePath = LOCAL_SHELL;
  }
  return chromium.launch(opts);
}
