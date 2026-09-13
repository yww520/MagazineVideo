import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';
import { COLORS, ML, VIDEO_CARD_TOP, VIDEO_W, VIDEO_H } from '../theme';
import type { Cue, LyricContent } from '../../../types';
import { CrosshairCorners } from './CrosshairCorners';
import { EnglishCaptions } from './EnglishCaptions';

const RADIUS = 8;

export const VideoCard: React.FC<{ content: LyricContent; enCues: Cue[] }> = ({
  content,
  enCues,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: VIDEO_CARD_TOP,
        left: ML,
        width: VIDEO_W,
        height: VIDEO_H,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: COLORS.tile,
          borderRadius: RADIUS,
          border: `1px solid ${COLORS.hairline}`,
          boxShadow: '0 1px 3px rgba(20,20,19,0.10), 0 4px 16px rgba(20,20,19,0.08)',
          overflow: 'hidden',
        }}
      >
        <OffthreadVideo
          src={staticFile(content.videoFile)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <EnglishCaptions cues={enCues} />
      </div>

      <CrosshairCorners w={VIDEO_W} h={VIDEO_H} pad={14} />
    </div>
  );
};
