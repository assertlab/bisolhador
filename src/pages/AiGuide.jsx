import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SettingsModal } from '../components/SettingsModal';
import { toolLabel } from '../components/ai/toolLabel.js';
import { useHashScroll } from '../hooks/useHashScroll.js';
import { formatters } from '../utils/formatters.js';
import { intlLocale } from '../i18n.js';
import { guidePath } from '../utils/indicatorGuide.js';
import {
  AI_GUIDE_BLOCKS, DECLARATION_TOOLS, AI_GUIDE_FAQ, AI_GUIDE_LIMITS, AI_GUIDE_NUMBERS, GITIGNORE_EXAMPLES,
  coauthorExamples, detectionRows,
} from '../utils/aiGuide.js';

const CARD = 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-5 sm:p-6';
const H3 = 'text-base font-semibold text-gray-900 dark:text-white';
const TEXT = 'text-sm text-gray-700 dark:text-slate-300';
const CODE = 'font-mono text-xs break-all text-gray-800 dark:text-slate-100';
const CELL_CODE = 'font-mono text-xs whitespace-nowrap text-gray-800 dark:text-slate-100';
const TH = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase align-bottom';
const TD = 'px-3 py-2 align-top text-gray-700 dark:text-slate-300';
const GITHUB_COAUTHOR_DOCS = 'https://docs.github.com/en/pull-requests/committing-changes-to-your-project/creating-and-editing-commits/creating-a-commit-with-multiple-authors';

// Numbers quoted by the texts, formatted for the current language.
function useNumbers() {
  const locale = intlLocale();
  return Object.fromEntries(Object.entries(AI_GUIDE_NUMBERS).map(([k, v]) => [k, typeof v === 'number' ? formatters.formatNumber(v, locale) : v]));
}

function Block({ id, children }) {
  const { t } = useTranslation();
  return (
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-4 outline-none">
      <h2 id={`${id}-title`} className="text-xl font-semibold text-shark dark:text-white">{t(`aiGuide.blocks.${id}`)}</h2>
      {children}
    </section>
  );
}

function List({ items }) {
  return (
    <ul className={`${TEXT} list-disc pl-5 space-y-1`}>
      {items.map((text) => <li key={text}>{text}</li>)}
    </ul>
  );
}

/** "Bisolhador reconhece o e-mail X" from the registry (never typed into the locales). */
function RecognizedEmails({ toolId }) {
  const { t } = useTranslation();
  return (
    <ul className={`${TEXT} space-y-1`}>
      {coauthorExamples(toolId).map((c) => (
        <li key={c.emails.join()}>
          {t('aiGuide.declare.recognizes')}{' '}
          {c.emails.map((email, i) => (
            <span key={email}>{i > 0 && ', '}<code className={CODE}>{email}</code></span>
          ))}
          {c.nameShow && ` ${t(`aiGuide.declare.nameRule.${c.nameMatch}`, { name: c.nameShow })}`}
        </li>
      ))}
    </ul>
  );
}

function Overview() {
  const { t } = useTranslation();
  return (
    <Block id="overview">
      <div className={`${CARD} space-y-3`}>
        <h3 className={H3}>{t('aiGuide.overview.questionsTitle')}</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          {['adoption', 'participation', 'safeguards', 'coherence'].map((q) => (
            <div key={q} className="rounded-md bg-gray-50 dark:bg-slate-900/40 p-3">
              <dt className="text-sm font-medium text-gray-900 dark:text-white">{t(`aiGuide.overview.questions.${q}.title`)}</dt>
              <dd className={`${TEXT} mt-1`}>{t(`aiGuide.overview.questions.${q}.text`)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={`${CARD} space-y-2`}>
        <h3 className={H3}>{t('aiGuide.overview.lowerBoundTitle')}</h3>
        <p className={TEXT}>{t('aiGuide.overview.lowerBound')}</p>
      </div>
      <div className={`${CARD} space-y-2`}>
        <h3 className={H3}>{t('aiGuide.overview.notTitle')}</h3>
        <List items={['detector', 'proof', 'grade'].map((k) => t(`aiGuide.overview.not.${k}`))} />
      </div>
      <div className={`${CARD} space-y-2`}>
        <h3 className={H3}>{t('aiGuide.overview.ethicsTitle')}</h3>
        <p className={TEXT}>{t('aiGuide.overview.ethics')}</p>
      </div>
    </Block>
  );
}

function Declare() {
  const { t } = useTranslation();
  const locale = intlLocale();
  return (
    <Block id="declare">
      <p className={TEXT}>{t('aiGuide.declare.intro')}</p>
      <div className={`${CARD} space-y-3`}>
        <h3 className={H3}>{t('aiGuide.declare.manualTitle')}</h3>
        <p className={TEXT}>{t('aiGuide.declare.manual')}</p>
        <pre className="overflow-x-auto rounded-md bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 p-3 text-xs text-gray-800 dark:text-slate-100 whitespace-pre-wrap break-words">
          {t('aiGuide.declare.manualExample')}
        </pre>
        <p className={TEXT}>{t('aiGuide.declare.manualNote')}</p>
        <a href={GITHUB_COAUTHOR_DOCS} target="_blank" rel="noopener noreferrer" className="text-sm text-ocean hover:underline">
          {t('aiGuide.declare.manualSource')} ↗
        </a>
      </div>

      <h3 className={H3}>{t('aiGuide.declare.toolsTitle')}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {DECLARATION_TOOLS.map((tool) => (
          <article key={tool.id} className={`${CARD} space-y-2`}>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{toolLabel(tool.id, t)}</h4>
            {tool.mode === 'verified'
              ? <p className={TEXT}>{t(`aiGuide.declare.tools.${tool.id}`)}</p>
              : <p className="text-xs text-gray-500 dark:text-slate-400">{t('aiGuide.declare.emailOnly')}</p>}
            <RecognizedEmails toolId={tool.id} />
            {tool.mode === 'verified' && (
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {t('aiGuide.declare.checked', { date: formatters.formatDate(`${tool.checked}T12:00:00`, locale) })}:{' '}
                {tool.sources.map((url, i) => (
                  <span key={url}>
                    {i > 0 && ' · '}
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-ocean hover:underline break-all">{new URL(url).hostname}</a>
                  </span>
                ))}
              </p>
            )}
          </article>
        ))}
      </div>

      <div className={`${CARD} space-y-2 border-l-4 border-l-ocean`}>
        <h3 className={H3}>{t('aiGuide.declare.policyTitle')}</h3>
        <p className={TEXT}>{t('aiGuide.declare.policy')}</p>
      </div>
    </Block>
  );
}

const Codes = ({ items }) => (items.length === 0 ? <span aria-hidden="true">—</span> : (
  <ul className="space-y-0.5">{items.map((item) => <li key={item.key ?? item}>{item.node ?? <code className={CELL_CODE}>{item}</code>}</li>)}</ul>
));

function Detect() {
  const { t } = useTranslation();
  const rows = detectionRows();
  return (
    <Block id="detect">
      <p className={TEXT}>{t('aiGuide.detect.intro', { version: AI_GUIDE_NUMBERS.registryVersion })}</p>
      <div className={`${CARD} !p-0 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
            <caption className="sr-only">{t('aiGuide.detect.caption')}</caption>
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                {['tool', 'config', 'coauthor', 'agent', 'reviewer'].map((c) => (
                  <th key={c} scope="col" className={TH}>{t(`aiGuide.detect.columns.${c}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className={`${TD} text-left font-medium text-gray-900 dark:text-white whitespace-nowrap`}>{toolLabel(row.id, t)}</th>
                  <td className={TD}>
                    <Codes items={row.config.map((c) => ({
                      key: c.show,
                      node: (
                        <>
                          <code className={CELL_CODE}>{c.show}</code>
                          {c.kind === 'extensions' && <span className="ml-1 text-xs text-gray-500 dark:text-slate-400">({t('aiGuide.detect.extension')})</span>}
                        </>
                      ),
                    }))} />
                  </td>
                  <td className={TD}>
                    <Codes items={row.coauthors.flatMap((c) => c.emails.map((email) => ({
                      key: email,
                      node: (
                        <>
                          <code className={CELL_CODE}>{email}</code>
                          {c.nameShow && <span className="block text-xs text-gray-500 dark:text-slate-400">{t(`aiGuide.declare.nameRule.${c.nameMatch}`, { name: c.nameShow })}</span>}
                        </>
                      ),
                    })))} />
                  </td>
                  <td className={TD}><Codes items={row.agentLogins} /></td>
                  <td className={TD}><Codes items={row.reviewerLogins} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400">{t('aiGuide.detect.legend')}</p>
      <p className={TEXT}>{t('aiGuide.detect.genericNote')}</p>
      <div className={`${CARD} space-y-2`}>
        <h3 className={H3}>{t('aiGuide.detect.gitignoreTitle')}</h3>
        <p className={TEXT}>{t('aiGuide.detect.gitignore')}</p>
        <ul className="flex flex-wrap gap-2">
          {GITIGNORE_EXAMPLES.map((line) => (
            <li key={line}><code className={`${CODE} rounded bg-gray-100 dark:bg-slate-700 px-2 py-0.5`}>{line}</code></li>
          ))}
        </ul>
      </div>
    </Block>
  );
}

function Teachers() {
  const { t } = useTranslation();
  const card = (key, body) => (
    <div className={`${CARD} space-y-2`}>
      <h3 className={H3}>{t(`aiGuide.teachers.${key}Title`)}</h3>
      {body}
    </div>
  );
  return (
    <Block id="teachers">
      {card('reading', (
        <>
          <p className={TEXT}>{t('aiGuide.teachers.reading')}</p>
          <p className={TEXT}>{t('aiGuide.teachers.configNotUse')}</p>
          <p className={TEXT}>{t('aiGuide.teachers.conversation')}</p>
        </>
      ))}
      {card('template', <p className={TEXT}>{t('aiGuide.teachers.template')}</p>)}
      {card('disagree', <p className={TEXT}>{t('aiGuide.teachers.disagree')}</p>)}
      {card('policies', <List items={['declare', 'review', 'config', 'reflect'].map((k) => t(`aiGuide.teachers.policies.${k}`))} />)}
      {card('privacy', <p className={TEXT}>{t('aiGuide.teachers.privacy')}</p>)}
    </Block>
  );
}

function Faq({ numbers }) {
  const { t } = useTranslation();
  return (
    <Block id="faq">
      <div className="space-y-2">
        {AI_GUIDE_FAQ.map((id) => (
          <details key={id} id={`faq-${id}`} className={`${CARD} !py-3 group`}>
            <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white marker:text-ocean">
              {t(`aiGuide.faq.items.${id}.q`)}
            </summary>
            <p className={`${TEXT} mt-2`}>{t(`aiGuide.faq.items.${id}.a`, numbers)}</p>
          </details>
        ))}
      </div>
    </Block>
  );
}

function Limits({ numbers }) {
  const { t } = useTranslation();
  return (
    <Block id="limits">
      <p className={TEXT}>{t('aiGuide.limits.intro')}</p>
      <ul className={`${CARD} space-y-3`}>
        {AI_GUIDE_LIMITS.map((item) => (
          <li key={item.id} className={TEXT}>
            {t(`aiGuide.limits.items.${item.id}`, numbers)}{' '}
            <Link to={guidePath(item.guide)} className="text-xs text-ocean hover:underline whitespace-nowrap">
              {t('aiGuide.limits.more')} →
            </Link>
          </li>
        ))}
      </ul>
    </Block>
  );
}

// "Guia de IA no Processo" (/guia/ia): how to declare AI use, what is detected (generated from the
// registry), guidance for teachers, FAQ and limits. Definitions stay in /guia (guide.items.ai-*).
export function AiGuide({ isSettingsOpen, setIsSettingsOpen }) {
  const { t } = useTranslation();
  useHashScroll();
  const numbers = useNumbers();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />
      <main className="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <header className="space-y-3">
          <Link to={guidePath('ai-tools')} className="text-sm text-ocean hover:underline">← {t('aiGuide.back')}</Link>
          <h1 className="text-3xl font-bold text-shark dark:text-white">{t('aiGuide.title')}</h1>
          <p className="text-gray-600 dark:text-slate-300">{t('aiGuide.intro')}</p>
          <nav aria-label={t('aiGuide.toc')} className="pt-2">
            <h2 className="text-xs font-medium uppercase text-gray-500 dark:text-slate-400 mb-2">{t('aiGuide.toc')}</h2>
            <ol className="flex flex-wrap gap-2 text-sm">
              {AI_GUIDE_BLOCKS.map((id, i) => (
                <li key={id}>
                  <Link to={`#${id}`} className="inline-block rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-gray-700 dark:text-slate-200 hover:border-ocean hover:text-ocean">
                    {i + 1}. {t(`aiGuide.blocks.${id}`)}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </header>

        <Overview />
        <Declare />
        <Detect />
        <Teachers />
        <Faq numbers={numbers} />
        <Limits numbers={numbers} />
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
