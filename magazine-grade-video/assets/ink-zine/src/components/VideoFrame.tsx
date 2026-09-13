import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';
import { VIDEO_H, VIDEO_TOP, VIDEO_W, WIDTH } from '../theme';
import type { Cue, LyricContent } from '../../../types';
import { EnglishCaptions } from './EnglishCaptions';

export const VideoFrame: React.FC<{ content: LyricContent; enCues: Cue[] }> = ({
  content,
  enCues,
}) => {
  const left = (WIDTH - VIDEO_W) / 2;
  const radius = 18;
  return (
    <div style={{ position: 'absolute', top: VIDEO_TOP, left, width: VIDEO_W, height: VIDEO_H }}>
      <div
        style={{
          position: 'absolute',
          inset: -7,
          borderRadius: radius + 6,
          border: `1px solid rgba(247, 233, 215, 0.28)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          overflow: 'hidden',
          border: `1px solid rgba(247, 233, 215, 0.55)`,
        }}
      >
        <OffthreadVideo
          src={staticFile(content.videoFile)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <EnglishCaptions cues={enCues} />
      </div>
    </div>
  );
};
