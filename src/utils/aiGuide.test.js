import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AI_TOOLS } from './aiRegistry.js';
import { GUIDE_IDS, AI_GUIDE_PATH } from './indicatorGuide.js';
import {
  AI_GUIDE_BLOCKS, DECLARATION_TOOLS, AI_GUIDE_FAQ, AI_GUIDE_LIMITS, AI_GUIDE_NUMBERS, detectionRows,
} from './aiGuide.js';
import pt from '../locales/pt.json';
import en from '../locales/en.json';

// Every leaf key path of an object ("a.b.c").
const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
  v && typeof v === 'object' ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
));
const at = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const placeholders = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('AI guide (/guia/ia)', () => {
  it('the detection table is generated from every registry entry, in order', () => {
    expect(detectionRows().map((r) => r.id)).toEqual(AI_TOOLS.map((tool) => tool.id));
    for (const row of detectionRows()) {
      const tool = AI_TOOLS.find((x) => x.id === row.id);
      expect(row.config).toHaveLength(tool.config.length);
      expect(row.coauthors).toHaveLength(tool.coauthors.length);
      expect(row.agentLogins).toBe(tool.agentLogins);
      expect(row.reviewerLogins).toBe(tool.reviewerLogins);
    }
  });

  it('every tool in "how to declare" exists in the registry and declares a co-author e-mail', () => {
    const ids = DECLARATION_TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tool of DECLARATION_TOOLS) {
      const entry = AI_TOOLS.find((x) => x.id === tool.id);
      expect(entry, tool.id).toBeTruthy();
      expect(entry.coauthors.length, tool.id).toBeGreaterThan(0);
      expect(['verified', 'emailOnly']).toContain(tool.mode);
    }
  });

  it('verified tools have instructions in both languages, a check date and https sources; e-mail-only tools have none', () => {
    for (const tool of DECLARATION_TOOLS) {
      for (const locale of [pt, en]) {
        const text = locale.aiGuide.declare.tools[tool.id];
        if (tool.mode === 'verified') expect(typeof text, tool.id).toBe('string');
        else expect(text, tool.id).toBeUndefined();
      }
      if (tool.mode === 'verified') {
        expect(tool.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(tool.sources.length).toBeGreaterThan(0);
        for (const url of tool.sources) expect(url).toMatch(/^https:\/\//);
      }
    }
  });

  it('pt and en have the same keys and the same placeholders in the aiGuide namespace', () => {
    const ptKeys = keyPaths(pt.aiGuide).sort();
    expect(keyPaths(en.aiGuide).sort()).toEqual(ptKeys);
    for (const path of ptKeys) {
      expect(at(pt.aiGuide, path), path).not.toBe('');
      expect(placeholders(at(en.aiGuide, path)), path).toEqual(placeholders(at(pt.aiGuide, path)));
    }
  });

  it('blocks, FAQ and limits have texts; limits link to existing /guia entries; placeholders are known numbers', () => {
    for (const id of AI_GUIDE_BLOCKS) expect(pt.aiGuide.blocks[id], id).toBeTruthy();
    expect(AI_GUIDE_FAQ.length).toBeGreaterThanOrEqual(8);
    expect(AI_GUIDE_FAQ.length).toBeLessThanOrEqual(12);
    expect(Object.keys(pt.aiGuide.faq.items).sort()).toEqual([...AI_GUIDE_FAQ].sort());
    expect(Object.keys(pt.aiGuide.limits.items).sort()).toEqual(AI_GUIDE_LIMITS.map((l) => l.id).sort());
    for (const limit of AI_GUIDE_LIMITS) expect(GUIDE_IDS, limit.id).toContain(limit.guide);
    const texts = [
      ...AI_GUIDE_FAQ.map((id) => pt.aiGuide.faq.items[id].a),
      ...AI_GUIDE_LIMITS.map((l) => pt.aiGuide.limits.items[l.id]),
    ];
    for (const text of texts) for (const name of placeholders(text)) expect(AI_GUIDE_NUMBERS, name).toHaveProperty(name);
  });

  it('the page is a lazy route at AI_GUIDE_PATH', () => {
    const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
    expect(app).toMatch(/const AiGuide = lazy\(\(\) => import\('\.\/pages\/AiGuide\.jsx'\)/);
    expect(app).toContain(`path="${AI_GUIDE_PATH}"`);
  });
});
