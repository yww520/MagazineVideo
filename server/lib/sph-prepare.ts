import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { logFail, logInfo, logOk } from './log.js';

export type SphPrepareResult = {
  ok: boolean;
  needLogin?: boolean;
  published?: boolean;
  message: string;
};

let busy = false;

const resolveTabbitCli = (): string => {
  if (process.env.TABBIT_CLI && existsSync(process.env.TABBIT_CLI)) {
    return process.env.TABBIT_CLI;
  }
  const defaultPath = `${process.env.HOME || '/Users/clawbot'}/.local/bin/tabbit-cli`;
  if (existsSync(defaultPath)) return defaultPath;
  return 'tabbit-cli';
};

const runTabbit = (
  cliPath: string,
  args: string[],
  input?: string,
): Promise<{ code: number; stdout: string; stderr: string }> => {
  return new Promise((resolve) => {
    const child = spawn(cliPath, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
    child.on('error', (err) => {
      resolve({ code: -1, stdout, stderr: err.message });
    });
  });
};

export const prepareSphPublish = async (opts: {
  videoPath: string;
  title: string;
  desc: string;
}): Promise<SphPrepareResult> => {
  if (!existsSync(opts.videoPath)) throw new Error('成片文件不存在');
  if (busy) throw new Error('正在处理上一次视频号发布任务，请稍候');
  busy = true;

  const taskName = 'Publish Channels Video';
  const cliPath = resolveTabbitCli();

  try {
    logInfo('sph', '开始通过 Tabbit 浏览器准备视频号发布', { videoPath: opts.videoPath, title: opts.title });

    // 1. 获取已打开标签页清单
    const createRes = await runTabbit(cliPath, ['create', '--task', taskName]);
    let tabId: number | null = null;
    try {
      const parsed = JSON.parse(createRes.stdout);
      const sphTab = (parsed.tabs || []).find(
        (t: { url?: string; tabId?: number }) => t.url && t.url.includes('channels.weixin.qq.com'),
      );
      if (sphTab?.tabId) {
        tabId = sphTab.tabId;
        logInfo('sph', `定位到已有视频号助手标签页 [tabId: ${tabId}]`);
      }
    } catch {
      // 容错处理：若解析失败则使用新建标签页
    }

    const nodeArgs = [
      'nodejs',
      '--task',
      taskName,
      '--timeout-ms',
      '180000',
      '--request-id',
      `sph-publish-${Date.now()}`,
    ];
    if (tabId) {
      nodeArgs.push('--tab', String(tabId));
    }

    // 2. 构造自动化执行脚本
    const payloadJson = JSON.stringify({
      videoPath: opts.videoPath,
      title: opts.title,
      desc: opts.desc,
    });

    const script = `
const payload = ${payloadJson};

// 确保在发布页面
if (!page.url().includes('channels.weixin.qq.com/platform/post/create')) {
  await page.goto('https://channels.weixin.qq.com/platform/post/create', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
}

// 登录检测
if (/login|passport|sso|authorize/i.test(page.url())) {
  return { ok: false, needLogin: true, message: '请在 Tabbit 浏览器中登录微信视频号助手后再试。' };
}
const hasLoginGate = await page.evaluate(() => {
  const text = document.body ? document.body.innerText : '';
  return text.includes('扫码登录') || text.includes('快捷登录');
});
if (hasLoginGate) {
  return { ok: false, needLogin: true, message: '请在 Tabbit 浏览器中登录微信视频号助手后再试。' };
}

// 上传视频文件
let fileInput = page.locator('input[type="file"]');
if ((await fileInput.count()) === 0) {
  const frame = page.frame({ name: 'content' });
  if (frame) fileInput = frame.locator('input[type="file"]');
}
if ((await fileInput.count()) === 0) {
  return { ok: false, message: '未找到视频上传框，请确认视频号发布页已正确加载。' };
}

await fileInput.first().setInputFiles(payload.videoPath);
await page.waitForTimeout(3000);

const frame = page.frame({ name: 'content' });
const target = frame || page;

// 填写短标题（最多 16-20 字）
await target.evaluate((t) => {
  const titleInput = document.querySelector('input[placeholder*="短标题"]');
  if (titleInput) {
    titleInput.focus();
    titleInput.value = t;
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, payload.title);

// 填写描述与话题
await target.evaluate((d) => {
  const editor = document.querySelector('.input-editor');
  if (!editor) return;
  let el = editor;
  while (el && !el.__vue__) el = el.parentElement;
  const vm = el && el.__vue__;
  if (vm && vm.transTextToHtml) {
    editor.innerHTML = vm.transTextToHtml(d).replace(/\\n/g, '<br>');
  } else {
    editor.innerText = d;
  }
  if (vm && vm.updateDescData) {
    vm.updateDescData();
  }
}, payload.desc);

// 设置位置为「不显示位置」
await target.evaluate(() => {
  const el = document.querySelector('.position-display-wrap');
  if (el) el.click();
  setTimeout(() => {
    const elements = Array.from(document.querySelectorAll('.location-filter-wrap *'));
    const noLoc = elements.find(e => e.innerText && e.innerText.trim() === '不显示位置');
    if (noLoc) noLoc.click();
  }, 250);
});

// 等待视频上传处理完成（轮询发表按钮是否解除 disabled）
let canPublish = false;
const deadline = Date.now() + 100000;
while (Date.now() < deadline) {
  const status = await target.evaluate(() => {
    const publishBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '发表');
    const isDisabled = publishBtn ? (publishBtn.disabled || publishBtn.className.includes('disabled')) : true;
    return { ready: !isDisabled };
  });
  if (status.ready) {
    canPublish = true;
    break;
  }
  await page.waitForTimeout(1500);
}

if (canPublish) {
  // 滚动到底部并点击发表
  await target.evaluate(() => {
    const scrollEl = document.querySelector('.app-body');
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  });
  await page.waitForTimeout(500);

  const published = await target.evaluate(() => {
    const publishBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '发表');
    if (publishBtn && !publishBtn.disabled && !publishBtn.className.includes('disabled')) {
      publishBtn.click();
      return true;
    }
    return false;
  });
  await page.waitForTimeout(2500);

  return {
    ok: true,
    published: !!published,
    message: '成片已通过 Tabbit 浏览器成功发表到微信视频号！',
  };
} else {
  return {
    ok: true,
    published: false,
    message: '已在 Tabbit 中填好短标题、简介与视频，后台上传中，上传完成后请在 Tabbit 浏览器中确认点击「发表」。',
  };
}
`;

    const evalRes = await runTabbit(cliPath, nodeArgs, script);
    let result: SphPrepareResult;

    try {
      const parsed = JSON.parse(evalRes.stdout);
      if (parsed.result?.value) {
        result = parsed.result.value as SphPrepareResult;
      } else if (parsed.result?.error) {
        throw new Error(parsed.result.error);
      } else {
        throw new Error(evalRes.stderr || evalRes.stdout || 'Tabbit 执行异常');
      }
    } catch (parseErr) {
      if ((parseErr as Error).message.includes('成片已通过')) {
        result = { ok: true, published: true, message: '成片已通过 Tabbit 浏览器成功发表到微信视频号！' };
      } else {
        throw new Error(`Tabbit 响应解析失败: ${(parseErr as Error).message}\n${evalRes.stdout.slice(0, 200)}`);
      }
    }

    if (result.ok) {
      logOk('sph', result.message);
    } else {
      logFail('sph', result.message);
    }

    return result;
  } catch (err) {
    logFail('sph', (err as Error).message);
    throw err;
  } finally {
    // 始终结束该任务释放 Tabbit 资源
    await runTabbit(cliPath, ['finish', '--task', taskName]).catch(() => undefined);
    busy = false;
  }
};
