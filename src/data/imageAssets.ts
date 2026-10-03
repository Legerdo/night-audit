// Runtime image registry. Only QA-approved assets are listed here (see docs/image-assets.json).
// Paths are relative to the site root (Vite `public/`).

export const IMAGE_ASSETS = {
  gallery_family_normal: 'assets/images/normal/family_photo.jpg',
  gallery_family_anomaly: 'assets/images/anomaly/family_photo_extra_person.jpg',
  gallery_ceremony_normal: 'assets/images/normal/ceremony_photo.jpg',
  gallery_ceremony_anomaly: 'assets/images/anomaly/ceremony_photo_gaze.jpg',
  gallery_kimjang: 'assets/images/normal/gallery_kimjang.jpg',
  gallery_rooftop: 'assets/images/normal/gallery_rooftop.jpg',
  gallery_exterior: 'assets/images/normal/gallery_exterior.jpg',
  res_leesoonja: 'assets/images/residents/leesoonja.jpg',
  res_leesoonja_smile: 'assets/images/anomaly/leesoonja_smile.jpg',
  res_kimdohyun: 'assets/images/residents/kimdohyun.jpg',
  res_parkyoungsoo: 'assets/images/residents/parkyoungsoo.jpg',
  res_choiminyoung: 'assets/images/residents/choiminyoung.jpg',
  res_ohjieun: 'assets/images/residents/ohjieun.jpg',
  staff_hanseojin: 'assets/images/residents/hanseojin.jpg',
  staff_parkjeongho: 'assets/images/residents/parkjeongho.jpg',
  staff_parkjeongho_empty: 'assets/images/anomaly/parkjeongho_empty.jpg',
  ad_elevator_normal: 'assets/images/posters/elevator_ad.jpg',
  ad_elevator_anomaly: 'assets/images/anomaly/elevator_ad_rooftop.jpg',
  archive_13f_construction: 'assets/images/archive/construction_13f.jpg',
  archive_1301_family: 'assets/images/archive/family_1301.jpg',
  keyart_title: 'assets/images/keyart/title.jpg',
} as const;

export type ImageKey = keyof typeof IMAGE_ASSETS;

const loaded = new Map<ImageKey, HTMLImageElement | HTMLCanvasElement>();
const missing = new Set<ImageKey>();

function placeholder(key: string): HTMLCanvasElement {
  // Neutral, clearly-non-content placeholder (only used if an asset failed to load).
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#6f6a60';
  ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = '#8a857a';
  ctx.fillRect(24, 24, 464, 336);
  ctx.fillStyle = '#3b3833';
  ctx.font = '20px sans-serif';
  ctx.fillText(key, 36, 60);
  return c;
}

export async function preloadImages(onProgress?: (done: number, total: number) => void): Promise<void> {
  const keys = Object.keys(IMAGE_ASSETS) as ImageKey[];
  let done = 0;
  const base = import.meta.env.BASE_URL;
  await Promise.all(
    keys.map(
      (k) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            loaded.set(k, img);
            onProgress?.(++done, keys.length);
            resolve();
          };
          img.onerror = () => {
            missing.add(k);
            loaded.set(k, placeholder(k));
            onProgress?.(++done, keys.length);
            resolve();
          };
          img.src = base + IMAGE_ASSETS[k];
        }),
    ),
  );
}

export function getImage(key: ImageKey): HTMLImageElement | HTMLCanvasElement {
  let img = loaded.get(key);
  if (!img) {
    img = placeholder(key);
    loaded.set(key, img);
  }
  return img;
}

export function imageUrl(key: ImageKey): string {
  return import.meta.env.BASE_URL + IMAGE_ASSETS[key];
}

export function missingImages(): ImageKey[] {
  return [...missing];
}
