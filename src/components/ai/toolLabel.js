import { AI_TOOLS } from '../../utils/aiRegistry.js';

const TOOL_LABELS = Object.fromEntries(AI_TOOLS.map((tool) => [tool.id, tool.label]));

/** Display name of a registry tool id ('generic' is translated). */
export const toolLabel = (id, t) => {
  // A missing translator falls back to the registry label instead of crashing the render.
  if (id === 'generic' && typeof t === 'function') return t('aiProcess.genericTool');
  return TOOL_LABELS[id] ?? id;
};
