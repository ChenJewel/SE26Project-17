import { chromium } from "file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.mjs";

const outputDir = "C:/Users/user/.codex/visualizations/2026/07/16/019f6bfd-61b6-7b31-9f08-7788820b82e5";
const token = "user-4c5b0391-9315-4112-b8a0-5ba0ddfd04c7";
const report = { pages: [], errors: [] };

const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });

async function open(viewport, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await context.addInitScript((value) => localStorage.setItem("ueat-auth-token", value), token);
  const page = await context.newPage();
  page.on("console", (message) => message.type() === "error" && report.errors.push(`console:${message.text()}`));
  page.on("pageerror", (error) => report.errors.push(`page:${error.message}`));
  await page.goto("http://10.119.5.83/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(700);
  return { context, page };
}

async function inspect(page, label) {
  report.pages.push(await page.evaluate((name) => {
    const shell = document.querySelector(".app-shell");
    const homeCard = document.querySelector(".meal-card-environment");
    const profileCard = document.querySelector(".profile-identity-card");
    const tags = [...document.querySelectorAll("button, span")]
      .filter((element) => ["晚饭", "二食堂", "喜欢安静", "四食堂"].includes(element.textContent?.trim() ?? ""))
      .slice(0, 8)
      .map((element) => getComputedStyle(element).backgroundColor);
    const before = shell ? getComputedStyle(shell, "::before") : null;
    return {
      label: name,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: innerWidth,
      shellClass: shell?.className ?? null,
      environmentImage: before?.backgroundImage ?? null,
      environmentFilter: before?.filter ?? null,
      environmentOpacity: before?.opacity ?? null,
      homeCardBackground: homeCard ? getComputedStyle(homeCard).backgroundImage : null,
      homeCardBackdrop: homeCard ? getComputedStyle(homeCard).backdropFilter : null,
      profileCardBackground: profileCard ? getComputedStyle(profileCard).backgroundColor : null,
      sampleTagColors: tags,
    };
  }, label));
}

{
  const { context, page } = await open({ width: 390, height: 844 }, true);
  await inspect(page, "mobile-home");
  await page.screenshot({ path: `${outputDir}/material-v2-mobile-home.png`, fullPage: true });

  await page.getByRole("button", { name: "社区", exact: true }).click();
  await page.waitForTimeout(500);
  await inspect(page, "mobile-community");
  await page.screenshot({ path: `${outputDir}/material-v2-mobile-community.png`, fullPage: true });

  await page.getByRole("button", { name: "消息", exact: true }).click();
  await page.waitForTimeout(500);
  await inspect(page, "mobile-messages");
  await page.screenshot({ path: `${outputDir}/material-v2-mobile-messages.png`, fullPage: true });

  await page.getByRole("button", { name: "我的", exact: true }).click();
  await page.waitForTimeout(500);
  await inspect(page, "mobile-profile");
  await page.screenshot({ path: `${outputDir}/material-v2-mobile-profile.png`, fullPage: true });

  await page.getByRole("button", { name: "发布约饭卡片" }).click();
  await page.waitForTimeout(500);
  await page.getByText("标签", { exact: true }).scrollIntoViewIfNeeded();
  await inspect(page, "mobile-create-tags");
  await page.screenshot({ path: `${outputDir}/material-v2-mobile-create-tags.png` });
  await context.close();
}

{
  const { context, page } = await open({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "我的", exact: true }).click();
  await page.waitForTimeout(500);
  await inspect(page, "desktop-profile");
  await page.screenshot({ path: `${outputDir}/material-v2-desktop-profile.png`, fullPage: true });
  await context.close();
}

await browser.close();
process.stdout.write(JSON.stringify(report, null, 2));
