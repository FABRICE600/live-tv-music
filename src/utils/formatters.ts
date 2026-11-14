import type { AccentMode, EqSettings, MusicTrack, SurfaceMode } from '../types/music';

export const SURFACE_MODES: Array<{
  id: SurfaceMode;
  label: string;
  sub: string;
  isDark: boolean;
  bgPreview: string;
  surfacePreview: string;
}> = [
  {
    id: 'midnight',
    label: 'Obsidian Night',
    sub: 'Dark Studio',
    isDark: true,
    bgPreview: '#0B0C10',
    surfacePreview: '#13151C',
  },
  {
    id: 'slate',
    label: 'Deep Indigo',
    sub: 'Midnight Blue',
    isDark: true,
    bgPreview: '#080E1A',
    surfacePreview: '#0F172A',
  },
  {
    id: 'paper',
    label: 'Gallery Stone',
    sub: 'Warm Light',
    isDark: false,
    bgPreview: '#F3F2EE',
    surfacePreview: '#FFFFFF',
  },
  {
    id: 'ivory',
    label: 'Daylight Crisp',
    sub: 'Pure White',
    isDark: false,
    bgPreview: '#F4F6FA',
    surfacePreview: '#FFFFFF',
  },
];

export const ACCENT_MODES: Array<{
  id: AccentMode;
  label: string;
  swatch: string;
}> = [
  { id: 'amber', label: 'Brass', swatch: '#D99B26' },
  { id: 'cobalt', label: 'Cobalt', swatch: '#2563EB' },
  { id: 'emerald', label: 'Jade', swatch: '#0D9488' },
  { id: 'vermilion', label: 'Crimson', swatch: '#E04F2B' },
  { id: 'plum', label: 'Violet', swatch: '#7C3AED' },
];

export const EQ_BANDS = [
  { freq: 60, label: '60 Hz', sub: 'Sub Bass' },
  { freq: 230, label: '230 Hz', sub: 'Warmth' },
  { freq: 910, label: '910 Hz', sub: 'Mids' },
  { freq: 3600, label: '3.6 kHz', sub: 'Presence' },
  { freq: 14000, label: '14 kHz', sub: 'Air' },
] as const;

export const EQ_PRESETS: Record<string, [number, number, number, number, number]> = {
  'Flat Reference': [0, 0, 0, 0, 0],
  'Warm Vinyl': [3.5, 2.5, -0.5, -1.5, -2],
  'Club Sub-Bass': [6, 3.5, -1, 1.5, 2.5],
  'Vocal Presence': [-2, -1, 2.5, 4.5, 2],
  'Late Night': [2, 1, 0, -2.5, -3.5],
};

export const DEFAULT_EQ: EqSettings = {
  enabled: true,
  preset: 'Flat Reference',
  bands: [0, 0, 0, 0, 0],
  playbackRate: 1,
};

export function formatDuration(seconds: number, isLive?: boolean): string {
  if (isLive || !Number.isFinite(seconds) || seconds <= 0) {
    return isLive ? 'LIVE' : '0:00';
  }
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatMinutesTotal(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.max(0, Math.round(totalSeconds))}s`;
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export function exportPlaylistAsJson(name: string, tracks: MusicTrack[]): void {
  const payload = {
    name,
    exportedAt: new Date().toISOString(),
    platform: 'Soundmark',
    tracks: tracks.map((t) => ({
      title: t.title,
      artist: t.artist,
      album: t.album,
      genre: t.genre,
      country: t.country,
      source: t.sourceLabel,
      durationSec: t.durationSec,
      storeLinks: t.storeLinks,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'playlist'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPlaylistAsM3u(name: string, tracks: MusicTrack[]): void {
  const lines = ['#EXTM3U', `#PLAYLIST:${name}`];
  for (const t of tracks) {
    lines.push(`#EXTINF:${Math.round(t.durationSec || -1)},${t.artist} - ${t.title}`);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    lines.push(t.audioUrl.startsWith('/') ? `${origin}${t.audioUrl}` : t.audioUrl);
  }
  const blob = new Blob([lines.join('\n')], { type: 'audio/x-mpegurl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'playlist'}.m3u`;
  a.click();
  URL.revokeObjectURL(url);
}
