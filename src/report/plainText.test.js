import { describe, it, expect } from 'vitest';
import { plainText } from './plainText.js';

describe('plainText', () => {
  it('strips the emoji of the maturity badges, with their joiners and variation selectors', () => {
    expect(plainText('🧪 Testes')).toBe('Testes');
    expect(plainText('🛡️ Sem aprovação (100%)')).toBe('Sem aprovação (100%)');
    expect(plainText('✅ Nenhuma Branch Zumbi')).toBe('Nenhuma Branch Zumbi');
    expect(plainText('👨‍👩‍👧 grupo')).toBe('grupo');
  });

  it('signs the font lacks become ASCII', () => {
    expect(plainText('≥ 5 e ≤ 9 e ≠ 0 ≈ 1 → 2')).toBe('>= 5 e <= 9 e != 0 ~ 1 -> 2');
  });

  it('strips check marks and collapses the gap they leave', () => {
    expect(plainText('Testes ✓')).toBe('Testes');
    expect(plainText('a  ✗  b')).toBe('a b');
  });

  it('leaves accents, middle dots, dashes and comparison signs alone, and non-strings pass through', () => {
    expect(plainText('Ação · n = 5 — ok … × 3 •')).toBe('Ação · n = 5 — ok … × 3 •'); // these render in the font
    expect(plainText(['Domingo', 'Segunda'])).toEqual(['Domingo', 'Segunda']);
    expect(plainText(undefined)).toBeUndefined();
  });
});
