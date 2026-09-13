import React from 'react';
import { useCurrentFrame } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Roboto';
import type { Cue } from '../../../types';
import { spokenEnglish } from '../../../spokenEnglish';

const { fontFamily } = loadFont('normal', {
  weights: ['400'],
  subsets: ['latin'],
});

export const EnglishCaptions: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  if (cues.length === 0) return null;

  const last = cues[cues.length - 1];
  if (frame > last.endFrame + 6) return null;

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
        left: 0,
        right: 0,
        bottom: 20,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          textAlign: 'left',
          fontFamily,
          fontSize: 22,
          fontWeight: 400,
          lineHeight: 1.35,
          color: '#FFFFFF',
          background: 'rgba(0, 0, 0, 0.32)',
          padding: '5px 10px',
          borderRadius: 4,
        }}
      >
        {text}
      </div>
    </div>
  );
};
