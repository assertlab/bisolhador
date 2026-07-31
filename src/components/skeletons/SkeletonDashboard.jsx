import { SkeletonChart } from './SkeletonChart.jsx';

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* 1. Card Principal - RepoInfoCard */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-3/4"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 dark:border-slate-700 pt-6">
          <div>
            <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mb-3 w-32"></div>
            <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-24"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-20 mt-1"></div>
          </div>
          <div>
            <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mb-3 w-40"></div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-24"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-16"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-20"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-12"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-28"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-14"></div>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-32"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-10"></div>
              </div>
              <div className="flex justify-between font-semibold">
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-24"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-18"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Grid de Métricas de Volume - 5 StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded shadow border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow relative hover:z-50">
            <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-slate-600 rounded animate-pulse"></div>
          </div>
        ))}
      </div>

      {/* 3. Grid de Dinâmica de Revisão - Título + 2 StatCards */}
      <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-48"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded shadow border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow relative hover:z-50">
            <div className="flex items-center mb-2">
              <div className="w-5 h-5 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mr-2"></div>
              <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-24"></div>
            </div>
            <div className="h-8 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-32"></div>
          </div>
        ))}
      </div>

      {/* 4. Governança e Maturidade - Título + Grid 2 cards grandes */}
      <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-56"></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded shadow border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow relative hover:z-50">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-32"></div>
            <div className="h-8 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-16"></div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-32"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-6"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded shadow border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow relative hover:z-50">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-40"></div>
            <div className="h-8 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-12"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse mx-auto mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Área de Gráficos - Grid 2 charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* 6. Padrões de Trabalho - WeekDaysChart */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
        <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mb-4 w-48"></div>
        <div className="h-64 bg-gray-100 dark:bg-slate-700 rounded animate-pulse"></div>
      </div>

      {/* 7. Contribuições - ContributorsTable */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-32"></div>
          <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-24"></div>
        </div>
        <div className="overflow-x-auto">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-slate-700 rounded">
                <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-32 mb-1"></div>
                  <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-24"></div>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-16"></div>
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 8. Atividades Recentes - ActivityLogs */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
        <div className="h-6 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mb-6 w-40"></div>
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gray-200 dark:bg-slate-600 rounded animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-3/4 mb-1"></div>
                <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-1/2"></div>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded animate-pulse w-16"></div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
