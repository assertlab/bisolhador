import { Font } from '@react-pdf/renderer';
import regularUrl from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url';
import semiboldUrl from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?url';

export const FONT_FAMILY = 'Plex';
let registered = false;

// react-pdf reads .woff/.ttf, not .woff2. The 600 file goes in as weight 700 so
// `fontWeight: 700` in the styles picks SemiBold. No silent Helvetica fallback:
// a report in the wrong font is worse than a clear error.
export function registerFonts() {
  if (registered) return;
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: regularUrl, fontWeight: 400 },
      { src: semiboldUrl, fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
