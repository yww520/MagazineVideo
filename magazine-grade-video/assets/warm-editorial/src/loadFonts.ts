import { loadFont as loadNotoSerifSC } from '@remotion/google-fonts/NotoSerifSC';
import { loadFont as loadNotoSansSC } from '@remotion/google-fonts/NotoSansSC';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';

export const loadFonts = () => {
  loadNotoSerifSC('normal', {
    weights: ['400', '500', '700'],
    subsets: ['chinese-simplified', 'latin'],
  });
  loadNotoSansSC('normal', {
    weights: ['400', '500', '700'],
    subsets: ['chinese-simplified', 'latin'],
  });
  loadJetBrainsMono('normal', {
    weights: ['400', '500', '700'],
    subsets: ['latin'],
  });
};
