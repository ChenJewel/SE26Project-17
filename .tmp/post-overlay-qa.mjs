import { chromium } from "file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs";

const baseUrl = "http://10.119.5.83";
const token = "user-4c5b0391-9315-4112-b8a0-5ba0ddfd04c7";
const result = { checks: [], errors: [] };

const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.addInitScript((value) => localStorage.setItem("ueat-auth-token", value), token);
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") result.errors.push(message.text());
});
page.on("pageerror", (error) => result.errors.push(error.message));

await page.goto(`${baseUrl}/?qa=${Date.now()}`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(800);
const searchLabel = "\u641c\u7d22\u7ea6\u996d\u5361\u7247";
const sendCommentLabel = "\u53d1\u9001\u8bc4\u8bba";

result.checks.push(await page.evaluate(() => {
  const card = document.querySelector(".home-floating-card");
  const style = card ? getComputedStyle(card) : null;
  return {
    name: "home-card-motion",
    found: Boolean(card),
    animationName: style?.animationName ?? null,
    animationDuration: style?.animationDuration ?? null,
  };
}));

await page.locator(`button[aria-label="${searchLabel}"]`).click();
await page.locator(".app-screen-overlay input").fill("PG");
await page.waitForTimeout(900);

const postResult = page.locator(".app-screen-overlay button").filter({ hasText: "PG realtime post" }).first();
result.checks.push({ name: "search-post-result-count", count: await postResult.count() });
await postResult.click({ timeout: 10000 });
await page.waitForTimeout(600);

const draft = `QA-${Date.now()}`;
const commentInput = page.locator(".app-screen-overlay input").last();
await commentInput.fill(draft);
const sendButton = page.locator(`.app-screen-overlay button[aria-label="${sendCommentLabel}"]`).last();
result.checks.push({ name: "send-comment-button-count", count: await sendButton.count() });
await sendButton.click({ timeout: 10000 });
await page.waitForTimeout(1200);

result.checks.push(await page.evaluate((expected) => {
  const text = document.body.innerText;
  return {
    name: "global-post-comment-submit",
    overlayCount: document.querySelectorAll(".app-screen-overlay").length,
    draftCleared: Array.from(document.querySelectorAll("input")).every((input) => input.value !== expected),
    commentVisible: text.includes(expected),
    bodyExcerpt: text.slice(0, 500),
  };
}, draft));

await browser.close();
process.stdout.write(JSON.stringify(result, null, 2));
