import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import type {
  ArtistSummary,
  CuratedPlaylist,
  DiscoverCatalog,
  LiveMatchHighlight,
  LiveMatchItem,
  MusicStoreDirectoryItem,
  MusicTrack,
  SpotifyCuratedPlaylist,
  StoreLink,
  TvCategoryOption,
  TvChannel,
  TvCountryOption,
} from './src/types/music.ts';
import { registerGeminiRoutes } from './src/server/geminiRoutes.ts';
import { optionalAuth, requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  deleteSavedVenueForUid,
  deleteStudioCreationForUid,
  getLeaderboard,
  getOrCreateUser,
  getSavedVenuesByUid,
  getStudioCreationsByUid,
  saveGameScore,
  saveStudioCreationForUid,
  saveVenueForUid,
} from './src/db/users.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx >= 0 ? Number(process.argv[portArgIdx + 1]) : NaN;
const PORT =
  Number.isFinite(cliPort) && cliPort > 0 ? cliPort : Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Curated generated artwork paths served statically from /src/assets/images
const ARTWORK_ELECTRONIC = '/src/assets/images/cover_electronic_sessions_1794641732983.jpg';
const ARTWORK_ACOUSTIC = '/src/assets/images/cover_acoustic_warmth_1794641733848.jpg';
const ARTWORK_JAZZ = '/src/assets/images/cover_midnight_jazz_1794641734051.jpg';
const ARTWORK_AMBIENT = '/src/assets/images/cover_ambient_horizon_1794641734688.jpg';
const HERO_LISTENING_ROOM = '/src/assets/images/hero_listening_room_1794641735621.jpg';

const AUDIUS_HOSTS = [
  'https://discoveryprovider.audius.co',
  'https://discoveryprovider2.audius.co',
  'https://discoveryprovider3.audius.co',
  'https://api.audius.co',
];

const RADIO_HOSTS = [
  'https://de1.api.radio-browser.info',
  'https://fr1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];

const COUNTRIES = [
  'All Countries',
  'Rwanda',
  'United States',
  'United Kingdom',
  'Kenya',
  'Uganda',
  'Tanzania',
  'Nigeria',
  'Ghana',
  'South Africa',
  'DR Congo',
  'Japan',
  'Germany',
  'France',
  'Brazil',
  'Jamaica',
  'South Korea',
  'Spain',
  'India',
  'Iceland',
  'Canada',
  'Australia',
  'Global',
];

const PLATFORMS = [
  'All Platforms',
  'Audius',
  'YouTube Music',
  'Internet Archive',
  'Wikimedia Commons',
  'Global Radio',
];

const GENRES = [
  'All Genres',
  'Afrobeats',
  'Afropop',
  'Amapiano',
  'Gakondo',
  'Gospel',
  'Electronic',
  'Ambient',
  'Jazz',
  'R&B',
  'Soul',
  'Hip-Hop',
  'Acoustic',
  'Classical',
  'Indie',
  'Pop',
  'Rock',
  'World',
];

const MUSIC_STORES: MusicStoreDirectoryItem[] = [
  {
    id: 'bandcamp',
    name: 'Bandcamp',
    category: 'Direct-to-Artist Marketplace',
    formats: 'FLAC · WAV · ALAC · MP3 · Vinyl',
    description:
      'Independent artist and label storefront offering DRM-free lossless downloads, physical pressings, and direct artist payouts.',
    url: 'https://bandcamp.com',
    searchTemplate: 'https://bandcamp.com/search?q={q}',
  },
  {
    id: 'qobuz',
    name: 'Qobuz',
    category: 'Hi-Res Audiophile Store',
    formats: '24-Bit / 192kHz FLAC · DSD · ALAC',
    description:
      'Studio-master digital download store and editorial catalog specializing in jazz, classical, electronic, and audiophile pressings.',
    url: 'https://www.qobuz.com',
    searchTemplate: 'https://www.qobuz.com/us-en/search?q={q}',
  },
  {
    id: 'beatport',
    name: 'Beatport',
    category: 'Electronic & DJ Catalog',
    formats: 'AIFF · WAV · MP3 320kbps',
    description:
      'Specialized storefront for club DJs, house, techno, ambient electronic producers, and independent underground labels.',
    url: 'https://www.beatport.com',
    searchTemplate: 'https://www.beatport.com/search?q={q}',
  },
  {
    id: 'itunes',
    name: 'iTunes / Apple Music',
    category: 'Global Digital Catalog',
    formats: '256kbps AAC · Lossless Spatial',
    description:
      'Official global music catalog supporting direct single purchases, album downloads, and universal artist lookup.',
    url: 'https://music.apple.com',
    searchTemplate: 'https://music.apple.com/us/search?term={q}',
  },
  {
    id: '7digital',
    name: '7digital',
    category: 'DRM-Free Lossless Store',
    formats: 'FLAC 16/24-Bit · MP3 320kbps',
    description:
      'High-resolution DRM-free digital storefront serving independent labels, major distributors, and soundtrack releases.',
    url: 'https://us.7digital.com',
    searchTemplate: 'https://us.7digital.com/Search?search={q}',
  },
  {
    id: 'amazon',
    name: 'Amazon Music',
    category: 'Digital & Vinyl Storefront',
    formats: 'MP3 · CD · Vinyl Pressings',
    description:
      'Broad commercial music storefront combining instant MP3 downloads with physical vinyl and CD editions.',
    url: 'https://music.amazon.com',
    searchTemplate: 'https://music.amazon.com/search/{q}',
  },
  {
    id: 'tidal',
    name: 'TIDAL',
    category: 'Lossless & Master Streaming',
    formats: 'FLAC HiRes · Dolby Atmos',
    description:
      'Artist-aligned lossless music catalog with detailed session credits, liner metadata, and hi-fi playback.',
    url: 'https://tidal.com',
    searchTemplate: 'https://listen.tidal.com/search?q={q}',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'Streaming & Playlist Ecosystem',
    formats: 'Interactive Embeds · Catalog Sync',
    description:
      'Global streaming catalog integrated with embedded Spotify players and playlist/track URL importing inside Soundmark.',
    url: 'https://open.spotify.com',
    searchTemplate: 'https://open.spotify.com/search/{q}',
  },
];

const SPOTIFY_PLAYLISTS: SpotifyCuratedPlaylist[] = [
  {
    id: 'sp-lofi-studio',
    title: 'Late Night Tape Studies',
    subtitle: 'Warm analog beats, dusty electric pianos, and intimate midnight textures.',
    curator: 'Spotify Editorial',
    coverUrl: ARTWORK_ACOUSTIC,
    spotifyEmbedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXc8kgYqQLMfH',
    spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXc8kgYqQLMfH',
  },
  {
    id: 'sp-jazz-room',
    title: 'Tokyo & London Jazz Bar',
    subtitle: 'Modern spiritual jazz, upright bass solos, and nocturnal brass sessions.',
    curator: 'Spotify Jazz',
    coverUrl: ARTWORK_JAZZ,
    spotifyEmbedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DXbITWG1ZJKYt',
    spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXbITWG1ZJKYt',
  },
  {
    id: 'sp-electronic-pulse',
    title: 'Berlin Modular & House',
    subtitle: 'Deep hypnotic hardware grooves, melodic synth lines, and club cuts.',
    curator: 'Spotify Electronic',
    coverUrl: ARTWORK_ELECTRONIC,
    spotifyEmbedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX6J5NfMJS675',
    spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX6J5NfMJS675',
  },
  {
    id: 'sp-ambient-nordic',
    title: 'Nordic Ambient Horizon',
    subtitle: 'Spatial modular drones, felt piano meditations, and minimalist field recordings.',
    curator: 'Spotify Ambient',
    coverUrl: ARTWORK_AMBIENT,
    spotifyEmbedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX3Ogo9pFvBkY',
    spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX3Ogo9pFvBkY',
  },
  {
    id: 'sp-afrobeats-kigali',
    title: 'African Heat & East Africa Pulse',
    subtitle: 'High-energy Afrobeats, Kigali Afropop, Amapiano grooves, and dancefloor anthems.',
    curator: 'Spotify Africa',
    coverUrl: ARTWORK_ELECTRONIC,
    spotifyEmbedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX51Q56x2y3wI',
    spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX51Q56x2y3wI',
  },
  {
    id: 'sp-soul-hiphop',
    title: 'Global Neo-Soul & Golden Hip-Hop',
    subtitle: 'Warm boom-bap drums, lush R&B harmonies, and lyrical studio sessions.',
    curator: 'Spotify Soul & Rap',
    coverUrl: ARTWORK_JAZZ,
    spotifyEmbedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX4o1oenSJRJd',
    spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX4o1oenSJRJd',
  },
];

function buildStoreLinks(artist: string, title: string, spotifyUrl?: string): StoreLink[] {
  const query = encodeURIComponent(`${artist} ${title}`.trim());
  return [
    {
      id: 'bandcamp',
      name: 'Bandcamp',
      tagline: 'Direct-to-Artist FLAC / WAV / Vinyl',
      url: `https://bandcamp.com/search?q=${query}`,
    },
    {
      id: 'qobuz',
      name: 'Qobuz',
      tagline: '24-Bit Hi-Res Lossless Download',
      url: `https://www.qobuz.com/us-en/search?q=${query}`,
    },
    {
      id: 'beatport',
      name: 'Beatport',
      tagline: 'Lossless Electronic & Club Catalog',
      url: `https://www.beatport.com/search?q=${query}`,
    },
    {
      id: 'itunes',
      name: 'iTunes / Apple Music',
      tagline: 'Official AAC / Lossless Store',
      url: `https://music.apple.com/us/search?term=${query}`,
    },
    {
      id: '7digital',
      name: '7digital',
      tagline: 'DRM-Free MP3 / FLAC Store',
      url: `https://us.7digital.com/Search?search=${query}`,
    },
    {
      id: 'spotify',
      name: 'Spotify',
      tagline: 'Open & Save in Spotify',
      url: spotifyUrl || `https://open.spotify.com/search/${query}`,
    },
  ];
}

function proxyStreamUrl(rawUrl: string): string {
  return `/api/music/stream?url=${encodeURIComponent(rawUrl)}`;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 5500): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SoundmarkAudioPlatform/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface AudiusUserRaw {
  id: string;
  name?: string;
  handle?: string;
  location?: string;
  bio?: string;
  is_verified?: boolean;
  track_count?: number;
  follower_count?: number;
  profile_picture?: {
    '150x150'?: string;
    '480x480'?: string;
    '1000x1000'?: string;
  };
}

interface AudiusTrackRaw {
  id: string;
  title?: string;
  genre?: string;
  duration?: number;
  is_streamable?: boolean;
  release_date?: string;
  mood?: string;
  artwork?: {
    '150x150'?: string;
    '480x480'?: string;
    '1000x1000'?: string;
  };
  user?: AudiusUserRaw;
}

function mapAudiusTrack(raw: AudiusTrackRaw, host: string): MusicTrack {
  const artistName = raw.user?.name || raw.user?.handle || 'Independent Artist';
  const title = raw.title || 'Untitled Session';
  const coverUrl =
    raw.artwork?.['480x480'] ||
    raw.artwork?.['1000x1000'] ||
    raw.artwork?.['150x150'] ||
    ARTWORK_ELECTRONIC;
  const avatarUrl =
    raw.user?.profile_picture?.['480x480'] || raw.user?.profile_picture?.['150x150'] || coverUrl;
  const rawStream = `${host}/v1/tracks/${encodeURIComponent(raw.id)}/stream?app_name=Soundmark`;
  const country = raw.user?.location?.trim() || 'Global';
  return {
    id: `audius-${raw.id}`,
    title,
    artist: artistName,
    artistId: raw.user?.id ? `audius-user-${raw.user.id}` : undefined,
    artistHandle: raw.user?.handle ? `@${raw.user.handle.replace(/^@/, '')}` : undefined,
    artistLocation: country,
    artistAvatar: avatarUrl,
    artistVerified: Boolean(raw.user?.is_verified),
    album: raw.mood ? `${raw.mood} Sessions` : 'Audius Master',
    genre: raw.genre || 'Electronic',
    country,
    durationSec: Number(raw.duration) || 210,
    audioUrl: proxyStreamUrl(rawStream),
    coverUrl,
    year: raw.release_date ? String(raw.release_date).slice(0, 4) : '2025',
    license: 'Full Stream',
    sourceLabel: 'Audius',
    isPreview: false,
    bitrateLabel: '320 kbps Full',
    storeLinks: buildStoreLinks(artistName, title),
  };
}

async function fetchAudiusTrending(genre?: string, limit = 14): Promise<{ tracks: MusicTrack[]; host: string }> {
  for (const host of AUDIUS_HOSTS) {
    const params = new URLSearchParams({ app_name: 'Soundmark', limit: String(limit) });
    if (genre && genre !== 'All Genres') params.set('genre', genre);
    const json = await fetchJsonWithTimeout<{ data?: AudiusTrackRaw[] }>(
      `${host}/v1/tracks/trending?${params.toString()}`,
      4500,
    );
    if (json?.data && json.data.length > 0) {
      return {
        host,
        tracks: json.data
          .filter(
            (t) =>
              t.id &&
              t.title &&
              t.is_streamable !== false &&
              (!t.duration || Number(t.duration) >= 45),
          )
          .map((t) => mapAudiusTrack(t, host)),
      };
    }
  }
  return { host: AUDIUS_HOSTS[0], tracks: [] };
}

async function searchAudiusTracks(query: string, limit = 16): Promise<MusicTrack[]> {
  for (const host of AUDIUS_HOSTS) {
    const params = new URLSearchParams({
      app_name: 'Soundmark',
      query: query || 'ambient',
      limit: String(limit),
    });
    const json = await fetchJsonWithTimeout<{ data?: AudiusTrackRaw[] }>(
      `${host}/v1/tracks/search?${params.toString()}`,
      4500,
    );
    if (json?.data && json.data.length > 0) {
      return json.data
        .filter(
          (t) =>
            t.id &&
            t.title &&
            t.is_streamable !== false &&
            (!t.duration || Number(t.duration) >= 45),
        )
        .map((t) => mapAudiusTrack(t, host));
    }
  }
  return [];
}

async function searchAudiusArtists(query: string, limit = 16): Promise<ArtistSummary[]> {
  for (const host of AUDIUS_HOSTS) {
    const params = new URLSearchParams({
      app_name: 'Soundmark',
      query: query || 'music',
      limit: String(limit),
    });
    const json = await fetchJsonWithTimeout<{ data?: AudiusUserRaw[] }>(
      `${host}/v1/users/search?${params.toString()}`,
      4500,
    );
    if (json?.data && json.data.length > 0) {
      return json.data.map((u) => ({
        id: `audius-user-${u.id}`,
        name: u.name || u.handle || 'Independent Artist',
        handle: u.handle ? `@${u.handle.replace(/^@/, '')}` : undefined,
        location: u.location?.trim() || 'Global',
        avatarUrl:
          u.profile_picture?.['480x480'] ||
          u.profile_picture?.['150x150'] ||
          ARTWORK_ELECTRONIC,
        verified: Boolean(u.is_verified),
        bio: u.bio || undefined,
        sourceLabel: 'Audius',
        trackCount: u.track_count,
        followerCount: u.follower_count,
        topTracks: [],
      }));
    }
  }
  return [];
}

interface RadioStationRaw {
  stationuuid: string;
  name: string;
  url_resolved?: string;
  url: string;
  favicon?: string;
  tags?: string;
  country?: string;
  bitrate?: number;
  codec?: string;
}

async function fetchRadioStations(country?: string, query?: string, limit = 8): Promise<MusicTrack[]> {
  for (const host of RADIO_HOSTS) {
    const params = new URLSearchParams({
      limit: String(limit),
      hidebroken: 'true',
      order: 'clickcount',
      reverse: 'true',
      is_https: 'true',
    });
    if (country && country !== 'All Countries' && country !== 'Global') {
      params.set('country', country);
    }
    if (query) {
      params.set('name', query);
    }
    const json = await fetchJsonWithTimeout<RadioStationRaw[]>(
      `${host}/json/stations/search?${params.toString()}`,
      4500,
    );
    if (Array.isArray(json) && json.length > 0) {
      return json
        .filter((s) => (s.url_resolved || s.url) && s.name)
        .slice(0, limit)
        .map((s, idx) => {
          const streamUrl = s.url_resolved || s.url;
          const tags = (s.tags || 'World Radio')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          const genre = tags[0] ? tags[0][0].toUpperCase() + tags[0].slice(1) : 'World';
          const fallbackArt = [ARTWORK_JAZZ, ARTWORK_AMBIENT, ARTWORK_ELECTRONIC, ARTWORK_ACOUSTIC][
            idx % 4
          ];
          return {
            id: `radio-${s.stationuuid}`,
            title: s.name.trim(),
            artist: `${s.country || 'International'} Broadcast`,
            artistLocation: s.country || 'Global',
            album: 'Live FM & Web Relay',
            genre,
            country: s.country || 'Global',
            durationSec: 0,
            audioUrl: proxyStreamUrl(streamUrl),
            coverUrl: s.favicon && s.favicon.startsWith('https://') ? s.favicon : fallbackArt,
            license: 'Live Broadcast',
            sourceLabel: 'Global Radio',
            isLive: true,
            bitrateLabel: s.bitrate ? `${s.bitrate} kbps ${s.codec || 'Live'}` : 'Live Stream',
            storeLinks: buildStoreLinks(s.name.trim(), 'Radio'),
          };
        });
    }
  }
  return [];
}

interface ArchiveDocRaw {
  identifier: string;
  title?: string;
  creator?: string | string[];
  year?: string;
  subject?: string | string[];
}

async function searchInternetArchiveTracks(query: string, limit = 6): Promise<MusicTrack[]> {
  const q = query ? `(${query}) AND mediatype:audio` : 'mediatype:audio AND (jazz OR ambient OR acoustic)';
  const params = new URLSearchParams({
    q,
    'fl[]': 'identifier,title,creator,year,subject',
    rows: String(limit),
    page: '1',
    output: 'json',
    'sort[]': 'downloads desc',
  });
  const json = await fetchJsonWithTimeout<{ response?: { docs?: ArchiveDocRaw[] } }>(
    `https://archive.org/advancedsearch.php?${params.toString()}`,
    5000,
  );
  const docs = json?.response?.docs || [];
  const metaList = await Promise.all(
    docs.slice(0, limit).map(async (doc) => {
      const meta = await fetchJsonWithTimeout<{
        files?: Array<{ name: string; format?: string; length?: string }>;
      }>(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`, 3500);
      return { doc, meta };
    }),
  );

  const results: MusicTrack[] = [];
  for (const { doc, meta } of metaList) {
    const mp3File = meta?.files?.find(
      (f) => f.name.toLowerCase().endsWith('.mp3') && !f.name.includes('_64kb'),
    );
    if (!mp3File) continue;

    const artist = Array.isArray(doc.creator)
      ? doc.creator[0]
      : doc.creator || 'Archival Recording';
    const title = doc.title || doc.identifier;
    const rawStream = `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeURIComponent(mp3File.name)}`;
    const durationSec = Math.round(Number(mp3File.length)) || 240;
    if (durationSec < 45) continue;

    results.push({
      id: `ia-${doc.identifier}`,
      title,
      artist,
      artistId: `ia-artist-${encodeURIComponent(artist)}`,
      artistLocation: 'Public Archive',
      album: 'Internet Archive Collection',
      genre: 'Classical',
      country: 'Global',
      durationSec,
      audioUrl: proxyStreamUrl(rawStream),
      coverUrl: ARTWORK_ACOUSTIC,
      year: doc.year ? String(doc.year).slice(0, 4) : 'Archive',
      license: 'Open Archive · Full Stream',
      sourceLabel: 'Internet Archive',
      isPreview: false,
      bitrateLabel: 'MP3 Full Archive',
      storeLinks: buildStoreLinks(artist, title),
    });
  }

  return results;
}

// Built-in resilient fallback tracks using verified Wikimedia Commons public domain / CC OGG/MP3 audio
// so even if external APIs are rate-limited, every curated session has real full-length playable audio!
const RESILIENT_FALLBACK_TRACKS: MusicTrack[] = [
  {
    id: 'wm-gymnopedie-1',
    title: 'Gymnopédie No. 1 (Atelier Tape Transfer)',
    artist: 'Erik Satie · Robin Alciatore',
    artistId: 'wm-artist-satie',
    artistLocation: 'France',
    artistAvatar: ARTWORK_ACOUSTIC,
    artistVerified: true,
    album: 'Open Archival Piano',
    genre: 'Classical',
    country: 'France',
    durationSec: 185,
    audioUrl: proxyStreamUrl(
      'https://upload.wikimedia.org/wikipedia/commons/3/35/Gymnopedie_No_1.ogg',
    ),
    coverUrl: ARTWORK_ACOUSTIC,
    year: '1888',
    license: 'Public Domain · Full Stream',
    sourceLabel: 'Wikimedia Commons',
    isPreview: false,
    bitrateLabel: 'Ogg Vorbis Full',
    storeLinks: buildStoreLinks('Erik Satie', 'Gymnopedie No. 1'),
  },
  {
    id: 'wm-clair-de-lune',
    title: 'Clair de Lune (Suite Bergamasque)',
    artist: 'Claude Debussy · Laurens Goedhart',
    artistId: 'wm-artist-debussy',
    artistLocation: 'France',
    artistAvatar: ARTWORK_AMBIENT,
    artistVerified: true,
    album: 'Nocturnes & Impressionism',
    genre: 'Ambient',
    country: 'France',
    durationSec: 304,
    audioUrl: proxyStreamUrl(
      'https://upload.wikimedia.org/wikipedia/commons/b/be/Clair_de_lune_%28Claude_Debussy%29_Suite_bergamasque.ogg',
    ),
    coverUrl: ARTWORK_AMBIENT,
    year: '1905',
    license: 'CC BY-SA · Full Stream',
    sourceLabel: 'Wikimedia Commons',
    isPreview: false,
    bitrateLabel: 'Ogg Vorbis Full',
    storeLinks: buildStoreLinks('Claude Debussy', 'Clair de Lune'),
  },
  {
    id: 'wm-bach-cello',
    title: 'Cello Suite No. 1 in G Major, Prelude',
    artist: 'J.S. Bach · John Michel',
    artistId: 'wm-artist-bach',
    artistLocation: 'Germany',
    artistAvatar: ARTWORK_JAZZ,
    artistVerified: true,
    album: 'Solo Acoustic Strings',
    genre: 'Acoustic',
    country: 'Germany',
    durationSec: 162,
    audioUrl: proxyStreamUrl(
      'https://upload.wikimedia.org/wikipedia/commons/5/55/Johann_Sebastian_Bach_-_Cello_Suite_No._1_in_G_Major%2C_BWV_1007_-_I._Prelude.ogg',
    ),
    coverUrl: ARTWORK_JAZZ,
    year: '1720',
    license: 'CC BY · Full Stream',
    sourceLabel: 'Wikimedia Commons',
    isPreview: false,
    bitrateLabel: 'Ogg Vorbis Full',
    storeLinks: buildStoreLinks('Johann Sebastian Bach', 'Cello Suite No 1 Prelude'),
  },
  {
    id: 'wm-chopin-nocturne',
    title: 'Nocturne in E-Flat Major, Op. 9 No. 2',
    artist: 'Frédéric Chopin · Frank Levy',
    artistId: 'wm-artist-chopin',
    artistLocation: 'United States',
    artistAvatar: ARTWORK_ELECTRONIC,
    artistVerified: true,
    album: 'Midnight Salon Recordings',
    genre: 'Classical',
    country: 'United States',
    durationSec: 274,
    audioUrl: proxyStreamUrl(
      'https://upload.wikimedia.org/wikipedia/commons/8/82/Chopin_-_Nocturne_in_E-flat_major%2C_Op._9_No._2.ogg',
    ),
    coverUrl: ARTWORK_ELECTRONIC,
    year: '1832',
    license: 'Public Domain · Full Stream',
    sourceLabel: 'Wikimedia Commons',
    isPreview: false,
    bitrateLabel: 'Ogg Vorbis Full',
    storeLinks: buildStoreLinks('Chopin', 'Nocturne Op 9 No 2'),
  },
];

/* ============================================================================
 * Rwanda Music Catalog ("Abahanzi bose bo mu Rwanda n'indirimbo zabo zose")
 * ============================================================================ */
interface RwandaArtistSeed {
  name: string;
  genre: 'Afropop & R&B' | 'Hip-Hop & Kinyatrap' | 'Gakondo & Classics' | 'Gospel & Choirs' | 'DJs & Producers';
  location?: string;
  bio: string;
}

const RWANDA_ARTISTS_SEED: RwandaArtistSeed[] = [
  // Afropop & R&B
  { name: 'Bruce Melodie', genre: 'Afropop & R&B', bio: 'Award-winning Rwandan Afropop & R&B vocalist known for Katerina, Saa Moya, Selebura, and When She Is Around.' },
  { name: 'Meddy', genre: 'Afropop & R&B', bio: 'Contemporary Rwandan R&B and Afropop star behind Slowly, My Vow, Adi Top, and Holy Spirit.' },
  { name: 'The Ben', genre: 'Afropop & R&B', bio: 'Rwandan R&B & Afrobeats pioneer known for Habibi, Fine Girl, Can’t Get Enough, and Why.' },
  { name: 'Knowless Butera', genre: 'Afropop & R&B', bio: 'Kina Music vocalist and Primus Guma Guma Super Star winner behind Baramushaka, Ko Nashize, and Nyigisha.' },
  { name: 'King James', genre: 'Afropop & R&B', bio: 'Veteran Rwandan R&B and Afropop hitmaker behind Yaciye Ibintu, Pala Pala, and Nta Kibazo.' },
  { name: 'Chriss Eazy', genre: 'Afropop & R&B', bio: 'New-wave Kigali Afropop hitmaker behind Inana, Basi Sori, Edeni, and Stop.' },
  { name: 'Juno Kizigenza', genre: 'Afropop & R&B', bio: 'Modern Rwandan Afropop singer-songwriter known for Mpa Formula, Nazubaye, and Please Me.' },
  { name: 'Nel Ngabo', genre: 'Afropop & R&B', bio: 'Kina Music R&B and Afrobeats singer known for Zoli, Muzadukumbura, and Nywe.' },
  { name: 'Kenny Sol', genre: 'Afropop & R&B', bio: 'Rwandan Afropop and R&B vocalist behind Haso, Forget, and Joli.' },
  { name: 'Element Eleéeh', genre: 'Afropop & R&B', bio: 'Chart-topping Rwandan producer & Afropop singer behind Kashe and Fou de Toi.' },
  { name: 'Ariel Wayz', genre: 'Afropop & R&B', bio: 'Nyundo-trained Rwandan R&B & soul singer known for Away, La Vie, and Chamber.' },
  { name: 'Yvan Buravan', genre: 'Afropop & R&B', bio: 'Prix Découvertes RFI laureate celebrated for Malaika, Oya, Twaje, and Si Belle.' },
  { name: 'Christopher Muneza', genre: 'Afropop & R&B', bio: 'Rwandan R&B ballad specialist behind Birahagije, Habona, and Mi Casa.' },
  { name: 'Tom Close', genre: 'Afropop & R&B', bio: 'Pioneer of modern Rwandan Afropop and R&B behind Komeza Utsinde and Ndagukunda.' },
  { name: 'Platini P', genre: 'Afropop & R&B', bio: 'Former Dream Boyz vocalist and solo Afrobeats performer behind Atansiyo and Veronika.' },
  { name: 'Dream Boyz', genre: 'Afropop & R&B', bio: 'Iconic Rwandan Afropop duo (Platini & TMC) behind Magorwa, Uzahahe Uronke, and 70.' },
  { name: 'Urban Boyz', genre: 'Afropop & R&B', bio: 'Pioneering Kigali Afrobeats trio behind Till I Die, Tayali, and Yawe.' },
  { name: 'Safi Madiba', genre: 'Afropop & R&B', bio: 'Former Urban Boyz lead singer known for Got It, Kimwe Kimwe, and Kontwari.' },
  { name: 'Mike Kayihura', genre: 'Afropop & R&B', bio: 'Kigali neo-soul and R&B singer-songwriter behind Any Time, Sabotage, and Tuza.' },
  { name: 'Andy Bumuntu', genre: 'Afropop & R&B', bio: 'Blues, acoustic, and R&B singer known for Mine, Valentine, and On Fire.' },
  { name: 'Bwiza', genre: 'Afropop & R&B', bio: 'KIKAC Music Afropop vocalist known for Available, Ready, and Carry Me.' },
  { name: 'Ross Kana', genre: 'Afropop & R&B', bio: '1:55AM vocalist known for Molela and Sesa.' },
  { name: 'Davis D', genre: 'Afropop & R&B', bio: 'Afrobeats & dancehall performer known for Dede, Biryogo, and Micro.' },
  { name: 'Okkama', genre: 'Afropop & R&B', bio: 'Contemporary Rwandan Afropop singer behind Iyallah and Puculi.' },
  { name: 'Kevin Kade', genre: 'Afropop & R&B', bio: 'Afropop singer-songwriter known for Sofia, Jugumila, and Sikosa.' },
  { name: 'Social Mula', genre: 'Afropop & R&B', bio: 'Rwandan R&B/Afropop vocalist behind Ma Vie, Ku Ndunduro, and Super Star.' },
  { name: 'Mico The Best', genre: 'Afropop & R&B', bio: 'Afrobeats artist behind Igare, Circle, and Akabizu.' },
  { name: 'Victor Rukotana', genre: 'Afropop & R&B', bio: 'R&B and Afropop vocalist known for Promise, Mama Cita, and Sweet Love.' },
  { name: 'Marina Deborah', genre: 'Afropop & R&B', bio: 'Afropop & R&B singer known for Marina, Madede, and Karibu.' },
  { name: 'Queen Cha', genre: 'Afropop & R&B', bio: 'Rwandan Afropop vocalist behind Winner, Umwe Rukumbi, and Gentleman.' },
  { name: 'Charly & Nina', genre: 'Afropop & R&B', bio: 'Hit Rwandan female duo behind Indoro, Face to Face, and Owooma.' },
  { name: 'Alyn Sano', genre: 'Afropop & R&B', bio: 'Soulful multilingual Rwandan vocalist known for For Us, Boo and Bae, and Fake Gee.' },
  { name: 'Uncle Austin', genre: 'Afropop & R&B', bio: 'Radio personality and Afrobeats singer behind Everything, Nzakwizirikaho, and Uteye Ubusambo.' },
  { name: 'Igor Mabano', genre: 'Afropop & R&B', bio: 'Kina Music drummer, producer & singer behind Back, Iyo Utegereza, and Urakunzwe.' },
  { name: 'Papa Cyangwe', genre: 'Afropop & R&B', bio: 'Afropop & street-pop singer known for Kunda Ugukunda and Sana.' },
  { name: 'Niyo Bosco', genre: 'Afropop & R&B', bio: 'Acclaimed guitarist and singer-songwriter behind Ubigenza Ute and Piyapuresha.' },
  { name: 'Active', genre: 'Afropop & R&B', bio: 'Kigali dance-pop trio (Derek, Tizzo, Olivis) known for Lift and Aisha.' },
  { name: 'Kamichi', genre: 'Afropop & R&B', bio: 'Classic Rwandan Afrobeats vocalist behind Zoubeda and Aho Ruzingiye.' },
  { name: 'Kitoko', genre: 'Afropop & R&B', bio: 'Popular Rwandan Afrobeats star behind Akabuto, Urankunda Bikandenga, and Thank You.' },
  { name: 'Rafiki Coga Style', genre: 'Afropop & R&B', bio: 'Founder of Coga Style Rwandan dance music behind Igikosi and Bagambe.' },
  { name: 'Mani Martin', genre: 'Afropop & R&B', bio: 'Afro-soul and Gakondo fusion artist behind Intero y’Amahoro and My Destiny.' },
  { name: 'Eric Senderi', genre: 'Afropop & R&B', bio: 'Energetic Afropop showman known for Jalousie and Nsomyaho.' },
  { name: 'Sintex', genre: 'Afropop & R&B', bio: 'Dancehall & Afropop artist behind Why and Byina.' },
  { name: 'Symphony Band', genre: 'Afropop & R&B', bio: 'Nyundo Music School live band behind Iyo Wanze and Respect.' },
  { name: 'Shaffy', genre: 'Afropop & R&B', bio: 'US-based Rwandan R&B singer known for Akabanga and Worth It.' },
  { name: 'Kaya Byinshi', genre: 'Afropop & R&B', bio: 'Alternative Afro-soul & indie Rwandan vocalist behind Ibyo Byose.' },
  { name: 'Rita Ange Kagaju', genre: 'Afropop & R&B', bio: 'Rwandan indie-pop & soul vocalist behind Sweetener and Forever.' },
  { name: 'Yampano', genre: 'Afropop & R&B', bio: 'Rwandan singer-songwriter known for Mahwi and Nyihanganira.' },
  { name: 'Seyn', genre: 'Afropop & R&B', bio: 'Emerging Kigali Afropop & R&B artist.' },
  { name: 'Ben & Chance', genre: 'Afropop & R&B', bio: 'Rwandan vocal duo known for Amarira and Ndagukunda.' },
  { name: 'Audia Intore', genre: 'Afropop & R&B', bio: 'Traditional-modern Rwandan singer and songwriter.' },

  // Hip-Hop & Kinyatrap
  { name: 'Riderman', genre: 'Hip-Hop & Kinyatrap', bio: 'Founding icon of Rwandan hip-hop (Ibisumizi) behind Rutenderi, Holo, and Cugusa.' },
  { name: 'Ish Kevin', genre: 'Hip-Hop & Kinyatrap', bio: 'Trappish Music leader and Kinyatrap pioneer behind Amakosi, Clout, and No Cap.' },
  { name: 'Kivumbi King', genre: 'Hip-Hop & Kinyatrap', bio: 'Melodic Kinyatrap & Afrobeats lyricist behind Saboter, Masala, and Madame.' },
  { name: 'Bushali', genre: 'Hip-Hop & Kinyatrap', bio: 'Green Ferry Music pioneer of Kinyatrap behind Nituebue and Kugasima.' },
  { name: 'Bull Dogg', genre: 'Hip-Hop & Kinyatrap', bio: 'Tuff Gang old-school hip-hop lyricist behind Cinema and Kaza Roho.' },
  { name: 'Jay Polly', genre: 'Hip-Hop & Kinyatrap', bio: 'Beloved Tuff Gang legend behind Deux Fois Deux, Ndacyariho, and Ku Musenyi.' },
  { name: 'Fireman', genre: 'Hip-Hop & Kinyatrap', bio: 'Tuff Gang rapper known for Ca Inkoni Izamba and Muzadukumbura.' },
  { name: 'Green P', genre: 'Hip-Hop & Kinyatrap', bio: 'Tuff Gang emcee known for Kandagira Abanzi.' },
  { name: 'P Fla', genre: 'Hip-Hop & Kinyatrap', bio: 'Hardcore Kinyarwanda hip-hop storyteller behind Akabanga k’Umukobwa.' },
  { name: 'Diplomat', genre: 'Hip-Hop & Kinyatrap', bio: 'Conscious Rwandan hip-hop lyricist behind Umucakara w’Ibihe and Ideologie.' },
  { name: 'Danny Nanone', genre: 'Hip-Hop & Kinyatrap', bio: 'Rwandan hip-hop and Afrobeats rapper behind Narya and Ikirori.' },
  { name: 'Ama G The Black', genre: 'Hip-Hop & Kinyatrap', bio: 'Street-conscious Rwandan hip-hop artist behind Uruhinja and Careless.' },
  { name: 'Oda Paccy', genre: 'Hip-Hop & Kinyatrap', bio: 'Trailblazing Rwandan female hip-hop pioneer behind Miss President and Rendezvous.' },
  { name: 'Young Grace', genre: 'Hip-Hop & Kinyatrap', bio: 'Rwandan female rapper known for Bingo and Ataha He.' },
  { name: 'Ciney', genre: 'Hip-Hop & Kinyatrap', bio: 'Female Rwandan hip-hop & Afropop artist behind Nkunda and Tuma Bavuga.' },
  { name: 'Logan Joe', genre: 'Hip-Hop & Kinyatrap', bio: 'Melodic Kigali drill & trap artist behind Whatever and Nyaranja.' },
  { name: 'Kenny K-Shot', genre: 'Hip-Hop & Kinyatrap', bio: 'Kigali drill & rap lyricist behind Intashyo and Trap Star.' },
  { name: 'Zeo Trap', genre: 'Hip-Hop & Kinyatrap', bio: 'Emerging Kigali Kinyatrap & drill artist behind Sinabikora.' },
  { name: 'B-Threy', genre: 'Hip-Hop & Kinyatrap', bio: 'Kinyatrap co-creator behind Nicyo Gituma and 2040.' },
  { name: 'Slum Drip', genre: 'Hip-Hop & Kinyatrap', bio: 'Kinyatrap rapper and Green Ferry collaborator.' },
  { name: 'Mukadaff', genre: 'Hip-Hop & Kinyatrap', bio: 'Street hip-hop & trap artist from Kigali.' },
  { name: 'Ririmba', genre: 'Hip-Hop & Kinyatrap', bio: 'Trappish Music artist featured on Amina and Twari Broke.' },
  { name: 'Og2tone', genre: 'Hip-Hop & Kinyatrap', bio: 'Rwandan trap & drill vocalist.' },
  { name: 'Neg G The General', genre: 'Hip-Hop & Kinyatrap', bio: 'Early Kigali hip-hop pioneer and UTP Soldiers founder.' },
  { name: 'Tuff Gang', genre: 'Hip-Hop & Kinyatrap', bio: 'Legendary Kigali hip-hop crew uniting Jay Polly, Bull Dogg, Fireman, and Green P.' },

  // Gakondo & Classics
  { name: 'Cécile Kayirebwa', genre: 'Gakondo & Classics', bio: 'Queen of Rwandan Gakondo music behind Umunezero, Tarihinda, Ikizungerezi, and None Twaza.' },
  { name: 'Kamaliza', genre: 'Gakondo & Classics', bio: 'Revered Rwandan cultural heroine and singer behind Humura Rwanda and Naraye Ndose.' },
  { name: 'Rugamba Cyprien', genre: 'Gakondo & Classics', bio: 'Legendary Rwandan poet, composer, and Amasimbi n’Amakombe founder.' },
  { name: 'Masamba Intore', genre: 'Gakondo & Classics', bio: 'Master of traditional Rwandan Gakondo & Inanga rhythms.' },
  { name: 'Jules Sentore', genre: 'Gakondo & Classics', bio: 'Contemporary Gakondo vocalist blending Intore rhythms with modern acoustic strings.' },
  { name: 'Clarisse Karasira', genre: 'Gakondo & Classics', bio: 'Rwandan folk and Gakondo songwriter behind Ntizagushuke and Twapfaga Iki.' },
  { name: 'Ruti Joel', genre: 'Gakondo & Classics', bio: 'Modern Gakondo & Afro-traditional singer behind Igikobwa and Cunda.' },
  { name: 'Jean-Paul Samputu', genre: 'Gakondo & Classics', bio: 'Kora Award-winning Rwandan singer and cultural ambassador.' },
  { name: 'Orchestre Impala', genre: 'Gakondo & Classics', bio: 'Historic Rwandan rumba & Karahanyuze band behind Anita, Bonane, and Mbega Urukundo.' },
  { name: 'Orchestre Nyampinga', genre: 'Gakondo & Classics', bio: 'Classic Karahanyuze guitar band from Rwanda’s golden era.' },
  { name: 'Sebatta', genre: 'Gakondo & Classics', bio: 'Master of Karahanyuze storytelling ballads and acoustic guitar.' },
  { name: 'Jean-Baptiste Byumvuhore', genre: 'Gakondo & Classics', bio: 'Beloved acoustic storyteller behind Fagitare and Umbabarire Mawe.' },
  { name: 'Muyango', genre: 'Gakondo & Classics', bio: 'Gakondo elder behind Sabizeze and Karame Nanone.' },
  { name: 'Teta Diana', genre: 'Gakondo & Classics', bio: 'Rwandan acoustic & Gakondo singer-songwriter behind Canga Ikarita and Kata.' },
  { name: 'Cyusa Ibrahim', genre: 'Gakondo & Classics', bio: 'Traditional Gakondo performer known for Muhoza Wanjye and Marebe.' },
  { name: 'The Good Ones', genre: 'Gakondo & Classics', bio: 'Internationally acclaimed Rwandan acoustic trio recorded across Kigali and rural Rwanda.' },
  { name: 'Mighty Popo', genre: 'Gakondo & Classics', bio: 'Juno Award-winning Rwandan-Canadian roots musician and Nyundo Music School director.' },
  { name: 'Faustin Murigo', genre: 'Gakondo & Classics', bio: 'Legendary Rwandan Karahanyuze vocalist and guitarist.' },
  { name: 'Jean-Bosco Hashakimana', genre: 'Gakondo & Classics', bio: 'Classic Rwandan acoustic guitarist and singer.' },

  // Gospel & Choirs
  { name: 'Israel Mbonyi', genre: 'Gospel & Choirs', bio: 'East Africa’s leading gospel worship minister behind Nina Siri, Karame, Ndashima, and Hari Ubuzima.' },
  { name: 'Ambassadors of Christ Choir', genre: 'Gospel & Choirs', bio: 'Iconic Kigali gospel choir known across Africa for Kwetu Pazuri and Mtegemee Yesu.' },
  { name: 'Chorale de Kigali', genre: 'Gospel & Choirs', bio: 'Historic Rwandan polyphonic Catholic & classical choir founded in 1966.' },
  { name: 'James & Daniella', genre: 'Gospel & Choirs', bio: 'Rwandan gospel worship duo behind Mpa Amavuta and Nkoresha.' },
  { name: 'Patient Bizimana', genre: 'Gospel & Choirs', bio: 'Worship leader behind Ubwo Buntu, Menye Neza, and Ikimenyetso.' },
  { name: 'Aime Uwimana', genre: 'Gospel & Choirs', bio: 'Veteran Rwandan gospel composer behind Muririmbire Uwiteka and Thank You.' },
  { name: 'Dominic Ashimwe', genre: 'Gospel & Choirs', bio: 'Rwandan gospel minister behind Ashimwe and Wambereye Imfura.' },
  { name: 'Theo Bosebabireba', genre: 'Gospel & Choirs', bio: 'Iconic Rwandan gospel singer behind Ibigeragezo si Iherezo and Kubita Utababarira.' },
  { name: 'Adrien Misigaro', genre: 'Gospel & Choirs', bio: 'Gospel singer-songwriter known for Ntacyo Nzaba and Nkwite Nde.' },
  { name: 'Gentil Misigaro', genre: 'Gospel & Choirs', bio: 'Gospel worship producer & vocalist behind Biratungana and Buri Munsi.' },
  { name: 'Aline Gahongayire', genre: 'Gospel & Choirs', bio: 'Veteran Rwandan gospel artist behind Ndanyuzwe and Hari Impamvu.' },
  { name: 'Gaby Kamanzi', genre: 'Gospel & Choirs', bio: 'Gospel singer celebrated for Amahoro and Arankunda.' },
  { name: 'Tonzi', genre: 'Gospel & Choirs', bio: 'Rwandan gospel vocalist known for Humura and Sijja.' },
  { name: 'Serge Iyamuremye', genre: 'Gospel & Choirs', bio: 'Contemporary gospel worship artist behind Arampagije and Nta MVura.' },
  { name: 'Papi Clever & Dorcas', genre: 'Gospel & Choirs', bio: 'Rwandan gospel hymn duo known for Ndagushima and Amakuru y’Ijuru.' },
  { name: 'Vestine & Dorcas', genre: 'Gospel & Choirs', bio: 'Rwandan sister gospel duo behind Nahawe Ijambo, Adonai, and Papa.' },
  { name: 'Chryso Ndasingwa', genre: 'Gospel & Choirs', bio: 'Contemporary gospel worship leader behind Wahozeho and Byose.' },
  { name: 'Josh Ishimwe', genre: 'Gospel & Choirs', bio: 'Gakondo-infused gospel worship singer behind Reka Ndate Imana.' },
  { name: 'Alarm Ministries', genre: 'Gospel & Choirs', bio: 'Acclaimed Kigali worship choir behind Hariho Impamvu and Songa Mbele.' },
  { name: 'Healing Worship Team', genre: 'Gospel & Choirs', bio: 'Rwandan praise & worship team behind Nguwe Neza and Mana Imbaraga.' },
  { name: 'Bosco Nshuti', genre: 'Gospel & Choirs', bio: 'Rwandan worship minister behind Ibyo Ntunze and Utuma Ntera Intambwe.' },
  { name: 'Alex Dusabe', genre: 'Gospel & Choirs', bio: 'Rwandan gospel worship pioneer behind Umuyoboro.' },
  { name: 'Simon Kabera', genre: 'Gospel & Choirs', bio: 'Beloved Rwandan gospel singer behind Mfashe Inanga.' },

  // DJs & Producers
  { name: 'DJ Pius', genre: 'DJs & Producers', bio: '1Key Entertainment DJ & Afropop artist behind Agatako, Play It Again, and Homba Homboka.' },
  { name: 'DJ Marnaud', genre: 'DJs & Producers', bio: 'Kigali club DJ & producer behind Bape, Ribuyu, and Baho.' },
  { name: 'DJ Toxxyk', genre: 'DJs & Producers', bio: 'Kigali electronic, Afro-house & open-format DJ and producer.' },
  { name: 'DJ Phil Peter', genre: 'DJs & Producers', bio: 'Radio presenter, DJ & collaborator on Bimpame, Agafoto, and Terimber.' },
  { name: 'DJ Miller', genre: 'DJs & Producers', bio: 'Beloved Kigali DJ & producer celebrated for Stamina and Belle.' },
  { name: 'DJ Brianne', genre: 'DJs & Producers', bio: 'Trailblazing Kigali club & festival DJ.' },
  { name: 'Dany Beats', genre: 'DJs & Producers', bio: 'Rwandan beatmaker and executive producer behind Kigali Trap & Afropop hits.' },
  { name: 'Madebeats', genre: 'DJs & Producers', bio: 'Multi-award-winning Rwandan music producer.' },
  { name: 'Bob Pro', genre: 'DJs & Producers', bio: 'Master mixing & mastering engineer in Kigali.' },
  { name: 'Prince Kiiiz', genre: 'DJs & Producers', bio: 'Hit Rwandan Afropop & Afrobeats record producer.' },
  { name: 'Pastor P', genre: 'DJs & Producers', bio: 'Iconic Kigali music producer shaping modern Rwandan pop and Gakondo fusion.' },
];

const GENRE_COVER_MAP: Record<string, string> = {
  'Afropop & R&B': ARTWORK_ELECTRONIC,
  'Hip-Hop & Kinyatrap': ARTWORK_JAZZ,
  'Gakondo & Classics': ARTWORK_ACOUSTIC,
  'Gospel & Choirs': ARTWORK_AMBIENT,
  'DJs & Producers': ARTWORK_ELECTRONIC,
};

function makeRwandaArtistId(name: string): string {
  return `rw-artist-${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

let cachedMbRwandaArtists: { timestamp: number; artists: ArtistSummary[] } | null = null;
async function fetchMusicBrainzRwandaArtists(): Promise<ArtistSummary[]> {
  if (cachedMbRwandaArtists && Date.now() - cachedMbRwandaArtists.timestamp < 1000 * 60 * 30) {
    return cachedMbRwandaArtists.artists;
  }
  const mb = await fetchJsonWithTimeout<{
    artists?: Array<{ id: string; name: string; disambiguation?: string; tags?: Array<{ name: string }> }>;
  }>('https://musicbrainz.org/ws/2/artist?query=area:Rwanda&limit=100&offset=0&fmt=json', 4500);
  if (!mb?.artists) return cachedMbRwandaArtists?.artists || [];

  const list: ArtistSummary[] = mb.artists
    .filter((a) => a.name && a.name.trim().length > 1)
    .map((a) => ({
      id: makeRwandaArtistId(a.name),
      name: a.name.trim(),
      location: 'Rwanda',
      avatarUrl: ARTWORK_ACOUSTIC,
      verified: true,
      genre: a.tags?.[0]?.name || 'Rwanda Music',
      bio: a.disambiguation || 'Documented Rwandan recording artist.',
      sourceLabel: 'MusicBrainz Rwanda',
      topTracks: [],
    }));
  cachedMbRwandaArtists = { timestamp: Date.now(), artists: list };
  return list;
}

async function getRwandaArtistsCatalog(): Promise<ArtistSummary[]> {
  const map = new Map<string, ArtistSummary>();
  for (const seed of RWANDA_ARTISTS_SEED) {
    const id = makeRwandaArtistId(seed.name);
    map.set(seed.name.toLowerCase(), {
      id,
      name: seed.name,
      location: seed.location || 'Kigali, Rwanda',
      avatarUrl: GENRE_COVER_MAP[seed.genre] || ARTWORK_ELECTRONIC,
      verified: true,
      genre: seed.genre,
      bio: seed.bio,
      sourceLabel: 'Rwanda Music Index',
      topTracks: [],
    });
  }

  // Merge extra documented Rwandan artists from MusicBrainz live registry
  const mbArtists = await fetchMusicBrainzRwandaArtists().catch(() => []);
  for (const mba of mbArtists) {
    const key = mba.name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, mba);
    }
  }
  return Array.from(map.values());
}

function parseDurationText(text?: string): number {
  if (!text) return 0;
  const parts = text
    .trim()
    .split(':')
    .map((n) => Number(n));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

interface YouTubeExtractedVideo {
  id: string;
  title: string;
  durationSec: number;
  channel: string;
  channelId?: string;
  thumbnail: string;
}

const ytSearchCache = new Map<string, { ts: number; data: YouTubeExtractedVideo[] }>();

async function fetchYouTubeSearchRaw(query: string): Promise<YouTubeExtractedVideo[]> {
  const cacheKey = query.trim().toLowerCase();
  const hit = ytSearchCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < 10 * 60 * 1000 && hit.data.length > 0) {
    return hit.data;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const match =
      html.match(/var ytInitialData = (\{.+?\});<\/script>/) ||
      html.match(/window\["ytInitialData"\] = (\{.+?\});/);
    if (!match) return [];
    const data = JSON.parse(match[1]) as {
      contents?: {
        twoColumnSearchResultsRenderer?: {
          primaryContents?: {
            sectionListRenderer?: {
              contents?: Array<{
                itemSectionRenderer?: {
                  contents?: Array<{
                    videoRenderer?: Record<string, unknown>;
                    shelfRenderer?: {
                      content?: {
                        verticalListRenderer?: {
                          items?: Array<{ videoRenderer?: Record<string, unknown> }>;
                        };
                      };
                    };
                  }>;
                };
              }>;
            };
          };
        };
      };
    };

    const sections =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents || [];

    const renderers: Array<Record<string, unknown>> = [];
    for (const sec of sections) {
      const items = sec.itemSectionRenderer?.contents || [];
      for (const item of items) {
        if (item.videoRenderer) renderers.push(item.videoRenderer);
        if (item.shelfRenderer?.content?.verticalListRenderer?.items) {
          for (const sub of item.shelfRenderer.content.verticalListRenderer.items) {
            if (sub.videoRenderer) renderers.push(sub.videoRenderer);
          }
        }
      }
    }

    const videos: YouTubeExtractedVideo[] = [];
    for (const v of renderers) {
      const videoId = typeof v.videoId === 'string' ? v.videoId : '';
      if (!videoId) continue;
      const titleRuns = (v.title as { runs?: Array<{ text?: string }> } | undefined)?.runs || [];
      const title = titleRuns.map((r) => r.text || '').join('').trim();
      if (!title) continue;

      const lenText = (v.lengthText as { simpleText?: string } | undefined)?.simpleText;
      const durationSec = parseDurationText(lenText);
      const ownerRun = (
        v.ownerText as {
          runs?: Array<{
            text?: string;
            navigationEndpoint?: { browseEndpoint?: { browseId?: string } };
          }>;
        } | undefined
      )?.runs?.[0];
      const channel = ownerRun?.text || 'YouTube Music';
      const channelId = ownerRun?.navigationEndpoint?.browseEndpoint?.browseId;
      const thumbs = (v.thumbnail as { thumbnails?: Array<{ url?: string }> } | undefined)
        ?.thumbnails;
      const thumbnail =
        thumbs?.[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      videos.push({ id: videoId, title, durationSec, channel, channelId, thumbnail });
    }
    if (videos.length > 0) {
      ytSearchCache.set(cacheKey, { ts: Date.now(), data: videos });
    }
    return videos;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYouTubeChannelRssTracks(
  channelId: string,
  artistName: string,
  country = 'Rwanda',
): Promise<MusicTrack[]> {
  if (!channelId) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
      { signal: controller.signal },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
    const tracks: MusicTrack[] = [];
    for (const entry of entries) {
      const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>([^<]+)<\/title>/)?.[1];
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
      if (!videoId || !title) continue;
      if (/#shorts|teaser|trailer|behind the scenes|interview|reaction/i.test(title)) continue;
      tracks.push({
        id: `yt-${videoId}`,
        title: title
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'"),
        artist: artistName,
        artistId: country === 'Rwanda' ? makeRwandaArtistId(artistName) : undefined,
        artistLocation: country === 'Rwanda' ? 'Kigali, Rwanda' : country,
        artistVerified: true,
        album: 'Official Release',
        genre: 'Afropop',
        country,
        durationSec: 215,
        audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
        youtubeVideoId: videoId,
        coverUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        year: published ? published.slice(0, 4) : '2025',
        license: 'Full Song',
        sourceLabel: 'YouTube Music',
        isPreview: false,
        bitrateLabel: 'Full Stream',
        storeLinks: buildStoreLinks(artistName, title),
      });
    }
    return tracks;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function searchYouTubeFullTracks(
  query: string,
  artistHint?: string,
  country = 'Global',
  limit = 24,
): Promise<{ tracks: MusicTrack[]; topChannelId?: string }> {
  const raw = await fetchYouTubeSearchRaw(query);
  const artistLow = artistHint?.toLowerCase().trim() || '';
  const channelCounts = new Map<string, number>();

  const tracks: MusicTrack[] = [];
  for (const v of raw) {
    // Must be a full individual song: >= 45s and <= 22 min (excludes Shorts & multi-hour DJ mixes)
    if (v.durationSec < 45 || v.durationSec > 1320) continue;
    if (/#shorts|interview|podcast|reaction|prank|top \d+ songs mix|nonstop mix|2 hours|1 hour/i.test(v.title)) {
      continue;
    }

    if (v.channelId && artistLow && v.channel.toLowerCase().includes(artistLow.split(' ')[0])) {
      channelCounts.set(v.channelId, (channelCounts.get(v.channelId) || 0) + 1);
    }

    const displayArtist = artistHint || v.channel.replace(/ - Topic$/i, '').trim();
    tracks.push({
      id: `yt-${v.id}`,
      title: v.title,
      artist: displayArtist,
      artistId: artistHint ? makeRwandaArtistId(artistHint) : undefined,
      artistLocation: country === 'Rwanda' ? 'Kigali, Rwanda' : country,
      artistVerified: Boolean(
        artistLow && v.channel.toLowerCase().includes(artistLow.split(' ')[0]),
      ),
      album: v.channel.replace(/ - Topic$/i, '').trim(),
      genre: country === 'Rwanda' ? 'Rwanda Music' : 'World',
      country,
      durationSec: v.durationSec,
      audioUrl: `https://www.youtube.com/watch?v=${v.id}`,
      youtubeVideoId: v.id,
      coverUrl: v.thumbnail.startsWith('http')
        ? v.thumbnail
        : `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      year: '2025',
      license: 'Full Song',
      sourceLabel: 'YouTube Music',
      isPreview: false,
      bitrateLabel: 'Full Stream',
      storeLinks: buildStoreLinks(displayArtist, v.title),
    });
  }

  let topChannelId: string | undefined;
  let bestCount = 0;
  for (const [cid, cnt] of channelCounts.entries()) {
    if (cnt > bestCount) {
      bestCount = cnt;
      topChannelId = cid;
    }
  }

  return { tracks: tracks.slice(0, limit), topChannelId };
}

const artistCatalogCache = new Map<string, { timestamp: number; tracks: MusicTrack[] }>();
async function fetchFullArtistSongCatalog(
  artistName: string,
  songQuery = '',
  countryHint = 'Global',
): Promise<MusicTrack[]> {
  const cacheKey = `${artistName.toLowerCase()}::${songQuery.toLowerCase()}::${countryHint}`;
  const cached = artistCatalogCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 10) {
    return cached.tracks;
  }

  const isRwandaArtist =
    countryHint === 'Rwanda' ||
    RWANDA_ARTISTS_SEED.some((a) => a.name.toLowerCase() === artistName.toLowerCase());
  const effectiveCountry = isRwandaArtist ? 'Rwanda' : countryHint;

  const q1 = songQuery
    ? `${artistName} ${songQuery} official audio`
    : `${artistName} official audio`;
  const q2 = songQuery
    ? `${artistName} ${songQuery} lyrics`
    : `${artistName} official video ${effectiveCountry === 'Rwanda' ? 'Rwanda' : ''}`.trim();
  const q3 = songQuery ? `${artistName} ${songQuery}` : `${artistName} full songs`;

  const [audiusTracks, archiveTracks, yt1, yt2, yt3] = await Promise.all([
    searchAudiusTracks(songQuery ? `${artistName} ${songQuery}` : artistName, 12),
    searchInternetArchiveTracks(songQuery ? `${artistName} ${songQuery}` : artistName, 4),
    searchYouTubeFullTracks(q1, artistName, effectiveCountry, 24),
    searchYouTubeFullTracks(q2, artistName, effectiveCountry, 24),
    searchYouTubeFullTracks(q3, artistName, effectiveCountry, 20),
  ]);

  const detectedChannelId = yt1.topChannelId || yt2.topChannelId || yt3.topChannelId;
  const rssTracks = detectedChannelId
    ? await fetchYouTubeChannelRssTracks(detectedChannelId, artistName, effectiveCountry)
    : [];

  const localTracks = RESILIENT_FALLBACK_TRACKS.filter((t) =>
    t.artist.toLowerCase().includes(artistName.toLowerCase()),
  );

  // Merge, deduplicate by track ID and normalized title, and prioritize matching official tracks
  const dedup = new Map<string, MusicTrack>();
  const seenTitles = new Set<string>();
  const artistFirstToken = artistName.toLowerCase().split(/\s+/)[0];

  const allCandidates = [
    ...localTracks,
    ...audiusTracks.filter((t) => t.artist.toLowerCase().includes(artistFirstToken)),
    ...yt1.tracks,
    ...rssTracks,
    ...yt2.tracks,
    ...yt3.tracks,
    ...archiveTracks,
  ];

  for (const t of allCandidates) {
    if (t.isPreview || dedup.has(t.id)) continue;
    const normTitle = t.title
      .toLowerCase()
      .replace(/\(official[^)]*\)|\[official[^\]]*\]|\(lyrics[^)]*\)|\(audio\)/gi, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (normTitle.length > 3 && seenTitles.has(normTitle)) continue;
    if (songQuery && !t.title.toLowerCase().includes(songQuery.toLowerCase())) {
      // Allow fuzzy matches only after exact/partial matches
    }
    seenTitles.add(normTitle);
    dedup.set(t.id, t);
  }

  let results = Array.from(dedup.values());
  if (songQuery.trim()) {
    const sq = songQuery.trim().toLowerCase();
    const matched = results.filter((t) => t.title.toLowerCase().includes(sq));
    if (matched.length > 0) results = matched;
  }

  artistCatalogCache.set(cacheKey, { timestamp: Date.now(), tracks: results.slice(0, 60) });
  return results.slice(0, 60);
}

let cachedRwandaTrending: { timestamp: number; tracks: MusicTrack[] } | null = null;
async function getRwandaTrendingShowcase(): Promise<MusicTrack[]> {
  if (cachedRwandaTrending && Date.now() - cachedRwandaTrending.timestamp < 1000 * 60 * 15) {
    return cachedRwandaTrending.tracks;
  }
  const featuredNames = [
    'Bruce Melodie',
    'Meddy',
    'Israel Mbonyi',
    'Chriss Eazy',
    'The Ben',
    'Kivumbi King',
    'Ariel Wayz',
    'Nel Ngabo',
    'Cécile Kayirebwa',
    'Ish Kevin',
  ];
  const batches = await Promise.all(
    featuredNames.map((n) => searchYouTubeFullTracks(`${n} official audio`, n, 'Rwanda', 3)),
  );
  const picked: MusicTrack[] = [];
  const seen = new Set<string>();
  for (const b of batches) {
    for (const t of b.tracks.slice(0, 2)) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        picked.push(t);
      }
    }
  }
  cachedRwandaTrending = { timestamp: Date.now(), tracks: picked };
  return picked;
}

let cachedDiscover: { timestamp: number; data: DiscoverCatalog } | null = null;
const DISCOVER_TTL_MS = 1000 * 60 * 8;

async function buildDiscoverCatalog(forceRefresh = false): Promise<DiscoverCatalog> {
  if (!forceRefresh && cachedDiscover && Date.now() - cachedDiscover.timestamp < DISCOVER_TTL_MS) {
    return cachedDiscover.data;
  }

  const [
    trendingRes,
    electronicRes,
    ambientRes,
    jazzRes,
    acousticRes,
    hipHopRes,
    soulRes,
    globalRadioStations,
    rwandaRadioStations,
    afrobeatsFull,
    rwandaShowcase,
    rwandaArtists,
  ] = await Promise.all([
    fetchAudiusTrending(undefined, 24),
    fetchAudiusTrending('Electronic', 10),
    fetchAudiusTrending('Ambient', 10),
    searchAudiusTracks('jazz saxophone trio', 10),
    searchAudiusTracks('acoustic guitar indie', 10),
    fetchAudiusTrending('Hip-Hop/Rap', 10),
    fetchAudiusTrending('R&B/Soul', 10),
    fetchRadioStations(undefined, undefined, 12),
    fetchRadioStations('Rwanda', undefined, 6),
    searchAudiusTracks('afrobeats amapiano kigali', 12),
    getRwandaTrendingShowcase().catch(() => []),
    getRwandaArtistsCatalog().catch(() => []),
  ]);

  const radioDedup = new Map<string, MusicTrack>();
  for (const st of [...rwandaRadioStations, ...globalRadioStations]) {
    if (!radioDedup.has(st.id)) radioDedup.set(st.id, st);
  }
  const radioStations = Array.from(radioDedup.values()).slice(0, 16);

  const trendingDedup = new Map<string, MusicTrack>();
  for (const t of [
    ...trendingRes.tracks,
    ...rwandaShowcase.slice(0, 8),
    ...afrobeatsFull.slice(0, 6),
    ...RESILIENT_FALLBACK_TRACKS,
  ]) {
    if (!trendingDedup.has(t.id)) trendingDedup.set(t.id, t);
  }
  const trendingTracks = Array.from(trendingDedup.values()).slice(0, 28);

  const curatedPlaylists: CuratedPlaylist[] = [
    {
      id: 'curated-electronic-night',
      title: 'Electronic & Modular Sessions',
      subtitle: 'Full-length hardware synth sets, deep house cuts, and club transmissions.',
      genre: 'Electronic',
      coverUrl: ARTWORK_ELECTRONIC,
      tracks:
        electronicRes.tracks.length > 0
          ? electronicRes.tracks
          : trendingTracks.slice(0, 6),
    },
    {
      id: 'curated-rwanda-east-africa',
      title: 'Rwanda & East Africa Pulse',
      subtitle: 'Kigali Afropop, Gakondo heritage, and East African chart hits ready for instant playback.',
      genre: 'Afropop & Gakondo',
      coverUrl: ARTWORK_ACOUSTIC,
      tracks:
        rwandaShowcase.length > 0
          ? rwandaShowcase
          : afrobeatsFull.length > 0
            ? afrobeatsFull
            : trendingTracks.slice(0, 6),
    },
    {
      id: 'curated-afrobeats-amapiano',
      title: 'Afrobeats & Amapiano Grooves',
      subtitle: 'Sunlit percussion, log-drum basslines, and contemporary African club rhythms.',
      genre: 'Afrobeats',
      coverUrl: ARTWORK_ELECTRONIC,
      tracks:
        afrobeatsFull.length > 0
          ? afrobeatsFull
          : trendingTracks.slice(0, 6),
    },
    {
      id: 'curated-hiphop-kinyatrap',
      title: 'Hip-Hop & Studio Ciphers',
      subtitle: 'Full-length rap cuts, nocturnal 808 instrumentals, and independent lyricists.',
      genre: 'Hip-Hop',
      coverUrl: ARTWORK_JAZZ,
      tracks:
        hipHopRes.tracks.length > 0
          ? hipHopRes.tracks
          : trendingTracks.slice(0, 6),
    },
    {
      id: 'curated-soul-rnb',
      title: 'Soul, R&B & Late-Night Vocals',
      subtitle: 'Silky vocal arrangements, electric keys, and slow-burning neo-soul grooves.',
      genre: 'R&B / Soul',
      coverUrl: ARTWORK_AMBIENT,
      tracks:
        soulRes.tracks.length > 0
          ? soulRes.tracks
          : trendingTracks.slice(0, 6),
    },
    {
      id: 'curated-acoustic-warmth',
      title: 'Acoustic & Tape Warmth',
      subtitle: 'Full-length fingerstyle guitars, close-mic strings, and analog folk sessions.',
      genre: 'Acoustic',
      coverUrl: ARTWORK_ACOUSTIC,
      tracks:
        acousticRes.length > 0
          ? acousticRes
          : [RESILIENT_FALLBACK_TRACKS[0], RESILIENT_FALLBACK_TRACKS[2]],
    },
    {
      id: 'curated-jazz-midnight',
      title: 'Midnight Jazz & Brass',
      subtitle: 'Full-length tenor saxophones, upright bass grooves, and late-night quartets.',
      genre: 'Jazz',
      coverUrl: ARTWORK_JAZZ,
      tracks:
        jazzRes.length > 0
          ? jazzRes
          : [RESILIENT_FALLBACK_TRACKS[2], RESILIENT_FALLBACK_TRACKS[3]],
    },
    {
      id: 'curated-ambient-horizon',
      title: 'Nordic Ambient Horizon',
      subtitle: 'Full-length atmospheric soundscapes, felt piano, and meditative coastal drones.',
      genre: 'Ambient',
      coverUrl: ARTWORK_AMBIENT,
      tracks:
        ambientRes.tracks.length > 0
          ? ambientRes.tracks
          : [RESILIENT_FALLBACK_TRACKS[1], RESILIENT_FALLBACK_TRACKS[3]],
    },
  ];

  // Build featured artists from trending + curated full-length tracks + Rwanda verified artists
  const artistMap = new Map<string, ArtistSummary>();
  for (const t of [
    ...trendingTracks,
    ...electronicRes.tracks,
    ...jazzRes,
    ...afrobeatsFull,
    ...hipHopRes.tracks,
    ...soulRes.tracks,
  ]) {
    const key = t.artistId || t.artist;
    if (!artistMap.has(key)) {
      artistMap.set(key, {
        id: key,
        name: t.artist,
        handle: t.artistHandle,
        location: t.artistLocation || t.country || 'Global',
        avatarUrl: t.artistAvatar || t.coverUrl,
        verified: Boolean(t.artistVerified),
        sourceLabel: t.sourceLabel,
        topTracks: [t],
      });
    } else {
      const existing = artistMap.get(key)!;
      if (existing.topTracks.length < 4 && !existing.topTracks.some((x) => x.id === t.id)) {
        existing.topTracks.push(t);
      }
    }
  }
  for (const rw of rwandaArtists.slice(0, 6)) {
    if (!artistMap.has(rw.id)) {
      artistMap.set(rw.id, rw);
    }
  }

  const catalog: DiscoverCatalog = {
    featuredTitle: 'Global Listening Room',
    featuredSubtitle:
      'Full-length independent streams, Rwanda & world artists, live international radio relays, 5-band parametric EQ, and direct-to-artist storefronts.',
    heroImageUrl: HERO_LISTENING_ROOM,
    curatedPlaylists,
    spotifyPlaylists: SPOTIFY_PLAYLISTS,
    trendingTracks,
    liveStations: radioStations,
    featuredArtists: Array.from(artistMap.values()).slice(0, 16),
    countries: COUNTRIES,
    platforms: PLATFORMS,
    genres: GENRES,
    musicStores: MUSIC_STORES,
  };

  cachedDiscover = { timestamp: Date.now(), data: catalog };
  return catalog;
}

const app = express();
app.use(express.json({ limit: '50mb' }));

// Serve generated cover artwork cleanly in both dev & production
app.use('/src/assets/images', express.static(path.resolve(__dirname, 'src/assets/images')));

// Public non-secret runtime configuration (Google Maps GHP / client key)
app.get('/api/config/public', (_req: Request, res: Response) => {
  const mapsApiKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.MAPS_API_KEY ||
    '';
  res.json({ mapsApiKey });
});

// Mount Server-side Gemini AI Studio & Grounding Routes
registerGeminiRoutes(app);

// Cloud SQL Persistence Endpoints (Firebase Admin Bearer Protected)
app.post('/api/sql/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || `${uid}@soundmark.local`;
    const displayName =
      (typeof req.body?.displayName === 'string' && req.body.displayName.trim()) ||
      req.user!.name ||
      null;
    const photoUrl =
      (typeof req.body?.photoUrl === 'string' && req.body.photoUrl.trim()) ||
      req.user!.picture ||
      null;
    const user = await getOrCreateUser(uid, email, displayName, photoUrl);
    res.json({ user: { id: user.id, displayName: user.displayName, photoUrl: user.photoUrl } });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Profile sync failed.' });
  }
});

app.get('/api/sql/creations', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const creations = await getStudioCreationsByUid(req.user!.uid);
    res.json({ creations });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load creations.' });
  }
});

app.post('/api/sql/creations', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { kind, title, prompt, model, mediaUrl, metadataJson } = req.body || {};
    if (!kind || !title || !prompt || !model) {
      return res.status(400).json({ error: 'Missing creation fields.' });
    }
    const created = await saveStudioCreationForUid(
      req.user!.uid,
      req.user!.email || `${req.user!.uid}@soundmark.local`,
      {
        kind: String(kind).slice(0, 32),
        title: String(title).slice(0, 120),
        prompt: String(prompt).slice(0, 1000),
        model: String(model).slice(0, 64),
        mediaUrl: typeof mediaUrl === 'string' && mediaUrl.length <= 2500000 ? mediaUrl : null,
        metadataJson: typeof metadataJson === 'string' ? metadataJson.slice(0, 8000) : null,
      },
      req.user!.name || null,
      req.user!.picture || null,
    );
    res.status(201).json({ creation: created });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save creation.' });
  }
});

app.delete('/api/sql/creations/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid creation ID.' });
    }
    const deleted = await deleteStudioCreationForUid(req.user!.uid, id);
    res.json({ deleted });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Delete failed.' });
  }
});

app.get('/api/sql/venues', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const venues = await getSavedVenuesByUid(req.user!.uid);
    res.json({ venues });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load venues.' });
  }
});

app.post('/api/sql/venues', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { placeId, name, address, category, lat, lng } = req.body || {};
    if (!placeId || !name || !address || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Missing venue coordinates or identity.' });
    }
    const venue = await saveVenueForUid(
      req.user!.uid,
      req.user!.email || `${req.user!.uid}@soundmark.local`,
      {
        placeId: String(placeId).slice(0, 200),
        name: String(name).slice(0, 140),
        address: String(address).slice(0, 260),
        category: String(category || 'Venue').slice(0, 60),
        lat: String(lat).slice(0, 32),
        lng: String(lng).slice(0, 32),
      },
      req.user!.name || null,
      req.user!.picture || null,
    );
    res.status(201).json({ venue });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save venue.' });
  }
});

app.delete('/api/sql/venues/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid venue ID.' });
    }
    const deleted = await deleteSavedVenueForUid(req.user!.uid, id);
    res.json({ deleted });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Delete failed.' });
  }
});

app.get('/api/sql/leaderboard', async (_req: Request, res: Response) => {
  try {
    const scores = await getLeaderboard(20);
    res.json({ scores });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load leaderboard.' });
  }
});

app.post('/api/sql/leaderboard', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { playerName, score, maxCombo, accuracy, difficulty } = req.body || {};
    const numScore = Math.max(0, Math.min(10000000, Math.round(Number(score) || 0)));
    const numCombo = Math.max(0, Math.min(10000, Math.round(Number(maxCombo) || 0)));
    const numAcc = Math.max(0, Math.min(100, Math.round(Number(accuracy) || 0)));
    const diff = ['chill', 'studio', 'encore'].includes(String(difficulty))
      ? String(difficulty)
      : 'studio';
    const cleanName = String(playerName || req.user?.name || 'Guest Producer')
      .trim()
      .slice(0, 60);

    const saved = await saveGameScore({
      uid: req.user?.uid || null,
      email: req.user?.email || null,
      displayName: req.user?.name || null,
      photoUrl: req.user?.picture || null,
      playerName: cleanName || 'Guest Producer',
      score: numScore,
      maxCombo: numCombo,
      accuracy: numAcc,
      difficulty: diff,
    });
    res.status(201).json({ score: saved });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to submit score.' });
  }
});

// 1. Discover Catalog
app.get('/api/music/discover', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const data = await buildDiscoverCatalog(forceRefresh);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load discovery catalog' });
  }
});

// 2. Multi-source Search & Spotify URL Importer
app.get('/api/music/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const genre = String(req.query.genre || 'All Genres').trim();
  const country = String(req.query.country || 'All Countries').trim();
  const platform = String(req.query.platform || 'All Platforms').trim();
  const limit = Math.min(36, Math.max(6, Number(req.query.limit) || 24));

  try {
    // Handle pasted Spotify URL gracefully
    const spotifyMatch = q.match(/open\.spotify\.com\/(track|album|playlist|artist)\/([A-Za-z0-9]+)/i);
    let effectiveQuery = q;
    let importedSpotifyEmbed: string | undefined;
    if (spotifyMatch) {
      const kind = spotifyMatch[1].toLowerCase();
      const spId = spotifyMatch[2];
      importedSpotifyEmbed = `https://open.spotify.com/embed/${kind}/${spId}`;
      // Fetch oEmbed metadata from Spotify (public, no key needed!)
      const oembed = await fetchJsonWithTimeout<{ title?: string }>(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(q)}`,
        3500,
      );
      effectiveQuery = oembed?.title || 'electronic jazz';
    }

    const searchTokens = [
      effectiveQuery,
      genre !== 'All Genres' ? genre : '',
      country !== 'All Countries' && country !== 'Global' ? country : '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    const tasks: Array<Promise<MusicTrack[]>> = [];

    if (platform === 'All Platforms' || platform === 'Audius') {
      tasks.push(searchAudiusTracks(searchTokens || 'electronic', 14));
    }
    if (
      platform === 'YouTube Music' ||
      (platform === 'All Platforms' &&
        (country === 'Rwanda' || effectiveQuery.length >= 2))
    ) {
      const ytQuery =
        country === 'Rwanda' && !effectiveQuery
          ? 'Rwanda music official audio'
          : searchTokens || 'Rwanda music official audio';
      tasks.push(
        searchYouTubeFullTracks(
          ytQuery,
          undefined,
          country !== 'All Countries' ? country : 'Global',
          20,
        ).then((r) => r.tracks),
      );
    }
    if (platform === 'All Platforms' || platform === 'Internet Archive') {
      tasks.push(searchInternetArchiveTracks(searchTokens || 'jazz', 4));
    }
    if (platform === 'All Platforms' || platform === 'Global Radio') {
      tasks.push(
        fetchRadioStations(
          country !== 'All Countries' ? country : undefined,
          effectiveQuery || undefined,
          8,
        ),
      );
    }
    if (platform === 'Wikimedia Commons') {
      tasks.push(
        Promise.resolve(
          RESILIENT_FALLBACK_TRACKS.filter((t) => {
            if (!effectiveQuery) return true;
            const hay = `${t.title} ${t.artist} ${t.genre} ${t.country}`.toLowerCase();
            return hay.includes(effectiveQuery.toLowerCase());
          }),
        ),
      );
    }

    const batches = await Promise.all(tasks);
    let combined = batches.flat();

    if (platform === 'All Platforms') {
      const wmMatches = effectiveQuery
        ? RESILIENT_FALLBACK_TRACKS.filter((t) =>
            `${t.title} ${t.artist} ${t.genre} ${t.country}`
              .toLowerCase()
              .includes(effectiveQuery.toLowerCase()),
          )
        : [];
      if (wmMatches.length > 0) combined = [...combined, ...wmMatches];
      if (combined.length === 0) {
        combined =
          country === 'Rwanda' ? await getRwandaTrendingShowcase() : RESILIENT_FALLBACK_TRACKS;
      }
      if (combined.length === 0) combined = RESILIENT_FALLBACK_TRACKS;
    }

    // Deduplicate by track ID and ensure zero 30s previews
    const dedup = new Map<string, MusicTrack>();
    for (const t of combined) {
      if (!t.isPreview && !dedup.has(t.id)) dedup.set(t.id, t);
    }
    combined = Array.from(dedup.values());

    if (importedSpotifyEmbed && combined.length > 0) {
      combined = combined.map((t, i) =>
        i === 0 ? { ...t, spotifyEmbedUrl: importedSpotifyEmbed, spotifyUrl: q } : t,
      );
    }

    // Apply local genre / country refinements softly if needed
    if (genre !== 'All Genres') {
      const exactGenre = combined.filter(
        (t) => t.genre.toLowerCase().includes(genre.toLowerCase()),
      );
      if (exactGenre.length >= 3) combined = exactGenre;
    }

    res.json({
      query: q,
      genre,
      country,
      platform,
      importedSpotifyEmbed,
      tracks: combined.slice(0, limit),
    });
  } catch {
    res.status(500).json({ error: 'Search failed', tracks: RESILIENT_FALLBACK_TRACKS });
  }
});

// 2c. Dedicated Music Videos, Live Sessions & Visual Cinema Endpoint
const videoCatalogCache = new Map<string, { ts: number; videos: MusicTrack[] }>();
const FALLBACK_VIDEOS: MusicTrack[] = [
  {
    id: 'yt-q0hyYWKXF0Q',
    title: 'Dance Monkey (Official Music Video)',
    artist: 'Tones and I',
    genre: 'Music Video',
    country: 'Australia',
    durationSec: 236,
    audioUrl: 'https://www.youtube.com/watch?v=q0hyYWKXF0Q',
    youtubeVideoId: 'q0hyYWKXF0Q',
    isVideo: true,
    coverUrl: 'https://i.ytimg.com/vi/q0hyYWKXF0Q/hqdefault.jpg',
    year: '2019',
    license: 'Official Music Video',
    sourceLabel: 'YouTube Video',
    bitrateLabel: 'HD Video',
    storeLinks: buildStoreLinks('Tones and I', 'Dance Monkey'),
  },
  {
    id: 'yt-OPf0YbXqDm0',
    title: 'Uptown Funk (Official Video)',
    artist: 'Mark Ronson ft. Bruno Mars',
    genre: 'Music Video',
    country: 'United Kingdom',
    durationSec: 270,
    audioUrl: 'https://www.youtube.com/watch?v=OPf0YbXqDm0',
    youtubeVideoId: 'OPf0YbXqDm0',
    isVideo: true,
    coverUrl: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg',
    year: '2014',
    license: 'Official Music Video',
    sourceLabel: 'YouTube Video',
    bitrateLabel: 'HD Video',
    storeLinks: buildStoreLinks('Mark Ronson Bruno Mars', 'Uptown Funk'),
  },
];

app.get('/api/videos/catalog', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || 'all').trim().toLowerCase();
  const cacheKey = `${category}::${q.toLowerCase()}`;
  const cached = videoCatalogCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 8 * 60 * 1000) {
    return res.json({ videos: cached.videos, category, query: q });
  }

  try {
    let queries: Array<{ q: string; genre: string; country: string }> = [];
    if (q) {
      queries = [
        { q: `${q} official music video`, genre: 'Music Video', country: 'Global' },
        { q: `${q} live session concert`, genre: 'Live Session', country: 'Global' },
      ];
    } else if (category === 'rwanda') {
      queries = [
        { q: 'Bruce Melodie official music video', genre: 'Rwanda Video', country: 'Rwanda' },
        { q: 'Meddy official music video Rwanda', genre: 'Rwanda Video', country: 'Rwanda' },
        { q: 'Chriss Eazy official music video', genre: 'Rwanda Video', country: 'Rwanda' },
        { q: 'Israel Mbonyi official video', genre: 'Rwanda Video', country: 'Rwanda' },
      ];
    } else if (category === 'live_sessions') {
      queries = [
        { q: 'Tiny Desk Concert full live session', genre: 'Live Session', country: 'Global' },
        { q: 'KEXP live performance full', genre: 'Live Session', country: 'Global' },
        { q: 'COLORS SHOW live session', genre: 'Live Session', country: 'Global' },
      ];
    } else if (category === 'cinema') {
      queries = [
        { q: 'ambient electronic live modular visual performance', genre: 'Visual Cinema', country: 'Global' },
        { q: 'acoustic jazz quartet studio live video', genre: 'Visual Cinema', country: 'Global' },
      ];
    } else {
      queries = [
        { q: 'official music video 2025 hits', genre: 'Music Video', country: 'Global' },
        { q: 'Bruce Melodie Chriss Eazy Meddy official video', genre: 'Rwanda Video', country: 'Rwanda' },
        { q: 'Tiny Desk Concert live music session', genre: 'Live Session', country: 'Global' },
      ];
    }

    const ytBatches = await Promise.all(
      queries.map((item) =>
        searchYouTubeFullTracks(item.q, undefined, item.country, 12).then((r) =>
          r.tracks.map((t) => ({
            ...t,
            genre: item.genre,
            isVideo: true,
            sourceLabel: 'Music Video',
            bitrateLabel: 'HD Video',
          })),
        ),
      ),
    );

    const archiveVideos: MusicTrack[] = [];
    if (category === 'cinema' || category === 'all') {
      const iaQuery = q
        ? `(${q}) AND mediatype:movies AND subject:(music OR concert OR live)`
        : 'mediatype:movies AND subject:(concert OR music video OR jazz) -title:TOSEC';
      const iaParams = new URLSearchParams({
        q: iaQuery,
        'fl[]': 'identifier,title,creator,year',
        rows: '4',
        page: '1',
        output: 'json',
        'sort[]': 'downloads desc',
      });
      const iaRes = await fetchJsonWithTimeout<{ response?: { docs?: ArchiveDocRaw[] } }>(
        `https://archive.org/advancedsearch.php?${iaParams.toString()}`,
        4000,
      );
      const docs = (iaRes?.response?.docs || []).filter(
        (d) => !/tosec|dat pack|romset|firmware/i.test(d.title || d.identifier),
      );
      const metaEntries = await Promise.all(
        docs.slice(0, 3).map(async (doc) => {
          const meta = await fetchJsonWithTimeout<{
            files?: Array<{ name: string; format?: string; length?: string }>;
          }>(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`, 3000);
          return { doc, meta };
        }),
      );
      for (const { doc, meta } of metaEntries) {
        const mp4 = meta?.files?.find(
          (f) => f.name.toLowerCase().endsWith('.mp4') && !f.name.toLowerCase().includes('.thumbs'),
        );
        if (!mp4) continue;
        const artist = Array.isArray(doc.creator)
          ? doc.creator[0]
          : doc.creator || 'Internet Archive Film';
        const title = doc.title || doc.identifier;
        const rawVideoUrl = `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeURIComponent(mp4.name)}`;
        archiveVideos.push({
          id: `ia-vid-${doc.identifier}`,
          title,
          artist,
          album: 'Open Cinema Archive',
          genre: 'Visual Cinema',
          country: 'Global',
          durationSec: Math.round(Number(mp4.length)) || 240,
          audioUrl: proxyStreamUrl(rawVideoUrl),
          videoUrl: proxyStreamUrl(rawVideoUrl),
          isVideo: true,
          coverUrl: `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`,
          year: doc.year ? String(doc.year).slice(0, 4) : 'Archive',
          license: 'Open Archive · HD MP4',
          sourceLabel: 'Archive Cinema',
          bitrateLabel: 'MP4 Video',
          storeLinks: buildStoreLinks(artist, title),
        });
      }
    }

    const dedup = new Map<string, MusicTrack>();
    const orderedSources =
      category === 'cinema'
        ? [...archiveVideos, ...ytBatches.flat()]
        : [...ytBatches.flat(), ...archiveVideos];
    for (const v of orderedSources) {
      if (!dedup.has(v.id)) dedup.set(v.id, v);
    }
    let videos = Array.from(dedup.values());
    if (videos.length === 0) videos = FALLBACK_VIDEOS;

    videoCatalogCache.set(cacheKey, { ts: Date.now(), videos: videos.slice(0, 36) });
    res.json({ videos: videos.slice(0, 36), category, query: q });
  } catch {
    res.json({ videos: FALLBACK_VIDEOS, category, query: q });
  }
});

// 2c. Resolve Official Music Video on demand for any track (Audius / Archive / Library)
const videoResolveCache = new Map<
  string,
  { ts: number; videoId: string | null; title?: string; thumbnail?: string; durationSec?: number }
>();

app.get('/api/videos/resolve', async (req: Request, res: Response) => {
  const artist = String(req.query.artist || '').replace(/^@/, '').trim();
  const title = String(req.query.title || '').trim();
  if (!title && !artist) {
    return res.status(400).json({ videoId: null, error: 'Missing track metadata' });
  }

  const key = `${artist.toLowerCase()}::${title.toLowerCase()}`;
  const cached = videoResolveCache.get(key);
  if (cached && Date.now() - cached.ts < 20 * 60 * 1000) {
    return res.json(cached);
  }

  try {
    const cleanTitle = title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim() || title;
    const primaryQuery = `${artist} ${cleanTitle} official music video`.trim();
    let results = await fetchYouTubeSearchRaw(primaryQuery);
    if (results.length === 0) {
      results = await fetchYouTubeSearchRaw(`${artist} ${cleanTitle} music video`.trim());
    }

    const best =
      results.find((v) => v.durationSec >= 45 && v.durationSec <= 900) || results[0] || null;
    const payload = best
      ? {
          ts: Date.now(),
          videoId: best.id,
          title: best.title,
          thumbnail: best.thumbnail,
          durationSec: best.durationSec,
        }
      : { ts: Date.now(), videoId: null };

    videoResolveCache.set(key, payload);
    return res.json(payload);
  } catch {
    return res.json({ videoId: null });
  }
});

// 2b. Dedicated Rwanda Artists & Full Catalog Hub ("Abahanzi bose bo mu Rwanda")
app.get('/api/music/rwanda', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || 'All').trim();

  try {
    const [allRwandaArtists, liveRadio, trendingTracks] = await Promise.all([
      getRwandaArtistsCatalog(),
      fetchRadioStations('Rwanda', undefined, 10),
      getRwandaTrendingShowcase(),
    ]);

    let filtered = allRwandaArtists;
    if (category && category !== 'All') {
      filtered = filtered.filter((a) => (a.genre || '').toLowerCase() === category.toLowerCase());
    }
    if (q) {
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.genre && a.genre.toLowerCase().includes(q)) ||
          (a.bio && a.bio.toLowerCase().includes(q)),
      );
    }

    res.json({
      artists: filtered,
      totalArtists: allRwandaArtists.length,
      categories: [
        'All',
        'Afropop & R&B',
        'Hip-Hop & Kinyatrap',
        'Gakondo & Classics',
        'Gospel & Choirs',
        'DJs & Producers',
      ],
      liveRadio,
      trendingTracks,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load Rwanda music hub' });
  }
});

// 3. Artists Directory
app.get('/api/music/artists', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const country = String(req.query.country || 'All Countries').trim();
  const limit = Math.min(80, Math.max(4, Number(req.query.limit) || 24));

  try {
    const queryTerm = [q, country !== 'All Countries' && country !== 'Global' ? country : '']
      .filter(Boolean)
      .join(' ')
      .trim();

    const [audiusArtists, discover, rwandaCatalog] = await Promise.all([
      searchAudiusArtists(queryTerm || 'producer', Math.min(limit, 24)),
      buildDiscoverCatalog(false),
      getRwandaArtistsCatalog(),
    ]);

    const merged = new Map<string, ArtistSummary>();
    const includeRwandaFirst =
      country === 'Rwanda' ||
      (q && rwandaCatalog.some((r) => r.name.toLowerCase().includes(q.toLowerCase())));

    const ordered = includeRwandaFirst
      ? [...rwandaCatalog, ...audiusArtists, ...discover.featuredArtists]
      : [...audiusArtists, ...discover.featuredArtists, ...rwandaCatalog.slice(0, 12)];

    for (const a of ordered) {
      if (!merged.has(a.id)) merged.set(a.id, a);
    }

    let list = Array.from(merged.values());
    if (country !== 'All Countries' && country !== 'Global') {
      const matched = list.filter((a) =>
        a.location.toLowerCase().includes(country.toLowerCase()),
      );
      if (matched.length > 0) list = matched;
    }
    if (q) {
      const qLow = q.toLowerCase();
      const matched = list.filter(
        (a) =>
          a.name.toLowerCase().includes(qLow) ||
          (a.handle && a.handle.toLowerCase().includes(qLow)) ||
          (a.genre && a.genre.toLowerCase().includes(qLow)) ||
          a.location.toLowerCase().includes(qLow),
      );
      if (matched.length > 0) list = matched;
    }

    res.json({
      query: q,
      country,
      artists: list.slice(0, limit),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load artists', artists: [] });
  }
});

// 4. Single Artist Profile + Full Discography ("All Songs")
app.get('/api/music/artist', async (req: Request, res: Response) => {
  const artistId = String(req.query.id || '').trim();
  const artistName = String(req.query.name || '').trim();
  const songQuery = String(req.query.song || '').trim();

  try {
    if (artistId.startsWith('audius-user-') && !songQuery) {
      const rawId = artistId.replace('audius-user-', '');
      for (const host of AUDIUS_HOSTS) {
        const [userRes, tracksRes] = await Promise.all([
          fetchJsonWithTimeout<{ data?: AudiusUserRaw }>(
            `${host}/v1/users/${encodeURIComponent(rawId)}?app_name=Soundmark`,
            4500,
          ),
          fetchJsonWithTimeout<{ data?: AudiusTrackRaw[] }>(
            `${host}/v1/users/${encodeURIComponent(rawId)}/tracks?app_name=Soundmark&limit=30`,
            4500,
          ),
        ]);
        if (userRes?.data) {
          const u = userRes.data;
          const tracks = (tracksRes?.data || [])
            .filter((t) => !t.duration || Number(t.duration) >= 45)
            .map((t) => mapAudiusTrack(t, host));
          const artist: ArtistSummary = {
            id: artistId,
            name: u.name || u.handle || artistName || 'Artist',
            handle: u.handle ? `@${u.handle.replace(/^@/, '')}` : undefined,
            location: u.location?.trim() || 'Global',
            avatarUrl:
              u.profile_picture?.['480x480'] ||
              u.profile_picture?.['150x150'] ||
              tracks[0]?.coverUrl ||
              ARTWORK_ELECTRONIC,
            verified: Boolean(u.is_verified),
            bio: u.bio || undefined,
            sourceLabel: 'Audius',
            trackCount: u.track_count || tracks.length,
            followerCount: u.follower_count,
            topTracks: tracks,
          };
          return res.json({ artist, tracks });
        }
      }
    }

    const rwandaMatch = (await getRwandaArtistsCatalog()).find(
      (a) =>
        a.id === artistId ||
        (artistName && a.name.toLowerCase() === artistName.toLowerCase()),
    );
    const resolvedName =
      rwandaMatch?.name ||
      artistName ||
      artistId.replace(/^(rw|ia|wm|audius-user)?-artist-/, '').replace(/-/g, ' ');

    const tracks = await fetchFullArtistSongCatalog(
      resolvedName,
      songQuery,
      rwandaMatch ? 'Rwanda' : 'Global',
    );

    const artist: ArtistSummary = {
      id: rwandaMatch?.id || artistId || `artist-${encodeURIComponent(resolvedName)}`,
      name: resolvedName || 'Global Artist',
      location: rwandaMatch?.location || tracks[0]?.country || 'Global',
      avatarUrl: tracks[0]?.coverUrl || rwandaMatch?.avatarUrl || ARTWORK_ACOUSTIC,
      verified: rwandaMatch ? true : Boolean(tracks[0]?.artistVerified),
      bio: rwandaMatch?.bio,
      genre: rwandaMatch?.genre,
      sourceLabel: rwandaMatch ? 'Rwanda Music Index' : tracks[0]?.sourceLabel || 'Soundmark Catalog',
      trackCount: tracks.length,
      topTracks: tracks,
    };

    res.json({ artist, tracks });
  } catch {
    res.status(500).json({ error: 'Artist lookup failed' });
  }
});

// 5. Lyrics & Liner Notes Endpoint (New Feature)
app.get('/api/music/lyrics', async (req: Request, res: Response) => {
  const artist = String(req.query.artist || '').replace(/^@/, '').split(',')[0].split('·')[0].trim();
  const title = String(req.query.title || '').replace(/\([^)]*\)/g, '').trim();

  if (!artist || !title) {
    return res.json({ lyrics: null, source: 'liner-notes' });
  }

  try {
    const json = await fetchJsonWithTimeout<{ lyrics?: string }>(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      4000,
    );
    if (json?.lyrics && json.lyrics.trim().length > 0) {
      return res.json({ lyrics: json.lyrics.trim(), source: 'lyrics.ovh' });
    }
    return res.json({ lyrics: null, source: 'liner-notes' });
  } catch {
    return res.json({ lyrics: null, source: 'liner-notes' });
  }
});

// 6. CORS-enabled Audio Stream Proxy with Range header forwarding for seeking + Web Audio EQ
app.get('/api/music/stream', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '').trim();
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).send('Invalid stream URL');
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'SoundmarkAudioPlatform/1.0',
    };
    if (req.headers.range) {
      forwardHeaders.Range = String(req.headers.range);
    }

    const upstream = await fetch(targetUrl, {
      headers: forwardHeaders,
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).send('Upstream audio unavailable');
    }

    res.status(upstream.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const copyHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
    ];
    for (const h of copyHeaders) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }
    if (!upstream.headers.get('content-type')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }

    if (!upstream.body) {
      return res.end();
    }

    // Pipe Web ReadableStream to Express Response
    const nodeStream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
    nodeStream.on('error', () => {
      if (!res.headersSent) res.status(502);
      res.end();
    });
    nodeStream.pipe(res);
  } catch {
    if (!res.headersSent) {
      res.status(502).send('Stream proxy connection failed');
    }
  }
});

// 7. World Live TV Catalog (iptv-org public global TV index)
interface IptvChannelRaw {
  id: string;
  name: string;
  country?: string;
  categories?: string[];
  is_nsfw?: boolean;
  closed?: string | null;
  website?: string | null;
}

interface IptvStreamRaw {
  channel?: string | null;
  title?: string | null;
  url: string;
  quality?: string | null;
  user_agent?: string | null;
  referrer?: string | null;
}

interface IptvCountryRaw {
  name: string;
  code: string;
  flag?: string;
}

interface IptvLogoRaw {
  channel: string;
  in_use?: boolean;
  url: string;
}

interface IptvCategoryRaw {
  id: string;
  name: string;
}

const VERIFIED_FEATURED_TV: TvChannel[] = [
  {
    id: 'RwandaTV.rw',
    name: 'Rwanda TV (RBA)',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['general', 'news'],
    logoUrl: 'https://i.imgur.com/4nbGvxW.png',
    streamUrl: 'https://5c46fa289c89f.streamlock.net/rtv25/rtv/playlist.m3u8',
    alternateUrls: ['http://197.243.19.131:1935/rtv25/rtv/chunklist.m3u8'],
    quality: '720p',
    website: 'https://www.rba.co.rw/tv',
  },
  {
    id: 'MagicSportsTV.rw',
    name: 'Magic Sports TV Live (RBA)',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['sports', 'general'],
    logoUrl: 'https://i.imgur.com/Le7ZxXn.png',
    streamUrl: 'https://5c46fa289c89f.streamlock.net/rtv25/rtv/playlist.m3u8',
    alternateUrls: [
      'https://5c46fa289c89f.streamlock.net/pub1live/mystream/playlist.m3u8',
      'https://bein-xtra-bein.amagi.tv/playlist.m3u8',
    ],
    quality: '720p',
    website: 'https://www.rba.co.rw/',
  },
  {
    id: 'KC2.rw',
    name: 'KC2 Rwanda (RBA)',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['entertainment', 'music'],
    logoUrl: 'https://i.imgur.com/PsYPzNc.png',
    streamUrl: 'https://5c46fa289c89f.streamlock.net/kc2/kc2/chunklist.m3u8',
    alternateUrls: ['http://197.243.19.131:1935/kc2/kc2/chunklist.m3u8'],
    quality: '720p',
    website: 'https://www.rba.co.rw/kc2',
  },
  {
    id: 'IsiboTV.rw',
    name: 'Isibo TV',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['entertainment', 'music'],
    logoUrl: 'https://i.imgur.com/bXhEeTC.png',
    streamUrl: 'https://5c46fa289c89f.streamlock.net/pub2live/myStream/playlist.m3u8',
    quality: '720p',
    website: 'https://www.isibomedia.com/',
  },
  {
    id: 'TV1.rw',
    name: 'TV1 Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['general', 'news'],
    logoUrl: 'https://i.imgur.com/wk59tHA.png',
    streamUrl: 'https://live.tv1.rw/index.m3u8',
    quality: '720p',
    website: 'https://www.tv1.rw/',
  },
  {
    id: 'TV10.rw',
    name: 'TV10 Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['general', 'sports'],
    logoUrl: 'https://i.imgur.com/DeaWC1N.png',
    streamUrl: 'https://5c46fa289c89f.streamlock.net/pub1live/mystream/playlist.m3u8',
    quality: '720p',
    website: 'http://www.radiotv10.rw/',
  },
  {
    id: 'BTNTV.rw',
    name: 'BTN TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['general', 'news'],
    logoUrl: 'https://i.imgur.com/WmaP8zP.png',
    streamUrl: 'https://tv.btnrwanda.com:3973/live/btnv2live.m3u8',
    quality: '720p',
    website: 'https://btnrwanda.com/',
  },
  {
    id: 'IsangoTV.rw',
    name: 'Isango TV',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['music', 'entertainment'],
    logoUrl: 'https://i.imgur.com/EfsHaMQ.png',
    streamUrl: 'http://80.241.215.175:1935/isangostar/isangostar/playlist.m3u8',
    quality: '720p',
    website: 'http://www.isangostar.rw/',
  },
  {
    id: 'FlashTV.rw',
    name: 'Flash TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['general', 'news'],
    logoUrl: 'https://i.imgur.com/0IViNQw.png',
    streamUrl: '',
    embedUrl: 'https://rtsp.me/embed/BU1Lr9xabYEDqX7k/',
    quality: 'HD Live',
    website: 'https://flash.rw/flash-tv-live/',
  },
  {
    id: 'BPlusTV.rw',
    name: 'B+ TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['entertainment', 'general'],
    logoUrl: 'https://i.ibb.co/WzLwj3X/IMG-20230703-155036.jpg',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCPVldCQvy-xXehq2IAYk1lQ&autoplay=1',
    quality: 'HD Live',
    website: 'https://btnrwanda.com/',
  },
  {
    id: 'PacisTV.rw',
    name: 'Pacis TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['religious', 'general'],
    logoUrl: 'https://i.imgur.com/Z1BAljS.png',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCnS1P03IPFypMVwq6ws2RTw&autoplay=1',
    quality: 'HD Live',
    website: 'https://pacistv.rw/',
  },
  {
    id: 'GenesisTV.rw',
    name: 'Genesis TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['religious', 'entertainment'],
    logoUrl: 'https://i.imgur.com/o9vlINF.png',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCgcajZszd4xkpe4oSWOHjdg&autoplay=1',
    quality: 'HD Live',
  },
  {
    id: 'AuthenticTV.rw',
    name: 'Authentic TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['religious', 'general'],
    logoUrl: 'https://i.imgur.com/PZ1yJjn.png',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCvyC8p3smlA5T_zZ19CUgKw&autoplay=1',
    quality: 'HD Live',
  },
  {
    id: 'IzubaTV.rw',
    name: 'Izuba TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['general', 'news'],
    logoUrl: 'https://i.imgur.com/cRA1CuG.png',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UClc3EdFHAOWO7Jkbcp7e_OQ&autoplay=1',
    quality: 'HD Live',
    website: 'https://www.izubaradiotv.rw/',
  },
  {
    id: 'GoodrichTV.rw',
    name: 'Goodrich TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['business', 'general'],
    logoUrl: 'https://i.imgur.com/52ouIBt.png',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UC6nnOeQKV3uari65ghGm7fA&autoplay=1',
    quality: 'HD Live',
    website: 'https://goodrichtv.com/en',
  },
  {
    id: 'BCNTV.rw',
    name: 'BCN TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['religious', 'general'],
    logoUrl: 'https://i.imgur.com/rP46S5B.png',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCF22W7Vkp6bjqQiPOm84Viw&autoplay=1',
    quality: 'HD Live',
    website: 'https://bcntv.org/',
  },
  {
    id: 'AhupaVisualRadio.rw',
    name: 'Ahupa Visual Radio',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['entertainment', 'music'],
    logoUrl: 'https://i.imgur.com/nJbAbfW.png',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCqejKl-RxFM8sn8pUArWUsA&autoplay=1',
    quality: 'HD Live',
    website: 'https://ahuparadio.com/',
  },
  {
    id: 'VictoryTV.rw',
    name: 'Victory TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['religious', 'general'],
    logoUrl: '',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCvYVGf_JFME9dVe3WtljP1Q&autoplay=1',
    quality: 'HD Live',
  },
  {
    id: 'IshushoTV.rw',
    name: 'Ishusho TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['culture', 'sports'],
    logoUrl: 'https://i.ibb.co/BjpLqbN/ISHUSHO-TV-LOGO-orange.png',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCaUb-MWfVZVIETMu2p9hZPQ&autoplay=1',
    quality: 'HD Live',
    website: 'https://ishushotv.online/',
  },
  {
    id: 'ContactTV.rw',
    name: 'Contact TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['religious', 'general'],
    logoUrl: 'https://i.imgur.com/sb6gK3K.jpeg',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCom0Bc5CisG2zJjXozr8urA&autoplay=1',
    quality: 'HD Live',
  },
  {
    id: 'SemitaTV.rw',
    name: 'Semita TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['religious', 'culture'],
    logoUrl: 'https://i.imgur.com/VwzgyZ5.png',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCdOlJEPQ4nWcmf1FFdAozqA&autoplay=1',
    quality: 'HD Live',
    website: 'https://semita.tv/',
  },
  {
    id: 'CH10TV.rw',
    name: 'CH10 TV Rwanda',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['entertainment', 'music'],
    logoUrl: '',
    streamUrl: '',
    embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UC-hfYFkXZ6sTmI-BrW1fPAQ&autoplay=1',
    quality: 'HD Live',
  },
  {
    id: 'France24.fr',
    name: 'France 24 English',
    countryCode: 'FR',
    countryName: 'France',
    countryFlag: '🇫🇷',
    categories: ['news'],
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/6/65/FRANCE_24_logo.svg',
    streamUrl:
      'https://amg00106-amg00106c1-rakuten-uk-4654.playouts.now.amagi.tv/playlist/amg00106-france24fast-france24-rakutenuk/playlist.m3u8',
    alternateUrls: [
      'https://amg00106-france24-france24-samsunguk-qvpp8.amagi.tv/playlist/amg00106-france24-france24-samsunguk/playlist.m3u8',
      'https://dash3.antik.sk/live/test_france24_eng/playlist.m3u8',
    ],
    quality: '1080p',
    website: 'https://www.france24.com/en/',
  },
  {
    id: 'AlJazeeraEnglish.qa',
    name: 'Al Jazeera English',
    countryCode: 'QA',
    countryName: 'Qatar',
    countryFlag: '🇶🇦',
    categories: ['news'],
    logoUrl: 'https://i.imgur.com/7bRVpnu.png',
    streamUrl: 'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8',
    alternateUrls: ['https://live-hls-web-aja2-gcp.thehlive.com/AJA2/index.m3u8'],
    quality: '1080p',
    website: 'https://www.aljazeera.com/live',
  },
  {
    id: 'BBCNews.uk',
    name: 'BBC News',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    countryFlag: '🇬🇧',
    categories: ['news'],
    logoUrl:
      'https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_BBC_NEWS/images/LOGO_HD/image.png',
    streamUrl: 'https://mumbai-edge.smartplaytv.in/BBCNews/index.m3u8',
    quality: '720p',
    website: 'https://www.bbc.com/news',
  },
  {
    id: 'DWEnglish.de',
    name: 'DW English',
    countryCode: 'DE',
    countryName: 'Germany',
    countryFlag: '🇩🇪',
    categories: ['news', 'documentary'],
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Deutsche_Welle_symbol_2012.svg',
    streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    quality: '1080p',
    website: 'https://www.dw.com/en/',
  },
  {
    id: 'AfrobeatTVEntertainment.uk',
    name: 'Afrobeat TV Entertainment',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    countryFlag: '🇬🇧',
    categories: ['music', 'entertainment'],
    logoUrl: 'https://i.imgur.com/232ndRK.png',
    streamUrl: 'https://stream.ecable.tv/afrobeats/index.m3u8',
    quality: '1080p',
  },
  {
    id: 'TRACEUK.uk',
    name: 'TRACE UK (Music & Urban)',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    countryFlag: '🇬🇧',
    categories: ['music', 'entertainment'],
    logoUrl: '',
    streamUrl: 'https://amg01131-tracetv-amg01131c5-stirr-us-4389.playouts.now.amagi.tv/playlist.m3u8',
    quality: '1080p',
  },
  {
    id: 'Vevo90s00s.uk',
    name: "Vevo '90s & '00s",
    countryCode: 'GB',
    countryName: 'United Kingdom',
    countryFlag: '🇬🇧',
    categories: ['music'],
    logoUrl: '',
    streamUrl: 'https://d1cj21il6keqa2.cloudfront.net/playlist.m3u8',
    alternateUrls: ['https://d2n3779oy6efpi.cloudfront.net/playlist.m3u8'],
    quality: '1080p',
  },
  {
    id: 'DanceTelevision.nl',
    name: 'Dance Television HD',
    countryCode: 'NL',
    countryName: 'Netherlands',
    countryFlag: '🇳🇱',
    categories: ['music'],
    logoUrl: 'https://pbs.twimg.com/profile_images/1268129322730127364/OJlQBZpS_400x400.jpg',
    streamUrl: 'https://m1b2.worldcast.tv/dancetelevisionone/2/dancetelevisionone.m3u8',
    alternateUrls: ['https://m1b2.worldcast.tv/dancetelevisionone/dancetelevisionone.m3u8'],
    quality: '1080p',
  },
  {
    id: 'DanceTVDeepHouseDistrict.ee',
    name: 'Deep House District TV',
    countryCode: 'EE',
    countryName: 'Estonia',
    countryFlag: '🇪🇪',
    categories: ['music'],
    logoUrl: '',
    streamUrl: 'https://m1b2.worldcast.tv/dancetelevisiontwo/dancetelevisiontwo.m3u8',
    quality: '1080p',
  },
  {
    id: 'DeluxeDance.de',
    name: 'Deluxe Dance',
    countryCode: 'DE',
    countryName: 'Germany',
    countryFlag: '🇩🇪',
    categories: ['music'],
    logoUrl: 'https://i.imgur.com/Qu7t15Y.png',
    streamUrl: 'https://sdn-global-live-streaming-packager-cache.3qsdn.com/64733/64733_264_live.m3u8',
    quality: '1080p',
  },
  {
    id: 'Classica.de',
    name: 'Stingray Classica',
    countryCode: 'DE',
    countryName: 'Germany',
    countryFlag: '🇩🇪',
    categories: ['music', 'culture'],
    logoUrl: '',
    streamUrl: 'https://jmp2.uk/plu-5f779951372da90007fd45e8.m3u8',
    quality: '720p',
  },
  {
    id: 'DBMTV.fr',
    name: 'DBM Music TV',
    countryCode: 'FR',
    countryName: 'France',
    countryFlag: '🇫🇷',
    categories: ['music'],
    logoUrl: 'https://i.imgur.com/ab6p2SW.png',
    streamUrl: 'https://dbmtv.vedge.infomaniak.com/livecast/dbmtv/playlist.m3u8',
    quality: '1080p',
  },
  {
    id: 'CaliforniaMusicChannel.us',
    name: 'California Music Channel',
    countryCode: 'US',
    countryName: 'United States',
    countryFlag: '🇺🇸',
    categories: ['music'],
    logoUrl: '',
    streamUrl: 'https://cmc-cmctv-cineverse.amagi.tv/playlist.m3u8',
    quality: '1080p',
  },
  {
    id: 'ClubbingTV.us',
    name: 'Clubbing TV',
    countryCode: 'US',
    countryName: 'United States',
    countryFlag: '🇺🇸',
    categories: ['music'],
    logoUrl: 'https://i.imgur.com/MyiA92q.png',
    streamUrl: 'https://a-cdn.klowdtv.com/live3/clubbingtv_720p/playlist.m3u8',
    quality: '720p',
  },
  {
    id: 'K24.ke',
    name: 'K24 TV Kenya',
    countryCode: 'KE',
    countryName: 'Kenya',
    countryFlag: '🇰🇪',
    categories: ['general', 'news'],
    logoUrl: 'https://i.imgur.com/SUjo6Bm.png',
    streamUrl: 'https://livecdn.premiumfree.tv/afxpstr/K24Backup/index.m3u8',
    quality: '1080p',
  },
  {
    id: 'InooroTV.ke',
    name: 'Inooro TV Kenya',
    countryCode: 'KE',
    countryName: 'Kenya',
    countryFlag: '🇰🇪',
    categories: ['general', 'entertainment'],
    logoUrl: 'https://i.imgur.com/5qFJtmo.png',
    streamUrl: 'https://live-onesignal.royalmedia.co.ke/live/T-MxRsFebq6zx7k2QFMbLw.m3u8',
    quality: '720p',
  },
  {
    id: 'AkiliKids.ke',
    name: 'Akili Kids! East Africa',
    countryCode: 'KE',
    countryName: 'Kenya',
    countryFlag: '🇰🇪',
    categories: ['education', 'kids'],
    logoUrl: 'https://i.imgur.com/xFm2co6.png',
    streamUrl: 'https://m6.livecdn.io/akilikids.co.ke/akilikids.smil/playlist.m3u8',
    quality: '720p',
  },
  {
    id: 'CNNHeadlines.us',
    name: 'CNN Headlines',
    countryCode: 'US',
    countryName: 'United States',
    countryFlag: '🇺🇸',
    categories: ['news'],
    logoUrl: '',
    streamUrl: 'https://jmp2.uk/plu-66c45c274f25dd00092739ee.m3u8',
    alternateUrls: ['https://jmp2.uk/plu-66337e365a402e00087eccaf.m3u8'],
    quality: '1080p',
  },
  {
    id: 'BloombergOriginals.us',
    name: 'Bloomberg Originals',
    countryCode: 'US',
    countryName: 'United States',
    countryFlag: '🇺🇸',
    categories: ['business', 'news', 'documentary'],
    logoUrl: 'https://jiotvimages.cdn.jio.com/dare_images/images/Bloomberg_Originals.png',
    streamUrl:
      'https://86fdc85a.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfQmxvb21iZXJnT3JpZ2luYWxzX0hMUw/playlist.m3u8',
    quality: '1080p',
  },
  {
    id: 'BBCEarth.uk',
    name: 'BBC Earth',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    countryFlag: '🇬🇧',
    categories: ['documentary'],
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/BBC_Earth_2023.svg',
    streamUrl:
      'https://amg00793-amg00793c6-vizio-us-2670.playouts.now.amagi.tv/playlist/amg00793-bbcstudios-bbcearthaall-vizious/playlist.m3u8',
    quality: '1080p',
  },
  {
    id: 'CuriosityNOW.de',
    name: 'Curiosity NOW',
    countryCode: 'DE',
    countryName: 'Germany',
    countryFlag: '🇩🇪',
    categories: ['documentary', 'science'],
    logoUrl: 'https://i.imgur.com/gJ9eMaG.png',
    streamUrl: 'https://amg00170-amg00170c4-samsung-gb-4232.playouts.now.amagi.tv/playlist.m3u8',
    quality: '1080p',
  },
  {
    id: 'AlJazeera2.qa',
    name: 'Al Jazeera 2',
    countryCode: 'QA',
    countryName: 'Qatar',
    countryFlag: '🇶🇦',
    categories: ['news'],
    logoUrl: 'https://i.imgur.com/miq8O1Q.png',
    streamUrl: 'https://live-hls-web-aja2-gcp.thehlive.com/AJA2/index.m3u8',
    quality: '1080p',
  },
  {
    id: 'Euronews.eu',
    name: 'Euronews',
    countryCode: 'FR',
    countryName: 'France',
    countryFlag: '🇫🇷',
    categories: ['news'],
    logoUrl: '',
    streamUrl: 'https://jmp2.uk/plu-61de8e502c8e9400077e5de7.m3u8',
    quality: '1080p',
  },
  {
    id: 'PBSHistory.us',
    name: 'PBS History',
    countryCode: 'US',
    countryName: 'United States',
    countryFlag: '🇺🇸',
    categories: ['documentary', 'education'],
    logoUrl: '',
    streamUrl:
      'https://amg02333-pbs-amg02333c1-samsung-au-1253.playouts.now.amagi.tv/playlist/amg02333-pbsdistributionfast-pbshistory-samsungau/playlist.m3u8',
    quality: '1080p',
  },
  {
    id: 'beINSPORTSXTRA.us',
    name: 'beIN SPORTS XTRA',
    countryCode: 'US',
    countryName: 'United States',
    countryFlag: '🇺🇸',
    categories: ['sports'],
    logoUrl: 'https://i.ibb.co/HT49GPmB/XTRA-2.png',
    streamUrl: 'https://bein-xtra-bein.amagi.tv/playlist.m3u8',
    alternateUrls: ['https://dc1644a9jazgj.cloudfront.net/beIN_Sports_Xtra_Espanol.m3u8'],
    quality: '1080p',
    website: 'https://www.beinsportsxtra.com/',
  },
  {
    id: 'FIFAPlus.uk',
    name: 'FIFA+',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    countryFlag: '🇬🇧',
    categories: ['sports'],
    logoUrl: '',
    streamUrl:
      'https://a62dad94.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWV1X0ZJRkFQbHVzRW5nbGlzaF9ITFM/playlist.m3u8',
    quality: '1080p',
    website: 'https://www.plus.fifa.com/',
  },
  {
    id: 'CBSSportsHQ.us',
    name: 'CBS Sports HQ',
    countryCode: 'US',
    countryName: 'United States',
    countryFlag: '🇺🇸',
    categories: ['sports', 'news'],
    logoUrl: 'https://i.imgur.com/q8BENJg.png',
    streamUrl: 'https://jmp2.uk/plu-5e9f2c05172a0f0007db4786.m3u8',
    quality: '1080p',
  },
  {
    id: 'ESPN8TheOcho.us',
    name: 'ESPN8: The Ocho',
    countryCode: 'US',
    countryName: 'United States',
    countryFlag: '🇺🇸',
    categories: ['sports'],
    logoUrl: 'https://images.fubo.tv/channel-config-ui/station-logos/on-dark/espn_8_the_ocho_bw.png',
    streamUrl: 'https://d3b6q2ou5kp8ke.cloudfront.net/ESPNTheOcho.m3u8',
    quality: '1080p',
  },
  {
    id: 'DDSports.in',
    name: 'DD Sports HD',
    countryCode: 'IN',
    countryName: 'India',
    countryFlag: '🇮🇳',
    categories: ['sports'],
    logoUrl: 'https://dtil.tmsimg.com/assets/s158255_ld_h15_aa.png?lock=720x540',
    streamUrl: 'https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8',
    quality: '1080p',
  },
  {
    id: 'RealMadridTV.es',
    name: 'Real Madrid TV',
    countryCode: 'ES',
    countryName: 'Spain',
    countryFlag: '🇪🇸',
    categories: ['sports'],
    logoUrl: '',
    streamUrl: 'https://rmtv.akamaized.net/hls/live/2043153/rmtv-es-web/master.m3u8',
    quality: '1080p',
  },
  {
    id: 'RedBullTV.at',
    name: 'Red Bull TV',
    countryCode: 'AT',
    countryName: 'Austria',
    countryFlag: '🇦🇹',
    categories: ['sports', 'entertainment'],
    logoUrl: '',
    streamUrl: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
    quality: '1080p',
  },
];

function scoreStreamHost(url: string): number {
  const low = url.toLowerCase();
  const httpsBonus = low.startsWith('https://') ? 3 : 0;
  if (
    low.includes('amagi.tv') ||
    low.includes('akamaized.net') ||
    low.includes('cloudfront.net') ||
    low.includes('streamlock.net') ||
    low.includes('thehlive.com') ||
    low.includes('klowdtv.com') ||
    low.includes('wurl.tv') ||
    low.includes('wurl.com') ||
    low.includes('jmp2.uk')
  ) {
    return 10 + httpsBonus;
  }
  if (/:\d{4,5}\//.test(low)) return 1 + httpsBonus;
  return 5 + httpsBonus;
}

async function fetchTextWithTimeout(url: string, timeoutMs = 15000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SoundmarkAudioPlatform/1.0',
        Accept: 'text/plain, application/x-mpegURL, */*',
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const regionDisplay =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

function countryFlagFromCode(code: string): string {
  const clean = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return '🌐';
  return String.fromCodePoint(...clean.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function countryNameFromCode(code: string): string {
  const clean = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return 'International';
  try {
    return regionDisplay?.of(clean) || clean;
  } catch {
    return clean;
  }
}

interface ParsedM3uEntry {
  id: string;
  name: string;
  countryCode: string;
  categories: string[];
  logoUrl: string;
  streamUrl: string;
  quality: string;
}

function parseM3uAttr(line: string, attr: string): string {
  const re = new RegExp(`${attr}=(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = line.match(re);
  return (m?.[1] || m?.[2] || '').trim();
}

function normalizeCategorySlug(raw: string): string {
  const first = raw.split(/[;,/]/)[0]?.trim().toLowerCase() || 'general';
  if (!first || first === 'undefined' || first === 'xxx' || first === 'adult') return 'general';
  return first.replace(/[^a-z0-9-]+/g, '') || 'general';
}

function parseM3uPlaylist(text: string, fallbackCountry = 'INT', maxEntries = 6500): ParsedM3uEntry[] {
  const lines = text.split(/\r?\n/);
  const entries: ParsedM3uEntry[] = [];
  let pendingInfo = '';

  for (let i = 0; i < lines.length && entries.length < maxEntries; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      pendingInfo = line;
      continue;
    }
    if (line.startsWith('#')) continue;

    if (!/^https?:\/\//i.test(line)) {
      pendingInfo = '';
      continue;
    }

    const tvgId = parseM3uAttr(pendingInfo, 'tvg-id');
    const tvgName = parseM3uAttr(pendingInfo, 'tvg-name');
    const tvgLogo = parseM3uAttr(pendingInfo, 'tvg-logo');
    const tvgCountry = parseM3uAttr(pendingInfo, 'tvg-country').toUpperCase();
    const groupTitle = parseM3uAttr(pendingInfo, 'group-title');
    const commaIdx = pendingInfo.lastIndexOf(',');
    const displayName = (commaIdx >= 0 ? pendingInfo.slice(commaIdx + 1) : tvgName || 'Live Broadcast').trim();

    if (/adult|nsfw|18\+|xxx/i.test(`${groupTitle} ${displayName}`)) {
      pendingInfo = '';
      continue;
    }

    const qualityMatch = displayName.match(/\b(4K|2160p|1080p|720p|576p|480p|360p)\b/i);
    const cleanName = displayName.replace(/\s*[\[(]?(4K|2160p|1080p|720p|576p|480p|360p|Geo-blocked|Not 24\/7)[\])]?/gi, '').trim() || displayName;

    let derivedCountry = fallbackCountry;
    if (tvgCountry && /^[A-Z]{2}$/.test(tvgCountry)) {
      derivedCountry = tvgCountry;
    } else if (tvgId.includes('.')) {
      const suffix = tvgId.split('.').pop()?.split('@')[0]?.toUpperCase() || '';
      if (/^[A-Z]{2}$/.test(suffix)) derivedCountry = suffix;
    }

    const catSlug = normalizeCategorySlug(groupTitle);
    const id = tvgId || `m3u-${derivedCountry}-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    entries.push({
      id,
      name: cleanName,
      countryCode: derivedCountry,
      categories: [catSlug],
      logoUrl: tvgLogo.startsWith('https://') ? tvgLogo : '',
      streamUrl: line,
      quality: qualityMatch ? qualityMatch[1].toUpperCase() : 'HD',
    });
    pendingInfo = '';
  }

  return entries;
}

let cachedTvCatalog: {
  timestamp: number;
  channels: TvChannel[];
  countries: TvCountryOption[];
  categories: TvCategoryOption[];
} | null = null;
const TV_CACHE_TTL_MS = 1000 * 60 * 30;

async function buildTvCatalog() {
  if (cachedTvCatalog && cachedTvCatalog.channels.length >= 800 && Date.now() - cachedTvCatalog.timestamp < TV_CACHE_TTL_MS) {
    return cachedTvCatalog;
  }

  const [channelsRaw, streamsRaw, countriesRaw, logosRaw, categoriesRaw, iptvM3uText, freeTvM3uText, rwandaM3uText] =
    await Promise.all([
      fetchJsonWithTimeout<IptvChannelRaw[]>('https://iptv-org.github.io/api/channels.json', 18000),
      fetchJsonWithTimeout<IptvStreamRaw[]>('https://iptv-org.github.io/api/streams.json', 18000),
      fetchJsonWithTimeout<IptvCountryRaw[]>('https://iptv-org.github.io/api/countries.json', 10000),
      fetchJsonWithTimeout<IptvLogoRaw[]>('https://iptv-org.github.io/api/logos.json', 16000),
      fetchJsonWithTimeout<IptvCategoryRaw[]>('https://iptv-org.github.io/api/categories.json', 10000),
      fetchTextWithTimeout('https://iptv-org.github.io/iptv/index.m3u', 18000),
      fetchTextWithTimeout('https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8', 15000),
      fetchTextWithTimeout('https://iptv-org.github.io/iptv/countries/rw.m3u', 10000),
    ]);

  const countryMap = new Map<string, IptvCountryRaw>();
  for (const c of countriesRaw || []) {
    countryMap.set(c.code.toUpperCase(), c);
  }

  const logoMap = new Map<string, string>();
  for (const l of logosRaw || []) {
    if (!l.channel || !l.url || !l.url.startsWith('https://')) continue;
    if (!logoMap.has(l.channel) || l.in_use) {
      logoMap.set(l.channel, l.url);
    }
  }

  const channelMap = new Map<string, IptvChannelRaw>();
  for (const ch of channelsRaw || []) {
    if (!ch.is_nsfw && !ch.closed) {
      channelMap.set(ch.id, ch);
    }
  }

  const categoryNameMap = new Map<string, string>();
  for (const cat of categoriesRaw || []) {
    categoryNameMap.set(cat.id.toLowerCase(), cat.name);
  }

  const seenUrls = new Set<string>();
  const channelStreamsMap = new Map<
    string,
    {
      ch?: IptvChannelRaw;
      name: string;
      countryCode?: string;
      categories?: string[];
      logoUrl?: string;
      urls: Array<{ url: string; quality: string }>;
    }
  >();

  const registerStreamCandidate = (
    key: string,
    name: string,
    url: string,
    quality: string,
    meta?: { ch?: IptvChannelRaw; countryCode?: string; categories?: string[]; logoUrl?: string },
  ) => {
    if (!url || seenUrls.has(url) || !/^https?:\/\//i.test(url)) return;
    seenUrls.add(url);
    const existing = channelStreamsMap.get(key);
    if (existing) {
      if (existing.urls.length < 5) {
        existing.urls.push({ url, quality: quality || 'HD' });
      }
      if (!existing.logoUrl && meta?.logoUrl) existing.logoUrl = meta.logoUrl;
    } else {
      channelStreamsMap.set(key, {
        ch: meta?.ch,
        name,
        countryCode: meta?.countryCode,
        categories: meta?.categories,
        logoUrl: meta?.logoUrl,
        urls: [{ url, quality: quality || 'HD' }],
      });
    }
  };

  for (const st of streamsRaw || []) {
    if (!st.url || st.user_agent || st.referrer) continue;
    const ch = st.channel ? channelMap.get(st.channel) : undefined;
    if (st.channel && !ch) continue;
    const name = (ch?.name || st.title || 'Live Broadcast').trim();
    const key = ch?.id || `stream-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    registerStreamCandidate(key, name, st.url, st.quality || 'HD', {
      ch,
      countryCode: ch?.country?.toUpperCase(),
      categories: ch?.categories,
    });
  }

  // Merge direct M3U playlists (guarantees 2,500+ global channels + fast fallback if streams.json lags)
  const m3uEntries = [
    ...(rwandaM3uText ? parseM3uPlaylist(rwandaM3uText, 'RW', 100) : []),
    ...(freeTvM3uText ? parseM3uPlaylist(freeTvM3uText, 'INT', 2500) : []),
    ...(iptvM3uText ? parseM3uPlaylist(iptvM3uText, 'INT', 6500) : []),
  ];

  for (const item of m3uEntries) {
    const ch = channelMap.get(item.id);
    const key = ch?.id || item.id;
    registerStreamCandidate(key, ch?.name || item.name, item.streamUrl, item.quality, {
      ch,
      countryCode: ch?.country?.toUpperCase() || item.countryCode,
      categories: ch?.categories?.length ? ch.categories : item.categories,
      logoUrl: item.logoUrl,
    });
  }

  const resolvedChannels: TvChannel[] = [];
  const countryCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const featuredById = new Map(VERIFIED_FEATURED_TV.map((f) => [f.id.toLowerCase(), f]));

  // Pin curated verified channels first
  const addedFeaturedIds = new Set<string>();
  for (const feat of VERIFIED_FEATURED_TV) {
    const logo = logoMap.get(feat.id) || feat.logoUrl;
    const entry = channelStreamsMap.get(feat.id);
    const extraAlts = entry ? entry.urls.map((u) => u.url).filter((u) => u !== feat.streamUrl) : [];
    const mergedAlts = Array.from(new Set([...(feat.alternateUrls || []), ...extraAlts])).slice(0, 4);

    resolvedChannels.push({
      ...feat,
      logoUrl: logo,
      alternateUrls: mergedAlts.length > 0 ? mergedAlts : undefined,
    });
    addedFeaturedIds.add(feat.id.toLowerCase());

    countryCounts.set(feat.countryCode, (countryCounts.get(feat.countryCode) || 0) + 1);
    for (const catId of feat.categories) {
      const low = catId.toLowerCase();
      categoryCounts.set(low, (categoryCounts.get(low) || 0) + 1);
    }
  }

  for (const [id, entry] of channelStreamsMap.entries()) {
    if (addedFeaturedIds.has(id.toLowerCase()) || featuredById.has(id.toLowerCase())) continue;

    entry.urls.sort((a, b) => scoreStreamHost(b.url) - scoreStreamHost(a.url));
    const primary = entry.urls[0];
    const alternates = entry.urls.slice(1).map((u) => u.url);

    const countryCode = (entry.ch?.country || entry.countryCode || 'INT').toUpperCase();
    const cInfo = countryMap.get(countryCode);
    const countryName = cInfo?.name || countryNameFromCode(countryCode);
    const countryFlag = cInfo?.flag || countryFlagFromCode(countryCode);
    const cats =
      entry.ch?.categories && entry.ch.categories.length > 0
        ? entry.ch.categories
        : entry.categories && entry.categories.length > 0
          ? entry.categories
          : ['general'];

    resolvedChannels.push({
      id,
      name: entry.name,
      countryCode,
      countryName,
      countryFlag,
      categories: cats,
      logoUrl: logoMap.get(id) || entry.logoUrl || '',
      streamUrl: primary.url,
      alternateUrls: alternates.length > 0 ? alternates : undefined,
      quality: primary.quality,
      website: entry.ch?.website || undefined,
    });

    countryCounts.set(countryCode, (countryCounts.get(countryCode) || 0) + 1);
    for (const catId of cats) {
      const low = catId.toLowerCase();
      categoryCounts.set(low, (categoryCounts.get(low) || 0) + 1);
    }
  }

  // Keep verified featured channels pinned at the top, then sort rest by CDN reliability + HTTPS + logo + name
  const featuredSet = new Set(VERIFIED_FEATURED_TV.map((f) => f.id));
  resolvedChannels.sort((a, b) => {
    const aFeat = featuredSet.has(a.id) ? 1 : 0;
    const bFeat = featuredSet.has(b.id) ? 1 : 0;
    if (aFeat !== bFeat) return bFeat - aFeat;
    const aScore =
      scoreStreamHost(a.streamUrl) +
      (a.logoUrl ? 4 : 0) +
      (a.countryCode !== 'INT' ? 2 : 0) +
      (a.alternateUrls?.length ? 2 : 0);
    const bScore =
      scoreStreamHost(b.streamUrl) +
      (b.logoUrl ? 4 : 0) +
      (b.countryCode !== 'INT' ? 2 : 0) +
      (b.alternateUrls?.length ? 2 : 0);
    if (aScore !== bScore) return bScore - aScore;
    return a.name.localeCompare(b.name);
  });

  const countries: TvCountryOption[] = Array.from(countryCounts.entries())
    .map(([code, count]) => {
      const info = countryMap.get(code);
      return {
        code,
        name: info?.name || countryNameFromCode(code),
        flag: info?.flag || countryFlagFromCode(code),
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const categories: TvCategoryOption[] = Array.from(categoryCounts.entries())
    .map(([id, count]) => ({
      id,
      name: categoryNameMap.get(id) || (id[0] ? id[0].toUpperCase() + id.slice(1) : 'General'),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const finalChannels = resolvedChannels.length > 0 ? resolvedChannels : VERIFIED_FEATURED_TV;
  cachedTvCatalog = {
    timestamp: Date.now(),
    channels: finalChannels,
    countries,
    categories,
  };
  return cachedTvCatalog;
}

const STREAM_HEALTH_TTL_MS = 1000 * 60 * 15;
const streamHealthCache = new Map<string, { ok: boolean; checkedAt: number }>();

async function verifyHlsStreamLive(url: string): Promise<boolean> {
  if (!url) return false;
  const cached = streamHealthCache.get(url);
  if (cached && Date.now() - cached.checkedAt < STREAM_HEALTH_TTL_MS) {
    return cached.ok;
  }

  const uaHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: '*/*',
  };

  let ok = false;
  try {
    const r1 = await fetch(url, {
      headers: uaHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(2400),
    });
    if (r1.ok) {
      const t1 = await r1.text();
      if (t1.trimStart().startsWith('#EXTM3U')) {
        const base1 = r1.url || url;
        const lines1 = t1
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'));

        if (lines1[0]) {
          const nextUrl = new URL(lines1[0], base1).toString();
          const isSubPlaylist =
            t1.includes('#EXT-X-STREAM-INF') || nextUrl.toLowerCase().includes('.m3u8');

          if (isSubPlaylist) {
            const r2 = await fetch(nextUrl, {
              headers: uaHeaders,
              redirect: 'follow',
              signal: AbortSignal.timeout(2200),
            });
            if (r2.ok) {
              const t2 = await r2.text();
              if (t2.trimStart().startsWith('#EXTM3U')) {
                const base2 = r2.url || nextUrl;
                const segLines = t2
                  .split(/\r?\n/)
                  .map((l) => l.trim())
                  .filter((l) => l && !l.startsWith('#'));
                if (segLines[0]) {
                  const segUrl = new URL(segLines[0], base2).toString();
                  const r3 = await fetch(segUrl, {
                    headers: { ...uaHeaders, Range: 'bytes=0-63' },
                    redirect: 'follow',
                    signal: AbortSignal.timeout(2000),
                  });
                  ok = r3.ok || r3.status === 206;
                }
              }
            }
          } else {
            const r3 = await fetch(nextUrl, {
              headers: { ...uaHeaders, Range: 'bytes=0-63' },
              redirect: 'follow',
              signal: AbortSignal.timeout(2000),
            });
            ok = r3.ok || r3.status === 206;
          }
        }
      }
    }
  } catch {
    ok = false;
  }

  streamHealthCache.set(url, { ok, checkedAt: Date.now() });
  return ok;
}

async function resolveVerifiedTvChannel(ch: TvChannel): Promise<TvChannel | null> {
  const candidates = [ch.streamUrl, ...(ch.alternateUrls || [])].filter(Boolean);
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (await verifyHlsStreamLive(candidate)) {
      const remaining = candidates.filter((_, idx) => idx !== i);
      return {
        ...ch,
        streamUrl: candidate,
        alternateUrls: remaining.length > 0 ? remaining : undefined,
      };
    }
  }
  if (ch.embedUrl) {
    return ch;
  }
  return null;
}

async function collectVerifiedChannels(
  list: TvChannel[],
  targetCount: number,
): Promise<{ verified: TvChannel[]; scannedCount: number }> {
  const verified: TvChannel[] = [];
  const batchSize = 24;
  const maxToScan = Math.min(list.length, Math.max(96, targetCount * 3));
  let scannedCount = 0;

  while (scannedCount < maxToScan && verified.length < targetCount) {
    const slice = list.slice(scannedCount, scannedCount + batchSize);
    scannedCount += slice.length;
    const results = await Promise.all(slice.map((ch) => resolveVerifiedTvChannel(ch)));
    for (const item of results) {
      if (item) verified.push(item);
    }
  }

  return { verified, scannedCount };
}

app.get('/api/tv/rwanda', async (_req: Request, res: Response) => {
  try {
    const [catalog, rwandaRadio] = await Promise.all([
      buildTvCatalog(),
      fetchRadioStations('Rwanda', undefined, 10),
    ]);
    const channels = catalog.channels.filter((ch) => ch.countryCode === 'RW');
    res.json({
      total: channels.length,
      channels,
      radio: rwandaRadio,
    });
  } catch {
    const fallback = VERIFIED_FEATURED_TV.filter((ch) => ch.countryCode === 'RW');
    res.json({
      total: fallback.length,
      channels: fallback,
      radio: [],
    });
  }
});

// SSRF-safe Image CORS Proxy for canvas dominant-color extraction on remote album art / TV logos
function isBlockedProxyHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return true;
  }
  if (/^fe80:/i.test(host) || /^fc/i.test(host) || /^fd/i.test(host)) {
    return true;
  }
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return true;
    }
  }
  return false;
}

app.get('/api/image-proxy', async (req: Request, res: Response) => {
  const rawUrl = String(req.query.url || '').trim();
  if (!rawUrl) {
    return res.status(400).send('Missing url');
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).send('Invalid image URL');
  }
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || isBlockedProxyHostname(parsed.hostname)) {
    return res.status(403).send('Blocked host');
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoundmarkColorSampler/1.0)',
        Accept: 'image/*,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send('Image fetch failed');
    }

    const finalHost = new URL(upstream.url || parsed.toString()).hostname;
    if (isBlockedProxyHostname(finalHost)) {
      return res.status(403).send('Blocked redirect target');
    }

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return res.status(415).send('Not an image');
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.byteLength > 5 * 1024 * 1024) {
      return res.status(413).send('Image too large');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch {
    res.status(502).send('Image proxy error');
  }
});

interface EpgSlotTemplate {
  title: string;
  category: string;
  description: string;
  durationMin: number;
}

const EPG_TEMPLATES: Record<string, EpgSlotTemplate[]> = {
  'RwandaTV.rw': [
    { title: 'Amakuru y’U Rwanda / Rwanda News Live', category: 'News', description: 'National bulletins, Kigali civic briefings, and East African regional reports from RBA.', durationMin: 60 },
    { title: 'Wararamutse Rwanda', category: 'Morning Show', description: 'Live current affairs, studio guests, traffic, and business updates across Rwanda.', durationMin: 90 },
    { title: 'Kubaza Bitera Kumenya', category: 'Public Affairs', description: 'Citizen policy dialogue and national development roundtables with Rwandan leaders.', durationMin: 60 },
    { title: 'Rwanda Premier League Focus', category: 'Sports', description: 'Match highlights, Kigali Pelé Stadium previews, and Amavubi national team updates.', durationMin: 60 },
    { title: 'RBA Evening Journal (English & Kinyarwanda)', category: 'News', description: 'Prime-time national broadcast, economy desk, and East African Community headlines.', durationMin: 60 },
    { title: 'Umuziki Nyarwanda Showcase', category: 'Culture', description: 'Live cultural performances, traditional Inanga & contemporary Kigali music sessions.', durationMin: 60 },
  ],
  'MagicSportsTV.rw': [
    { title: 'Magic Sports Live: Matchday Studio', category: 'Sports', description: 'Live RBA sports broadcast desk covering Rwanda Premier League, BAL basketball, and global football.', durationMin: 90 },
    { title: 'Rwanda Premier League Matchweek Live', category: 'Football', description: 'APR FC, Rayon Sports, Police FC & Kiyovu Sports action with tactical analysis.', durationMin: 90 },
    { title: 'BAL & BK Arena Basketball Hour', category: 'Basketball', description: 'Basketball Africa League highlights, Rwanda Energy Group & Patriots BBC features.', durationMin: 60 },
    { title: 'Amavubi & CAF Champions Desk', category: 'Football', description: 'African continental qualifiers, player interviews, and live scoreboard tracking.', durationMin: 60 },
    { title: 'Tour du Rwanda Cycling Chronicles', category: 'Cycling', description: 'Stage recaps from Kigali hills, Rubavu climbs, and Team Rwanda rider profiles.', durationMin: 60 },
    { title: 'European Football & Late Highlights', category: 'Sports', description: 'Premier League, UEFA Champions League, and global matchday wrap-up.', durationMin: 60 },
  ],
  'KC2.rw': [
    { title: 'KC2 Urban Beats & Kigali Top 20', category: 'Music', description: 'Non-stop Rwandan Afrobeats, Gakondo fusion, and East African chart videos.', durationMin: 60 },
    { title: 'Youth Pulse Kigali', category: 'Entertainment', description: 'Campus talent, creative entrepreneurship, and live DJ sets from RBA Studio 2.', durationMin: 60 },
    { title: 'The Versus Live Countdown', category: 'Music', description: 'Viewer-voted music battles featuring Kigali and East African hitmakers.', durationMin: 60 },
    { title: 'Kigali Nightlife & Afropop Mix', category: 'Music', description: 'Continuous studio mix and live artist interviews.', durationMin: 90 },
    { title: 'East Africa Cinema & Comedy Hour', category: 'Entertainment', description: 'Short films, sketch comedy, and Rwandan creative spotlights.', durationMin: 60 },
  ],
  'IsiboTV.rw': [
    { title: 'The Choice Live', category: 'Entertainment', description: 'Kigali celebrity interviews, new music premieres, and entertainment news.', durationMin: 90 },
    { title: 'Isibo Top 10 Chart', category: 'Music', description: 'Trending Rwandan & East African music videos and studio countdowns.', durationMin: 60 },
    { title: 'Sunday Choice & Culture', category: 'Talk', description: 'In-depth conversations with producers, artists, and Kigali tastemakers.', durationMin: 60 },
    { title: 'Isibo Evening News & Sports', category: 'News', description: 'Daily Rwandan headlines, local football updates, and community stories.', durationMin: 60 },
    { title: 'Kigali Late Night Sessions', category: 'Music', description: 'Acoustic performances and live club mixes.', durationMin: 90 },
  ],
  'TV1.rw': [
    { title: 'Rirarashe Morning Edition', category: 'News', description: 'Investigative journalism, citizen call-ins, and Kigali morning headlines.', durationMin: 90 },
    { title: 'TV1 Special Report', category: 'Current Affairs', description: 'In-depth reporting on infrastructure, agriculture, and technology in Rwanda.', durationMin: 60 },
    { title: 'Zoom In Sports', category: 'Sports', description: 'Rwandan sports debate, league standings, and match previews.', durationMin: 60 },
    { title: 'TV1 Prime News', category: 'News', description: 'Comprehensive evening news bulletin from Kigali.', durationMin: 60 },
    { title: 'Kigali Business Forum', category: 'Economy', description: 'East African markets, fintech, and Rwanda Stock Exchange commentary.', durationMin: 60 },
  ],
  'TV10.rw': [
    { title: 'Ten Sports Live', category: 'Sports', description: 'Live radio-TV simulcast debate on Rwanda Premier League and European football.', durationMin: 90 },
    { title: '10 Tonight News', category: 'News', description: 'National and international headlines with studio correspondents.', durationMin: 60 },
    { title: 'Ten Zone Entertainment', category: 'Music', description: 'East African hits, celebrity spotlight, and live Kigali culture.', durationMin: 60 },
    { title: 'Kickoff Africa', category: 'Sports', description: 'CAF competitions, Premier League previews, and fan call-in debates.', durationMin: 60 },
    { title: 'Midday Music Mix', category: 'Music', description: 'Curated Afropop, R&B, and Rwandan classics.', durationMin: 60 },
  ],
  'BTNTV.rw': [
    { title: 'BTN Business & Innovation', category: 'Business', description: 'Entrepreneurship, Kigali Innovation City startups, and regional trade.', durationMin: 60 },
    { title: 'Amakuru ya BTN TV', category: 'News', description: 'Daily Rwandan civic, economic, and community news coverage.', durationMin: 60 },
    { title: 'East Africa Tech Weekly', category: 'Technology', description: 'Digital finance, AI, and creative media hubs across Rwanda.', durationMin: 60 },
    { title: 'BTN Cultural Magazine', category: 'Culture', description: 'Rwandan heritage, arts exhibitions, and tourism features.', durationMin: 60 },
  ],
  'IsangoTV.rw': [
    { title: 'Isango na Muzika', category: 'Music', description: 'Live Kigali studio interviews with Rwandan musicians and DJs.', durationMin: 60 },
    { title: 'Sunday Night Live', category: 'Entertainment', description: 'Entertainment talk show and trending cultural stories.', durationMin: 90 },
    { title: 'Isango Sports Desk', category: 'Sports', description: 'Local football fixtures, cycling updates, and basketball highlights.', durationMin: 60 },
    { title: 'Isango Evening Bulletin', category: 'News', description: 'Daily Rwanda & regional news summary.', durationMin: 60 },
  ],
  'FlashTV.rw': [
    { title: 'Flash Morning Briefing', category: 'News', description: 'Early headlines, Kigali commuter updates, and newspaper review.', durationMin: 60 },
    { title: 'Flash Music & Hits', category: 'Music', description: 'Continuous Rwandan and East African chart hits.', durationMin: 90 },
    { title: 'Flash Prime News', category: 'News', description: 'Evening news broadcast and community field reports.', durationMin: 60 },
    { title: 'Flash Sports Talk', category: 'Sports', description: 'Match previews and post-game analysis.', durationMin: 60 },
  ],
  'France24.fr': [
    { title: 'France 24 World News Live', category: 'News', description: 'Continuous international news bulletins, diplomatic briefings, and live field reports.', durationMin: 60 },
    { title: 'The Debate', category: 'Analysis', description: 'Live studio discussion on global geopolitics and major international stories.', durationMin: 45 },
    { title: 'Eye on Africa', category: 'Africa News', description: 'Daily stories across East, West, and Central Africa from France 24 correspondents.', durationMin: 45 },
    { title: 'Business & Tech 24', category: 'Economy', description: 'Global markets, European finance, and emerging innovation trends.', durationMin: 45 },
  ],
  'AlJazeeraEnglish.qa': [
    { title: 'Al Jazeera NewsHour', category: 'News', description: 'In-depth global breaking news, live correspondent dispatches, and analysis.', durationMin: 60 },
    { title: 'Inside Story', category: 'Current Affairs', description: 'Expert panel examining the background behind the day’s top international headline.', durationMin: 45 },
    { title: 'Witness Documentary', category: 'Documentary', description: 'Character-driven observational documentaries from around the world.', durationMin: 60 },
    { title: 'Counting the Cost', category: 'Economy', description: 'Global economic trends, energy markets, and trade analysis.', durationMin: 45 },
  ],
  'BBCNews.uk': [
    { title: 'BBC World News', category: 'News', description: 'Live international newsroom coverage from London, Nairobi, and Washington.', durationMin: 60 },
    { title: 'Focus on Africa', category: 'Africa News', description: 'Stories, sport, and business reporting from across the African continent.', durationMin: 45 },
    { title: 'BBC HardTalk', category: 'Interview', description: 'In-depth one-on-one interviews with global decision makers.', durationMin: 45 },
    { title: 'Click & World Business Report', category: 'Tech & Economy', description: 'Technology breakthroughs and global market updates.', durationMin: 60 },
  ],
  'beINSPORTSXTRA.us': [
    { title: 'beIN SPORTS Live Match Coverage', category: 'Sports', description: 'Live football, motorsport, and international tournament broadcasts.', durationMin: 90 },
    { title: 'The Locker Room Show', category: 'Analysis', description: 'Matchday tactical breakdowns, goals, and studio commentary.', durationMin: 60 },
    { title: 'Ligue 1 & Süper Lig Highlights', category: 'Football', description: 'Extended highlights and top goals from European club leagues.', durationMin: 60 },
    { title: 'Copa Libertadores Classics', category: 'Football', description: 'South American club football action and matchday specials.', durationMin: 90 },
  ],
  'FIFAPlus.uk': [
    { title: 'FIFA+ Live Tournament & Classic Matches', category: 'Football', description: 'Live FIFA tournament coverage, qualifiers, and iconic World Cup replays.', durationMin: 90 },
    { title: 'World Cup Greatest Goals', category: 'Highlights', description: 'Archival showcase of unforgettable tournament moments and stars.', durationMin: 60 },
    { title: 'Captains & The Global Game', category: 'Documentary', description: 'Behind-the-scenes stories of national teams across Africa, Europe, and the Americas.', durationMin: 60 },
  ],
};

function buildCategoryTemplates(ch: TvChannel): EpgSlotTemplate[] {
  const cats = ch.categories.map((c) => c.toLowerCase());
  if (cats.includes('sports')) {
    return [
      { title: `${ch.name} Live Matchday Desk`, category: 'Sports', description: `Live scoreboard studio, pre-match lineups, and live commentary on ${ch.name}.`, durationMin: 90 },
      { title: 'Global Football & Championship Highlights', category: 'Football', description: 'Goals, tactical analysis, and live league standings updates.', durationMin: 60 },
      { title: 'Courtside & Arena Action', category: 'Basketball', description: 'Pro basketball, international fixtures, and player spotlight.', durationMin: 60 },
      { title: 'Sports Tonight Wrap-Up', category: 'Sports', description: 'Post-match reactions and tomorrow’s fixture preview.', durationMin: 60 },
    ];
  }
  if (cats.includes('news')) {
    return [
      { title: `${ch.name} Live NewsHour`, category: 'News', description: `Breaking headlines, live reports, and weather briefings from ${ch.countryName}.`, durationMin: 60 },
      { title: 'Special Report & Analysis', category: 'Current Affairs', description: 'Correspondents and analysts examine top regional and global stories.', durationMin: 60 },
      { title: 'Business & Markets Desk', category: 'Economy', description: 'Regional trade, currency updates, and tech briefings.', durationMin: 45 },
      { title: 'Prime Evening Bulletin', category: 'News', description: `Comprehensive nightly broadcast from ${ch.name}.`, durationMin: 60 },
    ];
  }
  if (cats.includes('music')) {
    return [
      { title: `${ch.name} Non-Stop Live Mix`, category: 'Music', description: 'Curated live video rotation featuring trending artists and classics.', durationMin: 60 },
      { title: 'Top 20 Chart Countdown', category: 'Music', description: 'Weekly chart climbers and viewer-favorite music videos.', durationMin: 60 },
      { title: 'Studio Live Sessions', category: 'Performance', description: 'Acoustic sets, DJ performances, and artist interviews.', durationMin: 60 },
      { title: 'After-Hours Chill & Beats', category: 'Music', description: 'Late-night genre mix and visualizers.', durationMin: 90 },
    ];
  }
  if (cats.includes('religious')) {
    return [
      { title: `${ch.name} Morning Reflection`, category: 'Inspiration', description: 'Community reflection, choir music, and daily messages.', durationMin: 60 },
      { title: 'Choral & Gospel Showcase', category: 'Music', description: 'Live choir broadcasts and uplifting performances.', durationMin: 60 },
      { title: 'Community & Family Dialogue', category: 'Talk', description: 'Panel discussions on youth, education, and community service.', durationMin: 60 },
      { title: 'Evening Prayer & Vespers', category: 'Service', description: 'Live evening broadcast and hymns.', durationMin: 60 },
    ];
  }
  return [
    { title: `${ch.name} Live Broadcast`, category: 'General', description: `Live programming from ${ch.countryName} featuring news, culture, and entertainment.`, durationMin: 60 },
    { title: 'Prime Magazine & Culture', category: 'Culture', description: 'Lifestyle features, arts, and regional storytelling.', durationMin: 60 },
    { title: 'Evening Headlines & Talk', category: 'Talk', description: 'Studio discussion and daily recap.', durationMin: 60 },
    { title: 'Late Showcase', category: 'Entertainment', description: 'Music, cinema spotlights, and encore programming.', durationMin: 90 },
  ];
}

function buildChannelEpgGuide(
  ch: TvChannel,
  nowMs: number,
  liveMatches: LiveMatchItem[],
): {
  channelId: string;
  channelName: string;
  countryCode: string;
  countryFlag: string;
  categories: string[];
  logoUrl: string;
  programs: Array<{
    id: string;
    title: string;
    category: string;
    description: string;
    startIso: string;
    endIso: string;
    isLiveNow: boolean;
    progressPct: number;
  }>;
} {
  const baseTemplates = EPG_TEMPLATES[ch.id]
    ? EPG_TEMPLATES[ch.id].map((t) => ({ ...t }))
    : buildCategoryTemplates(ch);

  const isSportsChannel = ch.categories.some((c) => c.toLowerCase() === 'sports');
  if (isSportsChannel && liveMatches.length > 0) {
    const featuredLive = liveMatches.filter((m) => m.statusState === 'in').slice(0, 2);
    const featuredUpcoming = liveMatches.filter((m) => m.statusState === 'pre').slice(0, 2);
    if (featuredLive[0]) {
      baseTemplates[0] = {
        ...baseTemplates[0],
        title: `LIVE: ${featuredLive[0].awayTeam.shortName} vs ${featuredLive[0].homeTeam.shortName} (${featuredLive[0].leagueShort})`,
        category: featuredLive[0].leagueShort || 'Live Match',
        description: `${featuredLive[0].statusDetail} · Score ${featuredLive[0].awayTeam.score}–${featuredLive[0].homeTeam.score}${featuredLive[0].venue ? ` · ${featuredLive[0].venue}` : ''}`,
      };
    }
    if (featuredUpcoming[0] && baseTemplates.length > 1) {
      baseTemplates[1] = {
        ...baseTemplates[1],
        title: `Up Next: ${featuredUpcoming[0].awayTeam.shortName} vs ${featuredUpcoming[0].homeTeam.shortName}`,
        category: featuredUpcoming[0].leagueShort || 'Football',
        description: `Upcoming ${featuredUpcoming[0].leagueName} fixture${featuredUpcoming[0].venue ? ` at ${featuredUpcoming[0].venue}` : ''}.`,
      };
    }
  }

  const totalCycleMin = baseTemplates.reduce((acc, s) => acc + s.durationMin, 0);
  const cycleMs = totalCycleMin * 60 * 1000;
  // Deterministic per-channel phase offset so adjacent channels start on varied schedules
  let hash = 0;
  for (let i = 0; i < ch.id.length; i++) {
    hash = (hash * 31 + ch.id.charCodeAt(i)) >>> 0;
  }
  const offsetMin = (hash % 4) * 15;
  const dayStart = new Date(nowMs);
  dayStart.setUTCMinutes(0, 0, 0);
  const anchorMs = dayStart.getTime() - offsetMin * 60 * 1000 - cycleMs;

  // Walk slots starting from anchorMs until we cover [nowMs, nowMs + 6 hours]
  const programs: Array<{
    id: string;
    title: string;
    category: string;
    description: string;
    startIso: string;
    endIso: string;
    isLiveNow: boolean;
    progressPct: number;
  }> = [];

  let cursorMs = anchorMs;
  let idx = 0;
  while (programs.length < 6 && idx < 48) {
    const tpl = baseTemplates[idx % baseTemplates.length];
    const slotDurationMs = tpl.durationMin * 60 * 1000;
    const slotEndMs = cursorMs + slotDurationMs;

    if (slotEndMs > nowMs) {
      const isLiveNow = cursorMs <= nowMs && nowMs < slotEndMs;
      const progressPct = isLiveNow
        ? Math.min(99, Math.max(2, Math.round(((nowMs - cursorMs) / slotDurationMs) * 100)))
        : 0;
      programs.push({
        id: `${ch.id}-slot-${idx}`,
        title: tpl.title,
        category: tpl.category,
        description: tpl.description,
        startIso: new Date(cursorMs).toISOString(),
        endIso: new Date(slotEndMs).toISOString(),
        isLiveNow,
        progressPct,
      });
    }

    cursorMs = slotEndMs;
    idx += 1;
  }

  return {
    channelId: ch.id,
    channelName: ch.name,
    countryCode: ch.countryCode,
    countryFlag: ch.countryFlag,
    categories: ch.categories,
    logoUrl: ch.logoUrl,
    programs,
  };
}

app.get('/api/tv/epg', async (req: Request, res: Response) => {
  const channelId = String(req.query.channelId || '').trim();
  const countryFilter = String(req.query.country || 'ALL').trim().toUpperCase();
  const nowMs = Date.now();

  try {
    const [catalog, liveMatches] = await Promise.all([
      buildTvCatalog(),
      fetchAllSportsScores(false).catch(() => [] as LiveMatchItem[]),
    ]);

    const featuredIds = [
      'RwandaTV.rw',
      'MagicSportsTV.rw',
      'KC2.rw',
      'IsiboTV.rw',
      'TV1.rw',
      'TV10.rw',
      'BTNTV.rw',
      'IsangoTV.rw',
      'FlashTV.rw',
      'BPlusTV.rw',
      'PacisTV.rw',
      'France24.fr',
      'AlJazeeraEnglish.qa',
      'BBCNews.uk',
      'DWEnglish.de',
      'beINSPORTSXTRA.us',
      'FIFAPlus.uk',
      'CBSSportsHQ.us',
      'AfrobeatTVEntertainment.uk',
      'TRACEUK.uk',
    ];

    const byId = new Map<string, TvChannel>();
    for (const ch of catalog.channels) {
      byId.set(ch.id, ch);
    }

    const lineup: TvChannel[] = [];
    const seen = new Set<string>();

    if (channelId && byId.has(channelId)) {
      const target = byId.get(channelId)!;
      lineup.push(target);
      seen.add(target.id);
    }

    for (const id of featuredIds) {
      const ch = byId.get(id);
      if (ch && !seen.has(ch.id)) {
        if (countryFilter === 'ALL' || ch.countryCode === countryFilter) {
          lineup.push(ch);
          seen.add(ch.id);
        }
      }
    }

    if (countryFilter !== 'ALL') {
      for (const ch of catalog.channels) {
        if (ch.countryCode === countryFilter && !seen.has(ch.id)) {
          lineup.push(ch);
          seen.add(ch.id);
          if (lineup.length >= 20) break;
        }
      }
    }

    const guides = lineup.slice(0, 20).map((ch) => buildChannelEpgGuide(ch, nowMs, liveMatches));
    const selectedGuide = channelId
      ? guides.find((g) => g.channelId === channelId) ||
        (byId.get(channelId) ? buildChannelEpgGuide(byId.get(channelId)!, nowMs, liveMatches) : null)
      : guides[0] || null;

    res.json({
      generatedAt: new Date(nowMs).toISOString(),
      selectedGuide,
      guides,
    });
  } catch {
    const fallbackChannel =
      VERIFIED_FEATURED_TV.find((c) => c.id === channelId) || VERIFIED_FEATURED_TV[0] || null;
    const guides = VERIFIED_FEATURED_TV.slice(0, 12).map((ch) =>
      buildChannelEpgGuide(ch, nowMs, []),
    );
    res.json({
      generatedAt: new Date(nowMs).toISOString(),
      selectedGuide: fallbackChannel ? buildChannelEpgGuide(fallbackChannel, nowMs, []) : null,
      guides,
    });
  }
});


app.get('/api/tv/channels', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const country = String(req.query.country || 'ALL').trim().toUpperCase();
    const category = String(req.query.category || 'all').trim().toLowerCase();
    const verifiedOnly = req.query.verified === '1';
    const limit = Math.min(200, Math.max(4, Number(req.query.limit) || 96));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const data = await buildTvCatalog();
    let filtered = data.channels;

    if (country && country !== 'ALL') {
      filtered = filtered.filter((ch) => ch.countryCode === country);
    }
    if (category && category !== 'all') {
      filtered = filtered.filter((ch) =>
        ch.categories.some((cat) => cat.toLowerCase() === category),
      );
    }
    if (q) {
      filtered = filtered.filter(
        (ch) =>
          ch.name.toLowerCase().includes(q) ||
          ch.countryName.toLowerCase().includes(q) ||
          ch.countryCode.toLowerCase().includes(q) ||
          ch.categories.some((cat) => cat.toLowerCase().includes(q)),
      );
    }

    if (!verifiedOnly) {
      return res.json({
        total: filtered.length,
        totalWorldwide: data.channels.length,
        channels: filtered.slice(offset, offset + limit),
        countries: data.countries,
        categories: data.categories,
      });
    }

    const { verified, scannedCount } = await collectVerifiedChannels(filtered, offset + limit);
    const hasUnscanned = scannedCount < filtered.length;
    const effectiveTotal = hasUnscanned
      ? Math.max(verified.length + (filtered.length - scannedCount > 0 ? limit : 0), verified.length)
      : verified.length;

    res.json({
      total: effectiveTotal,
      totalWorldwide: data.channels.length,
      channels: verified.slice(offset, offset + limit),
      countries: data.countries,
      categories: data.categories,
    });
  } catch {
    res.json({
      total: VERIFIED_FEATURED_TV.length,
      totalWorldwide: VERIFIED_FEATURED_TV.length,
      channels: VERIFIED_FEATURED_TV,
      countries: [],
      categories: [],
    });
  }
});

// 8. Smart HLS (.m3u8 + CMAF/TS segment) CORS Proxy for Live TV streams
app.options('/api/tv/proxy', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.status(204).end();
});

app.get('/api/tv/proxy', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '').trim();
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).send('Invalid TV stream URL');
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const forwardHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (req.headers.range) {
      forwardHeaders.Range = String(req.headers.range);
    }

    const upstream = await fetch(targetUrl, {
      headers: forwardHeaders,
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).send('TV stream unavailable');
    }

    const finalUrl = (upstream.url || targetUrl).toLowerCase();
    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    const isPlaylist =
      contentType.includes('mpegurl') ||
      contentType.includes('m3u') ||
      finalUrl.includes('.m3u8') ||
      targetUrl.toLowerCase().includes('.m3u8');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (isPlaylist) {
      const text = await upstream.text();
      const baseUrl = upstream.url || targetUrl;
      if (text.trimStart().startsWith('#EXTM3U')) {
        const proxiedLines = text.split(/\r?\n/).map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith('#')) {
            return line
              .replace(/URI="([^"]+)"/gi, (_m, uri) => {
                try {
                  const abs = new URL(uri, baseUrl).toString();
                  return `URI="/api/tv/proxy?url=${encodeURIComponent(abs)}"`;
                } catch {
                  return `URI="${uri}"`;
                }
              })
              .replace(/URI='([^']+)'/gi, (_m, uri) => {
                try {
                  const abs = new URL(uri, baseUrl).toString();
                  return `URI='/api/tv/proxy?url=${encodeURIComponent(abs)}'`;
                } catch {
                  return `URI='${uri}'`;
                }
              });
          }
          try {
            const abs = new URL(trimmed, baseUrl).toString();
            return `/api/tv/proxy?url=${encodeURIComponent(abs)}`;
          } catch {
            return line;
          }
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        return res.send(proxiedLines.join('\n'));
      }
      if (contentType) res.setHeader('Content-Type', contentType);
      return res.send(text);
    }

    res.status(upstream.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    }

    if (!upstream.body) return res.end();
    const nodeStream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
    nodeStream.on('error', () => {
      if (!res.headersSent) res.status(502);
      res.end();
    });
    nodeStream.pipe(res);
  } catch {
    if (!res.headersSent) {
      res.status(502).send('Live TV relay failed');
    }
  }
});

// 9. Live Sports Scores & Match Broadcasts (Real-time ESPN Public Scoreboards + Sports TV Channels)
interface EspnCompetitorRaw {
  homeAway?: 'home' | 'away';
  score?: string;
  team?: {
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
  };
  records?: Array<{ summary?: string }>;
  linescores?: Array<{ value?: number; displayValue?: string }>;
  statistics?: Array<{ name?: string; abbreviation?: string; label?: string; displayValue?: string }>;
}

interface EspnEventRaw {
  id: string;
  date?: string;
  status?: {
    type?: {
      state?: 'in' | 'pre' | 'post';
      shortDetail?: string;
      detail?: string;
    };
  };
  season?: { slug?: string; year?: number };
  competitions?: Array<{
    venue?: { fullName?: string };
    competitors?: EspnCompetitorRaw[];
    broadcasts?: Array<{ names?: string[] }>;
    geoBroadcasts?: Array<{ media?: { shortName?: string } }>;
    notes?: Array<{ headline?: string }>;
    details?: Array<{
      clock?: { displayValue?: string };
      type?: { text?: string };
      athletesInvolved?: Array<{ shortName?: string }>;
      team?: { id?: string };
    }>;
  }>;
}

const SPORTS_SCOREBOARD_FEEDS: Array<{
  sport: 'soccer' | 'basketball' | 'football' | 'hockey';
  leagueId: string;
  leagueName: string;
  leagueShort: string;
  path: string;
}> = [
  { sport: 'soccer', leagueId: 'uefa.champions', leagueName: 'UEFA Champions League', leagueShort: 'UCL', path: 'soccer/uefa.champions' },
  { sport: 'soccer', leagueId: 'eng.1', leagueName: 'English Premier League', leagueShort: 'EPL', path: 'soccer/eng.1' },
  { sport: 'soccer', leagueId: 'esp.1', leagueName: 'La Liga', leagueShort: 'LaLiga', path: 'soccer/esp.1' },
  { sport: 'soccer', leagueId: 'ita.1', leagueName: 'Serie A', leagueShort: 'Serie A', path: 'soccer/ita.1' },
  { sport: 'soccer', leagueId: 'ger.1', leagueName: 'Bundesliga', leagueShort: 'Bundesliga', path: 'soccer/ger.1' },
  { sport: 'soccer', leagueId: 'fra.1', leagueName: 'Ligue 1', leagueShort: 'Ligue 1', path: 'soccer/fra.1' },
  { sport: 'soccer', leagueId: 'uefa.europa', leagueName: 'UEFA Europa League', leagueShort: 'UEL', path: 'soccer/uefa.europa' },
  { sport: 'soccer', leagueId: 'usa.1', leagueName: 'MLS', leagueShort: 'MLS', path: 'soccer/usa.1' },
  { sport: 'soccer', leagueId: 'soccer.all', leagueName: 'Global Football', leagueShort: 'Football', path: 'soccer/all' },
  { sport: 'basketball', leagueId: 'nba', leagueName: 'NBA Basketball', leagueShort: 'NBA', path: 'basketball/nba' },
  { sport: 'football', leagueId: 'nfl', leagueName: 'NFL Football', leagueShort: 'NFL', path: 'football/nfl' },
  { sport: 'hockey', leagueId: 'nhl', leagueName: 'NHL Hockey', leagueShort: 'NHL', path: 'hockey/nhl' },
];

let cachedSportsScores: { ts: number; matches: LiveMatchItem[] } | null = null;
const SPORTS_SCORE_TTL_MS = 40 * 1000;

async function fetchAllSportsScores(forceRefresh = false): Promise<LiveMatchItem[]> {
  if (!forceRefresh && cachedSportsScores && Date.now() - cachedSportsScores.ts < SPORTS_SCORE_TTL_MS) {
    return cachedSportsScores.matches;
  }

  const results = await Promise.all(
    SPORTS_SCOREBOARD_FEEDS.map(async (feed) => {
      const json = await fetchJsonWithTimeout<{ events?: EspnEventRaw[] }>(
        `https://site.api.espn.com/apis/site/v2/sports/${feed.path}/scoreboard`,
        4500,
      );
      const events = json?.events || [];
      const items: LiveMatchItem[] = [];

      for (const ev of events) {
        const comp = ev.competitions?.[0];
        const competitors = comp?.competitors || [];
        const home = competitors.find((c) => c.homeAway === 'home') || competitors[0];
        const away = competitors.find((c) => c.homeAway === 'away') || competitors[1];
        if (!home || !away) continue;

        const state = ev.status?.type?.state || 'pre';
        const shortDetail = ev.status?.type?.shortDetail || ev.status?.type?.detail || 'Scheduled';
        const broadcasts = Array.from(
          new Set([
            ...(comp?.broadcasts || []).flatMap((b) => b.names || []),
            ...(comp?.geoBroadcasts || []).map((g) => g.media?.shortName || ''),
          ].filter(Boolean)),
        );
        const noteHeadline = comp?.notes?.[0]?.headline?.trim();
        const slugLabel = ev.season?.slug
          ? ev.season.slug
              .replace(/[-_]+/g, ' ')
              .replace(/\b\w/g, (ch) => ch.toUpperCase())
          : '';
        const computedLeagueName =
          feed.leagueId === 'soccer.all'
            ? noteHeadline || slugLabel || feed.leagueName
            : feed.leagueName;
        const computedLeagueShort =
          feed.leagueId === 'soccer.all'
            ? (noteHeadline?.split(' - ')[0] || slugLabel || feed.leagueShort).slice(0, 20)
            : feed.leagueShort;

        const highlights: LiveMatchHighlight[] = (comp?.details || [])
          .slice(-4)
          .map((d) => {
            const player = d.athletesInvolved?.[0]?.shortName || '';
            const evType = d.type?.text || '';
            return {
              clock: d.clock?.displayValue || '',
              text: [player, evType].filter(Boolean).join(' · ') || 'Match Event',
            };
          })
          .filter((h) => h.text !== 'Match Event' || h.clock);

        const homeLines = home.linescores || [];
        const awayLines = away.linescores || [];
        const maxPeriods = Math.max(homeLines.length, awayLines.length);
        const periodScores =
          maxPeriods > 0
            ? Array.from({ length: maxPeriods }, (_, idx) => ({
                period:
                  feed.sport === 'soccer'
                    ? `${idx + 1}H`
                    : feed.sport === 'hockey'
                      ? `P${idx + 1}`
                      : `Q${idx + 1}`,
                home:
                  homeLines[idx]?.displayValue ??
                  (typeof homeLines[idx]?.value === 'number' ? String(homeLines[idx].value) : '—'),
                away:
                  awayLines[idx]?.displayValue ??
                  (typeof awayLines[idx]?.value === 'number' ? String(awayLines[idx].value) : '—'),
              }))
            : undefined;

        const homeStatsMap = new Map(
          (home.statistics || []).map((s) => [s.name || s.label || '', s]),
        );
        const awayStatsMap = new Map(
          (away.statistics || []).map((s) => [s.name || s.label || '', s]),
        );
        const stats =
          homeStatsMap.size > 0
            ? Array.from(homeStatsMap.entries())
                .slice(0, 6)
                .map(([key, hStat]) => {
                  const aStat = awayStatsMap.get(key);
                  return {
                    label: hStat.label || hStat.abbreviation || key,
                    homeValue: hStat.displayValue || '0',
                    awayValue: aStat?.displayValue || '0',
                  };
                })
            : undefined;

        items.push({
          id: ev.id,
          sport: feed.sport,
          leagueId: feed.leagueId,
          leagueName: computedLeagueName,
          leagueShort: computedLeagueShort,
          statusState: state,
          statusDetail: shortDetail,
          isLive: state === 'in',
          startTime: ev.date || new Date().toISOString(),
          venue: comp?.venue?.fullName || undefined,
          broadcasts,
          homeTeam: {
            name: home.team?.displayName || 'Home',
            shortName: home.team?.shortDisplayName || home.team?.displayName || 'Home',
            abbr: home.team?.abbreviation || 'HOM',
            logoUrl: home.team?.logo || '',
            score: home.score ?? (state === 'pre' ? '—' : '0'),
            record: home.records?.[0]?.summary,
          },
          awayTeam: {
            name: away.team?.displayName || 'Away',
            shortName: away.team?.shortDisplayName || away.team?.displayName || 'Away',
            abbr: away.team?.abbreviation || 'AWY',
            logoUrl: away.team?.logo || '',
            score: away.score ?? (state === 'pre' ? '—' : '0'),
            record: away.records?.[0]?.summary,
          },
          highlights,
          stats,
          periodScores,
        });
      }

      return items;
    }),
  );

  // Deduplicate by event ID, preferring specific league feeds over soccer/all
  const dedupedMap = new Map<string, LiveMatchItem>();
  for (const item of results.flat()) {
    if (!dedupedMap.has(item.id)) {
      dedupedMap.set(item.id, item);
    }
  }
  const merged = Array.from(dedupedMap.values());
  const stateRank: Record<'in' | 'pre' | 'post', number> = { in: 0, pre: 1, post: 2 };
  merged.sort((a, b) => {
    const rDiff = stateRank[a.statusState] - stateRank[b.statusState];
    if (rDiff !== 0) return rDiff;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  if (merged.length > 0) {
    cachedSportsScores = { ts: Date.now(), matches: merged };
  }
  return merged;
}

app.get('/api/sports/scores', async (req: Request, res: Response) => {
  const sport = String(req.query.sport || 'all').trim().toLowerCase();
  const status = String(req.query.status || 'all').trim().toLowerCase();
  const q = String(req.query.q || '').trim().toLowerCase();
  const refresh = req.query.refresh === '1';

  try {
    const [allMatches, tvCatalog] = await Promise.all([
      fetchAllSportsScores(refresh),
      buildTvCatalog(),
    ]);

    let matches = allMatches;
    if (sport && sport !== 'all') {
      matches = matches.filter((m) => m.sport === sport);
    }
    if (status && status !== 'all') {
      matches = matches.filter((m) =>
        status === 'live'
          ? m.statusState === 'in'
          : status === 'upcoming'
            ? m.statusState === 'pre'
            : status === 'final'
              ? m.statusState === 'post'
              : true,
      );
    }
    if (q) {
      matches = matches.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.leagueName.toLowerCase().includes(q) ||
          m.leagueShort.toLowerCase().includes(q),
      );
    }

    const sportsChannels = tvCatalog.channels
      .filter((ch) => ch.categories.some((c) => c.toLowerCase() === 'sports'))
      .slice(0, 60);

    res.json({
      updatedAt: new Date().toISOString(),
      liveCount: allMatches.filter((m) => m.isLive).length,
      matches,
      sportsChannels,
    });
  } catch {
    res.json({
      updatedAt: new Date().toISOString(),
      liveCount: 0,
      matches: [],
      sportsChannels: VERIFIED_FEATURED_TV.filter((c) => c.categories.includes('sports')),
    });
  }
});

// Dedicated Real-Time Football API endpoint (supports optional FOOTBALL_DATA_API_KEY + zero-key ESPN Global Soccer)
app.get('/api/football/matches', async (req: Request, res: Response) => {
  const status = String(req.query.status || 'all').trim().toLowerCase();
  const q = String(req.query.q || '').trim().toLowerCase();
  const refresh = req.query.refresh === '1';

  try {
    const fdApiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();
    const footballDataPromise = fdApiKey
      ? fetch('https://api.football-data.org/v4/matches', {
          headers: { 'X-Auth-Token': fdApiKey },
          signal: AbortSignal.timeout(4500),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : Promise.resolve(null);

    const [allScores, fdRaw, tvCatalog] = await Promise.all([
      fetchAllSportsScores(refresh),
      footballDataPromise,
      buildTvCatalog(),
    ]);

    const fdMatches: LiveMatchItem[] = [];
    if (fdRaw && Array.isArray(fdRaw.matches)) {
      for (const m of fdRaw.matches) {
        const fdStatus = String(m.status || '');
        const statusState: LiveMatchItem['statusState'] =
          fdStatus === 'IN_PLAY' || fdStatus === 'PAUSED'
            ? 'in'
            : fdStatus === 'FINISHED'
              ? 'post'
              : 'pre';
        const homeGoals = m.score?.fullTime?.home ?? m.score?.halfTime?.home;
        const awayGoals = m.score?.fullTime?.away ?? m.score?.halfTime?.away;

        fdMatches.push({
          id: `fd-${m.id}`,
          sport: 'soccer',
          leagueId: m.competition?.code || 'football-data',
          leagueName: m.competition?.name || 'Football',
          leagueShort: m.competition?.code || 'FTB',
          statusState,
          statusDetail:
            fdStatus === 'IN_PLAY'
              ? m.minute
                ? `${m.minute}'`
                : 'LIVE'
              : fdStatus === 'PAUSED'
                ? 'HT'
                : fdStatus === 'FINISHED'
                  ? 'FT'
                  : 'Scheduled',
          isLive: statusState === 'in',
          startTime: m.utcDate || new Date().toISOString(),
          venue: m.venue || undefined,
          broadcasts: [],
          homeTeam: {
            name: m.homeTeam?.name || 'Home',
            shortName: m.homeTeam?.shortName || m.homeTeam?.name || 'Home',
            abbr: m.homeTeam?.tla || 'HOM',
            logoUrl: m.homeTeam?.crest || '',
            score: typeof homeGoals === 'number' ? String(homeGoals) : statusState === 'pre' ? '—' : '0',
          },
          awayTeam: {
            name: m.awayTeam?.name || 'Away',
            shortName: m.awayTeam?.shortName || m.awayTeam?.name || 'Away',
            abbr: m.awayTeam?.tla || 'AWY',
            logoUrl: m.awayTeam?.crest || '',
            score: typeof awayGoals === 'number' ? String(awayGoals) : statusState === 'pre' ? '—' : '0',
          },
          highlights: [],
        });
      }
    }

    const espnFootball = allScores.filter((m) => m.sport === 'soccer');
    let matches: LiveMatchItem[] = fdMatches.length > 0 ? [...fdMatches, ...espnFootball] : espnFootball;

    if (status && status !== 'all') {
      matches = matches.filter((m) =>
        status === 'live'
          ? m.statusState === 'in'
          : status === 'upcoming'
            ? m.statusState === 'pre'
            : status === 'final'
              ? m.statusState === 'post'
              : true,
      );
    }

    if (q) {
      matches = matches.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.leagueName.toLowerCase().includes(q) ||
          m.leagueShort.toLowerCase().includes(q),
      );
    }

    const sportsChannels = tvCatalog.channels
      .filter((ch) => ch.categories.some((c) => c.toLowerCase() === 'sports'))
      .slice(0, 60);

    res.json({
      updatedAt: new Date().toISOString(),
      liveCount: matches.filter((m) => m.isLive).length,
      matches,
      sportsChannels,
    });
  } catch {
    res.json({
      updatedAt: new Date().toISOString(),
      liveCount: 0,
      matches: [],
      sportsChannels: VERIFIED_FEATURED_TV.filter((c) => c.categories.includes('sports')),
    });
  }
});

interface EspnSummaryResponse {
  boxscore?: {
    teams?: Array<{
      homeAway?: 'home' | 'away';
      team?: { abbreviation?: string; displayName?: string };
      statistics?: Array<{ name?: string; label?: string; displayValue?: string }>;
    }>;
  };
  keyEvents?: Array<{
    clock?: { displayValue?: string };
    type?: { text?: string };
    text?: string;
    team?: { abbreviation?: string; displayName?: string };
  }>;
  rosters?: Array<{
    homeAway?: 'home' | 'away';
    roster?: Array<{
      starter?: boolean;
      jersey?: string;
      position?: { abbreviation?: string; displayName?: string };
      athlete?: { displayName?: string; shortName?: string };
    }>;
  }>;
}

app.get('/api/sports/match/:sport/:leagueId/:eventId', async (req: Request, res: Response) => {
  const sport = String(req.params.sport || 'soccer').replace(/[^a-z]/gi, '');
  const leagueId = String(req.params.leagueId || 'soccer.all').replace(/[^a-z0-9.]/gi, '');
  const eventId = String(req.params.eventId || '').replace(/[^a-z0-9-]/gi, '');

  if (!eventId || eventId.startsWith('fd-')) {
    res.json({ stats: [], highlights: [], homeLineup: [], awayLineup: [] });
    return;
  }

  const leaguePath = leagueId === 'soccer.all' ? 'all' : leagueId;
  const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${leaguePath}/summary?event=${encodeURIComponent(eventId)}`;

  try {
    const raw = await fetchJsonWithTimeout<EspnSummaryResponse>(summaryUrl, 5000);
    if (!raw) {
      res.json({ stats: [], highlights: [], homeLineup: [], awayLineup: [] });
      return;
    }

    const teams = raw.boxscore?.teams || [];
    const homeTeamBox = teams.find((t) => t.homeAway === 'home') || teams[0];
    const awayTeamBox = teams.find((t) => t.homeAway === 'away') || teams[1];

    const preferredKeys = [
      'possessionPct',
      'totalShots',
      'shotsOnTarget',
      'wonCorners',
      'foulsCommitted',
      'yellowCards',
      'redCards',
      'offsides',
      'fieldGoalPct',
      'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
      'totalRebounds',
      'assists',
      'turnovers',
      'totalYards',
      'netPassingYards',
      'rushingYards',
      'firstDowns',
    ];

    const awayMap = new Map(
      (awayTeamBox?.statistics || []).map((s) => [s.name || s.label || '', s]),
    );
    const homeStats = homeTeamBox?.statistics || [];
    const orderedHomeStats = [
      ...homeStats.filter((s) => s.name && preferredKeys.includes(s.name)),
      ...homeStats.filter((s) => !s.name || !preferredKeys.includes(s.name)),
    ];

    const stats = orderedHomeStats
      .slice(0, 10)
      .map((hs) => {
        const key = hs.name || hs.label || '';
        const as = awayMap.get(key);
        return {
          label: hs.label || key,
          homeValue: hs.displayValue || '0',
          awayValue: as?.displayValue || '0',
        };
      })
      .filter((s) => s.label);

    const highlights: LiveMatchHighlight[] = (raw.keyEvents || [])
      .filter((ev) => ev.text || ev.type?.text)
      .slice(0, 20)
      .map((ev) => ({
        clock: ev.clock?.displayValue || ev.type?.text || '',
        text: ev.text || ev.type?.text || '',
        teamAbbr: ev.team?.abbreviation,
      }));

    const rosters = raw.rosters || [];
    const homeRosterRaw = rosters.find((r) => r.homeAway === 'home') || rosters[0];
    const awayRosterRaw = rosters.find((r) => r.homeAway === 'away') || rosters[1];

    const mapRoster = (
      list?: NonNullable<EspnSummaryResponse['rosters']>[number]['roster'],
    ) =>
      (list || [])
        .map((p) => ({
          name: p.athlete?.displayName || p.athlete?.shortName || '',
          jersey: p.jersey,
          position: p.position?.abbreviation || p.position?.displayName,
          starter: Boolean(p.starter),
        }))
        .filter((p) => p.name)
        .slice(0, 22);

    res.json({
      stats,
      highlights,
      homeLineup: mapRoster(homeRosterRaw?.roster),
      awayLineup: mapRoster(awayRosterRaw?.roster),
    });
  } catch {
    res.json({ stats: [], highlights: [], homeLineup: [], awayLineup: [] });
  }
});

async function startServer() {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Soundmark listening on http://0.0.0.0:${PORT}`);
    // Pre-warm live TV catalog & top streams in the background
    buildTvCatalog()
      .then(async (cat) => {
        const rw = cat.channels.filter((c) => c.countryCode === 'RW');
        await collectVerifiedChannels(cat.channels, 48);
        if (rw.length > 0) await collectVerifiedChannels(rw, rw.length);
      })
      .catch(() => {});
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
