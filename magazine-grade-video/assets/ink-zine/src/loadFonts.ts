import { loadFont as loadNotoSerifSC } from '@remotion/google-fonts/NotoSerifSC';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';

const CSS = `
@font-face {
  font-family: 'Songti SC';
  src: local('Songti SC'), local('Songti SC Regular'), local('STSongti-SC-Regular'), local('SimSong');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Songti SC';
  src: local('Songti SC Bold'), local('STSongti-SC-Bold');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Songti SC';
  src: local('Songti SC Black'), local('STSongti-SC-Black');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
`;

const loadSongti = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('songti-sc-faces')) return;
  const style = document.createElement('style');
  style.id = 'songti-sc-faces';
  style.textContent = CSS;
  document.head.appendChild(style);
};

export const loadFonts = () => {
  loadSongti();
  loadNotoSerifSC('normal', {
    weights: ['400', '600', '700', '900'],
    subsets: ['chinese-simplified', 'latin'],
  });
  loadPlayfair('normal', {
    weights: ['400', '500', '600', '700'],
    subsets: ['latin'],
  });
  loadPlayfair('italic', {
    weights: ['400', '600'],
    subsets: ['latin'],
  });
};
