import React, { useMemo } from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import {
  CHARS_PER_LINE,
  COLORS,
  FONTS,
  LYRIC_ACTIVE_LH,
  LYRIC_ACTIVE_SIZE,
  LYRIC_ANCHOR,
  LYRIC_BLOCK_GAP,
  LYRIC_H,
  LYRIC_IDLE_SIZE,
  LYRIC_TOP,
  VIDEO_LEFT,
  VIDEO_W,
} from '../theme';
import type { Cue, Highlights } from '../../../types';
import { stripRollingPrefix } from '../../../stripRolling';

const TRANSITION = 10;
const WINDOW = 12;

const wrapCount = (text: string) => Math.max(1, Math.ceil(text.length / CHARS_PER_LINE));

const buildLayout = (cues: Cue[]) => {
  const out: { top: number; height: number; center: number }[] = [];
  let cursor = 0;
  for (const cue of cues) {
    const height = cue.lines.reduce((n, l) => n + wrapCount(l), 0) * LYRIC_ACTIVE_LH;
    out.push({ top: cursor, height, center: cursor + height / 2 });
    cursor += height + LYRIC_BLOCK_GAP;
  }
  return out;
};

const renderLine = (line: string, phrases: string[] | undefined): React.ReactNode => {
  if (!phrases?.length) return line;
  const parts: React.ReactNode[] = [];
  let rest = line;
  let key = 0;
  while (rest.length > 0) {
    let hitIdx = -1;
    let hitPhrase = '';
    for (const p of phrases) {
      const idx = rest.indexOf(p);
      if (idx !== -1 && (hitIdx === -1 || idx < hitIdx)) {
        hitIdx = idx;
        hitPhrase = p;
      }
    }
    if (hitIdx === -1) {
      parts.push(rest);
      break;
    }
    if (hitIdx > 0) parts.push(rest.slice(0, hitIdx));
    parts.push(
      <span
        key={key++}
        style={{
          background: COLORS.coral,
          color: COLORS.oat,
          padding: '2px 10px',
          borderRadius: 4,
        }}
      >
        {hitPhrase}
      </span>,
    );
    rest = rest.slice(hitIdx + hitPhrase.length);
  }
  return parts;
};

export const LyricScroller: React.FC<{ cues: Cue[]; highlights: Highlights }> = ({
  cues,
  highlights,
}) => {
  const frame = useCurrentFrame();
  const layout = useMemo(() => buildLayout(cues), [cues]);

  if (cues.length === 0) return null;

  let active = 0;
  for (let i = 0; i < cues.length; i++) {
    if (frame >= cues[i].startFrame) active = i;
    else break;
  }

  const offsetFor = (i: number) => LYRIC_ANCHOR - LYRIC_TOP - layout[i].center;
  const start = cues[active].startFrame;
  const prev = active > 0 ? offsetFor(active - 1) : offsetFor(0);
  const curr = offsetFor(active);
  const progress =
    active === 0
      ? 1
      : interpolate(frame, [start, start + TRANSITION], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        });
  const translateY = Math.round(prev + (curr - prev) * progress);

  const from = Math.max(0, active - WINDOW);
  const to = Math.min(cues.length, active + WINDOW + 1);
  const slice = useMemo(() => cues.slice(from, to), [cues, from, to]);

  return (
    <div
      style={{
        position: 'absolute',
        top: LYRIC_TOP,
        left: 0,
        width: VIDEO_LEFT + VIDEO_W,
        height: LYRIC_H,
        overflow: 'hidden',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%)',
        maskImage:
          'linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: VIDEO_LEFT,
          width: VIDEO_W,
          top: 0,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {slice.map((cue, offset) => {
          const i = from + offset;
          const dist = Math.abs(i - active);
          const appear =
            i === active ? progress : i === active - 1 && active > 0 ? 1 - progress : 0;
          const isActive = appear > 0.5;
          const idleOpacity = Math.max(0.18 - (Math.max(dist, 1) - 1) * 0.025, 0.06);
          const opacity = appear > 0 ? 0.18 + 0.82 * appear : idleOpacity;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: layout[i].top,
                height: layout[i].height,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                textAlign: 'left',
              }}
            >
              {cue.lines.map((line, j) => {
                const prevText = i > 0 ? cues[i - 1].lines.join('') : '';
                const shown = prevText ? stripRollingPrefix(prevText, line) : line;
                return (
                <div
                  key={j}
                  style={{
                    fontFamily: FONTS.serif,
                    fontSize: LYRIC_IDLE_SIZE + (LYRIC_ACTIVE_SIZE - LYRIC_IDLE_SIZE) * appear,
                    fontWeight: 400 + 200 * appear,
                    lineHeight: `${LYRIC_ACTIVE_LH}px`,
                    color: COLORS.oat,
                    opacity,
                    letterSpacing: 0.2,
                  }}
                >
                  {isActive ? renderLine(shown, highlights[i]) : shown}
                </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
