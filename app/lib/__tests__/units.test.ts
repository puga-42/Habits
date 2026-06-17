import { describeAmount, normalizeCountUnit, unitNoun } from '../units';

describe('unitNoun', () => {
  it('reads the generic count as time/times', () => {
    expect(unitNoun('count', 1)).toBe('time');
    expect(unitNoun('count', 3)).toBe('times');
  });

  it('singularizes a named unit at 1, pluralizes otherwise', () => {
    expect(unitNoun('miles', 1)).toBe('mile');
    expect(unitNoun('miles', 5)).toBe('miles');
    expect(unitNoun('steps', 1)).toBe('step');
    expect(unitNoun('kilometers', 2)).toBe('kilometers');
  });
});

describe('describeAmount', () => {
  it('joins the number and noun', () => {
    expect(describeAmount(5, 'kilometers')).toBe('5 kilometers');
    expect(describeAmount(1, 'reps')).toBe('1 rep');
    expect(describeAmount(3, 'count')).toBe('3 times');
  });
});

describe('normalizeCountUnit', () => {
  it('passes through known units', () => {
    expect(normalizeCountUnit('miles')).toBe('miles');
  });

  it('falls back to count for null/unknown/legacy values', () => {
    expect(normalizeCountUnit(null)).toBe('count');
    expect(normalizeCountUnit(undefined)).toBe('count');
    expect(normalizeCountUnit('furlongs')).toBe('count');
  });
});
