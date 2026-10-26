import { AI_TOOLS } from '../../utils/aiRegistry.js';

const TOOL_LABELS = Object.fromEntries(AI_TOOLS.map((tool) => [tool.id, tool.label]));

/** Display name of a registry tool id ('generic' is translated). */
export const toolLabel = (id, t) => (id === 'generic' ? t('aiProcess.genericTool') : TOOL_LABELS[id] ?? id);
