import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import type {
  ArtistSummary,
  CuratedPlaylist,
  DiscoverCatalog,
  MusicStoreDirectoryItem,
  MusicTrack,
  SpotifyCuratedPlaylist,
  StoreLink,
  TvCategoryOption,
  TvChannel,
  TvCountryOption,
} from './src/types/music.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
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
  'United States',
  'United Kingdom',
  'Japan',
  'Germany',
  'France',
  'Nigeria',
  'Rwanda',
  'Ghana',
  'Kenya',
  'South Africa',
  'Brazil',
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
  'Electronic',
  'Ambient',
  'Jazz',
  'Acoustic',
  'Hip-Hop',
  'Afrobeats',
  'Classical',
  'Indie',
  'Pop',
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
    radioStations,
    afrobeatsFull,
  ] = await Promise.all([
    fetchAudiusTrending(undefined, 14),
    fetchAudiusTrending('Electronic', 8),
    fetchAudiusTrending('Ambient', 8),
    searchAudiusTracks('jazz saxophone trio', 8),
    searchAudiusTracks('acoustic guitar indie', 8),
    fetchRadioStations(undefined, undefined, 8),
    searchAudiusTracks('afrobeats neo soul', 6),
  ]);

  const trendingTracks =
    trendingRes.tracks.length > 0
      ? trendingRes.tracks
      : [...RESILIENT_FALLBACK_TRACKS, ...afrobeatsFull];

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
          : trendingTracks.slice(0, 4),
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

  // Build featured artists from trending + curated full-length tracks
  const artistMap = new Map<string, ArtistSummary>();
  for (const t of [...trendingTracks, ...electronicRes.tracks, ...jazzRes, ...afrobeatsFull]) {
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

  const catalog: DiscoverCatalog = {
    featuredTitle: 'Global Listening Room',
    featuredSubtitle:
      'Full-length independent streams, live international radio relays, 5-band parametric EQ, and direct-to-artist storefronts.',
    heroImageUrl: HERO_LISTENING_ROOM,
    curatedPlaylists,
    spotifyPlaylists: SPOTIFY_PLAYLISTS,
    trendingTracks,
    liveStations: radioStations,
    featuredArtists: Array.from(artistMap.values()).slice(0, 10),
    countries: COUNTRIES,
    platforms: PLATFORMS,
    genres: GENRES,
    musicStores: MUSIC_STORES,
  };

  cachedDiscover = { timestamp: Date.now(), data: catalog };
  return catalog;
}

const app = express();
app.use(express.json());

// Serve generated cover artwork cleanly in both dev & production
app.use('/src/assets/images', express.static(path.resolve(__dirname, 'src/assets/images')));

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
    id: 'RwandaTV.rw',
    name: 'Rwanda TV (RBA)',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['general', 'news'],
    logoUrl: '',
    streamUrl: 'https://5c46fa289c89f.streamlock.net/rtv25/rtv/playlist.m3u8',
    alternateUrls: ['http://197.243.19.131:1935/rtv25/rtv/chunklist.m3u8'],
    quality: '720p',
    website: 'https://www.rba.co.rw/tv',
  },
  {
    id: 'KC2.rw',
    name: 'KC2 Rwanda (RBA)',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['entertainment', 'music'],
    logoUrl: '',
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
    logoUrl: '',
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
    logoUrl: '',
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
    logoUrl: '',
    streamUrl: 'https://5c46fa289c89f.streamlock.net/pub1live/mystream/playlist.m3u8',
    quality: '720p',
    website: 'http://www.radiotv10.rw/',
  },
  {
    id: 'IsangoTV.rw',
    name: 'Isango TV',
    countryCode: 'RW',
    countryName: 'Rwanda',
    countryFlag: '🇷🇼',
    categories: ['music', 'entertainment'],
    logoUrl: '',
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
    logoUrl: '',
    streamUrl: '',
    embedUrl: 'https://rtsp.me/embed/BU1Lr9xabYEDqX7k/',
    quality: 'HD Live',
    website: 'https://flash.rw/flash-tv-live/',
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
    id: 'AlJazeera2.qa',
    name: 'Al Jazeera 2',
    countryCode: 'QA',
    countryName: 'Qatar',
    countryFlag: '🇶🇦',
    categories: ['news'],
    logoUrl: '',
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
    id: 'ClubbingTV.us',
    name: 'Clubbing TV',
    countryCode: 'US',
    countryName: 'United States',
    countryFlag: '🇺🇸',
    categories: ['music'],
    logoUrl: '',
    streamUrl: 'https://a-cdn.klowdtv.com/live3/clubbingtv_720p/playlist.m3u8',
    quality: '720p',
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

let cachedTvCatalog: {
  timestamp: number;
  channels: TvChannel[];
  countries: TvCountryOption[];
  categories: TvCategoryOption[];
} | null = null;
const TV_CACHE_TTL_MS = 1000 * 60 * 30;

async function buildTvCatalog() {
  if (cachedTvCatalog && Date.now() - cachedTvCatalog.timestamp < TV_CACHE_TTL_MS) {
    return cachedTvCatalog;
  }

  const [channelsRaw, streamsRaw, countriesRaw, logosRaw, categoriesRaw] = await Promise.all([
    fetchJsonWithTimeout<IptvChannelRaw[]>('https://iptv-org.github.io/api/channels.json', 9000),
    fetchJsonWithTimeout<IptvStreamRaw[]>('https://iptv-org.github.io/api/streams.json', 9000),
    fetchJsonWithTimeout<IptvCountryRaw[]>('https://iptv-org.github.io/api/countries.json', 7000),
    fetchJsonWithTimeout<IptvLogoRaw[]>('https://iptv-org.github.io/api/logos.json', 9000),
    fetchJsonWithTimeout<IptvCategoryRaw[]>('https://iptv-org.github.io/api/categories.json', 7000),
  ]);

  if (!channelsRaw || !streamsRaw) {
    return {
      timestamp: Date.now(),
      channels: VERIFIED_FEATURED_TV,
      countries: [
        { code: 'FR', name: 'France', flag: '🇫🇷', count: 2 },
        { code: 'DE', name: 'Germany', flag: '🇩🇪', count: 1 },
        { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', count: 2 },
        { code: 'RW', name: 'Rwanda', flag: '🇷🇼', count: 3 },
        { code: 'US', name: 'United States', flag: '🇺🇸', count: 3 },
        { code: 'QA', name: 'Qatar', flag: '🇶🇦', count: 1 },
      ],
      categories: [
        { id: 'news', name: 'News', count: 5 },
        { id: 'music', name: 'Music', count: 5 },
        { id: 'entertainment', name: 'Entertainment', count: 3 },
        { id: 'documentary', name: 'Documentary', count: 2 },
      ],
    };
  }

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
  for (const ch of channelsRaw) {
    if (!ch.is_nsfw && !ch.closed) {
      channelMap.set(ch.id, ch);
    }
  }

  const categoryNameMap = new Map<string, string>();
  for (const cat of categoriesRaw || []) {
    categoryNameMap.set(cat.id.toLowerCase(), cat.name);
  }

  // Group all HTTPS streams per channel so we pick the strongest CDN host and keep backups
  const seenUrls = new Set<string>();
  const channelStreamsMap = new Map<string, { ch?: IptvChannelRaw; name: string; urls: Array<{ url: string; quality: string }> }>();

  for (const st of streamsRaw) {
    if (!st.url || seenUrls.has(st.url)) continue;
    if (st.user_agent || st.referrer) continue;

    const ch = st.channel ? channelMap.get(st.channel) : undefined;
    if (st.channel && !ch) continue; // Closed or NSFW channel

    const isHttps = st.url.startsWith('https://');
    const isRwandaHttp = st.url.startsWith('http://') && ch?.country === 'RW';
    if (!isHttps && !isRwandaHttp) continue;

    const name = (ch?.name || st.title || 'Live Broadcast').trim();
    const key = ch?.id || `stream-${name.toLowerCase()}-${channelStreamsMap.size}`;
    seenUrls.add(st.url);

    const existing = channelStreamsMap.get(key);
    if (existing) {
      if (existing.urls.length < 5) {
        existing.urls.push({ url: st.url, quality: st.quality || 'HD' });
      }
    } else {
      channelStreamsMap.set(key, {
        ch,
        name,
        urls: [{ url: st.url, quality: st.quality || 'HD' }],
      });
    }
  }

  const resolvedChannels: TvChannel[] = [];
  const countryCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const featuredById = new Map(VERIFIED_FEATURED_TV.map((f) => [f.id.toLowerCase(), f]));

  // Always seed our verified live channels first so top listings are immediately playable
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

    // Sort candidate URLs so reliable CDN hosts are tried first
    entry.urls.sort((a, b) => scoreStreamHost(b.url) - scoreStreamHost(a.url));
    const primary = entry.urls[0];
    const alternates = entry.urls.slice(1).map((u) => u.url);

    const countryCode = (entry.ch?.country || 'INT').toUpperCase();
    const cInfo = countryMap.get(countryCode);
    const countryName = cInfo?.name || (countryCode === 'INT' ? 'International' : countryCode);
    const countryFlag = cInfo?.flag || '🌐';
    const cats = entry.ch?.categories && entry.ch.categories.length > 0 ? entry.ch.categories : ['general'];

    resolvedChannels.push({
      id,
      name: entry.name,
      countryCode,
      countryName,
      countryFlag,
      categories: cats,
      logoUrl: logoMap.get(id) || '',
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

  // Keep verified featured channels pinned at the top, then sort rest by CDN reliability + logo + name
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
        name: info?.name || (code === 'INT' ? 'International' : code),
        flag: info?.flag || '🌐',
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const categories: TvCategoryOption[] = Array.from(categoryCounts.entries())
    .map(([id, count]) => ({
      id,
      name: categoryNameMap.get(id) || id[0].toUpperCase() + id.slice(1),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  cachedTvCatalog = {
    timestamp: Date.now(),
    channels: resolvedChannels.length > 0 ? resolvedChannels : VERIFIED_FEATURED_TV,
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
      signal: AbortSignal.timeout(2600),
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
              signal: AbortSignal.timeout(2400),
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
                    signal: AbortSignal.timeout(2200),
                  });
                  ok = r3.ok || r3.status === 206;
                }
              }
            }
          } else {
            const r3 = await fetch(nextUrl, {
              headers: { ...uaHeaders, Range: 'bytes=0-63' },
              redirect: 'follow',
              signal: AbortSignal.timeout(2200),
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

app.get('/api/tv/channels', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const country = String(req.query.country || 'ALL').trim().toUpperCase();
    const category = String(req.query.category || 'all').trim().toLowerCase();
    const verifiedOnly = req.query.verified !== '0';
    const limit = Math.min(120, Math.max(4, Number(req.query.limit) || 48));
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
