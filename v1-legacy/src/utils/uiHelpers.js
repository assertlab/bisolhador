export function createTooltip(text) {
  return `
    <div class="relative inline-block group ml-2">
      <svg class="w-5 h-5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 01 18 0z"></path>
      </svg>
        <div class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-200 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-[9999] whitespace-normal">
        ${text}
      </div>
      <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900 group-hover:visible group-hover:opacity-100 transition-opacity duration-200"></div>
    </div>
  `;
}

export function createCard(title, contentHtml, tooltipText = null) {
  const tooltipHtml = tooltipText ? createTooltip(tooltipText) : '';
  return `
    <div class="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 relative overflow-visible hover:z-50">
      <h3 class="mb-2 text-xl font-bold tracking-tight text-gray-900 flex items-center">
        ${title}${tooltipHtml}
      </h3>
      ${contentHtml}
    </div>
  `;
}
