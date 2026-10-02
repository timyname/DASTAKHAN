import { tutorials } from '@dastakhan/content';
import { FOOD_TYPES, type SpecialKind } from '@dastakhan/game-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasKey, t } from './index.ts';
import { kk } from './kk.ts';
import { goalProgressLabel, tileLabel } from './labels.ts';
import { ru } from './ru.ts';

describe('t()', () => {
  afterEach(() => vi.restoreAllMocks());

  it('interpolates named parameters and keeps unknown placeholders', () => {
    expect(t('levels.level', { n: 4 })).toBe('Уровень 4');
    expect(t('goal.remaining', { label: 'Курт' })).toBe('Курт: осталось {n}');
  });

  it('returns the key for a missing entry and warns in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('no.such.key')).toBe('no.such.key');
    if (import.meta.env.DEV) expect(warn).toHaveBeenCalledOnce();
  });
});

describe('Russian dictionary', () => {
  it('has the authentic food labels', () => {
    expect(FOOD_TYPES.map((f) => t(`food.${f}`))).toEqual([
      'Баурсак',
      'Курт',
      'Казы',
      'Самса',
      'Жент',
      'Чай',
      'Манты',
      'Шелпек',
      'Чак-чак',
      'Плов',
      'Лагман',
    ]);
  });

  it('names every special and the crumbs obstacle', () => {
    const specials: SpecialKind[] = ['LINE_H', 'LINE_V', 'BOMB', 'RAM', 'BESH'];
    for (const s of specials) expect(hasKey(`special.${s}`)).toBe(true);
    expect(t('special.LINE_H')).toBe('Учпучмак');
    expect(t('special.LINE_V')).toBe('Кумыс');
    expect(t('special.BESH')).toBe('Бешбармак');
    expect(t('effect.besh')).toBe('Дастархан для всех');
    expect(t('special.BOMB')).toBe('Казан');
    expect(t('special.RAM')).toBe('Золотой барашек');
    expect(t('obstacle.crumbs')).toBe('Крошки на скатерти');
  });

  it('has tutorial texts for all five fixed tutorials', () => {
    const steps: Record<string, number> = { line: 2, bomb: 2, ram: 2, ramRam: 1, besh: 2 };
    for (const [slug, count] of Object.entries(steps)) {
      expect(hasKey(`tutorial.${slug}.title`)).toBe(true);
      expect(hasKey(`tutorial.${slug}.done`)).toBe(true);
      for (let i = 1; i <= count; i++) expect(hasKey(`tutorial.${slug}.step${i}`)).toBe(true);
    }
    expect(t('tutorial.ramRam.title')).toBe('Большой той');
  });

  it('covers every key referenced by the tutorial content', () => {
    for (const tutorial of tutorials) {
      expect(hasKey(tutorial.titleKey), tutorial.titleKey).toBe(true);
      expect(hasKey(tutorial.doneTextKey), tutorial.doneTextKey).toBe(true);
      for (const step of tutorial.steps) expect(hasKey(step.textKey), step.textKey).toBe(true);
    }
  });

  it('documents every special pair and BESH in the guide', () => {
    for (const pair of ['lineLine', 'lineBomb', 'bombBomb', 'ramLine', 'ramBomb', 'ramRam', 'beshRam']) {
      expect(hasKey(`guide.pair.${pair}`)).toBe(true);
      expect(hasKey(`guide.pair.${pair}.title`)).toBe(true);
    }
    expect(t('guide.pair.lineLine')).toContain('21');
    expect(t('guide.pair.lineBomb')).toContain('57');
    expect(t('guide.pair.bombBomb')).toContain('5×5');
    expect(t('guide.besh')).toContain('трёх самых частых');
    expect(t('guide.besh')).toContain('5×5');
    expect(t('guide.matchBesh')).toContain('5');
  });

  it('has no empty strings, and the Kazakh dictionary only overrides known keys', () => {
    for (const [key, value] of Object.entries(ru)) expect(value.trim(), key).not.toBe('');
    for (const key of Object.keys(kk)) expect(hasKey(key), key).toBe(true);
  });
});

describe('labels', () => {
  it('labels special pieces with their food', () => {
    expect(tileLabel('samsa', 'BOMB')).toBe('Казан (Самса)');
    expect(tileLabel(null, 'RAM')).toBe('Золотой барашек');
    expect(tileLabel(null, 'BESH')).toBe('Бешбармак');
    expect(tileLabel('kurt', 'LINE_V')).toBe('Кумыс (Курт)');
    expect(tileLabel('tea', null)).toBe('Чай');
  });

  it('describes goal progress', () => {
    expect(goalProgressLabel({ kind: 'collect', type: 'kurt', count: 20, done: 5 })).toBe('Курт: осталось 15');
    expect(goalProgressLabel({ kind: 'clearCrumbs', count: 9, done: 9 })).toBe('Крошки на скатерти: выполнено');
  });
});
