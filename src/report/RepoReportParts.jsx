import { Text, View } from '@react-pdf/renderer';
import { s } from './styles.js';
import { theme as t } from './theme.js';
import { axisTicks, cleanSeries } from './chartScale.js';

const PLOT_H = 100;
const AXIS_W = 30;

/** Section title with a short muted line under it (what the section is / its scope). */
export function Section({ title, note, children }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={s.h2} minPresenceAhead={110}>{title}</Text>
      {note ? <Text style={[s.muted, { fontSize: 8, marginBottom: 4 }]}>{note}</Text> : null}
      {children}
    </View>
  );
}

/** One metric: title and explanation on the left, the value (and its sample) on the right. Never splits across pages. */
export function StatRow({ title, value, sub, hint }) {
  return (
    <View style={[s.row, { paddingVertical: 4 }]} wrap={false}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontWeight: 700 }}>{title}</Text>
        {hint ? <Text style={[s.muted, { fontSize: 7.5, marginTop: 1 }]}>{hint}</Text> : null}
      </View>
      <View style={{ width: 190 }}>
        <Text style={{ fontSize: 12, fontWeight: 700, textAlign: 'right' }}>{String(value)}</Text>
        {sub ? <Text style={[s.muted, { fontSize: 8, textAlign: 'right', marginTop: 1 }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

/** Bulleted lines. */
export function Bullets({ lines, style }) {
  return lines.map((line, i) => (
    <View key={i} style={{ flexDirection: 'row', marginBottom: 2 }} wrap={false}>
      <Text style={{ width: 10 }}>•</Text>
      <Text style={[s.p, { flex: 1 }, style]}>{line}</Text>
    </View>
  ));
}

/** Label / state pairs (state words for checklists), two columns to keep a short list short. */
export function Checklist({ items }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((item) => (
        <View key={item.label} style={[s.row, { width: '48%', marginRight: '2%' }]} wrap={false}>
          <Text style={{ flex: 1 }}>{item.label}</Text>
          <Text style={{ textAlign: 'right' }}>{item.state}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Vertical columns with gridlines and round axis ticks, always from zero. `labels` are printed under about
 * every (n / 10)th column so they never collide. Vector: text stays selectable.
 */
export function ColumnChart({ values: rawValues, labels }) {
  const values = cleanSeries(rawValues);
  const ticks = axisTicks(Math.max(0, ...values));
  const top = ticks[ticks.length - 1] || 1;
  const every = Math.max(1, Math.ceil(values.length / 10));
  return (
    <View wrap={false} style={{ marginTop: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: AXIS_W, height: PLOT_H }}>
          {ticks.map((k) => (
            <Text key={k} style={{ position: 'absolute', right: 4, bottom: (k / top) * PLOT_H - 4, fontSize: 7, color: t.muted }}>{String(k)}</Text>
          ))}
        </View>
        <View style={{ flex: 1, height: PLOT_H }}>
          {ticks.map((k) => (
            <View key={k} style={{ position: 'absolute', left: 0, right: 0, bottom: (k / top) * PLOT_H, borderTopWidth: 0.5, borderColor: t.line }} />
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: PLOT_H }}>
            {values.map((v, i) => (
              <View key={i} style={{ flex: 1, height: PLOT_H, alignItems: 'center', justifyContent: 'flex-end' }}>
                {v > 0 && <View style={{ width: '70%', maxWidth: 18, height: Math.max(1, (v / top) * PLOT_H), backgroundColor: t.bar, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />}
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: AXIS_W, marginTop: 3 }}>
        {labels.map((label, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            {i % every === 0 && <Text style={{ width: 44, marginHorizontal: -22, textAlign: 'center', fontSize: 6.5, color: t.muted }}>{label}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
