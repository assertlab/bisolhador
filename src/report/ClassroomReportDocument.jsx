import { Document, Page, Text, View } from '@react-pdf/renderer';
import { Banner, CompareBars, Footer, GridTable, Stats } from './ReportParts.jsx';
import { s } from './styles.js';
import { formatValue } from './format.js';
import { readingFor } from './reportReading.js';
import { theme } from './theme.js';
import { CLASSROOM_COMMIT_PAGES, CLASSROOM_PR_SCAN } from '../constants.js';

const SAMPLE_CAPS = { prScan: CLASSROOM_PR_SCAN, commitCap: CLASSROOM_COMMIT_PAGES * 100 };
const READING_VALUE_PARAMS = ['value', 'min', 'max', 'median'];

/**
 * The report. Pure view: everything comes in as `model` (buildReportModel), `t`, `locale`
 * and `meta` ({ appVersion, registryVersion, generatedAt, anonymized, toolLabel }).
 */
export function ClassroomReportDocument({ model, t, locale, meta, i18nHas = () => false }) {
  const { period, summary, indicators, ai } = model;
  const subtitle = t('report.period', { from: fmtDate(period.from, locale), to: fmtDate(period.to, locale) });
  const footer = `${theme.productName} · ${t('report.generated', { date: meta.generatedAt })}`;
  const page = (title, children, landscape = false) => (
    <Page size="A4" orientation={landscape ? 'landscape' : 'portrait'} style={s.page}>
      <Banner title={title} subtitle={subtitle} />
      {children}
      <Footer text={footer} />
    </Page>
  );

  return (
    <Document title={`${t('report.title')} — ${subtitle}`} author={theme.productName} creator={theme.productName}>
      {page(t('report.pageTitle.summary'), <SummaryPage />)}
      {page(t('report.pageTitle.indicators'), indicators.map((ind) => <IndicatorBlock key={ind.key} ind={ind} />))}
      {page(t('report.pageTitle.ai'), <AiPage />)}
      {page(t('report.pageTitle.table'), <TablePage />, true)}
      {page(t('report.pageTitle.method'), <MethodPage />)}
    </Document>
  );

  function SummaryPage() {
    return (
      <View>
        <Text style={s.muted}>{t('report.summary.requested', { count: summary.requested })}</Text>
        {summary.duplicates > 0 && <Text style={s.muted}>{t('report.summary.duplicates', { count: summary.duplicates })}</Text>}
        {meta.anonymized && <Text style={s.muted}>{t('report.summary.anonymized')}</Text>}
        <Stats
          items={[
            { label: t('report.summary.analyzed'), value: String(summary.analyzed) },
            { label: t('report.summary.partial'), value: String(summary.partial) },
            { label: t('report.summary.failed'), value: String(summary.failed) },
            ...(summary.private == null ? [] : [{ label: t('report.summary.private'), value: String(summary.private) }]),
          ]}
        />
        <Text style={s.h2}>{t('report.summary.howToTitle')}</Text>
        <Text style={s.p}>{t('report.summary.howTo')}</Text>
        {summary.allSolo && (
          <View wrap={false}>
            <Text style={s.h2}>{t('report.summary.soloTitle')}</Text>
            <Text style={s.p}>{t('report.summary.solo')}</Text>
          </View>
        )}
        <Text style={s.h2}>{t('report.summary.lowerBoundTitle')}</Text>
        <Text style={s.p}>{t('report.summary.lowerBound')}</Text>
      </View>
    );
  }

  function IndicatorBlock({ ind }) {
    // Classroom measures the course period; the Dashboard guide texts (52 weeks, 12 months, last 50…)
    // don't describe that, so `report.indicator.<id>.<field>` overrides the guide field by field.
    const text = (field) => {
      const override = `report.indicator.${ind.guide}.${field}`;
      return t(i18nHas(override) ? override : `guide.items.${ind.guide}.${field}`, SAMPLE_CAPS);
    };
    // Requested order, not by value: the report describes position, it doesn't rank teams
    const bars = ind.items.map((i) => ({
        key: i.label,
        label: i.label,
        value: i.value,
        text: `${i.atLeast ? `${t('report.label.atLeast')} ` : ''}${formatValue(ind.unit, i.value, locale)}`,
        note: [i.n != null ? t('report.label.n', { n: i.n }) : null, i.sampled ? t('report.label.sampled') : null].filter(Boolean).join(' · '),
      }));
    const reading = readingFor(ind, summary).map((line) => {
      const params = { ...line.params };
      for (const k of READING_VALUE_PARAMS) if (k in params) params[k] = formatValue(ind.unit, params[k], locale);
      return t(`report.reading.${line.key}`, params);
    });
    return (
      <View style={{ marginBottom: 14 }}>
        <View wrap={false}>
          <Text style={s.h2}>{text('name')}</Text>
          {ind.items.length === 0 ? (
            <Text style={s.muted}>{t('report.label.noData')}</Text>
          ) : (
            <Text style={[s.muted, { marginBottom: 4, fontSize: 8 }]}>{t('report.label.median', { value: formatValue(ind.unit, ind.median, locale) })}</Text>
          )}
        </View>
        {bars.length > 0 && <CompareBars items={bars} max={ind.unit === 'percent' ? 100 : ind.max} median={ind.median} />}
        {ind.unavailable.length > 0 && <Text style={[s.muted, { fontSize: 8 }]}>{t('report.label.unavailable', { names: ind.unavailable.join(', ') })}</Text>}
        <Block title={t('report.label.what')} text={text('what')} />
        <Block title={t('report.label.read')} text={text('read')} />
        <View wrap={false}>
          <Text style={s.h3}>{t('report.label.reading')}</Text>
          {reading.map((line, i) => <Text key={i} style={s.p}>{line}</Text>)}
        </View>
        <Block title={t('report.label.limits')} text={text('limits')} />
      </View>
    );
  }

  function AiPage() {
    const cell = (v) => v ?? t('report.ai.unknown');
    const rows = ai.map((r) => ({
      repo: r.label,
      tools: r.tools == null ? cell(null) : r.tools.length ? r.tools.map(meta.toolLabel).join(', ') : t('report.ai.noTrace'),
      badge: r.badge == null
        ? t('report.ai.badgeNone')
        : `${t('report.ai.badgeScore', { met: r.badge.met, total: r.badge.total })}${r.badge.unverified ? ` (${t('report.ai.badgeUnassessed', { count: r.badge.unverified })})` : ''}`,
      sources: r.flags == null ? cell(null) : r.flags.length ? t('report.ai.disagree') : t('report.ai.agree'),
    }));
    return (
      <View>
        <GridTable
          columns={[
            { key: 'repo', header: t('classroom.columns.repo'), width: 150 },
            { key: 'tools', header: t('report.ai.tools') },
            { key: 'badge', header: t('report.ai.badge'), width: 150 },
            { key: 'sources', header: t('report.ai.coherence'), width: 80 },
          ]}
          rows={rows}
        />
        <Block title={t('guide.items.ai-badge.name')} text={t('guide.items.ai-badge.what')} />
        <Block title={t('guide.items.ai-coherence.name')} text={t('guide.items.ai-coherence.what')} />
        <Text style={[s.p, { marginTop: 8 }]}>{t('report.summary.lowerBound')}</Text>
      </View>
    );
  }

  function TablePage() {
    const keys = indicators.map((i) => i.key);
    const labels = [...new Set(indicators.flatMap((i) => [...i.items.map((x) => x.label), ...i.unavailable]))];
    const rows = labels.map((label) => {
      const row = { repo: label };
      for (const ind of indicators) {
        const item = ind.items.find((x) => x.label === label);
        row[ind.key] = item ? formatValue(ind.unit, item.value, locale) : t('report.label.nd');
      }
      return row;
    });
    return (
      <GridTable
        columns={[
          { key: 'repo', header: t('classroom.columns.repo'), width: 130 },
          ...keys.map((key) => ({ key, header: t(`classroom.columns.${key}`), align: 'right' })),
        ]}
        rows={rows}
      />
    );
  }

  function MethodPage() {
    const common = { from: fmtDate(period.from, locale), to: fmtDate(period.to, locale), ...SAMPLE_CAPS };
    return (
      <View>
        <Text style={s.p}>{t('report.method.items.version', { version: meta.appVersion })}</Text>
        <Text style={s.p}>{t('report.method.items.registry', { registry: meta.registryVersion })}</Text>
        {['period', 'privacy', 'samples', 'nd', 'ai'].map((k) => (
          <Text key={k} style={[s.p, { marginTop: 6 }]}>{t(`report.method.items.${k}`, common)}</Text>
        ))}
      </View>
    );
  }
}

function Block({ title, text }) {
  return (
    <View wrap={false}>
      <Text style={s.h3}>{title}</Text>
      <Text style={s.p}>{text}</Text>
    </View>
  );
}

const fmtDate = (iso, locale) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
