// The report font has no emoji or check marks: "🧪 Testes" or "✓" print as garbage. Pictographs (and the
// zero-width joiner / variation selector that glue them) are removed from every translated text; a few
// math signs and arrows the font also lacks become ASCII.
const PICTOGRAPHS = /\p{Extended_Pictographic}/gu;
const GLUE = /\u200D|\uFE0F/g;
const CHECK_MARKS = /[✓✗]/g;

// Signs the font lacks (checked by rendering them): plain ASCII stands in
const ASCII_FOR = { '≥': '>=', '≤': '<=', '≠': '!=', '≈': '~', '→': '->' };
const MISSING_SIGNS = /[≥≤≠≈→]/g;

export function plainText(text) {
  if (typeof text !== 'string') return text; // returnObjects (the weekday names) pass through
  return text.replace(MISSING_SIGNS, (sign) => ASCII_FOR[sign]).replace(PICTOGRAPHS, '').replace(GLUE, '').replace(CHECK_MARKS, '').replace(/\s{2,}/g, ' ').trim();
}
