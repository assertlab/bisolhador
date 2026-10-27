import { Document, Text, View } from '@react-pdf/renderer';
import { CompareBars, ReportPage, Stats } from './ReportParts.jsx';
import { Bullets, Checklist, ColumnChart, Section, StatRow } from './RepoReportParts.jsx';
import { s } from './styles.js';
import { theme } from './theme.js';
import { formatters } from '../utils/formatters.js';

const fmtNumber = (value, locale) => (value == null ? 'N/A' : formatters.formatNumber(value, locale));

/**
 * The Dashboard report for one repository. Pure view over `model` (buildRepoReportModel): the same data the
 * screen shows, in the layout of the Classroom report. `meta`: { appVersion, registryVersion, generatedAt }.
 */
export function RepoReportDocument({ model, t, locale, meta }) {
  const { header, cards } = model;
  const when = header.analysisDate ? formatters.formatDateTime(header.analysisDate, locale) : null;
  const subtitle = [header.fullName, when && t(header.isSnapshot ? 'report.repo.snapshotLine' : 'report.repo.analysisLine', { date: when })].filter(Boolean).join(' · ');
  const footer = `${theme.productName} · ${t('report.generated', { date: meta.generatedAt })}`;
  const stat = (card) => <StatRow key={card.id} title={card.title} value={card.value ?? 'N/A'} sub={card.subValue} hint={card.tooltip} />;

  return (
    <Document title={`${t('report.repo.title')} — ${header.fullName}`} author={theme.productName} creator={theme.productName}>
      {/* One flowing page run: sections follow each other and break only when they must (rows and charts never split) */}
      <ReportPage title={t('report.repo.title')} subtitle={subtitle} footer={footer}>
        <Summary />
        <Process />
        <People />
        <Activity />
        <Section title={t('aiProcess.title')}><Ai /></Section>
        <Recent />
        <Section title={t('report.pageTitle.method')}><Method /></Section>
      </ReportPage>
    </Document>
  );

  function Summary() {
    const issues = cards.volume.find((c) => c.id === 'openIssues');
    return (
      <View>
        <Text style={{ fontSize: 16, fontWeight: 700, color: theme.navy }}>{header.fullName}</Text>
        <Text style={[s.p, { marginTop: 3 }]}>{header.description}</Text>
        <Text style={[s.muted, { marginTop: 4, fontSize: 8 }]}>
          {[header.language, `${t('repo.projectAge')}: ${header.age} ${header.since}`, header.url].filter(Boolean).join('  ·  ')}
        </Text>
        <View style={{ marginTop: 10 }}>
          <Stats
            items={[
              { label: t('stats.stars'), value: fmtNumber(cards.volume[0].value, locale) },
              { label: t('stats.forks'), value: fmtNumber(cards.volume[1].value, locale) },
              { label: t('stats.openIssues'), value: fmtNumber(issues.value, locale) },
              { label: t('health.title'), value: model.health.score },
            ]}
          />
        </View>
        {model.warnings.length > 0 && (
          <Section title={t('partialData.title')}>
            <Text style={s.p}>{t('partialData.message', { items: model.warnings.join(', ') })}</Text>
          </Section>
        )}
        <Section title={t('repo.extraStats')}>
          <Stats
            items={[
              { label: t('repo.totalBranches').replace(/:$/, ''), value: fmtNumber(header.branches, locale) },
              { label: t('repo.totalPRs').replace(/:$/, ''), value: fmtNumber(header.prs, locale) },
              { label: t('repo.totalMerges').replace(/:$/, ''), value: fmtNumber(header.merges, locale) },
              { label: t('repo.totalReleases').replace(/:$/, ''), value: fmtNumber(header.releases, locale) },
            ]}
          />
          {stat(cards.volume.find((c) => c.id === 'closedIssues'))}
          {stat(cards.volume.find((c) => c.id === 'codeChurn'))}
        </Section>
        <Section title={t('app.governanceMaturity')}>
          <Section title={t('health.title')} note={t('health.communityHealth')}>
            <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{model.health.score}</Text>
            {model.health.notes.map((note, i) => <Text key={i} style={[s.muted, { fontSize: 8 }]}>{note}</Text>)}
            {model.health.items && <Checklist items={model.health.items} />}
          </Section>
          <MaturityBlock />
        </Section>
      </View>
    );
  }

  function MaturityBlock() {
    const m = model.maturity;
    return (
      <Section title={t('maturity.title')}>
        <Checklist items={m.detectors} />
        {m.detectors.filter((d) => d.note).map((d) => <Text key={d.label} style={[s.muted, { fontSize: 7.5 }]}>{`${d.label}: ${d.note}`}</Text>)}
        <StatRow title={m.codeReview.text} value="" sub={m.codeReview.detail} />
        {m.alert && <Text style={[s.p, { marginTop: 3 }]}>{`${m.alert.title}: ${m.alert.message}`}</Text>}
        <StatRow title={m.zombies.text} value="" sub={m.zombies.detail} />
      </Section>
    );
  }

  function Process() {
    return (
      <View>
        <Section title={t('app.reviewDynamics')}>{cards.review.map(stat)}</Section>
        <Section title={t('app.projectPractices')}>{cards.practices.map(stat)}</Section>
      </View>
    );
  }

  function People() {
    const bus = model.bus;
    const c = model.contributors;
    return (
      <View>
        {bus && (
          <Section title={t('busFactor.sectionTitle')} note={bus.scope}>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>{`${t('busFactor.title')}: ${bus.value} · ${bus.risk}`}</Text>
            <Text style={[s.muted, { marginBottom: 6 }]}>{bus.description}</Text>
            <CompareBars
              items={[...bus.developers.map((d) => ({ key: d.login, label: d.login, value: d.percentage, text: `${d.percentage}%` })), ...(bus.others > 0 ? [{ key: 'others', label: bus.othersLabel, value: bus.others, text: `${bus.others}%` }] : [])]}
              max={100}
              median={null}
            />
          </Section>
        )}
        <Section title={t('contributors.title')} note={c.scope}>
          <Text style={{ fontWeight: 700 }}>{c.title}</Text>
          <Text style={[s.p, { marginBottom: 6 }]}>{c.message}</Text>
          {c.rows.length > 0 && (
            <CompareBars
              items={c.rows.map((r) => ({ key: r.login, label: r.login, value: r.percentage, text: `${r.percentage}%`, note: `${fmtNumber(r.commits, locale)} commits` }))}
              max={100}
              median={null}
            />
          )}
          {c.more > 0 && <Text style={[s.muted, { fontSize: 8 }]}>{t('report.repo.moreContributors', { count: c.more })}</Text>}
        </Section>
      </View>
    );
  }

  function Activity() {
    const a = model.activity;
    const w = model.weekdays;
    return (
      <View>
        <Section title={a.title} note={t('charts.commitActivity.tooltip')}>
          {a.unavailable ? <Text style={s.muted}>{a.unavailable}</Text> : <ColumnChart values={a.values} labels={a.labels} />}
        </Section>
        <Section title={w.title} note={w.note}>
          {w.unavailable ? <Text style={s.muted}>{w.unavailable}</Text> : <ColumnChart values={w.counts} labels={w.days} />}
        </Section>
        <Section title={t('charts.techStack.title')} note={t('charts.techStack.tooltip')}>
          {model.languages.length > 0
            ? <CompareBars items={model.languages.map((l) => ({ key: l.language, label: l.language, value: l.percentage, text: `${l.percentage}%` }))} max={100} median={null} />
            : <Text style={s.muted}>N/A</Text>}
        </Section>
      </View>
    );
  }

  function Ai() {
    const ai = model.ai;
    if (ai.unavailable) return <Text style={s.p}>{ai.unavailable}</Text>;
    return (
      <View>
        {ai.notes.length > 0 && <Bullets lines={ai.notes} style={s.muted} />}
        <Section title={t('aiProcess.toolsTitle')}><Bullets lines={ai.tools} /></Section>
        <Section title={t('aiProcess.depth.title')}>{ai.depth.length ? <Bullets lines={ai.depth} /> : <Text style={s.muted}>N/A</Text>}</Section>
        <Section title={t('aiProcess.repoSubtitle')}>
          {ai.stats.map((item) => <StatRow key={item.label} title={item.label} value={item.value} />)}
        </Section>
        <Section title={t('aiProcess.safeguards.title')}><Bullets lines={ai.safeguards} /></Section>
        {ai.coherence && (
          <Section title={ai.coherence.title} note={ai.coherence.intro}>
            <Bullets lines={ai.coherence.flags} />
            <Text style={[s.muted, { fontSize: 8, marginTop: 3 }]}>{t('aiProcess.coherence.legitimateCausesTitle')}</Text>
            <Bullets lines={['squash', 'otherMember', 'noTrailer', 'disabled'].map((cause) => t(`aiProcess.coherence.legitimateCauses.${cause}`))} style={s.muted} />
          </Section>
        )}
        <Section title={`${t('aiProcess.badge.title')}: ${ai.badge.summary}`}>
          {ai.badge.criteria.length > 0 && <Bullets lines={ai.badge.criteria} />}
        </Section>
        <Text style={[s.muted, { fontSize: 8, marginTop: 6 }]}>{ai.lowerBound}</Text>
      </View>
    );
  }

  function Recent() {
    const r = model.recent;
    return (
      <View>
        <Section title={t('activity.sections.commits')}>
          {r.commitsNote && <Text style={s.muted}>{r.commitsNote}</Text>}
          {r.commits?.map((c, i) => (
            <View key={i} style={s.row} wrap={false}>
              <View style={{ flex: 1 }}>
                <Text>{c.message}</Text>
                <Text style={[s.muted, { fontSize: 7.5 }]}>{c.by}</Text>
              </View>
            </View>
          ))}
        </Section>
        <Section title={t('activity.sections.pullRequests')}>
          {r.prs.length === 0 && <Text style={s.muted}>N/A</Text>}
          {r.prs.map((p, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={{ flex: 1 }}>{p.title}</Text>
              <Text style={[s.muted, { width: 170, textAlign: 'right' }]}>{`${p.state} · ${p.date}`}</Text>
            </View>
          ))}
        </Section>
      </View>
    );
  }

  function Method() {
    const items = ['version', 'registry', header.isSnapshot ? 'snapshot' : 'live', 'nd', 'samples', 'ai'];
    return (
      <View>
        {items.map((k) => (
          <Text key={k} style={[s.p, { marginBottom: 6 }]}>{t(`report.repo.method.${k}`, { version: meta.appVersion, registry: meta.registryVersion, date: when ?? 'N/A' })}</Text>
        ))}
      </View>
    );
  }
}
