import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import {
  COLORS,
  FONTS,
  ML,
  CONTENT_W,
  LYRIC_TOP,
  LYRIC_H,
  LYRIC_ANCHOR,
  LYRIC_ACTIVE_SIZE,
  LYRIC_ACTIVE_LH,
  LYRIC_IDLE_SIZE,
  LYRIC_BLOCK_GAP,
  CHARS_PER_LINE_ACTIVE,
} from '../theme';
import type { Cue, Highlights } from '../../../types';
import { stripRollingPrefix } from '../../../stripRolling';

const TRANSITION = 13;

interface BlockLayout {
  top: number;
  height: number;
  center: number;
}

const wrapCount = (text: string) =>
  Math.max(1, Math.ceil(text.length / CHARS_PER_LINE_ACTIVE));

const buildLayout = (cues: Cue[]): BlockLayout[] => {
  const out: BlockLayout[] = [];
  let cursor = 0;
  for (const cue of cues) {
    const lines = cue.lines.reduce((n, l) => n + wrapCount(l), 0);
    const height = lines * LYRIC_ACTIVE_LH;
    out.push({ top: cursor, height, center: cursor + height / 2 });
    cursor += height + LYRIC_BLOCK_GAP;
  }
  return out;
};

const renderLine = (line: string, phrases: string[] | undefined): React.ReactNode => {
  if (!phrases || phrases.length === 0) return line;
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
          color: COLORS.cream,
          padding: '0 8px',
          margin: '0 1px',
          borderRadius: 5,
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
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

  const offsetForIndex = (i: number) => LYRIC_ANCHOR - LYRIC_TOP - layout[i].center;
  const start = cues[active].startFrame;
  const prev = active > 0 ? offsetForIndex(active - 1) : offsetForIndex(0);
  const curr = offsetForIndex(active);
  const progress =
    active === 0
      ? 1
      : interpolate(frame, [start, start + TRANSITION], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        });
  const translateY = Math.round(prev + (curr - prev) * progress);

  return (
    <div
      style={{
        position: 'absolute',
        top: LYRIC_TOP,
        left: 0,
        width: '100%',
        height: LYRIC_H,
        overflow: 'hidden',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%)',
        maskImage:
          'linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: ML,
          top: 0,
          width: CONTENT_W,
          transform: `translateY(${translateY}px)`,
          willChange: 'transform',
        }}
      >
        {cues.map((cue, i) => {
          const dist = Math.abs(i - active);
          const appear =
            i === active ? progress : i === active - 1 && active > 0 ? 1 - progress : 0;
          const isActive = appear > 0.5;
          const idleOpacity = Math.max(0.28 - (Math.max(dist, 1) - 1) * 0.06, 0.08);
          const opacity = appear > 0 ? 0.28 + 0.72 * appear : idleOpacity;
          const size = LYRIC_IDLE_SIZE + (LYRIC_ACTIVE_SIZE - LYRIC_IDLE_SIZE) * appear;

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
                justifyContent: 'center',
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
                    fontSize: size,
                    fontWeight: 400 + 100 * appear,
                    lineHeight: `${LYRIC_ACTIVE_LH}px`,
                    letterSpacing: 0,
                    color: COLORS.ink,
                    opacity,
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
