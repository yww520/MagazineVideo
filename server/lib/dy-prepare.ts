import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Locator, Page } from 'playwright';
import { ROOT, ensureDir } from './paths.js';
import { logFail, logInfo, logOk } from './log.js';

const PUBLISH_URL = 'https://creator.douyin.com/creator-micro/content/upload?enter_from=publish';
const PROFILE = join(ROOT, 'data', 'dy-profile');
const FILE_INPUTS = ['input[type="file"][accept*="video"]', 'input[type="file"]'];
const TITLE_FIELDS = [
  'input[placeholder*="填写作品标题"]',
  'input[placeholder*="作品标题"]',
  'input[placeholder*="标题"]',
  '.title-input input',
  'input.semi-input',
];
const DESC_FIELDS = [
  '.editor-kit-editor-container [contenteditable="true"]',
  'div[data-placeholder*="简介"]',
  'div[data-placeholder*="作品"]',
  '[contenteditable="true"][data-placeholder*="简介"]',
  '[contenteditable="true"][data-placeholder*="描述"]',
  'textarea[placeholder*="简介"]',
];

export type DyPrepareResult = {
  ok: boolean;
  needLogin?: boolean;
  message: string;
};

let context: BrowserContext | null = null;
let busy = false;

const firstAttached = async (page: Page, selectors: string[], timeout: number): Promise<Locator | null> => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) > 0) return loc;
    }
    await page.waitForTimeout(350);
  }
  return null;
};

const looksLikeLogin = async (page: Page) => {
  if (/login|passport|sso|authorize/i.test(page.url())) return true;
  const gate = page.getByText(/扫码登录|手机号登录|验证码登录|登录后即可发布/);
  return (await gate.count()) > 0;
};

const fillLoose = async (page: Page, loc: Locator, text: string) => {
  await loc.click({ timeout: 4000 }).catch(() => undefined);
  try {
    await loc.fill(text);
    return;
  } catch {
    await page.keyboard.press('Meta+A').catch(() => undefined);
    await page.keyboard.type(text, { delay: 12 });
  }
};

export const prepareDyPublish = async (opts: {
  videoPath: string;
  title: string;
  desc: string;
}): Promise<DyPrepareResult> => {
  if (!existsSync(opts.videoPath)) throw new Error('成片文件不存在');
  if (busy) throw new Error('正在处理上一次抖音窗口，请稍候');
  busy = true;

  try {
    const playwright = await import('playwright').catch(() => null);
    if (!playwright) {
      throw new Error('未安装 Playwright。请在项目根目录执行 npm install && npx playwright install chromium');
    }

    ensureDir(PROFILE);
    if (!context) {
      logInfo('dy', '打开抖音创作者中心');
      const launchOpts = {
        headless: false,
        viewport: { width: 1320, height: 900 } as const,
        locale: 'zh-CN',
        acceptDownloads: false,
      };
      try {
        context = await playwright.chromium
          .launchPersistentContext(PROFILE, { ...launchOpts, channel: 'chrome' })
          .catch(() => playwright.chromium.launchPersistentContext(PROFILE, launchOpts));
      } catch (err) {
        const msg = (err as Error).message || '';
        if (/Executable doesn't exist|browserType\.launch/i.test(msg)) {
          throw new Error('未安装可用浏览器。请安装 Google Chrome，或在项目根目录执行 npx playwright install chromium');
        }
        if (/ProcessSingleton|profile|user data|already in use/i.test(msg)) {
          throw new Error('抖音浏览器窗口已在运行。请先关掉弹出的窗口，或关掉多开的开发服务后再试');
        }
        throw err;
      }
      context.on('close', () => {
        context = null;
      });
    }

    const page = context.pages()[0] || (await context.newPage());
    await page.bringToFront().catch(() => undefined);
    await page.goto(PUBLISH_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(1500);

    const fileInput = await firstAttached(page, FILE_INPUTS, 10000);
    if (await looksLikeLogin(page)) {
      logInfo('dy', '需要登录');
      return {
        ok: false,
        needLogin: true,
        message: '请在弹出的抖音窗口扫码或登录。登录成功后再点一次「发到抖音」。',
      };
    }
    if (!fileInput) {
      throw new Error('没有找到上传框。请确认弹出窗口停在视频发布页后，再点一次「发到抖音」。');
    }

    await fileInput.setInputFiles(opts.videoPath);
    logInfo('dy', '已选择成片，等待进入编辑页');

    const titleBox =
      (await firstAttached(page, TITLE_FIELDS, 600_000)) ||
      (await firstAttached(page, DESC_FIELDS, 8_000));
    if (!titleBox) {
      throw new Error('视频上传或转码超时。窗口已打开，请在抖音页里继续填写。');
    }

    const realTitle = await firstAttached(page, TITLE_FIELDS, 4_000);
    if (realTitle) await fillLoose(page, realTitle, opts.title);

    const descBox = await firstAttached(page, DESC_FIELDS, 12_000);
    if (descBox) await fillLoose(page, descBox, opts.desc);
    else logInfo('dy', '未找到简介框，标题已填，请手动补介绍');

    logOk('dy', '标题和介绍已填好，未代点发布或存草稿');
    return {
      ok: true,
      message: '已在抖音窗口上传视频并填好标题、介绍。暂存草稿或发布请你自己点。',
    };
  } catch (err) {
    logFail('dy', (err as Error).message);
    throw err;
  } finally {
    busy = false;
  }
};
