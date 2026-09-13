import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Cue, Highlights, LyricContent } from '../../types';
import { PageGround } from './components/PageGround';
import { Header } from './components/Header';
import { VideoFrame } from './components/VideoFrame';
import { LyricScroller } from './components/LyricScroller';
import { Footer } from './components/Footer';

export const LyricPlayer: React.FC<{
  content: LyricContent;
  zhCues: Cue[];
  enCues: Cue[];
  highlights: Highlights;
}> = ({ content, zhCues, enCues, highlights }) => {
  return (
    <AbsoluteFill>
      <PageGround />
      <Header content={content} />
      <VideoFrame content={content} enCues={enCues} />
      <LyricScroller cues={zhCues} highlights={highlights} />
      <Footer content={content} />
    </AbsoluteFill>
  );
};
