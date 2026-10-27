import { StyleSheet } from '@react-pdf/renderer';
import { FONT_FAMILY } from './fonts.js';
import { theme as t } from './theme.js';

export const s = StyleSheet.create({
  page: { paddingTop: t.bannerHeight + 16, paddingBottom: 44, paddingHorizontal: t.pagePadding, fontSize: 9, color: t.text, fontFamily: FONT_FAMILY },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, height: t.bannerHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.navy, paddingHorizontal: t.pagePadding },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandName: { fontSize: 15, fontWeight: 700, color: '#fff' },
  bannerTitle: { fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'right' },
  bannerSub: { fontSize: 8.5, color: t.bannerSub, textAlign: 'right', marginTop: 2 },
  muted: { color: t.muted },
  stats: { flexDirection: 'row', gap: 24, marginBottom: 14, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.line },
  statLabel: { fontSize: 8, color: t.muted },
  statValue: { fontSize: 14, fontWeight: 700 },
  h2: { fontSize: 11, fontWeight: 700, color: t.navy, marginTop: 10, marginBottom: 4 },
  h3: { fontSize: 8, fontWeight: 700, color: t.muted, marginTop: 6, marginBottom: 1 },
  p: { lineHeight: 1.1 },
  th: { flexDirection: 'row', paddingVertical: 3, backgroundColor: t.navy },
  thText: { color: '#fff', fontWeight: 700 },
  num: { textAlign: 'right' },
  row: { flexDirection: 'row', paddingVertical: 2.5, borderBottomWidth: 0.5, borderColor: t.line },
  gridEdge: { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: t.grid },
  cell: { paddingHorizontal: 4, paddingVertical: 2.5, borderRightWidth: 0.5, borderColor: t.grid },
  hcell: { paddingHorizontal: 4, borderRightWidth: 0.5, borderColor: t.gridHeader },
  footer: { position: 'absolute', bottom: 20, left: t.pagePadding, right: t.pagePadding, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: t.muted },
});
