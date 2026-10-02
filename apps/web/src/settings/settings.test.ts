import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../progress/storage.ts';
import { SETTINGS_KEY, loadSettings, parseSettings, saveSettings, type Settings } from './settings.ts';

const defaults: Settings = { sound: true, music: false, reducedMotion: false };

describe('settings', () => {
  it('falls back to defaults for missing or corrupted data', () => {
    expect(parseSettings(null, defaults)).toEqual(defaults);
    expect(parseSettings('{not json', defaults)).toEqual(defaults);
    expect(parseSettings('42', defaults)).toEqual(defaults);
  });

  it('keeps valid booleans and ignores invalid fields', () => {
    expect(parseSettings('{"sound":false,"reducedMotion":"yes"}', defaults)).toEqual({
      sound: false,
      music: false,
      reducedMotion: false,
    });
  });

  it('round-trips through storage', () => {
    const storage = createMemoryStorage();
    const value: Settings = { sound: false, music: false, reducedMotion: true };
    expect(saveSettings(storage, value)).toBe(true);
    expect(storage.getItem(SETTINGS_KEY)).not.toBeNull();
    expect(loadSettings(storage)).toEqual(value);
  });

  it('never throws when storage fails', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    expect(() => loadSettings(broken)).not.toThrow();
    expect(saveSettings(broken, defaults)).toBe(false);
  });
});
