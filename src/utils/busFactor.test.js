import { describe, it, expect } from 'vitest';
import { calculateBusFactor } from './busFactor.js';

const dev = (login, contributions) => ({ login, avatar_url: `https://avatars/${login}`, contributions });

describe('calculateBusFactor (Pareto threshold)', () => {
  it.each([[null], [undefined], [[]]])('is critical with no contributors (%j)', (input) => {
    expect(calculateBusFactor(input)).toEqual({ busFactor: 0, riskLevel: 'critical', keyDevelopers: [] });
  });

  it('is critical when nobody has contributions', () => {
    expect(calculateBusFactor([dev('a', 0), dev('b', 0)])).toEqual({ busFactor: 0, riskLevel: 'critical', keyDevelopers: [] });
  });

  it('counts developers until the accumulated share reaches 70%', () => {
    // 40 + 30 = 70% → reaches the threshold exactly at the 2nd developer
    const result = calculateBusFactor([dev('c', 20), dev('a', 40), dev('d', 10), dev('b', 30)]);
    expect(result.busFactor).toBe(2);
    expect(result.keyDevelopers.map((d) => d.login)).toEqual(['a', 'b']);
    expect(result.keyDevelopers[0]).toEqual({ login: 'a', avatar_url: 'https://avatars/a', percentage: 40 });
  });

  it('does not mutate the input array order', () => {
    const input = [dev('small', 1), dev('big', 99)];
    calculateBusFactor(input);
    expect(input.map((d) => d.login)).toEqual(['small', 'big']);
  });

  it('rounds percentages to one decimal place', () => {
    const result = calculateBusFactor([dev('a', 1), dev('b', 1), dev('c', 1)]);
    expect(result.keyDevelopers[0].percentage).toBe(33.3);
  });

  it('honours a custom threshold', () => {
    const team = [dev('a', 50), dev('b', 30), dev('c', 20)];
    expect(calculateBusFactor(team, 0.5).busFactor).toBe(1);
    expect(calculateBusFactor(team, 0.9).busFactor).toBe(3);
  });

  it.each([
    // contributions per developer → how many reach 70% → risk level
    [[80, 20], 1, 'critical'],
    [[40, 40, 20], 2, 'high'],
    [[30, 30, 30, 10], 3, 'moderate'],
    [[20, 20, 20, 20, 20], 4, 'moderate'],
    [[15, 15, 15, 15, 15, 15, 10], 5, 'healthy'],
  ])('%j → busFactor %i, riskLevel %s', (contributions, busFactor, riskLevel) => {
    const team = contributions.map((c, i) => dev(`d${i}`, c));
    expect(calculateBusFactor(team)).toMatchObject({ busFactor, riskLevel });
  });
});
