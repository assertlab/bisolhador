import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { SettingsModal } from '../components/SettingsModal';
import { GUIDE_SECTIONS, CHAOSS, DATA_ETHICS_URL } from '../utils/indicatorGuide.js';

const RELATION_STYLE = {
  equivalent: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  related: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  none: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
};

// "Como interpretar": definitions, limitations and CHAOSS references for every
// indicator. Cards link here with #<id> (indicatorGuide.guidePath).
export function Guide({ isSettingsOpen, setIsSettingsOpen }) {
  const { t } = useTranslation();
  const { hash } = useLocation();

  const target = decodeURIComponent(hash.slice(1));

  // react-router doesn't scroll to #anchors, nor reset scroll on navigation;
  // focus moves to the entry for keyboard and screen-reader users.
  useEffect(() => {
    const el = target && document.getElementById(target);
    if (!el) {
      window.scrollTo(0, 0);
      return;
    }
    el.scrollIntoView({ block: 'start' });
    el.focus({ preventScroll: true });
  }, [target]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />
      <main className="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold text-shark dark:text-white">{t('guide.title')}</h1>
          <p className="text-gray-600 dark:text-slate-300">{t('guide.intro')}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('guide.ethics')}{' '}
            <a href={DATA_ETHICS_URL} target="_blank" rel="noopener noreferrer" className="text-ocean hover:underline">
              {t('guide.ethicsLink')}
            </a>
          </p>
        </header>

        {GUIDE_SECTIONS.map((section) => (
          <section key={section.id} className="space-y-4">
            <h2 className="text-xl font-semibold text-shark dark:text-white">{t(`guide.sections.${section.id}`)}</h2>
            {section.items.map((item) => {
              const note = t(`guide.items.${item.id}.chaossNote`);
              return (
                <article
                  key={item.id}
                  id={item.id}
                  tabIndex={-1}
                  // :target doesn't update on pushState navigation (cards use <Link>)
                  className={`scroll-mt-24 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 space-y-3 outline-none ${item.id === target ? 'ring-2 ring-ocean' : ''}`}
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t(`guide.items.${item.id}.name`)}</h3>
                  <dl className="space-y-2 text-sm text-gray-700 dark:text-slate-300">
                    {['what', 'read', 'limits'].map((field) => (
                      <div key={field}>
                        <dt className="font-medium text-gray-900 dark:text-white">{t(`guide.${field}`)}</dt>
                        <dd>{t(`guide.items.${item.id}.${field}`)}</dd>
                      </div>
                    ))}
                    <div>
                      <dt className="font-medium text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
                        {t('guide.chaoss')}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RELATION_STYLE[item.relation]}`}>
                          {t(`guide.relation.${item.relation}`)}
                        </span>
                      </dt>
                      <dd className="space-y-1">
                        {item.chaoss.length > 0 && (
                          <span className="flex flex-wrap gap-x-3">
                            {item.chaoss.map((key) => (
                              <a key={key} href={CHAOSS[key].url} target="_blank" rel="noopener noreferrer" className="text-ocean hover:underline">
                                {CHAOSS[key].name}
                              </a>
                            ))}
                          </span>
                        )}
                        {note && <span className="block">{note}</span>}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </section>
        ))}
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
