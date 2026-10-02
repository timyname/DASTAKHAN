/**
 * Dev-only technical art gallery (prompt 05): http://localhost:5173/gallery.html
 * Shows all 11 foods and every special family (LINE_H «Учпучмак», LINE_V «Кумыс» and
 * BOMB «Казан» for each base, RAM, BESH) at 32/48/96 CSS px on light and dark cells,
 * crumbs layers under food, forced fallbacks, confusable pairs, 11×11 sample boards,
 * sprite fill measurements and the background. Labels are English (developer tool).
 */
import { StrictMode, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { FOOD_TYPES, type FoodType, type SpecialKind } from '@dastakhan/game-core';
import { CrumbsArt, FoodIcon, TileArt } from '../art/TileArt.tsx';
import { ALL_ASSETS, ASSET_PROVENANCE, BACKGROUND_ART, SPRITE_ASSETS, preloadAssets, type ArtAsset } from '../art/manifest.ts';
import './gallery.css';

const SIZES = [32, 48, 96] as const;
const SURFACES = [
  { id: 'cream', name: 'light cream cell #FFF4DF', color: '#FFF4DF' },
  { id: 'teal', name: 'dark teal cell #1D5A52', color: '#1D5A52' },
] as const;

interface CellSpec {
  base: FoodType | null;
  special: SpecialKind | null;
  hp?: number;
  fallback?: boolean;
  title: string;
}

const foodsWith = (special: SpecialKind | null, hp?: number, fallback?: boolean): CellSpec[] =>
  FOOD_TYPES.map((base) => ({ base, special, hp, fallback, title: `${base}${special ? ` ${special}` : ''}${hp ? ` hp${hp}` : ''}` }));

const ROWS: { label: string; cells: CellSpec[] }[] = [
  { label: 'Food', cells: foodsWith(null) },
  { label: 'LINE_H «Учпучмак» (row)', cells: foodsWith('LINE_H') },
  { label: 'LINE_V «Кумыс» (column)', cells: foodsWith('LINE_V') },
  { label: 'BOMB «Казан»', cells: foodsWith('BOMB') },
  {
    label: 'RAM / BESH / crumbs alone',
    cells: [
      { base: null, special: 'RAM', title: 'RAM' },
      { base: null, special: 'BESH', title: 'BESH' },
      { base: null, special: null, hp: 1, title: 'crumbs hp1' },
      { base: null, special: null, hp: 2, title: 'crumbs hp2' },
      { base: null, special: 'RAM', hp: 2, title: 'RAM over hp2' },
      { base: null, special: 'BESH', hp: 1, title: 'BESH over hp1' },
      { base: 'kazy', special: 'BOMB', hp: 1, title: 'BOMB over hp1' },
      { base: 'lagman', special: 'LINE_H', hp: 1, title: 'LINE_H over hp1' },
      { base: 'tea', special: 'LINE_V', hp: 2, title: 'LINE_V over hp2' },
    ],
  },
  { label: 'Food over crumbs HP1', cells: foodsWith(null, 1) },
  { label: 'Food over crumbs HP2', cells: foodsWith(null, 2) },
  { label: 'Forced fallback', cells: foodsWith(null, undefined, true) },
  {
    label: 'Forced fallback specials',
    cells: [
      { base: 'samsa', special: 'LINE_H', fallback: true, title: 'samsa LINE_H fallback' },
      { base: 'kurt', special: 'LINE_V', fallback: true, title: 'kurt LINE_V fallback' },
      { base: 'baursak', special: 'BOMB', fallback: true, title: 'baursak BOMB fallback' },
      { base: null, special: 'RAM', fallback: true, title: 'RAM fallback' },
      { base: null, special: 'BESH', fallback: true, title: 'BESH fallback' },
    ],
  },
];

/** One board-like cell: crumbs layer under a tile inset by 4% (matches board.css). */
function Cell({ spec, size, color }: { spec: CellSpec; size: number; color: string }) {
  return (
    <div className="g-cell" style={{ width: size, height: size, background: color }} title={spec.title}>
      {spec.hp ? <CrumbsArt hp={spec.hp} /> : null}
      {(spec.base || spec.special) && (
        <div className="g-tile">
          <TileArt base={spec.base} special={spec.special} label={spec.title} forceFallback={spec.fallback} />
        </div>
      )}
    </div>
  );
}

function Matrix({ size }: { size: number }) {
  return (
    <section className="g-section">
      <h2>{size} CSS px cells</h2>
      <div className="g-surfaces">
        {SURFACES.map((s) => (
          <div key={s.id} className={`g-surface g-surface--${s.id}`}>
            <h3>{s.name}</h3>
            <table className="g-table">
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <div className="g-row" style={{ gap: Math.max(2, size / 12) }}>
                        {row.cells.map((c) => (
                          <Cell key={c.title} spec={c} size={size} color={s.color} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Deterministic 11×11 sample board (simple LCG; no engine involved). */
function sampleBoard(types: readonly FoodType[], seed: number): CellSpec[] {
  let s = seed;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: CellSpec[] = [];
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      const base = types[Math.floor(rnd() * types.length)]!;
      const roll = rnd();
      const special: SpecialKind | null =
        roll < 0.03
          ? 'LINE_H'
          : roll < 0.06
            ? 'LINE_V'
            : roll < 0.085
              ? 'BOMB'
              : roll < 0.095
                ? 'RAM'
                : roll < 0.105
                  ? 'BESH'
                  : null;
      const hp = r >= 3 && r <= 7 && c >= 3 && c <= 7 ? (r >= 4 && r <= 6 && c >= 4 && c <= 6 ? 2 : 1) : 0;
      const universal = special === 'RAM' || special === 'BESH';
      out.push({ base: universal ? null : base, special, hp, title: `r${r} c${c}` });
    }
  }
  return out;
}

const CLASSIC_SIX: readonly FoodType[] = ['baursak', 'kurt', 'kazy', 'samsa', 'zhent', 'tea'];
const NEW_SIX: readonly FoodType[] = ['manty', 'shelpek', 'chakchak', 'plov', 'lagman', 'tea'];
const RISKY_SIX: readonly FoodType[] = ['baursak', 'shelpek', 'kurt', 'chakchak', 'tea', 'lagman'];
const BOARDS = {
  classic: sampleBoard(CLASSIC_SIX, 12345),
  fresh: sampleBoard(NEW_SIX, 777),
  risky: sampleBoard(RISKY_SIX, 4242),
  all: sampleBoard(FOOD_TYPES, 99),
};

function SampleBoard({ pitch, dark, board }: { pitch: number; dark: boolean; board: CellSpec[] }) {
  return (
    <div className="g-board" style={{ width: pitch * 11, height: pitch * 11 }}>
      {board.map((spec, i) => {
        const r = Math.floor(i / 11);
        const c = i % 11;
        const color = dark ? ((r + c) % 2 ? '#1A524B' : '#1D5A52') : (r + c) % 2 ? '#F6E6C8' : '#FFF4DF';
        return <Cell key={i} spec={spec} size={pitch} color={color} />;
      })}
    </div>
  );
}

interface FillResult {
  w: number;
  h: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Measures the opaque bounding box of a 256×256 sprite (alpha > 8) via canvas. */
function measure(asset: ArtAsset): Promise<FillResult | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = asset.width;
      canvas.height = asset.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, asset.width, asset.height);
      const { data } = ctx.getImageData(0, 0, asset.width, asset.height);
      let x0 = asset.width;
      let y0 = asset.height;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < asset.height; y++) {
        for (let x = 0; x < asset.width; x++) {
          if (data[(y * asset.width + x) * 4 + 3]! > 8) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      resolve({ x0, y0, x1, y1, w: (x1 - x0 + 1) / asset.width, h: (y1 - y0 + 1) / asset.height });
    };
    img.onerror = () => resolve(null);
    img.src = asset.url;
  });
}

function FillCheck() {
  const [fills, setFills] = useState<Record<string, FillResult | null>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(SPRITE_ASSETS.map(async (a) => [a.id, await measure(a)] as const)).then((entries) => {
      if (alive) setFills(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section className="g-section">
      <h2>Sprite fill check (target: object fills 72–80% of 256 canvas)</h2>
      <p className="g-note">Dashed squares mark 72% and 80%. Bounding box measured from alpha &gt; 8 (includes soft shadows).</p>
      <div className="g-fill">
        {SPRITE_ASSETS.map((a) => {
          const r = fills[a.id];
          return (
            <figure key={a.id} className="g-fill__item" data-asset={a.id}>
              <div className="g-fill__canvas">
                <img src={a.url} alt="" width={128} height={128} />
                <span className="g-guide g-guide--72" />
                <span className="g-guide g-guide--80" />
                {r && (
                  <span
                    className="g-bbox"
                    style={{
                      left: `${(r.x0 / 256) * 100}%`,
                      top: `${(r.y0 / 256) * 100}%`,
                      width: `${r.w * 100}%`,
                      height: `${r.h * 100}%`,
                    }}
                  />
                )}
              </div>
              <figcaption>
                {a.id}
                <br />
                {r ? `w ${(r.w * 100).toFixed(0)}% × h ${(r.h * 100).toFixed(0)}%` : 'measuring…'}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

/** Side-by-side groups of foods that risk confusion (prompt: all 11 must stay distinct). */
const CONFUSABLE: { name: string; types: FoodType[] }[] = [
  { name: 'lagman vs tea', types: ['lagman', 'tea'] },
  { name: 'shelpek vs baursak', types: ['shelpek', 'baursak'] },
  { name: 'chakchak vs kurt', types: ['chakchak', 'kurt'] },
  { name: 'plov vs samsa vs zhent', types: ['plov', 'samsa', 'zhent'] },
  { name: 'manty vs kurt vs plov', types: ['manty', 'kurt', 'plov'] },
  { name: 'chakchak vs plov', types: ['chakchak', 'plov'] },
];

function Confusable() {
  return (
    <section className="g-section">
      <h2>Confusable pairs at 28 / 32 / 34 px</h2>
      <div className="g-pairs">
        {CONFUSABLE.map((g) =>
          SURFACES.map((s) => (
            <div key={`${g.name}-${s.id}`} className={`g-pair g-surface--${s.id}`}>
              <div className="g-pair__name">{g.name}</div>
              {[28, 32, 34].map((size) => (
                <div key={size} className="g-row" style={{ gap: 2 }}>
                  {g.types.map((t) => (
                    <Cell key={t} spec={{ base: t, special: null, title: t }} size={size} color={s.color} />
                  ))}
                </div>
              ))}
            </div>
          )),
        )}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="g-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Gallery() {
  const [preload, setPreload] = useState<string>('preloading…');
  useEffect(() => {
    void preloadAssets().then(({ failed }) =>
      setPreload(failed.length ? `FAILED: ${failed.join(', ')}` : `all ${ALL_ASSETS.length} assets loaded`),
    );
  }, []);

  return (
    <main className="g-main">
      <header className="g-header">
        <h1>DASTAKHAN art gallery (dev only)</h1>
        <p>
          Provenance: <strong>{ASSET_PROVENANCE}</strong>. Preload: <span id="preload-status">{preload}</span>
        </p>
        <p className="g-note">
          Goal icons (FoodIcon 24 px):{' '}
          {FOOD_TYPES.map((t) => (
            <FoodIcon key={t} type={t} size={24} label={t} />
          ))}
        </p>
      </header>
      {SIZES.map((size) => (
        <Matrix key={size} size={size} />
      ))}
      <Confusable />
      <Section title="Sample 11×11 boards, 34 px pitch (390 px phone): classic six / new dishes + tea / risky six">
        <div className="g-boards">
          <SampleBoard pitch={34} dark={false} board={BOARDS.classic} />
          <SampleBoard pitch={34} dark={false} board={BOARDS.fresh} />
          <SampleBoard pitch={34} dark={false} board={BOARDS.risky} />
          <SampleBoard pitch={34} dark board={BOARDS.risky} />
        </div>
      </Section>
      <Section title="Stress test: all 11 types on one board (never used by a level), 28 and 34 px">
        <div className="g-boards">
          <SampleBoard pitch={28} dark={false} board={BOARDS.all} />
          <SampleBoard pitch={34} dark={false} board={BOARDS.all} />
        </div>
      </Section>
      <FillCheck />
      <Section title={`Background (${BACKGROUND_ART.width}×${BACKGROUND_ART.height}, opaque)`}>
        <div className="g-bg">
          <img src={BACKGROUND_ART.url} alt="" width={270} height={480} />
          <div className="g-bg__mock">
            <img src={BACKGROUND_ART.url} alt="" width={270} height={480} />
            <span className="g-bg__board" />
          </div>
        </div>
      </Section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
