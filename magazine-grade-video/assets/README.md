# Magazine-Grade Video shell

高级杂志感视频转换的 Remotion 壳。两套皮肤在这里；实例只填内容。

| Path | Style |
|---|---|
| `warm-editorial/src/` | 暖奶油编辑风 / Warm Cream Editorial |
| `ink-zine/src/` | 墨绿刊印冷感风 / Cool Ink Letterpress |
| `types.ts` | shared `LyricContent` / `Cue` / `Highlights` |
| `src/` | compatibility re-exports of 暖奶油编辑风 (do not edit templates here) |

In the workspace it is linked as `videos/_lyric-player` (internal mount). New instances import the chosen skin:

```ts
import { LyricPlayer } from '../../_lyric-player/warm-editorial/src/LyricPlayer';
import { LyricPlayer } from '../../_lyric-player/ink-zine/src/LyricPlayer';
```

Older 暖奶油编辑风 instances may still import `../../_lyric-player/src/LyricPlayer`; that path re-exports 暖奶油编辑风.

Do not put episode-specific titles or subtitles in this folder.

Download / transcribe helpers live next to this folder:

- `../scripts/fetch-source.mjs` — URL → `media.mp4` + `source.orig.srt`
- `../scripts/whisper-srt.py` — local faster-whisper fallback when the site has no captions

