import { useEffect, useState } from 'react';
import { App } from '../App.tsx';
import CafeApp, { recordCafeGameWin } from '../cafe/CafeApp.tsx';
import { Landing } from './Landing.tsx';

export function PlatformApp() {
  const [route, setRoute] = useState(() => location.hash || '#home');
  useEffect(() => {
    const update = () => { setRoute(location.hash || '#home'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    if (route !== '#play') document.title = route === '#demo' ? 'Кабинет кафе — DASTAKHAN' : route === '#guest' ? 'Кафе — DASTAKHAN' : 'DASTAKHAN — игра со вкусом';
  }, [route]);
  useEffect(() => {
    const win = (event: Event) => {
      recordCafeGameWin((event as CustomEvent).detail);
      location.hash = '#guest';
    };
    window.addEventListener('dastakhan:game-won', win);
    return () => window.removeEventListener('dastakhan:game-won', win);
  }, []);
  if (route === '#play' || route.startsWith('#layout-demo')) return <><App cafeMode={route === '#play'} /><a className="platform-game-back" href="#guest">← В кафе · демо</a></>;
  if (route === '#demo' || route === '#guest') return <CafeApp onPlay={() => { location.hash = '#play'; }} />;
  return <Landing />;
}
