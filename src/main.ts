// Entry point: fonts + images preload, title screen, then the game.
import './style.css';
import { Game } from './game/game';
import { missingImages, preloadImages } from './data/imageAssets';

async function loadFonts(): Promise<void> {
  const url = `${import.meta.env.BASE_URL}assets/fonts/PretendardVariable.woff2`;
  const faces = ['Pretendard Variable', 'Pretendard'].map((family) => new FontFace(family, `url(${url}) format('woff2')`, { weight: '45 920', style: 'normal', display: 'swap' }));
  for (const f of faces) document.fonts.add(f);
  try {
    await Promise.all(faces.map((f) => f.load()));
  } catch (e) {
    console.warn('[fonts] Pretendard failed to load; falling back to system Korean fonts', e);
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  const game = new Game(canvas, ui);
  (window as unknown as { __game?: Game }).__game = import.meta.env.DEV ? game : undefined;
  const title = game.showTitle();
  title.setProgress(0.05, '글꼴 불러오는 중…');
  await loadFonts();
  title.setProgress(0.2, '사진 자료 불러오는 중…');
  await preloadImages((done, total) => title.setProgress(0.2 + (done / total) * 0.8, `사진 자료 불러오는 중… ${done}/${total}`));
  const miss = missingImages();
  if (miss.length) console.warn('[images] missing runtime assets:', miss);
  if (import.meta.env.DEV) {
    const m = await import('./debug/debug');
    m.installDebug(game);
  }
  title.ready();
  document.body.dataset.ready = '1';
}

void boot();
