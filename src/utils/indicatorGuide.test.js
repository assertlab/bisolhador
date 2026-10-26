import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDE_SECTIONS, GUIDE_IDS, CHAOSS, guidePath } from './indicatorGuide.js';
import pt from '../locales/pt.json';
import en from '../locales/en.json';

const FIELDS = ['name', 'what', 'read', 'limits', 'chaossNote'];

describe('indicator guide integrity', () => {
  it('ids are unique and valid anchors', () => {
    expect(new Set(GUIDE_IDS).size).toBe(GUIDE_IDS.length);
    for (const id of GUIDE_IDS) expect(id).toMatch(/^[a-z][a-z-]*$/);
  });

  it.each([['pt', pt], ['en', en]])('every entry and section has %s texts', (_, locale) => {
    for (const section of GUIDE_SECTIONS) {
      expect(locale.guide.sections[section.id]).toBeTruthy();
      for (const item of section.items) {
        for (const f of FIELDS) expect(typeof locale.guide.items[item.id]?.[f], `${item.id}.${f}`).toBe('string');
        expect(locale.guide.items[item.id].name).not.toBe('');
      }
    }
  });

  it('CHAOSS refs exist, point to the official knowledge base, and "related" entries explain the difference', () => {
    for (const section of GUIDE_SECTIONS) {
      for (const item of section.items) {
        expect(['equivalent', 'related', 'none']).toContain(item.relation);
        for (const key of item.chaoss) expect(CHAOSS[key]?.url).toMatch(/^https:\/\/www\.chaoss\.community\/kb\/[a-z0-9-]+\/$/);
        if (item.relation !== 'equivalent') {
          expect(pt.guide.items[item.id].chaossNote, item.id).not.toBe('');
          expect(en.guide.items[item.id].chaossNote, item.id).not.toBe('');
        }
      }
    }
  });

  it('every guideId / GuideLink id used in components exists', () => {
    const files = [];
    const walk = (dir) => readdirSync(dir).forEach((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.jsx')) files.push(p);
    });
    walk(fileURLToPath(new URL('..', import.meta.url)));
    const used = files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/(?:guideId|GuideLink id)="([^"]+)"/g)].map((m) => m[1]));
    expect(used.length).toBeGreaterThan(10);
    // AI in the Process links land before their guide entries (feature task 7).
    // Fails once the entries exist, so this exemption gets removed with them.
    const pendingAi = ['ai-tools', 'ai-config-depth', 'ai-commits', 'ai-prs', 'ai-review', 'ai-safeguards', 'ai-coherence', 'ai-badge'];
    for (const id of pendingAi) expect(GUIDE_IDS, `${id} exists: drop it from pendingAi`).not.toContain(id);
    for (const id of used.filter((x) => !pendingAi.includes(x))) expect(GUIDE_IDS, id).toContain(id);
    expect(guidePath('lead-time')).toBe('/guia#lead-time');
  });
});
