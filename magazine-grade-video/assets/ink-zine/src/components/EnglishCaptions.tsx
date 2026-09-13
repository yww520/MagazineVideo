import React from 'react';
import { useCurrentFrame } from 'remotion';
import { COLORS, FONTS } from '../theme';
import type { Cue } from '../../../types';
import { spokenEnglish } from '../../../spokenEnglish';

export const EnglishCaptions: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  if (cues.length === 0) return null;
  const last = cues[cues.length - 1];
  if (frame > last.endFrame + 8) return null;

  let active = -1;
  for (let i = 0; i < cues.length; i++) {
    if (frame >= cues[i].startFrame) active = i;
    else break;
  }
  if (active < 0) return null;
  const text = spokenEnglish(cues, active);
  if (!text) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: 16,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          textAlign: 'left',
          fontFamily: FONTS.display,
          fontSize: 18,
          fontWeight: 500,
          fontStyle: 'italic',
          lineHeight: 1.3,
          color: COLORS.oat,
          background: 'rgba(14, 29, 24, 0.55)',
          padding: '5px 14px',
          borderRadius: 4,
        }}
      >
        {text}
      </div>
    </div>
  );
};
