#!/usr/bin/env python3
"""Transcribe a local video to a timed original-language SRT with short cues.

Usage:
  python3 whisper-srt.py --video videos/<Slug>/public/media.mp4 --out videos/<Slug>/public/source.orig.srt
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def which_or_die(name: str) -> None:
    if shutil.which(name) is None:
        raise SystemExit(f"{name} not found")


def fmt_srt(sec: float) -> str:
    t = max(0.0, sec)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int(round((t - int(t)) * 1000))
    if ms == 1000:
        s += 1
        ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def extract_wav(video: Path, wav: Path) -> None:
    r = subprocess.run(
        ["ffmpeg", "-y", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", str(wav)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    if r.returncode != 0:
        err = (r.stderr or b"").decode("utf-8", errors="replace")[-2000:]
        raise SystemExit("ffmpeg failed:\n" + err)


def pack_words(words: list, max_sec: float = 2.8, max_words: int = 8) -> list[dict]:
    cues: list[dict] = []
    buf: list = []
    for w in words:
        if not getattr(w, "word", None):
            continue
        if not buf:
            buf = [w]
            continue
        span = float(w.end) - float(buf[0].start)
        if span > max_sec or len(buf) >= max_words:
            cues.append(
                {
                    "start": float(buf[0].start),
                    "end": float(buf[-1].end),
                    "text": "".join(x.word for x in buf).strip(),
                }
            )
            buf = [w]
        else:
            buf.append(w)
    if buf:
        cues.append(
            {
                "start": float(buf[0].start),
                "end": float(buf[-1].end),
                "text": "".join(x.word for x in buf).strip(),
            }
        )
    return [c for c in cues if c["text"]]


def transcribe(wav: Path, model_name: str) -> tuple[list[dict], str]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise SystemExit(
            "faster-whisper not found. Install: python3 -m pip install --user faster-whisper"
        ) from exc

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(str(wav), word_timestamps=True, vad_filter=True)
    words = []
    fallback = []
    for seg in segments:
        if seg.words:
            words.extend(seg.words)
        else:
            text = (seg.text or "").strip()
            if text:
                fallback.append({"start": float(seg.start), "end": float(seg.end), "text": text})
    lang = getattr(info, "language", "") or ""
    if words:
        return pack_words(words), lang
    return fallback, lang


def write_srt(cues: list[dict], path: Path) -> None:
    lines = []
    for i, c in enumerate(cues, 1):
        lines.append(str(i))
        lines.append(f"{fmt_srt(c['start'])} --> {fmt_srt(c['end'])}")
        lines.append(c["text"])
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--video", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--model", default="medium")
    args = p.parse_args()
    which_or_die("ffmpeg")
    video = Path(args.video).resolve()
    out = Path(args.out).resolve()
    if not video.exists():
        raise SystemExit(f"video not found: {video}")
    out.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "audio.wav"
        print(f"extracting audio from {video.name}…", file=sys.stderr)
        extract_wav(video, wav)
        print(f"whisper {args.model}…", file=sys.stderr)
        cues, lang = transcribe(wav, args.model)
    if not cues:
        raise SystemExit("whisper produced no cues")
    write_srt(cues, out)
    print(f"Wrote {len(cues)} cues ({lang}) -> {out}")


if __name__ == "__main__":
    main()
