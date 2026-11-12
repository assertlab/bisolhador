import { usePlatformTranslation, PlatformTrans } from '../lib/platformText.js';
import { GITLAB_HOSTS, gitlabTokenPage } from '../utils/repoRef.js';

const TEXT = 'text-sm text-gray-600 dark:text-slate-400';
const TITLE = 'font-medium text-gray-900 dark:text-white mb-2';
const LINK = 'text-ocean hover:underline';

// The GitLab instances this build accepts (VITE_GITLAB_HOSTS): the institutional one, when there is
// one, is the address example people from that institution will recognize.
const GITLAB_EXAMPLE_HOST = GITLAB_HOSTS.find((host) => host !== 'gitlab.com') ?? 'gitlab.com';
const HOSTS_TEXT = GITLAB_HOSTS.join(', ');

export function HelpModal({ isOpen, onClose }) {
  const { t } = usePlatformTranslation();

  if (!isOpen) return null;

  const example = `${GITLAB_EXAMPLE_HOST}/${t('help.examplePath')}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('help.title')}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <h3 className={TITLE}>{t('help.about.title')}</h3>
            <p className={TEXT}>{t('help.about.description', { hosts: HOSTS_TEXT })}</p>
          </div>

          <div>
            <h3 className={TITLE}>{t('help.usage.title')}</h3>
            <p className={TEXT}>{t('help.usage.intro')}</p>
            <ul className={`${TEXT} mt-1 space-y-1 list-disc list-inside`}>
              {t('help.usage.addresses', { returnObjects: true, example }).map((line) => <li key={line}>{line}</li>)}
            </ul>
            <p className={`${TEXT} mt-1`}>{t('help.usage.outro')}</p>
          </div>

          <div>
            <h3 className={TITLE}>{t('help.gitlab.title')}</h3>
            <p className={TEXT}>{t('help.gitlab.text')}</p>
          </div>

          <div>
            <h3 className={TITLE}>{t('help.classroom.title')}</h3>
            <p className={TEXT}>{t('help.classroom.text', { example })}</p>
          </div>

          <div>
            <h3 className={TITLE}>{t('help.token.title')}</h3>
            <p className={`${TEXT} mb-3`}>{t('help.token.description')}</p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{t('help.token.warning.important')}</strong> {t('help.token.warning.message')}
              </p>
            </div>
          </div>

          <div>
            <h3 className={TITLE}>{t('help.createToken.title')}</h3>
            <ol className={`${TEXT} space-y-1 list-decimal list-inside`}>
              {t('help.createToken.steps', { returnObjects: true }).map((step, index) => (
                <li key={index}>
                  <PlatformTrans
                    i18nKey={`help.createToken.steps.${index}`}
                    components={{ link: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className={LINK} /> }}
                  />
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className={TITLE}>{t('help.createGitlabToken.title')}</h3>
            <ol className={`${TEXT} space-y-1 list-decimal list-inside`}>
              {t('help.createGitlabToken.steps', { returnObjects: true }).map((step) => <li key={step}>{step}</li>)}
            </ol>
            {/* One token page per instance this build accepts: a token only works on its own instance */}
            <p className={`${TEXT} mt-2`}>{t('help.createGitlabToken.pages')}</p>
            <ul className={`${TEXT} space-y-1 list-disc list-inside`}>
              {GITLAB_HOSTS.map((host) => (
                <li key={host}>
                  <a href={`https://${gitlabTokenPage(host)}`} target="_blank" rel="noopener noreferrer" className={LINK}>
                    {gitlabTokenPage(host)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-ocean border border-transparent rounded-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean"
          >
            {t('help.button.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
