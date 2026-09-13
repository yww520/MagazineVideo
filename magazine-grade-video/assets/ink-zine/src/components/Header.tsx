import React from 'react';
import { COLORS, FONTS, ML, WIDTH } from '../theme';
import type { LyricContent } from '../../../types';

const titleSize = (title: string) => {
  const max = 58;
  const min = 36;
  const fitted = Math.floor((WIDTH - ML * 2) / (title.length * 1.12));
  return Math.max(min, Math.min(max, fitted));
};

const CoralDiamond: React.FC<{ size?: number }> = ({ size = 8 }) => (
  <div
    style={{
      width: size,
      height: size,
      background: COLORS.coral,
      transform: 'rotate(45deg)',
      flexShrink: 0,
    }}
  />
);

export const Header: React.FC<{ content: LyricContent }> = ({ content }) => {
  const w = WIDTH - ML * 2;
  return (
    <div style={{ position: 'absolute', top: 36, left: ML, width: w }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            flex: 1,
          }}
        >
          {content.mark ? (
            <span
              style={{
                flexShrink: 0,
                fontFamily: FONTS.display,
                fontStyle: 'italic',
                fontWeight: 600,
                fontSize: 15,
                color: COLORS.coral,
                letterSpacing: 1,
              }}
            >
              {content.mark}
            </span>
          ) : (
            <CoralDiamond size={7} />
          )}
          <span
            style={{
              width: 1,
              height: 14,
              background: COLORS.oat,
              opacity: 0.35,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: FONTS.display,
              fontWeight: 400,
              fontSize: 15,
              color: COLORS.oat,
              opacity: 0.42,
              letterSpacing: 0.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {content.kicker}
          </span>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontFamily: FONTS.display,
            fontWeight: 400,
            fontSize: 15,
            color: COLORS.oat,
            opacity: 0.42,
            letterSpacing: 0.3,
          }}
        >
          {content.source}
        </span>
      </div>

      <div style={{ marginTop: 36, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: FONTS.serif,
            fontWeight: 700,
            fontSize: titleSize(content.title),
            lineHeight: 1.12,
            letterSpacing: 2,
            color: COLORS.oat,
            whiteSpace: 'nowrap',
          }}
        >
          {content.title}
        </div>
        <div
          style={{
            margin: '16px auto 0',
            width: 220,
            height: 8,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              height: 1,
              background: COLORS.oat,
              opacity: 0.35,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 8,
              height: 8,
              background: COLORS.coral,
              transform: 'translate(-50%, -50%) rotate(45deg)',
            }}
          />
        </div>
        {content.titleLine2 ? (
          <div
            style={{
              marginTop: 14,
              fontFamily: FONTS.serif,
              fontWeight: 400,
              fontSize: 22,
              letterSpacing: 1,
              color: COLORS.oat,
              opacity: 0.55,
            }}
          >
            {content.titleLine2}
          </div>
        ) : null}
      </div>
    </div>
  );
};
