---
name: magazine-grade-video
description: >-
  Turns an interview or talk into a 3:4 Remotion video with magazine-grade
  editorial chrome (16:9 picture on top, karaoke-style Chinese type below,
  English captions on the frame). Two skins: 暖奶油编辑风 / Warm Cream Editorial
  and 墨绿刊印冷感风 / Cool Ink Letterpress. Use this skill whenever the user
  provides a video (local file or URL) plus title/kicker/show-name, optional
  Chinese/English SRT, or mentions 高级杂志感视频转换、杂志感视频、Magazine-Grade Video、
  歌词式字幕、访谈包装、lyric-player、暖奶油编辑风、墨绿刊印冷感风、包装成 Remotion 视频、
  把视频做成竖版字幕视频、只有 YouTube 链接、帮我下载再做成杂志视频 — even if they
  do not say "skill".
compatibility:
  requires:
    - Node.js + npm
    - remotion (workspace dependency)
    - ffprobe
    - ffmpeg
    - yt-dlp (URL path only; brew install yt-dlp)
    - faster-whisper (URL path, only when the site has no captions)
---

# 高级杂志感视频转换

**Magazine-Grade Video**

把一段访谈/演讲收成 3:4 杂志感短视频。不是歌词播放器，是带刊头、栏头和纸面纪律的编辑包装。本技能自带两套视觉壳，不要去复制旧片子目录。

## 资源怎么用

这是一个完整 skill 包，按需加载：

| 路径 | 何时读 / 跑 |
|---|---|
| `scripts/scaffold.mjs` | 建新实例、把壳链到 `videos/_lyric-player` |
| `scripts/fetch-source.mjs` | 用户只给了 URL：下载全片 + 站点字幕 |
| `scripts/whisper-srt.py` | 站点没有任何字幕时，本地转写出原语 SRT |
| `scripts/parse-srt.mjs` | 中英 `.srt` → cue。中文碎片跟嘴，只并极短残片 |
| `assets/warm-editorial/src/` | 暖奶油编辑风壳。改这套模板只改这里 |
| `assets/ink-zine/src/` | 墨绿刊印冷感风壳。改这套模板只改这里 |
| `assets/types.ts` | 两套壳共用的内容类型 |
| `assets/src/` | 旧路径兼容层，指向暖奶油编辑风。不要在这里改模板 |
| `references/design-guide.md` | 改暖奶油编辑风视觉时再读 |
| `references/ink-zine-guide.md` | 改墨绿刊印冷感风视觉时再读 |

工作区里的 `videos/_lyric-player` 是指向 `assets/` 的软链（内部挂载名，实例 `import` 用）。实例只放内容，不放壳。

参考实例（只当样例，不要改它来做新片）：

- 暖奶油编辑风：`videos/Find-Consumer-Startup-Ideas`
- 墨绿刊印冷感风：`videos/Speaking-Trick`

## 风格

两套壳共用同一套 7 项内容和同一套字幕/高亮数据，只换皮肤。

| 中文名 | 英文名 | `--style` | 默认 |
|---|---|---|---|
| 暖奶油编辑风 | Warm Cream Editorial | `warm-editorial` | 是 |
| 墨绿刊印冷感风 | Cool Ink Letterpress | `ink-zine` | 否 |

**暖奶油编辑风 / Warm Cream Editorial**：奶油纸面、近黑墨字、发丝线与少量珊瑚点火。像会动的品牌手册或研究报告，适合白天、判断、认真写下来的观点。

**墨绿刊印冷感风 / Cool Ink Letterpress**：深墨绿场地、燕麦刊头宋、珊瑚当电压。像夜灯下的独立杂志内页，适合夜间、沉浸、被刊印出来的句子。

用户说了「暖奶油编辑风 / warm cream / 奶油纸 / 研究报告 / 暖编辑」→ 暖奶油编辑风。  
用户说了「墨绿刊印冷感风 / cool ink letterpress / 复古 / 墨绿 / 刊印 / 沉浸复古」→ 墨绿刊印冷感风。  
没选或说不清 → **暖奶油编辑风 / Warm Cream Editorial**。不要追问风格耽误开工，除非用户在纠结视觉。

## 用户必须提供

缺刊头四项就停下来问，不要从 YouTube 标题、频道名或 `fetch-manifest.json` 里猜。

视频和字幕有两条入口，**优先用本地文件**：

| 入口 | 用户给什么 | 技能自己补什么 |
|---|---|---|
| A. 本地 | 视频文件 + 中字 + 英/原语字 + 刊头四项 | 无 |
| B. 链接 | **视频 URL** + 刊头四项 | 下载视频、拿原语时间轴字幕、译出中字 |

刊头四项：

4. 视频主标题
5. 页眉-视频原英文名
6. 页眉-节目名或频道名（英文名右侧，右对齐）
7. 页脚-视频地址

用户给的就是 Watch 链接时，**这一条同时当作第 7 项**，不必再问一遍页脚。4–6 仍然要用户亲口给。

关键词用户非必须提供，你来提炼。项目名你根据提供的信息自行创建。时长你自行确认。

不要问 `mark` 或 `titleLine2`。墨绿刊印冷感风壳支持这两项可选字段：用户没给就留空，刊头左侧用珊瑚菱形，主标题下不渲染副行。

## 制作流程

Skill 根目录：`skills/magazine-grade-video/`。下面命令都从仓库根目录跑。

### 1. 选定风格

按上面的「风格」表决定 `warm-editorial` 或 `ink-zine`。没选则用 `warm-editorial`。

### 2. 建项目

从主标题或英文原名生成 kebab-case slug 和 PascalCase `compName`。

```bash
node skills/magazine-grade-video/scripts/scaffold.mjs --slug <Slug> --comp <CompName> --style <warm-editorial|ink-zine>
```

省略 `--style` 等于暖奶油编辑风。脚本会：

- 确保 `videos/_lyric-player` → 本 skill 的 `assets/`
- 写出 `videos/<Slug>/src/{content,Main,Root,index,highlights}.ts(x)`，Main/Root 指向对应风格的壳

### 3. 取得素材

后面步骤把产物当本地文件用：

- `videos/<Slug>/public/media.mp4`
- `videos/<Slug>/public/source.orig.srt`（画面叠层用的原语时间轴）
- `videos/<Slug>/public/source.zh.srt`（下方歌词用的中文）

#### 本地文件

把源视频复制为 `videos/<Slug>/public/media.mp4`。中英 `.srt` 放到项目根或记下绝对路径，后面直接交给 `parse-srt.mjs`。

若用户只给了带软字幕的 mp4、没有独立原语字幕文件：

```bash
ffmpeg -v error -i videos/<Slug>/public/media.mp4 -map 0:s:0 videos/<Slug>/public/source.orig.srt -y
```

中文字幕必须是用户提供的 `.srt` 或由本技能按条译出，不要从英文机翻顶替。原语字幕用 Remotion 叠层，不要烧录（本机 ffmpeg 可能没有 libass）。

#### 只有 URL

缺 `yt-dlp` 就停下来告诉用户：`brew install yt-dlp`。缺 `ffmpeg` 同样停下。

**默认下全片。** URL 里的 `&t=` 只写进页脚，不裁切。只有用户明确要求截取某一段时，才把 `--start` / `--end` 传给脚本。

```bash
node skills/magazine-grade-video/scripts/fetch-source.mjs \
  --url <url> --out videos/<Slug>/public
```

用户要求截取时才加：

```bash
node skills/magazine-grade-video/scripts/fetch-source.mjs \
  --url <url> --out videos/<Slug>/public --start 00:02:17 --end 00:04:57
```

脚本打印 JSON，并写 `public/fetch-manifest.json`。里面的 `title` 只作调试，**不要**填进 `kicker` / `title` / `source`。

看 `source` 字段：

1. `manual`：站点人工字幕，已写成 `source.orig.srt`
2. `auto`：站点自动字幕，同上
3. `none`：站点没有任何字幕 → 跑 Whisper

```bash
python3 skills/magazine-grade-video/scripts/whisper-srt.py \
  --video videos/<Slug>/public/media.mp4 \
  --out videos/<Slug>/public/source.orig.srt
```

缺 `faster-whisper` 就停下来告诉用户：`python3 -m pip install --user faster-whisper`。

原语时间轴优先级必须按上面走：人工 → 自动 → Whisper。不要跳过站点字幕直接转写。

#### 译中文

无论原语来自用户文件、站点字幕还是 Whisper，都再写一份带时间码的中文 `source.zh.srt`。

- **按条翻译**：一条原语 cue = 一条中文 cue，起止时间完全拷贝
- 禁止为了通顺合并、拆条、重写时间轴
- 语气词、残片照译，交给后面的 `parse-srt.mjs` 去做「所以 / 对吧」并入
- 长片（几百条）按 40–60 条一批写，最后拼成一份再 parse
- 不调用外部翻译 API；默认就是模型自己译
- 若原语已经是中文（站点中字或 Whisper 检出 `zh`），中文歌词直接用这份，不要再译一遍把时间轴弄乱

画面叠层 = 原语；下方歌词 = 中文。代码里叠层文件名仍是 `en-subtitles.ts`（历史名），即使原语不是英语。

### 4. 确认时长

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 videos/<Slug>/public/media.mp4
```

写入 `src/content.ts` 的 `durationSec`（四舍五入到整数秒，以视频为准）。

### 5. 填 content.ts

只改这一份内容。不要改 `assets/` 里的组件，除非用户明确要求改模板。

```ts
export const content: LyricContent = {
  compName: '<CompName>',
  kicker: '<页眉-视频原英文名>',
  source: '<页眉-节目名或频道名>',
  title: '<主标题，单行>',
  footerRight: '<页脚-视频地址>',
  videoFile: 'media.mp4',
  durationSec: <ffprobe 秒数>,
};
```

主标题控制在约 16–22 个汉字。Header 会按长度缩字号，但必须单行。

### 6. 解析字幕

中文字幕必须**碎片跟嘴**，不要拼成完整长句。YouTube 式短条本身就是节奏：一条 SRT 对应一条 cue，跟口型走。只允许把极短残片并进前后条——两三个字，或纯语气词如「所以」「对吧」。不要为了好读、好高亮、或「一句完整意思」去合并多段。原语字幕保留空格，也不跨条合并。

```bash
node skills/magazine-grade-video/scripts/parse-srt.mjs \
  --project videos/<Slug> \
  --zh videos/<Slug>/public/source.zh.srt \
  --en videos/<Slug>/public/source.orig.srt
```

本地入口把 `--zh` / `--en` 换成用户给的文件即可。`--en` 表示原语轨，不一定是英语。

生成 `src/subtitles.ts` 和 `src/en-subtitles.ts`。解析脚本已经按上面的规则做残片并入，不要再另写合并逻辑，也不要事后手改这两个文件。

### 7. 提炼关键词

读 `src/subtitles.ts`，只给**真正有观点的碎片**写高亮，写入 `src/highlights.ts`。高亮服从碎片，不要为了标完整意思去改字幕。

- 如果某个碎片没有核心的、启发的观点或关键词，可以不做标注。不是每个碎片都要标注。
- 高亮单位放开：可以是一个关键词，也可以是关键短语或短句。选能把观点说清的最短原文；不要为了「只标一个词」而标得含糊，也不要整条字幕通体涂珊瑚。
- 必须仍落在**这一条碎片**里：该 cue 某一行原文的连续子串（渲染按行匹配，不能跨 SRT 换行，不能把相邻 cue 拼起来再标）。
- 一帧仍然只有一处珊瑚：有标注的 cue 只填一个短语
- 用户若自己给了关键词，verbatim 使用，仍须是原文子串

### 8. 注册 npm 脚本

在根 `package.json` 追加（port 避开已占用的 3001–3017）：

```json
"dev:<kebab>": "remotion studio videos/<Slug>/src/index.ts --public-dir videos/<Slug>/public --port <N>",
"render:<kebab>": "remotion render videos/<Slug>/src/index.ts <CompName> videos/<Slug>/dist/<CompName>.mp4 --public-dir videos/<Slug>/public",
"still:<kebab>": "remotion still videos/<Slug>/src/index.ts <CompName> videos/<Slug>/dist/stills/frame.png --public-dir videos/<Slug>/public"
```

### 9. 静帧自检

渲染开头 / 中段长句 / 结尾各一张（headless Chrome 需要非沙箱权限，否则会 SIGSEGV）：

两套都要看：

- 主标题单行
- 中文字幕是碎片跟嘴，不是整句合并
- 当前中文字幕尽量不换行
- 珊瑚只出现在当前句的一个关键词上，且该句本身有观点
- 视频内原语字幕与口型同步（Whisper 路径尤其要看）

暖奶油编辑风再确认：整页暖底 `#EFE9DE`，转录区无边框卡片。  
墨绿刊印冷感风再确认：整页深墨绿 `#0E1D18`，燕麦正文、珊瑚高亮，中文字幕左对齐。

改视觉时先读对应 guide：暖奶油编辑风 [references/design-guide.md](references/design-guide.md)，墨绿刊印冷感风 [references/ink-zine-guide.md](references/ink-zine-guide.md)。

### 10. 交付

告诉用户预览命令：`npm run dev:<kebab>`，并说清用的是哪套风格（中文名 + 英文名）。

## 不要做的事

- 不要把中文字幕合并成长句，也不要为了好读或翻译去改 `subtitles.ts` / 重写时间轴
- 不要用站点自动中字或机翻英文顶替按条译出的中文歌词
- 不要按 URL 的 `&t=` 自动裁切；用户没要求截取就下全片
- 不要把 YouTube 标题、频道名自动填进主标题 / 页眉
- 不要把页脚 URL 猜成短链
- 不要复制旧项目整目录当模板（会把旧文案一起拷走）
- 不要改 `Find-Consumer-Startup-Ideas` 或 `Speaking-Trick` 的内容来做新片子
- 不要在 `assets/` 里写某一集的标题或字幕
- 不要把 youtube-clipper 整包拷进来；本技能自包含
- 暖奶油编辑风：不要给页面加发光、玻璃拟态、大渐变色块
- 墨绿刊印冷感风：场光和纸粒已经在壳里，不要再加发光或玻璃
