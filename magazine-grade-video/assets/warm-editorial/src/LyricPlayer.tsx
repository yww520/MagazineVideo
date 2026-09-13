import React from 'react';
import { AbsoluteFill } from 'remotion';
import {
  COLORS,
  FONTS,
  ML,
  MR,
  WIDTH,
  HEIGHT,
  PAGE_INSET,
  SECTION_LABEL_TOP,
} from './theme';
import type { Cue, Highlights, LyricContent } from '../../types';
import { Header } from './components/Header';
import { VideoCard } from './components/VideoCard';
import { LyricScroller } from './components/LyricScroller';
import { Footer } from './components/Footer';
import { CrosshairCorners } from './components/CrosshairCorners';

export const LyricPlayer: React.FC<{
  content: LyricContent;
  zhCues: Cue[];
  enCues: Cue[];
  highlights: Highlights;
}> = ({ content, zhCues, enCues, highlights }) => {
  return (
    <AbsoluteFill style={{ background: COLORS.tile, fontFamily: FONTS.sans }}>
      <div
        style={{
          position: 'absolute',
          inset: PAGE_INSET,
          border: `1px solid ${COLORS.hairlineSoft}`,
          borderRadius: 4,
          pointerEvents: 'none',
        }}
      />
      <CrosshairCorners w={WIDTH} h={HEIGHT} pad={PAGE_INSET} />

      <Header content={content} />
      <VideoCard content={content} enCues={enCues} />

      <div
        style={{
          position: 'absolute',
          top: SECTION_LABEL_TOP,
          left: ML,
          width: WIDTH - ML - MR,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: FONTS.mono,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: 2.5,
          textTransform: 'uppercase',
          color: COLORS.ink,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.78 }}>
          <span style={{ fontSize: 12, color: COLORS.coral }}>✱</span>
          <span>Transcript · 中文字幕</span>
        </div>
        <span style={{ opacity: 0.42 }}>ZH-HANS</span>
      </div>

      <LyricScroller cues={zhCues} highlights={highlights} />
      <Footer content={content} />
    </AbsoluteFill>
  );
};
