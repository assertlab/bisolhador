import { useTranslation } from "react-i18next";

const TIME_RANGES = ["7d", "30d", "60d", "90d", "all"];

export function TimeRangeFilter({
  currentRange,
  onRangeChange,
  i18nPrefix,
  disabled = false,
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 dark:text-slate-400 font-medium">
        {t(`${i18nPrefix}.filters.label`)}
      </span>
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 p-1">
        {TIME_RANGES.map((range) => (
          <button
            key={range}
            onClick={() => onRangeChange(range)}
            disabled={disabled}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              currentRange === range
                ? "bg-white dark:bg-slate-800 text-shark dark:text-white shadow-sm"
                : "text-gray-600 dark:text-slate-400 hover:text-shark dark:hover:text-white"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {t(`${i18nPrefix}.filters.${range}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
