/**
 * «Комбинации» — every match reward (GAME_SPEC §3), BESH and all special pairs (§4),
 * illustrated with the shared tile art. The small 11×11 schemes are static
 * illustrations of the documented effect areas, not game logic.
 */
import type { FoodType, SpecialKind } from '@dastakhan/game-core';
import { Fragment, type ReactNode } from 'react';
import { t } from '../i18n/index.ts';
import { CrumbsSwatch, TileSwatch } from './GoalIcon.tsx';
import './guide.css';

type SchemeKind =
  | 'row'
  | 'col'
  | 'square3'
  | 'ramColor'
  | 'cross'
  | 'wideCross'
  | 'square5'
  | 'ramLine'
  | 'ramBomb'
  | 'bigToi'
  | 'besh';

const C = 5; // scheme center (row/col) on the 11×11 board

/** Illustrative pseudo-random "same food" cells for RAM schemes (fixed pattern). */
function isTarget(r: number, c: number): boolean {
  return (r * 4 + c * 7) % 9 === 0 && !(r === C && c === C);
}

/** Illustrative cells of the three most frequent dishes for the BESH scheme (fixed pattern). */
function isBeshTarget(r: number, c: number): boolean {
  return ((r * 4 + c * 7) % 9) % 3 === 0;
}

/** 0 = untouched, 1 = affected, 2 = source / converted piece. */
function schemeLevel(kind: SchemeKind, r: number, c: number): 0 | 1 | 2 {
  const center = r === C && c === C;
  const dr = Math.abs(r - C);
  const dc = Math.abs(c - C);
  switch (kind) {
    case 'row':
      return center ? 2 : r === C ? 1 : 0;
    case 'col':
      return center ? 2 : c === C ? 1 : 0;
    case 'square3':
      return center ? 2 : dr <= 1 && dc <= 1 ? 1 : 0;
    case 'cross':
      return center ? 2 : r === C || c === C ? 1 : 0;
    case 'wideCross':
      return center ? 2 : dr <= 1 || dc <= 1 ? 1 : 0;
    case 'square5':
      return center ? 2 : dr <= 2 && dc <= 2 ? 1 : 0;
    case 'ramColor':
      return center || isTarget(r, c) ? 2 : 0;
    case 'ramLine': {
      if (center || isTarget(r, c)) return 2;
      for (let cc = 0; cc < 11; cc++) if (isTarget(r, cc)) return 1;
      return 0;
    }
    case 'ramBomb': {
      if (center || isTarget(r, c)) return 2;
      for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) if (isTarget(rr, cc)) return 1;
      return 0;
    }
    case 'bigToi':
      return center ? 2 : 1;
    case 'besh':
      return center ? 2 : (dr <= 2 && dc <= 2) || isBeshTarget(r, c) ? 1 : 0;
  }
}

function EffectScheme({ kind }: { kind: SchemeKind }) {
  const cells: ReactNode[] = [];
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      const level = schemeLevel(kind, r, c);
      cells.push(
        <rect
          key={r * 11 + c}
          x={c + 0.08}
          y={r + 0.08}
          width={0.84}
          height={0.84}
          rx={0.2}
          className={`guide-scheme__cell guide-scheme__cell--${level}`}
        />,
      );
    }
  }
  return (
    <svg className="guide-scheme" viewBox="-0.3 -0.3 11.6 11.6" role="img" aria-label={t('guide.effectAria')}>
      <rect x={-0.3} y={-0.3} width={11.6} height={11.6} rx={0.8} className="guide-scheme__bg" />
      {cells}
    </svg>
  );
}

type Piece = [FoodType | null, SpecialKind | null];

function TileRow({ pieces, size = 32, vertical }: { pieces: Piece[]; size?: number; vertical?: boolean }) {
  return (
    <span className={vertical ? 'guide-tiles guide-tiles--vertical' : 'guide-tiles'}>
      {pieces.map(([base, special], i) => (
        <TileSwatch key={i} base={base} special={special} size={size} decorative />
      ))}
    </span>
  );
}

const L_SHAPE = [
  [1, 0, 0],
  [1, 0, 0],
  [1, 1, 1],
];

/** A run of 5 crossed by a perpendicular run of 4 (T shape) → BESH. */
const BESH_SHAPE = [
  [1, 1, 1, 1, 1],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
];

/** Pieces of one food arranged on a small grid (1 = piece, 0 = empty). */
function Shape({ base, cells, size = 26 }: { base: FoodType; cells: number[][]; size?: number }) {
  return (
    <span className="guide-lshape" style={{ gridTemplateColumns: `repeat(${cells[0].length}, ${size}px)` }}>
      {cells.flat().map((on, i) =>
        on ? <TileSwatch key={i} base={base} special={null} size={size} decorative /> : <span key={i} style={{ width: size, height: size }} />,
      )}
    </span>
  );
}

function Arrow() {
  return (
    <svg className="guide-arrow" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Plus() {
  return (
    <span className="guide-plus" aria-hidden="true">
      +
    </span>
  );
}

interface CardProps {
  title?: string;
  text: string;
  visual?: ReactNode;
  scheme?: SchemeKind;
  headingLevel: number;
  tone?: 'default' | 'gold';
}

function Heading({ level, className, children }: { level: number; className: string; children: ReactNode }) {
  const Tag = `h${Math.min(6, Math.max(2, level))}` as 'h2';
  return <Tag className={className}>{children}</Tag>;
}

function Card({ title, text, visual, scheme, headingLevel, tone = 'default' }: CardProps) {
  return (
    <li className={tone === 'gold' ? 'guide-card guide-card--gold' : 'guide-card'}>
      {visual && (
        <div className="guide-card__visual" aria-hidden="true">
          {visual}
        </div>
      )}
      <div className="guide-card__body">
        <div className="guide-card__text">
          {title && (
            <Heading level={headingLevel} className="guide-card__title">
              {title}
            </Heading>
          )}
          <p>{text}</p>
        </div>
        {scheme && <EffectScheme kind={scheme} />}
      </div>
    </li>
  );
}

export interface GuideContentProps {
  /** Heading level for section titles (cards use the next level). Default 2. */
  headingLevel?: 2 | 3;
}

export function GuideContent({ headingLevel = 2 }: GuideContentProps) {
  const h = headingLevel;
  const sections: { title: string; intro?: string; cards: Omit<CardProps, 'headingLevel'>[] }[] = [
    {
      title: t('guide.matchesTitle'),
      intro: t('guide.intro'),
      cards: [
        {
          title: t('guide.match3.title'),
          text: t('guide.match3'),
          visual: <TileRow pieces={[['baursak', null], ['baursak', null], ['baursak', null]]} />,
        },
        {
          title: t('guide.match4h.title'),
          text: t('guide.match4h'),
          scheme: 'row',
          visual: (
            <>
              <TileRow pieces={[['kurt', null], ['kurt', null], ['kurt', null], ['kurt', null]]} />
              <Arrow />
              <TileRow pieces={[['kurt', 'LINE_H']]} size={40} />
            </>
          ),
        },
        {
          title: t('guide.match4v.title'),
          text: t('guide.match4v'),
          scheme: 'col',
          visual: (
            <>
              <TileRow vertical size={24} pieces={[['kazy', null], ['kazy', null], ['kazy', null], ['kazy', null]]} />
              <Arrow />
              <TileRow pieces={[['kazy', 'LINE_V']]} size={40} />
            </>
          ),
        },
        {
          title: t('guide.matchLT.title'),
          text: t('guide.matchLT'),
          scheme: 'square3',
          visual: (
            <>
              <Shape base="samsa" cells={L_SHAPE} />
              <Arrow />
              <TileRow pieces={[['samsa', 'BOMB']]} size={40} />
            </>
          ),
        },
        {
          title: t('guide.match5.title'),
          text: t('guide.match5'),
          tone: 'gold',
          visual: (
            <>
              <TileRow size={28} pieces={[['tea', null], ['tea', null], ['tea', null], ['tea', null], ['tea', null]]} />
              <Arrow />
              <TileRow pieces={[[null, 'RAM']]} size={40} />
            </>
          ),
        },
        {
          title: t('guide.matchBesh.title'),
          text: t('guide.matchBesh'),
          tone: 'gold',
          visual: (
            <>
              <Shape base="plov" cells={BESH_SHAPE} size={20} />
              <Arrow />
              <TileRow pieces={[[null, 'BESH']]} size={40} />
            </>
          ),
        },
        { text: t('guide.notMatches') },
        { text: t('guide.priority') },
        { text: t('guide.specialsKeep') },
        { text: t('guide.newSpecial') },
      ],
    },
    {
      title: t('guide.activationTitle'),
      intro: t('guide.activation'),
      cards: [
        {
          title: t('guide.ramFood.title'),
          text: t('guide.ramFood'),
          scheme: 'ramColor',
          visual: (
            <>
              <TileRow pieces={[[null, 'RAM']]} size={40} />
              <Plus />
              <TileRow pieces={[['zhent', null]]} size={40} />
            </>
          ),
        },
        { title: t('guide.ramHit.title'), text: t('guide.ramHit') },
        {
          title: t('guide.besh.title'),
          text: t('guide.besh'),
          scheme: 'besh',
          tone: 'gold',
          visual: (
            <>
              <TileRow pieces={[[null, 'BESH']]} size={40} />
              <Plus />
              <TileRow pieces={[['manty', null]]} size={40} />
            </>
          ),
        },
        { text: t('guide.beshPartner') },
      ],
    },
    {
      title: t('guide.pairsTitle'),
      intro: t('guide.pairsIntro'),
      cards: [
        pair('lineLine', 'cross', ['baursak', 'LINE_H'], ['kurt', 'LINE_V']),
        pair('lineBomb', 'wideCross', ['samsa', 'LINE_H'], ['tea', 'BOMB']),
        pair('bombBomb', 'square5', ['kazy', 'BOMB'], ['baursak', 'BOMB']),
        pair('ramLine', 'ramLine', [null, 'RAM'], ['kurt', 'LINE_H']),
        pair('ramBomb', 'ramBomb', [null, 'RAM'], ['samsa', 'BOMB']),
        { ...pair('ramRam', 'bigToi', [null, 'RAM'], [null, 'RAM']), tone: 'gold' },
        { ...pair('beshRam', 'bigToi', [null, 'BESH'], [null, 'RAM']), tone: 'gold' },
        { text: t('guide.edges') },
      ],
    },
    {
      title: t('guide.crumbsTitle'),
      cards: [
        {
          text: t('guide.crumbs'),
          visual: (
            <>
              <CrumbsSwatch size={40} hp={1} />
              <CrumbsSwatch size={40} hp={2} />
            </>
          ),
        },
      ],
    },
    {
      title: t('guide.scoringTitle'),
      cards: [{ text: t('guide.scoring') }, { text: t('guide.stars') }, { text: t('guide.shuffle') }],
    },
  ];

  return (
    <div className="guide on-light">
      {sections.map((section) => (
        <section key={section.title} className="guide-section">
          <Heading level={h} className="guide-section__title">
            {section.title}
          </Heading>
          {section.intro && <p className="guide-section__intro">{section.intro}</p>}
          <ul className="guide-cards">
            {section.cards.map((card, i) => (
              <Fragment key={i}>
                <Card {...card} headingLevel={h + 1} />
              </Fragment>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function pair(
  key: 'lineLine' | 'lineBomb' | 'bombBomb' | 'ramLine' | 'ramBomb' | 'ramRam' | 'beshRam',
  scheme: SchemeKind,
  a: Piece,
  b: Piece,
): Omit<CardProps, 'headingLevel'> {
  return {
    title: t(`guide.pair.${key}.title`),
    text: t(`guide.pair.${key}`),
    scheme,
    visual: (
      <>
        <TileRow pieces={[a]} size={40} />
        <Plus />
        <TileRow pieces={[b]} size={40} />
      </>
    ),
  };
}
