import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { GuideLink } from '../GuideLink.jsx';
import { AI_MIN_GROUP } from '../../constants.js';
import { formatters } from '../../utils/formatters.js';
import { intlLocale } from '../../i18n.js';
import { AI_GUIDE_PATH } from '../../utils/indicatorGuide.js';
import { AiCoherence } from './AiCoherence.jsx';
import { AiResponsibleBadge } from './AiResponsibleBadge.jsx';
import { BlockTitle, Chip, InfoTip } from './AiParts.jsx';
import { toolLabel as labelOf } from './toolLabel.js';

const CARD = 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow';
const NOTE = 'text-xs text-gray-500 dark:text-slate-400';

/**
 * "AI in the Process › Repository" (Dashboard and Classroom Mode). Receives only report.aiProcess:
 * counts and tool ids, never people. Everything is a lower bound: no trace ≠ no AI.
 */
export function AiProcessSection({ aiProcess }) {
  const { t } = useTranslation();

  if (!aiProcess?.available) {
    return (
      <div className={CARD}>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          {aiProcess?.reason === 'snapshot' || !aiProcess ? t('aiProcess.notRecorded') : t('aiProcess.unavailable.error')}
        </p>
      </div>
    );
  }

  const { tools, config, commits, prs, safeguards, coherence, badge } = aiProcess;
  const locale = intlLocale();
  const num = (value) => formatters.formatNumber(value, locale);
  const noToken = aiProcess.withToken === false;
  // Context query (.gitignore, settings, template) skipped or failed: those checks read null.
  const contextMissing = config.hiddenLocal === null;
  const anyFailure = !commits.available || !prs.available || (!noToken && (contextMissing || !safeguards.available));
  const toolLabel = (id) => labelOf(id, t);
  const unknownTemplate = new Set(config.entries.filter((e) => e.fromTemplate === null).map((e) => e.toolId));

  return (
    <div className={`${CARD} space-y-5`}>
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        {t('aiProcess.repoSubtitle')}
        <InfoTip text={t('aiProcess.tooltip')} />
      </h4>

      {noToken && <p className={NOTE}>{t('aiProcess.unavailable.noToken')}</p>}
      {anyFailure && <p className={NOTE}>{t('aiProcess.unavailable.error')}</p>}

      {/* 1. Tools and the sources that show them */}
      <section>
        <BlockTitle>{t('aiProcess.toolsTitle')}</BlockTitle>
        {tools.length > 0 ? (
          <ul className="space-y-2">
            {tools.map((tool) => (
              <li key={tool.id} className="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-slate-100">
                <span className="font-medium">{toolLabel(tool.id)}</span>
                {tool.sources.map((src) => (
                  <Chip key={src} tone="trace" tooltip={t(`aiProcess.sources.tooltip.${src}`)}>{t(`aiProcess.sources.${src}`)}</Chip>
                ))}
                {tool.fromTemplate && <Chip tooltip={t('aiProcess.sources.tooltip.template')}>{t('aiProcess.sources.template')}</Chip>}
                {unknownTemplate.has(tool.id) && (
                  <Chip tooltip={t('aiProcess.sources.tooltip.templateUnknown')}>{t('aiProcess.sources.templateUnknown')}</Chip>
                )}
              </li>
            ))}
          </ul>
        ) : config.hiddenLocal?.length > 0 ? (
          <p className="text-sm text-gray-700 dark:text-slate-200">{t('aiProcess.hiddenOnly')}</p>
        ) : (
          <div className="p-3 rounded-md bg-gray-50 dark:bg-slate-900/40 text-sm">
            <p className="font-medium text-gray-900 dark:text-white">{t('aiProcess.noTraces')}</p>
            <p className="text-gray-600 dark:text-slate-300 mt-1">{t('aiProcess.noTracesDetail')}</p>
          </div>
        )}
        <GuideLink id="ai-tools" className="mt-2 inline-block" />
      </section>

      {/* 2. Configuration depth */}
      <section>
        <BlockTitle>{t('aiProcess.depth.title')}</BlockTitle>
        <ConfigDepth tools={tools} config={config} toolLabel={toolLabel} />
        <GuideLink id="ai-config-depth" className="mt-2 inline-block" />
      </section>

      {/* 3. Three numbers, always with n */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AiStat
          label={t('aiProcess.commitsLabel')}
          tooltip={t('aiProcess.commitsTooltip')}
          value={!commits.available ? t('aiProcess.notAvailable')
            : commits.n === 0 ? t('aiProcess.emptySample')
            : `${t('aiProcess.commits', { withAi: num(commits.withAi), n: num(commits.n) })} (${commits.percentage}%)`}
          detail={!commits.available ? t('aiProcess.fetchFailed')
            : commits.firstTraceAt ? t('aiProcess.firstTrace', { date: formatters.formatDate(commits.firstTraceAt, locale) }) : null}
          guideId="ai-commits"
        />
        <AiStat
          label={t('aiProcess.prsLabel')}
          tooltip={t('aiProcess.prsTooltip')}
          value={!prs.available ? t('aiProcess.notAvailable')
            : prs.n === 0 ? t('aiProcess.emptySample')
            : `${t('aiProcess.prs', { byAgents: num(prs.byAgents), n: num(prs.n) })} (${prs.percentage}%)`}
          detail={!prs.available ? t('aiProcess.fetchFailed') : null}
          guideId="ai-prs"
        />
        <AiStat
          label={t('aiProcess.aiReviewedLabel')}
          tooltip={t('aiProcess.aiReviewedTooltip')}
          value={!prs.available || !prs.aiReviewed.available ? t('aiProcess.notAvailable')
            : prs.n === 0 ? t('aiProcess.emptySample')
            : `${t('aiProcess.aiReviewed', { reviewed: num(prs.aiReviewed.count), n: num(prs.n) })} (${prs.aiReviewed.percentage}%)`}
          detail={prs.available && !prs.aiReviewed.available ? t(noToken ? 'aiProcess.needsToken' : 'aiProcess.fetchFailed') : null}
          guideId="ai-review"
        />
      </section>

      {/* 4. Safeguards */}
      <section>
        <BlockTitle tooltip={t('aiProcess.safeguards.tooltip')}>{t('aiProcess.safeguards.title')}</BlockTitle>
        <Safeguards safeguards={safeguards} noToken={noToken} num={num} />
        <GuideLink id="ai-safeguards" className="mt-2 inline-block" />
      </section>

      {/* 5. Sources in disagreement (+ what could not be verified) */}
      <AiCoherence coherence={coherence} skipUnverified={noToken ? ['gitignore', 'template'] : []} />

      {/* 6. Responsible AI use */}
      <AiResponsibleBadge badge={badge} />

      {/* 7. Lower bound */}
      <p className={`${NOTE} border-t border-gray-100 dark:border-slate-700 pt-3`}>
        {t('aiProcess.lowerBoundNote')}{' '}
        <Link to={AI_GUIDE_PATH} className="font-medium text-ocean hover:underline">{t('aiGuide.link')} →</Link>
      </p>
    </div>
  );
}

function ConfigDepth({ tools, config, toolLabel }) {
  const { t } = useTranslation();
  const configured = tools.filter((tool) => tool.configKind);
  return (
    <div className="text-sm text-gray-700 dark:text-slate-200 space-y-1">
      {configured.length > 0 ? (
        <ul className="space-y-1">
          {configured.map((tool) => (
            <li key={tool.id}>
              <span className="font-medium">{toolLabel(tool.id)}</span>: {t(`aiProcess.depth.${tool.configKind}`)}
              {tool.fromTemplate && ` (${t('aiProcess.sources.template')})`}
            </li>
          ))}
        </ul>
      ) : config.status === 'complete' ? <p>{t('aiProcess.depth.none')}</p>
        : config.status === 'partial' && <p>{t('aiProcess.depth.nonePartial')}</p>}
      {config.status === 'truncated' && <p className={NOTE}>{t('aiProcess.depth.treeTruncated')}</p>}
      {config.status === 'unavailable' && <p className={NOTE}>{t('aiProcess.depth.treeUnavailable')}</p>}
      {config.status === 'incomplete' && <p className={NOTE}>{t('aiProcess.depth.listingIncomplete')}</p>}
      {config.hiddenLocal?.length > 0 && (
        <p>{t('aiProcess.depth.hiddenLocal', { paths: config.hiddenLocal.join(', ') })}</p>
      )}
    </div>
  );
}

function Safeguards({ safeguards, noToken, num }) {
  const { t } = useTranslation();
  if (!safeguards.available) {
    return (
      <p className="text-sm text-gray-700 dark:text-slate-200">
        {t('aiProcess.notAvailable')} — {t(noToken ? 'aiProcess.needsToken' : 'aiProcess.fetchFailed')}
      </p>
    );
  }
  if (!safeguards.agentPrs) return <p className="text-sm text-gray-700 dark:text-slate-200">{t('aiProcess.safeguards.noAgentPrs')}</p>;
  const { size } = safeguards;
  return (
    <ul className="text-sm text-gray-700 dark:text-slate-200 space-y-1">
      <li>{t('aiProcess.safeguards.agentUnapproved', { unapproved: num(safeguards.agentUnapproved), agentPrs: num(safeguards.agentPrs) })}</li>
      <li>
        {size.available
          ? t('aiProcess.safeguards.size', { agent: num(size.agentMedian), agentN: num(size.agentN), human: num(size.humanMedian), humanN: num(size.humanN) })
          : t('aiProcess.safeguards.sizeUnavailable', { min: AI_MIN_GROUP, agentN: num(size.agentN), humanN: num(size.humanN) })}
      </li>
    </ul>
  );
}

function AiStat({ label, tooltip, value, detail, guideId }) {
  return (
    <div className="p-3 rounded-md bg-gray-50 dark:bg-slate-900/40">
      <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
        {label}
        <InfoTip text={tooltip} />
      </div>
      <div className="text-base font-semibold text-gray-900 dark:text-white mt-1">{value}</div>
      {detail && <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{detail}</div>}
      <GuideLink id={guideId} className="mt-1 inline-block" />
    </div>
  );
}
