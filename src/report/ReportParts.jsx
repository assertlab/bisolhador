import { Circle, Line, Svg, Text, View } from '@react-pdf/renderer';
import { s } from './styles.js';
import { theme as t } from './theme.js';

/** Magnifying glass seal (vector, nothing to ship). */
export function BrandMark({ size }) {
  return (
    <Svg viewBox="-125 -125 250 250" style={{ width: size, height: size }}>
      <Circle cx="0" cy="0" r="125" fill={t.navy} />
      <Circle cx="0" cy="0" r="117" fill="none" stroke={t.accent} strokeWidth="12" />
      <Circle cx="-14" cy="-14" r="46" fill="none" stroke="#fff" strokeWidth="14" />
      <Line x1="20" y1="20" x2="70" y2="70" stroke="#fff" strokeWidth="18" strokeLinecap="round" />
    </Svg>
  );
}

// Absolute and `fixed`: every page gets it, whatever the content does.
export function Banner({ title, subtitle }) {
  return (
    <View style={s.banner} fixed>
      <View style={s.brand}>
        <BrandMark size={26} />
        <Text style={s.brandName}>{t.productName}</Text>
      </View>
      <View>
        <Text style={s.bannerTitle}>{title}</Text>
        <Text style={s.bannerSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function Footer({ text }) {
  return (
    <View style={s.footer} fixed>
      <Text>{text}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function Stats({ items }) {
  return (
    <View style={s.stats}>
      {items.map((i) => (
        <View key={i.label}>
          <Text style={s.statLabel}>{i.label}</Text>
          <Text style={s.statValue}>{i.value}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * One ranked bar per repository (largest first), scaled to the largest value, with the class
 * median marked on each track. items: { key, label, value, text, note? } (text = formatted value).
 */
export function CompareBars({ items, max, median }) {
  const scale = max > 0 ? max : 1;
  const medianAt = median != null ? Math.min(100, (median / scale) * 100) : null;
  return (
    <View>
      {items.map((i) => (
        <View key={i.key} style={{ marginBottom: 5 }} wrap={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ flex: 1, paddingRight: 8 }}>{i.label}</Text>
            <Text style={s.num}>
              {i.text}
              {i.note ? <Text style={[s.muted, { fontSize: 7.5 }]}>{`  ${i.note}`}</Text> : null}
            </Text>
          </View>
          <View style={{ height: 5, borderRadius: 2.5, backgroundColor: t.track }}>
            <View style={{ height: 5, borderRadius: 2.5, width: `${Math.max(1, (i.value / scale) * 100)}%`, backgroundColor: t.bar }} />
            {medianAt != null && <View style={{ position: 'absolute', top: -2, bottom: -2, left: `${medianAt}%`, width: 1, backgroundColor: t.muted }} />}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Full-grid table (landscape). Header repeats on each page; rows never split. */
export function GridTable({ columns, rows }) {
  const last = columns.length - 1;
  const box = (c) => (c.width ? { width: c.width } : { flex: 1 });
  return (
    <View>
      <View style={[s.th, s.gridEdge]} fixed>
        {columns.map((c, i) => (
          <Text key={c.key} style={[s.thText, i < last ? s.hcell : { paddingHorizontal: 4 }, c.align ? s.num : {}, box(c), { fontSize: 7.5 }]}>
            {c.header}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={[s.row, s.gridEdge, { paddingVertical: 0 }]} wrap={false}>
          {columns.map((c, i) => (
            <View key={c.key} style={[i < last ? s.cell : { paddingHorizontal: 4, paddingVertical: 2.5 }, box(c)]}>
              <Text style={[c.align ? s.num : {}, { fontSize: 7.5 }]}>{r[c.key]}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
