export interface ExtractedColorResult {
  hue: number;
  saturation: number;
  lightness: number;
  r: number;
  g: number;
  b: number;
  hex: string;
}

export interface AdaptiveThemePalette {
  appBg: string;
  sidebarBg: string;
  surfaceTint: string;
  mutedBg: string;
  borderColor: string;
  dynamicTint: string;
  sidebarTint: string;
  surfaceGlassRgb: string;
  swatchHex: string;
}

const IMAGE_COLOR_CACHE = new Map<string, ExtractedColorResult | null>();
let sharedCanvas: HTMLCanvasElement | null = null;

function getSampleCanvas(size = 28): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
  }
  sharedCanvas.width = size;
  sharedCanvas.height = size;
  return sharedCanvas;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToRgb(h: number, sPct: number, lPct: number): [number, number, number] {
  const hNorm = ((h % 360) + 360) % 360 / 360;
  const s = clamp(sPct, 0, 100) / 100;
  const l = clamp(lPct, 0, 100) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  return [
    Math.round(hue2rgb(hNorm + 1 / 3) * 255),
    Math.round(hue2rgb(hNorm) * 255),
    Math.round(hue2rgb(hNorm - 1 / 3) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function sampleVibrantHueFromPixels(data: Uint8ClampedArray): ExtractedColorResult | null {
  const binCount = 24; // 15-degree hue buckets
  const binWeight = new Float64Array(binCount);
  const binR = new Float64Array(binCount);
  const binG = new Float64Array(binCount);
  const binB = new Float64Array(binCount);

  let fallbackWeight = 0;
  let fallbackR = 0;
  let fallbackG = 0;
  let fallbackB = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 140) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum < 0.04 || lum > 0.96) continue;

    fallbackWeight += 1;
    fallbackR += r;
    fallbackG += g;
    fallbackB += b;

    const { h, s } = rgbToHsl(r, g, b);
    if (s < 14) continue;

    // Emphasize rich, mid-tone chromatic pixels over near-greys
    const lumBias = 1 - Math.abs(lum - 0.5) * 0.7;
    const weight = (s / 100) * (0.45 + lumBias);
    const bin = Math.floor((h % 360) / 15) % binCount;

    binWeight[bin] += weight;
    binR[bin] += r * weight;
    binG[bin] += g * weight;
    binB[bin] += b * weight;
  }

  let bestBin = -1;
  let bestWeight = 0;
  for (let b = 0; b < binCount; b++) {
    if (binWeight[b] > bestWeight) {
      bestWeight = binWeight[b];
      bestBin = b;
    }
  }

  let outR: number;
  let outG: number;
  let outB: number;

  if (bestBin >= 0 && bestWeight > 0) {
    outR = Math.round(binR[bestBin] / bestWeight);
    outG = Math.round(binG[bestBin] / bestWeight);
    outB = Math.round(binB[bestBin] / bestWeight);
  } else if (fallbackWeight > 0) {
    outR = Math.round(fallbackR / fallbackWeight);
    outG = Math.round(fallbackG / fallbackWeight);
    outB = Math.round(fallbackB / fallbackWeight);
  } else {
    return null;
  }

  const hsl = rgbToHsl(outR, outG, outB);
  return {
    hue: hsl.h,
    saturation: hsl.s,
    lightness: hsl.l,
    r: outR,
    g: outG,
    b: outB,
    hex: rgbToHex(outR, outG, outB),
  };
}

export function extractDominantColorFromVideo(
  video: HTMLVideoElement | null,
): ExtractedColorResult | null {
  if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }
  const canvas = getSampleCanvas(24);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return sampleVibrantHueFromPixels(imgData.data);
  } catch {
    // Tainted cross-origin video canvas without CORS headers
    return null;
  }
}

function loadImageAndExtract(srcUrl: string): Promise<ExtractedColorResult | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    const timer = window.setTimeout(() => {
      resolve(null);
    }, 4500);

    img.onload = () => {
      window.clearTimeout(timer);
      const canvas = getSampleCanvas(28);
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) {
        resolve(null);
        return;
      }
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(sampleVibrantHueFromPixels(imgData.data));
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };

    img.src = srcUrl;
  });
}

export async function extractDominantColorFromImage(
  imageUrl?: string | null,
): Promise<ExtractedColorResult | null> {
  const cleaned = (imageUrl || '').trim();
  if (!cleaned || (!cleaned.startsWith('http://') && !cleaned.startsWith('https://'))) {
    return null;
  }

  if (IMAGE_COLOR_CACHE.has(cleaned)) {
    return IMAGE_COLOR_CACHE.get(cleaned) ?? null;
  }

  // First attempt direct anonymous CORS load
  let result = await loadImageAndExtract(cleaned);

  // Fallback via same-origin server image proxy if host omits CORS headers
  if (!result) {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(cleaned)}`;
    result = await loadImageAndExtract(proxyUrl);
  }

  if (IMAGE_COLOR_CACHE.size > 160) {
    const firstKey = IMAGE_COLOR_CACHE.keys().next().value;
    if (firstKey) IMAGE_COLOR_CACHE.delete(firstKey);
  }
  IMAGE_COLOR_CACHE.set(cleaned, result);
  return result;
}

export function computeAdaptiveThemePalette(
  color: ExtractedColorResult,
  isDark: boolean,
): AdaptiveThemePalette {
  const hue = color.hue;
  const baseSat = clamp(color.saturation, 18, 86);

  if (isDark) {
    const bgSat = clamp(Math.round(baseSat * 0.44), 16, 44);
    const sideSat = clamp(Math.round(baseSat * 0.50), 20, 48);
    const mutedSat = clamp(Math.round(baseSat * 0.40), 16, 38);
    const borderSat = clamp(Math.round(baseSat * 0.36), 14, 34);
    const glowSat = clamp(Math.round(baseSat * 0.85), 42, 82);

    const [sr, sg, sb] = hslToRgb(hue, sideSat, 9.5);
    return {
      appBg: `hsl(${hue} ${bgSat}% 6.5%)`,
      sidebarBg: `hsl(${hue} ${sideSat}% 9.5%)`,
      surfaceTint: `hsl(${hue} ${sideSat}% 10.5%)`,
      mutedBg: `hsl(${hue} ${mutedSat}% 14%)`,
      borderColor: `hsl(${hue} ${borderSat}% 20%)`,
      dynamicTint: `hsla(${hue}, ${glowSat}%, 48%, 0.22)`,
      sidebarTint: `hsla(${hue}, ${glowSat}%, 46%, 0.16)`,
      surfaceGlassRgb: `${sr}, ${sg}, ${sb}`,
      swatchHex: color.hex,
    };
  }

  const bgSat = clamp(Math.round(baseSat * 0.34), 14, 34);
  const sideSat = clamp(Math.round(baseSat * 0.40), 18, 40);
  const mutedSat = clamp(Math.round(baseSat * 0.32), 14, 32);
  const borderSat = clamp(Math.round(baseSat * 0.28), 12, 26);
  const glowSat = clamp(Math.round(baseSat * 0.72), 34, 68);

  const [sr, sg, sb] = hslToRgb(hue, sideSat, 97.5);
  return {
    appBg: `hsl(${hue} ${bgSat}% 95%)`,
    sidebarBg: `hsl(${hue} ${sideSat}% 97.5%)`,
    surfaceTint: `hsl(${hue} ${sideSat}% 98.5%)`,
    mutedBg: `hsl(${hue} ${mutedSat}% 90%)`,
    borderColor: `hsl(${hue} ${borderSat}% 83%)`,
    dynamicTint: `hsla(${hue}, ${glowSat}%, 58%, 0.15)`,
    sidebarTint: `hsla(${hue}, ${glowSat}%, 55%, 0.12)`,
    surfaceGlassRgb: `${sr}, ${sg}, ${sb}`,
    swatchHex: color.hex,
  };
}
