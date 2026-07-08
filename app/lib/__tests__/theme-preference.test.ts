import { isThemePreference, toAppearanceScheme } from '../theme-preference';

describe('toAppearanceScheme', () => {
  it('maps system to null (clears the override, follows the device)', () => {
    expect(toAppearanceScheme('system')).toBeNull();
  });

  it('maps explicit choices straight through', () => {
    expect(toAppearanceScheme('light')).toBe('light');
    expect(toAppearanceScheme('dark')).toBe('dark');
  });
});

describe('isThemePreference', () => {
  it('accepts the three valid values', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
  });

  it('rejects junk from storage (null, unknown strings)', () => {
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference('')).toBe(false);
  });
});
