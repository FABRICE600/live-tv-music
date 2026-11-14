export interface StoreLink {
  id: string;
  name: string;
  tagline: string;
  url: string;
}

export interface MusicStoreDirectoryItem {
  id: string;
  name: string;
  category: string;
  formats: string;
  description: string;
  url: string;
  searchTemplate: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artistHandle?: string;
  artistLocation?: string;
  artistAvatar?: string;
  artistVerified?: boolean;
  album?: string;
  genre: string;
  country: string;
  durationSec: number;
  audioUrl: string;
  coverUrl: string;
  year?: string;
  license: string;
  sourceLabel: string;
  isPreview?: boolean;
  isLive?: boolean;
  bitrateLabel?: string;
  youtubeVideoId?: string;
  spotifyId?: string;
  spotifyUrl?: string;
  spotifyEmbedUrl?: string;
  priceLabel?: string;
  storeLinks: StoreLink[];
}

export interface CuratedPlaylist {
  id: string;
  title: string;
  subtitle: string;
  genre: string;
  coverUrl: string;
  tracks: MusicTrack[];
}

export interface SpotifyCuratedPlaylist {
  id: string;
  title: string;
  subtitle: string;
  curator: string;
  coverUrl: string;
  spotifyEmbedUrl: string;
  spotifyUrl: string;
}

export interface ArtistSummary {
  id: string;
  name: string;
  handle?: string;
  location: string;
  avatarUrl: string;
  verified: boolean;
  bio?: string;
  genre?: string;
  sourceLabel: string;
  trackCount?: number;
  followerCount?: number;
  topTracks: MusicTrack[];
}

export interface DiscoverCatalog {
  featuredTitle: string;
  featuredSubtitle: string;
  heroImageUrl: string;
  curatedPlaylists: CuratedPlaylist[];
  spotifyPlaylists: SpotifyCuratedPlaylist[];
  trendingTracks: MusicTrack[];
  liveStations: MusicTrack[];
  featuredArtists: ArtistSummary[];
  countries: string[];
  platforms: string[];
  genres: string[];
  musicStores: MusicStoreDirectoryItem[];
}

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  trackIds: string[];
}

export interface PlayHistoryEntry {
  trackId: string;
  title: string;
  artist: string;
  genre: string;
  country: string;
  sourceLabel: string;
  coverUrl: string;
  durationSec: number;
  playedAt: string;
}

export interface EqSettings {
  enabled: boolean;
  preset: string;
  bands: [number, number, number, number, number]; // 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz in dB (-12 to +12)
  playbackRate: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type SleepTimerMode = 'off' | '15' | '30' | '45' | '60' | 'track';

export interface TvChannel {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  categories: string[];
  logoUrl: string;
  streamUrl: string;
  alternateUrls?: string[];
  embedUrl?: string;
  quality: string;
  website?: string;
}

export interface TvCountryOption {
  code: string;
  name: string;
  flag: string;
  count: number;
}

export interface TvCategoryOption {
  id: string;
  name: string;
  count: number;
}

export type AppView =
  | { type: 'discover' }
  | { type: 'curated'; playlistId: string }
  | { type: 'browse'; initialGenre?: string; initialCountry?: string; initialPlatform?: string }
  | { type: 'artists' }
  | { type: 'rwanda' }
  | { type: 'artist_profile'; artistId: string; artistName?: string }
  | { type: 'tv' }
  | { type: 'listening_room' }
  | { type: 'stores' }
  | { type: 'history' }
  | { type: 'liked' }
  | { type: 'playlists' }
  | { type: 'custom_playlist'; playlistId: string };

export interface SpotifyEmbedTarget {
  title: string;
  subtitle: string;
  embedUrl: string;
  externalUrl: string;
  isPlaylist?: boolean;
}

export type SurfaceMode = 'paper' | 'ivory' | 'midnight' | 'slate';
export type AccentMode = 'vermilion' | 'cobalt' | 'emerald' | 'amber' | 'plum';

